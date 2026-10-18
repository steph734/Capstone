import { Award, Check, Star } from 'lucide-react'
import { GoBagArt } from './illustrations/Scene'

export default function EmergencyDone({ emergency, learnedCount, total, reward, stars, onAnother, onBack }) {
  const xp = reward ? reward.xpEarned : null
  const gotBadge = reward?.badges?.length > 0
  return (
    <div className="er-main">
      <div className="er-donecard">
        <div className="er-donehead">
          <GoBagArt className="er-donebag" />
          <div>
            <h2>{emergency.name}: you are ready!</h2>
            <p>You learned what it is, what to do, and you packed the go-bag.</p>
            <div className="er-starsrow" aria-label={`${stars} out of 3 stars`}>
              {[1, 2, 3].map((n) => <Star key={n} size={30} fill={n <= stars ? '#ffc83d' : 'none'} color={n <= stars ? '#ffc83d' : '#b9cde0'} strokeWidth={2.2} aria-hidden="true" />)}
            </div>
          </div>
        </div>
        <ol className="er-donesteps">{emergency.steps.map((s) => <li key={s.title}><span><Check size={14} strokeWidth={4} aria-hidden="true" /></span>{s.title}</li>)}</ol>
      </div>
      <div className="er-nav">
        <button type="button" className="er-white" onClick={onBack}>Back to games</button>
        <button type="button" className="er-startbtn" onClick={onAnother}>Pick another emergency</button>
      </div>
    </div>
  )
}
