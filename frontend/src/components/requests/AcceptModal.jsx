import { Check, CircleCheck, Mail } from 'lucide-react'
import { useState } from 'react'
import ModalShell, { Spin, SummaryRows } from './ModalShell'

const peso = (n) => '₱' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// "Accept this appointment?": confirms the booking and sends the existing confirmation email.
export default function AcceptModal({ request, onCancel, onConfirm }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const p = request.payment
  const go = async () => {
    setBusy(true); setError('')
    try { await onConfirm() } catch (e) { setError(e.message || 'Could not accept the appointment.'); setBusy(false) }
  }
  const rows = [
    ['Patient', request.patientName],
    ['When', request.whenLabel],
    ['Where', `${request.clinic} · ${request.sessionType}`],
    ['Payment', p ? `✓ ${peso(p.amount)} received · ${p.methodLabel}` : 'Pay at the clinic', p ? 'text-[#15803D]' : ''],
  ]
  return (
    <ModalShell labelledBy="acc-title" describedBy="acc-sub" onClose={onCancel} busy={busy} size="md">
      <div className="flex flex-col items-center text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#EAF8EF] text-[#16A34A]"><CircleCheck size={30} aria-hidden="true" /></span>
        <h2 id="acc-title" className="m-0 mt-3 text-[26px] font-extrabold leading-tight text-[#111827]">Accept this appointment?</h2>
        <p id="acc-sub" className="m-0 mt-1.5 text-sm text-[#5B7469]">This confirms the booking and emails the guardian right away.</p>
      </div>
      <div className="mt-5"><SummaryRows rows={rows} /></div>
      <p className="m-0 mt-3 flex items-center gap-2 rounded-xl bg-[#EEF3FD] px-3 py-2.5 text-[13px] font-bold text-[#2F5FD0]"><Mail size={15} aria-hidden="true" /> A confirmation email is sent to the guardian as soon as you accept.</p>
      {error && <p role="alert" className="m-0 mt-3 rounded-xl bg-[#FFF1F1] px-3 py-2.5 text-sm font-semibold text-[#B42318]">{error}</p>}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <button type="button" onClick={onCancel} disabled={busy} className="min-h-[48px] rounded-xl border border-solid border-[#D6E3DC] bg-white text-[15px] font-bold hover:bg-[#F6FAF8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A]/50 disabled:opacity-50">Cancel</button>
        <button type="button" data-autofocus onClick={go} disabled={busy} className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#16A34A] text-[15px] font-bold text-white hover:bg-[#15803D] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A]/50 disabled:opacity-70">
          {busy ? <><Spin /> Accepting…</> : <><Check size={16} strokeWidth={3} aria-hidden="true" /> Accept &amp; send email</>}
        </button>
      </div>
    </ModalShell>
  )
}
