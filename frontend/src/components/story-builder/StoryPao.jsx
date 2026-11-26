import { useCallback, useEffect, useRef, useState } from 'react'
import { animatedPoseUrl, staticStyleUrl } from '../pao/PaoAvatar'
import { STORY_REACTIONS, REACTION_MS } from '../../games/storyBuilder/paoReactions'
import { StoryScroll } from '../../games/storyBuilder/storyCostume'
import { PaoProp } from '../../games/pictureWord/PaoProps'

const pick = (a) => a[Math.floor(Math.random() * a.length)]
const fill = (line, vars) => line.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : ''))

// Pao for Story Builder. Reactions are temporary client-side overrides: a one-off (correct, tryAgain, streak ...)
// lasts REACTION_MS and the newest wins; "listening" lasts as long as the narration audio plays. Nothing is saved
// and the style endpoint is never called.
export function useStoryPao(baseVars = {}) {
  const [fxKey, setFx] = useState(null)
  const [listening, setListening] = useState(false)
  const [line, setLine] = useState('')
  const timer = useRef(null)
  const varsRef = useRef(baseVars)
  varsRef.current = baseVars

  const lineFor = useCallback((key, extra = {}) => {
    const def = STORY_REACTIONS[key]
    return def ? fill(pick(def.lines), { ...varsRef.current, ...extra }) : ''
  }, [])
  // `text` is the game's own wording for this moment (what is also spoken), when it has one.
  const fx = useCallback((key, extra = {}, text) => {
    const shown = text ?? lineFor(key, extra)
    clearTimeout(timer.current)
    setFx(key)
    setLine(shown)
    timer.current = setTimeout(() => setFx(null), REACTION_MS)
    return shown
  }, [lineFor])
  const say = useCallback((text) => setLine(text), [])
  useEffect(() => () => clearTimeout(timer.current), [])

  return { view: fxKey || (listening ? 'listening' : null), line, fx, say, setListening, lineFor }
}

// Pao in the Storyteller costume. Render order in one position:relative wrapper: the pose picture, the story scroll,
// then the prop (headphones). All share the same width, height and viewBox.
export function PaoStage({ view, height = 250 }) {
  const def = view ? STORY_REACTIONS[view] : null
  const pose = def?.pose || 'relax'
  const [failed, setFailed] = useState('')
  const w = Math.round((height * 250) / 322)
  return (
    <div className="sbn-pao" style={{ width: w, height }} aria-hidden="true">
      <div style={{ position: 'relative', width: w, height }}>
        <img
          key={pose} src={failed === pose ? staticStyleUrl('pose', pose) : animatedPoseUrl(pose)} alt="" draggable={false}
          style={{ width: w, height, objectFit: 'contain', display: 'block' }} onError={() => setFailed(pose)}
        />
        <StoryScroll width={w} height={height} />
        <PaoProp kind={def?.prop || null} width={w} height={height} />
      </div>
    </div>
  )
}

export function PaoBubble({ text, className = '' }) {
  if (!text) return null
  return <div className={`sbn-bubble ${className}`}>{text}</div>
}
