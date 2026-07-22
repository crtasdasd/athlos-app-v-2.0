import { useEffect, useRef, useState } from 'react'

const DURATION = 1500

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3)
}

export default function CountUp({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(0)
  const frame = useRef<number | undefined>(undefined)

  useEffect(() => {
    const start = performance.now()

    function tick(now: number) {
      const t = Math.min(1, (now - start) / DURATION)
      setDisplay(Math.round(easeOutCubic(t) * value))
      if (t < 1) frame.current = requestAnimationFrame(tick)
    }

    frame.current = requestAnimationFrame(tick)
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current)
    }
  }, [value])

  return <div className={className}>{display}</div>
}
