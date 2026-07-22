import { useState } from 'react'
import type { EventType, ScheduleDay } from '../data'
import { useT } from '../i18n'

const typeOptions: { type: EventType; label: string }[] = [
  { type: 'training', label: 'Training' },
  { type: 'match', label: 'Match' },
  { type: 'recovery', label: 'Recovery' },
]

export default function AddEventSheet({
  days,
  defaultDayId,
  onAdd,
  onClose,
}: {
  days: ScheduleDay[]
  defaultDayId: string
  onAdd: (dayId: string, event: { type: EventType; title: string; subtitle: string; startHour: number; durationHours: number }) => void
  onClose: () => void
}) {
  const t = useT()
  const [dayId, setDayId] = useState(defaultDayId)
  const [type, setType] = useState<EventType>('training')
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [time, setTime] = useState('17:00')
  const [duration, setDuration] = useState('1')

  function submit() {
    if (!title.trim()) return
    const [h, m] = time.split(':').map(Number)
    const startHour = h + (m || 0) / 60
    const durationHours = Math.max(0.5, Number(duration) || 1)

    onAdd(dayId, { type, title: title.trim(), subtitle: subtitle.trim(), startHour, durationHours })
    onClose()
  }

  return (
    <>
      <div className="sheet-bg" onClick={onClose} />
      <div className="sheet">
        <div className="grab" />
        <h4>{t('Add event')}</h4>

        <div className="field-row">
          {typeOptions.map((o) => (
            <button
              key={o.type}
              className={`type-pill ${o.type} ${type === o.type ? 'active' : ''}`}
              onClick={() => setType(o.type)}
            >
              {t(o.label)}
            </button>
          ))}
        </div>

        <input className="chat-search" placeholder={t('Title')} value={title} onChange={(e) => setTitle(e.target.value)} />
        <input
          className="chat-search"
          placeholder={t('Location / details')}
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
        />

        <div className="field-row">
          <select className="chat-search field-select" value={dayId} onChange={(e) => setDayId(e.target.value)}>
            {days.map((d) => (
              <option key={d.id} value={d.id}>
                {t(d.day)}
              </option>
            ))}
          </select>
          <input
            className="chat-search field-time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
          <input
            className="chat-search field-duration"
            type="number"
            min="0.5"
            step="0.5"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />
        </div>

        <button className="chat-cta" onClick={submit}>
          {t('Add event')}
        </button>
      </div>
    </>
  )
}
