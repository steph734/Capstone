import { useEffect, useRef } from 'react'

// ─── Pond scenery: pale teal sky into turquoise water, lily pads, cattails, ripples, a smiling sun ───────────

const Pad = ({ style, w = 150, flower }) => (
  <svg className="ec-pad" style={style} width={w} height={w * 0.34} viewBox="0 0 100 34" aria-hidden="true">
    <ellipse cx="50" cy="20" rx="46" ry="12" fill="#5FC97A" stroke="#3FA85C" strokeWidth="2" />
    <path d="M50 20L86 14" stroke="#3FA85C" strokeWidth="2" />
    {flower && <g transform="translate(46 11)"><circle r="8" fill="#FF8FC2" /><circle r="3.4" fill="#FFD43B" /></g>}
  </svg>
)
const Cattail = ({ style, h = 300 }) => (
  <svg className="ec-cattail" style={style} width={h * 0.13} height={h} viewBox="0 0 26 200" aria-hidden="true">
    <path d="M13 200C11 150 15 100 13 52" stroke="#2F9A52" strokeWidth="5" strokeLinecap="round" fill="none" />
    <path d="M13 150C26 138 28 118 22 100" stroke="#2F9A52" strokeWidth="4" strokeLinecap="round" fill="none" />
    <ellipse cx="13" cy="34" rx="7" ry="26" fill="#8B5A2B" stroke="#6B4220" strokeWidth="2" />
  </svg>
)
const Cloud = ({ style, w = 150 }) => (
  <svg className="ec-cloud" style={style} width={w} height={w * 0.6} viewBox="0 0 100 60" aria-hidden="true">
    <ellipse cx="30" cy="38" rx="26" ry="18" fill="#fff" /><ellipse cx="55" cy="26" rx="23" ry="21" fill="#fff" />
    <ellipse cx="76" cy="40" rx="20" ry="15" fill="#fff" /><rect x="16" y="36" width="68" height="18" rx="9" fill="#fff" />
  </svg>
)

export function EcSky() {
  return (
    <div className="ec-sky" aria-hidden="true">
      <div className="ec-water" />
      <svg className="ec-hills" viewBox="0 0 1440 120" preserveAspectRatio="none"><path d="M0,70 C240,20 480,30 720,60 C960,90 1200,40 1440,56 L1440,120 L0,120 Z" fill="#CFF0E4" /></svg>
      <svg className="ec-sun" width="190" height="190" viewBox="-95 -95 190 190">
        <g stroke="#FFD43B" strokeWidth="9" strokeLinecap="round">
          {Array.from({ length: 12 }, (_, i) => { const a = (i * Math.PI) / 6; return <path key={i} d={`M${Math.cos(a) * 62} ${Math.sin(a) * 62}L${Math.cos(a) * 82} ${Math.sin(a) * 82}`} /> })}
        </g>
        <circle r="50" fill="#FFC82E" /><circle cx="-26" cy="8" r="9" fill="#FF8FA8" opacity=".7" /><circle cx="26" cy="8" r="9" fill="#FF8FA8" opacity=".7" />
        <path d="M-18 6c10 12 26 12 36 0" fill="none" stroke="#C97A00" strokeWidth="4" strokeLinecap="round" />
      </svg>
      <Cloud style={{ right: '6%', top: '3%' }} w={110} />
      <Cloud style={{ right: '14%', top: '17%' }} w={130} />
      {[['8%', '50%', 460, 170], ['72%', '62%', 460, 120], ['20%', '74%', 600, 110], ['48%', '84%', 560, 90]].map(([l, t, w, h], i) => (
        <svg key={i} className="ec-ripple" style={{ left: l, top: t }} width={w} height={h} viewBox="0 0 100 30" preserveAspectRatio="none"><ellipse cx="50" cy="15" rx="49" ry="13" fill="none" stroke="#fff" strokeOpacity=".45" strokeWidth=".6" /></svg>
      ))}
      <Pad style={{ left: '2%', bottom: '4%' }} w={170} />
      <Pad style={{ left: '14%', bottom: '10%' }} w={150} flower />
      <Pad style={{ right: '8%', top: '55%' }} w={170} flower />
      <Pad style={{ right: '6%', top: '75%' }} w={130} />
      <Pad style={{ left: '52%', bottom: '5%' }} w={110} />
      <Cattail style={{ left: '2%', bottom: '-2%' }} h={330} />
      <Cattail style={{ left: '5%', bottom: '-2%' }} h={250} />
      <Cattail style={{ right: '2%', bottom: '-2%' }} h={360} />
      <Cattail style={{ right: '5%', bottom: '-2%' }} h={270} />
    </div>
  )
}

