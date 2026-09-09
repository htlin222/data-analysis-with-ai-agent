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
# 錄製用的獨立設定目錄。不使用操作者本人的 ~/.claude：
#   1. 全域 hooks（SessionStart 等）會在畫面上留下與課程無關的訊息，
#      而且 SessionStart 的輸出來得比輸入框就緒晚，那次重繪會把已經
#      打進去的提示詞清掉——前兩輪被吃掉就是這樣來的。
#   2. statusLine 會把模型名稱、額度、時間一路錄進公開教材。
#   3. 全域 CLAUDE.md 會讓 session 的行為與學員的預設環境不同。
# 只帶入登入憑證，其餘一律從乾淨狀態開始。
CONFIG = pathlib.Path(os.environ.get("TMPDIR", "/tmp")) / "dawa-claude-config"

COLS, ROWS = 100, 30
IDLE_CAP = 2.0  # 靜止超過這個秒數就壓縮，避免等待時畫面空轉
TURN_BUDGET = 300.0  # 單一回合的上限

# 回合結束不能用「連續 N 秒沒有輸出」判斷：TUI 的游標一直在閃，
# 輸出永遠不會完全停。改看輸出速率——忙碌時 spinner 與 token 計數
# 每秒吐幾百 bytes，閒置時只剩游標閃爍。
QUIET_WINDOW = 2.0  # 觀察窗長度（秒）
QUIET_BYTES = 220  # 窗內位元組數低於此值即視為閒置
CHUNK, CHUNK_DELAY = 6, 0.09  # 逐塊送出，模擬打字節奏

SEG = {
    "id": "02_claude",
    "title": "交給 Claude Code",
    "time": "0:22 – 0:40",
    "note": "從看資料夾到寫出 01_clean.R。工作目錄只有 raw/cohort.csv，"
    "其餘檔案都由這段 session 產生。",
}

PROMPTS = [
    ("請看一下這個資料夾，告訴我裡面有什麼。", "先讓它看，還不下指令"),
    (
        "讀 raw/cohort.csv，用中文告訴我這份資料長什麼樣："
        "幾個人、幾個欄位、有沒有缺失、追蹤時間到哪裡。先不要做任何修改。",
        "先看清楚資料，還是不要它動手",
    ),
    (
        "我要做存活分析。在你動手之前，先告訴我三件事你打算怎麼做："
        "age 的缺失怎麼處理、stage 怎麼分成 early 和 advanced、"
        "年齡要切在幾歲。請直接用文字說明，不要給我選單。",
        "三個決定：讓它先說，不要讓它自己選",
    ),
    (
        "缺失不要補值，讓模型自己排除。stage 用 I/II vs III/IV。年齡切 60。"
        "把清洗寫成 scripts/01_clean.R，要用 here::here() 不要用 setwd()，"
        "也不要 rm(list=ls())。所有決定寫成 docs/cleaning_log.md，"
        "清洗後的資料存成 output/cohort_clean.csv。",
        "你決定完了，才輪到它動手",
    ),
    ("執行 scripts/01_clean.R，把輸出貼給我看。", "執行並確認產出"),
]

ANSI = re.compile(r"\x1b\[[0-9;?]*[a-zA-Z]|\x1b\][^\x07]*\x07|\x1b[()][B0]")
# 模型跑完一個回合的證據。措辭每次不同：spinner 的 token 計數
# 「(2m 5s · ↓ 8.6k tokens)」，或完成標記「Cogitated for 45s · done」。
# 只認 "tokens"：spinner 一定會印 token 計數，而它前後的措辭與空白
# 會被 TUI 依欄寬切開（見過 "tokens ·"、"↓340 tokens)"、"for 19 · done"），
# 比對越長的片段就越容易漏。
ANSWERED = re.compile(r"tokens")
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
        self.fh.write(
            json.dumps(
                {
                    "version": 2,
                    "width": COLS,
                    "height": ROWS,
                    "timestamp": int(time.time()),
                    "env": {
                        "SHELL": os.environ.get("SHELL", "/bin/bash"),
                        "TERM": "xterm-256color",
                    },
                }
            )
            + "\n"
        )
        self.t = 0.0  # cast 內部時間
        self.last = time.time()  # 上一次寫入的牆鐘時間

    def _advance(self):
        now = time.time()
        # 壓縮長時間靜止，但 marker 也走同一條時間軸，所以不會錯位
        self.t += min(now - self.last, IDLE_CAP)
        self.last = now
        return round(self.t, 6)

    def out(self, data: str):
        self.fh.write(
            json.dumps([self._advance(), "o", data], ensure_ascii=False) + "\n"
        )
        self.fh.flush()  # 邊錄邊落地，方便中途檢視進度

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
    (WORK / ".claude" / "settings.json").write_text(
        json.dumps(
            {
                "permissions": {
                    "allow": [
                        "Read",
                        "Glob",
                        "Grep",
                        "Bash(ls:*)",
                        "Bash(head:*)",
                        "Bash(tail:*)",
                        "Bash(wc:*)",
                        "Bash(cat:*)",
                        "Bash(Rscript:*)",
                        "Bash(mkdir:*)",
                    ]
                }
            },
            indent=2,
        )
    )


