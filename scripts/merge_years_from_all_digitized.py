#!/usr/bin/env python3
"""
Merge correct year values from the 'all_digitized' CSV into data/mapped_grants.csv by grant_id.

Inputs:
- data/mapped_grants.csv (target to update)
- updated-grants-to-add/all_digitized_grants_20250809_202343.csv (source of truth for year)

Behavior:
- Join on grant_id
- If source year present and valid, overwrite mapped_grants year
- Leave other fields unchanged
"""

from __future__ import annotations

import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAPPED = ROOT / 'data' / 'mapped_grants.csv'
ALL_DIGITIZED = ROOT / 'updated-grants-to-add' / 'all_digitized_grants_20250809_202343.csv'


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open('r', encoding='utf-8', errors='replace', newline='') as f:
        return list(csv.DictReader(f))


def write_csv(path: Path, rows: list[dict[str, str]], fieldnames: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('w', encoding='utf-8', newline='') as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in rows:
            w.writerow(r)


def main() -> int:
    if not MAPPED.exists():
        print(f"ERROR: {MAPPED} not found")
        return 1
    if not ALL_DIGITIZED.exists():
        print(f"ERROR: {ALL_DIGITIZED} not found")
        return 1

    mapped_rows = read_csv(MAPPED)
    src_rows = read_csv(ALL_DIGITIZED)

    # Build year lookup by grant_id
    id_to_year: dict[str, str] = {}
    for r in src_rows:
        gid = (r.get('grant_id') or '').strip()
        year = (r.get('year') or '').strip()
        if gid and year:
            id_to_year[gid] = year

    updated = 0
    for r in mapped_rows:
        gid = (r.get('grant_id') or '').strip()
        if not gid:
            continue
        src_year = id_to_year.get(gid)
        if src_year:
            r['year'] = src_year
            updated += 1

    write_csv(MAPPED, mapped_rows, list(mapped_rows[0].keys()) if mapped_rows else [])
    print(f"Updated year for {updated} rows in {MAPPED}")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