// Modal: white card, 30px radius, dimmed pond behind. Esc closes; Tab stays inside the card.
export function EcModal({ onClose, width = 780, label, className = '', children }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    const prev = document.activeElement
    el?.querySelector('[data-autofocus], button')?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') { onClose?.(); return }
      if (e.key !== 'Tab' || !el) return
      const f = [...el.querySelectorAll('button:not([disabled]), input, [tabindex]:not([tabindex="-1"])')]
      if (!f.length) return
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus() }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); try { prev?.focus?.() } catch { /* ignore */ } }
  }, [onClose])
  return (
    <div className="ec-overlay" role="dialog" aria-modal="true" aria-label={label}>
      <div ref={ref} className={`ec-modal ${className}`} style={{ width: `min(94vw, ${width}px)` }}>{children}</div>
    </div>
  )
}

// ─── Icons (inline SVG, no emoji) ───────────────────────────────────────────────

export function TurtleIcon({ size = 28 }) {
  return (
    <svg width={size} height={size * 0.72} viewBox="0 0 64 46" aria-hidden="true">
      <ellipse cx="18" cy="38" rx="7" ry="5" fill="#5FBF7A" stroke="#2F8F55" strokeWidth="2" /><ellipse cx="42" cy="38" rx="7" ry="5" fill="#5FBF7A" stroke="#2F8F55" strokeWidth="2" />
      <circle cx="54" cy="24" r="8.5" fill="#7ED494" stroke="#2F8F55" strokeWidth="2" /><circle cx="57" cy="22" r="1.8" fill="#1B3B2A" />
      <path d="M6 36C6 14 18 6 31 6C44 6 54 14 54 36z" fill="#34A56A" stroke="#1F7A4A" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M31 6L24 16L31 26L38 16zM24 16L12 18M38 16L50 18M31 26L31 36" fill="none" stroke="#1F7A4A" strokeWidth="1.8" opacity=".7" />
      <path d="M31 6L24 16L31 26L38 16z" fill="#5FD08C" />
    </svg>
  )
}

// The big turtle on the setup card.
export function TurtleHero({ width = 130 }) {
  return (
    <svg width={width} height={width * 0.52} viewBox="0 0 160 84" aria-hidden="true" style={{ display: 'block', margin: '0 auto' }}>
      <ellipse cx="46" cy="72" rx="16" ry="9" fill="#5FBF7A" stroke="#2F8F55" strokeWidth="3" /><ellipse cx="110" cy="72" rx="16" ry="9" fill="#5FBF7A" stroke="#2F8F55" strokeWidth="3" />
      <circle cx="146" cy="44" r="14" fill="#7ED494" stroke="#2F8F55" strokeWidth="3" /><circle cx="151" cy="40" r="2.8" fill="#1B3B2A" />
      <path d="M12 70C12 20 48 6 80 6C112 6 140 20 140 70z" fill="#34A56A" stroke="#1F7A4A" strokeWidth="3.4" strokeLinejoin="round" />
      <path d="M80 6L62 28L80 52L98 28zM62 28L30 34M98 28L130 34M80 52L80 70" fill="none" stroke="#1F7A4A" strokeWidth="2.6" strokeLinejoin="round" opacity=".7" />
      <path d="M80 6L62 28L80 52L98 28z" fill="#5FD08C" />
    </svg>
  )
}

const I = ({ size = 22, children, sw = 2.4 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
)
export const ArrowLeft = (p) => <I {...p}><path d="M19 12H5M11 18l-6-6 6-6" /></I>
export const ArrowRight = (p) => <I {...p}><path d="M5 12h14M13 6l6 6-6 6" /></I>
export const CheckI = (p) => <I {...p} sw={3}><path d="M5 13l4 4L19 7" /></I>
export const Replay = (p) => <I {...p}><path d="M4 12a8 8 0 1 0 3-6.2" /><path d="M4 4v5h5" /></I>
export const Speaker = (p) => <I {...p}><path d="M4 9v6h4l5 4V5L8 9H4Z" /><path d="M17 8a5 5 0 0 1 0 8" /><path d="M19.5 5.5a9 9 0 0 1 0 13" /></I>
export const Mic = (p) => <I {...p}><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></I>
export const Play = (p) => <I {...p}><path d="M8 5.5v13l11-6.5-11-6.5Z" /></I>
export const Home = (p) => <I {...p}><path d="M4 11l8-7 8 7v9H4z" /></I>
export const Info = (p) => <I {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></I>
export const Clock = (p) => <I {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></I>
export const Bars = (p) => <I {...p}><path d="M5 20V10M12 20V4M19 20v-7" /></I>
export const StarI = ({ size = 24, className = '', filled = true }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.6 6.1 20.6l1.3-6.6-4.9-4.6 6.6-.8L12 2.5Z" /></svg>
)
