import { Award, Check, Clock, Lightbulb, Star, Target } from 'lucide-react'
import PaoGuide from './PaoGuide'
import { LEVEL_COLOR, LEVEL_LABEL } from './sentences'

const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

export default function ResultScreen({ name, stars, puzzles, perfect, hints, seconds, reward, profile, sound, reduceMotion, onBack, onAgain }) {
  const xpPct = profile?.xpToNext ? Math.min(100, Math.round((profile.xp / profile.xpToNext) * 100)) : 100
  const line = { pose: 'sentenceStar', message: 'You are a *Sentence Star*!', speech: 'You are a Sentence Star!', speak: sound, id: 1 }
  return (
    <div className="sb-overlay solid" role="dialog" aria-modal="true" aria-labelledby="sb-done-title">
      {!reduceMotion && <div className="sb-confetti big" aria-hidden="true">{Array.from({ length: 40 }, (_, i) => <i key={i} style={{ left: `${(i * 89) % 100}%`, animationDelay: `${(i % 8) * 0.1}s`, background: ['#ffd23f', '#4ade80', '#60a5fa', '#f472b6', '#fb923c'][i % 5] }} />)}</div>}
      <div className="sb-modal sb-result">
        <div className="sb-stars" aria-label={`${stars} out of 3 stars`}>
          {[1, 2, 3].map((n) => <Star key={n} size={56} fill={n <= stars ? '#ffd23f' : 'none'} color={n <= stars ? '#ffd23f' : '#d3c9f3'} strokeWidth={2.2} aria-hidden="true" />)}
        </div>
        <h2 id="sb-done-title">Sentence Star!</h2>
        <p className="sb-sub">Great job, {name}! You built 7 sentences, from easy to hard.</p>
        <div className="sb-built">
          {['easy', 'medium', 'hard'].map((lv) => (
            <div key={lv} className="sb-built-group">
              <span className="sb-level" style={{ background: LEVEL_COLOR[lv] }}>{LEVEL_LABEL[lv]}</span>
              {puzzles.filter((p) => p.level === lv).map((p) => (
                <div key={p.id} className="sb-built-row">
                  <span className="sb-built-words">{p.words.map((w, i) => <span key={i} className={`t-${w.type}`}>{w.text}</span>)}.</span>
                  {p.perfect ? <Check size={18} color="#2e9d63" aria-label="Perfect" /> : <Lightbulb size={18} color="#f08a1c" aria-label="Needed help" />}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="sb-stats3">
          <div><Target size={20} aria-hidden="true" /><small>Perfect</small><b>{perfect} / 7</b></div>
          <div><Lightbulb size={20} aria-hidden="true" /><small>Hints used</small><b>{hints}</b></div>
          <div><Clock size={20} aria-hidden="true" /><small>Time</small><b>{fmt(seconds)}</b></div>
        </div>
        <div className="sb-result-btns">
          <button type="button" className="sb-big" onClick={onBack}>Back to games</button>
          <button type="button" className="sb-big primary" onClick={onAgain}>Play again</button>
        </div>
        <div className="sb-result-pao"><PaoGuide line={line} /></div>
      </div>
    </div>
  )
}
