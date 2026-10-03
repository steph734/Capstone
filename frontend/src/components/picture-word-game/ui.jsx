import { useCallback, useEffect, useRef, useState } from 'react'

// ─── Sky scene — shared background for every screen of this game ─────────────

export function SkyBackground() {
  return (
    <div className="pwg-scene fixed inset-0 -z-10" aria-hidden="true" style={{
      background: 'linear-gradient(180deg, #4FB3EC 0%, #7CC8F2 55%, #B8E4F8 100%)',
    }}>
      {/* Clouds */}
      <Cloud className="left-[8%] top-[10%]" size={110} dur={9}/>
      <Cloud className="left-[62%] top-[6%]" size={90} dur={8} delay={1.2}/>
      <Cloud className="left-[80%] top-[20%]" size={70} dur={7} delay={.5}/>
      <Cloud className="left-[30%] top-[16%]" size={60} dur={10} delay={2}/>

      {/* Hills */}
      <svg viewBox="0 0 1440 260" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 w-full h-[26vh] min-h-[150px]">
        <path d="M0,120 C180,40 360,40 500,90 C650,145 750,60 900,70 C1080,82 1200,150 1440,110 L1440,260 L0,260 Z" fill="#A6DE84"/>
        <path d="M0,170 C200,120 380,195 560,160 C720,128 880,180 1000,158 C1150,132 1300,195 1440,160 L1440,260 L0,260 Z" fill="#86CE5E"/>
      </svg>
      {FLOWERS.map((f, i) => <Flower key={i} {...f}/>)}
    </div>
  )
}

const FLOWERS = [
  { x: '4%', bottom: '15vh', hue: '#fff' },
  { x: '11%', bottom: '10vh', hue: '#F59E0B' },
  { x: '17%', bottom: '14vh', hue: '#EC4899' },
  { x: '84%', bottom: '11vh', hue: '#F59E0B' },
  { x: '90%', bottom: '17vh', hue: '#fff' },
  { x: '78%', bottom: '9vh', hue: '#EC4899' },
]

function Flower({ x, bottom, hue }) {
  return (
    <div className="absolute" style={{ left: x, bottom }}>
      <svg viewBox="0 0 24 24" width={20} height={20}>
        <g fill={hue}>
          <circle cx="12" cy="6" r="4"/><circle cx="18" cy="12" r="4"/>
          <circle cx="12" cy="18" r="4"/><circle cx="6" cy="12" r="4"/>
        </g>
        <circle cx="12" cy="12" r="4" fill="#ffd93d"/>
      </svg>
    </div>
  )
}

function Cloud({ className = '', size = 100, delay = 0, dur = 8 }) {
  return (
    <div className={`absolute pwg-cloud ${className}`} style={{ animationDuration: `${dur}s`, animationDelay: `${delay}s` }}>
      <svg viewBox="0 0 100 60" width={size} height={size * 0.6}>
        <ellipse cx="30" cy="38" rx="26" ry="18" fill="#fff"/>
        <ellipse cx="55" cy="26" rx="23" ry="21" fill="#fff"/>
        <ellipse cx="76" cy="40" rx="20" ry="15" fill="#fff"/>
        <rect x="16" y="36" width="68" height="18" rx="9" fill="#fff"/>
      </svg>
    </div>
  )
}

// ─── Buttons ───────────────────────────────────────────────────────────────

// Primary button — the accent colour with a soft shadow in its darker tone
// (the accent/shadow pair is unchanged; the depth is a light glow, not a
// thick block) and a small press-down on click.
export function PressableButton({ as: As = 'button', color = '#F59E0B', shadow = '#C97A00', textColor = '#fff', className = '', style = {}, children, ...rest }) {
  return (
    <As
      className={`pwg-pressable inline-flex items-center justify-center gap-2 rounded-2xl font-extrabold transition-transform active:translate-y-[2px] focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6] focus-visible:outline-offset-2 ${className}`}
      style={{ background: color, color: textColor, boxShadow: `0 4px 10px ${shadow}55`, fontFamily: "'Baloo 2', system-ui, sans-serif", ...style }}
      {...rest}
    >
      {children}
    </As>
  )
}

export function GhostButton({ className = '', children, ...rest }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-[#E4DFCE] bg-white font-bold text-[#5A5670] transition-colors hover:bg-[#FBF8EF] focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6] focus-visible:outline-offset-2 ${className}`}
      style={{ fontFamily: "'Baloo 2', system-ui, sans-serif" }}
      {...rest}
    >
      {children}
    </button>
  )
}

// ─── Modal shell ─────────────────────────────────────────────────────────────

export function ModalShell({ onClose, children, maxWidth = 'max-w-[520px]', label }) {
  const ref = useRef(null)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-5"
      style={{ background: 'rgba(30,60,100,0.45)', backdropFilter: 'blur(6px)' }}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}
    >
      <div
        ref={ref}
        className={`pwg-modal-in relative w-full ${maxWidth} max-h-[92vh] overflow-y-auto rounded-[28px] bg-[#FFFDF8] p-6 shadow-xl sm:p-8`}
        style={{ fontFamily: "'Atkinson Hyperlegible', system-ui, sans-serif" }}
      >
        {children}
      </div>
    </div>
  )
}

export function CloseButton({ onClose, label = 'Close' }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label={label}
      className="absolute right-5 top-5 flex h-11 w-11 items-center justify-center rounded-full bg-[#F1EEDF] text-[#5A5670] transition-colors hover:bg-[#E7E2CC] focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6]"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
    </button>
  )
}

// ─── Read-aloud hook — plain window.speechSynthesis, decoupled from any
// avatar's own voice pipeline so it can be toggled off independently ───────

export function useSpeech(enabled = true) {
  const [speaking, setSpeaking] = useState(false)
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window

  const speak = useCallback((text, { onEnd } = {}) => {
    if (!enabled || !supported || !text) { onEnd?.(); return }
    try {
      window.speechSynthesis.cancel()
      const utter = new SpeechSynthesisUtterance(text)
      utter.rate = 0.8
      utter.pitch = 1.15
      utter.onstart = () => setSpeaking(true)
      utter.onend = () => { setSpeaking(false); onEnd?.() }
      utter.onerror = () => { setSpeaking(false); onEnd?.() }
      window.speechSynthesis.speak(utter)
    } catch {
      onEnd?.()
    }
  }, [enabled, supported])

  const cancel = useCallback(() => {
    if (supported) { try { window.speechSynthesis.cancel() } catch { /* no-op */ } }
    setSpeaking(false)
  }, [supported])

  useEffect(() => () => cancel(), [cancel])

  return { speak, cancel, speaking }
}
