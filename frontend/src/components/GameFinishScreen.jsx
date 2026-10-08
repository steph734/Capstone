import PandaMascot from '../pages/games/PandaMascot'
import BadgeMedal from './BadgeMedal'

// The finish screen used after a game: Pao on the left, a result card on the
// right (stars, title, the badge just earned, XP, and Play again / All games).
// Stacks into one column on phones.
export default function GameFinishScreen({
  title,
  subtitle,
  badge = null,            // serialized badge { name, shape, colour, symbol } or null
  badgeFallback = null,    // { emoji, name } shown when no real badge is set
  xp = 100,
  chips = [],              // small pills under the card, e.g. stat gains
  visual = null,           // optional picture shown above Pao, e.g. the finished board
  stars = 3,               // how many of the 3 stars are lit
  replayLabel = 'Play Again',
  onReplay,
  onExit,
}) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto px-4 py-6" style={{ background: 'linear-gradient(180deg,#87ceeb,#bfe9a8)', fontFamily: "'Atkinson Hyperlegible', system-ui, sans-serif" }}>
      <style>{`@keyframes gfFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}} @keyframes gfFadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div className="flex w-full max-w-[900px] flex-wrap items-center justify-center gap-10 md:gap-16">
        <div className="flex flex-col items-center gap-4">
          {visual}
          <div style={{ animation: 'gfFloat 2.5s ease-in-out infinite' }}>
            <PandaMascot entered={true} pandaState="excited" pxWidth={150} />
          </div>
        </div>

        <div className="flex w-full max-w-[380px] flex-col items-center gap-2.5 rounded-[32px] bg-white p-7 text-center shadow-2xl">
          <div className="flex gap-1.5 text-[34px]" aria-label={`${Math.min(3, stars)} of 3 stars`}>
            {[0, 1, 2].map((i) => (
              <span key={i} aria-hidden="true" style={{ opacity: i < stars ? 1 : 0.2, filter: i < stars ? 'none' : 'grayscale(1)' }}>⭐</span>
            ))}
          </div>
          <h1 className="mt-1 text-[36px] font-black leading-tight text-[#1e1b4b]">{title}</h1>
          {subtitle && <p className="text-[14px] font-semibold text-[#3a2e6b]/70">{subtitle}</p>}

          {(badge || badgeFallback) && (
            <div className="mt-2 flex flex-col items-center gap-2 rounded-3xl border-2 border-emerald-300/40 bg-emerald-50 px-8 py-4" style={{ animation: 'gfFadeUp .5s both' }}>
              {badge
                ? <BadgeMedal shape={badge.shape} colour={badge.colour} symbol={badge.symbol} size={90} />
                : <span className="text-[64px]" aria-hidden="true">{badgeFallback.emoji}</span>}
              <div className="text-[18px] font-black text-emerald-700">{badge ? badge.name : badgeFallback.name}</div>
              <div className="text-[13px] font-extrabold text-amber-700">+{xp} XP</div>
            </div>
          )}

          {chips.length > 0 && (
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {chips.map((c) => (
                <span key={c} className="rounded-full bg-slate-100 px-3 py-1 text-[12px] font-extrabold text-slate-600">{c}</span>
              ))}
            </div>
          )}

          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={onReplay} className="rounded-2xl bg-emerald-500 px-7 py-3.5 text-[15px] font-extrabold text-white focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6]">{replayLabel}</button>
            <button type="button" onClick={onExit} className="rounded-2xl bg-slate-200 px-7 py-3.5 text-[15px] font-bold text-slate-700 focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6]">← All Games</button>
          </div>
        </div>
      </div>
    </div>
  )
}
