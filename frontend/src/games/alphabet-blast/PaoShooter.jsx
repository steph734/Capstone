import { memo, useMemo } from 'react'
import PaoLayered from '../../components/pao/PaoLayered'
import { useOptionalPao } from '../../context/PaoContext'
import { resolveItemKey, LAYER_CATEGORIES } from '../../components/pao/paoLayers'

// The patient's real equipped outfit (same renderer and keys as Customize Pao), without the hat so the helmet reads.
export function useEquippedNoHat() {
  const profile = useOptionalPao()?.profile
  return useMemo(() => {
    const out = {}
    for (const cat of LAYER_CATEGORIES) {
      if (cat === 'hats') continue
      const it = profile?.equipped?.[cat]
      if (it && it.name) out[cat] = resolveItemKey(it.name)
    }
    return out
  }, [profile])
}

// Pao drawn from the shoulders up inside a round window. Pao's art is a 300x380 box with the head in the upper part.
function PaoHead({ diameter, equipped, pose }) {
  const w = diameter * 1.24 // the head fills about 80% of the window
  return (
    <div style={{ position: 'absolute', left: (diameter - w) / 2, top: -(w * 0.2), width: w, height: w * (380 / 300) }}>
      <PaoLayered equipped={equipped} pose={pose} fill noStyle showFx={false} />
    </div>
  )
}

const StarIcon = () => (
  <svg width="34" height="34" viewBox="-18 -18 36 36" aria-hidden="true">
    <path d="M0,-17 L5,-6.8 L16,-5.3 L8,2.5 L10,13.6 L0,8.4 L-10,13.6 L-8,2.5 L-16,-5.3 L-5,-6.8 Z" fill="#FFD43B" stroke="#B87A00" strokeWidth="2" strokeLinejoin="round" />
  </svg>
)

// Glass helmet bubble on a purple platform, with the red cannon cap that holds the next star.
export const PaoShooter = memo(function PaoShooter({ pos, equipped, pose }) {
  return (
    <div className="ab-shooter" style={{ left: pos.x, top: pos.y }} aria-hidden="true">
      <div className="ab-platform" />
      <div className="ab-helmet">
        <PaoHead diameter={192} equipped={equipped} pose={pose} />
        <span className="ab-gloss" />
      </div>
      <div className="ab-cap"><StarIcon /></div>
    </div>
  )
})

// Small round Pao face for the speech bubble and the intro card.
export const PaoAvatar72 = memo(function PaoAvatar72({ diameter = 72, equipped, pose = 'happy' }) {
  return (
    <div className="ab-avatar" style={{ width: diameter, height: diameter }} aria-hidden="true">
      <PaoHead diameter={diameter - 6} equipped={equipped} pose={pose} />
    </div>
  )
})

// The swirling portal at the end of the track. `danger` turns it red and shows the DANGER pill above it.
export const BlackHole = memo(function BlackHole({ pos, danger }) {
  return (
    <div className={`ab-hole${danger ? ' danger' : ''}`} style={{ left: pos.x, top: pos.y }}>
      {danger && <span className="ab-danger-pill">Danger</span>}
      <div className="ab-hole-ring" aria-hidden="true"><div className="ab-hole-core" /></div>
      <span className="ab-hole-label">Black hole</span>
    </div>
  )
})

// ~100 slowly twinkling CSS stars (stopped for reduced motion in the stylesheet).
export const Sky = memo(function Sky() {
  const stars = useMemo(() => Array.from({ length: 100 }, (_, i) => {
    const r = (n) => { const x = Math.sin(i * 999 + n * 17) * 10000; return x - Math.floor(x) }
    return { x: r(1) * 100, y: r(2) * 100, s: 1 + r(3) * 2.2, d: 3 + r(4) * 5, dl: -r(5) * 8, o: 0.35 + r(6) * 0.6 }
  }), [])
  return (
    <div className="ab-sky" aria-hidden="true">
      {stars.map((s, i) => <i key={i} style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s, opacity: s.o, animationDuration: `${s.d}s`, animationDelay: `${s.dl}s` }} />)}
    </div>
  )
})
