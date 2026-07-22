import type { ChatBubbleMsg } from '../data'
import { useT } from '../i18n'

const imgPlaceholder =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="140"><rect width="200" height="140" fill="#1a1f1a"/><text x="100" y="75" fill="#00FF87" font-size="13" text-anchor="middle" font-family="sans-serif">📷 photo</text></svg>'
  )

export default function ChatBubble({ msg, showWho }: { msg: ChatBubbleMsg; showWho: boolean }) {
  const t = useT()
  const cls = ['bub', msg.me ? 'me' : 'them', msg.kind ?? ''].filter(Boolean).join(' ')

  return (
    <div className={cls}>
      {showWho && msg.from && !msg.me && <div className="who">{msg.from}</div>}

      {msg.kind === 'img' && <img src={imgPlaceholder} alt={t('attachment')} />}

      {msg.kind === 'video' && (
        <div className="thumb">
          <div className="play">▶</div>
        </div>
      )}

      {msg.kind === 'file' && (
        <>
          <div className="fic">📄</div>
          <div className="fi">
            <div className="fn">{msg.fileName ?? 'file.pdf'}</div>
            <div className="fs">{msg.fileSize ?? '248 KB'}</div>
          </div>
        </>
      )}

      {!msg.kind && msg.text}

      <div className="tm">{msg.time}</div>
    </div>
  )
}
