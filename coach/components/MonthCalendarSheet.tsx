import type { EventType, ScheduleDay } from '../data'
import { getMonthGrid, monthAbbrev, monthName } from '../lib/calendarUtils'
import { useT } from '../i18n'

const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

const dotClass: Record<EventType, string> = {
  training: 'g',
  match: 'r',
  recovery: 'y',
}

export default function MonthCalendarSheet({
  monthIndex,
  schedule,
  teamName,
  selectedDayId,
  onSelectDay,
  onOpenYear,
  onAddEvent,
  onClose,
}: {
  monthIndex: number
  schedule: ScheduleDay[]
  teamName: string
  selectedDayId: string
  onSelectDay: (dayId: string) => void
  onOpenYear: () => void
  onAddEvent: () => void
  onClose: () => void
}) {
  const t = useT()
  const cells = getMonthGrid(monthIndex)
  const abbrev = monthAbbrev(monthIndex)
  const relevantDays = schedule.filter((d) => d.month === abbrev)
  const totalEvents = relevantDays.flatMap((d) => d.events).length

  function dayForDate(date: number) {
    return relevantDays.find((d) => d.date === date)
  }

  return (
    <div className="chat-detail">
      <div className="cd-head">
        <button className="back" onClick={onClose}>‹</button>
        <button className="month-head-info" onClick={onOpenYear}>
          <div className="month-head-title">{t(monthName(monthIndex))}</div>
          <div className="month-head-sub">
            {teamName} · {totalEvents} {totalEvents === 1 ? t('event') : t('events')}
          </div>
        </button>
        <button className="opts" onClick={onAddEvent}>+</button>
      </div>

      <div className="ad-body">
        <div className="month-weekdays">
          {WEEKDAY_LABELS.map((w, i) => (
            <span key={i}>{w}</span>
          ))}
        </div>
        <div className="month-grid">
          {cells.map((date, i) => {
            if (date === null) return <div key={i} className="month-cell empty" />
            const day = dayForDate(date)
            const selected = day?.id === selectedDayId
            const count = day?.events.length ?? 0

            return (
              <button
                key={i}
                className={`month-cell ${day ? 'has-data' : ''} ${selected ? 'selected' : ''}`}
                disabled={!day}
                onClick={() => day && onSelectDay(day.id)}
              >
                <span className="month-cell-num">{date}</span>
                {count === 1 && <span className={`month-cell-dot ${dotClass[day!.events[0].type]}`} />}
                {count >= 2 && <span className="month-cell-bar" />}
              </button>
            )
          })}
        </div>

        <div className="month-legend">
          <span>
            <i className="month-legend-dot g" /> {t('Training')}
          </span>
          <span>
            <i className="month-legend-dot r" /> {t('Match')}
          </span>
          <span>
            <i className="month-legend-bar" /> {t('More')}
          </span>
        </div>
      </div>
    </div>
  )
}
