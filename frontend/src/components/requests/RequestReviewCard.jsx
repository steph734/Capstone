import { Calendar, Check, ChevronDown, Clock, Lock, MapPin, X } from 'lucide-react'
import { useState } from 'react'
import Collapsible from './Collapsible'
import ReceiptThumb from './ReceiptThumb'
import { problemLabel } from '../../../api/_lib/requestReviewRules'

const peso = (n) => '₱' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const stamp = (d) => (d ? new Date(d).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '')
// 5456 656 574 544 -> 5456 656 574 **** (the last 4 digits are hidden on the card; the confirm dialog shows the full number)
const maskRef = (ref) => { let left = 4; return Array.from(String(ref || '')).reverse().map((c) => (/d/.test(c) && left > 0 ? (left--, '*') : c)).reverse().join('') }
const initials = (name) => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')

const CHIP = {
  amber: 'bg-[#FFF3DF] text-[#7A4A06] border border-solid border-[#FFE3A8]',
  green: 'bg-[#E7F7EC] text-[#15803D] border border-solid border-[#BFE6CD]',
  dark: 'bg-[#1F3D33] text-white',
  plain: 'bg-white text-[#1E3A31] border border-solid border-[#D6E3DC]',
}
const Chip = ({ tone, children }) => <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold ${CHIP[tone]}`}>{children}</span>
const Dot = () => <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />
const RoundChevron = ({ open, label, toggleProps }) => (
  <button {...toggleProps} aria-label={label} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-solid border-[#D6E3DC] bg-white text-[#2E5E4E] hover:bg-[#F3F7F5] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A]/50">
    <ChevronDown size={16} className={`transition-transform duration-300 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
  </button>
)
const Num = ({ n, on }) => <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${on ? 'bg-[#1F3D33] text-white' : 'border-2 border-[#9DB3A8] text-[#5B7469]'}`} aria-hidden="true">{n}</span>

// A tick box drawn by hand (the app's global reset hides native checkboxes).
function Tick({ checked, onChange, children, id }) {
  return (
    <label htmlFor={id} className="flex min-h-[34px] cursor-pointer items-center gap-2.5 text-[13px] text-[#1E3A31]">
      <span
        id={id} role="checkbox" aria-checked={checked} tabIndex={0} onClick={() => onChange(!checked)}
        onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onChange(!checked) } }}
        className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md border-2 border-solid transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A]/50 ${checked ? 'border-[#16A34A] bg-[#16A34A] text-white' : 'border-[#B9C9C1] bg-white'}`}
      >{checked && <Check size={14} strokeWidth={4} aria-hidden="true" />}</span>
      <span>{children}</span>
    </label>
  )
}

