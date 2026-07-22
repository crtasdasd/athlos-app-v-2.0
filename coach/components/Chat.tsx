import { useState } from 'react'
import { conversationMessages, conversations } from '../data'
import { useT } from '../i18n'
import ChatDetail from './ChatDetail'
import NewChatSheet, { type FriendStatus } from './NewChatSheet'

export default function Chat({
  openId,
  onOpenChange,
}: {
  openId: string | null
  onOpenChange: (id: string | null) => void
}) {
  const t = useT()
  const [chatBg, setChatBg] = useState<Record<string, string>>({})
  const [showNewChat, setShowNewChat] = useState(false)
  const [search, setSearch] = useState('')
  const [friendStatus, setFriendStatus] = useState<Record<string, FriendStatus>>({})

  const open = conversations.find((c) => c.id === openId)
  const filteredConversations = conversations.filter((c) =>
    c.name.toLowerCase().includes(search.trim().toLowerCase())
  )

  function sendFriendRequest(athleteId: string) {
    setFriendStatus((s) => ({ ...s, [athleteId]: 'pending' }))
    setTimeout(() => {
      setFriendStatus((s) => ({ ...s, [athleteId]: 'accepted' }))
    }, 3000)
  }

  return (
    <div className="screen">
      <input
        className="chat-search"
        placeholder={t('Search conversations…')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {filteredConversations.map((c) => (
        <div className="conv" key={c.id} onClick={() => onOpenChange(c.id)}>
          <div className={`pic ${c.isGroup ? 'group' : ''}`}>{c.initials}</div>
          <div className="info">
            <div className="nm">
              {c.name} <span className="t">{t(c.time)}</span>
            </div>
            <div className="last">{t(c.preview)}</div>
          </div>
          {c.unread > 0 && <div className="unread">{c.unread}</div>}
        </div>
      ))}
      {filteredConversations.length === 0 && <div className="empty">{t('No conversations found.')}</div>}

      <button className="new-group" title={t('New conversation')} onClick={() => setShowNewChat(true)}>
        +
      </button>

      {open && (
        <ChatDetail
          conversation={open}
          initialMessages={conversationMessages[open.id] ?? []}
          bgId={chatBg[open.id] ?? 'default'}
          onChangeBg={(id) => setChatBg((b) => ({ ...b, [open.id]: id }))}
          onClose={() => onOpenChange(null)}
        />
      )}

      {showNewChat && (
        <NewChatSheet
          friendStatus={friendStatus}
          onSendFriendRequest={sendFriendRequest}
          onSelect={onOpenChange}
          onClose={() => setShowNewChat(false)}
        />
      )}
    </div>
  )
}
