import { useState } from 'react'
import { athletes, schedule as initialSchedule, type EventType, type ScheduleDay } from '../data'
import { CAL_YEAR } from '../lib/calendarUtils'
import { useT } from '../i18n'
import AddEventSheet from './AddEventSheet'
import MonthCalendarSheet from './MonthCalendarSheet'
import YearCalendarSheet from './YearCalendarSheet'

type CalLevel = 'month' | 'year' | null

const chipClass: Record<EventType, string> = {
  training: 'g',
  match: 'r',
  recovery: 'y',
}

function formatTime(startHour: number) {
  const h = Math.floor(startHour)
  const m = Math.round((startHour - h) * 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export default function Calendar({ teamName }: { teamName: string }) {
  const t = useT()
  const [schedule, setSchedule] = useState<ScheduleDay[]>(initialSchedule)
  const [selectedDayId, setSelectedDayId] = useState(initialSchedule[0].id)
  const [showAdd, setShowAdd] = useState(false)
  const [calLevel, setCalLevel] = useState<CalLevel>(null)
  const [calMonthIndex, setCalMonthIndex] = useState(5)

  const selectedDay = schedule.find((d) => d.id === selectedDayId) ?? schedule[0]
  const allEvents = schedule.flatMap((d) => d.events)
  const trainingCount = allEvents.filter((e) => e.type === 'training').length
  const matchCount = allEvents.filter((e) => e.type === 'match').length

  function selectToday() {
    const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' })
    const match = schedule.find((d) => d.day === todayName)
    setSelectedDayId((match ?? schedule[0]).id)
  }

  function addEvent(
    dayId: string,
    event: { type: EventType; title: string; subtitle: string; startHour: number; durationHours: number }
  ) {
    setSchedule((s) =>
      s.map((d) =>
        d.id === dayId
          ? { ...d, events: [...d.events, { id: `${dayId}-${Date.now()}`, ...event }] }
          : d
      )
    )
  }

  function removeEvent(day: ScheduleDay, eventId: string) {
    const ev = day.events.find((e) => e.id === eventId)
    if (!ev) return
    if (window.confirm(`${t('Remove')} "${t(ev.title)}"?`)) {
      setSchedule((s) =>
        s.map((d) => (d.id === day.id ? { ...d, events: d.events.filter((e) => e.id !== eventId) } : d))
      )
    }
  }

  return (
    <div className="screen">
      <div className="stat-row">
        <div className="stat">
          <div className="num green">{trainingCount}</div>
          <div className="lbl">{t('trainings')}</div>
        </div>
        <div className="stat">
          <div className="num yellow">{matchCount}</div>
          <div className="lbl">{t('matches')}</div>
        </div>
        <div className="stat">
          <div className="num">{athletes.length}</div>
          <div className="lbl">{t('players')}</div>
        </div>
      </div>

      <div className="cal-week-card clickable" onClick={() => setCalLevel('month')}>
        <div className="cal-week-head">
          <span className="cal-week-label">{teamName}</span>
          <div className="cal-week-right">
            <button
              className="cal-today-link"
              onClick={(e) => {
                e.stopPropagation()
                selectToday()
              }}
            >
              {t('Today')}
            </button>
            <span className="cal-week-month">{t(schedule[0].month)}</span>
          </div>
        </div>
        <div className="cal-daystrip">
          {schedule.map((d) => (
            <button
              key={d.id}
              className={`cal-day ${d.id === selectedDayId ? 'selected' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                setSelectedDayId(d.id)
              }}
            >
              <span className="cal-day-name">{d.shortDay[0]}</span>
              <span className="cal-day-circle">{d.date}</span>
              {d.events.length > 0 && <span className="cal-day-dot" />}
            </button>
          ))}
        </div>
      </div>

      <div className="cal-section-title">{t(selectedDay.day)}</div>

      <div className="cal-agenda">
        {selectedDay.events.length === 0 ? (
          <div className="chip free">
            <div className="bar" />
            <div className="ci">
              <div className="ct">{t('Free')}</div>
              <div className="cs">{t('No planned events')}</div>
            </div>
          </div>
        ) : (
          selectedDay.events.map((ev) => (
            <div
              key={ev.id}
              className={`chip ${chipClass[ev.type]}`}
              onClick={() => removeEvent(selectedDay, ev.id)}
            >
              <div className="bar" />
              <div className="ci">
                <div className="ct">{t(ev.title)}</div>
                <div className="cs">{t(ev.subtitle)}</div>
              </div>
              <div className="time">{formatTime(ev.startHour)}</div>
            </div>
          ))
        )}
      </div>

      <button className="cal-fab" onClick={() => setShowAdd(true)}>
        +
      </button>

      {showAdd && (
        <AddEventSheet
          days={schedule}
          defaultDayId={selectedDayId}
          onAdd={addEvent}
          onClose={() => setShowAdd(false)}
        />
      )}

      {calLevel === 'month' && (
        <MonthCalendarSheet
          monthIndex={calMonthIndex}
          schedule={schedule}
          teamName={teamName}
          selectedDayId={selectedDayId}
          onSelectDay={(id) => {
            setSelectedDayId(id)
            setCalLevel(null)
          }}
          onOpenYear={() => setCalLevel('year')}
          onAddEvent={() => {
            setCalLevel(null)
            setShowAdd(true)
          }}
          onClose={() => setCalLevel(null)}
        />
      )}

      {calLevel === 'year' && (
        <YearCalendarSheet
          year={CAL_YEAR}
          schedule={schedule}
          onOpenMonth={(idx) => {
            setCalMonthIndex(idx)
            setCalLevel('month')
          }}
          onClose={() => setCalLevel('month')}
        />
      )}
    </div>
  )
}
