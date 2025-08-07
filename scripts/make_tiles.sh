#!/bin/bash

# Generate PMTiles from cleaned GeoJSON using tippecanoe
# Optimized for ~500k Virginia land grant points with year filtering

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Virginia Land Grant Atlas - Tile Generation ===${NC}"

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DATA_DIR="$PROJECT_ROOT/data"

# Input and output files
INPUT_FILE="$DATA_DIR/cleaned.geojson"
OUTPUT_FILE="$DATA_DIR/grants.pmtiles"

# Check if input file exists
if [ ! -f "$INPUT_FILE" ]; then
    echo -e "${RED}Error: Input file $INPUT_FILE not found${NC}"
    echo "Please run 'python3 scripts/clean.py' first to generate the cleaned GeoJSON"
    exit 1
fi

# Check if tippecanoe is installed
if ! command -v tippecanoe &> /dev/null; then
    echo -e "${RED}Error: tippecanoe is not installed${NC}"
    echo "Install with: brew install tippecanoe (macOS) or build from source"
    echo "See: https://github.com/felt/tippecanoe"
    exit 1
fi

echo -e "${GREEN}Input file:${NC} $INPUT_FILE"
echo -e "${GREEN}Output file:${NC} $OUTPUT_FILE"

# Get input file size
INPUT_SIZE=$(du -h "$INPUT_FILE" | cut -f1)
echo -e "${GREEN}Input size:${NC} $INPUT_SIZE"

echo -e "${YELLOW}Generating PMTiles...${NC}"

# Run tippecanoe with optimized settings for Virginia land grants
# -zg: automatic zoom levels
# --drop-densest-as-needed: handle dense areas gracefully
# -l grants: layer name
# --force: overwrite existing output
# --no-feature-limit: don't limit features per tile
# --no-tile-size-limit: don't limit tile sizes
# --buffer=0: no buffer around tiles (faster for points)
# --simplification=2: minimal simplification for points
# --base-zoom=6: good base zoom for Virginia
# --maximum-zoom=16: detailed enough for land parcels
tippecanoe \
    -zg \
    --drop-densest-as-needed \
    -l grants \
    --force \
    --no-feature-limit \
    --no-tile-size-limit \
    --buffer=0 \
    --simplification=2 \
    --base-zoom=6 \
    --maximum-zoom=16 \
    --output="$OUTPUT_FILE" \
    "$INPUT_FILE"

# Check if output was created successfully
if [ ! -f "$OUTPUT_FILE" ]; then
    echo -e "${RED}Error: Failed to generate PMTiles${NC}"
    exit 1
fi

# Get output file size
OUTPUT_SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
echo -e "${GREEN}Output size:${NC} $OUTPUT_SIZE"

# Check if output is under 75MB as requested
OUTPUT_SIZE_MB=$(du -m "$OUTPUT_FILE" | cut -f1)
if [ "$OUTPUT_SIZE_MB" -gt 75 ]; then
    echo -e "${YELLOW}Warning: Output file is ${OUTPUT_SIZE_MB}MB (> 75MB target)${NC}"
    echo "Consider adjusting tippecanoe parameters for smaller output"
else
    echo -e "${GREEN}✓ Output file is ${OUTPUT_SIZE_MB}MB (under 75MB target)${NC}"
fi

echo -e "${GREEN}✓ PMTiles generation complete!${NC}"
echo -e "${GREEN}File ready for use:${NC} $OUTPUT_FILE"

# Optional: Generate tile info
echo -e "${YELLOW}Tile information:${NC}"
tippecanoe-enumerate "$OUTPUT_FILE" | head -10
