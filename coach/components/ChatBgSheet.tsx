import { chatBackgrounds } from '../data'
import { useT } from '../i18n'

export default function ChatBgSheet({
  selected,
  onSelect,
  onClose,
}: {
  selected: string
  onSelect: (id: string) => void
  onClose: () => void
}) {
  const t = useT()
  return (
    <>
      <div className="sheet-bg" onClick={onClose} />
      <div className="sheet">
        <div className="grab" />
        <h4>{t('Conversation background')}</h4>
        <div className="bg-grid">
          {chatBackgrounds.map((b) => (
            <div
              key={b.id}
              className={`bg-sw ${selected === b.id ? 'sel' : ''}`}
              style={{ background: b.css }}
              onClick={() => onSelect(b.id)}
            >
              {b.label && <div className="x">{b.label}</div>}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
