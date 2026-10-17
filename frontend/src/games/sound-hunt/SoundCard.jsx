import { Check, Volume2 } from 'lucide-react'

export default function SoundCard({ round, found, onHear }) {
  return (
    <div className="sh-soundcard">
      <div className="sh-letter" aria-hidden="true"><b>{round.letter}</b></div>
      <div className="sh-soundtext">
        <span className="sh-label">Find the things that start with</span>
        <strong className="sh-bigsound">the <span className="sh-orange">/{round.sound}/</span> sound</strong>
        <button type="button" className="sh-hear" onClick={onHear}><Volume2 size={20} aria-hidden="true" /> Hear the sound</button>
      </div>
      <div className="sh-found">
        <span className="sh-label">Found {found} of 3</span>
        <div className="sh-boxes">
          {[0, 1, 2].map((i) => <span key={i} className={`sh-box${i < found ? ' on' : ''}`}>{i < found && <Check size={30} strokeWidth={4} aria-hidden="true" />}</span>)}
        </div>
      </div>
    </div>
  )
}
