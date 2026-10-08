import { useMemo, useState, useEffect } from 'react'
import { markPaoSeen } from '../utils/paoApi'
import BadgeMedal from './BadgeMedal'
import PaoBuddy from './pao/PaoBuddy'

// Which pose Pao strikes for each reward screen (see the Pao poses prompt).
const POSE_FOR_SCREEN = { xp: 'clap', level: 'dance', stats: 'great', badge: 'wow', item: 'clap' }

// One screen at a time after a finished game: XP, then level up, stats,
// each new badge, and each new item. Read aloud at a calm pace; nothing times
// out; "Put it on Pao" or "Maybe later" per item. Marks everything seen at the end.
const STAT_LABELS = {
  intelligence: 'Intelligence', focus: 'Focus', resistance: 'Resistance',
  creativity: 'Creativity', speed: 'Speed', memory: 'Memory',
}
const CATEGORY_SLOT = { Hats: 'hats', Clothes: 'clothes', Pants: 'pants', Shoes: 'shoes', Hair: 'hair' }
const HEADING = { fontFamily: "'Baloo 2', system-ui, sans-serif" }

function speak(text) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  try {
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 0.85
    window.speechSynthesis.speak(u)
  } catch { /* read-aloud is best-effort */ }
}

function lineFor(screen, reward) {
  switch (screen.kind) {
    case 'xp': return `Pao earned ${reward.xpEarned} XP!`
    case 'level': return `Level up! Pao is now level ${reward.levelAfter}!`
    case 'stats': return `Pao got stronger: ${screen.gained.map(([k, v]) => `${STAT_LABELS[k]} plus ${v}`).join(', ')}.`
    case 'badge': return `New badge! ${screen.badge.name}.`
    case 'item': return `A new outfit for Pao: ${screen.unlock.name}. Would you like to put it on?`
    default: return ''
  }
}

