#!/usr/bin/env python3
"""在 tmux 中以 asciinema 錄製一段真實終端機操作，並在每個輸入點插入 marker。

marker 的用途：asciinema-player 設定 pauseOnMarkers 後，播放會在每個
指令輸入前停下，等待按鍵繼續。

用法：
    python3 scripts/record_cast.py [segment-id ...]

段落定義在 scripts/segments.py。輸出：
    site/casts/<id>.cast   含 marker 的錄影
    site/casts/<id>.json   段落標題與 marker 清單
"""
from __future__ import annotations

import json
import os
import pathlib
import subprocess
import sys
import time

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "site" / "casts"
SESSION = "dawa_rec_%d" % os.getpid()
COLS, ROWS = 100, 26

# 逐字輸入的速度。長指令打快一點，否則整段會拖太久。
FAST_OVER = 46
SLOW, FAST = 0.045, 0.022


def tmux(*args, check=True):
    return subprocess.run(["tmux", *args], check=check,
                          capture_output=True, text=True)


def alive() -> bool:
    return subprocess.run(["tmux", "has-session", "-t", SESSION],
                          capture_output=True).returncode == 0


def kill():
    if alive():
        tmux("kill-session", "-t", SESSION, check=False)


def send_literal(text: str):
    """逐字送出，模擬真人輸入。"""
    delay = FAST if len(text) > FAST_OVER else SLOW
    for ch in text:
        # tmux 的參數解析會把單獨的 ; 當成指令分隔符，需跳脫
        tmux("send-keys", "-t", SESSION, "-l", "\\;" if ch == ";" else ch)
        time.sleep(delay)


def record(seg) -> None:
    cast = OUT / f"{seg['id']}.cast"
    rc = ROOT / ".rec_bashrc"
    rc.write_text(
        "PS1='$ '\n"
        "PS2='> '\n"
        "unset PROMPT_COMMAND\n"
        f"cd {ROOT}\n"
        "clear\n"
    )

    kill()
    OUT.mkdir(parents=True, exist_ok=True)
    cast.unlink(missing_ok=True)

    # -i 2：把超過 2 秒的靜止壓成 2 秒，避免等待 R 啟動時畫面空轉。
    inner = (f"asciinema rec -q --overwrite -i 2 "
             f"-c 'bash --noprofile --rcfile {rc}' {cast}")
    tmux("new-session", "-d", "-s", SESSION,
         "-x", str(COLS), "-y", str(ROWS), inner)
    time.sleep(1.6)                      # 等 asciinema 與 bash 就緒
    markers = []
    for step in seg["steps"]:
        kind = step[0]

        if kind == "pause":
            time.sleep(step[1])
            continue

        if kind == "cmd":
            markers.append({
                "cmd": step[1],
                "label": step[2] if len(step) > 2 else step[1],
            })
            time.sleep(0.35)             # 打字之前留一拍
            send_literal(step[1])
            time.sleep(0.35)
            tmux("send-keys", "-t", SESSION, "Enter")
            time.sleep(step[3] if len(step) > 3 else 1.4)

    time.sleep(0.8)
    tmux("send-keys", "-t", SESSION, "-l", "exit")
    tmux("send-keys", "-t", SESSION, "Enter")

    for _ in range(60):
        if not alive():
            break
        time.sleep(0.25)
    kill()
    rc.unlink(missing_ok=True)

    if not cast.exists():
        sys.exit(f"錄製失敗，沒有產生 {cast}")

    inject_markers(cast, markers)
    (OUT / f"{seg['id']}.json").write_text(
        json.dumps({
            "id": seg["id"], "title": seg["title"], "time": seg["time"],
            "note": seg.get("note", ""),
            "markers": [m for m in markers if m.get("at") is not None],
        }, ensure_ascii=False, indent=2) + "\n"
    )
    print(f"{seg['id']}: {len(markers)} markers → {cast.relative_to(ROOT)}")


def inject_markers(cast: pathlib.Path, markers: list[dict]) -> None:
    """依指令在錄影中的回顯位置放置 marker。

    不能用牆鐘時間：asciinema 的 --idle-time-limit 在錄製當下就壓縮了
    時間軸，驅動端的偏移與 cast 內部時間不成線性對應。
    改為在輸出串流中依序搜尋每個指令的第一個字元，marker 放在該事件之前。
    """
    lines = cast.read_text().splitlines()
    header = lines[0]
    events = [json.loads(ln) for ln in lines[1:] if ln.strip()]

    # 把 'o' 事件串成一條字串，同時記錄每個字元屬於哪個事件
    text, owner = [], []
    for i, e in enumerate(events):
        if e[1] != "o":
            continue
        text.append(e[2])
        owner.extend([i] * len(e[2]))
    text = "".join(text)

    extra, pos = [], 0
    for m in markers:
        # 只比對前綴：長指令的回顯會被終端機折行，逐字比對會失敗
        probe = m["cmd"][:24]
        # 以提示符為錨點，避免 cd／pwd 這類短字串誤中先前的輸出
        hit = text.find("$ " + probe, pos)
        off = 2
        if hit < 0:
            hit, off = text.find(probe, pos), 0
        if hit < 0:
            print(f"  ! 找不到回顯：{m['cmd'][:40]}")
            m["at"] = None
            continue
        pos = hit + off + len(probe)
        idx = owner[hit + off]            # 指令第一個字元所屬的事件
        # 暫停點落在打字開始前，但不早於前一個事件超過 0.5 秒
        t = max(events[idx - 1][0] if idx > 0 else 0.0, events[idx][0] - 0.5)
        extra.append([round(t, 3), "m", m["label"]])
        m["at"] = round(t, 3)

    merged = sorted(events + extra, key=lambda e: e[0])
    with cast.open("w") as fh:
        fh.write(header + "\n")
        for e in merged:
            fh.write(json.dumps(e, ensure_ascii=False) + "\n")


def main() -> int:
    sys.path.insert(0, str(ROOT / "scripts"))
    from segments import SEGMENTS

    want = sys.argv[1:] or [s["id"] for s in SEGMENTS]
    todo = [s for s in SEGMENTS if s["id"] in want]
    if not todo:
        sys.exit(f"未知段落。可用：{', '.join(s['id'] for s in SEGMENTS)}")

    for seg in todo:
        record(seg)
    return 0


if __name__ == "__main__":
    sys.exit(main())
