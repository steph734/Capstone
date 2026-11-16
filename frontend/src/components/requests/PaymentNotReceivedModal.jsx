import { AlertTriangle } from 'lucide-react'
import { useState } from 'react'
import { NOTE_MAX, PROBLEM_REASONS, validateReject } from '../../../api/_lib/requestReviewRules'
import ModalShell, { Spin } from './ModalShell'
import RadioGroup from './RadioGroup'

// "Payment not received": what went wrong (required), an optional note ("Other" needs one), and what should happen next.
// Colors follow the design: Cancel is solid red, the main button solid blue (it reads "Decline & send" when declining).
export default function PaymentNotReceivedModal({ request, onCancel, onSubmit }) {
  const p = request.payment
  const holdExpired = Boolean(p.holdExpired)
  const [reason, setReason] = useState('amount_missing')
  const [note, setNote] = useState('')
  const [next, setNext] = useState(holdExpired ? 'decline_request' : 'request_new_proof')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [tried, setTried] = useState(false)

  const check = validateReject({ reason, note, nextAction: next })
  const noteError = tried && !check.ok && check.field === 'note' ? check.message : ''
  const decline = next === 'decline_request'

  const go = async () => {
    setTried(true)
    if (!check.ok) return
    setBusy(true); setError('')
    try { await onSubmit(check.value) } catch (e) { setError(e.message || 'Could not send this.'); setBusy(false) }
  }

  return (
    <ModalShell labelledBy="pnr-title" describedBy="pnr-sub" onClose={onCancel} busy={busy} size="md">
      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#FFF3DF] text-[#D97706]"><AlertTriangle size={26} aria-hidden="true" /></span>
        <div>
          <h2 id="pnr-title" className="m-0 text-[26px] font-extrabold leading-tight">Payment not received</h2>
          <p id="pnr-sub" className="m-0 mt-0.5 text-sm text-[#5B7469]">Tell the guardian what went wrong so they can fix it.</p>
        </div>
      </div>

      <p id="pnr-what" className="m-0 mt-5 text-[11px] font-extrabold uppercase tracking-wider text-[#5B7469]">What went wrong?</p>
      <div className="mt-1.5">
        <RadioGroup labelledBy="pnr-what" value={reason} onChange={setReason} options={PROBLEM_REASONS.map((r) => ({ value: r.code, label: r.label }))} />
      </div>

      <label htmlFor="pnr-note" className="sr-only">Note for the guardian{reason === 'other' ? ' (required)' : ' (optional)'}</label>
      <input
        id="pnr-note" type="text" value={note} maxLength={NOTE_MAX} onChange={(e) => setNote(e.target.value)}
        placeholder={reason === 'other' ? 'Add a note for the guardian (required)' : 'Add a note for the guardian (optional)'}
        aria-invalid={Boolean(noteError)} aria-describedby={noteError ? 'pnr-note-err' : undefined}
        className={`mt-3 min-h-[46px] w-full rounded-xl border bg-white px-3.5 text-[15px] text-[#1E3A31] placeholder:text-[#8AA095] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A]/40 ${noteError ? 'border-[#DC2626]' : 'border-[#D6E3DC]'}`}
      />
      {noteError && <p id="pnr-note-err" role="alert" className="m-0 mt-1 text-xs font-bold text-[#B42318]">{noteError}</p>}

      <p id="pnr-next" className="m-0 mt-5 text-[11px] font-extrabold uppercase tracking-wider text-[#5B7469]">What should happen next?</p>
      <div className="mt-1.5">
        <RadioGroup
          labelledBy="pnr-next" variant="cards" value={next} onChange={setNext} describedBy={holdExpired ? 'pnr-expired' : undefined}
          options={[
            { value: 'request_new_proof', label: 'Ask for new proof', disabled: holdExpired, desc: holdExpired ? 'Not available: the hold has expired.' : `The guardian can resubmit until ${p.holdText}. The slot stays held.` },
            { value: 'decline_request', label: 'Decline this request', desc: 'The slot is released and the guardian is told why.' },
          ]}
        />
      </div>
      {holdExpired && <p id="pnr-expired" className="m-0 mt-2 text-xs font-semibold text-[#7A4A06]">The hold has expired, so you can only decline.</p>}

      {error && <p role="alert" className="m-0 mt-3 rounded-xl bg-[#FFF1F1] px-3 py-2.5 text-sm font-semibold text-[#B42318]">{error}</p>}

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1.3fr]">
        <button type="button" onClick={onCancel} disabled={busy} className="min-h-[50px] rounded-xl bg-[#DC2626] text-[15px] font-bold text-white hover:bg-[#B91C1C] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DC2626]/50 disabled:opacity-60">Cancel</button>
        <button type="button" onClick={go} disabled={busy} className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-xl bg-[#2F5FD0] text-[15px] font-bold text-white hover:bg-[#244DB0] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F5FD0]/50 disabled:opacity-70">
          {busy ? <><Spin /> Sending…</> : decline ? 'Decline & send' : 'Mark not received & send'}
        </button>
      </div>
    </ModalShell>
  )
}