export default function RewardSequence({ reward, ident, onEquip, onDone }) {
  const screens = useMemo(() => {
    const list = [{ kind: 'xp' }]
    if (reward.leveledUp) list.push({ kind: 'level' })
    const gained = Object.entries(reward.statGains || {}).filter(([, v]) => v > 0)
    if (gained.length) list.push({ kind: 'stats', gained })
    ;(reward.badges || []).forEach((b) => list.push({ kind: 'badge', badge: b }))
    ;(reward.unlocks || []).forEach((u) => list.push({ kind: 'item', unlock: u }))
    return list
  }, [reward])

  const [index, setIndex] = useState(0)
  const [equipped, setEquipped] = useState(null)
  const screen = screens[index]
  const isLast = index === screens.length - 1

  useEffect(() => { if (screen) speak(lineFor(screen, reward)) }, [index]) // eslint-disable-line react-hooks/exhaustive-deps

  const finish = async () => {
    try { window.speechSynthesis?.cancel() } catch { /* ignore */ }
    try {
      await markPaoSeen(ident, {
        badgeCodes: (reward.badges || []).map((b) => b.code),
        unlocks: (reward.unlocks || []).map((u) => ({ itemType: u.itemType, code: u.code })),
      })
    } catch { /* seen-flags are cosmetic */ }
    onDone()
  }

  const next = () => (isLast ? finish() : setIndex((i) => i + 1))

  const putOn = async (u) => {
    const slot = CATEGORY_SLOT[u.category] || (u.itemType === 'hair' ? 'hair' : null)
    if (slot && onEquip) {
      try { await onEquip(slot, u.code); setEquipped(u.code) } catch { /* stays unworn */ }
    }
    next()
  }

  if (!screen) return null

  return (
    <div role="dialog" aria-modal="true" aria-label="Pao's rewards" className="fixed inset-0 z-[10010] flex items-center justify-center bg-[rgba(30,60,100,0.45)] p-4">
      <div className="w-full max-w-[460px] rounded-[28px] bg-[#FFFDF8] p-7 text-center shadow-xl" style={{ fontFamily: "'Atkinson Hyperlegible', system-ui, sans-serif", color: '#2B2A4C' }}>
        <div className="mx-auto mb-1 flex justify-center">
          <PaoBuddy mood={POSE_FOR_SCREEN[screen.kind] || 'hooray'} size={110} interactive={false} readAloud={false} />
        </div>
        <p className="text-[13px] font-bold tracking-wide text-[#5A5670]">{index + 1} of {screens.length}</p>

        {screen.kind === 'xp' && (
          <>
            <h2 className="mt-2 text-[30px] font-extrabold" style={HEADING}>+{reward.xpEarned} XP</h2>
            <p className="mt-2 text-[16px]">Great playing! Pao is growing.</p>
            <XpBar profile={reward.profile} />
          </>
        )}

        {screen.kind === 'level' && (
          <>
            <h2 className="mt-2 text-[30px] font-extrabold" style={HEADING}>Level up!</h2>
            <p className="mt-2 text-[18px] font-bold">Pao is now level {reward.levelAfter}</p>
          </>
        )}

        {screen.kind === 'stats' && (
          <>
            <h2 className="mt-2 text-[28px] font-extrabold" style={HEADING}>Pao got stronger</h2>
            <ul className="mt-3 space-y-2 text-[16px]">
              {screen.gained.map(([k, v]) => (
                <li key={k} className="flex justify-between rounded-2xl bg-[#E3F4E8] px-4 py-2 font-bold text-[#2F8A4C]">
                  <span>{STAT_LABELS[k]}</span><span>+{v}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        {screen.kind === 'badge' && (
          <>
            <h2 className="mt-2 text-[28px] font-extrabold" style={HEADING}>New badge!</h2>
            <div className="my-3 flex justify-center">
              <BadgeMedal shape={screen.badge.shape} colour={screen.badge.colour} symbol={screen.badge.symbol} size={96} />
            </div>
            <p className="text-[20px] font-extrabold">{screen.badge.name}</p>
            {screen.badge.description && <p className="mt-1 text-[15px] text-[#5A5670]">{screen.badge.description}</p>}
          </>
        )}

        {screen.kind === 'item' && (
          <>
            <h2 className="mt-2 text-[28px] font-extrabold" style={HEADING}>New outfit!</h2>
            <div className="my-4 flex justify-center text-[64px] leading-none" aria-hidden="true">{screen.unlock.emoji || '🎁'}</div>
            <p className="text-[20px] font-extrabold">{screen.unlock.name}</p>
            <p className="mt-1 text-[15px] text-[#5A5670]">{screen.unlock.category}</p>
            {equipped === screen.unlock.code && <p className="mt-2 font-bold text-[#2F8A4C]">Pao is wearing it!</p>}
          </>
        )}

        <div className="mt-6 flex flex-col gap-2.5">
          {screen.kind === 'item' && !equipped ? (
            <>
              <button type="button" onClick={() => putOn(screen.unlock)} className="h-16 rounded-2xl bg-[#2F8A4C] text-[19px] font-extrabold text-white focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6]">Put it on Pao</button>
              <button type="button" onClick={next} className="h-14 rounded-2xl border-2 border-[#E4DFCE] bg-white text-[17px] font-bold text-[#5A5670] focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6]">Maybe later</button>
            </>
          ) : (
            <button type="button" onClick={next} className="h-16 rounded-2xl bg-[#F59E0B] text-[19px] font-extrabold text-white shadow-md focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6]">
              {isLast ? 'Done' : 'Next'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function XpBar({ profile }) {
  if (!profile) return null
  const pct = profile.xpToNext ? Math.min(100, Math.round((profile.xp / profile.xpToNext) * 100)) : 100
  return (
    <div className="mt-4" aria-label={`${profile.xp} of ${profile.xpToNext} XP to next level`}>
      <div className="h-4 w-full overflow-hidden rounded-full bg-[#E4DFCE]">
        <div className="h-full rounded-full bg-[#F59E0B] transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1.5 text-[14px] font-bold text-[#5A5670]">Level {profile.level} · {profile.xp} / {profile.xpToNext ?? '—'} XP</p>
    </div>
  )
}
