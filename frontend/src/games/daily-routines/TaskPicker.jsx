import { ArrowRight, Check } from 'lucide-react'
import Picture from './pictures/Picture'
import { TASKS } from './tasks'

// "What do you want to practice?" - one big card per task.
export default function TaskPicker({ earned, selected, onSelect, onStart, onBack }) {
  const chosen = TASKS.find((t) => t.id === selected)
  return (
    <div className="dr-picker">
      <h1>What do you want to practice?</h1>
      <p>Pick a task. Put the steps in the right order.</p>
      <div className="dr-tasks" role="radiogroup" aria-label="Tasks">
        {TASKS.map((t) => {
          const got = earned.has(t.badgeCode)
          return (
            <button key={t.id} type="button" role="radio" aria-checked={selected === t.id} className={`dr-task${selected === t.id ? ' on' : ''}`} onClick={() => onSelect(t)}>
              {got && <span className="dr-got" aria-hidden="true"><Check size={20} strokeWidth={4} /></span>}
              <div className="dr-taskpic"><Picture name={`cover:${t.id}`} /></div>
              <strong>{t.name}</strong>
              <small>6 steps</small>
              {got ? <span className="dr-badgepill earned"><Check size={13} strokeWidth={4} aria-hidden="true" /> Badge earned</span> : <span className="dr-badgepill">Badge: {t.badge}</span>}
            </button>
          )
        })}
      </div>
      <div className="dr-pickactions">
        <button type="button" className="dr-white" onClick={onBack}>Back</button>
        <button type="button" className="dr-startbtn" onClick={() => chosen && onStart(chosen)} disabled={!chosen}>{chosen ? `Start: ${chosen.name}` : 'Pick a task'} <ArrowRight size={20} aria-hidden="true" /></button>
      </div>
    </div>
  )
}
