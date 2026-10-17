import { Volume2 } from 'lucide-react'
import Picture from './pictures/Picture'
import { split } from './rounds'

export function Rhymed({ word, end }) {
  const [a, b] = split(word, end)
  return <>{a.toUpperCase()}<span className="rt-pink">{b.toUpperCase()}</span></>
}

export default function WordCard({ round, onHear }) {
  return (
    <div className="rt-wordcard">
      <div className="rt-wordpic"><Picture word={round.word} /></div>
      <div className="rt-wordtext">
        <span className="rt-label">What rhymes with</span>
        <strong className="rt-bigword"><Rhymed word={round.word} end={round.wordEnd} /></strong>
        <button type="button" className="rt-hear" onClick={onHear}><Volume2 size={20} aria-hidden="true" /> Hear it</button>
      </div>
    </div>
  )
}
