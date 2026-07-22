import { useState, type ReactElement } from 'react'
import { useT } from '../i18n'

// Shown once after the coach's first login — where everything is and what
// the coach side can do. Per-account, per-device.
const ic = (paths: ReactElement) => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {paths}
  </svg>
)

const SLIDES: { icon: ReactElement; title: string; desc: string }[] = [
  {
    icon: ic(<><path d="M3 11l9-8 9 8M5 10v10h14V10" /></>),
    title: 'Welcome, coach',
    desc: 'Home is your club at a glance: every athlete with a live readiness ring. Tap one for sleep, load, attendance and weight.',
  },
  {
    icon: ic(<><circle cx="11" cy="7" r="4" /><path d="M3 21v-2a4 4 0 014-4h8" /><path d="M19 8v6M16 11h6" /></>),
    title: 'Build your team',
    desc: 'Tap “+ Add” on Home and search athletes by their username — one tap puts them in your club and its chat.',
  },
  {
    icon: ic(<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></>),
    title: 'Team schedule',
    desc: 'The Calendar holds the whole week — trainings, matches, recovery — visible to you and the team.',
  },
  {
    icon: ic(<><path d="M12 3l1.9 5.8L19.7 10l-5.8 1.9L12 17.7l-1.9-5.8L4.3 10l5.8-1.9z" /></>),
    title: 'Your AI assistant',
    desc: 'The round logo button opens the AI — ask who needs rest, get a Wednesday session, analyse the team load.',
  },
  {
    icon: ic(<><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /></>),
    title: 'Club community',
    desc: "Community is your club's space — info, members and the group chat every athlete joins automatically.",
  },
]

export default function CoachWelcome({ onDone }: { onDone: () => void }) {
  const t = useT()
  const [i, setI] = useState(0)
  const last = i === SLIDES.length - 1
  const s = SLIDES[i]

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 30, background: 'var(--bg)',
      display: 'flex', flexDirection: 'column', color: 'var(--text)',
      padding: 'max(24px, env(safe-area-inset-top)) 28px max(24px, env(safe-area-inset-bottom))',
    }}>
      <button
        onClick={onDone}
        style={{ alignSelf: 'flex-end', background: 'none', border: 'none', color: 'var(--muted)', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 6 }}
      >
        {t('Skip')}
      </button>

      <div key={i} className="screen-anim" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <div style={{
          width: 86, height: 86, borderRadius: 19,
          background: 'rgba(0,255,135,0.08)', border: '1px solid rgba(0,255,135,0.22)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18,
        }}>
          {s.icon}
        </div>
        <h1 style={{ fontWeight: 800, fontSize: 21, margin: '0 0 12px', letterSpacing: '-0.02em' }}>{t(s.title)}</h1>
        <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--muted)', margin: 0, maxWidth: 320 }}>{t(s.desc)}</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 15 }}>
        {SLIDES.map((_, d) => (
          <span key={d} style={{
            width: d === i ? 22 : 7, height: 7, borderRadius: 999,
            background: d === i ? 'var(--green)' : 'var(--line2)',
            transition: 'all 0.25s ease',
          }} />
        ))}
      </div>

      <button
        onClick={() => (last ? onDone() : setI(i + 1))}
        style={{
          width: '100%', padding: 16, borderRadius: 999, border: 'none',
          background: 'var(--green)', color: '#04130A', fontFamily: 'inherit',
          fontWeight: 800, fontSize: 14, cursor: 'pointer',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        {last ? t("Let's go") : t('Next')}
      </button>
    </div>
  )
}
