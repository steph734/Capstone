import { CATALOG_BY_TYPE } from './model'

// How ONE element looks. The editor canvas and the player both render through
// this component, so what the Super Admin sees while building is what the
// patient gets. `mode` is 'edit' (hint / sound / animation chips are visible)
// or 'play' (they are hidden until they are needed). It fills its parent box;
// the parent positions and sizes it.
const GREEN = '#234C40'
const box = { width: '100%', height: '100%', boxSizing: 'border-box' }
const center = { display: 'flex', alignItems: 'center', justifyContent: 'center' }

export default function ElementView({ el, mode = 'edit', status = {} }) {
  const p = el.props
  const { w, h } = el
  const small = Math.min(w, h)

  switch (el.type) {
    case 'image_card': {
      const labelH = p.label ? Math.max(22, Math.round(h * 0.17)) : 0
      return (
        <div style={{ ...box, ...center, flexDirection: 'column', background: '#fff', borderRadius: Math.round(small * 0.12), border: `${status.ring ? 5 : 3}px solid ${status.ring || '#e6ebe8'}`, boxShadow: '0 4px 12px rgba(0,0,0,.12)', overflow: 'hidden', userSelect: 'none' }}>
          <div style={{ ...center, flex: 1, width: '100%', minHeight: 0 }}>
            {p.imageUrl
              ? <img src={p.imageUrl} alt={mode === 'play' ? p.alt : ''} draggable={false} style={{ maxWidth: '88%', maxHeight: '88%', objectFit: 'contain', pointerEvents: 'none' }} />
              : <span aria-hidden="true" style={{ fontSize: Math.round((small - labelH) * 0.55), lineHeight: 1 }}>{p.emoji || '🖼️'}</span>}
          </div>
          {p.label && <div style={{ height: labelH, fontSize: Math.round(labelH * 0.62), fontWeight: 800, color: '#1f3d36', paddingBottom: 4, textAlign: 'center', lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '96%' }}>{p.label}</div>}
        </div>
      )
    }
    case 'drop_slot':
      return (
        <div style={{ ...box, ...center, flexDirection: 'column', borderRadius: Math.round(small * 0.12), border: `4px dashed ${status.highlight ? '#16a34a' : '#d0a85a'}`, background: status.highlight ? 'rgba(22,163,74,.14)' : (p.bg && p.bg !== '#ffffff' ? p.bg : 'rgba(255,255,255,.45)'), color: '#a47a2a', fontWeight: 900, fontSize: Math.round(small * (p.label ? 0.16 : 0.34)), userSelect: 'none', animation: status.highlight ? 'gbPulse 1s ease-in-out infinite' : undefined }}>
          {p.label || p.slot || '?'}
          {mode === 'edit' && p.label && p.slot && <span style={{ fontSize: 14, fontWeight: 700, opacity: 0.7 }}>slot {p.slot}</span>}
        </div>
      )
    case 'text':
      return <div style={{ ...box, ...center, textAlign: 'center', fontSize: p.size, color: p.textColor, fontWeight: p.weight === 'bold' ? 800 : 500, lineHeight: 1.15, overflow: 'hidden', userSelect: 'none', whiteSpace: 'pre-wrap' }}>{p.text}</div>
    case 'voice_prompt':
      return <div style={{ ...box, ...center, borderRadius: '50%', background: GREEN, color: '#fff', fontSize: Math.round(small * 0.46), boxShadow: '0 4px 10px rgba(0,0,0,.2)', userSelect: 'none' }} aria-label="Play voice prompt" role="img">🔊</div>
    case 'speak_answer':
      return <div style={{ ...box, ...center, borderRadius: '50%', background: status.listening ? '#dc2626' : '#F59E0B', color: '#fff', fontSize: Math.round(small * 0.46), boxShadow: '0 4px 10px rgba(0,0,0,.2)', userSelect: 'none', animation: status.listening ? 'gbPulse 1s ease-in-out infinite' : undefined }} role="img" aria-label="Speak your answer">🎤</div>
    case 'button':
      return <div style={{ ...box, ...center, borderRadius: 999, background: GREEN, color: '#fff', fontWeight: 800, fontSize: Math.round(h * 0.4), userSelect: 'none', boxShadow: '0 3px 8px rgba(0,0,0,.18)' }}>{p.label || 'Button'}</div>
    case 'timer': {
      const t = status.timeLeft ?? p.seconds
      return <div style={{ ...box, ...center, borderRadius: 999, background: 'rgba(255,255,255,.85)', border: '2px solid #e6ebe8', color: '#1f3d36', fontWeight: 800, fontSize: Math.round(h * 0.5), userSelect: 'none' }}>⏱ {Math.floor(t / 60)}:{String(Math.max(0, t) % 60).padStart(2, '0')}</div>
    }
    case 'star_reward': {
      const earned = status.stars ?? 2
      return <div style={{ ...box, ...center, gap: 4, fontSize: Math.round(h * 0.78), userSelect: 'none' }} aria-label={`${earned} of 3 stars`}>{[1, 2, 3].map((n) => <span key={n} style={{ opacity: n <= earned ? 1 : 0.28, filter: n <= earned ? 'none' : 'grayscale(1)' }}>⭐</span>)}</div>
    }
    case 'pao_helper':
      return (
        <div style={{ ...box, display: 'flex', alignItems: 'center', gap: 10, userSelect: 'none' }}>
          <span style={{ fontSize: Math.round(h * 0.7), lineHeight: 1 }} aria-hidden="true">🐼</span>
          {(status.message ?? p.message) && <span style={{ background: '#fff', borderRadius: 18, padding: '8px 14px', fontWeight: 800, color: '#1f3d36', fontSize: Math.round(h * 0.22), boxShadow: '0 3px 8px rgba(0,0,0,.12)' }}>{status.message ?? p.message}</span>}
        </div>
      )
    case 'hint':
      if (mode === 'play' && !status.hintOn) return null
      return <div style={{ ...box, ...center, borderRadius: 16, background: '#FFF7CC', border: '2px solid #F3D284', color: '#7a4b06', fontWeight: 800, fontSize: Math.round(h * 0.3), padding: 8, textAlign: 'center', userSelect: 'none' }}>💡 {p.text}</div>
    case 'sound_effect':
    case 'animation':
      if (mode === 'play') return null
      return <div style={{ ...box, ...center, borderRadius: 12, background: '#eef6f2', border: '2px dashed #9ec5b3', color: '#234C40', fontWeight: 800, fontSize: 15, userSelect: 'none' }}>{CATALOG_BY_TYPE[el.type].icon} {el.type === 'sound_effect' ? `Sound: ${p.sound}` : `Animation: ${p.animation}`}</div>
    default:
      return null
  }
}

export const builderKeyframes = `
@keyframes gbPulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }
@keyframes gbShake { 0%,100% { transform: translateX(0); } 20%,60% { transform: translateX(-10px); } 40%,80% { transform: translateX(10px); } }
@keyframes gbBounceIn { 0% { transform: scale(.5); opacity: 0; } 60% { transform: scale(1.12); opacity: 1; } 100% { transform: scale(1); } }
@keyframes gbFadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes gbConfetti { 0% { transform: translateY(-20px) rotate(0); opacity: 1; } 100% { transform: translateY(520px) rotate(540deg); opacity: 0; } }
`
