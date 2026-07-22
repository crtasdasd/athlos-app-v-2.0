import { useEffect, useState } from 'react'
import { getTeamStats, type Athlete } from '../data'
import { useT } from '../i18n'
import { listClubJoinRequests, respondToJoinRequest } from '../../lib/api'
import AthleteDetail from './AthleteDetail'
import AthleteListSheet from './AthleteListSheet'
import AddAthleteSheet from './AddAthleteSheet'
import LiquidGauge from '../../components/LiquidGauge'
import CountUp from './CountUp'

interface JoinRequest { id: string; user_id: string; name: string; photo: string | null }

type StatFilter = 'all' | 'healthy' | 'sick' | 'injured'

type UiAthlete = Athlete & { user_id?: string; photo?: string | null }

// Coach home — the live view of the club: stat tiles, the athlete list with
// readiness rings, and the "+ add athlete by username" flow. All real data.
export default function Dashboard({
  athletes,
  coachId,
  club,
  onRefresh,
  onOpenChat,
  metricUnits,
  darkMode = true,
}: {
  athletes: UiAthlete[]
  coachId: string
  club: { id: string; name: string; location: string | null; conversation_id: string | null }
  onRefresh: () => void
  onOpenChat: (conversationId: string) => void
  metricUnits: boolean
  darkMode?: boolean
}) {
  const t = useT()
  const [openId, setOpenId] = useState<string | null>(null)
  const [statFilter, setStatFilter] = useState<StatFilter | null>(null)
  const [adding, setAdding] = useState(false)
  const open = athletes.find((a) => a.id === openId)
  const stats = getTeamStats(athletes)

  // Pending join requests — only relevant once the club is private (Settings
  // → Club privacy); a public club never produces these, joinClub() there
  // adds the athlete instantly instead of a request row.
  const [requests, setRequests] = useState<JoinRequest[]>([])
  const [busyReq, setBusyReq] = useState<string | null>(null)
  const reloadRequests = () => { listClubJoinRequests(club.id).then(setRequests).catch(() => {}) }
  useEffect(() => { if (club?.id) reloadRequests() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [club?.id])

  const decide = async (id: string, decision: 'approve' | 'decline') => {
    setBusyReq(id)
    try {
      await respondToJoinRequest(id, decision, { coachId })
      reloadRequests()
      if (decision === 'approve') onRefresh()
    } finally { setBusyReq(null) }
  }

  const filteredAthletes =
    statFilter === 'healthy' ? athletes.filter((a) => a.rosterStatus === 'healthy')
      : statFilter === 'sick' ? athletes.filter((a) => a.rosterStatus === 'sick')
        : statFilter === 'injured' ? athletes.filter((a) => a.rosterStatus === 'injured')
          : athletes

  const filterTitle =
    statFilter === 'healthy' ? t('Healthy')
      : statFilter === 'sick' ? t('Sick')
        : statFilter === 'injured' ? t('Injured')
          : t('All athletes')

  function openFromList(athlete: Athlete) {
    setStatFilter(null)
    setOpenId(athlete.id)
  }

  return (
    <div className="screen">
      <div className="stat-row">
        <div className="stat" onClick={() => setStatFilter('healthy')}>
          <CountUp className="num green" value={stats.healthy} />
          <div className="lbl">{t('healthy')}</div>
        </div>
        <div className="stat" onClick={() => setStatFilter('sick')}>
          <CountUp className="num yellow" value={stats.sick} />
          <div className="lbl">{t('sick')}</div>
        </div>
        <div className="stat" onClick={() => setStatFilter('injured')}>
          <CountUp className="num red" value={stats.injured} />
          <div className="lbl">{t('injured')}</div>
        </div>
      </div>

      {requests.length > 0 && (
        <>
          <div className="sectlabel">{t('Join requests')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
            {requests.map((r) => (
              <div key={r.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px',
                background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14,
              }}>
                <span style={{
                  width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: 'var(--surface2)',
                  border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700, color: 'var(--muted)', overflow: 'hidden',
                }}>
                  {r.photo ? <img src={r.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : r.name.charAt(0).toUpperCase()}
                </span>
                <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{r.name}</div>
                <button
                  onClick={() => decide(r.id, 'decline')}
                  disabled={busyReq === r.id}
                  style={{
                    flexShrink: 0, padding: '7px 11px', borderRadius: 999, fontSize: 11, fontWeight: 800,
                    fontFamily: 'inherit', cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
                    background: 'transparent', border: '1px solid var(--line2)', color: 'var(--muted)',
                    opacity: busyReq === r.id ? 0.6 : 1,
                  }}
                >
                  {t('Decline')}
                </button>
                <button
                  onClick={() => decide(r.id, 'approve')}
                  disabled={busyReq === r.id}
                  style={{
                    flexShrink: 0, padding: '7px 13px', borderRadius: 999, fontSize: 11, fontWeight: 800,
                    fontFamily: 'inherit', cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
                    background: 'var(--green)', border: 'none', color: '#04130A',
                    opacity: busyReq === r.id ? 0.6 : 1,
                  }}
                >
                  {t('Approve')}
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="sectlabel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>{t('Your athletes')}</span>
        <button
          onClick={() => setAdding(true)}
          style={{
            background: 'var(--green)', color: '#04130A', border: 'none',
            borderRadius: 999, padding: '6px 13px', fontFamily: 'inherit',
            fontWeight: 800, fontSize: 11, cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          + {t('Add')}
        </button>
      </div>

      <div className="athlete-list">
        {athletes.map((a) => (
          <div className="athlete" key={a.id} onClick={() => setOpenId(a.id)}>
            <div className="pic" style={a.photo ? { backgroundImage: `url(${a.photo})`, backgroundSize: 'cover', backgroundPosition: 'center', color: 'transparent' } : undefined}>
              {a.initials}
            </div>
            <div className="info">
              <div className="nm">
                {a.name}
                {a.rosterStatus === 'injured' && <span style={{ marginLeft: 7, fontSize: 10, fontWeight: 800, color: 'var(--red)' }}>● {t('INJURED')}</span>}
                {a.rosterStatus === 'sick' && <span style={{ marginLeft: 7, fontSize: 10, fontWeight: 800, color: 'var(--yellow)' }}>● {t('SICK')}</span>}
              </div>
              <div className="meta">{a.hasData ? t(a.note) : t('No check-in yet')}</div>
            </div>
            <LiquidGauge value={a.readiness} max={100} color="var(--green)" decimals={0} fillAlpha={0.58} dark={darkMode} size={44} />
          </div>
        ))}
        {athletes.length === 0 && (
          <div className="empty" style={{ padding: '34px 20px', textAlign: 'center', lineHeight: 1.6 }}>
            {t('No athletes yet.')}<br />
            {t('Tap “+ Add” and search your athletes by username.')}
          </div>
        )}
      </div>

      {statFilter && (
        <AthleteListSheet
          title={filterTitle}
          athletes={filteredAthletes}
          onClose={() => setStatFilter(null)}
          onSelectAthlete={openFromList}
          darkMode={darkMode}
        />
      )}

      {adding && (
        <AddAthleteSheet
          coachId={coachId}
          club={club}
          existingUserIds={athletes.map((a) => a.user_id).filter(Boolean) as string[]}
          onAdded={onRefresh}
          onClose={() => setAdding(false)}
        />
      )}

      {open && (
        <AthleteDetail
          athlete={open}
          onClose={() => setOpenId(null)}
          onOpenChat={onOpenChat}
          metricUnits={metricUnits}
        />
      )}
    </div>
  )
}
