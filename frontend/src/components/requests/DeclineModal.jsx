import { Ban, Mail } from 'lucide-react'
import { useState } from 'react'
import { DECLINE_REASONS, MESSAGE_MAX, declinePreview, validateDecline } from '../../../api/_lib/requestReviewRules'
import ModalShell, { Spin } from './ModalShell'
import RadioGroup from './RadioGroup'

const peso = (n) => '₱' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// "Decline this appointment?": a reason is REQUIRED ("Other" also needs a message), with a live preview of the email the guardian gets.
export default function DeclineModal({ request, therapist, onCancel, onConfirm }) {
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const check = validateDecline({ reason, message })
  const noReason = !reason
  const messageError = reason === 'other' && !message.trim() ? 'Please explain your reason.' : ''
  const preview = reason ? declinePreview({ therapist, patient: request.patientName, dateShort: request.dateShort, dateTab: request.dateTab, timeStart: request.timeStart, reason, message }) : null
  const paid = request.payment?.state === 'verified'

  const go = async () => {
    if (!check.ok) return
    setBusy(true); setError('')
    try { await onConfirm(check.value) } catch (e) { setError(e.message || 'Could not decline the appointment.'); setBusy(false) }
  }

  return (
    <ModalShell labelledBy="dec-title" onClose={onCancel} busy={busy} size="lg">
      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#FFECEC] text-[#DC2626]"><Ban size={26} aria-hidden="true" /></span>
        <div className="min-w-0">
          <h2 id="dec-title" className="m-0 text-[26px] font-extrabold leading-tight">Decline this appointment?</h2>
          <p className="m-0 mt-0.5 text-sm text-[#5B7469]">{request.patientName} · {request.whenLabel.replace(/^(\w+, \w+ \d+), \d{4}/, '$1')}</p>
        </div>
      </div>

      <p id="dec-reason" className="m-0 mt-5 text-[11px] font-extrabold uppercase tracking-wider text-[#5B7469]">Reason for declining <span className="text-[#DC2626]" aria-hidden="true">*</span></p>
      <div className="mt-1.5">
        <RadioGroup labelledBy="dec-reason" describedBy={noReason ? 'dec-reason-err' : undefined} tone="red" invalid={noReason} value={reason} onChange={setReason} options={DECLINE_REASONS.map((r) => ({ value: r.code, label: r.label }))} />
      </div>
      {noReason && <p id="dec-reason-err" role="alert" className="m-0 mt-1.5 text-xs font-extrabold text-[#B42318]">Please choose a reason before declining.</p>}

      <label htmlFor="dec-msg" className="mt-4 block text-[11px] font-extrabold uppercase tracking-wider text-[#5B7469]">Message to the guardian <span className="font-semibold normal-case tracking-normal">(optional · required for &quot;Other&quot;)</span></label>
      <textarea
        id="dec-msg" rows={2} value={message} maxLength={MESSAGE_MAX} onChange={(e) => setMessage(e.target.value)}
        placeholder="Add a short message that will be included in the email…"
        aria-invalid={Boolean(messageError)} aria-describedby={messageError ? 'dec-msg-err' : 'dec-msg-count'}
        className={`mt-1.5 w-full resize-y rounded-xl border bg-white p-3 text-[15px] text-[#1E3A31] placeholder:text-[#8AA095] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A]/40 ${messageError ? 'border-[#DC2626] bg-[#FFF5F5]' : 'border-[#D6E3DC]'}`}
      />
      <div className="flex justify-between gap-2">
        {messageError ? <p id="dec-msg-err" role="alert" className="m-0 mt-1 text-xs font-extrabold text-[#B42318]">{messageError}</p> : <span />}
        <p id="dec-msg-count" className="m-0 mt-1 text-xs text-[#5B7469]">{message.length}/{MESSAGE_MAX}</p>
      </div>

      <div className="mt-3 rounded-2xl bg-[#F3F7F5] p-3.5" aria-live="polite">
        <p className="m-0 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-[#5B7469]"><Mail size={13} aria-hidden="true" /> Email the guardian will receive · preview</p>
        {preview ? (
          <div className="mt-1.5 text-[13px] leading-relaxed">
            <p className="m-0"><strong>Subject:</strong> {preview.subject}</p>
            <p className="m-0 mt-1">{preview.body}</p>
            <p className="m-0"><strong>Reason:</strong> {preview.reasonLabel}.</p>
            {preview.message && <p className="m-0 italic">&ldquo;{preview.message}&rdquo;</p>}
          </div>
        ) : <p className="m-0 mt-1 text-[13px] text-[#5B7469]">Choose a reason to see the email the guardian will receive.</p>}
      </div>

      {paid && <p className="m-0 mt-3 rounded-xl bg-[#FFF3DF] px-3 py-2.5 text-[13px] font-semibold text-[#7A4A06]">The payment of {peso(request.payment.amount)} was received. Remember to return it to the guardian.</p>}
      {error && <p role="alert" className="m-0 mt-3 rounded-xl bg-[#FFF1F1] px-3 py-2.5 text-sm font-semibold text-[#B42318]">{error}</p>}

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1.4fr]">
        <button type="button" onClick={onCancel} disabled={busy} className="min-h-[50px] rounded-xl border border-[#D6E3DC] bg-white text-[15px] font-bold hover:bg-[#F6FAF8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A]/50 disabled:opacity-50">Cancel</button>
        <button type="button" onClick={go} disabled={busy || !check.ok} className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-xl bg-[#DC2626] text-[15px] font-bold text-white hover:bg-[#B91C1C] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DC2626]/50 disabled:cursor-not-allowed disabled:opacity-40">
          {busy ? <><Spin /> Sending…</> : 'Decline & send email'}
        </button>
      </div>
    </ModalShell>
  )
}
