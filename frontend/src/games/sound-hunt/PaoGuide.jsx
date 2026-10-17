import { Fragment, useEffect, useRef, useState } from 'react'
import { speakPao, stopPaoVoice } from '../../utils/paoVoice'
import { FALLBACK_PAO, paoPoses } from './paoPoses'
import { TTS_SOUND } from './rounds'

// "*b*" marks a sound or a first letter, shown in orange.
export function Marked({ text }) {
  return text.split('*').map((part, i) => (i % 2 ? <span key={i} className="sh-orange">{part}</span> : <Fragment key={i}>{part}</Fragment>))
}

// Say sounds as the sound ("buh"), not the letter name ("bee"): /b/ becomes "buh".
export const toSpeech = (text) => text.replace(/\*/g, '').replace(/\/([a-z])\//gi, (_, s) => TTS_SOUND[s.toLowerCase()] || s)

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
    const said = toSpeech(line.speech ?? line.message)
    if (said) speakPao(said, { rate: 0.85, pitch: 1.1 })
  }, [line.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => stopPaoVoice(), [])

  const img = (pose, cls) => (
    <img key={`${pose}-${cls}`} className={`sh-pao-img ${cls}`} src={paoPoses[pose]} alt={cls === 'cur' ? 'Pao' : ''} draggable="false"
      onError={(e) => {
        if (e.currentTarget.dataset.fb) return
        e.currentTarget.dataset.fb = '1'
        console.warn(`Sound Hunt: pose "${pose}" failed to load, using the default Pao`)
        e.currentTarget.src = FALLBACK_PAO
      }} />
  )

  return (
    <div className="sh-guide">
      <div className={`sh-pao sh-move-${line.pose}`} key={`${line.pose}-${line.id}`}>
        {shown.prev && img(shown.prev, 'prev')}
        {img(shown.cur, 'cur')}
        {line.pose === 'roundDone' && <span className="sh-sparks" aria-hidden="true"><i /><i /><i /></span>}
      </div>
      <div className="sh-bubble" aria-live="polite"><Marked text={line.message} /></div>
    </div>
  )
}
