import React, { useCallback, useMemo } from 'react'
import { Range, getTrackBackground } from 'react-range'

interface YearSliderProps {
  yearMin: number
  yearMax: number
  onChange: (yearMin: number, yearMax: number) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
}

const YearSlider: React.FC<YearSliderProps> = ({
  yearMin,
  yearMax,
  onChange,
  min = 1600,
  max = 2000,
  step = 1,
  disabled = false
}) => {
  const values = useMemo(() => [yearMin, yearMax], [yearMin, yearMax])

  const handleChange = useCallback((newValues: number[]) => {
    const [newMin, newMax] = newValues
    if (newMin !== yearMin || newMax !== yearMax) {
      onChange(newMin, newMax)
    }
  }, [yearMin, yearMax, onChange])

  const trackBackground = useMemo(() => 
    getTrackBackground({
      values,
      colors: ['rgba(255, 255, 255, 0.2)', '#4f9eff', 'rgba(255, 255, 255, 0.2)'],
      min,
      max
    }), [values, min, max]
  )

  return (
    <div className="year-slider-container">
      <div className="year-slider-label">
        <span>Year Range</span>
        <span className="year-range">
          {yearMin} - {yearMax}
        </span>
      </div>
      
      <div className="range-slider">
        <Range
          values={values}
          step={step}
          min={min}
          max={max}
          disabled={disabled}
          onChange={handleChange}
          renderTrack={({ props, children }) => (
            <div
              {...props}
              style={{
                ...props.style,
                height: '6px',
                width: '100%',
                background: trackBackground,
                borderRadius: '3px'
              }}
            >
              {children}
            </div>
          )}
          renderThumb={({ props, index, isDragged }) => (
            <div
              {...props}
              style={{
                ...props.style,
                height: '20px',
                width: '20px',
                borderRadius: '50%',
                backgroundColor: '#4f9eff',
                border: '2px solid #fff',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                boxShadow: isDragged ? '0 0 0 3px rgba(79, 158, 255, 0.3)' : 'none',
                transform: isDragged ? 'scale(1.1)' : 'scale(1)',
                transition: 'all 0.2s ease',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.5 : 1
              }}
              key={index}
            >
              <div
                style={{
                  position: 'absolute',
                  top: '-28px',
                  color: '#fff',
                  fontWeight: 'bold',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  padding: '2px 6px',
                  backgroundColor: 'rgba(0, 0, 0, 0.8)',
                  borderRadius: '4px',
                  whiteSpace: 'nowrap',
                  visibility: isDragged ? 'visible' : 'hidden',
                  opacity: isDragged ? 1 : 0,
                  transition: 'all 0.2s ease'
                }}
              >
                {values[index]}
              </div>
            </div>
          )}
        />
      </div>
      
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        fontSize: '11px', 
        color: 'rgba(255, 255, 255, 0.5)',
        marginTop: '8px'
      }}>
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  )
}

export default YearSlider
