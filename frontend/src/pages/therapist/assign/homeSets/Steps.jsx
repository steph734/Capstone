// The 3-step tracker: 1 Home games finished · 2 Review SOAP note · 3 Assign new set.
// `step` is the step that is current (1-3); steps before it show a check, steps after it a lock. Step 3 stays locked until the note is signed.
const DEFAULT = [['Home games finished', ''], ['Review SOAP note', 'Draft ready'], ['Assign new set', 'Suggested set ready']]

export default function Steps({ step, playsText, labels = DEFAULT, style }) {
  const items = labels.map(([title, sub], i) => [title, i === 0 && playsText ? playsText : sub])
  return (
    <ol className="hs-tracker" style={style} aria-label="Steps">
      {items.map(([title, sub], i) => {
        const n = i + 1
        const state = n < step ? 'done' : n === step ? 'now' : 'todo'
        return (
          <li key={title} className={state} aria-current={state === 'now' ? 'step' : undefined}>
            <span className="hs-step-dot" aria-hidden="true">{state === 'done' ? '✓' : state === 'now' ? n : '🔒'}</span>
            <span className="hs-step-text"><b>{state === 'done' && n === 2 ? 'SOAP note signed' : title}</b><small>{sub}</small></span>
          </li>
        )
      })}
    </ol>
  )
}
