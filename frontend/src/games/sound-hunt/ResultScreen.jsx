import { Award, Clock, Lightbulb, Star, Target } from 'lucide-react'
import PaoGuide from './PaoGuide'

const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
const First = ({ word }) => <><span className="sh-orange">{word.charAt(0).toUpperCase()}</span>{word.slice(1)}</>

export default function ResultScreen({ name, stars, rows, firstTry, hints, seconds, reward, profile, sound, reduceMotion, onBack, onAgain }) {
  const xpPct = profile?.xpToNext ? Math.min(100, Math.round((profile.xp / profile.xpToNext) * 100)) : 100
  const line = { pose: 'soundHunter', message: 'You are a *Sound Hunter*!', speech: 'You are a Sound Hunter!', speak: sound, id: 1 }
  return (
    <div className="sh-overlay solid" role="dialog" aria-modal="true" aria-labelledby="sh-done-title">
      {!reduceMotion && <div className="sh-confetti big" aria-hidden="true">{Array.from({ length: 40 }, (_, i) => <i key={i} style={{ left: `${(i * 89) % 100}%`, animationDelay: `${(i % 8) * 0.1}s`, background: ['#ffd23f', '#4ade80', '#60a5fa', '#f472b6', '#fb923c'][i % 5] }} />)}</div>}
      <div className="sh-modal sh-result">
        <div className="sh-stars" aria-label={`${stars} out of 3 stars`}>
          {[1, 2, 3].map((n) => <Star key={n} size={56} fill={n <= stars ? '#ffd23f' : 'none'} color={n <= stars ? '#ffd23f' : '#bfe3d1'} strokeWidth={2.2} aria-hidden="true" />)}
        </div>
        <h2 id="sh-done-title">Sound Hunter!</h2>
        <p className="sh-sub">Great job, {name}! You found 15 words in 5 sounds.</p>
        <div className="sh-rows">
          {rows.map((r) => (
            <div key={r.id} className="sh-row">
              <span className="sh-rowletter">{r.letter}</span>
              <span className="sh-rowwords">{r.words.map((w) => <span key={w}><First word={w} /></span>)}</span>
            </div>
          ))}
        </div>
        <div className="sh-stats3">
          <div><Target size={20} aria-hidden="true" /><small>First try</small><b>{firstTry} / 15</b></div>
          <div><Lightbulb size={20} aria-hidden="true" /><small>Hints used</small><b>{hints}</b></div>
          <div><Clock size={20} aria-hidden="true" /><small>Time</small><b>{fmt(seconds)}</b></div>
        </div>
        <div className="sh-rewards">
          <div className="sh-reward"><Award size={26} aria-hidden="true" /><span>Sound Hunter badge</span>{reward?.badges?.length > 0 && <em>NEW</em>}</div>
          <div className="sh-reward col">
            <span><Star size={22} fill="#ffd23f" color="#ffd23f" aria-hidden="true" /> +{reward?.xpEarned ?? 100} XP{profile ? ` · Level ${profile.level}` : ''}</span>
            <div className="sh-bar"><i style={{ width: `${xpPct}%` }} /></div>
          </div>
        </div>
        <div className="sh-result-btns">
          <button type="button" className="sh-big" onClick={onBack}>Back to games</button>
          <button type="button" className="sh-big primary" onClick={onAgain}>Play again</button>
        </div>
        <div className="sh-result-pao"><PaoGuide line={line} /></div>
      </div>
    </div>
  )
}
