#!/usr/bin/env python3
"""
Merge geocoded lat/lon results onto grants CSV by row order.

Inputs:
  - Grants CSV (e.g., volume2toadd/cp_grants_volume2.csv)
  - Geocode results CSV (e.g., volume2toadd/results_books6-8_v2.csv)

Output:
  - Grants CSV with appended columns: latlon, tokens_used

Assumes both inputs correspond row-for-row in the same order.
"""

from __future__ import annotations

import csv
import sys
from pathlib import Path


def read_csv_rows(path: Path) -> list[dict[str, str]]:
    with path.open('r', encoding='utf-8', errors='replace', newline='') as f:
        reader = csv.DictReader(f)
        return list(reader)


def write_csv_rows(path: Path, rows: list[dict[str, str]], fieldnames: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def main() -> int:
    if len(sys.argv) != 4:
        print("Usage: merge_latlon.py <grants_csv> <results_csv> <out_csv>")
        return 2

    grants_csv = Path(sys.argv[1]).resolve()
    results_csv = Path(sys.argv[2]).resolve()
    out_csv = Path(sys.argv[3]).resolve()

    if not grants_csv.exists():
        print(f"ERROR: Grants CSV not found: {grants_csv}")
        return 1
    if not results_csv.exists():
        print(f"ERROR: Results CSV not found: {results_csv}")
        return 1

    grants_rows = read_csv_rows(grants_csv)
    results_rows = read_csv_rows(results_csv)

    n_grants = len(grants_rows)
    n_results = len(results_rows)

    if n_grants != n_results:
        print(f"ERROR: Row count mismatch: grants={n_grants} results={n_results}. Aborting to avoid misalignment.")
        return 1

    # Prepare output field order: insert latlon,tokens_used before raw_entry if present
    base_fields = list(grants_rows[0].keys()) if grants_rows else []
    if 'latlon' not in base_fields:
        # Insert before raw_entry when possible
        try:
            idx = base_fields.index('raw_entry')
            base_fields = base_fields[:idx] + ['latlon', 'tokens_used'] + base_fields[idx:]
        except ValueError:
            base_fields = base_fields + ['latlon', 'tokens_used']

    # Merge by index
    for i in range(n_grants):
        latlon = results_rows[i].get('latlon', '').strip()
        tokens_used = results_rows[i].get('tokens_used', '').strip()
        grants_rows[i]['latlon'] = latlon
        grants_rows[i]['tokens_used'] = tokens_used

    write_csv_rows(out_csv, grants_rows, base_fields)
    print(f"Wrote merged CSV: {out_csv}")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())


