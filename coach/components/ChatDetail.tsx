import { useState } from 'react'
import { chatBackgrounds, COACH_NAME, type AttachmentKind, type ChatBubbleMsg, type Conversation } from '../data'
import { useT } from '../i18n'
import AttachSheet from './AttachSheet'
import ChatBgSheet from './ChatBgSheet'
import ChatBubble from './ChatBubble'

function now() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function ChatDetail({
  conversation,
  initialMessages,
  bgId,
  onChangeBg,
  onClose,
}: {
  conversation: Conversation
  initialMessages: ChatBubbleMsg[]
  bgId: string
  onChangeBg: (id: string) => void
  onClose: () => void
}) {
  const t = useT()
  const [messages, setMessages] = useState(initialMessages)
  const [input, setInput] = useState('')
  const [sheet, setSheet] = useState<'attach' | 'bg' | null>(null)

  const bg = chatBackgrounds.find((b) => b.id === bgId) ?? chatBackgrounds[0]

  function send() {
    const v = input.trim()
    if (!v) return
    setMessages((m) => [...m, { id: `m-${Date.now()}`, me: true, text: v, time: now() }])
    setInput('')
  }

  function addAttachment(kind: AttachmentKind) {
    setMessages((m) => [
      ...m,
      { id: `m-${Date.now()}`, me: true, kind, fileName: 'training_program.pdf', fileSize: '312 KB', time: now() },
    ])
    setSheet(null)
  }

  return (
    <div className="chat-detail">
      <div className="cd-head">
        <button className="back" onClick={onClose}>‹</button>
        <div className={`pic ${conversation.isGroup ? 'group' : ''}`}>{conversation.initials}</div>
        <div className="ti">
          <div className="n">{conversation.name}</div>
          <div className="s">{t(conversation.subtitle)}</div>
        </div>
        <button className="opts" onClick={() => setSheet('bg')}>⋮</button>
      </div>

      <div className="cd-msgs" style={{ background: bg.css }}>
        <div className="sys-note">
          {conversation.isGroup ? (
            <><b>{COACH_NAME}</b> {t('created the group')} <b>{conversation.name}</b></>
          ) : (
            <>{t('You started a conversation with')} <b>{conversation.name}</b></>
          )}
        </div>
        {messages.map((m) => (
          <ChatBubble key={m.id} msg={m} showWho={conversation.isGroup} />
        ))}
      </div>

      <div className="composer">
        <button className="attach" onClick={() => setSheet('attach')}>＋</button>
        <input
          className="txt"
          placeholder={t('Write a message…')}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
        />
        <button className="send" onClick={send}>↑</button>
      </div>

      {sheet === 'attach' && <AttachSheet onPick={addAttachment} onClose={() => setSheet(null)} />}
      {sheet === 'bg' && (
        <ChatBgSheet
          selected={bgId}
          onSelect={(id) => onChangeBg(id)}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  )
}
