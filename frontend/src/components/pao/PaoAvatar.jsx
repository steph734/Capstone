import { useState } from 'react'

// Animated Pao expression, served from /public (never bundled):
//   /games/pao-poses-expressions/animated/bare/expr_<key>.svg
// Each SVG carries its own CSS animation and turns it off under
// prefers-reduced-motion, so nothing moves for people who ask for that.
//
//   <PaoAvatar expression="love" size={180} />            full body
//   <PaoAvatar expression="love" variant="bust" />        cropped to head and chest (cards)
//
// If the animated file fails to load, the static PNG of the same expression
// is shown instead.
const BASE = '/games/pao-poses-expressions'
const ASPECT = 302 / 218 // viewBox of the animated art

export function animatedExpressionUrl(key) {
  return `${BASE}/animated/bare/expr_${key}.svg`
}

export default function PaoAvatar({ expression, size = 180, variant = 'full', className = '', alt = '' }) {
  const [failed, setFailed] = useState(false)
  if (!expression) return null
  const src = failed ? `${BASE}/expressions/expr_${expression}.png` : animatedExpressionUrl(expression)

  if (variant === 'bust') {
    // Fills its parent (the card thumbnail); crops to the head and chest.
    return (
      <img
        src={src} alt={alt} draggable={false} className={className}
        style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 8%', display: 'block' }}
        onError={() => setFailed(true)}
      />
    )
  }
  return (
    <img
      src={src} alt={alt} draggable={false} className={className}
      width={size} height={Math.round(size * ASPECT)}
      style={{ objectFit: 'contain', display: 'block' }}
      onError={() => setFailed(true)}
    />
  )
}
