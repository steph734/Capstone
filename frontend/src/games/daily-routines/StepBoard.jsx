import { Volume2 } from 'lucide-react'
import Picture from './pictures/Picture'

// The numbered slots 1-6. Placed steps show their picture and text.
export default function StepBoard({ task, slots, done, onHear }) {
  const nextIdx = slots.findIndex((s) => !s)
  return (
    <div className={`dr-board${done ? ' done' : ''}`}>
      <div className="dr-boardhead">
        <div>
          <span className="dr-label">{done ? 'You did it!' : 'Put the steps in order'}</span>
          <strong className="dr-boardtitle">{done ? `${task.name}: done!` : task.name}{task.note && !done ? <small> · {task.note}</small> : null}</strong>
        </div>
        <button type="button" className="dr-hearbtn" onClick={onHear}><Volume2 size={20} aria-hidden="true" /> {done ? 'Hear all steps' : 'Hear the steps so far'}</button>
      </div>
      <div className="dr-slots">
        {slots.map((s, i) => (
          <div key={i} className={`dr-slot${s ? ' filled' : i === nextIdx ? ' next' : ''}`} data-slot={i} aria-label={`step ${i + 1} of ${slots.length}${s ? `: ${s.text}` : ', empty'}`}>
            <span className="dr-num">{i + 1}</span>
            {s ? (
              <>
                <div className="dr-slotpic"><Picture name={`${task.id}:${s.id}`} /></div>
                <span className="dr-slottext">{s.text}</span>
              </>
            ) : i === nextIdx ? <b className="dr-q">?</b> : null}
          </div>
        ))}
      </div>
    </div>
  )
}
