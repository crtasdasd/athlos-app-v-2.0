import { useState } from 'react'
import { initialChat, quickActions, type ChatMessage } from '../data'
import { useT } from '../i18n'

export default function AICoach() {
  const t = useT()
  const [messages, setMessages] = useState<ChatMessage[]>(initialChat)
  const [input, setInput] = useState('')

  function send(text: string) {
    if (!text.trim()) return
    const userMsg: ChatMessage = { id: crypto.randomUUID(), from: 'user', text }
    setMessages((m) => [...m, userMsg])
    setInput('')
    setTimeout(() => {
      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID(), from: 'coach', text: t("Got it — I'll factor that into the team plan.") },
      ])
    }, 600)
  }

  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="ai-wrap">
        {messages.map((m) => (
          <div key={m.id} className={`msg ${m.from === 'coach' ? 'ai' : 'me'}`}>
            {m.text}
          </div>
        ))}

        <div className="suggest">
          {quickActions.map((q) => (
            <span key={q} onClick={() => send(q)}>
              {t(q)}
            </span>
          ))}
        </div>
      </div>

      <form
        className="composer"
        style={{ padding: '10px 0 0', border: 'none' }}
        onSubmit={(e) => {
          e.preventDefault()
          send(input)
        }}
      >
        <input
          className="txt"
          placeholder={t('Ask AI coach…')}
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button className="send" type="submit" aria-label={t('Send')}>
          ↑
        </button>
      </form>
    </div>
  )
}
