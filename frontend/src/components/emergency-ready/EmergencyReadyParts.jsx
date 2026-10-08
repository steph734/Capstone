import { useState } from 'react'

const HEADING = { fontFamily: "'Baloo 2', system-ui, sans-serif" }
const BODY = { fontFamily: "'Atkinson Hyperlegible', system-ui, sans-serif" }

function Pic({ src, alt, className, fallback = '🖼️' }) {
  const [broken, setBroken] = useState(false)
  if (!src || broken) return <span className={`flex items-center justify-center text-[48px] ${className}`} aria-hidden="true">{fallback}</span>
  return <img src={src} alt={alt} className={className} onError={() => setBroken(true)} />
}

// ─── order: numbered boxes + shuffled tray ───────────────────────────────────
export function OrderPart({ level, state, dispatch }) {
  const sorted = [...level.items].sort((a, b) => a.step_order - b.step_order)
  const boxSize = sorted.length <= 3 ? 230 : 200
  return (
    <div className="flex flex-col gap-4">
      {level.tag && (
        <div className="flex flex-wrap items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-[13px] font-extrabold ${level.tag_color === 'green' ? 'bg-[#DCFCE7] text-[#166534]' : 'bg-[#FFF4D6] text-[#92400E]'}`}>{level.tag}</span>
          <p className="text-[18px] font-extrabold text-[#2B2366]" style={HEADING}>{level.question}</p>
        </div>
      )}
      <div className="flex flex-wrap justify-center gap-3 rounded-[28px] bg-white/85 p-4 shadow-lg">
        {sorted.map((step, i) => {
          const placedLabel = state.placed[i]
          const pos = i === 0 ? 'First' : i === sorted.length - 1 ? 'Last' : 'Next'
          const glow = state.glowSlot === i
          return (
            <button key={step.label} type="button" onClick={() => dispatch({ type: 'place', slot: i })}
              aria-label={placedLabel ? `Box ${i + 1}: ${placedLabel}` : `Box ${i + 1}, empty`}
              className="flex flex-col items-center gap-1" style={{ width: boxSize * 0.56 }}>
              <span className={`flex items-center justify-center overflow-hidden rounded-2xl border-[3px] bg-white ${glow ? 'ring-4 ring-[#F59E0B]' : ''} ${placedLabel ? 'border-solid border-[#2F8A4C] bg-[#E3F4E8]' : 'border-dashed border-[#8A5A3B]'}`} style={{ width: boxSize * 0.56, height: boxSize * 0.56 }}>
                {placedLabel ? <Pic src={step.image_url} alt="" className="h-full w-full object-contain p-1" /> : <span className="text-[22px] font-extrabold text-[#8A5A3B]" aria-hidden="true">{i + 1}</span>}
              </span>
              <span className="text-[13px] font-extrabold" style={{ ...HEADING, color: placedLabel ? '#2F8A4C' : '#5A5670' }}>{placedLabel || pos}</span>
            </button>
          )
        })}
      </div>
      <div className="flex flex-wrap justify-center gap-3 rounded-[28px] bg-white/70 p-4 shadow-md" role="group" aria-label="Pictures to place">
        {state.tray.length === 0 && <p className="text-[15px] font-bold text-[#2F8A4C]">Every picture is in place.</p>}
        {state.tray.map((label) => {
          const step = sorted.find((s) => s.label === label)
          const selected = state.selected === label
          return (
            <button key={label} type="button" aria-pressed={selected} aria-label={label} onClick={() => dispatch({ type: 'select', key: label })}
              className={`flex flex-col items-center rounded-2xl bg-white p-2 shadow-md transition-transform ${selected ? '-translate-y-2.5 border-[3px] border-[#6D4AE0]' : 'border-[3px] border-transparent'}`}
              style={{ width: boxSize * 0.56 }}>
              <Pic src={step.image_url} alt="" className="h-[80px] w-full object-contain" />
              <span className="mt-1 text-center text-[13px] font-extrabold text-[#2B2A4C]" style={HEADING}>{label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── safe_or_not: one card, Safe / Not safe ──────────────────────────────────
export function SafeOrNotPart({ level, state, dispatch, onNext }) {
  const item = level.items[state.index]
  return (
    <div className="mx-auto flex max-w-[520px] flex-col items-center gap-3">
      {level.lead && <span className="rounded-full bg-[#FFF4D6] px-3 py-1 text-[13px] font-extrabold text-[#92400E]">{level.lead}</span>}
      <p className="text-[12px] font-bold text-[#5A5670]">Card {state.index + 1} of {level.items.length}</p>
      <Pic src={item.image_url} alt="" className="h-[260px] w-full max-w-[460px] rounded-[24px] object-cover shadow-lg" fallback="🖼️" />
      <p className="text-center text-[22px] font-extrabold text-[#2B2366]" style={HEADING}>{item.label}</p>
      <p className="text-[15px] font-bold text-[#5A5670]">Is it safe?</p>
      <div className="flex gap-3">
        <button type="button" disabled={state.answered} onClick={() => dispatch({ type: 'answer', isSafe: true }, level)}
          className={`h-16 rounded-2xl px-8 text-[18px] font-extrabold text-white ${state.answered && state.correct && item.is_safe ? 'bg-[#16a34a]' : state.answered && !item.is_safe ? 'bg-[#16a34a]/30' : 'bg-[#16a34a]'}`} style={HEADING}>✅ Safe</button>
        <button type="button" disabled={state.answered} onClick={() => dispatch({ type: 'answer', isSafe: false }, level)}
          className={`h-16 rounded-2xl px-8 text-[18px] font-extrabold text-white ${state.answered && state.correct && !item.is_safe ? 'bg-[#F59E0B]' : state.answered && item.is_safe ? 'bg-[#F59E0B]/30' : 'bg-[#F59E0B]'}`} style={HEADING}>❌ Not safe</button>
      </div>
      {state.answered && (
        <button type="button" onClick={onNext} className="h-12 rounded-2xl bg-[#6D4AE0] px-8 text-[16px] font-extrabold text-white">Next</button>
      )}
    </div>
  )
}

// ─── choose: question + 3 picture answers ────────────────────────────────────
export function ChoosePart({ level, state, dispatch, onNext, isLast }) {
  const item = level.items[state.index]
  return (
    <div className="mx-auto flex max-w-[640px] flex-col items-center gap-4">
      <p className="text-[12px] font-bold text-[#5A5670]">Question {state.index + 1} of {level.items.length}</p>
      <p className="text-center text-[22px] font-extrabold text-[#2B2366]" style={HEADING}>{item.question}</p>
      <div className="flex flex-wrap justify-center gap-4">
        {item.choices.map((c) => {
          const key = c.choice_key || c.label
          const picked = state.chosenKey === key
          const show = state.answered && (picked || c.is_correct)
          return (
            <button key={key} type="button" disabled={state.answered} onClick={() => dispatch({ type: 'answer', key }, level)}
              className={`flex w-[180px] flex-col items-center gap-2 rounded-[22px] border-[3px] bg-white p-3 shadow-md ${show && c.is_correct ? 'border-[#16a34a] bg-[#E3F4E8]' : show && picked ? 'border-[#F59E0B] opacity-60' : 'border-transparent'}`}>
              <Pic src={c.image_url} alt="" className="h-[140px] w-full object-contain" />
              <span className="text-[15px] font-extrabold text-[#2B2A4C]" style={HEADING}>{c.label}</span>
              {show && c.is_correct && <span className="text-[13px] font-extrabold text-[#16a34a]">✓ Yes</span>}
            </button>
          )
        })}
      </div>
      {state.answered && (
        <button type="button" onClick={onNext} className="h-12 rounded-2xl bg-[#6D4AE0] px-8 text-[16px] font-extrabold text-white">{isLast ? 'Finish' : 'Next'}</button>
      )}
    </div>
  )
}

// ─── sort: tray + two zones ───────────────────────────────────────────────────
export function SortPart({ level, zones, state, dispatch }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap justify-center gap-3 rounded-[28px] bg-white/85 p-4 shadow-lg" role="group" aria-label="Items to sort">
        {state.tray.length === 0 && <p className="text-[15px] font-bold text-[#2F8A4C]">Every item is sorted.</p>}
        {state.tray.map((key) => {
          const item = level.items.find((it) => (it.choice_key || it.label) === key)
          const selected = state.selected === key
          return (
            <button key={key} type="button" aria-pressed={selected} aria-label={item.label} onClick={() => dispatch({ type: 'select', key })}
              className={`flex w-[112px] flex-col items-center gap-1 rounded-2xl bg-white p-2 shadow-md ${selected ? '-translate-y-2 border-[3px] border-[#6D4AE0]' : 'border-[3px] border-transparent'}`}>
              <Pic src={item.image_url} alt="" className="h-[64px] w-full object-contain" fallback="📦" />
              <span className="text-center text-[12px] font-extrabold text-[#2B2A4C]" style={HEADING}>{item.label}</span>
            </button>
          )
        })}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {zones.map((z) => {
          const items = state.placed[z.zone_key] || []
          return (
            <button key={z.zone_key} type="button" onClick={() => dispatch({ type: 'drop', zoneKey: z.zone_key }, level)}
              className="flex min-h-[160px] flex-col items-center gap-2 rounded-[28px] border-[3px] border-dashed border-[#8A5A3B] bg-white/80 p-4"
              aria-label={`${z.label}: ${items.length} items`}>
              <span className="text-[34px]" aria-hidden="true">{z.zone_key === 'bag' ? '🎒' : '🏠'}</span>
              <span className="text-[18px] font-extrabold text-[#2B2366]" style={HEADING}>{z.label}</span>
              <span className="rounded-full bg-[#FFF0CC] px-3 py-1 text-[12px] font-extrabold text-[#C97A00]">{items.length} / {level.items.filter((it) => it.zone_key === z.zone_key).length}</span>
              <span className="flex flex-wrap justify-center gap-1.5">
                {items.map((key) => {
                  const item = level.items.find((it) => (it.choice_key || it.label) === key)
                  return <span key={key} className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-[#2B2A4C]">{item.label}</span>
                })}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export { Pic }
export const EMERGENCY_BODY = BODY
