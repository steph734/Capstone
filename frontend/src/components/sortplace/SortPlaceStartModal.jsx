import { useEffect, useRef } from 'react'

// Start screen for a sort_place game: what it is, what you earn, why it helps.
const HEADING = { fontFamily: "'Baloo 2', system-ui, sans-serif" }
const BODY = { fontFamily: "'Atkinson Hyperlegible', system-ui, sans-serif" }
const STAT_LABEL = {
  intelligence: 'Intelligence', focus: 'Focus', resistance: 'Resistance',
  creativity: 'Creativity', speed: 'Speed', memory: 'Memory',
}

export default function SortPlaceStartModal({ game, onStart, onCancel }) {
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

  const gains = Object.entries(game.statGains || {}).filter(([, v]) => v > 0)

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-[rgba(30,60,100,0.45)] p-4 backdrop-blur-sm" style={BODY}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mm-title"
        className="max-h-[95vh] w-full max-w-[600px] overflow-y-auto rounded-[36px] p-7 shadow-2xl"
        style={{ background: 'linear-gradient(180deg,#FFFFFF,#FFF8EC)' }}
      >
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-3 h-[92px] w-[130px]" aria-hidden="true">
            <img src="/games/money-match/bill-100.png" alt="" className="absolute left-0 top-2 h-[78px] w-[130px] -rotate-8 rounded-lg object-cover shadow-md" style={{ transform: 'rotate(-8deg)' }} onError={(e) => { e.currentTarget.style.display = 'none' }} />
            <img src="/games/money-match/coin-20.png" alt="" className="absolute bottom-0 right-0 h-[56px] w-[56px] rounded-full object-cover shadow-md" onError={(e) => { e.currentTarget.style.display = 'none' }} />
          </div>
          <h2 id="mm-title" className="text-[32px] font-extrabold leading-tight text-[#2B2366]" style={HEADING}>{game.name}</h2>
          <p className="mt-2 max-w-[480px] text-[16px] leading-relaxed text-[#2B2A4C]">{game.description}</p>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2.5">
          <Card label="Badge" value={game.badge?.name || 'None yet'} tint="#FFF0CC" />
          <Card label="Points" value={`+${game.pointsPerPlay} XP`} tint="#E3F4E8" />
          <Card label="Pao stats" value={gains.length ? gains.map(([k, v]) => `${STAT_LABEL[k] || k} +${v}`).join(' · ') : 'Stronger Pao'} tint="#ede9fe" />
        </div>

        <div className="mt-5 rounded-2xl border-2 border-[#A9D8B6] bg-[#E3F4E8] p-4">
          <p className="text-[12px] font-extrabold tracking-wider text-[#2F8A4C]">WHY THIS HELPS</p>
          <p className="mt-1 text-[15px] leading-relaxed text-[#2B2A4C]">
            Teaches the difference between coins and bills and how to keep money in the right place, a first step toward paying at the sari-sari store. Real peso photos help the skill carry over to real money.
          </p>
        </div>

        <button type="button" onClick={onStart} className="mt-6 h-14 w-full rounded-2xl bg-[#F59E0B] text-[20px] font-extrabold text-[#2B2A4C] focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6]" style={{ ...HEADING, boxShadow: '0 5px 0 #C97A00' }}>
          Start Game
        </button>
        <button type="button" onClick={onCancel} className="mt-2.5 h-12 w-full rounded-2xl border-2 border-[#E4DFCE] bg-white text-[16px] font-bold text-[#5A5670] focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6]">
          Cancel
        </button>
      </div>
    </div>
  )
}

function Card({ label, value, tint }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl p-3 text-center" style={{ background: tint }}>
      <span className="text-[11px] font-bold uppercase tracking-wide text-[#5A5670]">{label}</span>
      <span className="text-[14px] font-extrabold text-[#2B2A4C]" style={HEADING}>{value}</span>
    </div>
  )
}
