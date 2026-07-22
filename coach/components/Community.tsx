import { useEffect, useRef, useState } from 'react'
import { ensureClubConversation, listMessages, sendMessage, getPublicProfiles, listCommunities, joinCommunity, leaveCommunity } from '../../lib/api'
import { useT } from '../i18n'
import type { Athlete } from '../data'
import AthleteListSheet from './AthleteListSheet'
import AthleteDetail from './AthleteDetail'

interface PublicCommunity {
  id: string
  name: string
  description: string | null
  flag: string | null
  image_url: string | null
  members: number
  myRole: string | null
}

// Public communities — same real data (public.communities) as the athlete
// app's Community → Public tab, so a coach can browse/join them too, just
// styled with the coach app's own cards instead of porting the athlete's
// whole hero/trending layout.
function PublicCommunities({ userId }: { userId?: string | null }) {
  const t = useT()
  const [list, setList] = useState<PublicCommunity[]>([])
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const reload = () => { listCommunities(userId).then(setList).catch(() => {}) }
  useEffect(() => { reload() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [userId])

  const filtered = list.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase()))

  const toggleJoin = async (c: PublicCommunity) => {
    if (!userId || busy) return
    setBusy(c.id)
    try {
      if (c.myRole) await leaveCommunity(c.id, userId)
      else await joinCommunity(c.id, userId)
      reload()
    } finally { setBusy(null) }
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <input
        value={q} onChange={(e) => setQ(e.target.value)}
        placeholder={t('Search communities…')}
        style={{
          width: '100%', boxSizing: 'border-box', padding: '11px 15px', borderRadius: 12, marginBottom: 10,
          background: 'var(--surface2)', border: '1px solid var(--line2)', color: 'var(--text)',
          fontFamily: 'inherit', fontSize: 12.5, outline: 'none',
        }}
      />
      {filtered.length === 0 && (
        <div style={{ color: 'var(--muted)', fontSize: 11.5, textAlign: 'center', marginTop: 19 }}>
          {t('No communities found.')}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map((c) => (
          <div key={c.id} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
            background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14,
          }}>
            <span style={{
              width: 38, height: 38, borderRadius: '50%', flexShrink: 0, background: 'var(--surface2)',
              border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: c.flag ? 18 : 14, fontWeight: 700, color: 'var(--muted)', overflow: 'hidden',
            }}>
              {c.image_url ? <img src={c.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : c.flag || (c.name || '?').charAt(0).toUpperCase()}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{c.name}</div>
              <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 2 }}>
                {c.members} {c.members === 1 ? t('member') : t('members')}
              </div>
            </div>
            <button
              onClick={() => toggleJoin(c)}
              disabled={busy === c.id}
              style={{
                flexShrink: 0, padding: '7px 13px', borderRadius: 999, fontSize: 11, fontWeight: 800,
                fontFamily: 'inherit', cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
                border: c.myRole ? '1px solid var(--line2)' : 'none',
                background: c.myRole ? 'transparent' : 'var(--green)',
                color: c.myRole ? 'var(--text2, var(--text))' : '#04130A',
                opacity: busy === c.id ? 0.6 : 1,
              }}
            >
              {c.myRole ? t('Joined') : t('Join')}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

interface Msg {
  id: string
  sender_id: string
  type: string
  content: string | null
  created_at: string
}

type UiAthlete = Athlete & { user_id?: string; photo?: string | null }

const timeOf = (iso: string) => {
  const d = new Date(iso)
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

// The club community: info card (tap it → member roster → tap a member →
// the same full stats view as Home) + the club group chat.
export default function Community({
  user,
  club,
  coachName,
  athletes,
  metricUnits,
}: {
  user?: { id: string } | null
  club: { id: string; name: string; location: string | null; conversation_id: string | null }
  coachName: string
  athletes: UiAthlete[]
  metricUnits: boolean
}) {
  const t = useT()
  const [tab, setTab] = useState<'club' | 'public'>('club')
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [names, setNames] = useState<Record<string, { name: string; photo: string | null }>>({})
  const [text, setText] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  const [showRoster, setShowRoster] = useState(false)
  const [openAthleteId, setOpenAthleteId] = useState<string | null>(null)
  const openAthlete = athletes.find((a) => a.id === openAthleteId)

  const memberIds = athletes.map((a) => a.user_id).filter(Boolean) as string[]

  // The club chat: use the stored id when the column exists, otherwise the
  // coach creates/finds the club's group conversation and syncs its members.
  const [convId, setConvId] = useState<string | null>(club.conversation_id)
  useEffect(() => {
    if (club.conversation_id || !user?.id || String(club.id).startsWith('local-')) return
    let live = true
    ensureClubConversation(user.id, club.name, memberIds).then((id: string | null) => {
      if (live && id) setConvId(id)
    })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [club.id, user?.id, memberIds.join(',')])

  // Poll the club chat every 4 s — simple and reliable for the demo.
  useEffect(() => {
    if (!convId) return
    let live = true
    const load = async () => {
      const rows: Msg[] = await listMessages(convId, 80)
      if (!live) return
      setMsgs(rows)
      const ids = [...new Set(rows.map((m) => m.sender_id))]
      if (ids.length) {
        const pubs = await getPublicProfiles(ids)
        if (live) setNames((prev) => ({ ...prev, ...pubs }))
      }
    }
    load()
    const iv = setInterval(load, 4000)
    return () => { live = false; clearInterval(iv) }
  }, [convId])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs.length])

  const send = async () => {
    const body = text.trim()
    if (!body || !convId || !user?.id) return
    setText('')
    const msg = await sendMessage(convId, user.id, 'text', body)
    setMsgs((prev) => [...prev, msg])
  }

  const memberCount = athletes.length

  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Club / Public — same split as the athlete app's Community tab */}
      <div style={{ position: 'relative', display: 'flex', padding: 4, borderRadius: 999, background: 'var(--surface2)', marginBottom: 10, flexShrink: 0 }}>
        <div aria-hidden="true" style={{
          position: 'absolute', top: 4, bottom: 4, left: 4, width: 'calc((100% - 8px) / 2)',
          borderRadius: 999, background: 'var(--green)',
          transform: tab === 'public' ? 'translateX(100%)' : 'translateX(0)',
          transition: 'transform 0.32s cubic-bezier(0.22,1,0.36,1)',
        }} />
        {(['club', 'public'] as const).map((k) => (
          <button key={k} onClick={() => setTab(k)} style={{
            position: 'relative', zIndex: 1, flex: 1, border: 'none', background: 'none',
            padding: '8px 0', borderRadius: 999, cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
            fontFamily: 'inherit', fontWeight: 700, fontSize: 13,
            color: tab === k ? '#04130A' : 'var(--muted)', transition: 'color 0.25s',
          }}>
            {k === 'club' ? t('Club') : t('Public')}
          </button>
        ))}
      </div>

      {tab === 'public' ? (
        <PublicCommunities userId={user?.id} />
      ) : (
        <>
          {/* Club info card — tap to see the member roster */}
          <button
            onClick={() => setShowRoster(true)}
            style={{
              background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 15,
              padding: '16px 18px', marginBottom: 10, flexShrink: 0, textAlign: 'left',
              cursor: 'pointer', width: '100%', fontFamily: 'inherit', WebkitTapHighlightColor: 'transparent',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--text)' }}>{club.name}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                  {club.location ? `${club.location} · ` : ''}{memberCount} {memberCount === 1 ? t('athlete') : t('athletes')} · {coachName}
                </div>
              </div>
              <span style={{ color: 'var(--muted)', fontSize: 15.5 }}>›</span>
            </div>
          </button>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 10 }}>
            {msgs.length === 0 && (
              <div style={{ color: 'var(--muted)', fontSize: 11.5, textAlign: 'center', marginTop: 19 }}>
                {t('No messages yet — say hello to your club.')}
              </div>
            )}
            {msgs.map((m) => {
              const mine = m.sender_id === user?.id
              return (
                <div key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '78%' }}>
                  {!mine && (
                    <div style={{ fontSize: 9, color: 'var(--muted)', margin: '0 0 3px 10px' }}>
                      {names[m.sender_id]?.name || '…'}
                    </div>
                  )}
                  <div style={{
                    padding: '10px 13px', borderRadius: 14, fontSize: 12.5, lineHeight: 1.45,
                    background: mine ? 'var(--green)' : 'var(--surface2)',
                    color: mine ? '#04130A' : 'var(--text)',
                    border: mine ? 'none' : '1px solid var(--line)',
                  }}>
                    {m.content}
                    <span style={{ display: 'block', fontSize: 8.5, opacity: 0.6, marginTop: 3, textAlign: 'right' }}>{timeOf(m.created_at)}</span>
                  </div>
                </div>
              )
            })}
            <div ref={endRef} />
          </div>

          {/* Composer */}
          <div style={{ display: 'flex', gap: 6, paddingTop: 10, flexShrink: 0 }}>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder={t('Message the club…')}
              style={{
                flex: 1, padding: '12px 15px', borderRadius: 999,
                background: 'var(--surface2)', border: '1px solid var(--line2)',
                color: 'var(--text)', fontFamily: 'inherit', fontSize: 12.5, outline: 'none',
              }}
            />
            <button
              onClick={send}
              aria-label={t('Send')}
              style={{
                width: 44, height: 44, borderRadius: '50%', border: 'none', flexShrink: 0,
                background: 'var(--green)', color: '#04130A', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            </button>
          </div>
        </>
      )}

      {/* Member roster */}
      {showRoster && (
        <AthleteListSheet
          title={t('Club members')}
          athletes={athletes}
          onClose={() => setShowRoster(false)}
          onSelectAthlete={(a) => { setOpenAthleteId(a.id); }}
        />
      )}

      {/* Full stats — same view as Home */}
      {openAthlete && (
        <AthleteDetail
          athlete={openAthlete}
          onClose={() => setOpenAthleteId(null)}
          onOpenChat={() => setOpenAthleteId(null)}
          metricUnits={metricUnits}
        />
      )}
    </div>
  )
}