def stage_config() -> None:
    """建立錄製專用的設定目錄。

    帶入登入狀態（憑證與 ~/.claude.json 的帳號欄位），但不帶入
    hooks、statusLine 與全域 CLAUDE.md——那三者會把操作者的個人環境
    錄進公開教材，而且 SessionStart 的輸出比輸入框就緒晚，
    那次重繪會把已經打進去的提示詞清掉。
    """
    if CONFIG.exists():
        shutil.rmtree(CONFIG)
    CONFIG.mkdir(parents=True)

    # 登入狀態綁在設定目錄上：換了 CLAUDE_CONFIG_DIR 就會變成未登入，
    # 而 Keychain 的讀取也跟著失效。從 Keychain 取出有效憑證寫進來，
    # 只帶登入用的那一份，MCP 的授權不需要也不該散布。
    # ~/.claude/.credentials.json 不用——那份可能是舊的，一旦存在會被優先採用。
    cred = subprocess.run(
        ["security", "find-generic-password", "-s", "Claude Code-credentials", "-w"],
        capture_output=True, text=True)
    if cred.returncode == 0:
        try:
            oauth = json.loads(cred.stdout).get("claudeAiOauth")
        except json.JSONDecodeError:
            oauth = None
        if oauth:
            path = CONFIG / ".credentials.json"
            path.write_text(json.dumps({"claudeAiOauth": oauth}) + "\n")
            path.chmod(0o600)
        else:
            print("  註：Keychain 裡沒有 claudeAiOauth，session 可能無法登入")
    else:
        print("  註：讀不到 Keychain，session 可能無法登入")

    # 只保留與呈現有關的最小設定。language 保留，否則回答可能變英文。
    lang = "zh-TW"
    user_settings = pathlib.Path.home() / ".claude" / "settings.json"
    if user_settings.exists():
        try:
            lang = json.loads(user_settings.read_text()).get("language", lang)
        except (json.JSONDecodeError, OSError):
            pass
    (CONFIG / "settings.json").write_text(
        json.dumps({"language": lang, "theme": "dark"},
                   ensure_ascii=False, indent=2) + "\n"
    )

    # ~/.claude.json 同時存放登入狀態與引導進度。全新的檔案會被當成
    # 第一次啟動（主題選擇、信任對話框），而缺少帳號欄位則會變成未登入。
    # 因此沿用既有內容，只換掉 projects。
    cfg = {}
    user_cfg = pathlib.Path.home() / ".claude.json"
    if user_cfg.exists():
        try:
            cfg = json.loads(user_cfg.read_text())
        except (json.JSONDecodeError, OSError):
            cfg = {}
    cfg["hasCompletedOnboarding"] = True
    # macOS 的 $TMPDIR 是 /var/... 的符號連結，claude 記的是解析後的
    # /private/var/...，只寫其中一個會對不上，信任對話框照樣跳出來。
    cfg["projects"] = {
        path: {"hasTrustDialogAccepted": True}
        for path in {str(WORK), str(WORK.resolve())}
    }
    (CONFIG / ".claude.json").write_text(
        json.dumps(cfg, ensure_ascii=False, indent=2) + "\n"
    )
    print(f"  設定目錄：{CONFIG}（無 hooks、無 statusLine、無全域 CLAUDE.md）")


