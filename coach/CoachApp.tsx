import { useCallback, useEffect, useState } from 'react'
import './App.css'
import { LangContext, translate, type Lang } from './i18n'
import type { Athlete } from './data'
import { getMyCoachClub, listClubAthletes, getRosterStatuses } from '../lib/api'
import Dashboard from './components/Dashboard'
import AICoach from './components/AICoach'
import Calendar from './components/Calendar'
import Community from './components/Community'
import Settings from './components/Settings'
import CoachOnboarding from './components/CoachOnboarding'
import CoachWelcome from './components/CoachWelcome'
import BottomNav, { type Tab } from './components/BottomNav'

const subtitleKey: Record<Tab, string> = {
  home: 'coach',
  calendar: 'Team schedule',
  coach: 'AI Coach',
  chat: 'Community',
  settings: 'Settings',
}

export interface CoachClub {
  coachName: string
  role: string
  club: { id: string; name: string; location: string | null; conversation_id: string | null }
}

// Map a DB athletes row onto the UI Athlete shape. `hasData` is real
// (readiness column actually populated); `rosterStatus` is filled in
// separately below from real injury/sick reports, never guessed here.
// The old code defaulted a never-checked-in athlete to readiness 70 /
// status "ready" / weight 75 — that's a fabricated "everything's fine"
// reading for someone the coach has no data on at all. 0/null is honest.
function toUiAthlete(r: any): Athlete & { user_id?: string; photo?: string | null; hasData: boolean; rosterStatus: 'healthy' | 'sick' | 'injured' | 'unknown' } {
  const hasData = r.readiness != null
  return {
    id: r.id,
    initials: r.initials || '?',
    name: r.name,
    username: r.username || '',
    note: r.note || (hasData ? '' : 'No check-in yet'),
    readiness: hasData ? r.readiness : 0,
    status: (r.status as Athlete['status']) || 'tired',
    weightKg: r.weight_kg != null ? Number(r.weight_kg) : 75,
    isPrivate: !!r.is_private,
    user_id: r.user_id || undefined,
    photo: r.photo || null,
    hasData,
    rosterStatus: hasData ? 'healthy' : 'unknown', // sick/injured overlaid after fetch
  }
}

// Coach experience, mounted by the main app when the logged-in profile has
// role "coach". Auth/logout owned by the host app. All data is real: the
// coach's club, its athletes, and the club chat live in Supabase.
export default function CoachApp({
  user,
  onLogout,
  lang = 'en',
}: {
  user?: { id: string } | null
  onLogout?: () => void
  lang?: Lang
}) {
  const [tab, setTab] = useState<Tab>('home')
  const [darkMode, setDarkMode] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : true
  )
  const [metricUnits, setMetricUnits] = useState(true)

  const [loading, setLoading] = useState(true)
  const [coachClub, setCoachClub] = useState<CoachClub | null>(null)
  const [athletes, setAthletes] = useState<ReturnType<typeof toUiAthlete>[]>([])

  // First-login welcome tour — once per coach account per device.
  const welcomeKey = `athlos:welcome:coach:${user?.id || 'local'}`
  const [showWelcome, setShowWelcome] = useState(false)
  const dismissWelcome = () => {
    try { localStorage.setItem(welcomeKey, '1') } catch { /* ignore */ }
    setShowWelcome(false)
  }

  const refreshAthletes = useCallback(async (clubId: string) => {
    const rows = await listClubAthletes(clubId)
    const uiAthletes = rows.map(toUiAthlete)
    const userIds = uiAthletes.map((a) => a.user_id).filter(Boolean) as string[]
    const statuses = await getRosterStatuses(userIds)
    setAthletes(uiAthletes.map((a) => (
      a.user_id && statuses[a.user_id] ? { ...a, rosterStatus: statuses[a.user_id] as 'sick' | 'injured' } : a
    )))
  }, [])

  useEffect(() => {
    let live = true
    ;(async () => {
      if (!user?.id) { setLoading(false); return }
      const cc = await getMyCoachClub(user.id)
      if (!live) return
      setCoachClub(cc)
      if (cc?.club?.id) await refreshAthletes(cc.club.id)
      if (cc) {
        try { if (!localStorage.getItem(`athlos:welcome:coach:${user.id}`)) setShowWelcome(true) } catch { /* ignore */ }
      }
      setLoading(false)
    })()
    return () => { live = false }
  }, [user?.id, refreshAthletes])

  const clubName = coachClub?.club?.name || 'ATHLOS'

  return (
    <LangContext.Provider value={lang}>
      <div className={`phone ${darkMode ? '' : 'light'}`}>
        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
            …
          </div>
        ) : !coachClub ? (
          <CoachOnboarding
            userId={user?.id || ''}
            onDone={(cc) => { setCoachClub(cc); setAthletes([]); setShowWelcome(true) }}
            onLogout={() => onLogout?.()}
          />
        ) : showWelcome ? (
          // Blocks the dashboard from mounting underneath the tour, so its
          // CountUp stat tiles don't finish animating out of sight.
          <CoachWelcome onDone={dismissWelcome} />
        ) : (
          <>
            <div className="topbar">
              <div>
                <div className="logo">ATHLOS</div>
                <div className="logo-underline" />
                <div className="sub">{clubName} · {translate(lang, subtitleKey[tab])}</div>
              </div>
              <div className="topbar-avatar">{(coachClub.coachName || 'C').charAt(0).toUpperCase()}</div>
            </div>
            <div className="phone-content" style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 12px))' }}>
              <div className="screen-anim" key={tab}>
                {tab === 'home' && (
                  <Dashboard
                    athletes={athletes}
                    coachId={user?.id || ''}
                    club={coachClub.club}
                    onRefresh={() => refreshAthletes(coachClub.club.id)}
                    onOpenChat={() => setTab('chat')}
                    metricUnits={metricUnits}
                    darkMode={darkMode}
                  />
                )}
                {tab === 'calendar' && <Calendar teamName={clubName} />}
                {tab === 'coach' && <AICoach />}
                {tab === 'chat' && (
                  <Community
                    user={user}
                    club={coachClub.club}
                    coachName={coachClub.coachName}
                    athletes={athletes}
                    metricUnits={metricUnits}
                  />
                )}
                {tab === 'settings' && (
                  <Settings
                    darkMode={darkMode}
                    onToggleDarkMode={() => setDarkMode((d) => !d)}
                    metricUnits={metricUnits}
                    onToggleMetricUnits={() => setMetricUnits((m) => !m)}
                    onLogout={() => onLogout?.()}
                    club={coachClub.club}
                    onClubChange={(patch) => setCoachClub((cc) => (cc ? { ...cc, club: { ...cc.club, ...patch } } : cc))}
                    userId={user?.id}
                    coachName={coachClub.coachName}
                    onCoachNameChange={(n) => setCoachClub((cc) => (cc ? { ...cc, coachName: n } : cc))}
                  />
                )}
              </div>
            </div>
            <BottomNav active={tab} onChange={setTab} dark={darkMode} />
          </>
        )}
      </div>
    </LangContext.Provider>
  )
}
