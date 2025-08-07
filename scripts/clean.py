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


def parse_coordinates(latlon_str: str) -> Tuple[Optional[float], Optional[float]]:
    """Parse coordinates from the latlon field with various formats."""
    if not latlon_str or latlon_str.strip() == '':
        return None, None
    
    # Skip obvious error messages
    if 'Unfortunately' in latlon_str or 'not sufficient' in latlon_str:
        return None, None
    
    # Try to extract coordinates using regex patterns
    # Format 1: [37]°[41]'[00.0000]"N [77]°[00]'[00.0000]"W
    # Format 2: 37°52'00.00000"N 75°24'00.00000"W
    
    # Remove brackets and normalize
    clean_str = latlon_str.replace('[', '').replace(']', '')
    
    # Pattern to match degrees, minutes, seconds format
    coord_pattern = r'(\d+)°(\d+)\'([\d.]+)"([NS])\s+(\d+)°(\d+)\'([\d.]+)"([EW])'
    match = re.search(coord_pattern, clean_str)
    
    if not match:
        return None, None
    
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
        
        # Apply direction
        if lat_dir == 'S':
            lat = -lat
        if lon_dir == 'W':
            lon = -lon
        
        # Virginia bounds check
        if not (36.0 <= lat <= 40.0) or not (-84.0 <= lon <= -75.0):
            return None, None
            
        return lon, lat
        
    except (ValueError, IndexError):
        return None, None


def extract_year_from_description(description: str) -> Optional[int]:
    """Extract year from the description field."""
    if not description:
        return None
    
    # Look for dates in format like "25 Oct. 1695"
    year_patterns = [
        r'\b(1[6-9]\d{2})\b',  # 4-digit years 1600-1999
        r'\b(20[0-2]\d)\b',    # 2000-2029
    ]
    
    for pattern in year_patterns:
        matches = re.findall(pattern, description)
        if matches:
            year = int(matches[0])
            if 1600 <= year <= 2000:
                return year
    
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
            
            if lon is None or lat is None:
                skipped_no_coords += 1
                continue
            
            # Extract year from description
            description = row.get('description', '')
            year = extract_year_from_description(description)
            
            if not year:
                skipped_no_year += 1
                # Still include points without years, but assign default
                year = 1700
            
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
    
    input_file = project_root / "data" / "raw" / "results_full_v2.csv"
    output_file = project_root / "data" / "cleaned.geojson"
    
    # Ensure output directory exists
    output_file.parent.mkdir(exist_ok=True)
    
    # Process the data
    process_csv_to_geojson(input_file, output_file)


if __name__ == "__main__":
    main()
