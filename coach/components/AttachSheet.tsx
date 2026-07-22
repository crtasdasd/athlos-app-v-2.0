import type { AttachmentKind } from '../data'
import { useT } from '../i18n'

const options: { kind: AttachmentKind; icon: string; label: string }[] = [
  { kind: 'img', icon: '🖼', label: 'Photo' },
  { kind: 'video', icon: '🎬', label: 'Video' },
  { kind: 'file', icon: '📄', label: 'File' },
  { kind: 'img', icon: '📷', label: 'Camera' },
]

export default function AttachSheet({
  onPick,
  onClose,
}: {
  onPick: (kind: AttachmentKind) => void
  onClose: () => void
}) {
  const t = useT()
  return (
    <>
      <div className="sheet-bg" onClick={onClose} />
      <div className="sheet">
        <div className="grab" />
        <h4>{t('Add to message')}</h4>
        {options.map((o) => (
          <button className="sheet-opt" key={o.label} onClick={() => onPick(o.kind)}>
            <div className="si green">{o.icon}</div>
            <div>{t(o.label)}</div>
          </button>
        ))}
      </div>
    </>
  )
}
