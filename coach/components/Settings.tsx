import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useT } from '../i18n'
import { supabase, hasSupabase } from '../../lib/supabase'
import { updateCoachName, updateClubDetails, deleteAccount } from '../../lib/api'

interface Club { id: string; name: string; location: string | null; address?: string | null; privacy?: string; conversation_id: string | null }

// Same visual system as the athlete's Settings screen (src/screens/ScreenSettings.jsx):
// centered avatar header, rounded icon-tile rows grouped into cards, a segmented
// theme control, and standalone red cards for Log out / Delete account.
export default function Settings({
  darkMode,
  onToggleDarkMode,
  metricUnits,
  onToggleMetricUnits,
  onLogout,
  club,
  onClubChange,
  userId,
  coachName,
  onCoachNameChange,
}: {
  darkMode: boolean
  onToggleDarkMode: () => void
  metricUnits: boolean
  onToggleMetricUnits: () => void
  onLogout: () => void
  club: Club
  onClubChange: (patch: Partial<Club>) => void
  userId?: string
  coachName?: string
  onCoachNameChange?: (name: string) => void
}) {
  const t = useT()
  const [name, setName] = useState(coachName || 'Coach')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [notifOn, setNotifOn] = useState(true)
  const [aiSuggest, setAiSuggest] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!hasSupabase || !supabase) return
    ;(async () => {
      const { data: u } = await supabase.auth.getUser()
      if (!u?.user) return
      const { data } = await supabase.from('coaches').select('photo').eq('id', u.user.id).maybeSingle()
      if (data?.photo) setPhotoUrl(data.photo)
    })().catch(() => {})
  }, [])

  async function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoUrl(URL.createObjectURL(file))
    if (!hasSupabase || !supabase) return
    try {
      const { data: u } = await supabase.auth.getUser()
      const uid = u?.user?.id
      if (!uid) return
      const path = `${uid}/avatar.jpg`
      await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type })
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path)
      const url = `${pub.publicUrl}?t=${Date.now()}`
      setPhotoUrl(url)
      await supabase.from('coaches').update({ photo: url }).eq('id', uid)
    } catch { /* keep local preview on failure */ }
  }

  async function editName() {
    const v = window.prompt(t('Edit username:'), name)
    if (!v || v.trim() === name) return
    try {
      const saved = userId ? await updateCoachName(userId, v) : v.trim()
      setName(saved)
      onCoachNameChange?.(saved)
    } catch (e: any) {
      window.alert(e?.message || t('Something went wrong — try again.'))
    }
  }

  async function editClubName() {
    const v = window.prompt(t('Edit club name:'), club.name)
    if (!v || v.trim() === club.name) return
    try {
      await updateClubDetails(club.id, { name: v })
      onClubChange({ name: v.trim() })
    } catch (e: any) {
      window.alert(e?.message || t('Something went wrong — try again.'))
    }
  }

  async function editClubLocation() {
    const v = window.prompt(t('Edit club location:'), club.location || '')
    if (v == null) return
    try {
      await updateClubDetails(club.id, { location: v })
      onClubChange({ location: v.trim() || null })
    } catch (e: any) {
      window.alert(e?.message || t('Something went wrong — try again.'))
    }
  }

  // Public: an athlete who finds the club joins instantly. Private: joining
  // creates a pending request the coach approves/declines (see the "Join
  // requests" card on Home).
  async function toggleClubPrivacy() {
    const next = club.privacy === 'private' ? 'public' : 'private'
    try {
      await updateClubDetails(club.id, { privacy: next })
      onClubChange({ privacy: next } as Partial<Club>)
    } catch (e: any) {
      window.alert(e?.message || t('Something went wrong — try again.'))
    }
  }

  // Optional, precise street address — separate from the loose "Location"
  // label above. Never required; an athlete uses it to find the gym on a map.
  async function editClubAddress() {
    const v = window.prompt(t('Edit gym address (street, city, country):'), club.address || '')
    if (v == null) return
    try {
      await updateClubDetails(club.id, { address: v })
      onClubChange({ address: v.trim() || null })
    } catch (e: any) {
      window.alert(e?.message || t('Something went wrong — try again.'))
    }
  }

  function changePassword() {
    const next = window.prompt(t('Enter a new password:'))
    if (!next) return
    const confirmation = window.prompt(t('Confirm new password:'))
    if (confirmation !== next) {
      window.alert(t("Passwords don't match — try again."))
      return
    }
    window.alert(t('Password updated.'))
  }

  function logout() {
    if (window.confirm(t('Log out of ATHLOS?'))) onLogout()
  }

  async function deleteMyAccount() {
    const word = 'DELETE'
    const v = window.prompt(t(`This permanently deletes your club, your athletes' membership and all your data. Type ${word} to confirm:`))
    if (v !== word) return
    try {
      await deleteAccount()
      onLogout()
    } catch (e: any) {
      window.alert(e?.message || t('Something went wrong — try again.'))
    }
  }

  const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden', marginBottom: 9 }
  const iconTile: React.CSSProperties = { width: 36, height: 36, borderRadius: 11, background: 'var(--surface2)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }
  const sv = (c: string) => ({ width: 19, height: 19, viewBox: '0 0 24 24', fill: 'none', stroke: c, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const })

  const IC = {
    club:   (c: string) => (<svg {...sv(c)}><path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" /></svg>),
    pin:    (c: string) => (<svg {...sv(c)}><path d="M12 21s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z" /><circle cx="12" cy="9" r="2.5" /></svg>),
    bell:   (c: string) => (<svg {...sv(c)}><path d="M6 8a6 6 0 0112 0c0 5 2 6 2 6H4s2-1 2-6" /><path d="M10 20a2 2 0 004 0" /></svg>),
    ruler:  (c: string) => (<svg {...sv(c)}><rect x="3" y="8" width="18" height="8" rx="1.5" /><path d="M7 8v3M11 8v3M15 8v3" /></svg>),
    spark:  (c: string) => (<svg {...sv(c)}><path d="M12 3l1.9 5.8L19.7 10l-5.8 1.9L12 17.7l-1.9-5.8L4.3 10l5.8-1.9z" /></svg>),
    lock:   (c: string) => (<svg {...sv(c)}><rect x="4" y="11" width="16" height="9" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /></svg>),
    logout: (c: string) => (<svg {...sv(c)}><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></svg>),
    trash:  (c: string) => (<svg {...sv(c)}><path d="M3 6h18" /><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /></svg>),
    moon:   (c: string) => (<svg {...sv(c)}><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" /></svg>),
    sun:    (c: string) => (<svg {...sv(c)}><circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" /></svg>),
  }
  const chevron = (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="var(--muted2)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
  )

  function Row({ icon, title, subtitle, onClick, danger, first, accessory }: {
    icon: (c: string) => JSX.Element
    title: string
    subtitle?: string
    onClick?: () => void
    danger?: boolean
    first?: boolean
    accessory?: JSX.Element | null
  }) {
    const iconCol = danger ? 'var(--red)' : 'var(--text2, var(--text))'
    return (
      <button
        onClick={onClick}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 9,
          padding: '13px 15px', background: 'none', cursor: onClick ? 'pointer' : 'default',
          border: 'none', borderTop: first ? 'none' : '1px solid var(--line)',
          textAlign: 'left', fontFamily: 'inherit', WebkitTapHighlightColor: 'transparent',
        }}
      >
        <span style={iconTile}>{icon(iconCol)}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontWeight: 600, fontSize: 14, color: danger ? 'var(--red)' : 'var(--text)' }}>{title}</span>
          {subtitle && <span style={{ display: 'block', fontSize: 11.5, color: 'var(--muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{subtitle}</span>}
        </span>
        {accessory !== undefined ? accessory : chevron}
      </button>
    )
  }

  function ToggleRow({ icon, title, subtitle, on, onClick, first }: {
    icon: (c: string) => JSX.Element
    title: string
    subtitle?: string
    on: boolean
    onClick: () => void
    first?: boolean
  }) {
    return (
      <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '13px 15px', borderTop: first ? 'none' : '1px solid var(--line)' }}>
        <span style={iconTile}>{icon('var(--text)')}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{title}</span>
          {subtitle && <span style={{ display: 'block', fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{subtitle}</span>}
        </span>
        <button className={`toggle ${on ? 'on' : ''}`} onClick={onClick} aria-pressed={on}>
          <span className="toggle-knob" />
        </button>
      </div>
    )
  }

  return (
    <div className="screen" style={{ padding: '10px 4px 36px' }}>
      <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />

      {/* Profile header — matches the athlete screen's centered avatar block */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '14px 0 26px' }}>
        <div style={{ position: 'relative', width: 112, height: 112, marginBottom: 11 }}>
          <button
            onClick={() => photoInputRef.current?.click()}
            style={{
              width: 112, height: 112, borderRadius: '50%', border: '1px solid var(--line2)',
              background: photoUrl ? `url(${photoUrl}) center/cover` : 'var(--surface2)',
              padding: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text)', fontWeight: 800, fontSize: 44, cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
            }}
          >
            {!photoUrl && (name || 'C').charAt(0).toUpperCase()}
          </button>
          <button
            onClick={() => photoInputRef.current?.click()}
            aria-label={t('Change photo')}
            style={{
              position: 'absolute', right: 4, bottom: 4, width: 28, height: 28, borderRadius: '50%',
              background: 'var(--surface2)', border: '2px solid var(--bg)', color: 'var(--text)',
              padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg>
          </button>
        </div>
        <button onClick={editName} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 20, color: 'var(--text)', letterSpacing: '-0.01em', fontFamily: 'inherit', WebkitTapHighlightColor: 'transparent' }}>
          {name} <span style={{ color: 'var(--muted)', fontSize: 14 }}>✎</span>
        </button>
        <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>{t('Head coach')} · {club.name}</div>
      </div>

      {/* Club — the one section that differs from the athlete: club identity, not personal */}
      <div style={card}>
        {Row({ icon: IC.club, title: t('Club name'), subtitle: club.name, onClick: editClubName, first: true })}
        {Row({ icon: IC.pin, title: t('Location'), subtitle: club.location || t('Not set'), onClick: editClubLocation })}
        {Row({ icon: IC.pin, title: t('Gym address'), subtitle: club.address || t('Optional — not set'), onClick: editClubAddress })}
        {Row({
          icon: IC.lock,
          title: t('Club privacy'),
          subtitle: club.privacy === 'private'
            ? t('Private — athletes must request to join')
            : t('Public — athletes can join instantly'),
          onClick: toggleClubPrivacy,
          accessory: (
            <span style={{
              fontSize: 10.5, fontWeight: 800, padding: '4px 10px', borderRadius: 999,
              background: club.privacy === 'private' ? 'var(--surface2)' : 'rgba(0,255,135,0.14)',
              color: club.privacy === 'private' ? 'var(--muted)' : 'var(--green)',
              border: `1px solid ${club.privacy === 'private' ? 'var(--line)' : 'transparent'}`,
            }}>
              {club.privacy === 'private' ? t('PRIVATE') : t('PUBLIC')}
            </span>
          ),
        })}
      </div>

      {/* Theme — identical segmented control to the athlete screen */}
      <div style={card}>
        <div style={{ padding: 15 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 9 }}>
            <span style={iconTile}>{(darkMode ? IC.moon : IC.sun)('var(--text)')}</span>
            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{t('Theme')}</span>
          </div>
          <div role="group" aria-label={t('Theme')} style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 13, background: 'var(--surface2)', border: '1px solid var(--line)' }}>
            {([['dark', IC.moon, t('Dark')], ['light', IC.sun, t('Light')]] as const).map(([mode, ico, lbl]) => {
              const active = (mode === 'dark') === darkMode
              return (
                <button
                  key={mode}
                  onClick={() => { if (active) return; onToggleDarkMode() }}
                  aria-pressed={active}
                  style={{
                    flex: 1, padding: 10, borderRadius: 9, cursor: 'pointer', border: 'none',
                    background: active ? 'var(--green)' : 'transparent',
                    color: active ? '#04130A' : 'var(--muted)',
                    fontWeight: active ? 700 : 600, fontSize: 13, fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    WebkitTapHighlightColor: 'transparent', transition: 'background 0.18s ease, color 0.18s ease',
                  }}
                >
                  {ico(active ? '#04130A' : 'var(--muted)')}
                  {lbl}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Preferences */}
      <div style={card}>
        <ToggleRow icon={IC.bell} title={t('Notifications')} subtitle={t('Readiness alerts & messages')} on={notifOn} onClick={() => setNotifOn((v) => !v)} first />
        <ToggleRow icon={IC.ruler} title={t('Metric units')} subtitle="kg, km, °C" on={metricUnits} onClick={onToggleMetricUnits} />
      </div>

      {/* AI Coach */}
      <div style={card}>
        <ToggleRow icon={IC.spark} title={t('Proactive suggestions')} subtitle={t('Let AI Coach message you first')} on={aiSuggest} onClick={() => setAiSuggest((v) => !v)} first />
      </div>

      {/* Account */}
      <div style={card}>
        {Row({ icon: IC.lock, title: t('Password'), onClick: changePassword, first: true })}
      </div>

      {/* Log out — standalone red card, matches the athlete screen */}
      <div style={card}>
        {Row({ icon: IC.logout, title: t('Log out'), danger: true, first: true, onClick: logout, accessory: null })}
      </div>

      {/* Delete account — standalone red card */}
      <div style={{ ...card, marginBottom: 14 }}>
        {Row({ icon: IC.trash, title: t('Delete account'), danger: true, first: true, onClick: deleteMyAccount })}
      </div>

      <p style={{ textAlign: 'center', color: 'var(--muted2, var(--muted))', fontSize: 12, marginTop: 6 }}>ATHLOS v0.6 · © 2026</p>
    </div>
  )
}
