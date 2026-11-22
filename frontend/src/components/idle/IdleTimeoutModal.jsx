import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Clock } from 'lucide-react'
import useDialogA11y from '../payments/useDialogA11y'
import { FINAL_COUNTDOWN_SECONDS } from '../../config/idle'
import './idle.css'

// The real Pao artwork (transparent PNGs, in public/pao/pao-reactions/). Not redrawn.
export const PAO_SLEEPY = '/pao/pao-reactions/pao-react-pants-pajama-pants.png' // warning
export const PAO_WOW = '/pao/pao-reactions/pao-react-clothes-astronaut-suit.png' // final countdown
export const PAO_WAVE = '/pao/pao-reactions/pao-react-clothes-rainbow-tee.png' // logged-out screen

const R = 62
const C = 2 * Math.PI * R

// Said to screen readers at a few moments only; a countdown that speaks every second is unusable.
const SPOKEN = new Set([60, 45, 30, 20, 10, 5, 3, 2, 1])

export default function IdleTimeoutModal({ remaining, total, minutes, onStay, onLogout }) {
  const final = remaining <= FINAL_COUNTDOWN_SECONDS
  const ref = useDialogA11y({ onEscape: onStay, initialFocus: '[data-autofocus]' })
  const [spoken, setSpoken] = useState('')
  const lastSpoken = useRef(null)

  useEffect(() => {
    document.body.classList.add('tp-idle-open')
    return () => document.body.classList.remove('tp-idle-open')
  }, [])
  useEffect(() => {
    if (SPOKEN.has(remaining) && lastSpoken.current !== remaining) { lastSpoken.current = remaining; setSpoken(`${remaining} ${remaining === 1 ? 'second' : 'seconds'} until you are logged out.`) }
  }, [remaining])

  const progress = Math.max(0, Math.min(1, remaining / total))
  return createPortal(
    <div className="tp-idle-backdrop">
      <div ref={ref} className={`tp-idle-card${final ? ' final' : ''}`} role="alertdialog" aria-modal="true" aria-labelledby="tp-idle-title" aria-describedby="tp-idle-desc" tabIndex={-1}>
        <img className="tp-idle-pao" src={final ? PAO_WOW : PAO_SLEEPY} alt={final ? 'Pao the panda is surprised' : 'Pao the panda is sleeping'} width="240" height="300" loading="eager" decoding="async" draggable="false" />
        <span className="tp-idle-pill"><Clock size={15} aria-hidden="true" /> Session inactive</span>
        <h2 id="tp-idle-title">{final ? 'Logging you out…' : 'Are you still there?'}</h2>
        <p id="tp-idle-desc">
          {final
            ? 'No activity detected. Choose below to stay signed in, or you’ll be logged out in a few seconds.'
            : `You’ve been inactive for ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}. For your security, we’ll log you out soon.`}
        </p>
        <div className="tp-idle-ring" aria-hidden="true">
          <svg viewBox="0 0 140 140" width="140" height="140">
            <circle cx="70" cy="70" r={R} className="track" />
            <circle cx="70" cy="70" r={R} className="bar" strokeDasharray={C} strokeDashoffset={C * (1 - progress)} transform="rotate(-90 70 70)" />
          </svg>
          <div className="tp-idle-num"><strong>{remaining}</strong><span>{remaining === 1 ? 'second' : 'seconds'}</span></div>
        </div>
        <p className="tp-idle-sr" role="status" aria-live="polite">{spoken}</p>
        <div className="tp-idle-actions">
          <button type="button" className="tp-idle-btn light" onClick={onLogout}>Log out now</button>
          <button type="button" className="tp-idle-btn primary" onClick={onStay} data-autofocus>Stay logged in</button>
        </div>
        <p className="tp-idle-foot">Any unsaved changes may be lost when you are logged out.</p>
      </div>
    </div>,
    document.body,
  )
}
