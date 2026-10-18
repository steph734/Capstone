import { useEffect, useState } from 'react'
import { Smile, X } from 'lucide-react'

export function CalmButton({ onOpen }) {
  return <button type="button" className="er-pill-btn calm" onClick={onOpen} aria-label="Calm: breathe with Pao"><Smile size={22} aria-hidden="true" /> <span>Calm</span></button>
}

// A 1-minute breathing card: in for 4 seconds, out for 4 seconds. The text and the circle move together, slowly.
export function CalmCard({ onClose }) {
  const [phase, setPhase] = useState('in')
  const [left, setLeft] = useState(60)
  useEffect(() => {
    const t = setInterval(() => setPhase((p) => (p === 'in' ? 'out' : 'in')), 4000)
    const c = setInterval(() => setLeft((s) => s - 1), 1000)
    return () => { clearInterval(t); clearInterval(c) }
  }, [])
  useEffect(() => { if (left <= 0) onClose() }, [left, onClose])
  useEffect(() => {
    const on = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [onClose])
  return (
    <div className="er-overlay" role="dialog" aria-modal="true" aria-label="Calm breathing">
      <div className="er-modal er-calmcard">
        <button type="button" className="er-x" onClick={onClose} aria-label="Close"><X size={20} /></button>
        <div className={`er-breath ${phase}`} aria-hidden="true" />
        <h2 aria-live="polite">{phase === 'in' ? 'Breathe in…' : 'and out…'}</h2>
        <p>You are safe. This is practice.</p>
        <button type="button" className="er-big primary" onClick={onClose}>I feel calm</button>
      </div>
    </div>
  )
}
