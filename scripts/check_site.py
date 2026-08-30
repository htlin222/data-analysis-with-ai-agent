#!/usr/bin/env python3
"""檢查 site/ 的資產引用是否完整。

部署前跑一次。缺圖或缺 .cast 在本機看不出來（瀏覽器只是靜靜地不顯示），
到了 Pages 上才發現就太晚了。

用法：
    python3 scripts/check_site.py
"""
from __future__ import annotations

import json
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
PAGES = ["index.html", "slides/index.html", "cast/index.html"]
REF = re.compile(r'(?:src|href)="([^"]+)"')


def tracked() -> set[pathlib.Path] | None:
    """版控內的檔案。本機的工作目錄可能有沒 commit 的檔案，
    CI 上只看得到版控內容——不比對的話，本機通過而 CI 失敗。"""
    try:
        out = subprocess.run(["git", "ls-files", "-z", "--", "site"],
                             cwd=ROOT, capture_output=True, text=True, check=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        return None
    return {(ROOT / p).resolve() for p in out.stdout.split("\0") if p}


def main() -> int:
    problems: list[str] = []
    known = tracked()

    def exists(p: pathlib.Path) -> bool:
        if not p.exists():
            return False
        if known is not None and p.resolve() not in known:
            problems.append(f"{p.relative_to(ROOT)} 存在但未進版控，CI 上會缺檔")
            return False
        return True

    # 1. HTML 引用的本地資產
    for rel in PAGES:
        page = SITE / rel
        if not page.exists():
            problems.append(f"缺少頁面 {rel}")
            continue
        base = page.parent
        for ref in REF.findall(page.read_text()):
            if ref.startswith(("http://", "https://", "//", "#", "mailto:")):
                continue
            target = (base / ref.split("?", 1)[0]).resolve()
            if target.is_dir() or ref.endswith("/"):
                continue          # 指向另一個頁面目錄
            if not exists(target):
                problems.append(f"{rel} 引用了不存在的 {ref}")

    # 2. 每個 .json 都要有同名 .cast，且 marker 落在長度範圍內
    casts = SITE / "casts"
    for meta in sorted(casts.glob("*.json")):
        cast = meta.with_suffix(".cast")
        if not exists(cast):
            problems.append(f"缺少 {cast.name}")
            continue
        lines = cast.read_text().splitlines()
        if len(lines) < 2:
            problems.append(f"{cast.name} 沒有內容")
            continue
        duration = json.loads(lines[-1])[0]
        for m in json.loads(meta.read_text())["markers"]:
            if not 0 <= m["at"] <= duration:
                problems.append(
                    f"{meta.name} 的 marker {m['at']}s 超出錄影長度 {duration:.1f}s")

    # 3. casts.js 列出的段落都要有檔案
    listed = re.findall(r'id:\s*"([^"]+)"', (SITE / "assets" / "casts.js").read_text())
    for cid in listed:
        if not (casts / f"{cid}.cast").exists():
            problems.append(f"casts.js 列出 {cid}，但沒有 {cid}.cast")

    if problems:
        for p in problems:
            print(f"  ✗ {p}", file=sys.stderr)
        print(f"\n{len(problems)} 個問題", file=sys.stderr)
        return 1

    n_cast = len(list(casts.glob("*.cast")))
    print(f"site/ 檢查通過：{len(PAGES)} 個頁面、{n_cast} 段錄影")
    return 0


if __name__ == "__main__":
    sys.exit(main())
