import { Clock, Flame, Home, RotateCcw, Star, Target, Trophy } from 'lucide-react'

const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

// badge: { name, progress, target, rewardOutfit, earned } from the badge API, or null (row hidden).
export default function ResultScreen({ name, stars, letters, seconds, correct, total, streak, badge, avatar, preview, reduceMotion, onBack, onAgain }) {
  const accuracy = total ? Math.round((correct / total) * 100) : 0
  const pct = badge && badge.target ? Math.min(100, Math.round(((badge.progress || 0) / badge.target) * 100)) : 0
  const left = badge && badge.target ? Math.max(0, badge.target - (badge.progress || 0)) : 0
  const badgeNote = !badge ? '' : badge.earned ? 'Badge earned!' : left > 0 ? `${left} more win${left === 1 ? '' : 's'} unlocks ${badge.rewardOutfit || 'this badge'}` : ''
  return (
    <div className="ab-overlay" role="dialog" aria-modal="true" aria-labelledby="ab-done-title">
      {!reduceMotion && <div className="ab-confetti" aria-hidden="true">{Array.from({ length: 30 }, (_, i) => <i key={i} style={{ left: `${(i * 97) % 100}%`, animationDelay: `${(i % 9) * 0.1}s`, background: ['#FFD43B', '#4ade80', '#60a5fa', '#f472b6', '#fb923c'][i % 5] }} />)}</div>}
      <div className="ab-card ab-result">
        <h2 id="ab-done-title">You popped {letters[0]} to {letters[letters.length - 1]}!</h2>
        <p className="ab-says">Pao says: &ldquo;Amazing blasting, {name}!&rdquo;</p>
        <div className="ab-result-hero">
          <div className="ab-result-pao">{avatar}</div>
          <div className="ab-stars" role="img" aria-label={`${stars} out of 3 stars`}>
            {[1, 2, 3].map((n) => <Star key={n} className={n === 2 ? 'mid' : ''} size={n === 2 ? 84 : 62} fill={n <= stars ? '#FFD43B' : '#3A3480'} color={n <= stars ? '#F2A900' : '#2A2570'} strokeWidth={2.4} aria-hidden="true" />)}
          </div>
        </div>
        <div className="ab-stats">
          <div><span className="ab-tile" style={{ background: '#6366F1' }}><Clock size={20} aria-hidden="true" /></span><b>{fmt(seconds)}</b><small>Time</small></div>
          <div><span className="ab-tile" style={{ background: '#10B981' }}><Target size={20} aria-hidden="true" /></span><b>{accuracy}%</b><small>Accuracy</small></div>
          <div><span className="ab-tile" style={{ background: '#F97316' }}><Flame size={20} aria-hidden="true" /></span><b>{streak}</b><small>Best streak</small></div>
          <div><span className="ab-tile" style={{ background: '#F59E0B' }}><Star size={20} aria-hidden="true" /></span><b>{stars} of 3</b><small>Stars</small></div>
        </div>
        {badge && badge.target > 0 && (
          <div className="ab-badge-row">
            <span className="ab-badge-icon"><Trophy size={22} aria-hidden="true" /></span>
            <div className="ab-badge-mid">
              <b>{badge.name}</b>
              <div className="ab-bar" role="progressbar" aria-valuemin={0} aria-valuemax={badge.target} aria-valuenow={badge.progress || 0}><i style={{ width: `${pct}%` }} /></div>
            </div>
            <div className="ab-badge-right"><b>{badge.progress || 0}/{badge.target}</b>{badgeNote && <small>{badgeNote}</small>}</div>
          </div>
        )}
        <div className="ab-result-btns">
          <button type="button" className="ab-big green" onClick={onAgain} autoFocus><RotateCcw size={22} aria-hidden="true" /> Play again</button>
          <button type="button" className="ab-big light" onClick={onBack}><Home size={22} aria-hidden="true" /> Back to games</button>
        </div>
        {preview && <p className="ab-foot">Preview mode: this score was not saved</p>}
      </div>
    </div>
  )
}
