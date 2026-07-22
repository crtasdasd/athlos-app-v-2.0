import { useEffect, useRef, useState } from 'react'
import { createClubWithCoach } from '../../lib/api'
import { useT } from '../i18n'
import type { CoachClub } from '../CoachApp'

interface Place { label: string; detail: string }

// Live place suggestions from the free OSM Photon geocoder (no API key).
// Typing "tnt gym" surfaces real gyms/venues with their city + country.
async function searchPlaces(q: string): Promise<Place[]> {
  try {
    const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lang=en`)
    if (!res.ok) return []
    const json = await res.json()
    const seen = new Set<string>()
    return (json.features || [])
      .map((f: any) => {
        const p = f.properties || {}
        const label = p.name || p.street || ''
        const detail = [p.city || p.town || p.village, p.state, p.country].filter(Boolean).join(', ')
        return { label, detail }
      })
      .filter((pl: Place) => {
        if (!pl.label) return false
        const key = `${pl.label}|${pl.detail}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
  } catch { return [] }
}

const field: React.CSSProperties = {
  width: '100%', padding: '14px 16px', boxSizing: 'border-box',
  background: 'var(--surface2)', border: '1px solid var(--line2)',
  borderRadius: 12, color: 'var(--text)', fontFamily: 'inherit',
  fontWeight: 600, fontSize: 14, outline: 'none',
}

const label: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fontWeight: 600,
  letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)',
  display: 'block', margin: '18px 0 8px',
}

// First-login setup for a coach: name + club + where the club is based.
// Creates the club, the coach row, and the club's group chat.
export default function CoachOnboarding({
  userId,
  onDone,
  onLogout,
}: {
  userId: string
  onDone: (cc: CoachClub) => void
  onLogout: () => void
}) {
  const t = useT()
  const [coachName, setCoachName] = useState('')
  const [clubName, setClubName] = useState('')
  const [location, setLocation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Location autocomplete — suggestions appear under the field while typing;
  // picking one fills the field. `picked` suppresses re-searching the choice.
  const [suggestions, setSuggestions] = useState<Place[]>([])
  const picked = useRef(false)
  useEffect(() => {
    if (picked.current) { picked.current = false; return }
    if (location.trim().length < 2) { setSuggestions([]); return }
    let live = true
    const id = setTimeout(async () => {
      const places = await searchPlaces(location)
      if (live) setSuggestions(places)
    }, 350)
    return () => { live = false; clearTimeout(id) }
  }, [location])

  const pickPlace = (pl: Place) => {
    picked.current = true
    setLocation(pl.detail ? `${pl.label}, ${pl.detail}` : pl.label)
    setSuggestions([])
  }

  const submit = async () => {
    if (!coachName.trim() || !clubName.trim()) {
      setError(t('Enter your name and the club name.'))
      return
    }
    setBusy(true)
    setError('')
    try {
      const cc = await createClubWithCoach(userId, coachName, clubName, location)
      onDone(cc as CoachClub)
    } catch (e: any) {
      setError(e?.message || t('Something went wrong — try again.'))
      setBusy(false)
    }
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '48px 26px 40px', display: 'flex', flexDirection: 'column' }}>
      <div className="logo" style={{ fontSize: 17 }}>ATHLOS</div>
      <div className="logo-underline" style={{ maxWidth: 90 }} />
      <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 6 }}>{t('Coach setup')}</div>

      <h1 style={{ fontSize: 26, fontWeight: 800, margin: '28px 0 6px', color: 'var(--text)' }}>
        {t('Set up your club')}
      </h1>
      <p style={{ color: 'var(--muted)', fontSize: 12, lineHeight: 1.55, margin: 0 }}>
        {t('Athletes will find your club by its name — or by yours.')}
      </p>

      <span style={label}>{t('Your name')}</span>
      <input style={field} value={coachName} onChange={(e) => setCoachName(e.target.value)} placeholder="Matej Novak" />

      <span style={label}>{t('Club name')}</span>
      <input style={field} value={clubName} onChange={(e) => setClubName(e.target.value)} placeholder="NK Domžale" />

      <span style={label}>{t('Where is the club based?')}</span>
      <div style={{ position: 'relative' }}>
        <input style={field} value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t('Type your gym or city…')} />
        {suggestions.length > 0 && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 5,
            background: 'var(--surface2)', border: '1px solid var(--line2)',
            borderRadius: 12, overflow: 'hidden', boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
          }}>
            {suggestions.map((pl, i) => (
              <button
                key={`${pl.label}-${i}`}
                onClick={() => pickPlace(pl)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', padding: '11px 14px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  borderBottom: i < suggestions.length - 1 ? '1px solid var(--line)' : 'none',
                  fontFamily: 'inherit', WebkitTapHighlightColor: 'transparent',
                }}
              >
                <span style={{ display: 'block', color: 'var(--text)', fontSize: 12.5, fontWeight: 600 }}>{pl.label}</span>
                {pl.detail && <span style={{ display: 'block', color: 'var(--muted)', fontSize: 10.5, marginTop: 2 }}>{pl.detail}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div style={{ marginTop: 10, padding: '11px 14px', borderRadius: 10, background: 'rgba(248,112,102,0.10)', border: '1px solid rgba(248,112,102,0.35)', color: 'var(--red)', fontSize: 11.5 }}>
          {error}
        </div>
      )}

      <button
        onClick={submit}
        disabled={busy}
        style={{
          marginTop: 17, width: '100%', padding: '15px 16px', borderRadius: 999,
          border: 'none', background: 'var(--green)', color: '#04130A',
          fontFamily: 'inherit', fontWeight: 800, fontSize: 14, cursor: 'pointer',
          opacity: busy ? 0.6 : 1, WebkitTapHighlightColor: 'transparent',
        }}
      >
        {busy ? t('Creating…') : t('Create club')}
      </button>

      <button
        onClick={onLogout}
        style={{ marginTop: 10, background: 'none', border: 'none', color: 'var(--muted)', fontFamily: 'inherit', fontSize: 11.5, cursor: 'pointer' }}
      >
        {t('Log out')}
      </button>
    </div>
  )
}
