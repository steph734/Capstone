import { useCallback, useEffect, useRef, useState } from 'react'
import { animatedPoseUrl, staticStyleUrl } from '../pao/PaoAvatar'
import { ECHO_REACTIONS, REACTION_MS } from '../../games/echo/paoReactions'
import { PaoProp, Beats, PAO_VIEWBOX } from '../../games/echo/PaoProps'
import { TurtleBackpack } from '../../games/echo/echoCostume'

const pick = (a) => a[Math.floor(Math.random() * a.length)]
const fill = (line, vars) => line.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : ''))

// Drives Pao for the Echo game. Two kinds of reaction, both temporary overrides (nothing is saved):
//   fx   - a one-off (great, slower, streak ...) that lasts REACTION_MS; the newest one wins, none are queued
//   hold - lasts as long as something is happening (a word is playing, it is the child's turn) until release()
export function useEchoPao(baseVars = {}) {
  const [fxState, setFx] = useState(null) // { key }
  const [held, setHeld] = useState(null) // { key, extra }
  const [line, setLine] = useState('')
  const timer = useRef(null)
  const varsRef = useRef(baseVars)
  varsRef.current = baseVars

  const lineFor = useCallback((key, extra = {}) => {
    const def = ECHO_REACTIONS[key]
    return def ? fill(pick(def.lines), { ...varsRef.current, ...extra }) : ''
  }, [])
  const fx = useCallback((key, extra = {}) => {
    const text = lineFor(key, extra)
    clearTimeout(timer.current)
    setFx({ key })
    setLine(text)
    timer.current = setTimeout(() => setFx(null), REACTION_MS)
    return text
  }, [lineFor])
  const hold = useCallback((key, extra = {}, { withLine = true } = {}) => {
    const text = lineFor(key, extra)
    setHeld({ key, extra })
    if (withLine && text) setLine(text)
    return text
  }, [lineFor])
  const release = useCallback(() => setHeld(null), [])
  const say = useCallback((text) => setLine(text), [])
  useEffect(() => () => clearTimeout(timer.current), [])

  const key = fxState?.key || held?.key || null
  return { view: key, extra: fxState ? {} : held?.extra || {}, line, fx, hold, release, say, lineFor }
}

// Pao in the Pond Explorer costume, standing on the shore. Render order in one position:relative wrapper:
// the pose picture, then the costume accessory (turtle backpack), then the reaction prop. They all share the same
// width, height and viewBox so they line up. (The costume's clothing items are applied via ECHO_COSTUME.look in
// layered renders; see the report: those item keys are not in the layer data yet.)
export function PaoStage({ view, extra = {}, height = 300 }) {
  const def = view ? ECHO_REACTIONS[view] : null
  const pose = def?.pose || 'relax'
  const [failed, setFailed] = useState('')
  const w = Math.round((height * 250) / 322)
  return (
    <div className="ec-pao" style={{ width: w, height }} aria-hidden="true">
      <div style={{ position: 'relative', width: w, height }}>
        <img
          key={pose} src={failed === pose ? staticStyleUrl('pose', pose) : animatedPoseUrl(pose)} alt="" draggable={false}
          style={{ width: w, height, objectFit: 'contain', display: 'block' }} onError={() => setFailed(pose)}
        />
        <TurtleBackpack width={w} height={height} />
        {def?.prop === 'beats' ? (
          <svg viewBox={PAO_VIEWBOX} width={w} height={height} style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
            <Beats count={Math.min(4, Math.max(1, extra.count || 3))} active={extra.active ?? -1} />
          </svg>
        ) : (
          <PaoProp kind={def?.prop || null} width={w} height={height} />
        )}
      </div>
    </div>
  )
}

export function PaoBubble({ text, className = '' }) {
  if (!text) return null
  return <div className={`ec-bubble ${className}`} role="status" aria-live="polite">{text}</div>
}