// One appointment request. phase: check_payment (step 1) | waiting_proof (asked for new proof) | decide (payment received or cash: step 2)
export default function RequestReviewCard({ request: r, onPaymentReceived, onNotReceived, onAccept, onDecline }) {
  const p = r.payment
  const phase = r.phase
  const [seen, setSeen] = useState(false)
  const [match, setMatch] = useState(false)
  const verified = p?.state === 'verified'
  const waiting = phase === 'waiting_proof'
  const unlocked = phase === 'decide'
  const checksDone = seen && match

  const statusChip = waiting ? <Chip tone="amber"><Dot /> Waiting for new proof</Chip>
    : unlocked ? <Chip tone="green"><Dot /> Ready for your decision</Chip>
    : <Chip tone="amber"><Dot /> Needs your response</Chip>
  const stepChip = !p ? null : unlocked ? <Chip tone="plain"><span aria-hidden="true">②</span> Accept or decline</Chip> : <Chip tone="plain"><span aria-hidden="true">①</span> Check payment</Chip>
  const when = `${r.dateTab} · ${r.timeLabel} · ${r.clinic} · ${r.sessionType}`

  return (
    <Collapsible
      defaultOpen className="mb-4 rounded-3xl border border-solid border-[#E3EDE8] bg-white p-4 shadow-sm sm:p-5"
      renderHeader={({ toggleProps, open }) => (
        <div className="flex flex-wrap items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E3EFE9] text-sm font-bold text-[#2E5E4E]" aria-hidden="true">{initials(r.patientName)}</span>
          <div className="min-w-0 flex-1 basis-[200px]">
            <h3 className="m-0 truncate text-base font-bold text-[#1E3A31]">{r.patientName}</h3>
            <p className="m-0 mt-0.5 text-[13px] text-[#5B7469]">{open ? [r.condition, r.guardianName && `Guardian: ${r.guardianName}`].filter(Boolean).join(' · ') || 'Appointment request' : when}</p>
            {!open && <div className="mt-2 flex flex-wrap items-center gap-2">{statusChip}{stepChip}</div>}
          </div>
          <div className="ml-auto flex items-start gap-3">
            <div className="text-right">
              {open && <div className="flex flex-col items-end gap-1">{statusChip}<span className="text-[11px] text-[#5B7469]">Requested {stamp(r.requestedAt)}</span></div>}
              {r.amount != null && <div className={`${open ? 'mt-2' : ''} text-base font-bold text-[#16A34A]`}>{peso(r.amount)}</div>}
            </div>
            <RoundChevron open={open} toggleProps={toggleProps} label={open ? `Collapse ${r.patientName}'s request` : `Expand ${r.patientName}'s request`} />
          </div>
        </div>
      )}
    >
      <div className="pt-3">
        <p className="m-0 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] font-medium text-[#1E3A31]">
          <span className="inline-flex items-center gap-1.5"><Calendar size={15} aria-hidden="true" /> {r.dateTab}</span>
          <span className="inline-flex items-center gap-1.5"><Clock size={15} aria-hidden="true" /> {r.timeLabel}</span>
          <span className="inline-flex items-center gap-1.5"><MapPin size={15} aria-hidden="true" /> {r.clinic} · {r.sessionType}</span>
        </p>

        {p && (
          <ol className="m-0 mt-4 flex list-none flex-wrap items-center gap-3 p-0 text-[13px] font-semibold text-[#1E3A31]" aria-label="Review steps">
            <li className="flex items-center gap-2" aria-current={!unlocked ? 'step' : undefined}><Num n={unlocked ? '✓' : '1'} on /> Check payment</li>
            <span className="h-px w-8 bg-[#C9DAD2]" aria-hidden="true" />
            <li className={`flex items-center gap-2 ${unlocked ? '' : 'text-[#7C9187]'}`} aria-current={unlocked ? 'step' : undefined}><Num n="2" on={unlocked} /> Accept or decline {!unlocked && <Lock size={13} aria-label="Locked until the payment is verified" />}</li>
          </ol>
        )}

        {/* ── Step 1: the payment ── */}
        {p && (
          <Collapsible
            defaultOpen={!verified}
            className={`mt-4 rounded-2xl border border-solid p-4 ${verified ? 'border-[#BFE6CD] bg-[#EAF8EF]' : 'border-[#F2D9A3] bg-[#FFF8EA]'}`}
            renderHeader={({ toggleProps, open }) => (
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-2 text-sm font-bold text-[#1E3A31]">
                  {verified ? <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#16A34A] text-white"><Check size={14} strokeWidth={4} aria-hidden="true" /></span> : <Num n="1" on={false} />}
                  {verified ? 'Payment received' : 'Payment to check'}
                </span>
                {verified && <span className="text-[13px] text-[#15803D]">{p.methodLabel} · {peso(p.amount)}{p.referenceLast4 ? ` · Ref ending ${p.referenceLast4}` : ''}</span>}
                <span className="ml-auto flex items-center gap-2">
                  {!verified && (waiting ? <Chip tone="amber"><Dot /> Rejected, waiting for new proof</Chip> : <Chip tone="amber"><Dot /> Waiting for your check</Chip>)}
                  <RoundChevron open={open} toggleProps={toggleProps} label={open ? 'Collapse payment details' : 'Expand payment details'} />
                </span>
              </div>
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-4 pt-3">
              <dl className="m-0 min-w-[240px] flex-1 space-y-1.5 text-[13px] text-[#1E3A31]">
                {[['Method', p.methodLabel], ['Amount', peso(p.amount)], ['Reference', <span key="r" className="font-mono font-bold tracking-wide">{p.referenceDisplay ? maskRef(p.referenceDisplay) : '—'}</span>], ['Submitted', stamp(p.submittedAt)], ['Slot held until', p.holdText]].filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} className="flex gap-4"><dt className="w-[110px] shrink-0 text-[#5B7469]">{k}</dt><dd className="m-0 font-bold">{v}</dd></div>
                ))}
                {p.referenceReused && <p className="m-0 rounded-lg bg-[#FFECEC] px-2.5 py-1.5 text-xs font-bold text-[#B42318]">This reference number was used for another payment. Check it carefully.</p>}
                {waiting && (
                  <p className="m-0 rounded-lg bg-[#FFF3DF] px-2.5 py-2 text-[13px] text-[#7A4A06]">
                    <strong>{problemLabel(p.rejectReason) || 'Payment not received'}.</strong>{p.rejectNote ? ` “${p.rejectNote}”` : ''}<br />
                    Asked for new proof {stamp(p.rejectedAt)} · hold ends {p.holdText}
                  </p>
                )}
              </dl>
              <ReceiptThumb url={p.receiptUrl} title={`Receipt from ${r.patientName}`} />
            </div>

            {!verified && !waiting && (
              <fieldset className="m-0 mt-3 rounded-xl border border-solid border-[#F2D9A3] bg-white/60 px-4 py-3">
                <legend className="px-1 text-[11px] font-extrabold uppercase tracking-wider text-[#7A4A06]">Before you confirm</legend>
                <Tick id={`seen-${r.id}`} checked={seen} onChange={setSeen}>I can see {peso(p.amount)} in my GCash / Maya</Tick>
                <Tick id={`match-${r.id}`} checked={match} onChange={setMatch}>The reference number matches the receipt</Tick>
              </fieldset>
            )}
          </Collapsible>
        )}

        {p && !verified && (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1.4fr_1fr]">
            <button type="button" disabled={!checksDone || waiting} onClick={() => onPaymentReceived(r)} className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl bg-[#14532D] text-sm font-semibold text-white hover:bg-[#166534] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A]/60 disabled:cursor-not-allowed disabled:opacity-45">
              <Check size={16} strokeWidth={3} aria-hidden="true" /> Payment received
            </button>
            <button type="button" disabled={waiting} onClick={() => onNotReceived(r)} className="min-h-[42px] rounded-xl border border-solid border-[#F2A5A5] bg-white text-sm font-semibold text-[#B42318] hover:bg-[#FFF5F5] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DC2626]/40 disabled:cursor-not-allowed disabled:opacity-45">Payment not received</button>
          </div>
        )}
        {p && !verified && !waiting && !checksDone && <p className="m-0 mt-1.5 text-xs text-[#7A4A06]">Tick both boxes to enable &ldquo;Payment received&rdquo;.</p>}

        {/* ── Step 2: accept or decline (locked until the payment is verified) ── */}
        <div className={`mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-solid p-4 ${unlocked ? 'border-[#D6E3DC] bg-white' : 'border-dashed border-[#C9DAD2] bg-[#F7FAF8]'}`}>
          <div className="min-w-[200px] flex-1">
            <p className={`m-0 flex items-center gap-2 text-sm font-bold ${unlocked ? 'text-[#1E3A31]' : 'text-[#6F877B]'}`}><Num n="2" on={unlocked} /> Accept or decline</p>
            <p className="m-0 mt-0.5 text-xs text-[#5B7469]">
              {unlocked ? (p ? 'Payment received. Choose what to do with this appointment.' : 'Cash at the clinic. Choose what to do with this appointment.')
                : waiting ? 'Waiting for the guardian to send new proof. These buttons unlock after you verify it.' : 'Check the payment first. These buttons unlock afterwards.'}
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={!unlocked} onClick={() => onAccept(r)} className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-4 text-[13px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A]/50 ${unlocked ? 'bg-[#16A34A] text-white hover:bg-[#15803D]' : 'cursor-not-allowed bg-[#E3EDE8] text-[#7C9187]'}`}>
              {unlocked ? <Check size={15} strokeWidth={3} aria-hidden="true" /> : <Lock size={14} aria-hidden="true" />} Accept
            </button>
            <button type="button" disabled={!unlocked} onClick={() => onDecline(r)} className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-solid px-4 text-[13px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DC2626]/40 ${unlocked ? 'border-[#F2A5A5] bg-white text-[#B42318] hover:bg-[#FFF5F5]' : 'cursor-not-allowed border-[#E3EDE8] bg-transparent text-[#7C9187]'}`}>
              {unlocked ? <X size={15} strokeWidth={3} aria-hidden="true" /> : <Lock size={14} aria-hidden="true" />} Decline
            </button>
          </div>
        </div>
      </div>
    </Collapsible>
  )
}
