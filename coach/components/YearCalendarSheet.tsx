import type { ScheduleDay } from '../data'
import { getMonthGrid, monthAbbrev, monthName } from '../lib/calendarUtils'
import { useT } from '../i18n'

function MiniMonth({
  monthIndex,
  schedule,
  active,
  onClick,
}: {
  monthIndex: number
  schedule: ScheduleDay[]
  active: boolean
  onClick: () => void
}) {
  const t = useT()
  const cells = getMonthGrid(monthIndex)
  const abbrev = monthAbbrev(monthIndex)
  const relevantDays = schedule.filter((d) => d.month === abbrev)

  return (
    <button className={`mini-month ${active ? 'active' : ''}`} onClick={onClick}>
      <div className="mini-month-name">{t(monthName(monthIndex))}</div>
      <div className="mini-month-grid">
        {cells.map((date, i) => {
          if (date === null) return <span key={i} className="mini-cell empty" />
          const hasData = relevantDays.some((d) => d.date === date)
          return (
            <span key={i} className={`mini-cell ${hasData ? 'has-data' : ''}`}>
              {date}
            </span>
          )
        })}
      </div>
    </button>
  )
}

export default function YearCalendarSheet({
  year,
  schedule,
  onOpenMonth,
  onClose,
}: {
  year: number
  schedule: ScheduleDay[]
  onOpenMonth: (monthIndex: number) => void
  onClose: () => void
}) {
  return (
    <div className="chat-detail">
      <div className="cd-head">
        <button className="back" onClick={onClose}>‹</button>
        <div className="ti">
          <div className="n">{year}</div>
        </div>
      </div>

      <div className="ad-body">
        <div className="year-grid">
          {Array.from({ length: 12 }, (_, i) => (
            <MiniMonth
              key={i}
              monthIndex={i}
              schedule={schedule}
              active={i === 5}
              onClick={() => onOpenMonth(i)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
