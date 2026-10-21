import { useEffect, useRef, useState } from 'react'

// The one place that knows where the Pao poses live (public/games/Pao_v3/svg/).
// Vercel is case-sensitive: keep "Pao_v3" exactly.
export const PAO_BASE = '/games/Pao_v3/svg'
export const paoSrc = (pose) => `${PAO_BASE}/${pose}.svg`

export const PAO_POSES = [
  'pao-hello', 'pao-stretch', 'pao-juggle', 'pao-carry', 'pao-ready', 'pao-slow', 'pao-wave-happy', 'pao-idle',
  'pao-idle-happy', 'pao-asking', 'pao-listen', 'pao-point', 'pao-point-talk', 'pao-thinking', 'pao-idea',
  'pao-reading', 'pao-correct', 'pao-proud', 'pao-try-again', 'pao-encourage', 'pao-surprised', 'pao-celebrate',
  'pao-sleepy', 'pao-wizard',
]

let preloaded = false
export function preloadPaoPoses() {
  if (preloaded || typeof Image === 'undefined') return
  preloaded = true
  PAO_POSES.forEach((p) => { new Image().src = paoSrc(p) })
}

const FADE_MS = 200

// Pao in the Pao_v3 art (240x300 canvas, same head/arms/colors in every pose).
// When `pose` changes the old pose fades out while the new one fades in with a small bounce.
export default function PaoSprite({ pose = 'pao-idle', size = 220, className = '', alt }) {
  const height = Math.round(size * 1.25)
  const [shown, setShown] = useState(pose)
  const [prev, setPrev] = useState(null)
  const timer = useRef(null)
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  useEffect(() => { preloadPaoPoses() }, [])

  useEffect(() => {
    if (pose === shown) return undefined
    if (reduced) { setShown(pose); setPrev(null); return undefined }
    setPrev(shown)
    setShown(pose)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setPrev(null), FADE_MS)
    return () => clearTimeout(timer.current)
  }, [pose]) // eslint-disable-line react-hooks/exhaustive-deps

  const img = (p, style, key) => (
    <img key={key} src={paoSrc(p)} alt={p === shown ? (alt || `Pao ${p.replace(/^pao-/, '')}`) : ''} aria-hidden={p === shown ? undefined : true}
      width={size} height={height} draggable={false}
      style={{ position: 'absolute', inset: 0, width: size, height, objectFit: 'contain', ...style }} />
  )

  return (
    <span className={className} style={{ position: 'relative', display: 'inline-block', width: size, height }}>
      <style>{`
        @keyframes paoSpriteIn{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}
        @keyframes paoSpriteOut{from{opacity:1}to{opacity:0}}
      `}</style>
      {prev && img(prev, { animation: `paoSpriteOut ${FADE_MS}ms ease forwards` }, `prev-${prev}`)}
      {img(shown, prev ? { animation: `paoSpriteIn ${FADE_MS}ms ease both` } : {}, `cur-${shown}`)}
    </span>
  )
}
