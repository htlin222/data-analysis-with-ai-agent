#!/usr/bin/env python3
"""錄製一段真實的 Claude Code session，並在每個提示詞輸入點插入 marker。

為什麼不透過 tmux
------------------
第一版是 `tmux new-session ... asciinema rec -c claude`，錄出來的檔案在
播放時會出現殘影：中文與 emoji 疊在舊字上，越到後面越髒。

原因不是欄數，也不是播放器：tmux 會把 claude 的輸出重排進自己的格子，
再送出「只重畫有變動的格子」的最佳化序列，那些序列內含 tmux 的字寬假設。
終端機模擬器（asciinema-player 與 agg 共用的 avt）對 emoji、`⎿`、`✳`
這類字算出的寬度與 tmux 不同，欄位一旦錯開，舊字就永遠不會被覆蓋。

這一版自己開 PTY 直接跑 claude，錄的是 claude 本人吐出的序列，
中間沒有第二套排版邏輯，殘影因此消失。副作用是時間軸完全由本檔控制，
marker 可以直接用當下的時間值，不必再從輸出內容反推位置。

用法：
    python3 scripts/record_claude.py

輸出：
    site/casts/02_claude.cast
    site/casts/02_claude.json
"""
from __future__ import annotations

import errno
import fcntl
import json
import os
import pathlib
import re
import select
import shutil
import signal
import struct
import subprocess
import sys
import termios
import time

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "site" / "casts"
WORK = pathlib.Path(os.environ.get("TMPDIR", "/tmp")) / "dawa-claude-demo"

COLS, ROWS = 100, 30
IDLE_CAP = 2.0        # 靜止超過這個秒數就壓縮，避免等待時畫面空轉
TURN_BUDGET = 300.0   # 單一回合的上限

# 回合結束不能用「連續 N 秒沒有輸出」判斷：TUI 的游標一直在閃，
# 輸出永遠不會完全停。改看輸出速率——忙碌時 spinner 與 token 計數
# 每秒吐幾百 bytes，閒置時只剩游標閃爍。
QUIET_WINDOW = 2.0    # 觀察窗長度（秒）
QUIET_BYTES = 220     # 窗內位元組數低於此值即視為閒置
CHUNK, CHUNK_DELAY = 6, 0.09   # 逐塊送出，模擬打字節奏

SEG = {
    "id": "02_claude",
    "title": "Claude Code",
    "time": "0:35 – 1:05",
    "note": "從觀察資料夾到寫出 01_clean.R。工作目錄只有 raw/，"
            "其餘檔案由這段 session 產生。",
}

PROMPTS = [
    ("請看一下這個資料夾，告訴我裡面有什麼。",
     "第一個提示詞：先讓它看，不下指令"),

    ("先不要做任何修改。請讀 raw/ 底下的兩份主要 CSV，"
     "用中文列出你發現的所有資料品質問題，"
     "每一項告訴我：問題是什麼、影響幾筆、你建議怎麼處理。",
     "「先不要做任何修改」：診斷與處置分開"),

    ("好，我們一項一項來。這兩份檔案的 patient_id 都是 1 到 100，"
     "請告訴我它們是不是同一批病人。先列證據給我看，不要自己合併。",
     "逐項處理：先驗證 patient_id"),

    ("接下來處理分期。但在你動手之前，請告訴我你打算怎麼把 stage "
     "分成 early 和 advanced，以及你用什麼理由選這個切點。",
     "切點：在動作之前先取得說明"),

    ("就用 I/II vs III/IV。把清洗步驟寫成 scripts/01_clean.R，"
     "要求使用 here::here() 不要用 setwd()，不要 rm(list=ls())。"
     "另外把所有決定寫成 docs/cleaning_log.md，"
     "清洗後的資料存成 output/cohort_clean.csv。",
     "核可後才動手：寫腳本與處理紀錄"),

    ("執行 scripts/01_clean.R，把輸出貼給我看。",
     "執行並確認產出"),
]

