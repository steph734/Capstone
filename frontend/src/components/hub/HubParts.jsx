import { useEffect, useState } from 'react'

// Shared bits for the hub and the Badge Case: line icons, the medal, the
// scenery, and the fixed Back / Online chips. No emojis anywhere.

const PATHS = {
  back: <><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></>,
  flame: <path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 .3 1.4 1 2 2 2-.5-3 .3-5.5 1-8z" />,
  gamepad: <><rect x="2" y="7" width="20" height="11" rx="5" /><path d="M7 10.5v4M5 12.5h4M15.5 11.5h.01M18 13.5h.01" /></>,
  play: <path d="M7 4l13 8-13 8z" />,
  star: <path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.2 6.5 20.2l1-6.2L3 9.6l6.2-.9z" />,
  trophy: <><path d="M8 4h8v5a4 4 0 0 1-8 0z" /><path d="M8 6H4v2a4 4 0 0 0 4 4M16 6h4v2a4 4 0 0 1-4 4M12 13v4M8 21h8M10 17h4" /></>,
  shirt: <path d="M8 4L3 8l3 3 2-1v10h8V10l2 1 3-3-5-4a4 4 0 0 1-8 0z" />,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  chevronR: <path d="M9 5l7 7-7 7" />,
  chevronL: <path d="M15 5l-7 7 7 7" />,
  eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5" /></>,
  ear: <path d="M7 9a5 5 0 0 1 10 0c0 3-3 3.5-3 6a2.5 2.5 0 0 1-5 0M10 9a2 2 0 0 1 4 0" />,
  brain: <><path d="M12 5v14" /><path d="M12 6a3 3 0 0 0-5.5-1A3 3 0 0 0 4 9a3 3 0 0 0 1 5 3 3 0 0 0 5 3" /><path d="M12 6a3 3 0 0 1 5.5-1A3 3 0 0 1 20 9a3 3 0 0 1-1 5 3 3 0 0 1-5 3" /></>,
  coin: <><circle cx="12" cy="12" r="9" /><path d="M14.5 9a3 3 0 0 0-5 1.5c0 3 5 1.5 5 4.5a3 3 0 0 1-5 1.5M12 6.5v11" /></>,
  music: <><path d="M9 18V6l11-2v12" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="17.5" cy="16" r="2.5" /></>,
  shield: <><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M9 12l2 2 4-4" /></>,
  question: <><path d="M9 9a3 3 0 1 1 4.5 2.6c-1 .6-1.5 1.2-1.5 2.4" /><path d="M12 17.5h.01" /></>,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></>,
  bolt: <path d="M13 2L4 14h7l-1 8 9-12h-7z" />,
  palette: <><path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 1.5-2-.6-1.2 0-2.5 1.5-2.5H17a4 4 0 0 0 4-4c0-5-4-9.5-9-9.5z" /><path d="M7.5 11h.01M10 7.5h.01M15 8h.01" /></>,
  book: <><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M4 19V5" /></>,
  basket: <><path d="M5 10h14l-1.5 9h-11z" /><path d="M9 10l3-6 3 6" /></>,
  puzzle: <path d="M10 4a2 2 0 1 1 4 0v2h4v4h-2a2 2 0 1 0 0 4h2v4H6v-4a2 2 0 1 0 0-4V6h4z" />,
}

export function Icon({ name, size = 20, stroke = 2.4, fill = false, className, style }) {
  const p = PATHS[name] || PATHS.star
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke={fill ? 'none' : 'currentColor'}
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} style={style}>{p}</svg>
  )
}

// Badge symbol names in the DB (art.symbol) -> our icon set.
const SYMBOL_TO_ICON = { star: 'star', basket: 'basket', book: 'book', brain: 'brain', ear: 'ear', eye: 'eye', sun: 'sun', coin: 'coin', music: 'music', shield: 'shield', target: 'target', bolt: 'bolt', palette: 'palette', flame: 'flame', puzzle: 'puzzle', trophy: 'trophy' }
export const badgeIcon = (symbol) => SYMBOL_TO_ICON[symbol] || 'star'