def spawn(first_prompt: str) -> tuple[int, subprocess.Popen]:
    master, slave = os.openpty()
    fcntl.ioctl(master, termios.TIOCSWINSZ, struct.pack("HHHH", ROWS, COLS, 0, 0))
    env = dict(
        os.environ,
        TERM="xterm-256color",
        COLUMNS=str(COLS),
        LINES=str(ROWS),
        CLICOLOR="1",
        CLAUDE_CONFIG_DIR=str(CONFIG),
    )
    env.pop("TMUX", None)  # 避免被誤判為在 tmux 內
    # 從外層 session 繼承的標記會讓內層停用逐字稿儲存，
    # 而逐字稿是事後核對回答內容的唯一可靠來源。
    for k in (
        "CLAUDE_CODE_CHILD_SESSION",
        "CLAUDE_CODE_SESSION_ID",
        "CLAUDECODE",
        "CLAUDE_CODE_ENTRYPOINT",
    ):
        env.pop(k, None)
    proc = subprocess.Popen(
        ["claude"],
        cwd=str(WORK),
        env=env,
        stdin=slave,
        stdout=slave,
        stderr=slave,
        preexec_fn=os.setsid,
        close_fds=True,
    )
    os.close(slave)
    return master, proc


def pump(
    master: int,
    rec: Recorder,
    budget: float,
    quiet_bytes: int = QUIET_BYTES,
    window: float = QUIET_WINDOW,
) -> str:
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


def wait_ready(master: int, rec: Recorder, seed: str = "", budget: float = 90) -> bool:
    """等到輸入框真的可以收字為止。

    seed 是呼叫端已經讀走的輸出。就緒標記通常就在那一段裡，
    不帶進來的話這裡會空等到逾時。

    看到標記之後還要再等一次靜止：SessionStart hook 的訊息會比
    輸入框晚到，那次重繪會把已經打進去的字清掉。
    """
    seen, start = ANSI.sub("", seed), time.time()
    while not READY.search(seen):
        if time.time() - start > budget:
            return False
        seen += ANSI.sub("", pump(master, rec, budget=min(15, budget)))

    # 吸收遲到的 hook 訊息，直到畫面真的不動
    for _ in range(4):
        time.sleep(1.5)
        if not pump(master, rec, budget=8).strip():
            break
    return True


def send(master: int, text: str):
    for i in range(0, len(text), CHUNK):
        os.write(master, text[i : i + CHUNK].encode())
        time.sleep(CHUNK_DELAY)


def verify(cast: pathlib.Path, markers: list[dict]) -> list[str]:
    """確認每個 marker 之後真的有一輪回答。

    只看「六輪都跑完」不夠：提示詞若被 TUI 吃掉，那一輪會空轉幾秒就結束，
    程式仍然認為完成，然後拿一份半殘的錄影覆蓋掉上一份好的。

    判準是 spinner 的 "(Ns · ↓ N tokens)"：只有模型真的在跑才會出現。
    不用 ⏺，那是回覆的項目符號，會隨畫面重繪重複計入前幾輪的內容。
    """
    if len(markers) < len(PROMPTS):
        return [f"只完成 {len(markers)}/{len(PROMPTS)} 輪"]

    ev = [json.loads(l) for l in cast.read_text().splitlines()[1:] if l.strip()]
    if not ev:
        return ["錄影沒有內容"]
    end = ev[-1][0]

    problems = []
    for i, m in enumerate(markers):
        # 第一個提示詞隨啟動送出，marker 必然落在 0.0，
        # 該區間只涵蓋 TUI 的開機畫面，不代表那一輪的回答。
        if i == 0:
            continue
        hi = markers[i + 1]["at"] if i + 1 < len(markers) else end

        text = ANSI.sub("", "".join(
            e[2] for e in ev if e[1] == "o" and m["at"] <= e[0] <= hi))
        # 判準是這一輪有沒有真的跑模型，不是它花了多久——
        # 簡單的問題答得快是正常的，提示詞沒送出才是問題。
        if not ANSWERED.search(text):
            problems.append(
                f"第 {i + 1} 輪（{m['at']:.1f}s 起，長 {hi - m['at']:.1f}s）"
                f"沒有回答，提示詞可能沒被送進輸入框：{m['label']}")
    return problems


