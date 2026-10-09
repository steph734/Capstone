import PaoLayered from './PaoLayered'

const HEADING = { fontFamily: "'Baloo 2', system-ui, sans-serif" }
const BODY = { fontFamily: "'Atkinson Hyperlegible', system-ui, sans-serif" }

// The small Pao that sits in the corner of every game, reacting to what's
// happening. Bottom-left, 120-160px, bubble to its right, never covering
// answer buttons (it's a fixed corner, not part of the game's own layout —
// games should leave that corner clear). `overflow: visible` on the pose
// wrapper so pointing-pose arrows that reach past the 300x380 box don't clip.
//
//   const paoGame = usePaoGameReactions('puzzle-pals', { calm })
//   <CornerPao equipped={outfit} pose={paoGame.pose} bubble={paoGame.bubble} showFx={paoGame.showFx} />
export default function CornerPao({ equipped = {}, pose = 'idle', bubble = '', showFx = true, size = 140, className = '' }) {
  return (
    <div className={`pointer-events-none fixed bottom-4 left-4 z-[60] flex items-end gap-2 ${className}`} style={{ overflow: 'visible' }}>
      <div style={{ width: size, overflow: 'visible', flexShrink: 0 }}>
        <PaoLayered equipped={equipped} pose={pose} showFx={showFx} size={size} />
      </div>
      {bubble && (
        <p
          aria-live="polite"
          className="mb-2 max-w-[220px] rounded-[16px_16px_16px_4px] bg-white px-3.5 py-2 shadow-[0_4px_14px_rgba(0,0,0,.15)]"
          style={{ ...BODY, fontSize: 15, fontWeight: 700, color: '#2B2A4C' }}
        >
          {bubble}
        </p>
      )}
    </div>
  )
}

export { HEADING, BODY }
