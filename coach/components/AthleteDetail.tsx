import {
  getAthleteAttendance,
  getAthleteMetrics,
  getAthleteSleepSeries,
  getAthleteTrend,
  getAthleteWeightSeries,
  getOrCreateAthleteConversation,
  readinessRx,
  readinessStatus,
  type Athlete,
} from '../data'
import { useInViewOnce } from '../hooks/useInViewOnce'
import { useT } from '../i18n'
import AnimatedBar from './AnimatedBar'
import CountUp from './CountUp'
import WeightChart from './WeightChart'

const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function barColor(score: number) {
  return score >= 70 ? 'var(--green)' : score >= 50 ? 'var(--yellow)' : 'var(--red)'
}

export default function AthleteDetail({
  athlete,
  onClose,
  onOpenChat,
  metricUnits,
}: {
  athlete: Athlete
  onClose: () => void
  onOpenChat: (conversationId: string) => void
  metricUnits: boolean
}) {
  const t = useT()
  const metrics = getAthleteMetrics(athlete)
  const trend = getAthleteTrend(athlete)
  const weightSeries = getAthleteWeightSeries(athlete)
  const sleep = getAthleteSleepSeries(athlete)
  const attendance = getAthleteAttendance(athlete)
  const status = readinessStatus(athlete.readiness)
  const [trendRef, trendInView] = useInViewOnce<HTMLDivElement>()
  const [sleepRef, sleepInView] = useInViewOnce<HTMLDivElement>()

  const avgSleep = Math.round((sleep.reduce((s, h) => s + h, 0) / sleep.length) * 10) / 10
  const sleepColor = (h: number) => (h >= 7 ? 'var(--green)' : h >= 6 ? 'var(--yellow)' : 'var(--red)')

  return (
    <div className="chat-detail">
      <div className="cd-head">
        <button className="back" onClick={onClose}>‹</button>
        <div className="pic">{athlete.initials}</div>
        <div className="ti">
          <div className="n">{athlete.name}</div>
          <div className="s">{t('Readiness')} {athlete.readiness}%</div>
        </div>
      </div>

      <div className="ad-body">
        <button
          className="chat-cta"
          onClick={() => onOpenChat(getOrCreateAthleteConversation(athlete))}
        >
          💬 {t('Chat with')} {athlete.name.split(' ')[0]}
        </button>

        <div className="readiness-banner" style={{ borderColor: status.color }}>
          <div className="readiness-title" style={{ color: status.color }}>
            {t(status.title)}
          </div>
          <div className="readiness-desc">{t(status.desc)}</div>
        </div>

        {/* Today's prescription — planned session × readiness factor */}
        {(() => {
          const rx = readinessRx(athlete.readiness)
          return (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'var(--surface)', border: '1px solid var(--line)',
              borderRadius: 14, padding: '13px 16px', margin: '10px 0 4px',
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8.5, letterSpacing: '0.12em', color: 'var(--muted)', textTransform: 'uppercase' }}>
                  {t("Today's training")}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{t(rx.note)}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: rx.color }}>{t(rx.load)}</div>
                <div style={{ fontSize: 8.5, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>{t('intensity')}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: rx.color }}>{t(rx.volume)}</div>
                <div style={{ fontSize: 8.5, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>{t('volume')}</div>
              </div>
            </div>
          )
        })()}

        <div className="sectlabel">{t('Breakdown')}</div>
        <div className="set-group metric-group">
          {metrics.map((m) => (
            <div className="metric-row" key={m.label}>
              <div className="metric-head">
                <div className="metric-text">
                  <span className="metric-label">{t(m.label)}</span>
                  <span className="metric-sub">
                    {t(m.sublabel)}
                    {m.weight > 0 ? ` · ${m.weight}%` : ''}
                  </span>
                </div>
                <CountUp className="metric-score mono" value={m.score} />
              </div>
              <AnimatedBar percent={m.score} color={barColor(m.score)} />
            </div>
          ))}
        </div>

        <div className="metric-note">
          {t('Readiness stands on four pillars: Recovery is the base, Freshness (recent vs. usual load) and today’s Wellness nudge it up or down, and an overload penalty kicks in when the last week was much harder than usual (ACWR above 1.3). Today’s session is not in today’s readiness — it shows up tomorrow through freshness.')}
        </div>

        <div className="sectlabel">{t('Last 7 days')}</div>
        <div className="trend-card" ref={trendRef}>
          <div className="trend-chart">
            {trend.map((v, i) => (
              <div className="trend-bar-wrap" key={i}>
                <div className="trend-val" style={{ color: barColor(v) }}>{v}</div>
                <div
                  className={`trend-bar ${trendInView ? 'play' : ''}`}
                  style={{ height: `${v}%`, background: barColor(v), animationDelay: `${i * 110}ms` }}
                />
                <div className="trend-day">{dayLabels[i]}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="sectlabel">{t('Sleep · last 7 days')} · Ø {avgSleep}h</div>
        <div className="trend-card" ref={sleepRef}>
          <div className="trend-chart">
            {sleep.map((h, i) => (
              <div className="trend-bar-wrap" key={i}>
                <div className="trend-val" style={{ color: sleepColor(h) }}>{h.toFixed(1)}</div>
                <div
                  className={`trend-bar ${sleepInView ? 'play' : ''}`}
                  style={{ height: `${(h / 10) * 100}%`, background: sleepColor(h), animationDelay: `${i * 110}ms` }}
                />
                <div className="trend-day">{dayLabels[i]}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="sectlabel">{t('Trainings · last 30 days')}</div>
        <div className="stat-row">
          <div className="stat">
            <CountUp className="num green" value={attendance.done} />
            <div className="lbl">{t('completed')}</div>
          </div>
          <div className="stat">
            <CountUp className="num" value={attendance.missed} />
            <div className="lbl" style={{ color: attendance.missed > 2 ? 'var(--red)' : undefined }}>{t('missed')}</div>
          </div>
          <div className="stat">
            <CountUp className="num" value={attendance.rate} />
            <div className="lbl">{t('attendance')} %</div>
          </div>
        </div>

        <WeightChart points={weightSeries} metricUnits={metricUnits} />
      </div>
    </div>
  )
}
