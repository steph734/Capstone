import { useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, HeartHandshake, Volume2 } from 'lucide-react'
import Scene from './illustrations/Scene'
import { shuffle } from './emergencies'

// Learn what to do: one safety step at a time. No quiz; the child just confirms "I can do this step".
export default function SafetySteps({ emergency, idx, confirmed, onConfirm, onHear, onBack, onNext }) {
  const step = emergency.steps[idx]
  const last = idx === emergency.steps.length - 1
  const isDone = confirmed.has(idx)
  return (
    <div className="er-main">
      <div className="er-panel">
        <div className="er-scene"><Scene spec={step.scene} /></div>
        <div className="er-panelbody">
          <span className="er-label">{emergency.name} · Step {idx + 1} of {emergency.steps.length}</span>
          <h2>{step.title}</h2>
          <p>{step.reason}</p>
          <div className="er-stepactions">
            <button type="button" className="er-soft" onClick={() => onHear(`${step.title}. ${step.reason}`)}><Volume2 size={20} aria-hidden="true" /> Hear it again</button>
            <button type="button" className={`er-confirm${isDone ? ' on' : ''}`} onClick={() => onConfirm(idx)}><Check size={20} strokeWidth={3.5} aria-hidden="true" /> I can do this step</button>
          </div>
        </div>
      </div>
      <div className="er-steplist-wrap">
        <ol className="er-steplist" aria-label="All steps">
          {emergency.steps.map((s, i) => (
            <li key={s.title} className={confirmed.has(i) ? 'done' : i === idx ? 'now' : ''}>
              <span>{confirmed.has(i) ? <Check size={14} strokeWidth={4} aria-hidden="true" /> : i + 1}</span>{s.title}
            </li>
          ))}
        </ol>
        <div className="er-tip"><HeartHandshake size={22} aria-hidden="true" /> Take a slow breath. You are doing great.</div>
      </div>
      <div className="er-nav">
        <button type="button" className="er-white" onClick={onBack}><ArrowLeft size={20} aria-hidden="true" /> Back</button>
        <button type="button" className="er-startbtn" onClick={onNext}>{last ? 'Practice' : 'Next step'} <ArrowRight size={20} aria-hidden="true" /></button>
      </div>
    </div>
  )
}

// After the last step: put the 4 step pictures in order. A wrong tap gently returns the card; nothing is lost.
export function PracticeRound({ emergency, onRight, onWrong, onDone }) {
  const cards = useMemo(() => shuffle(emergency.steps.map((s, i) => ({ ...s, i }))), [emergency])
  const [placed, setPlaced] = useState([])
  const [wiggle, setWiggle] = useState(null)
  const next = placed.length
  const tap = (c) => {
    if (placed.includes(c.i)) return
    if (c.i === next) {
      const np = [...placed, c.i]
      setPlaced(np)
      if (np.length === emergency.steps.length) setTimeout(onDone, 600)
      else onRight(c)
    } else {
      setWiggle(c.i)
      setTimeout(() => setWiggle(null), 500)
      onWrong(c)
    }
  }
  return (
    <div className="er-main">
      <div className="er-practice">
        <h2>Practice: what comes {next === 0 ? 'first' : 'next'}?</h2>
        <p>Tap the pictures in order.</p>
        <div className="er-pcards">
          {cards.map((c) => {
            const pos = placed.indexOf(c.i)
            return (
              <button key={c.i} type="button" className={`er-pcard${pos >= 0 ? ' placed' : ''}${wiggle === c.i ? ' wiggle' : ''}`} onClick={() => tap(c)} aria-label={c.title} disabled={pos >= 0}>
                {pos >= 0 && <span className="er-pnum">{pos + 1}</span>}
                <div className="er-pscene"><Scene spec={{ ...c.scene, caption: '' }} alt={c.title} /></div>
                <span>{c.title}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
