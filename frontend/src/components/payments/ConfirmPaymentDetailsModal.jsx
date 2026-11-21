import { AlertTriangle, Check, CreditCard } from 'lucide-react'
import { useEffect, useState } from 'react'
import { formatBytes } from '../../../api/_lib/paymentProofRules'
import useDialogA11y from './useDialogA11y'

const peso = (n) => '₱ ' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// "Is your payment complete?" sits on top of the checkout modal. It re-reads what the patient typed (nothing is sent yet).
// Edit / Change close it and put focus on the right field. Esc and "Go back" return to step 3 with everything kept.
export default function ConfirmPaymentDetailsModal({ methodLabel, amount, therapist, referenceDisplay, file, onEdit, onChange, onBack, onSubmit }) {
  const [ok, setOk] = useState(false)
  const [preview, setPreview] = useState('')
  const ref = useDialogA11y({ onEscape: onBack })

  useEffect(() => {
    if (!file) return undefined
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const rows = [
    { title: 'Payment sent', sub: `${methodLabel} · ${peso(amount)}` },
    { title: 'Reference number added', sub: <span className="font-mono tracking-wide">{referenceDisplay}</span>, action: ['Edit', onEdit] },
    { title: 'Receipt image uploaded', sub: file ? `${file.name} · ${formatBytes(file.size)}` : '', thumb: preview, action: ['Change', onChange] },
  ]

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-900/60 p-4" onMouseDown={onBack}>
      <div
        ref={ref} role="dialog" aria-modal="true" aria-labelledby="cpd-title" aria-describedby="cpd-desc" tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-[560px] overflow-y-auto rounded-3xl bg-white p-6 text-slate-800 shadow-2xl outline-none [color-scheme:light] sm:p-8"
      >
        <div className="flex flex-col items-center text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-pm-green-dark"><CreditCard size={28} aria-hidden="true" /></span>
          <h2 id="cpd-title" className="mt-3 text-2xl font-extrabold" style={{ color: '#000', WebkitTextFillColor: '#000' }}>Is your payment complete?</h2>
          <p id="cpd-desc" className="mt-1 text-sm text-slate-500">Please check these before we send them to {therapist || 'your therapist'}.</p>
        </div>

        <ul className="m-0 mt-5 list-none divide-y divide-slate-100 rounded-xl border border-solid border-slate-200 p-0">
          {rows.map((r) => (
            <li key={r.title} className="flex items-center gap-3 px-4 py-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pm-green text-white" aria-hidden="true"><Check size={13} strokeWidth={4} /></span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block text-sm font-bold">{r.title}</span>
                <span className="block truncate text-xs text-slate-500">{r.sub}</span>
              </span>
              {r.thumb && <img src={r.thumb} alt="" className="h-11 w-9 shrink-0 rounded-md border border-solid border-slate-200 object-cover" />}
              {r.action && <button type="button" onClick={r.action[1]} className="min-h-[36px] shrink-0 rounded-md px-2 text-xs font-bold text-pm-green-dark hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-pm-green/40">{r.action[0]}</button>}
            </li>
          ))}
        </ul>

        <label className={`mt-4 flex min-h-[44px] cursor-pointer items-start gap-2.5 rounded-xl px-3 py-3 text-sm ${ok ? 'bg-green-50' : 'bg-slate-50'}`}>
          {/* The app's reset hides native checkboxes, so the box is drawn by hand. */}
          <span
            role="checkbox" aria-checked={ok} tabIndex={0} data-autofocus
            onClick={() => setOk((v) => !v)}
            onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setOk((v) => !v) } }}
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-solid ${ok ? 'border-pm-green bg-pm-green text-white' : 'border-slate-300 bg-white'}`}
          >{ok && <Check size={12} strokeWidth={4} aria-hidden="true" />}</span>
          <span>I confirm the payment is complete and the reference number and receipt are correct.</span>
        </label>

        <p className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-center text-xs font-semibold text-amber-800"><AlertTriangle size={14} aria-hidden="true" /> Wrong details can delay your booking&apos;s confirmation.</p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button type="button" onClick={onBack} className="min-h-[48px] rounded-xl border border-solid border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-pm-green/40">Go back</button>
          <button type="button" disabled={!ok} onClick={onSubmit} className="min-h-[48px] rounded-xl bg-pm-green text-sm font-bold text-white shadow-sm hover:bg-pm-green-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-pm-green/40 disabled:cursor-not-allowed disabled:opacity-40">Yes, submit payment</button>
        </div>
      </div>
    </div>
  )
}
