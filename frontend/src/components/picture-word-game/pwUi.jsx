import { useCallback, useEffect, useRef, useState } from 'react'
import { speakPao, stopPaoVoice } from '../../utils/paoVoice'

// Sky scene for the redesigned Picture Word screens: smiling sun, clouds that never sit behind text (they are in
// the corners), two hills and flowers. Fills the viewport; the game stage is laid on top of it.
const Cloud = ({ style, w = 150 }) => (
  <svg className="pw-cloud" style={style} width={w} height={w * 0.6} viewBox="0 0 100 60" aria-hidden="true">
    <ellipse cx="30" cy="38" rx="26" ry="18" fill="#fff" /><ellipse cx="55" cy="26" rx="23" ry="21" fill="#fff" />
    <ellipse cx="76" cy="40" rx="20" ry="15" fill="#fff" /><rect x="16" y="36" width="68" height="18" rx="9" fill="#fff" />
  </svg>
)

const FLOWERS = [
  { l: '8%', b: '9%', c: '#fff' }, { l: '26%', b: '4%', c: '#EC4899' }, { l: '76%', b: '16%', c: '#F59E0B' },
  { l: '86%', b: '6%', c: '#fff' }, { l: '95%', b: '3%', c: '#EC4899' },
]

export function PwSky({ dim = false }) {
  return (
    <div className="pw-sky" aria-hidden="true">
      <svg className="pw-sun" width="190" height="190" viewBox="-95 -95 190 190">
        <g stroke="#FFD43B" strokeWidth="9" strokeLinecap="round">
          {Array.from({ length: 12 }, (_, i) => { const a = (i * Math.PI) / 6; return <path key={i} d={`M${Math.cos(a) * 62} ${Math.sin(a) * 62}L${Math.cos(a) * 82} ${Math.sin(a) * 82}`} /> })}
        </g>
        <circle r="50" fill="#FFC82E" /><circle cx="-26" cy="8" r="9" fill="#FF8FA8" opacity=".7" /><circle cx="26" cy="8" r="9" fill="#FF8FA8" opacity=".7" />
        <path d="M-18 6c10 12 26 12 36 0" fill="none" stroke="#C97A00" strokeWidth="4" strokeLinecap="round" />
      </svg>
      <Cloud style={{ right: '6%', top: '3%' }} w={160} />
      <Cloud style={{ left: '4%', top: '50%' }} w={120} />
      <Cloud style={{ right: '3%', top: '70%' }} w={110} />
      <svg className="pw-hills" viewBox="0 0 1440 300" preserveAspectRatio="none">
        <path d="M0,150 C200,60 380,60 540,110 C700,165 820,80 980,90 C1160,100 1280,170 1440,120 L1440,300 L0,300 Z" fill="#9BE07A" />
        <path d="M0,205 C220,150 400,230 600,196 C780,164 940,222 1080,196 C1230,170 1340,226 1440,196 L1440,300 L0,300 Z" fill="#62CF58" />
      </svg>
      {FLOWERS.map((f, i) => (
        <svg key={i} className="pw-flower" style={{ left: f.l, bottom: f.b }} width="34" height="34" viewBox="0 0 24 24">
          <g fill={f.c}><circle cx="12" cy="6" r="4" /><circle cx="18" cy="12" r="4" /><circle cx="12" cy="18" r="4" /><circle cx="6" cy="12" r="4" /></g>
          <circle cx="12" cy="12" r="4" fill="#FFD93D" />
        </svg>
      ))}
      {dim && <div className="pw-dim" />}
    </div>
  )
}

// Modal: white card, 30px radius, dimmed sky behind. Esc closes; Tab stays inside the card.
export function PwModal({ onClose, width = 720, label, children, className = '' }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    const prev = document.activeElement
    el?.querySelector('[data-autofocus], button')?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') { onClose?.(); return }
      if (e.key !== 'Tab' || !el) return
      const f = [...el.querySelectorAll('button:not([disabled]), [href], input, [tabindex]:not([tabindex="-1"])')]
      if (!f.length) return
      const first = f[0]
      const last = f[f.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); try { prev?.focus?.() } catch { /* ignore */ } }
  }, [onClose])
  return (
    <div className="pw-overlay" role="dialog" aria-modal="true" aria-label={label} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}>
      <div ref={ref} className={`pw-modal ${className}`} style={{ width: `min(94vw, ${width}px)` }}>{children}</div>
    </div>
  )
}

// Read aloud through Pao's voice (ElevenLabs, with the browser voice as a fallback). `listen: true` marks audio the
// child is meant to listen to (the word, the question) so Pao can wear the headphones while it plays.
export function usePwSpeech(enabled = true, { onListening } = {}) {
  const [speaking, setSpeaking] = useState(false)
  const cb = useRef(onListening)
  cb.current = onListening
  const speak = useCallback((text, { listen = false, onEnd } = {}) => {
    if (!enabled || !text) { onEnd?.(); return }
    if (!listen) cb.current?.(false) // this line replaces any word that was playing, so the headphones come off
    speakPao(text, {
      rate: 0.8,
      pitch: 1.15,
      onStart: () => { setSpeaking(true); if (listen) cb.current?.(true) },
      onEnd: () => { setSpeaking(false); if (listen) cb.current?.(false); onEnd?.() },
    })
  }, [enabled])
  const cancel = useCallback(() => { stopPaoVoice(); setSpeaking(false); cb.current?.(false) }, [])
  useEffect(() => () => stopPaoVoice(), [])
  return { speak, cancel, speaking }
}