let medalSeq = 0
// Gold (earned) or grey (locked / secret) medal with ribbon.
export function Medal({ icon = 'star', state = 'gold', size = 84, secret = false }) {
  const [id] = useState(() => `m${medalSeq++}`)
  const gold = state === 'gold'
  const c1 = gold ? '#FFE58F' : '#E6EAF0'
  const c2 = gold ? '#F2A91B' : '#BCC4D0'
  const ink = gold ? '#7A4B00' : '#8A97AD'
  return (
    <div style={{ position: 'relative', width: size, height: size * 1.15, flex: 'none' }}>
      <svg width={size} height={size * 1.15} viewBox="0 0 100 115" aria-hidden="true">
        <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={c1} /><stop offset="1" stopColor={c2} /></linearGradient></defs>
        <path d="M30 70l-10 40 18-9 8 10 10-36z" fill={gold ? '#E5484D' : '#CBD2DC'} />
        <path d="M70 70l10 40-18-9-8 10-10-36z" fill={gold ? '#3B82F6' : '#D6DCE6'} />
        <circle cx="50" cy="45" r="38" fill={`url(#${id})`} />
        <circle cx="50" cy="45" r="30" fill="none" stroke={gold ? '#fff' : '#fff'} strokeOpacity=".7" strokeWidth="2" strokeDasharray="3 4" />
        {gold && <><path d="M86 14l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#fff" /><path d="M10 22l1.5 3.5 3.5 1.5-3.5 1.5L10 32l-1.5-3.5L5 27l3.5-1.5z" fill="#FFD3E6" /></>}
      </svg>
      <div style={{ position: 'absolute', left: 0, top: 0, width: size, height: size * 0.9, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ink }}>
        <Icon name={secret ? 'question' : icon} size={size * 0.36} stroke={2.2} />
      </div>
      {!gold && (
        <span style={{ position: 'absolute', right: size * 0.1, top: size * 0.62, width: size * 0.26, height: size * 0.26, borderRadius: '50%', background: '#5B6B88', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="lock" size={size * 0.14} stroke={3} />
        </span>
      )}
    </div>
  )
}

export function Scenery() {
  return (
    <div className="hb-scene" aria-hidden="true">
      <svg className="hb-sun" width="190" height="190" viewBox="-95 -95 190 190">
        {Array.from({ length: 12 }, (_, i) => (
          <rect key={i} x="-4" y="-92" width="8" height="26" rx="4" fill="#FFD04A" transform={`rotate(${i * 30})`} />
        ))}
        <circle r="56" fill="#FFC93C" />
        <circle cx="-30" cy="12" r="9" fill="#FF9F80" opacity=".7" /><circle cx="30" cy="12" r="9" fill="#FF9F80" opacity=".7" />
        <path d="M-18 14q18 14 36 0" stroke="#E5902B" strokeWidth="5" fill="none" strokeLinecap="round" />
      </svg>
      {[['6%', '30%', 100, 0], ['78%', '5%', 140, 3], ['88%', '18%', 90, 6]].map(([l, t, w, d], i) => (
        <svg key={i} className="hb-cloud" style={{ left: l, top: t, animationDelay: `${d}s` }} width={w} height={w * 0.5} viewBox="0 0 100 50">
          <path d="M20 44a14 14 0 0 1 2-28 18 18 0 0 1 34-4 15 15 0 0 1 24 12 12 12 0 0 1-2 20z" fill="#fff" />
        </svg>
      ))}
      <svg className="hb-hill" viewBox="0 0 1000 300" preserveAspectRatio="none">
        <path d="M0 120C200 60 380 40 560 110S860 120 1000 60V300H0z" fill="#8FDB6B" />
        <path d="M0 200C220 130 420 150 620 190S880 170 1000 130V300H0z" fill="#5FCF55" />
      </svg>
      {[['10%', '86%', '#fff'], ['90%', '90%', '#fff'], ['38%', '93%', '#FF8FB8'], ['96%', '95%', '#FF8FB8']].map(([l, t, c], i) => (
        <svg key={i} className="hb-flower" style={{ left: l, top: t }} width="36" height="36" viewBox="-18 -18 36 36">
          {Array.from({ length: 5 }, (_, k) => <circle key={k} cx="0" cy="-9" r="7" fill={c} transform={`rotate(${k * 72})`} />)}
          <circle r="5" fill="#FFD04A" />
        </svg>
      ))}
    </div>
  )
}

export function TopChips({ onBack }) {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true); const off = () => setOnline(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  return (
    <>
      <button type="button" className="hb-back" onClick={onBack}><Icon name="back" size={20} /> Back</button>
      <div className={`hb-online ${online ? '' : 'off'}`} role="status"><i /> {online ? 'Online' : 'Offline'}</div>
    </>
  )
}

// MMM d, yyyy in Asia/Manila.
export function formatManila(date) {
  if (!date) return ''
  try { return new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(date)) } catch { return '' }
}
