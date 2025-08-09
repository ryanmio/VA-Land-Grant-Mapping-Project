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
  const [isPanelCollapsed, setIsPanelCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try {
      const saved = window.localStorage.getItem('panelCollapsed')
      if (saved !== null) return saved === '1'
    } catch {}
    return false
  })
  const playTimerRef = useRef<number | null>(null)
  const [isMuted, setIsMuted] = useState(false)
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

  // Mute toggle (audio is on by default; this just prevents playback)
  const handleMuteToggle = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const muted = event.target.checked
    setIsMuted(muted)
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
    // Initialize audio context on user gesture
    sonifier.init()
    
    const startYear = 1600
    const endYear = 1800

    let current = startYear
    // Initialize range at startYear-startYear
    updateURL(startYear, startYear, showRadius)
    lastTickedYearRef.current = startYear
    
    // 60–70ms per year is smoother on mobile and reduces CPU
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
    }, 66)
  }, [isPlaying, updateURL, showRadius])

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (playTimerRef.current) {
        clearInterval(playTimerRef.current)
        playTimerRef.current = null
      }
    }
  }, [])

  // Persist collapsed state
  useEffect(() => {
    try {
      window.localStorage.setItem('panelCollapsed', isPanelCollapsed ? '1' : '0')
    } catch {}
  }, [isPanelCollapsed])

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
          if (!isPlaying || isMuted) return
          if (lastSoundedYearRef.current === year) return
          if (count > 0) {
            sonifier.playYear(year, count)
          }
          lastSoundedYearRef.current = year
        }}
      />

      <div className={`control-panel ${isPanelCollapsed ? 'collapsed' : ''}`}>
        {!isPanelCollapsed && <h3>Virginia Land Grant Atlas</h3>}

        {/* The year slider remains visible in both states */}
        <YearSlider
          yearMin={yearMin}
          yearMax={yearMax}
          onChange={handleYearChange}
          min={1600}
          max={1800}
          step={1}
          disabled={isLoading}
        />

        {!isPanelCollapsed && (
          <>
            <details style={{ marginTop: 12 }}>
              <summary style={{ cursor: 'pointer', color: '#e0e6f3', marginBottom: 8 }}>Options</summary>
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
              <div className="checkbox-container">
                <input
                  type="checkbox"
                  id="mute-toggle"
                  checked={isMuted}
                  onChange={handleMuteToggle}
                  disabled={isLoading}
                />
                <label htmlFor="mute-toggle">Mute animation</label>
              </div>
            </details>

            <button
              className="play-button"
              onClick={handlePlay}
              disabled={isLoading || isPlaying}
            >
              {isPlaying ? 'Playing…' : 'Play Animation'}
            </button>

            <div className="stats">
              <div className="stats-item">
                <span>Visible:</span>
                <span className="stats-value">{stats.visibleCount.toLocaleString()}</span>
              </div>
              <div className="stats-item">
                <span>Total:</span>
                <span className="stats-value">{stats.totalCount.toLocaleString()}</span>
              </div>
              <div className="stats-item">
                <span>Filtered:</span>
                <span className="stats-value">{((stats.visibleCount / stats.totalCount) * 100).toFixed(1)}%</span>
              </div>
            </div>
          </>
        )}

        <div className="control-panel__footer">
          <button
            className="control-panel__caret"
            aria-label={isPanelCollapsed ? 'Expand controls' : 'Collapse controls'}
            onClick={() => setIsPanelCollapsed(prev => !prev)}
          >
            {isPanelCollapsed ? (
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path d="M6 10l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path d="M6 14l6-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default App
