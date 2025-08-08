#!/usr/bin/env python3
"""
Clean and process Virginia land grant data from CSV to GeoJSON format.
Handles the specific format: row_id,description,latlon,tokens_used
"""

import csv
import json
import sys
import re
from pathlib import Path
from typing import Dict, Any, Optional, List, Tuple


# Default to geographic centroid of Virginia if coordinates are missing / invalid
VA_CENTROID_LON = -78.5  # approx
VA_CENTROID_LAT = 37.5

def parse_coordinates(latlon_str: str) -> Tuple[float, float]:
    """Parse coordinates from the latlon field with various formats."""
    if not latlon_str or latlon_str.strip() == '':
        # Missing coordinate string – fall back to Virginia centroid
        return VA_CENTROID_LON, VA_CENTROID_LAT
    
    # Skip obvious error messages
    if 'Unfortunately' in latlon_str or 'not sufficient' in latlon_str:
        return VA_CENTROID_LON, VA_CENTROID_LAT
    
    # Try to extract coordinates using regex patterns
    # Format 1: [37]°[41]'[00.0000]"N [77]°[00]'[00.0000]"W
    # Format 2: 37°52'00.00000"N 75°24'00.00000"W
    
    # Remove brackets and normalize
    clean_str = latlon_str.replace('[', '').replace(']', '')
    
    # Pattern to match degrees, minutes, seconds format
    coord_pattern = r'(\d+)°(\d+)\'([\d.]+)"([NS])\s+(\d+)°(\d+)\'([\d.]+)"([EW])'
    match = re.search(coord_pattern, clean_str, re.IGNORECASE)
    
    if not match:
        # Regex failed – use centroid fallback
        return VA_CENTROID_LON, VA_CENTROID_LAT
    
    try:
        # Parse latitude (first coordinate)
        lat_deg = float(match.group(1))
        lat_min = float(match.group(2))
        lat_sec = float(match.group(3))
        lat_dir = match.group(4)
        
        # Parse longitude (second coordinate)
        lon_deg = float(match.group(5))
        lon_min = float(match.group(6))
        lon_sec = float(match.group(7))
        lon_dir = match.group(8)
        
        # Convert to decimal degrees
        lat = lat_deg + lat_min/60 + lat_sec/3600
        lon = lon_deg + lon_min/60 + lon_sec/3600
        
        # Apply direction (case-insensitive)
        if lat_dir.upper() == 'S':
            lat = -lat
        if lon_dir.upper() == 'W':
            lon = -lon
        
        # Virginia bounds check
        if not (36.0 <= lat <= 40.0) or not (-84.0 <= lon <= -75.0):
            # Out-of-bounds – substitute centroid
            return VA_CENTROID_LON, VA_CENTROID_LAT
            
        return lon, lat
        
    except (ValueError, IndexError):
        return VA_CENTROID_LON, VA_CENTROID_LAT


def extract_year_from_description(description: str) -> Optional[int]:
    """Return a robustly-extracted grant year.

    This mirrors the multi-stage logic proven in the previous *Cavaliers &
    Pioneers* extraction project:

    1.  Normalise text (collapse whitespace, replace fancy dashes).
    2.  Prefer a year that appears *after* the acreage token because the
        abstracts generally list acreage before the date.
    3.  Fall back to the first year anywhere in the head slice.
    4.  Attempt OCR-error fixes such as ``i725`` → ``1725``.
    5.  Accept only years in the range 1600-1932 (covers vols. 3–8).

    Args:
        description: Raw grant abstract from the CSV.

    Returns:
        int between 1600 and 1932, or ``None`` if no valid year found.
    """
    if not description:
        return None

    # ------------------------------------------------------------------
    # 1. Pre-processing
    # ------------------------------------------------------------------
    clean = description.replace("\u2014", "-").replace("\u2013", "-")
    clean = re.sub(r"\s+", " ", clean.strip())

    # Slice the first 800 characters – enough for almost all abstracts but
    # small enough to keep regex operations quick.
    head = clean[:800]

    # ------------------------------------------------------------------
    # 2. Regex patterns
    # ------------------------------------------------------------------
    year_re = re.compile(r"(16|17|18)\d{2}")
    acre_re = re.compile(r"(\d+(?:\.\d+)?)\s*a(?:c|cs|cres|res)?\.?", re.IGNORECASE)

    # Locate acreage token (commonly precedes the date)
    m_ac = acre_re.search(head)

    # ------------------------------------------------------------------
    # 3. Multi-stage year search
    # ------------------------------------------------------------------
    year_match = None
    if m_ac:
        year_match = year_re.search(head[m_ac.end():])
    if year_match is None:
        year_match = year_re.search(head)
    if year_match is None and m_ac:
        # As a last resort, scan beyond the head slice but still after acreage
        year_match = year_re.search(clean[m_ac.end():])

    # ------------------------------------------------------------------
    # 4. OCR-error recovery (e.g. "i725", "(727")
    # ------------------------------------------------------------------
    if year_match is None:
        ocr_match = re.search(r"[iI\(](6|7|8)\d{2}", head)
        if ocr_match:
            yr_str = "1" + ocr_match.group(1) + ocr_match.group(0)[2:]
            try:
                yr_int = int(yr_str)
                if 1600 <= yr_int <= 1932:
                    return yr_int
            except ValueError:
                pass
        return None

    # ------------------------------------------------------------------
    # 5. Validate and return normal match
    # ------------------------------------------------------------------
    yr_int = int(year_match.group(0))
    if 1600 <= yr_int <= 1932:
        return yr_int

    return None


