import React, { useMemo, useCallback, useRef, useState, useEffect } from 'react'
import DeckGL from '@deck.gl/react'
import { ScatterplotLayer } from '@deck.gl/layers'
import { DataFilterExtension } from '@deck.gl/extensions'
import Map from 'react-map-gl/maplibre'
import type { MapRef } from 'react-map-gl/maplibre'
import type { PickingInfo, Deck } from '@deck.gl/core'

interface GrantMapProps {
  yearMin: number
  yearMax: number
  showRadius: boolean
  onStatsUpdate?: (stats: { visibleCount: number; totalCount: number }) => void
}

interface GrantFeature {
  properties: {
    year: number
    grant_id?: string
    [key: string]: unknown
  }
  geometry: {
    coordinates: [number, number]
  }
}

const INITIAL_VIEW_STATE = {
  longitude: -78.6569,
  latitude: 37.4316,
  zoom: 7,
  pitch: 0,
  bearing: 0
}

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

const GrantMap: React.FC<GrantMapProps> = ({
  yearMin,
  yearMax,
  showRadius,
  onStatsUpdate
}) => {
  const deckRef = useRef<Deck>(null)
  const mapRef = useRef<MapRef>(null)
  const [hoveredFeature, setHoveredFeature] = useState<GrantFeature | null>(null)
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null)

  // Create the data filter extension for GPU-side year filtering
  const dataFilterExtension = useMemo(() => new DataFilterExtension({
    filterSize: 1,
    fp64: false
  }), [])

  // Load GeoJSON data directly
  const [grantData, setGrantData] = useState<GrantFeature[]>([])
  
  useEffect(() => {
    fetch('/data/cleaned.geojson')
      .then(response => response.json())
      .then(data => {
        setGrantData(data.features || [])
      })
      .catch(error => {
        console.error('Error loading grant data:', error)
      })
  }, [])

  // Scatterplot layer for grants
  const scatterplotLayer = useMemo(() => new ScatterplotLayer({
    id: 'grants-scatterplot',
    data: grantData,
    
    // Position
    getPosition: (d: GrantFeature) => d.geometry.coordinates,
    
    // Radius based on showRadius toggle
    getRadius: showRadius ? 23000 : 30, // 23km or 30m
    radiusScale: 1,
    radiusMinPixels: showRadius ? 1 : 2,
    radiusMaxPixels: showRadius ? 100 : 8,
    
    // Color based on year (gradient from blue to red)
    getFillColor: (d: GrantFeature) => {
      const year = d.properties.year || 1700
      const normalizedYear = (year - 1600) / (1800 - 1600)
      
      // Blue to red gradient
      const red = Math.floor(normalizedYear * 255)
      const blue = Math.floor((1 - normalizedYear) * 255)
      const green = 50
      
      return [red, green, blue, showRadius ? 60 : 180]
    },
    
    // Interaction
    pickable: true,
    autoHighlight: true,
    highlightColor: [255, 255, 255, 100],
    
    // Performance optimizations
    updateTriggers: {
      getRadius: [showRadius],
      getFillColor: [yearMin, yearMax],
      getFilterValue: [yearMin, yearMax]
    },
    
    // GPU filtering
    extensions: [dataFilterExtension],
    getFilterValue: (d: GrantFeature) => d.properties.year,
    filterRange: [yearMin, yearMax],
    filterSoftRange: [yearMin - 1, yearMax + 1],
    
    // Performance settings
    fp64: false,
    billboard: false,
    stroked: false,
    filled: true
  }), [grantData, yearMin, yearMax, showRadius, dataFilterExtension])

  // Handle hover
  const onHover = useCallback((info: PickingInfo) => {
    const { object, x, y } = info
    
    if (object && x !== undefined && y !== undefined) {
      setHoveredFeature(object as GrantFeature)
      setCursorPosition({ x, y })
    } else {
      setHoveredFeature(null)
      setCursorPosition(null)
    }
  }, [])

  // Handle click for debugging
  const onClick = useCallback((info: PickingInfo) => {
    if (info.object) {
      console.log('Clicked feature:', info.object)
    }
  }, [])

  // Update stats when data or filters change
  useEffect(() => {
    if (onStatsUpdate && grantData.length > 0) {
      const totalCount = grantData.length
      
      // Count visible features based on year filter
      const visibleFeatures = grantData.filter(feature => {
        const year = feature.properties.year || 1700
        return year >= yearMin && year <= yearMax
      })
      
      onStatsUpdate({
        visibleCount: visibleFeatures.length,
        totalCount: totalCount
      })
    }
  }, [grantData, yearMin, yearMax, onStatsUpdate])

  return (
    <div className="map-container">
      <DeckGL
        ref={deckRef}
        initialViewState={INITIAL_VIEW_STATE}
        controller={true}
        layers={[scatterplotLayer]}
        onHover={onHover}
        onClick={onClick}
        getCursor={({ isHovering }) => isHovering ? 'pointer' : 'grab'}
      >
        <Map
          ref={mapRef}
          mapStyle={MAP_STYLE}
          attributionControl={false}
          maplibreLogo={false}
        />
      </DeckGL>

      {/* Hover tooltip */}
      {hoveredFeature && cursorPosition && (
        <div
          style={{
            position: 'absolute',
            left: cursorPosition.x + 10,
            top: cursorPosition.y - 10,
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '4px',
            fontSize: '12px',
            pointerEvents: 'none',
            zIndex: 1000,
            maxWidth: '200px',
            backdropFilter: 'blur(4px)',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}
        >
          {(() => {
            const gid = (hoveredFeature.properties.grant_id as string | undefined) || ''
            const parts = gid.split('_')
            const cpVol = parts[0] === 'III' ? 'Cavaliers and Pioneers Volume III' : parts[0] === 'II' ? 'Cavaliers and Pioneers Volume II' : undefined
            const bookNum = parts.length >= 2 && /^\d+$/.test(parts[1]) ? parseInt(parts[1], 10) : undefined
            return (
              <>
                <div><strong>Year:</strong> {hoveredFeature.properties.year || 'Unknown'}</div>
                {hoveredFeature.properties.description && (
                  <div>
                    <strong>Description:</strong> {String(hoveredFeature.properties.description).slice(0, 160)}
                  </div>
                )}
                {typeof bookNum === 'number' && (
                  <div><strong>Patent Book:</strong> Book {bookNum}</div>
                )}
                {cpVol && (
                  <div><strong>C&P Volume:</strong> {cpVol}</div>
                )}
              </>
            )
          })()}
        </div>
      )}

      {/* Attribution */}
      <div className="attribution">
        Virginia Land Grants • 
        <a 
          href="https://carto.com/attributions" 
          target="_blank" 
          rel="noopener noreferrer"
          style={{ color: 'inherit', marginLeft: '4px' }}
        >
          CartoDB
        </a>
      </div>
    </div>
  )
}

export default GrantMap
