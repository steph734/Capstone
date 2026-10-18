import { Award, Star } from 'lucide-react'

// The reward card under the finished board.
export default function TaskDone({ task, reward, stars, onAgain, onPick }) {
  const xp = reward ? reward.xpEarned : null
  return (
    <div className="dr-done">
      <div className="dr-starsrow" aria-label={`${stars} out of 3 stars`}>
        {[1, 2, 3].map((n) => <Star key={n} size={34} fill={n <= stars ? '#ffc83d' : 'none'} color={n <= stars ? '#ffc83d' : '#d9c3a8'} strokeWidth={2.2} aria-hidden="true" />)}
      </div>
      <div className="dr-doneactions">
        <button type="button" className="dr-white" onClick={onAgain}>Play again</button>
        <button type="button" className="dr-startbtn" onClick={onPick}>Pick another task</button>
      </div>
    </div>
  )
}