ANSI = re.compile(r"\x1b\[[0-9;?]*[a-zA-Z]|\x1b\][^\x07]*\x07|\x1b[()][B0]")
ASK_PERMISSION = re.compile(r"Do you want|❯\s*1\.\s*Yes|1\.\s*Yes")
# 工作目錄每次重建，第一次啟動會問是否信任這個資料夾。
# 預設反白在「No」，若不處理，第一個提示詞會被打進這個對話框。
ASK_TRUST = re.compile(r"trust this folder|Quick safety check|你信任")
# 輸入框就緒的標記。答完信任對話框後 TUI 還要幾秒才開機完成，
# 這段空檔裡輸出會短暫安靜，若當成就緒，第一個提示詞會被吃掉。
READY = re.compile(r"-- INSERT --|auto mode on|Try \"")


class Recorder:
    """把 PTY 的輸出寫成 asciinema v2 cast，時間軸自行控制。"""

    def __init__(self, path: pathlib.Path):
        self.fh = path.open("w")
        self.fh.write(json.dumps({
            "version": 2, "width": COLS, "height": ROWS,
            "timestamp": int(time.time()),
            "env": {"SHELL": os.environ.get("SHELL", "/bin/bash"),
                    "TERM": "xterm-256color"},
        }) + "\n")
        self.t = 0.0                 # cast 內部時間
        self.last = time.time()      # 上一次寫入的牆鐘時間

    def _advance(self):
        now = time.time()
        # 壓縮長時間靜止，但 marker 也走同一條時間軸，所以不會錯位
        self.t += min(now - self.last, IDLE_CAP)
        self.last = now
        return round(self.t, 6)

    def out(self, data: str):
        self.fh.write(json.dumps([self._advance(), "o", data],
                                 ensure_ascii=False) + "\n")
        self.fh.flush()          # 邊錄邊落地，方便中途檢視進度

    def marker(self, label: str) -> float:
        t = self._advance()
        self.fh.write(json.dumps([t, "m", label], ensure_ascii=False) + "\n")
        return t

    def close(self):
        self.fh.close()


def stage_workspace():
    """只放 raw/，其餘由 session 自己建立。"""
    if WORK.exists():
        shutil.rmtree(WORK)
    (WORK / "raw").mkdir(parents=True)
    for f in (ROOT / "raw").iterdir():
        if f.is_file():
            shutil.copy2(f, WORK / "raw" / f.name)
    (WORK / ".claude").mkdir()
    (WORK / ".claude" / "settings.json").write_text(json.dumps({
        "permissions": {
            "allow": ["Read", "Glob", "Grep",
                      "Bash(ls:*)", "Bash(head:*)", "Bash(tail:*)",
                      "Bash(wc:*)", "Bash(cat:*)", "Bash(Rscript:*)",
                      "Bash(mkdir:*)"]
        }
    }, indent=2))


def spawn() -> tuple[int, subprocess.Popen]:
    master, slave = os.openpty()
    fcntl.ioctl(master, termios.TIOCSWINSZ,
                struct.pack("HHHH", ROWS, COLS, 0, 0))
    env = dict(os.environ,
               TERM="xterm-256color",
               COLUMNS=str(COLS), LINES=str(ROWS),
               CLICOLOR="1")
    env.pop("TMUX", None)            # 避免被誤判為在 tmux 內
    # 從外層 session 繼承的標記會讓內層停用逐字稿儲存，
    # 而逐字稿是事後核對回答內容的唯一可靠來源。
    for k in ("CLAUDE_CODE_CHILD_SESSION", "CLAUDE_CODE_SESSION_ID",
              "CLAUDECODE", "CLAUDE_CODE_ENTRYPOINT"):
        env.pop(k, None)
    proc = subprocess.Popen(
        ["claude"], cwd=str(WORK), env=env,
        stdin=slave, stdout=slave, stderr=slave,
        preexec_fn=os.setsid, close_fds=True,
    )
    os.close(slave)
    return master, proc


