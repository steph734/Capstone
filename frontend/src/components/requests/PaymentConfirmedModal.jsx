import { Check, X } from 'lucide-react'
import { useState } from 'react'
import ModalShell, { SummaryRows } from './ModalShell'

const peso = (n) => '₱' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Shown right after "Yes, payment received": the green strip with Pao, then STEP 2 OF 2 (accept or decline).
// "I'll decide later" closes it; the card then shows the green "Payment received" strip with Step 2 unlocked.
export default function PaymentConfirmedModal({ request, onAccept, onDecline, onLater }) {
  const [paoOk, setPaoOk] = useState(true)
  const p = request.payment
  return (
    <ModalShell labelledBy="pcm-title" onClose={onLater} size="md" flush>
      <div className="flex items-center gap-3 border-b border-solid border-[#D8EEDF] bg-[#EAF8EF] px-5 py-3">
        {paoOk ? <img src="/pao/letsgo.png" alt="" onError={() => setPaoOk(false)} className="h-12 w-12 shrink-0 object-contain" /> : null}
        <div className="min-w-0">
          <p className="m-0 flex items-center gap-1.5 text-[15px] font-extrabold text-[#15803D]"><Check size={15} strokeWidth={3.5} aria-hidden="true" /> Payment confirmed</p>
          <p className="m-0 truncate text-xs text-[#5B7469]">{peso(p.amount)} · {p.methodLabel}{p.referenceLast4 ? ` · Ref ending ${p.referenceLast4}` : ''}</p>
        </div>
      </div>

      <div className="p-5 sm:p-7">
        <p className="m-0 text-center text-[11px] font-extrabold uppercase tracking-wider text-[#5B7469]">Step 2 of 2</p>
        <h2 id="pcm-title" className="m-0 mt-1 text-center text-[26px] font-extrabold leading-tight text-[#111827]">Accept or decline this appointment</h2>

        <div className="mt-4">
          <SummaryRows rows={[['Patient', request.patientName], ['When', request.whenLabel], ['Where', `${request.clinic} · ${request.sessionType}`]]} />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col rounded-2xl border border-solid border-[#E3EDE8] p-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#EAF8EF] text-[#15803D]"><Check size={18} strokeWidth={3} aria-hidden="true" /></span>
            <h3 className="m-0 mt-2 text-base font-extrabold">Accept</h3>
            <p className="m-0 mt-1 flex-1 text-[13px] leading-snug text-[#5B7469]">Confirms the booking and sends the confirmation email to the guardian.</p>
            <button type="button" data-autofocus onClick={onAccept} className="mt-4 inline-flex min-h-[46px] items-center justify-center gap-1.5 rounded-xl bg-[#16A34A] text-sm font-bold text-white hover:bg-[#15803D] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A]/50"><Check size={15} strokeWidth={3} aria-hidden="true" /> Accept appointment</button>
          </div>
          <div className="flex flex-col rounded-2xl border border-solid border-[#E3EDE8] p-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FFECEC] text-[#B42318]"><X size={18} strokeWidth={3} aria-hidden="true" /></span>
            <h3 className="m-0 mt-2 text-base font-extrabold">Decline</h3>
            <p className="m-0 mt-1 flex-1 text-[13px] leading-snug text-[#5B7469]">Releases the time slot. You choose a reason and the guardian gets an email.</p>
            <button type="button" onClick={onDecline} className="mt-4 inline-flex min-h-[46px] items-center justify-center gap-1.5 rounded-xl border border-solid border-[#F2A5A5] bg-white text-sm font-bold text-[#B42318] hover:bg-[#FFF5F5] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DC2626]/40"><X size={15} strokeWidth={3} aria-hidden="true" /> Decline appointment</button>
          </div>
        </div>

        <div className="mt-3 text-center">
          <button type="button" onClick={onLater} className="min-h-[40px] border-0 border-solid bg-transparent px-3 text-sm font-bold text-[#2E5E4E] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A]/40">I&apos;ll decide later</button>
        </div>
      </div>
    </ModalShell>
  )
}
