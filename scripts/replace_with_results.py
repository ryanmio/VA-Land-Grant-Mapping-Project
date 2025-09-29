#!/usr/bin/env python3
"""
Replace the current mapped dataset with a new results CSV.

Input CSV columns (expected): row_id, description, latlon, tokens_used

Output written to data/mapped_grants.csv with columns:
  grant_id, name_std, acreage, year, county_text, latlon, tokens_used, raw_entry

Year is extracted from description using the same logic as in scripts/clean.py.
Other non-essential fields are left blank.
"""

from __future__ import annotations

import csv
import sys
from pathlib import Path


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: replace_with_results.py <results_csv>")
        return 2

    results_csv = Path(sys.argv[1]).resolve()
    root = Path(__file__).resolve().parents[1]
    out_csv = root / 'data' / 'mapped_grants.csv'

    if not results_csv.exists():
        print(f"ERROR: Input not found: {results_csv}")
        return 1

    # Lazy import to reuse year extraction without duplicating logic
    sys.path.insert(0, str((root / 'scripts').resolve()))
    try:
        import clean  # type: ignore
    except Exception as e:
        print(f"ERROR: Could not import clean.py for year extraction: {e}")
        return 1

    # Read input and transform rows
    transformed: list[dict[str, str]] = []
    with results_csv.open('r', encoding='utf-8', errors='replace', newline='') as f:
        reader = csv.DictReader(f)
        for row in reader:
            row_id = (row.get('row_id') or '').strip()
            description = (row.get('description') or '').strip()
            latlon = (row.get('latlon') or '').strip()
            tokens_used = (row.get('tokens_used') or '').strip()

            # Derive year using shared logic
            year_val = clean.extract_year_from_description(description)
            year_str = str(year_val) if year_val is not None else ''

            transformed.append({
                'grant_id': row_id,
                'name_std': '',
                'acreage': '',
                'year': year_str,
                'county_text': '',
                'latlon': latlon,
                'tokens_used': tokens_used,
                'raw_entry': description,
            })

    # Write output in canonical column order
    fieldnames = ['grant_id', 'name_std', 'acreage', 'year', 'county_text', 'latlon', 'tokens_used', 'raw_entry']
    out_csv.parent.mkdir(parents=True, exist_ok=True)
    with out_csv.open('w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(transformed)

    print(f"Wrote {len(transformed):,} rows to {out_csv}")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())


