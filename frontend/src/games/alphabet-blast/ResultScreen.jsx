import { Award, Clock, Flame, Star, Target } from 'lucide-react'

const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

export default function ResultScreen({ name, stars, letters, seconds, correct, total, streak, reward, profile, reduceMotion, onBack, onAgain }) {
  const xpPct = profile?.xpToNext ? Math.min(100, Math.round((profile.xp / profile.xpToNext) * 100)) : 100
  return (
    <div className="ab-overlay solid" role="dialog" aria-modal="true" aria-labelledby="ab-done-title">
      {!reduceMotion && <div className="ab-confetti" aria-hidden="true">{Array.from({ length: 36 }, (_, i) => <i key={i} style={{ left: `${(i * 97) % 100}%`, animationDelay: `${(i % 9) * 0.1}s`, background: ['#ffd23f', '#4ade80', '#60a5fa', '#f472b6', '#fb923c'][i % 5] }} />)}</div>}
      <div className="ab-card ab-result">
        <div className="ab-stars" aria-label={`${stars} out of 3 stars`}>
          {[1, 2, 3].map((n) => <Star key={n} size={64} fill={n <= stars ? '#ffd23f' : 'none'} color={n <= stars ? '#ffd23f' : '#c9c3ea'} strokeWidth={2.2} aria-hidden="true" />)}
        </div>
        <h2 id="ab-done-title">Mission complete!</h2>
        <p className="ab-sub">Great job, {name}! You blasted through {letters[0]} to {letters[letters.length - 1]}.</p>
        <div className="ab-done-row">{letters.map((l) => <span key={l} className="ab-chip done">{l}</span>)}</div>
        <div className="ab-stats">
          <div><Clock size={22} aria-hidden="true" /><small>Time</small><b>{fmt(seconds)}</b></div>
          <div><Target size={22} aria-hidden="true" /><small>Correct taps</small><b>{correct} / {total}</b></div>
          <div><Flame size={22} aria-hidden="true" /><small>Best streak</small><b>{streak}</b></div>
        </div>
        <div className="ab-result-btns">
          <button type="button" className="ab-big" onClick={onBack}>Back to games</button>
          <button type="button" className="ab-big primary" onClick={onAgain}>Play again</button>
        </div>
      </div>
    </div>
  )
}
