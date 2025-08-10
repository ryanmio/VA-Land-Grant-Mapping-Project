## Virginia Land Grant Atlas

A minimalist, static, client-side map of Virginia land grants with year filtering and an optional ±23 km radius overlay. This is an ongoing project to place every land grant on the map using the methodology described in the companion repository: [colonial-virginia-llm-geolocation](https://github.com/ryanmio/colonial-virginia-llm-geolocation).

## Data processing pipeline

Input: `data/mapped_grants.csv`

1) Convert CSV to GeoJSON
```bash
python3 scripts/clean.py
```
Output: `data/cleaned.geojson`

2) Generate vector tiles (PMTiles)
```bash
./scripts/make_tiles.sh
```
Output: `data/grants.pmtiles`

## URL parameters

- yearMin: integer; default 1600
- yearMax: integer; default 1800
- rad: boolean (`true` to enable ±23 km radius overlay); default false