def trim_exit_notice(cast: pathlib.Path) -> None:
    """截掉結尾的退出訊息。

    錄製結束時送 Ctrl-C，claude 會印出「Resume this session with:
    claude --resume <uuid>」。那是這次錄製的暫存 session，對課程沒有意義，
    卻會被當成識別資訊留在公開錄影裡。
    """
    lines = cast.read_text().splitlines()
    header, events = lines[0], lines[1:]
    cut = None
    for i, ln in enumerate(events):
        if "Resume this session" in ln or "Press CtrlC again" in ln:
            cut = i
            break
    if cut is None:
        return
    cast.write_text("\n".join([header, *events[:cut]]) + "\n")
    print(f"  截掉結尾的退出訊息（{len(events) - cut} 個事件）")


def record() -> None:
    # 先錄到暫存檔，六輪都跑完才換上去。
    # 直接寫目標檔的話，中途失敗會把上一份完整錄影截斷，且無法復原。
    cast = OUT / f"{SEG['id']}.cast.part"
    final = OUT / f"{SEG['id']}.cast"
    OUT.mkdir(parents=True, exist_ok=True)
    cast.unlink(missing_ok=True)
    stage_workspace()
    stage_config()

    first_text, first_label = PROMPTS[0]
    master, proc = spawn(first_text)
    rec = Recorder(cast)
    markers = [{"label": first_label, "at": 0.0}]

    try:
        # 第一輪隨啟動送出，這裡只要等它跑完
        screen = pump(master, rec, budget=TURN_BUDGET)

        # 信任對話框：反白在「No」，往下一格選「Yes, I trust this folder」
        if ASK_TRUST.search(ANSI.sub("", screen)):
            print("  偵測到信任對話框，選擇信任此資料夾")
            os.write(master, b"\x1b[B")  # Down
            time.sleep(0.5)
            os.write(master, b"\r")
            time.sleep(1.0)
            screen += pump(master, rec, budget=TURN_BUDGET)

        if not wait_ready(master, rec, seed=screen):
            print("  ! 等不到輸入框就緒，仍繼續")
        print(f"  turn 1/{len(PROMPTS)} 完成（隨啟動送出）: {first_label}")
        time.sleep(1.5)

        for i, (text, label) in enumerate(PROMPTS[1:], 2):
            markers.append({"label": label, "at": rec.marker(label)})
            time.sleep(0.3)

            # 曾經在這裡做「比對回顯、沒收到就 Ctrl-U 重打」，結果更糟：
            # 輸入框渲染 CJK 會加空格與折行，回顯比對本來就不可靠，
            # 誤判後的重打反而把輸入框弄亂。改為錄完再用內容驗證整份錄影。
            send(master, text)
            pump(master, rec, budget=20)
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
            print(f"  turn {i}/{len(PROMPTS)} 完成（核可 {approvals} 次）: {label}")
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
        sys.exit(
            f"只完成 {len(markers)}/{len(PROMPTS)} 輪，"
            f"保留原檔不覆蓋。未完成的錄影留在 {cast.name}"
        )

    # 錄滿五輪不代表五輪都成功：提示詞若沒進輸入框，marker 一樣會被記下來。
    # 不驗就覆蓋的話，會用一份空轉的錄影蓋掉上一份完整的。
    if problems := verify(cast, markers):
        for p in problems:
            print(f"  ✗ {p}", file=sys.stderr)
        sys.exit(f"錄影未通過驗收，保留原檔不覆蓋。這次的結果留在 {cast.name}")

    trim_exit_notice(cast)
    cast.replace(final)
    (OUT / f"{SEG['id']}.json").write_text(
        json.dumps(
            {
                **{k: SEG[k] for k in ("id", "title", "time", "note")},
                "markers": markers,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n"
    )
    print(f"{SEG['id']}: {len(markers)} markers → {final.relative_to(ROOT)}")


if __name__ == "__main__":
    if shutil.which("claude") is None:
        sys.exit("找不到 claude")
    record()
