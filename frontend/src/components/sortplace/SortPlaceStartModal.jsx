import { useEffect, useRef } from 'react'

// Start screen for a sort_place game. Same layout as the other game start
// screens: two stat cards, a "why this helps" box, then Start and Cancel.
export default function SortPlaceStartModal({ game, ready = true, onStart, onCancel }) {
  const dialogRef = useRef(null)

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { onCancel?.(); return }
      if (e.key !== 'Tab' || !dialogRef.current) return
      const f = dialogRef.current.querySelectorAll('button:not([disabled])')
      if (!f.length) return
      const first = f[0]
      const last = f[f.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  const color = game.color || '#16a34a'

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)', background: 'rgba(60,50,90,0.45)', fontFamily: "'Segoe UI',system-ui,sans-serif" }}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mm-title"
        style={{ background: 'linear-gradient(145deg,#ffffff,#fdf3e3)', border: `1.5px solid ${color}40`, borderRadius: 28, padding: '28px 28px', width: 400, maxWidth: '92vw', boxShadow: '0 24px 64px rgba(80,60,20,.25)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }} aria-hidden="true">
          <img src="/games/money-match/bill-100.png" alt="" style={{ height: 70, width: 'auto', transform: 'rotate(-8deg)', borderRadius: 8, boxShadow: '0 4px 10px rgba(0,0,0,.2)' }} onError={(e) => { e.currentTarget.style.display = 'none' }} />
          <img src="/games/money-match/coin-20.png" alt="" style={{ height: 52, width: 52, marginLeft: -14, marginTop: 22, borderRadius: '50%', boxShadow: '0 4px 10px rgba(0,0,0,.2)' }} onError={(e) => { e.currentTarget.style.display = 'none' }} />
        </div>
        <h2 id="mm-title" style={{ color: '#3a2e6b', fontSize: 22, fontWeight: 800, margin: '0 0 10px', textAlign: 'center' }}>{game.name || game.title}</h2>
        <p style={{ color: 'rgba(58,46,107,.75)', fontSize: 14, lineHeight: 1.5, margin: '0 0 20px', textAlign: 'center' }}>{game.description || game.desc}</p>

        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <Card label="Badge" value={game.badge?.name || 'Money Match'} color={color} emoji="💵" />
          <Card label="Points" value={`+${game.pointsPerPlay ?? game.xp ?? 100} XP`} color={color} emoji="⭐" />
        </div>

        <div style={{ background: 'rgba(16,185,129,.08)', border: '1.5px solid rgba(16,185,129,.3)', borderRadius: 16, padding: '14px 16px', marginBottom: 22, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>🌱</span>
          <div>
            <div style={{ fontSize: 11, color: '#0d9488', fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 4 }}>Why this helps</div>
            <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: 'rgba(58,46,107,.85)' }}>
              Teaches the difference between coins and bills and how to keep money in the right place, a first step toward paying at the sari-sari store. Real peso photos help the skill carry over to real money.
            </p>
          </div>
        </div>

        <button type="button" onClick={onStart} disabled={!ready} style={{ width: '100%', background: color, border: 'none', color: '#fff', borderRadius: 14, padding: '13px', cursor: ready ? 'pointer' : 'wait', opacity: ready ? 1 : 0.6, fontFamily: "'Segoe UI',system-ui,sans-serif", fontSize: 15, fontWeight: 800, boxShadow: `0 6px 16px ${color}55`, marginBottom: 10 }}>
          Start Game 🎮
        </button>
        <button type="button" onClick={onCancel} style={{ width: '100%', background: 'rgba(124,79,224,.06)', border: '1px solid rgba(124,79,224,.15)', color: 'rgba(58,46,107,.6)', borderRadius: 12, padding: '10px', cursor: 'pointer', fontFamily: "'Segoe UI',system-ui,sans-serif", fontSize: 13, fontWeight: 600 }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

function Card({ label, value, color, emoji }) {
  return (
    <div style={{ flex: 1, background: `${color}1a`, border: `1.5px solid ${color}55`, borderRadius: 16, padding: '12px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 26 }}>{emoji}</span>
      <span style={{ fontSize: 11, color: 'rgba(58,46,107,.55)', fontWeight: 700 }}>{label}</span>
      <span style={{ fontSize: 12.5, color: '#3a2e6b', fontWeight: 800, textAlign: 'center' }}>{value}</span>
    </div>
  )
}
