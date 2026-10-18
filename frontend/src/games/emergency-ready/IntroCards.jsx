import { ArrowLeft, ArrowRight, Ear, Eye, Hand, ShieldCheck, Volume2, Wind } from 'lucide-react'
import Scene from './illustrations/Scene'

const CLUE_ICON = { see: Eye, hear: Ear, feel: Hand, smell: Wind }

// "What is it?" - one of 4 short cards: picture on the left, words on the right.
export default function IntroCards({ emergency, idx, hotline, onHear, onBack, onNext }) {
  const card = emergency.intro[idx]
  const last = idx === emergency.intro.length - 1
  return (
    <div className="er-main">
      <div className="er-panel">
        <div className="er-scene"><Scene spec={card.scene} /></div>
        <div className="er-panelbody">
          <span className="er-label">What is {emergency.name.toLowerCase() === 'getting lost' ? 'lost' : `a ${emergency.name.toLowerCase()}`}? · Card {idx + 1} of {emergency.intro.length}</span>
          <h2>{card.title}</h2>
          <p>{card.text}</p>
          {card.clues && (
            <div className="er-clues">
              {card.clues.map((c) => { const Icon = CLUE_ICON[c.id]; return (
                <div key={c.id} className="er-clue"><span><Icon size={26} aria-hidden="true" /></span><strong>{c.label}</strong><small>{c.text}</small></div>
              ) })}
            </div>
          )}
          <div className="er-cardfoot">
            <div className="er-dots" aria-hidden="true">{emergency.intro.map((_, i) => <i key={i} className={i < idx ? 'done' : i === idx ? 'now' : ''}>{i + 1}</i>)}</div>
            <button type="button" className="er-soft" onClick={() => onHear(`${card.title}. ${card.text}`)}><Volume2 size={20} aria-hidden="true" /> Read it to me</button>
          </div>
          <div className="er-safety"><ShieldCheck size={22} aria-hidden="true" />
            {idx === emergency.intro.length - 1 ? `In a real emergency, tell a grown-up and call ${hotline}.` : 'This is practice. You are safe.'}
          </div>
        </div>
      </div>
      <div className="er-nav">
        <button type="button" className="er-white" onClick={onBack}><ArrowLeft size={20} aria-hidden="true" /> Back</button>
        <button type="button" className="er-startbtn" onClick={onNext}>{last ? 'Learn what to do' : 'Next'} <ArrowRight size={20} aria-hidden="true" /></button>
      </div>
    </div>
  )
}
