import { ArrowRight, Check, Phone } from 'lucide-react'
import Scene from './illustrations/Scene'
import { EMERGENCIES } from './emergencies'

// "Which emergency do you want to learn?" - 6 cards in a 3x2 grid.
export default function EmergencyPicker({ shown, learned, selected, hotline, onSelect, onStart, onBack }) {
  const list = EMERGENCIES.filter((e) => shown.includes(e.id))
  const chosen = list.find((e) => e.id === selected)
  return (
    <div className="er-picker">
      <h1>Which emergency do you want to learn?</h1>
      <p>Take your time. There is no timer and no wrong buzzer.</p>
      <div className="er-grid" role="radiogroup" aria-label="Emergencies">
        {list.map((e) => (
          <button key={e.id} type="button" role="radio" aria-checked={selected === e.id} className={`er-emc${selected === e.id ? ' on' : ''}`} onClick={() => onSelect(e)}>
            {learned.has(e.id) && <span className="er-got" aria-hidden="true"><Check size={20} strokeWidth={4} /></span>}
            <div className="er-emcpic"><Scene spec={{ ...e.intro[0].scene, caption: '' }} alt={e.intro[0].scene.caption} /></div>
            <div className="er-emctext">
              <strong>{e.name}</strong>
              <small>{e.rule}</small>
              {learned.has(e.id) ? <span className="er-tag learned"><Check size={13} strokeWidth={4} aria-hidden="true" /> Learned</span> : <span className="er-tag">4 steps · go-bag</span>}
            </div>
          </button>
        ))}
      </div>
      <div className="er-hotline"><Phone size={22} aria-hidden="true" /> In a real emergency, tell a grown-up and call <b>{hotline}</b></div>
      <div className="er-pickactions">
        <button type="button" className="er-white" onClick={onBack}>Back</button>
        <button type="button" className="er-startbtn" onClick={() => chosen && onStart(chosen)} disabled={!chosen}>{chosen ? `Learn: ${chosen.name}` : 'Pick one'} <ArrowRight size={20} aria-hidden="true" /></button>
      </div>
    </div>
  )
}
