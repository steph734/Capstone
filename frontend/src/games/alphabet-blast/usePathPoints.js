import { useMemo } from 'react'
import { buildPathD } from './config'

export const STEP = 2

// Samples the track once (getTotalLength / getPointAtLength) so the game loop only does array lookups.
export default function usePathPoints() {
  return useMemo(() => {
    const d = buildPathD()
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('d', d)
    const length = path.getTotalLength()
    const n = Math.ceil(length / STEP) + 1
    const pts = new Float32Array(n * 2)
    for (let i = 0; i < n; i += 1) {
      const p = path.getPointAtLength(Math.min(length, i * STEP))
      pts[i * 2] = p.x
      pts[i * 2 + 1] = p.y
    }
    const at = (dist, out) => {
      const f = Math.min(Math.max(dist, 0), length) / STEP
      const i = Math.min(Math.floor(f), n - 2)
      const t = f - i
      out.x = pts[i * 2] + (pts[i * 2 + 2] - pts[i * 2]) * t
      out.y = pts[i * 2 + 1] + (pts[i * 2 + 3] - pts[i * 2 + 1]) * t
      return out
    }
    return { d, length, at }
  }, [])
}
