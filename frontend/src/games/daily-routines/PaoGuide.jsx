import { Fragment, useEffect, useRef, useState } from 'react'
import { speakPao, stopPaoVoice } from '../../utils/paoVoice'
import { FALLBACK_PAO, paoPoses } from './paoPoses'

// "*word*" marks step names and key words, shown in green.
export function Marked({ text }) {
  return text.split('*').map((part, i) => (i % 2 ? <span key={i} className="dr-green">{part}</span> : <Fragment key={i}>{part}</Fragment>))
}

// Pao's pose (crossfaded) with a speech bubble. `line` = { pose, message, speech, speak, id }.
export default function PaoGuide({ line }) {
  const [shown, setShown] = useState({ cur: line.pose, prev: null })
  const lastPose = useRef(line.pose)

  useEffect(() => {
    if (lastPose.current === line.pose) return undefined
    const prev = lastPose.current
    lastPose.current = line.pose
    setShown({ cur: line.pose, prev })
    const t = setTimeout(() => setShown((s) => ({ ...s, prev: null })), 220)
    return () => clearTimeout(t)
  }, [line.pose])

  useEffect(() => {
    if (!line.id || !line.speak) return
    const said = (line.speech ?? line.message).replace(/\*/g, '')
    if (said) speakPao(said, { rate: 0.85, pitch: 1.1 })
  }, [line.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => stopPaoVoice(), [])

  const img = (pose, cls) => (
    <img key={`${pose}-${cls}`} className={`dr-pao-img ${cls}`} src={paoPoses[pose]} alt={cls === 'cur' ? 'Pao' : ''} draggable="false"
      onError={(e) => {
        if (e.currentTarget.dataset.fb) return
        e.currentTarget.dataset.fb = '1'
        console.warn(`Daily Routines: pose "${pose}" failed to load, using the default Pao`)
        e.currentTarget.src = FALLBACK_PAO
      }} />
  )

  return (
    <div className="dr-guide">
      <div className={`dr-pao dr-move-${line.pose}`} key={`${line.pose}-${line.id}`}>
        {shown.prev && img(shown.prev, 'prev')}
        {img(shown.cur, 'cur')}
        {line.pose === 'taskDone' && <span className="dr-sparks" aria-hidden="true"><i /><i /><i /></span>}
      </div>
      <div className="dr-bubble" aria-live="polite"><Marked text={line.message} /></div>
    </div>
  )
}
