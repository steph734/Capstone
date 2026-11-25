import { Rocket, Search, Sparkles } from 'lucide-react'
import { DIFFICULTY, SPEED_ORDER } from './config'

const STEPS = [
  { Icon: Search, title: 'Find the letter', text: 'Pao tells you which letter to pop.' },
  { Icon: Sparkles, title: 'Pao blasts a star', text: 'Tap the letter ball and watch it pop.' },
  { Icon: Rocket, title: 'Beat the black hole', text: 'Pop A to Z before the chain gets there.' },
]

// Shown before the first run and after "Play again". The board sits dimmed behind it and the timer is stopped.
export default function IntroModal({ speed, onSpeed, onStart, avatar }) {
  return (
    <div className="ab-overlay" role="dialog" aria-modal="true" aria-labelledby="ab-intro-title">
      <div className="ab-card ab-intro">
        <div className="ab-intro-pao">{avatar}</div>
        <p className="ab-kicker">Speech &amp; Language</p>
        <h2 id="ab-intro-title">Alphabet Blast</h2>
        <p className="ab-goal">Pop the letters from A to Z before the chain reaches the black hole.</p>
        <div className="ab-steps">
          {STEPS.map(({ Icon, title, text }, i) => (
            <div key={title} className="ab-step">
              <span className="ab-step-icon"><Icon size={24} aria-hidden="true" /></span>
              <b>{i + 1}. {title}</b>
              <small>{text}</small>
            </div>
          ))}
        </div>
        <div className="ab-diff" role="radiogroup" aria-label="Difficulty">
          {SPEED_ORDER.map((k) => (
            <button key={k} type="button" role="radio" aria-checked={speed === k} className={speed === k ? 'on' : ''} onClick={() => onSpeed(k)}>{DIFFICULTY[k]}</button>
          ))}
        </div>
        <button type="button" className="ab-big green wide" onClick={onStart} autoFocus>Start blasting</button>
      </div>
    </div>
  )
}
