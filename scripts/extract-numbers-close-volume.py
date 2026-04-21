#!/usr/bin/env python3
"""Apple Numbers(.numbers)에서 첫 번째 Date/Price/Volume 테이블을 읽어 JSON 배열로 stdout에 출력."""
import json
import sys

try:
    from numbers_parser import Document
except ImportError:
    print("pip install numbers-parser", file=sys.stderr)
    sys.exit(1)


def main():
    if len(sys.argv) < 2:
        print("Usage: extract-numbers-close-volume.py /path/to/file.numbers", file=sys.stderr)
        sys.exit(1)
    path = sys.argv[1]
    doc = Document(path)
    out = []
    for sheet in doc.sheets:
        for table in sheet.tables:
            if table.num_cols < 3:
                continue
            h0 = str(table.cell(0, 0).value or "").strip().lower()
            if "date" not in h0:
                continue
            for r in range(1, table.num_rows):
                d = table.cell(r, 0).value
                price = table.cell(r, 1).value
                vol = table.cell(r, 2).value
                if d is None:
                    continue
                if hasattr(d, "strftime"):
                    ds = d.strftime("%Y-%m-%d")
                else:
                    ds = str(d).strip()[:10]
                try:
                    c = float(price) if price is not None else None
                except (TypeError, ValueError):
                    c = None
                try:
                    v = float(vol) if vol is not None else None
                except (TypeError, ValueError):
                    v = None
                if c is None or c <= 0:
                    continue
                out.append({"date": ds, "close": c, "volume": v})
            break
        if out:
            break
    json.dump(out, sys.stdout)


if __name__ == "__main__":
    main()
