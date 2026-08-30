#!/usr/bin/env python3
"""把目前 output/ 與 figs/ 的內容做成快照，供讀者比對自己的執行結果。

output/ 與 figs/ 不進版控（見 .gitignore），因此 clone 之後是空的。
沒有快照的話，讀者無從判斷自己跑出來的數字對不對。

用法：
    python3 scripts/make_reference_run.py

產出：
    reference-run/MANIFEST.tsv   全部產出的大小、形狀、sha256
    reference-run/results/       小型結果表的副本
"""
from __future__ import annotations

import csv
import hashlib
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "reference-run"
WATCH = ["output", "figs"]

# 缺少這些表示執行未完成。半套的快照比沒有快照更糟：它看起來像是權威的。
REQUIRED = ["output/cohort_clean.csv", "output/table1.html", "figs/km_by_stage.png"]

# 小到可以進版控，而且是最需要比對的數字
COPY = ["cox.csv", "subgroup.csv", "table1.csv"]


def sha256(p: pathlib.Path) -> str:
    h = hashlib.sha256()
    with p.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def shape(p: pathlib.Path) -> str:
    """CSV 回傳 列x欄，其他型別留白。"""
    if p.suffix != ".csv":
        return ""
    with p.open(newline="") as fh:
        rows = list(csv.reader(fh))
    return f"{len(rows) - 1}x{len(rows[0])}" if rows else ""


def main() -> int:
    missing = [f for f in REQUIRED if not (ROOT / f).exists()]
    if missing:
        print(f"執行不完整，缺少：{', '.join(missing)}", file=sys.stderr)
        return 1

    files = sorted(
        p for d in WATCH
        for p in (ROOT / d).rglob("*")
        if p.is_file() and p.name != ".DS_Store"
    )

    (OUT / "results").mkdir(parents=True, exist_ok=True)
    with (OUT / "MANIFEST.tsv").open("w", newline="") as fh:
        # csv 預設 CRLF，會讓每個 checksum 尾端多一個 \r
        w = csv.writer(fh, delimiter="\t", lineterminator="\n")
        w.writerow(["path", "bytes", "shape", "sha256"])
        for p in files:
            w.writerow([p.relative_to(ROOT).as_posix(), p.stat().st_size,
                        shape(p), sha256(p)])

    for name in COPY:
        src = ROOT / "output" / name
        if src.exists():
            (OUT / "results" / name).write_bytes(src.read_bytes())
        else:
            print(f"  註：output/{name} 不存在，略過")

    total = sum(p.stat().st_size for p in files)
    print(f"快照 {len(files)} 個檔案（{total // 1024} KB）→ reference-run/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
