import { useCallback, useEffect, useRef, useState } from 'react'
import { animatedPoseUrl, staticStyleUrl } from '../pao/PaoAvatar'
import { SPOT_REACTIONS, REACTION_MS } from '../../games/spotDifference/paoReactions'
import { MoonPillow, Magnifier } from '../../games/spotDifference/spotCostume'

const pick = (a) => a[Math.floor(Math.random() * a.length)]
const fill = (line, vars) => line.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : ''))

// One-off reactions only: each is a temporary override that lasts REACTION_MS, the newest wins, none are queued.
// Nothing is saved and the style endpoint is never called.
export function useSpotPao(baseVars = {}) {
  const [view, setView] = useState(null)
  const [line, setLine] = useState('')
  const timer = useRef(null)
  const varsRef = useRef(baseVars)
  varsRef.current = baseVars

  const lineFor = useCallback((key, extra = {}) => {
    const def = SPOT_REACTIONS[key]
    return def ? fill(pick(def.lines), { ...varsRef.current, ...extra }) : ''
  }, [])
  // `text` overrides the line when the game already has its own wording for this moment.
  const fx = useCallback((key, extra = {}, text) => {
    const shown = text ?? lineFor(key, extra)
    clearTimeout(timer.current)
    setView(key)
    setLine(shown)
    timer.current = setTimeout(() => setView(null), REACTION_MS)
    return shown
  }, [lineFor])
  const say = useCallback((text) => setLine(text), [])
  useEffect(() => () => clearTimeout(timer.current), [])
  return { view, line, fx, say, lineFor }
}

// Pao in the Pajama Detective costume. Render order in one position:relative wrapper: the pose picture, the moon
// pillow, then the magnifier when the reaction asks for it. All share the same width, height and viewBox.
export function PaoStage({ view, height = 300 }) {
  const def = view ? SPOT_REACTIONS[view] : null
  const pose = def?.pose || 'relax'
  const [failed, setFailed] = useState('')
  const w = Math.round((height * 250) / 322)
  return (
    <div className="sd-pao" style={{ width: w, height }} aria-hidden="true">
      <div style={{ position: 'relative', width: w, height }}>
        <img
          key={pose} src={failed === pose ? staticStyleUrl('pose', pose) : animatedPoseUrl(pose)} alt="" draggable={false}
          style={{ width: w, height, objectFit: 'contain', display: 'block' }} onError={() => setFailed(pose)}
        />
        <MoonPillow width={w} height={height} />
        {def?.prop === 'lens' && <Magnifier width={w} height={height} />}
      </div>
    </div>
  )
}

export function PaoBubble({ text }) {
  if (!text) return null
  return <div className="sd-bubble">{text}</div>
}