def clean_description(description: str) -> str:
    """Clean and normalize the description field."""
    if not description:
        return ""
    
    # Remove extra whitespace and normalize
    cleaned = re.sub(r'\s+', ' ', description.strip())
    
    # Remove common OCR errors or formatting issues
    cleaned = cleaned.replace('""', '"')
    
    return cleaned


def process_csv_to_geojson(input_file: Path, output_file: Path) -> None:
    """Convert CSV land grant data to GeoJSON format."""
    
    if not input_file.exists():
        print(f"Error: Input file {input_file} not found")
        sys.exit(1)
    
    features: List[Dict[str, Any]] = []
    total_rows = 0
    valid_rows = 0
    skipped_no_coords = 0
    skipped_no_year = 0
    
    print(f"Processing {input_file}...")
    
    with open(input_file, 'r', encoding='utf-8', errors='replace') as csvfile:
        reader = csv.DictReader(csvfile)
        
        # Print header info
        if reader.fieldnames:
            print(f"Found columns: {list(reader.fieldnames)}")
        
        for row_num, row in enumerate(reader, 1):
            total_rows += 1
            
            if total_rows % 1000 == 0:
                print(f"Processed {total_rows} rows, valid: {valid_rows}")
            
            # Parse coordinates from latlon field
            latlon_str = row.get('latlon', '')
            lon, lat = parse_coordinates(latlon_str)
            
            # Coordinates are always available (centroid fallback ensures this)
            
                        # Year is already provided in mapped_grants.csv
            year_str = row.get('year', '')
            try:
                year = int(float(year_str)) if year_str else None
            except ValueError:
                year = None
            
            if not year:
                skipped_no_year += 1
                year = 1700
            
            # For tooltips we still want a short description snippet if present
            description = row.get('raw_entry', '')[:300]
            
            # Build properties dict
            properties = {
                'year': year,
                'row_id': row.get('row_id', ''),
                'description': clean_description(description)[:500],  # Truncate long descriptions
                'tokens_used': int(row.get('tokens_used', 0)) if row.get('tokens_used', '').isdigit() else 0
            }
            
            # Create GeoJSON feature
            feature = {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [lon, lat]
                },
                "properties": properties
            }
            
            features.append(feature)
            valid_rows += 1
    
    # Create GeoJSON structure
    geojson = {
        "type": "FeatureCollection",
        "features": features
    }
    
    # Write output
    print(f"\nWriting {len(features)} features to {output_file}...")
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(geojson, f, separators=(',', ':'))  # Compact format
    
    print(f"\nProcessing complete!")
    print(f"Total rows processed: {total_rows}")
    print(f"Valid features: {valid_rows}")
    print(f"Skipped (no coordinates): {skipped_no_coords}")
    print(f"Records without year: {skipped_no_year}")
    print(f"Output file: {output_file} ({output_file.stat().st_size / 1024 / 1024:.1f} MB)")


def main():
    """Main entry point."""
    
    # Set up paths
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    
    input_file = project_root / "data" / "mapped_grants.csv"
    output_file = project_root / "data" / "cleaned.geojson"
    
    # Ensure output directory exists
    output_file.parent.mkdir(exist_ok=True)
    
    # Process the data
    process_csv_to_geojson(input_file, output_file)


if __name__ == "__main__":
    main()
