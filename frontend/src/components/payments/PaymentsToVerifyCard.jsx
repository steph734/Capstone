import { AlertTriangle, Copy, Check, ImageOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getReceiptBlob } from '../../utils/bookingPayments'

const peso = (n) => '₱' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const sessionDate = (d) => (d ? new Date(d).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '')
const received = (d) => (d ? new Date(d).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '')

// The receipt thumbnail. It is fetched with the therapist's session and shown from a blob URL (never a public link).
function Thumb({ url, onOpen }) {
  const [src, setSrc] = useState('')
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (!url) return undefined
    let live = true
    let made = ''
    getReceiptBlob(url).then((b) => { if (live) { made = URL.createObjectURL(b); setSrc(made) } else { /* unmounted */ } }).catch(() => { if (live) setFailed(true) })
    return () => { live = false; if (made) URL.revokeObjectURL(made) }
  }, [url])
  if (failed || !url) return <span className="flex h-[88px] w-[68px] items-center justify-center rounded-lg border border-solid border-slate-200 bg-slate-50 text-slate-300" title="No receipt"><ImageOff size={22} aria-hidden="true" /></span>
  return (
    <div className="flex flex-col items-start gap-1">
      <button type="button" disabled={!src} onClick={() => onOpen(src)} aria-label="View receipt full size" className="overflow-hidden rounded-lg border border-solid border-slate-200 bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-pm-green/50">
        {src ? <img src={src} alt="Receipt thumbnail" className="h-[88px] w-[68px] object-cover" /> : <span className="block h-[88px] w-[68px] animate-pulse bg-slate-100 motion-reduce:animate-none" />}
      </button>
      <button type="button" disabled={!src} onClick={() => onOpen(src)} className="border-0 border-solid bg-transparent p-0 text-xs font-bold text-pm-green-dark underline disabled:opacity-50">View receipt full size</button>
    </div>
  )
}

// One payment waiting for the therapist (a card in the "Payments to verify" box).
export default function PaymentsToVerifyCard({ row, busy, onVerify, onReject, onOpenReceipt }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard?.writeText(row.reference || '').then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }).catch(() => {})
  }
  return (
    <article aria-label={`Payment from ${row.patient || 'patient'}`} className="mb-3 flex flex-wrap items-start justify-between gap-4 rounded-xl border border-solid border-amber-200 bg-white p-4">
      <div className="min-w-[230px] flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <strong className="text-[15px] text-slate-900">{row.patient || 'Patient'}</strong>
          <span className="text-sm text-slate-500">· {row.methodLabel}</span>
          {row.isNew && <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-green-800">New · received {received(row.submittedAt)}</span>}
          {row.flags?.referenceReused && <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-extrabold text-red-800"><AlertTriangle size={11} aria-hidden="true" /> Reference used before</span>}
          {row.flags?.proofChanged && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-800">Proof updated</span>}
        </div>
        <p className="m-0 mt-1 text-sm text-slate-600">{sessionDate(row.date)} · {row.timeLabel}</p>
        <p className="m-0 mt-0.5 text-base font-extrabold text-slate-900">{peso(row.amount)}</p>
        <p className="m-0 mt-1.5 flex flex-wrap items-center gap-2 text-sm text-slate-700">
          <span className="text-slate-500">Reference</span>
          <span className="font-mono font-bold tracking-wide">{row.referenceDisplay || 'not given'}</span>
          {row.reference && (
            <button type="button" onClick={copy} className="inline-flex min-h-[28px] items-center gap-1 rounded-md border border-solid border-slate-200 bg-white px-2 text-xs font-bold text-slate-600 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-pm-green/40">
              {copied ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />} {copied ? 'Copied' : 'Copy'}
            </button>
          )}
        </p>
        {(row.guardian || row.contact) && <p className="m-0 mt-1 text-xs text-slate-500">{row.guardian ? `Guardian: ${row.guardian}` : ''}{row.guardian && row.contact ? ' · ' : ''}{row.contact || ''}</p>}
      </div>

      <Thumb url={row.receiptUrl} onOpen={(src) => onOpenReceipt(src, row)} />

      <div className="flex flex-col gap-2 sm:w-[150px]">
        <button type="button" disabled={busy} onClick={() => onVerify(row)} className="min-h-[44px] rounded-xl bg-green-600 px-4 text-sm font-bold text-white hover:bg-green-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400 disabled:opacity-50">Mark as paid</button>
        <button type="button" disabled={busy} onClick={() => onReject(row)} className="min-h-[44px] rounded-xl border border-solid border-red-200 bg-white px-4 text-sm font-bold text-red-700 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:opacity-50">Not received</button>
      </div>
    </article>
  )
}
