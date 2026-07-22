import { useEffect, useRef, useState } from 'react'

const DURATION = 1400

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3)
}

export default function AnimatedBar({ percent, color }: { percent: number; color: string }) {
  const [display, setDisplay] = useState(0)
  const frame = useRef<number | undefined>(undefined)

  useEffect(() => {
    const start = performance.now()

    function tick(now: number) {
      const t = Math.min(1, (now - start) / DURATION)
      setDisplay(Math.round(easeOutCubic(t) * percent))
      if (t < 1) frame.current = requestAnimationFrame(tick)
    }

    frame.current = requestAnimationFrame(tick)
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current)
    }
  }, [percent])

  return (
    <div className="metric-track">
      <div className="metric-fill" style={{ width: `${display}%`, background: color }} />
    </div>
  )
}
