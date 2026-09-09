#!/usr/bin/env python3
"""檢查 site/casts/ 的錄影可以公開。

錄影是把整個終端機畫面錄下來，操作者本人的環境會一起進去：
全域 hooks 的輸出、statusLine 的模型與額度、~/.claude/CLAUDE.md 的內容。
這些在本機看起來理所當然，放到公開教材上就是洩漏。

另外檢查 marker 的間隔。TUI 段若提示詞被畫面重繪吃掉，該輪會空轉，
marker 之間只差幾秒——而錄影本身看起來是完整的，不會有任何錯誤。

用法：
    python3 scripts/check_casts.py
"""
from __future__ import annotations

import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
CASTS = ROOT / "site" / "casts"

# 不該出現在公開錄影裡的字串。全部來自操作者的個人設定，與課程無關。
LEAKS = [
    ("SessionStart", "全域 hook 的輸出"),
    ("SubagentStop", "全域 hook 的輸出"),
    ("PreToolUse", "全域 hook 的輸出"),
    ("開發環境檢查", "全域 hook 的輸出"),
    ("Task subagents", "全域 CLAUDE.md 的內容"),
    ("SuperClaude", "全域 CLAUDE.md 的內容"),
    ("usage credits exhausted", "帳號額度狀態"),
    ("Fast mode disabled", "帳號額度狀態"),
    ("claude --resume", "session id"),
]

# TUI 段：每一輪都要確認模型真的跑過，而不是提示詞被畫面重繪吃掉。
TUI_SEGMENTS = {"02_claude"}
# 模型跑完一個回合的證據。措辭每次不同：spinner 的 token 計數，
# 或是完成標記「Cogitated for 45s · done」。
ANSWERED = re.compile(r"tokens")


def main() -> int:
    problems: list[str] = []

    casts = sorted(CASTS.glob("*.cast"))
    if not casts:
        print("  ✗ site/casts/ 沒有任何 .cast")
        return 1

    for cast in casts:
        body = cast.read_text(errors="replace")
        for needle, why in LEAKS:
            if needle in body:
                problems.append(f"{cast.name}：含「{needle}」（{why}）")

        meta = cast.with_suffix(".json")
        if not meta.exists():
            problems.append(f"{cast.name}：缺少同名 .json")
            continue

        markers = json.loads(meta.read_text()).get("markers", [])
        if not markers:
            problems.append(f"{meta.name}：沒有任何 marker")
        if cast.stem in TUI_SEGMENTS and markers:
            events = [json.loads(l) for l in body.splitlines()[1:] if l.strip()]
            end = events[-1][0] if events else 0
            for i, m in enumerate(markers):
                at = m.get("at")
                if at is None:
                    problems.append(f"{meta.name}：第 {i+1} 個 marker 沒有位置")
                    continue
                # 第一個提示詞隨啟動送出，marker 固定落在 0.0，
                # 該區間只有 TUI 的開機畫面
                if i == 0:
                    continue
                hi = markers[i + 1].get("at", end) if i + 1 < len(markers) else end
                # 模型跑完一個回合會留下 spinner 的 token 計數或完成標記。
                # 提示詞若沒進輸入框，該輪就完全不會出現這些。
                span = "".join(e[2] for e in events
                               if e[1] == "o" and at <= e[0] <= hi)
                if not ANSWERED.search(span):
                    problems.append(
                        f"{meta.name}：第 {i+1} 輪（{at:.1f}s 起，長 {hi-at:.1f}s）"
                        f"沒有回答，提示詞可能沒被送出")

    for p in problems:
        print(f"  ✗ {p}")
    if problems:
        print(f"\n{len(problems)} 個問題")
        return 1
    print(f"casts 通過：{len(casts)} 段，無個人環境洩漏，marker 間隔正常")
    return 0


if __name__ == "__main__":
    sys.exit(main())
