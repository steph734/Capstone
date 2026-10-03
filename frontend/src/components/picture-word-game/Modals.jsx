import { CATEGORIES } from './data'
import { ModalShell, CloseButton, PressableButton, GhostButton } from './ui'
import { EyeIcon, SpeakerIcon, HandTapIcon, PlayIcon, CategoryIcon, StarIcon, DefaultPanda, GearIcon } from './illustrations'

const HEADING = { fontFamily: "'Baloo 2', system-ui, sans-serif" }

// ─── Screen 1 — Start ──────────────────────────────────────────────────────

const STEPS = [
  { icon: EyeIcon, label: 'Look', tint: '#E9E8FB', color: '#6D28D9' },
  { icon: SpeakerIcon, label: 'Listen', tint: '#E3F4E8', color: '#2F8A4C' },
  { icon: HandTapIcon, label: 'Tap', tint: '#FFF0CC', color: '#C97A00' },
]

export function StartModal({ onStart, onCancel, onOpenSettings }) {
  return (
    <ModalShell onClose={onCancel} maxWidth="max-w-[500px]" label="Picture-Word Matching">
      {onOpenSettings && (
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Therapist settings"
          className="absolute left-5 top-5 flex h-11 w-11 items-center justify-center rounded-full bg-[#F1EEDF] text-[#5A5670] transition-colors hover:bg-[#E7E2CC] focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6]"
        >
          <GearIcon size={18}/>
        </button>
      )}
      <div className="flex flex-col items-center text-center">
        <span className="rounded-full bg-[#FFF0CC] px-3.5 py-1 text-[12px] font-extrabold tracking-wide text-[#C97A00]" style={HEADING}>
          WORD GAME
        </span>
        <h1 className="mt-3 text-[30px] font-extrabold leading-tight text-[#2B2A4C]" style={HEADING}>
          Picture-Word Matching
        </h1>

        <div className="mt-6 grid w-full grid-cols-3 gap-3">
          {STEPS.map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-2 rounded-2xl py-4" style={{ background: s.tint }}>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white" style={{ color: s.color }}>
                <s.icon size={24}/>
              </div>
              <span className="text-[15px] font-extrabold text-[#2B2A4C]" style={HEADING}>{s.label}</span>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-[#E3F4E8] px-3.5 py-1.5 text-[14px] font-bold text-[#2F8A4C]">
            <StarIcon size={15}/> Earn a star for every word
          </span>
          <span className="rounded-full bg-[#FFF0CC] px-3.5 py-1.5 text-[14px] font-bold text-[#C97A00]">+100 XP</span>
        </div>

        <PressableButton onClick={onStart} className="mt-6 h-14 w-full text-[20px]">
          <PlayIcon size={22}/> Let&apos;s play!
        </PressableButton>

        <GhostButton onClick={onCancel} className="mt-2.5 h-12 w-full text-[16px]">Cancel</GhostButton>

        <p className="mt-4 max-w-[400px] text-[13px] leading-relaxed text-[#5A5670]">
          Builds receptive vocabulary and picture-word association. Three choices, no timer, and a helper glow after two tries.
        </p>
      </div>
    </ModalShell>
  )
}

// ─── Screen 2 — Category picker ────────────────────────────────────────────

export function CategoryModal({ onSelect, onClose }) {
  return (
    <ModalShell onClose={onClose} maxWidth="max-w-[520px]" label="Choose a category">
      <CloseButton onClose={onClose}/>
      <div className="pr-10 text-center">
        <h2 className="text-[28px] font-extrabold text-[#2B2A4C]" style={HEADING}>
          What do you want to play?
        </h2>
        <p className="mt-1 text-[15px] font-bold text-[#5A5670]">Tap a picture to start</p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelect(cat.id)}
            className="pwg-pressable flex h-[140px] flex-col items-center justify-center gap-1.5 rounded-3xl border-2 transition-transform active:translate-y-[2px] focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6] focus-visible:outline-offset-2"
            style={{ background: cat.light, borderColor: cat.dark, boxShadow: `0 4px 12px ${cat.dark}66` }}
          >
            <CategoryIcon id={cat.id} size={46}/>
            <span className="text-[18px] font-extrabold text-[#2B2A4C]" style={HEADING}>{cat.label}</span>
            <span className="text-[13px] font-bold text-[#5A5670]">6 words</span>
          </button>
        ))}
      </div>

      <GhostButton onClick={onClose} className="mt-5 h-12 w-full text-[16px]">Cancel</GhostButton>
    </ModalShell>
  )
}

// ─── Screen 4 — Results ────────────────────────────────────────────────────

export function ResultsModal({ categoryLabel, stars, badgeLabel = 'Word Picture badge', xp = 100, onReplay, onNewGroup }) {
  return (
    <ModalShell onClose={onReplay} maxWidth="max-w-[500px]" label="Results">
      <div className="flex flex-col items-center text-center">
        <StarIcon size={56} className="text-[#F59E0B]"/>
        <h1 className="mt-2 text-[30px] font-extrabold text-[#2B2A4C]" style={HEADING}>You did it!</h1>
        <p className="mt-1 text-[16px] font-bold text-[#5A5670]">
          You matched all {stars} {categoryLabel ? categoryLabel.toLowerCase() : 'words'}.
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <span className="rounded-full bg-[#FFF0CC] px-3.5 py-1.5 text-[14px] font-bold text-[#C97A00]">🏅 {badgeLabel}</span>
          <span className="rounded-full bg-[#E3F4E8] px-3.5 py-1.5 text-[14px] font-bold text-[#2F8A4C]">+{xp} XP</span>
        </div>

        <div className="mt-6 flex w-full flex-col gap-2.5 sm:flex-row">
          <PressableButton onClick={onReplay} className="h-14 flex-1 text-[18px]">Play again</PressableButton>
          <GhostButton onClick={onNewGroup} className="h-12 flex-1 text-[16px] sm:h-14">New group</GhostButton>
        </div>
      </div>
    </ModalShell>
  )
}

// ─── Panda + speech bubble ──────────────────────────────────────────────────

const TONE_STYLES = {
  neutral: { bg: 'rgba(255,255,255,.92)', border: '#E4DFCE', text: '#2B2A4C' },
  success: { bg: '#E3F4E8', border: '#A9D8B6', text: '#2F8A4C' },
  hint: { bg: '#FFF0CC', border: '#F3D284', text: '#C97A00' },
}

export function BuddyBubble({ Mascot, mouthOpen = false, message, tone = 'neutral', pandaState = 'happy', pxWidth = 120 }) {
  const t = TONE_STYLES[tone] || TONE_STYLES.neutral
  const Panda = Mascot || DefaultPanda
  return (
    <div className="flex items-end gap-3">
      <div className="pwg-float shrink-0">
        <Panda entered={true} mouthOpen={mouthOpen} pxWidth={pxWidth} pandaState={pandaState}/>
      </div>
      <div
        className="min-h-[52px] max-w-[400px] rounded-[6px_18px_18px_18px] border-2 px-4 py-2.5 text-[16px] font-bold leading-snug transition-colors"
        style={{ background: t.bg, borderColor: t.border, color: t.text }}
        role="status"
        aria-live="polite"
      >
        {message}
      </div>
    </div>
  )
}
