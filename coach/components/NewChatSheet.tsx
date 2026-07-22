import { useState } from 'react'
import { athletes, getOrCreateAthleteConversation, type Athlete } from '../data'
import { useT } from '../i18n'

export type FriendStatus = 'pending' | 'accepted'

export default function NewChatSheet({
  friendStatus,
  onSendFriendRequest,
  onSelect,
  onClose,
}: {
  friendStatus: Record<string, FriendStatus>
  onSendFriendRequest: (athleteId: string) => void
  onSelect: (conversationId: string) => void
  onClose: () => void
}) {
  const t = useT()
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase().replace(/^@/, '')
  const results = athletes.filter(
    (a) => !q || a.name.toLowerCase().includes(q) || a.username.toLowerCase().includes(q)
  )

  function canChat(athlete: Athlete) {
    return !athlete.isPrivate || friendStatus[athlete.id] === 'accepted'
  }

  function pick(athlete: Athlete) {
    if (!canChat(athlete)) return
    onSelect(getOrCreateAthleteConversation(athlete))
    onClose()
  }

  return (
    <>
      <div className="sheet-bg" onClick={onClose} />
      <div className="sheet">
        <div className="grab" />
        <h4>{t('New conversation')}</h4>
        <input
          className="chat-search"
          autoFocus
          placeholder={t('Search by name or @username…')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="new-chat-results">
          {results.map((a) => {
            const status = friendStatus[a.id]
            const locked = a.isPrivate && status !== 'accepted'

            return (
              <div className="new-chat-row" key={a.id}>
                <button className="sheet-opt" onClick={() => pick(a)} disabled={locked}>
                  <div className="pic">{a.initials}</div>
                  <div className="new-chat-info">
                    <div className="new-chat-name">
                      {a.name}
                      {a.isPrivate && <span className="lock">🔒</span>}
                    </div>
                    <div className="new-chat-user">@{a.username}</div>
                  </div>
                </button>
                {locked && status !== 'pending' && (
                  <button className="add-friend-btn" onClick={() => onSendFriendRequest(a.id)}>
                    + {t('Add friend')}
                  </button>
                )}
                {locked && status === 'pending' && (
                  <span className="pending-label">{t('Request sent…')}</span>
                )}
              </div>
            )
          })}
          {results.length === 0 && <div className="empty">{t('No matching user.')}</div>}
        </div>
      </div>
    </>
  )
}
