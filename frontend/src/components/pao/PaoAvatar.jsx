import { useState } from 'react'

// Animated Pao, served from /public (never bundled):
//   /games/pao-poses-expressions/animated/bare/expr_<key>.svg        expressions
//   /games/pao-poses-expressions/animated-poses/bare/pose_<key>.svg  poses
// Each SVG carries its own CSS animation and turns it off under
// prefers-reduced-motion, so nothing moves for people who ask for that.
// Pose and expression are exclusive: pass one of them.
//
//   <PaoAvatar pose="dance" size={180} />        full body
//   <PaoAvatar expression="love" variant="bust" />   head and chest (fills parent)
//   <PaoAvatar pose="jump" variant="card" />          full body, fits parent (cards)
//
// If the animated file fails to load, the static PNG of the same look is shown.
const BASE = '/games/pao-poses-expressions'
const ASPECT = 302 / 218 // expression viewBox
const POSE_ASPECT = 322 / 250 // pose viewBox

export function animatedExpressionUrl(key) {
  return `${BASE}/animated/bare/expr_${key}.svg`
}
export function animatedPoseUrl(key) {
  return `${BASE}/animated-poses/bare/pose_${key}.svg`
}
export function staticStyleUrl(type, key) {
  return type === 'pose' ? `${BASE}/poses/pose_${key}.png` : `${BASE}/expressions/expr_${key}.png`
}

export default function PaoAvatar({ pose = null, expression = null, size = 180, variant = 'full', className = '', alt = '' }) {
  const [failed, setFailed] = useState(false)
  const type = pose ? 'pose' : expression ? 'expression' : null
  const key = pose || expression
  if (!type) return null
  const src = failed ? staticStyleUrl(type, key) : type === 'pose' ? animatedPoseUrl(key) : animatedExpressionUrl(key)

  if (variant === 'bust' || variant === 'card') {
    // Fills its parent (the card thumbnail).
    return (
      <img
        src={src} alt={alt} draggable={false} className={className}
        style={{ width: '100%', height: '100%', objectFit: variant === 'bust' ? 'cover' : 'contain', objectPosition: variant === 'bust' ? '50% 8%' : '50% 50%', display: 'block' }}
        onError={() => setFailed(true)}
      />
    )
  }
  const aspect = type === 'pose' ? POSE_ASPECT : ASPECT
  return (
    <img
      src={src} alt={alt} draggable={false} className={className}
      width={size} height={Math.round(size * aspect)}
      style={{ objectFit: 'contain', display: 'block' }}
      onError={() => setFailed(true)}
    />
  )
}
