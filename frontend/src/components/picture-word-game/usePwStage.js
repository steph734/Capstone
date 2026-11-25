import { useEffect, useState } from 'react'

// Design size 1440x900. At 900px wide and up the stage is scaled to fit the window; under that it becomes a
// normal stacked column (picture card above the answers, smaller Pao).
export const DESIGN = { w: 1440, h: 900 }

export default function usePwStage() {
  const get = () => {
    const w = window.innerWidth
    const h = window.innerHeight
    if (w < 900) return { narrow: true, style: undefined }
    const scale = Math.min(w / DESIGN.w, h / DESIGN.h)
    return { narrow: false, style: { width: DESIGN.w, height: DESIGN.h, transform: `translate(${(w - DESIGN.w * scale) / 2}px, ${(h - DESIGN.h * scale) / 2}px) scale(${scale})` } }
  }
  const [s, setS] = useState(get)
  useEffect(() => {
    const on = () => setS(get())
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return s
}
