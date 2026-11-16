import { Check } from 'lucide-react'
import { useState } from 'react'
import useDialogA11y from './useDialogA11y'

const MEDAL_POSE = '/pao/png/pao-explain-badge.png' // Pao holding up a medal
const CLINIC_TZ = 'Asia/Manila'

const stamp = (d) => (d ? new Date(d).toLocaleString('en-US', { timeZone: CLINIC_TZ, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).replace(',', ' ·') : '')
const slotDate = (d) => (d ? new Date(d).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' }) : '')
// How many whole hours are left (rounded up), never negative.
export const hoursLeft = (until, now = Date.now()) => (until ? Math.max(0, Math.ceil((new Date(until).getTime() - now) / 3600000)) : 0)

// Shown only after the SERVER confirms the proof was stored. Every value comes from the server's view of the payment.
// "Received by your therapist" is only ticked when the server also created the therapist's notification.
export default function PaymentRecordedModal({ view, onDone, onChangeProof }) {
  const [hidePao, setHidePao] = useState(false)
  const ref = useDialogA11y({ onEscape: onDone })
  const b = view.booking || {}
  const therapist = b.therapist || 'your therapist'
  const held = hoursLeft(b.holdExpiresAt)
  const received = Boolean(view.receivedByTherapist)
  const items = [
    { title: 'Payment recorded', sub: `${stamp(view.proofSubmittedAt)}${view.referenceLast4 ? ` · Ref ending ${view.referenceLast4}` : ''}`, done: true },
    { title: 'Received by your therapist', sub: received ? `${therapist} can now see your reference number and receipt` : `We're delivering your details to ${therapist}`, done: received },
    { title: 'Booking confirmed', sub: "After your therapist verifies the payment · we'll text and email you", done: false },
  ]

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-900/60 p-4 pt-32" onMouseDown={onDone}>
      <div
        ref={ref} role="dialog" aria-modal="true" aria-labelledby="prm-title" aria-describedby="prm-desc" tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        className="relative max-h-[88vh] w-full max-w-[520px] overflow-visible rounded-3xl bg-white p-6 pt-14 text-slate-800 shadow-2xl outline-none [color-scheme:light] sm:p-8 sm:pt-14"
      >
        {!hidePao && <img src={MEDAL_POSE} alt="" onError={() => setHidePao(true)} className="pointer-events-none absolute -top-[130px] left-1/2 h-[170px] w-auto -translate-x-1/2 select-none motion-safe:animate-bounce [animation-iteration-count:2]" />}
        <h2 id="prm-title" className="m-0 text-center text-[28px] font-extrabold">Payment recorded!</h2>
        <p id="prm-desc" className="mt-1 text-center text-sm text-slate-500">Your payment details were received by {therapist}.</p>

        <ul className="m-0 mt-5 list-none space-y-3 p-0">
          {items.map((it) => (
            <li key={it.title} className="flex items-start gap-3">
              <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${it.done ? 'bg-pm-green text-white' : 'border-2 border-dashed border-slate-300 text-transparent'}`}>
                {it.done ? <Check size={14} strokeWidth={4} aria-hidden="true" /> : null}
              </span>
              <span className="block text-left">
                <span className={`block text-sm font-bold ${it.done ? 'text-slate-800' : 'text-slate-400'}`}>{it.title}<span className="sr-only">{it.done ? ' (done)' : ' (pending)'}</span></span>
                <span className={`block text-xs ${it.done ? 'text-slate-500' : 'text-slate-400'}`}>{it.sub}</span>
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-green-50 px-4 py-3">
          <span className="block min-w-0 text-left">
            <span className="block text-sm font-bold text-slate-800">Your time slot is reserved</span>
            <span className="block truncate text-xs text-slate-500">{[slotDate(b.date), b.timeLabel, view.sessionType].filter(Boolean).join(' · ')}</span>
          </span>
          {b.holdExpiresAt && <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-pm-green-dark">Held {held} hrs</span>}
        </div>

        <button type="button" data-autofocus onClick={onDone} className="mt-5 min-h-[52px] w-full rounded-xl bg-pm-green text-base font-bold text-white shadow-sm hover:bg-pm-green-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-pm-green/40">Go to my appointments</button>
        {onChangeProof && view.canChangeProof && (
          <button type="button" onClick={onChangeProof} className="mt-2 min-h-[40px] w-full rounded-xl text-sm font-bold text-pm-green-dark hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-pm-green/40">Change proof</button>
        )}
        <p className="mt-2 text-center text-xs text-slate-400">You can close this window.</p>
      </div>
    </div>
  )
}
