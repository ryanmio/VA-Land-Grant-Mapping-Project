import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import GrantMap from './components/GrantMap'
import YearSlider from './components/YearSlider'

interface Stats {
  visibleCount: number
  totalCount: number
}

const App: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState<Stats>({ visibleCount: 0, totalCount: 0 })
  const [isExporting, setIsExporting] = useState(false)

  // Parse URL parameters with defaults
  const yearMin = useMemo(() => {
    const param = searchParams.get('yearMin')
    return param ? parseInt(param, 10) : 1600
  }, [searchParams])

  const yearMax = useMemo(() => {
    const param = searchParams.get('yearMax')
    return param ? parseInt(param, 10) : 2000
  }, [searchParams])

  const showRadius = useMemo(() => {
    return searchParams.get('rad') === 'true'
  }, [searchParams])

  // Update URL when parameters change
  const updateURL = useCallback((newYearMin: number, newYearMax: number, newShowRadius: boolean) => {
    const params = new URLSearchParams()
    
    // Only set non-default values
    if (newYearMin !== 1600) params.set('yearMin', newYearMin.toString())
    if (newYearMax !== 2000) params.set('yearMax', newYearMax.toString())
    if (newShowRadius) params.set('rad', 'true')
    
    setSearchParams(params, { replace: true })
  }, [setSearchParams])

  // Handle year range changes
  const handleYearChange = useCallback((newYearMin: number, newYearMax: number) => {
    updateURL(newYearMin, newYearMax, showRadius)
  }, [updateURL, showRadius])

  // Handle radius toggle
  const handleRadiusToggle = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newShowRadius = event.target.checked
    updateURL(yearMin, yearMax, newShowRadius)
  }, [updateURL, yearMin, yearMax])

  // Handle stats updates from the map
  const handleStatsUpdate = useCallback((newStats: Stats) => {
    setStats(newStats)
  }, [])

  // Export functionality - downloads current filtered data as GeoJSON
  const handleExport = useCallback(async () => {
    setIsExporting(true)
    
    try {
      // In a real implementation, this would use deck.gl's pickObjects
      // or fetch the filtered data from the PMTiles directly
      // For now, we'll create a mock export
      
      const exportData = {
        type: 'FeatureCollection',
        properties: {
          exported_at: new Date().toISOString(),
          year_range: `${yearMin}-${yearMax}`,
          radius_overlay: showRadius,
          total_features: stats.visibleCount
        },
        features: [] // In real implementation, this would contain filtered features
      }
      
      // Create blob and download
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
        type: 'application/json' 
      })
      
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `virginia-grants-${yearMin}-${yearMax}-${Date.now()}.geojson`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
    } catch (error) {
      console.error('Export failed:', error)
      alert('Export failed. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }, [yearMin, yearMax, showRadius, stats.visibleCount])

  // Simulate initial loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 1000)
    
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="App">
      {isLoading && (
        <div className="loading-indicator">
          <div className="loading-spinner"></div>
          <div>Loading Virginia Land Grant Atlas...</div>
        </div>
      )}

      <GrantMap
        yearMin={yearMin}
        yearMax={yearMax}
        showRadius={showRadius}
        onStatsUpdate={handleStatsUpdate}
      />

      <div className="control-panel">
        <h3>Virginia Land Grant Atlas</h3>
        
        <YearSlider
          yearMin={yearMin}
          yearMax={yearMax}
          onChange={handleYearChange}
          min={1600}
          max={2000}
          step={1}
          disabled={isLoading}
        />

        <div className="checkbox-container">
          <input
            type="checkbox"
            id="radius-toggle"
            checked={showRadius}
            onChange={handleRadiusToggle}
            disabled={isLoading}
          />
          <label htmlFor="radius-toggle">
            Show ±23km Radius Overlay
          </label>
        </div>

        <button
          className="export-button"
          onClick={handleExport}
          disabled={isLoading || isExporting || stats.visibleCount === 0}
        >
          {isExporting ? 'Exporting...' : 'Export Filtered Data'}
        </button>

        <div className="stats">
          <div className="stats-item">
            <span>Visible:</span>
            <span className="stats-value">
              {stats.visibleCount.toLocaleString()}
            </span>
          </div>
          <div className="stats-item">
            <span>Total:</span>
            <span className="stats-value">
              {stats.totalCount.toLocaleString()}
            </span>
          </div>
          <div className="stats-item">
            <span>Filtered:</span>
            <span className="stats-value">
              {((stats.visibleCount / stats.totalCount) * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
