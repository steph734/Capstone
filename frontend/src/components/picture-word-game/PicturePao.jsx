import { useCallback, useEffect, useRef, useState } from 'react'
import PaoLayered from '../pao/PaoLayered'
import { animatedPoseUrl, staticStyleUrl } from '../pao/PaoAvatar'
import useEquippedOutfit from '../pao/useEquippedOutfit'
import { PICTURE_WORD_REACTIONS, REACTION_MS } from '../../games/pictureWord/paoReactions'
import { PaoProp } from '../../games/pictureWord/PaoProps'

const pick = (a) => a[Math.floor(Math.random() * a.length)]
const fill = (line, vars) => line.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : ''))

// Drives Pao for one screen. A reaction is a TEMPORARY override: it never touches the saved style or outfit, and
// when it ends (REACTION_MS) the child's own look comes back. The newest reaction wins; reactions are not queued.
// "listening" (headphones) lasts exactly as long as a word is being played.
export function usePictureWordPao(baseVars = {}) {
  const [active, setActive] = useState(null) // { key, line }
  const [listening, setListening] = useState(false)
  const [lastLine, setLastLine] = useState('')
  const timer = useRef(null)
  const varsRef = useRef(baseVars)
  varsRef.current = baseVars

  const play = useCallback((key, extra = {}) => {
    const def = PICTURE_WORD_REACTIONS[key]
    if (!def) return ''
    const line = fill(pick(def.lines), { ...varsRef.current, ...extra })
    clearTimeout(timer.current)
    setActive({ key, line })
    setLastLine(line)
    timer.current = setTimeout(() => setActive(null), REACTION_MS)
    return line
  }, [])

  const say = useCallback((line) => setLastLine(line), [])
  useEffect(() => () => clearTimeout(timer.current), [])

  const view = active?.key || (listening ? 'listening' : null)
  return { view, line: lastLine, play, say, setListening }
}

// Pao standing on the hill. Idle = the real equipped outfit and the child's chosen style (PaoLayered); during a
// reaction = the matching pose picture, with the headphones / magnifier drawn over it.
export function PaoStage({ view, height = 300, className = '' }) {
  const outfit = useEquippedOutfit()
  const def = view ? PICTURE_WORD_REACTIONS[view] : null
  const [failed, setFailed] = useState('')
  const w = Math.round((height * 250) / 322)
  return (
    <div className={`pw-pao ${className}`} style={{ width: w, height }} aria-hidden="true">
      {def ? (
        <div style={{ position: 'relative', width: w, height }}>
          <img
            key={def.pose} src={failed === def.pose ? staticStyleUrl('pose', def.pose) : animatedPoseUrl(def.pose)} alt="" draggable={false}
            style={{ width: w, height, objectFit: 'contain', display: 'block' }} onError={() => setFailed(def.pose)}
          />
          <PaoProp kind={def.prop} width={w} height={height} />
        </div>
      ) : (
        <PaoLayered equipped={outfit} fill />
      )}
    </div>
  )
}

export function PaoBubble({ text, className = '' }) {
  if (!text) return null
  return <div className={`pw-bubble ${className}`} role="status" aria-live="polite">{text}</div>
}
