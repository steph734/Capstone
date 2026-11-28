import { Check, Mail } from 'lucide-react'
import { useState } from 'react'
import useDialogA11y from './useDialogA11y'

const MEDAL_POSE = '/pao/png/pao-explain-badge.png' // Pao holding up a medal
const CLINIC_TZ = 'Asia/Manila'

const stamp = (d) => (d ? new Date(d).toLocaleString('en-US', { timeZone: CLINIC_TZ, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).replace(',', ' ·') : '')
const slotDate = (d) => (d ? new Date(d).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' }) : '')
// How many whole hours are left (rounded up), never negative.
export const hoursLeft = (until, now = Date.now()) => (until ? Math.max(0, Math.ceil((new Date(until).getTime() - now) / 3600000)) : 0)

// "Appointment being processed": shown only after the SERVER confirmed the proof was stored. Every value comes from the server's view
// of the payment. The blue "We sent you an email" box shows only when the email really was queued (view.emailQueued).
export default function PaymentRecordedModal({ view, onDone, onChangeProof }) {
  const [hidePao, setHidePao] = useState(false)
  const ref = useDialogA11y({ onEscape: onDone })
  const b = view.booking || {}
  const therapist = b.therapist || 'your therapist'
  const held = hoursLeft(b.holdExpiresAt)
  const items = [
    { state: 'done', title: 'Payment recorded', sub: `${stamp(view.proofSubmittedAt)}${view.referenceLast4 ? ` · Ref ending ${view.referenceLast4}` : ''}` },
    { state: 'now', title: 'Payment under review', sub: 'The clinic is checking your payment' },
    { state: 'todo', title: 'Therapist accepts', sub: `${therapist} is asked once your payment is confirmed` },
  ]

  return (
    <div className="fixed inset-0 z-[1200] flex items-end justify-center bg-slate-900/60 p-0 sm:items-center sm:p-4 sm:pt-28" onMouseDown={onDone}>
      <div
        ref={ref} role="dialog" aria-modal="true" aria-labelledby="prm-title" aria-describedby="prm-desc" tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        className="relative mt-24 max-h-[88dvh] w-full max-w-[460px] rounded-t-3xl bg-white p-5 pt-14 text-slate-800 shadow-2xl outline-none [color-scheme:light] sm:mt-0 sm:rounded-3xl sm:p-6 sm:pt-14"
      >
        {!hidePao && <img src={MEDAL_POSE} alt="" onError={() => setHidePao(true)} className="pointer-events-none absolute -top-[100px] left-1/2 h-[135px] w-auto -translate-x-1/2 select-none sm:-top-[110px] sm:h-[150px]" />}
        <h2 id="prm-title" className="m-0 text-center text-xl font-bold text-[#111827]">Appointment being processed</h2>
        <p id="prm-desc" className="m-0 mt-1 text-center text-[13px] text-slate-500">Your payment is recorded. The clinic checks it first, then {therapist} accepts your appointment.</p>

        <ul className="m-0 mt-4 list-none space-y-2.5 p-0">
          {items.map((it) => (
            <li key={it.title} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center" aria-hidden="true">
                {it.state === 'done' && <span className="flex h-6 w-6 items-center justify-center rounded-full bg-pm-green text-white"><Check size={13} strokeWidth={4} /></span>}
                {it.state === 'now' && <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-solid border-pm-green"><span className="h-2 w-2 rounded-full bg-pm-green" /></span>}
                {it.state === 'todo' && <span className="h-6 w-6 rounded-full border-2 border-dashed border-slate-300" />}
              </span>
              <span className="block text-left">
                <span className={`block text-[13px] font-bold ${it.state === 'todo' ? 'text-slate-400' : 'text-slate-800'}`}>{it.title}<span className="sr-only">{it.state === 'done' ? ' (done)' : it.state === 'now' ? ' (in progress)' : ' (waiting)'}</span></span>
                <span className={`block text-xs ${it.state === 'todo' ? 'text-slate-400' : 'text-slate-500'}`}>{it.sub}</span>
              </span>
            </li>
          ))}
        </ul>

        {view.emailQueued && (
          <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-[#EEF3FD] px-3 py-2.5">
            <Mail size={16} className="mt-0.5 shrink-0 text-[#2F5FD0]" aria-hidden="true" />
            <span className="block text-left">
              <span className="block text-[13px] font-bold text-[#2F5FD0]">We sent you an email</span>
              <span className="block text-xs text-[#4A6BB8]">It says your appointment is being processed.</span>
            </span>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-green-50 px-3.5 py-2.5">
          <span className="block min-w-0 text-left">
            <span className="block text-[13px] font-bold text-slate-800">Your time slot is reserved</span>
            <span className="block truncate text-xs text-slate-500">{[slotDate(b.date), b.timeLabel, view.sessionType].filter(Boolean).join(' · ')}</span>
          </span>
          {b.holdExpiresAt && <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-pm-green-dark">Held {held} hrs</span>}
        </div>

        <button type="button" data-autofocus onClick={onDone} className="mt-4 min-h-[44px] w-full rounded-xl bg-pm-green text-sm font-bold text-white shadow-sm hover:bg-pm-green-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-pm-green/40">Go to my appointments</button>
        {onChangeProof && view.canChangeProof && (
          <button type="button" onClick={onChangeProof} className="mt-1 min-h-[36px] w-full rounded-xl text-[13px] font-bold text-pm-green-dark hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-pm-green/40">Change proof</button>
        )}
        <p className="m-0 mt-1 text-center text-xs text-slate-400">You can close this window.</p>
      </div>
    </div>
  )
}
