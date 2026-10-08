import { useEffect, useRef } from 'react'
import PandaMascot from '../../pages/games/PandaMascot'
import BadgeMedal from '../BadgeMedal'

const HEADING = { fontFamily: "'Baloo 2', system-ui, sans-serif" }
const BODY = { fontFamily: "'Atkinson Hyperlegible', system-ui, sans-serif" }
const STAT_LABEL = { intelligence: 'Intelligence', focus: 'Focus', resistance: 'Resistance', creativity: 'Creativity', speed: 'Speed', memory: 'Memory' }

function useDialogKeys(ref, onClose) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { onClose?.(); return }
      if (e.key !== 'Tab' || !ref.current) return
      const f = ref.current.querySelectorAll('button:not([disabled])')
      if (!f.length) return
      const first = f[0]
      const last = f[f.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [ref, onClose])
}

export function EmergencyStartModal({ game, emergencies, ready = true, onStart, onCancel }) {
  const ref = useRef(null)
  useDialogKeys(ref, onCancel)
  const gains = Object.entries(game.statGains || {}).filter(([, v]) => v > 0)
  const covers = emergencies.slice(0, 3)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)', background: 'rgba(60,50,90,0.45)', ...BODY }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="er-title" style={{ background: 'linear-gradient(145deg,#ffffff,#fdf3e3)', border: '1.5px solid #EF444440', borderRadius: 28, padding: 28, width: 420, maxWidth: '92vw', maxHeight: '95vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(80,60,20,.25)' }}>
        <div className="mb-2 flex justify-center gap-2" aria-hidden="true">
          {covers.map((e) => (
            <img key={e.key} src={e.coverImage} alt="" className="h-[64px] w-[64px] rounded-2xl border-2 border-white object-cover shadow-md" onError={(ev) => { ev.currentTarget.style.display = 'none' }} />
          ))}
        </div>
        <div className="flex justify-center">
          <span className="rounded-full bg-[#FEE2E2] px-3 py-1 text-[12px] font-extrabold text-[#B91C1C]">Hard · Ages 12-19</span>
        </div>
        <h2 id="er-title" style={{ ...HEADING, color: '#3a2e6b', fontSize: 24, fontWeight: 800, margin: '8px 0 8px', textAlign: 'center' }}>{game.name}</h2>
        <p style={{ color: 'rgba(58,46,107,.75)', fontSize: 14, lineHeight: 1.5, margin: '0 0 16px', textAlign: 'center' }}>{game.description}</p>

        <div className="mb-4 flex flex-wrap justify-center gap-2">
          {['1. Pick an emergency', '2. Learn what to do', '3. Pack the go-bag'].map((p) => (
            <span key={p} className="rounded-full bg-[#ede9fe] px-3 py-1 text-[12px] font-extrabold text-[#5b21b6]">{p}</span>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <Card label="Badge" value="Safety Star" emoji="🌟" />
          <Card label="Points" value={`+${game.pointsPerPlay ?? 150} XP`} emoji="⭐" />
          <Card label="Pao stats" value={gains.length ? gains.map(([k, v]) => `${STAT_LABEL[k] || k} +${v}`).join(' · ') : 'Stronger Pao'} emoji="🐼" />
        </div>

        <div className="mb-5 rounded-2xl border-2 border-[#A9D8B6] bg-[#E3F4E8] p-4">
          <p className="text-[12px] font-extrabold tracking-wider text-[#2F8A4C]">WHY THIS HELPS</p>
          <p className="mt-1 text-[14px] leading-relaxed text-[#2B2A4C]">
            Calm, no-pressure practice for real emergencies: no timer, no wrong buzzers, just gentle steps to learn and repeat.
          </p>
        </div>

        <button type="button" onClick={onStart} disabled={!ready} className="h-14 w-full rounded-2xl bg-[#F59E0B] text-[20px] font-extrabold text-[#2B2A4C] disabled:opacity-60" style={{ ...HEADING, boxShadow: '0 5px 0 #C97A00' }}>
          Start Game
        </button>
        <button type="button" onClick={onCancel} className="mt-2.5 h-12 w-full rounded-2xl border-2 border-[#E4DFCE] bg-white text-[16px] font-bold text-[#5A5670]">
          Cancel
        </button>
      </div>
    </div>
  )
}

function Card({ label, value, emoji }) {
  return (
    <div style={{ flex: 1, background: '#FFF4D6', border: '1.5px solid #F3D284', borderRadius: 16, padding: '10px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 22 }} aria-hidden="true">{emoji}</span>
      <span style={{ fontSize: 10.5, color: '#92400E', fontWeight: 700 }}>{label}</span>
      <span style={{ fontSize: 11.5, color: '#3a2e6b', fontWeight: 800, textAlign: 'center' }}>{value}</span>
    </div>
  )
}

export function EmergencyPicker({ emergencies, onClose, onPick }) {
  const ref = useRef(null)
  useDialogKeys(ref, onClose)
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)', background: 'rgba(60,50,90,0.45)', ...BODY }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="er-pick" style={{ background: '#fff', borderRadius: 28, padding: 22, width: 640, maxWidth: '94vw', maxHeight: '94vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(80,60,20,.25)' }}>
        <div className="flex items-center justify-between">
          <h2 id="er-pick" style={{ ...HEADING, color: '#3a2e6b', fontSize: 22, fontWeight: 800 }}>Which emergency do you want to learn?</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="h-9 w-9 rounded-full border-2 border-[#E4DFCE] text-[16px] font-extrabold text-[#5A5670]">✕</button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {emergencies.map((e) => (
            <EmergencyCard key={e.key} e={e} onPick={() => onPick(e.key)} />
          ))}
        </div>
      </div>
    </div>
  )
}

function EmergencyCard({ e, onPick }) {
  return (
    <button type="button" onClick={onPick} aria-label={`${e.name}. ${e.rule}.`}
      className="relative flex w-full max-w-[300px] flex-col items-center gap-2 rounded-[22px] border-[3px] p-3 text-center"
      style={{ background: e.color, borderColor: e.border }}>
      {e.coverImage && <img src={e.coverImage} alt="" className="h-[96px] w-full rounded-xl object-cover" onError={(ev) => { ev.currentTarget.style.display = 'none' }} />}
      <div style={{ ...HEADING, fontSize: 16, fontWeight: 800, color: '#2B2366' }}>{e.name}</div>
      <span className="rounded-full bg-white px-2.5 py-1 text-[11.5px] font-extrabold text-[#2B2A4C] shadow-sm">{e.rule}</span>
    </button>
  )
}

export function EmergencyPickerFooter({ selected, onBack, onLearn }) {
  return (
    <div className="mt-5 flex flex-col gap-2">
      <button type="button" disabled={!selected} onClick={onLearn} className="h-14 rounded-2xl bg-[#F59E0B] text-[18px] font-extrabold text-[#2B2A4C] disabled:opacity-50" style={HEADING}>
        {selected ? `Learn about ${selected.name}` : 'Pick an emergency'}
      </button>
      <button type="button" onClick={onBack} className="h-12 rounded-2xl border-2 border-[#E4DFCE] bg-white text-[16px] font-bold text-[#5A5670]">Back</button>
    </div>
  )
}

const PUZZLE_ICON = { order: '🗂️', safe_or_not: '✅', choose: '📱', sort: '🎒' }

export function EmergencyIntro({ emergency, onBack, onStart }) {
  return (
    <div className="mx-auto flex w-full max-w-[900px] flex-col gap-4 p-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col items-center gap-3">
          <img src={emergency.coverImage} alt="" className="h-[300px] w-full max-w-[420px] rounded-[24px] object-cover shadow-lg" onError={(ev) => { ev.currentTarget.style.display = 'none' }} />
        </div>
        <div className="flex flex-col gap-3">
          <div className="rounded-[24px] bg-white p-5 shadow-lg">
            <h2 className="text-[26px] font-extrabold text-[#2B2366]" style={HEADING}>{emergency.introTitle}</h2>
            <ul className="mt-2 flex flex-col gap-1.5 text-[15px] text-[#2B2A4C]">
              {emergency.introLines.map((l) => <li key={l} className="flex gap-2"><span aria-hidden="true">•</span>{l}</li>)}
            </ul>
            {emergency.signs.length > 0 && (
              <>
                <p className="mt-3 text-[11px] font-extrabold uppercase tracking-wide text-[#92400E]">Signs to look for</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {emergency.signs.map((s) => <span key={s} className="rounded-full bg-[#FFF4D6] px-2.5 py-1 text-[12px] font-bold text-[#92400E]">{s}</span>)}
                </div>
              </>
            )}
          </div>
          <div className="rounded-[24px] bg-white p-5 shadow-lg">
            <h3 className="text-[16px] font-extrabold text-[#2B2366]" style={HEADING}>Your 4 puzzles</h3>
            <div className="mt-2 flex flex-col gap-2">
              {emergency.puzzles.map((p) => (
                <div key={p.part_no} className="flex items-center gap-3 rounded-2xl bg-[#F8FAFC] p-2.5">
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#EDE9FE] text-[13px] font-extrabold text-[#5b21b6]">{p.part_no}</span>
                  <span className="text-[18px]" aria-hidden="true">{PUZZLE_ICON[p.type] || '🧩'}</span>
                  <div className="min-w-0">
                    <div className="truncate text-[13.5px] font-extrabold text-[#2B2A4C]">{p.title || p.description}</div>
                    <div className="truncate text-[12px] text-[#5A5670]">{p.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-[520px] flex-col gap-2.5">
        <button type="button" onClick={onStart} className="h-14 rounded-2xl bg-[#F59E0B] text-[18px] font-extrabold text-[#2B2A4C]" style={{ ...HEADING, boxShadow: '0 5px 0 #C97A00' }}>Start puzzle 1</button>
        <button type="button" onClick={onBack} className="h-12 rounded-2xl border-2 border-[#E4DFCE] bg-white text-[16px] font-bold text-[#5A5670]">← Emergencies</button>
      </div>
    </div>
  )
}

export function EmergencyEndModal({ emergency, game, onPlayAgain, onPickAnother }) {
  const gains = Object.entries(game.statGains || {}).filter(([, v]) => v > 0)
  const colors = ['#DBEAFE', '#DCFCE7', '#FFEDD5']
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-[rgba(30,60,100,0.45)] p-4 backdrop-blur-sm" style={BODY}>
      <div className="flex w-full max-w-[640px] flex-col items-center gap-4 rounded-[32px] bg-[#FFF8EC] p-7 text-center shadow-2xl">
        <PandaMascot entered pandaState="happy" pxWidth={120} />
        <h2 className="text-[30px] font-extrabold text-[#2B2366]" style={HEADING}>You're {emergency.name} Ready!</h2>
        <div className="grid w-full gap-2.5 sm:grid-cols-3">
          {emergency.endSummary.map((s, i) => (
            <div key={s.title} className="rounded-2xl p-3 text-left" style={{ background: colors[i % colors.length] }}>
              <div className="text-[12.5px] font-extrabold text-[#2B2366]">{s.title}</div>
              <div className="mt-1 text-[12px] text-[#2B2A4C]">{s.text}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-2 text-[13px] font-bold">
          <span className="rounded-full bg-[#E3F4E8] px-3 py-1.5 text-[#2F8A4C]">+{game.pointsPerPlay ?? 150} XP for Pao</span>
          {gains.map(([k, v]) => <span key={k} className="rounded-full bg-[#ede9fe] px-3 py-1.5 text-[#5b21b6]">{STAT_LABEL[k] || k} +{v}</span>)}
          <span className="flex items-center gap-1 rounded-full bg-[#FFF0CC] px-3 py-1.5 text-[#C97A00]"><BadgeMedal shape="star" colour="amber" symbol="star" size={16} />Badge: Safety Star</span>
        </div>
        <p className="text-[13px] italic text-[#5A5670]">Practise a real drill at home or school with a grown-up.</p>
        <div className="flex w-full flex-col gap-2.5">
          <button type="button" onClick={onPlayAgain} className="h-14 rounded-2xl bg-[#6D4AE0] text-[18px] font-extrabold text-white" style={HEADING}>Play again</button>
          <button type="button" onClick={onPickAnother} className="h-12 rounded-2xl border-2 border-[#E4DFCE] bg-white text-[16px] font-bold text-[#5A5670]">Pick another emergency</button>
        </div>
      </div>
    </div>
  )
}
