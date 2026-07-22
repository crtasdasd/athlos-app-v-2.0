import type { ReactElement } from 'react'
import { useT } from '../i18n'
import LiquidGlassNav, { GlassSurface } from '../../components/LiquidGlass'

export type Tab = 'home' | 'calendar' | 'coach' | 'chat' | 'settings'

const tabs: { id: Tab; label: string; icon: (color: string) => ReactElement }[] = [
  {
    id: 'home',
    label: 'Home',
    icon: (color) => (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 11l9-8 9 8M5 10v10h14V10" />
      </svg>
    ),
  },
  {
    id: 'calendar',
    label: 'Calendar',
    icon: (color) => (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M3 9h18M8 2v4M16 2v4" />
      </svg>
    ),
  },
  {
    id: 'chat',
    label: 'Community',
    icon: (color) => (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: (color) => (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    ),
  },
]

// The ATHLOS mark — the arrow-A logo, drawn in brand green.
function AthlosMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12.6 2.2 L9.43 9.56 L11.69 10.91 L12.6 8.8 L15.3 15 L18 15 Z" fill="var(--green)" />
      <path d="M8.82 10.99 L11.07 12.35 L7.78 20 L4.95 20 Z" fill="var(--green)" />
      <path d="M23.2 18.7 L5.5 7.2 L5.5 9.0 Z" fill="var(--green)" />
      <path d="M1.6 5.1 L7.2 4.3 L5.9 6.9 L5.3 9.9 Z" fill="var(--green)" />
    </svg>
  )
}

// Same floating liquid-glass material as the athlete app (see
// components/LiquidGlass.jsx) — real backdrop blur/refraction over the
// scrolling content behind it, not a flat --surface bar. The coach and
// athlete apps are two different feature sets on the exact same material.
export default function BottomNav({ active, onChange, dark = true }: { active: Tab; onChange: (t: Tab) => void; dark?: boolean }) {
  const t = useT()
  const aiOn = active === 'coach'
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 2,
      padding: '8px 14px max(calc(env(safe-area-inset-bottom, 0px) + 10px), 12px)',
      pointerEvents: 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, pointerEvents: 'auto' }}>
        <LiquidGlassNav
          tabs={tabs}
          active={active}
          dark={dark}
          onSelect={(id: string) => onChange(id as Tab)}
          label={(n: (typeof tabs)[number]) => t(n.label)}
          renderIcon={(n: (typeof tabs)[number], on: boolean) => n.icon(
            on
              ? (dark ? '#FFFFFF' : '#0F1729')
              : (dark ? 'rgba(255,255,255,0.46)' : 'rgba(16,24,40,0.45)')
          )}
        />
        <GlassSurface
          dark={dark}
          radius="50%"
          style={{
            flex: '0 0 auto', width: 58, height: 58,
            boxShadow: aiOn ? '0 0 16px rgba(0,255,135,0.30)' : 'none',
            transition: 'box-shadow 0.2s',
          }}
        >
          <button
            onClick={() => onChange('coach')}
            aria-label={t('AI Coach')}
            style={{
              width: '100%', height: '100%', borderRadius: '50%',
              background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <AthlosMark size={26} />
          </button>
        </GlassSurface>
      </div>
    </div>
  )
}
