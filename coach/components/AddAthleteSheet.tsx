import { useEffect, useState } from 'react'
import { searchUsers, addAthleteToClub } from '../../lib/api'
import { useT } from '../i18n'

interface FoundUser { user_id: string; name: string; initials: string; photo: string | null }

// Coach adds an athlete: type the athlete's username (display name), pick the
// match, done — the athlete lands in the club and its group chat.
export default function AddAthleteSheet({
  coachId,
  club,
  existingUserIds,
  onAdded,
  onClose,
}: {
  coachId: string
  club: { id: string; conversation_id: string | null }
  existingUserIds: string[]
  onAdded: () => void
  onClose: () => void
}) {
  const t = useT()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<FoundUser[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let live = true
    const id = setTimeout(async () => {
      const rows = await searchUsers(q)
      if (live) setResults(rows.filter((r: FoundUser) => r.user_id !== coachId))
    }, 300)
    return () => { live = false; clearTimeout(id) }
  }, [q, coachId])

  const add = async (u: FoundUser) => {
    setBusyId(u.user_id)
    setError('')
    try {
      await addAthleteToClub(coachId, club, u)
      onAdded()
      onClose()
    } catch (e: any) {
      setError(e?.message || t('Something went wrong — try again.'))
      setBusyId(null)
    }
  }

  return (
    <div className="chat-detail">
      <div className="cd-head">
        <button className="back" onClick={onClose}>‹</button>
        <div className="ti">
          <div className="n">{t('Add athlete')}</div>
          <div className="s">{t('Search by username')}</div>
        </div>
      </div>

      <div className="ad-body">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('Athlete username…')}
          style={{
            width: '100%', boxSizing: 'border-box', padding: '13px 16px',
            borderRadius: 12, background: 'var(--surface2)', border: '1px solid var(--line2)',
            color: 'var(--text)', fontFamily: 'inherit', fontSize: 13.5, outline: 'none',
            marginBottom: 10,
          }}
        />

        {error && (
          <div style={{ marginBottom: 9, padding: '10px 13px', borderRadius: 10, background: 'rgba(248,112,102,0.10)', border: '1px solid rgba(248,112,102,0.35)', color: 'var(--red)', fontSize: 11.5 }}>
            {error}
          </div>
        )}

        <div className="athlete-list">
          {results.map((u) => {
            const already = existingUserIds.includes(u.user_id)
            return (
              <div className="athlete" key={u.user_id} style={{ cursor: already ? 'default' : 'pointer' }}
                onClick={() => !already && busyId === null && add(u)}>
                <div className="pic" style={u.photo ? { backgroundImage: `url(${u.photo})`, backgroundSize: 'cover', backgroundPosition: 'center', color: 'transparent' } : undefined}>
                  {u.initials}
                </div>
                <div className="info">
                  <div className="nm">{u.name}</div>
                  <div className="meta">{already ? t('Already in your club') : t('Tap to add to the club')}</div>
                </div>
                {!already && (
                  <span style={{ color: 'var(--green)', fontWeight: 800, fontSize: 17 }}>
                    {busyId === u.user_id ? '…' : '+'}
                  </span>
                )}
              </div>
            )
          })}
          {q.trim().length >= 2 && results.length === 0 && (
            <div className="empty">{t('No athlete found with that username.')}</div>
          )}
          {q.trim().length < 2 && (
            <div className="empty">{t('Type at least 2 characters.')}</div>
          )}
        </div>
      </div>
    </div>
  )
}