def pump(master: int, rec: Recorder, budget: float,
         quiet_bytes: int = QUIET_BYTES,
         window: float = QUIET_WINDOW) -> str:
    """讀到輸出速率降到閒置水準為止，回傳這段期間的原始文字。

    window 內累積的位元組數低於 quiet_bytes 即視為閒置。
    """
    seen, start = [], time.time()
    win_start, win_bytes = time.time(), 0
    while True:
        if time.time() - start > budget:
            return "".join(seen)
        r, _, _ = select.select([master], [], [], 0.2)
        if r:
            try:
                chunk = os.read(master, 65536)
            except OSError as e:
                if e.errno == errno.EIO:
                    return "".join(seen)
                raise
            if not chunk:
                return "".join(seen)
            text = chunk.decode("utf-8", "replace")
            rec.out(text)
            seen.append(text)
            win_bytes += len(chunk)
        if time.time() - win_start >= window:
            if win_bytes < quiet_bytes:
                return "".join(seen)
            win_start, win_bytes = time.time(), 0


def wait_ready(master: int, rec: Recorder, budget: float = 90) -> bool:
    """等到輸入框真的可以收字為止。"""
    seen, start = "", time.time()
    while time.time() - start < budget:
        seen += ANSI.sub("", pump(master, rec, budget=min(15, budget)))
        if READY.search(seen):
            return True
    return False


def send(master: int, text: str):
    for i in range(0, len(text), CHUNK):
        os.write(master, text[i:i + CHUNK].encode())
        time.sleep(CHUNK_DELAY)


def record() -> None:
    # 先錄到暫存檔，六輪都跑完才換上去。
    # 直接寫目標檔的話，中途失敗會把上一份完整錄影截斷，且無法復原。
    cast = OUT / f"{SEG['id']}.cast.part"
    final = OUT / f"{SEG['id']}.cast"
    OUT.mkdir(parents=True, exist_ok=True)
    cast.unlink(missing_ok=True)
    stage_workspace()

    master, proc = spawn()
    rec = Recorder(cast)
    markers = []

    try:
        # 啟動畫面
        screen = pump(master, rec, budget=90)

        # 信任對話框：反白在「No」，往下一格選「Yes, I trust this folder」
        if ASK_TRUST.search(ANSI.sub("", screen)):
            print("  偵測到信任對話框，選擇信任此資料夾")
            os.write(master, b"\x1b[B")      # Down
            time.sleep(0.5)
            os.write(master, b"\r")
            time.sleep(1.0)

        if not wait_ready(master, rec):
            print("  ! 等不到輸入框就緒，仍繼續")
        time.sleep(1.5)

        for i, (text, label) in enumerate(PROMPTS, 1):
            markers.append({"label": label, "at": rec.marker(label)})
            time.sleep(0.3)
            send(master, text)
            pump(master, rec, budget=20)                  # 打字的回顯
            time.sleep(0.5)
            os.write(master, b"\r")

            # 權限對話框會停在畫面上不再輸出，看起來就像回合結束；
            # 偵測到就送 Enter 核可，繼續等。
            spent, approvals = 0.0, 0
            while spent < TURN_BUDGET:
                t0 = time.time()
                chunk = pump(master, rec, TURN_BUDGET - spent)
                spent += time.time() - t0
                tail = ANSI.sub("", chunk)[-1500:]
                if ASK_PERMISSION.search(tail) and approvals < 12:
                    approvals += 1
                    os.write(master, b"\r")
                    time.sleep(0.6)
                    continue
                break
            print(f"  turn {i}/{len(PROMPTS)} 完成"
                  f"（核可 {approvals} 次）: {label}")
            time.sleep(1.2)
            pump(master, rec, budget=10)

        # 收尾
        os.write(master, b"\x03")
        time.sleep(0.6)
        os.write(master, b"\x03")
        pump(master, rec, budget=15)
    finally:
        rec.close()
        try:
            os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
        except (ProcessLookupError, PermissionError):
            pass
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()
        os.close(master)

    if len(markers) < len(PROMPTS):
        sys.exit(f"只完成 {len(markers)}/{len(PROMPTS)} 輪，"
                 f"保留原檔不覆蓋。未完成的錄影留在 {cast.name}")

    cast.replace(final)
    (OUT / f"{SEG['id']}.json").write_text(
        json.dumps({**{k: SEG[k] for k in ("id", "title", "time", "note")},
                    "markers": markers}, ensure_ascii=False, indent=2) + "\n")
    print(f"{SEG['id']}: {len(markers)} markers → {final.relative_to(ROOT)}")


if __name__ == "__main__":
    if shutil.which("claude") is None:
        sys.exit("找不到 claude")
    record()
