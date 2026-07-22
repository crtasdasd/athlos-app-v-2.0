import { useEffect, useRef, useState } from 'react'
import type { WeightPoint } from '../data'
import { useInViewOnce } from '../hooks/useInViewOnce'
import { useT } from '../i18n'

const WIDTH = 500
const HEIGHT = 180
const PAD_X = 10
const PAD_Y = 18

function buildPath(points: WeightPoint[]) {
  const kgs = points.map((p) => p.kg)
  const min = Math.min(...kgs)
  const max = Math.max(...kgs)
  const range = max - min || 1

  const coords = points.map((p, i) => {
    const x = PAD_X + (i / (points.length - 1)) * (WIDTH - PAD_X * 2)
    const y = PAD_Y + (1 - (p.kg - min) / range) * (HEIGHT - PAD_Y * 2)
    return { x, y }
  })

  const d = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ')
  return { d, coords }
}

const KG_TO_LB = 2.20462

export default function WeightChart({
  points,
  metricUnits = true,
}: {
  points: WeightPoint[]
  metricUnits?: boolean
}) {
  const t = useT()
  const pathRef = useRef<SVGPathElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [cardRef, inView] = useInViewOnce<HTMLDivElement>()
  const [dotVisible, setDotVisible] = useState(false)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const { d, coords } = buildPath(points)
  const last = coords[coords.length - 1]
  const unit = metricUnits ? 'kg' : 'lb'
  const convert = (kg: number) => (metricUnits ? kg : kg * KG_TO_LB)
  const current = convert(points[points.length - 1].kg)
  const delta = Math.round((convert(points[points.length - 1].kg) - convert(points[0].kg)) * 10) / 10
  const deltaColor = delta < 0 ? 'var(--green)' : delta > 0 ? 'var(--red)' : 'var(--muted)'

  function indexFromClientX(clientX: number) {
    const svg = svgRef.current
    if (!svg) return null
    const rect = svg.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    const xInViewBox = ratio * WIDTH
    let nearest = 0
    let minDist = Infinity
    coords.forEach((c, i) => {
      const dist = Math.abs(c.x - xInViewBox)
      if (dist < minDist) {
        minDist = dist
        nearest = i
      }
    })
    return nearest
  }

  function handleHover(clientX: number) {
    const idx = indexFromClientX(clientX)
    if (idx !== null) setHoverIndex(idx)
  }

  useEffect(() => {
    if (!inView) return
    const path = pathRef.current
    if (!path) return

    const len = path.getTotalLength()
    path.style.transition = 'none'
    path.style.strokeDasharray = `${len}`
    path.style.strokeDashoffset = `${len}`
    path.getBoundingClientRect()
    path.style.transition = 'stroke-dashoffset 2.2s cubic-bezier(0.22, 1, 0.36, 1)'

    const id = requestAnimationFrame(() => {
      setDotVisible(false)
      path.style.strokeDashoffset = '0'
    })
    const dotTimer = setTimeout(() => setDotVisible(true), 2000)

    return () => {
      cancelAnimationFrame(id)
      clearTimeout(dotTimer)
    }
  }, [points, inView])

  return (
    <div className="weight-card" ref={cardRef}>
      <div className="weight-head">
        <div>
          <div className="weight-title">{t('Body weight')}</div>
          <div className="weight-sub">{t('Last 12 months')}</div>
        </div>
        <div className="weight-now">
          <span className="weight-now-val mono">
            {current.toFixed(1)}
            <span className="weight-unit">{unit}</span>
          </span>
          <span className="weight-delta mono" style={{ color: deltaColor }}>
            {delta > 0 ? '+' : ''}
            {delta} {unit}
          </span>
        </div>
      </div>

      <div className="weight-chart-wrap">
        <svg
          ref={svgRef}
          className="weight-svg"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          onMouseMove={(e) => handleHover(e.clientX)}
          onMouseLeave={() => setHoverIndex(null)}
          onTouchStart={(e) => handleHover(e.touches[0].clientX)}
          onTouchMove={(e) => handleHover(e.touches[0].clientX)}
          onTouchEnd={() => setHoverIndex(null)}
        >
          <line x1={PAD_X} y1={HEIGHT / 3} x2={WIDTH - PAD_X} y2={HEIGHT / 3} className="weight-grid" />
          <line x1={PAD_X} y1={(HEIGHT / 3) * 2} x2={WIDTH - PAD_X} y2={(HEIGHT / 3) * 2} className="weight-grid" />
          <g
            className={`weight-plot ${inView ? 'play' : ''}`}
            style={{ transformOrigin: `0px ${HEIGHT}px` }}
          >
            <path ref={pathRef} d={d} fill="none" className="weight-line" />
            {last && (
              <circle
                cx={last.x}
                cy={last.y}
                r={dotVisible ? 4.5 : 0}
                className="weight-dot"
              />
            )}
          </g>
          {hoverIndex !== null && (
            <>
              <line
                x1={coords[hoverIndex].x}
                y1={PAD_Y}
                x2={coords[hoverIndex].x}
                y2={HEIGHT - PAD_Y}
                className="weight-hover-line"
              />
              <circle cx={coords[hoverIndex].x} cy={coords[hoverIndex].y} r="5" className="weight-hover-dot" />
            </>
          )}
        </svg>

        {hoverIndex !== null && (
          <div
            className="weight-tooltip"
            style={{
              left: `${Math.min(90, Math.max(10, (coords[hoverIndex].x / WIDTH) * 100))}%`,
              top: `${(coords[hoverIndex].y / HEIGHT) * 100}%`,
            }}
          >
            <div className="weight-tooltip-month">{points[hoverIndex].month}</div>
            <div className="weight-tooltip-val mono">
              {convert(points[hoverIndex].kg).toFixed(1)} {unit}
            </div>
          </div>
        )}
      </div>

      <div className="weight-axis">
        {[0, 4, 8, 11].map((i) => (
          <span key={i}>{points[i].month}</span>
        ))}
      </div>
    </div>
  )
}
