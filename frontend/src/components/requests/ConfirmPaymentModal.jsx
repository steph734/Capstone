import { Banknote, Check } from 'lucide-react'
import { useState } from 'react'
import ModalShell, { Spin, SummaryRows } from './ModalShell'

const peso = (n) => '₱' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// "Confirm payment received?" The two checks were already ticked on the card; here they are shown (read-only) as a last look.
// onConfirm() returns a promise; a rejection shows its message inline and the button works again.
export default function ConfirmPaymentModal({ request, onCancel, onConfirm }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const p = request.payment
  const go = async () => {
    setBusy(true); setError('')
    try { await onConfirm() } catch (e) { setError(e.message || 'Could not confirm the payment.'); setBusy(false) }
  }
  const checks = [`I can see ${peso(p.amount)} in my GCash / Maya`, 'The reference number matches the receipt']
  return (
    <ModalShell labelledBy="cpr-title" describedBy="cpr-sub" onClose={onCancel} busy={busy} size="sm">
      <div className="flex flex-col items-center text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#FFF3DF] text-[#7A4A06]"><Banknote size={26} aria-hidden="true" /></span>
        <h2 id="cpr-title" className="m-0 mt-3 text-[26px] font-extrabold leading-tight text-[#111827]">Confirm payment received?</h2>
        <p id="cpr-sub" className="m-0 mt-1.5 text-sm text-[#5B7469]">Please make sure the money is really in your account before you confirm.</p>
      </div>

      <div className="mt-5">
        <SummaryRows rows={[
          ['Patient', request.patientName],
          ['Method', p.methodLabel],
          ['Amount', peso(p.amount), 'text-[#16A34A]'],
          ['Reference', <span key="r" className="font-mono tracking-wide">{p.referenceDisplay}</span>],
        ]} />
      </div>

      <ul className="m-0 mt-3 list-none space-y-2 rounded-2xl bg-[#F3F7F5] p-3.5">
        {checks.map((c) => (
          <li key={c} className="flex items-center gap-2.5 text-sm">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[#16A34A] text-white" aria-hidden="true"><Check size={13} strokeWidth={4} /></span>
            <span>{c}<span className="sr-only"> (checked)</span></span>
          </li>
        ))}
      </ul>

      <p className="m-0 mt-3 rounded-xl bg-[#EEF3FD] px-3 py-2.5 text-[13px] font-semibold text-[#2F5FD0]">This marks the payment as verified. You can then accept or decline the appointment.</p>
      {error && <p role="alert" className="m-0 mt-3 rounded-xl bg-[#FFF1F1] px-3 py-2.5 text-sm font-semibold text-[#B42318]">{error}</p>}

      <div className="mt-5 grid grid-cols-2 gap-3">
        <button type="button" onClick={onCancel} disabled={busy} className="min-h-[48px] rounded-xl border border-solid border-[#D6E3DC] bg-white text-[15px] font-bold hover:bg-[#F6FAF8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A]/50 disabled:opacity-50">Cancel</button>
        <button type="button" data-autofocus onClick={go} disabled={busy} className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#16A34A] text-[15px] font-bold text-white hover:bg-[#15803D] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A]/50 disabled:opacity-70">
          {busy ? <><Spin /> Saving…</> : <><Check size={16} strokeWidth={3} aria-hidden="true" /> Yes, payment received</>}
        </button>
      </div>
    </ModalShell>
  )
}
