import type { Athlete } from '../data'
import { useT } from '../i18n'
import LiquidGauge from '../../components/LiquidGauge'

export default function AthleteListSheet({
  title,
  athletes,
  onClose,
  onSelectAthlete,
  darkMode = true,
}: {
  title: string
  athletes: Athlete[]
  onClose: () => void
  onSelectAthlete: (athlete: Athlete) => void
  darkMode?: boolean
}) {
  const t = useT()
  return (
    <div className="chat-detail">
      <div className="cd-head">
        <button className="back" onClick={onClose}>‹</button>
        <div className="ti">
          <div className="n">{title}</div>
          <div className="s">{athletes.length} {athletes.length === 1 ? t('athlete') : t('athletes')}</div>
        </div>
      </div>

      <div className="ad-body">
        <div className="athlete-list">
          {athletes.map((a) => (
            <div className="athlete" key={a.id} onClick={() => onSelectAthlete(a)}>
              <div className="pic">{a.initials}</div>
              <div className="info">
                <div className="nm">{a.name}</div>
                <div className="meta">{t(a.note)}</div>
              </div>
              <LiquidGauge value={a.readiness} max={100} color="var(--green)" decimals={0} fillAlpha={0.58} dark={darkMode} size={44} />
            </div>
          ))}
          {athletes.length === 0 && <div className="empty">{t('No athletes in this group.')}</div>}
        </div>
      </div>
    </div>
  )
}
