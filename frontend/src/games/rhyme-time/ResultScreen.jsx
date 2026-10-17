import { Award, Flame, Lightbulb, Star, Target } from 'lucide-react'
import PaoGuide from './PaoGuide'
import { Rhymed } from './WordCard'

export default function ResultScreen({ name, stars, pairs, firstTry, hints, streak, correct, reward, profile, sound, reduceMotion, onBack, onAgain }) {
  const xpPct = profile?.xpToNext ? Math.min(100, Math.round((profile.xp / profile.xpToNext) * 100)) : 100
  const line = { pose: 'rhymeMaster', message: 'You are a *Rhyme Master*!', speech: 'You are a Rhyme Master!', speak: sound, id: 1 }
  return (
    <div className="rt-overlay solid" role="dialog" aria-modal="true" aria-labelledby="rt-done-title">
      {!reduceMotion && <div className="rt-confetti big" aria-hidden="true">{Array.from({ length: 40 }, (_, i) => <i key={i} style={{ left: `${(i * 89) % 100}%`, animationDelay: `${(i % 8) * 0.1}s`, background: ['#ffd23f', '#4ade80', '#60a5fa', '#f472b6', '#fb923c'][i % 5] }} />)}</div>}
      <div className="rt-card rt-result">
        <div className="rt-stars" aria-label={`${stars} out of 3 stars`}>
          {[1, 2, 3].map((n) => <Star key={n} size={56} fill={n <= stars ? '#ffd23f' : 'none'} color={n <= stars ? '#ffd23f' : '#d3c9f3'} strokeWidth={2.2} aria-hidden="true" />)}
        </div>
        <h2 id="rt-done-title">Rhyme Master!</h2>
        <p className="rt-sub">Great job, {name}! You found {correct} rhymes.</p>
        <div className="rt-pairs">{pairs.map((p) => <span key={p.word}><Rhymed word={p.word} end={p.wordEnd} /> · <Rhymed word={p.answer} end={p.answerEnd} /></span>)}</div>
        <div className="rt-stats3">
          <div><Target size={20} aria-hidden="true" /><small>First try</small><b>{firstTry}</b></div>
          <div><Lightbulb size={20} aria-hidden="true" /><small>Hints used</small><b>{hints}</b></div>
          <div><Flame size={20} aria-hidden="true" /><small>Best streak</small><b>{streak}</b></div>
        </div>
        <div className="rt-rewards">
          <div className="rt-reward"><Award size={26} aria-hidden="true" /><span>Rhyme Master badge</span>{reward?.badges?.length > 0 && <em>NEW</em>}</div>
          <div className="rt-reward col">
            <span><Star size={22} fill="#ffd23f" color="#ffd23f" aria-hidden="true" /> +{reward?.xpEarned ?? 100} XP{profile ? ` · Level ${profile.level}` : ''}</span>
            <div className="rt-bar"><i style={{ width: `${xpPct}%` }} /></div>
          </div>
        </div>
        <div className="rt-result-btns">
          <button type="button" className="rt-big" onClick={onBack}>Back to games</button>
          <button type="button" className="rt-big primary" onClick={onAgain}>Play again</button>
        </div>
        <div className="rt-result-pao"><PaoGuide line={line} /></div>
      </div>
    </div>
  )
}
