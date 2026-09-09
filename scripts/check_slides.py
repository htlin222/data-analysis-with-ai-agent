#!/usr/bin/env python3
"""檢查 site/assets/slides.js 的內容完整性。

瀏覽器對壞掉的投影片很寬容：標籤沒閉合就自己補、圖檔不存在就留一塊空白、
data-step 跳號就少揭露一段。這些在螢幕上都看不出來，上台才會發現。

用法：
    python3 scripts/check_slides.py
"""
from __future__ import annotations

import html.parser
import json
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SLIDES_JS = ROOT / "site" / "assets" / "slides.js"
VOID = {"br", "img", "hr", "input", "meta", "link"}

# 投影片上「宣稱是結果」的數字，必須在實際執行輸出裡找得到。
# 查三種標記：大數字（.big 裡的 i）、終端機高亮（span.k）、表格強調（td.hl）。
# 其餘位置的數字多半是版面尺寸或課程時間軸，不是結果。
NUMBER = re.compile(r"\d+(?:\.\d+)?")
# 只有整段文字都是數字與標點時才視為「結果」。
# 這樣 span.k 裡的指令（Rscript scripts/01_clean.R）不會被誤抽成 01、03。
PURE_NUMERIC = re.compile(r"^[\d\s.,%()\u2013\u2014/<>=+-]+$")
SOURCES = ["reference-run"]  # console/ 與 results/，兩者都在版控內，CI 上也讀得到


class Checker(html.parser.HTMLParser):
    """追蹤標籤堆疊，回報沒有閉合或多餘的結束標籤。"""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack: list[str] = []
        self.errors: list[str] = []
        self.imgs: list[str] = []
        self.steps: list[int] = []
        self.claims: list[str] = []   # 宣稱為結果的數字
        # 與 self.stack 平行：每一層是否位於 claim 標記內。
        # 不能只用一個計數器——</span> 不分是哪一個 span，會把計數減錯。
        self._claim: list[bool] = []

    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        if "data-step" in d:
            try:
                self.steps.append(int(d["data-step"]))
            except ValueError:
                self.errors.append(f"data-step 不是數字：{d['data-step']}")
        if tag == "img":
            self.imgs.append(d.get("src", ""))
        cls = d.get("class", "").split()
        is_claim = (
            (tag == "span" and "k" in cls)
            or tag == "i"
            or (tag == "td" and "hl" in cls)
        )
        if tag not in VOID:
            self.stack.append(tag)
            self._claim.append(is_claim or any(self._claim))

    def handle_data(self, data):
        if self._claim and self._claim[-1] and PURE_NUMERIC.match(data.strip() or "x"):
            self.claims.extend(NUMBER.findall(data))

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        if not self.stack:
            self.errors.append(f"多出一個 </{tag}>")
        elif self.stack[-1] != tag:
            self.errors.append(f"</{tag}> 對不上 <{self.stack[-1]}>")
        else:
            self.stack.pop()
            self._claim.pop()


def load_slides() -> list[dict]:
    """用 node 執行 slides.js，把 SLIDES 倒出來。"""
    out = subprocess.run(
        ["node", "-e",
         f"global.window={{}};require({json.dumps(str(SLIDES_JS))});"
         "process.stdout.write(JSON.stringify(window.SLIDES))"],
        capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


def load_sources() -> str:
    """實際執行輸出的全文，供比對投影片上的數字。"""
    parts = []
    for d in SOURCES:
        base = ROOT / d
        if not base.exists():
            continue
        for f in sorted(base.rglob("*")):
            if f.is_file() and f.suffix in (".txt", ".csv"):
                parts.append(f.read_text(errors="replace"))
    return "\n".join(parts)


def has_number(n: str, src: str) -> bool:
    """0.30 與 0.3 視為同一個數字；1.036 不可與 1.0 混淆，故用值比對。"""
    if n in src:
        return True
    try:
        want = float(n)
    except ValueError:
        return False
    return any(abs(float(m) - want) < 1e-9 for m in NUMBER.findall(src))


def main() -> int:
    problems: list[str] = []
    slides = load_slides()
    checked = 0
    src = load_sources()
    if not src:
        print("  ! 找不到 reference-run/console 或 output，跳過數字比對")

    for i, s in enumerate(slides, 1):
        where = f"第 {i:02d} 張（{s['act']} · {s['title']}）"

        c = Checker()
        c.feed(s["html"])
        for e in c.errors:
            problems.append(f"{where}：{e}")
        if c.stack:
            problems.append(f"{where}：標籤沒有閉合 {c.stack}")

        # 圖檔必須真的存在。路徑相對於 site/slides/
        for img in c.imgs:
            if not (ROOT / "site" / "slides" / img).resolve().exists():
                problems.append(f"{where}：圖檔不存在 {img}")

        # data-step 必須從 1 開始且不跳號，否則會有一段永遠揭露不到
        if c.steps:
            uniq = sorted(set(c.steps))
            if uniq[0] != 1:
                problems.append(f"{where}：data-step 從 {uniq[0]} 開始，應為 1")
            gaps = [n for n in range(1, uniq[-1] + 1) if n not in uniq]
            if gaps:
                problems.append(f"{where}：data-step 跳號，缺 {gaps}")

        # 備忘稿：這一版的投影片刻意寫得少，備忘稿就是講稿本身
        if not s.get("notes", "").strip():
            problems.append(f"{where}：沒有備忘稿")

        # 投影片上的結果數字必須查得到出處
        if src:
            for n in c.claims:
                checked += 1
                if not has_number(n, src):
                    problems.append(f"{where}：數字 {n} 在實際執行輸出裡找不到")

        nc = Checker()
        nc.feed(s.get("notes", ""))
        if nc.stack:
            problems.append(f"{where}：備忘稿標籤沒有閉合 {nc.stack}")
        for e in nc.errors:
            problems.append(f"{where}：備忘稿 {e}")

    for p in problems:
        print(f"  ✗ {p}")
    if problems:
        print(f"\n{len(problems)} 個問題")
        return 1
    print(f"slides.js 通過：{len(slides)} 張，全部有備忘稿，"
          f"{checked} 個結果數字皆可回溯到實際執行輸出")
    return 0


if __name__ == "__main__":
    sys.exit(main())
