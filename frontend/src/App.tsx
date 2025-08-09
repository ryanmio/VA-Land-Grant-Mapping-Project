import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import GrantMap from './components/GrantMap'
import YearSlider from './components/YearSlider'
import { sonifier } from './audio/sonifier'

interface Stats {
  visibleCount: number
  totalCount: number
}

const App: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState<Stats>({ visibleCount: 0, totalCount: 0 })
  const [isPlaying, setIsPlaying] = useState(false)
  const playTimerRef = useRef<number | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(false)
  const lastTickedYearRef = useRef<number | null>(null)
  const lastSoundedYearRef = useRef<number | null>(null)
  const latestYearCountsRef = useRef<Map<number, number>>(new Map())
  const dataYearBoundsRef = useRef<{ minYear: number; maxYear: number } | null>(null)

  // Parse URL parameters with defaults
  const yearMin = useMemo(() => {
    const param = searchParams.get('yearMin')
    return param ? parseInt(param, 10) : 1600
  }, [searchParams])

  const yearMax = useMemo(() => {
    const param = searchParams.get('yearMax')
    return param ? parseInt(param, 10) : 1800
  }, [searchParams])

  const showRadius = useMemo(() => {
    return searchParams.get('rad') === 'true'
  }, [searchParams])

  // Update URL when parameters change
  const updateURL = useCallback((newYearMin: number, newYearMax: number, newShowRadius: boolean) => {
    const params = new URLSearchParams()
    
    // Only set non-default values
    if (newYearMin !== 1600) params.set('yearMin', newYearMin.toString())
    if (newYearMax !== 1800) params.set('yearMax', newYearMax.toString())
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

  // Sound toggle; initialize audio on first enable (user gesture)
  const handleSoundToggle = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const enabled = event.target.checked
    setSoundEnabled(enabled)
    if (enabled) {
      sonifier.init()
    }
  }, [])

  // Handle stats updates from the map
  const handleStatsUpdate = useCallback((newStats: Stats) => {
    setStats(newStats)
  }, [])

  // Play animation: sweep yearMax from 1600 -> 1800 with yearMin fixed at 1600
  const handlePlay = useCallback(() => {
    if (isPlaying) return
    setIsPlaying(true)
    lastTickedYearRef.current = null
    lastSoundedYearRef.current = null
    
    const startYear = 1600
    const endYear = 1800

    let current = startYear
    // Initialize range at startYear-startYear
    updateURL(startYear, startYear, showRadius)
    lastTickedYearRef.current = startYear
    
    // 50ms per year ~ 10s total
    playTimerRef.current = window.setInterval(() => {
      current += 1
      const nextMax = Math.min(current, endYear)
      updateURL(startYear, nextMax, showRadius)
      lastTickedYearRef.current = nextMax
      if (nextMax >= endYear) {
        if (playTimerRef.current) {
          clearInterval(playTimerRef.current)
          playTimerRef.current = null
        }
        setIsPlaying(false)
      }
    }, 50)
  }, [isPlaying, updateURL, showRadius, soundEnabled])

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (playTimerRef.current) {
        clearInterval(playTimerRef.current)
        playTimerRef.current = null
      }
    }
  }, [])

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
        onYearDistribution={(byYear: Map<number, number>) => {
          // Cache the distribution; actual playback is driven by the interval tick
          latestYearCountsRef.current = byYear
        }}
        onYearBounds={(bounds) => {
          dataYearBoundsRef.current = bounds
        }}
        onRenderedYearTick={(year, count) => {
          // Only sound when actively playing, sound enabled, and the render shows new points
          if (!isPlaying || !soundEnabled) return
          if (lastSoundedYearRef.current === year) return
          if (count > 0) {
            sonifier.playYear(year, count)
          }
          lastSoundedYearRef.current = year
        }}
      />

      <div className="control-panel">
        <h3>Virginia Land Grant Atlas</h3>
        
        <YearSlider
          yearMin={yearMin}
          yearMax={yearMax}
          onChange={handleYearChange}
          min={1600}
          max={1800}
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
          className="play-button"
          onClick={handlePlay}
          disabled={isLoading || isPlaying}
        >
          {isPlaying ? 'Playing…' : 'Play Animation'}
        </button>

        <div className="checkbox-container">
          <input
            type="checkbox"
            id="sound-toggle"
            checked={soundEnabled}
            onChange={handleSoundToggle}
            disabled={isLoading}
          />
          <label htmlFor="sound-toggle">
            Enable sound on play
          </label>
        </div>

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
