import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Home, Loader2, AlertTriangle } from 'lucide-react'
import { authFetch } from '../../../../utils/session'
import useDialogA11y from '../../../../components/payments/useDialogA11y'
import useIdleBusy from '../../../../hooks/useIdleBusy'

// Home practice ON / OFF for one patient: "are you sure?", saves on the server, then says what happened.
// Off stops the games unlocking in the patient's app; the plan, plays and SOAP notes stay as they are. On brings the same plan back.
export default function ToggleHomeModal({ patient, enabled, onClose, onDone }) {
  const [stage, setStage] = useState('confirm')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const ref = useDialogA11y({ onEscape: stage === 'done' ? onDone : onClose, locked: busy })
  useIdleBusy('home-practice', busy)
  const first = patient.firstName || patient.name
  const endedOn = patient.homeEnded && patient.homePlanEnds ? new Date(patient.homePlanEnds).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'long', day: 'numeric' }) : ''
  const [renewed, setRenewed] = useState(false)

  const save = async () => {
    setBusy(true); setError('')
    try { const out = await authFetch('/api/therapist/home-sets/toggle', { method: 'POST', body: { patientId: patient.patientId, enabled } }); setRenewed(Boolean(out.renewed)); setStage('done') } catch (e) { setError(e.message || 'Could not change home practice.') } finally { setBusy(false) }
  }
  return createPortal(
    <div className="hs-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) (stage === 'done' ? onDone : onClose)() }}>
      <div ref={ref} className="hs-modal hs-modal-sm" role="alertdialog" aria-modal="true" aria-labelledby="hs-tg-title" tabIndex={-1}>
        {stage === 'confirm' ? (
          <>
            <div className="hs-tg-icon" aria-hidden="true"><Home size={30} /></div>
            <h2 id="hs-tg-title">{enabled ? `Turn home practice on for ${first}?` : `Turn home practice off for ${first}?`}</h2>
            <p>{enabled
              ? (endedOn ? `Home practice ended on ${endedOn}, so ${first} cannot play at home right now. Turning it on starts a new ${patient.homePlanDays || 7}-day period from today, with the same games and home hours.` : `${first} can play the assigned games at home again, inside the set's home hours.`)
              : `${first} will not be able to play the games at home. Plays so far and the set stay as they are, and you can turn it back on any time.`}</p>
            {error && <p className="hs-error-line" role="alert"><AlertTriangle size={14} aria-hidden="true" /> {error}</p>}
            <div className="hs-tg-actions">
              <button type="button" className="hs-btn" onClick={onClose} disabled={busy}>Go back</button>
              <button type="button" className={`hs-btn ${enabled ? 'green' : 'dark'}`} onClick={save} disabled={busy} data-autofocus>
                {busy && <Loader2 size={15} className="hs-spin" aria-hidden="true" />} {enabled ? 'Yes, turn on' : 'Yes, turn off'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className={`hs-tg-icon ${enabled ? 'ok' : 'off'}`} aria-hidden="true"><Check size={30} /></div>
            <h2 id="hs-tg-title">{enabled ? 'Home practice is on' : 'Home practice is off'}</h2>
            <p>{enabled ? (renewed ? `A new ${patient.homePlanDays || 7}-day period started today. ${first} can play the games at home.` : `${first} can play the games at home again.`) : `${first} cannot play the games at home until you turn it back on.`}</p>
            <div className="hs-tg-actions"><button type="button" className="hs-btn green" onClick={onDone} data-autofocus>Done</button></div>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
