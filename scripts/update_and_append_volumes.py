#!/usr/bin/env python3
"""
Update existing mapped grants to Volume III IDs and append true Volume II rows,
then overwrite data/mapped_grants.csv.

Steps:
- Read data/mapped_grants.csv and change grant_id prefix from 'II_' -> 'III_'
  for all existing rows.
- Read volume2toadd/cp_grants_volume2_mapped.csv and append rows as-is
  (these are the correct Volume II entries with 'II_' IDs).
- Write back to data/mapped_grants.csv.
"""

from __future__ import annotations

import csv
from pathlib import Path


def read_rows(path: Path) -> list[dict[str, str]]:
    with path.open('r', encoding='utf-8', errors='replace', newline='') as f:
        reader = csv.DictReader(f)
        return list(reader)


def write_rows(path: Path, rows: list[dict[str, str]], fieldnames: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    mapped_csv = root / 'data' / 'mapped_grants.csv'
    vol2_csv = root / 'volume2toadd' / 'cp_grants_volume2_mapped.csv'

    if not mapped_csv.exists():
        print(f"ERROR: {mapped_csv} not found")
        return 1
    if not vol2_csv.exists():
        print(f"ERROR: {vol2_csv} not found")
        return 1

    rows_existing = read_rows(mapped_csv)
    rows_vol2 = read_rows(vol2_csv)

    if not rows_existing:
        print("ERROR: existing mapped_grants.csv is empty")
        return 1

    # Determine output columns as union, preserving base order
    base_fields = list(rows_existing[0].keys())
    extra_fields = [c for c in rows_vol2[0].keys() if c not in base_fields]
    fieldnames = base_fields + extra_fields

    # Update grant_id prefixes for existing rows (II_ -> III_)
    for r in rows_existing:
        gid = r.get('grant_id', '')
        if gid.startswith('II_'):
            r['grant_id'] = 'III_' + gid[len('II_'):]

    # Normalize vol2 rows to have all fieldnames
    for r in rows_vol2:
        for col in fieldnames:
            if col not in r:
                r[col] = ''

    combined = rows_existing + rows_vol2
    write_rows(mapped_csv, combined, fieldnames)
    print(f"Updated and appended rows written to {mapped_csv}")
    print(f"Total rows: {len(combined)} (existing: {len(rows_existing)}, vol2: {len(rows_vol2)})")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())


