import { AlertCircle, Check, FileImage, UploadCloud } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { REFERENCE_RULES, formatBytes, formatReference, normalizeReference, validateReference } from '../../../api/_lib/paymentProofRules'
import { checkReceiptFile } from '../../utils/receiptImage'

// Step 3 of the checkout: reference number + receipt screenshot, both required.
// Nothing is uploaded here: the file stays in memory until the patient submits (so nothing is stored for abandoned payments).
//
// Controlled by the checkout modal: { reference, file } live there so they survive the confirmation modal, a failed submit,
// and going back. `controls` hands the modal two functions to move focus to a field ("Edit" / "Change" on the confirm modal).
export default function PaymentProofStep({ method, reference, onReference, file, onFile, holdBanner, rejectedReason, error, controls }) {
  const rule = REFERENCE_RULES[method] || REFERENCE_RULES.gcash
  const [touched, setTouched] = useState(false)
  const [fileError, setFileError] = useState('')
  const [drag, setDrag] = useState(false)
  const [preview, setPreview] = useState('')
  const inputRef = useRef(null)
  const refInput = useRef(null)

  const check = validateReference(reference, method)
  const showError = touched && !check.ok
  const done = (check.ok ? 1 : 0) + (file ? 1 : 0)

  useEffect(() => {
    if (!file) { setPreview(''); return undefined }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  useEffect(() => {
    if (!controls) return
    controls.current = { focusReference: () => refInput.current?.focus(), chooseFile: () => inputRef.current?.click() }
  }, [controls])

  const take = async (picked) => {
    if (!picked) return
    const res = await checkReceiptFile(picked)
    if (!res.ok) { setFileError(res.error); return }
    setFileError('')
    onFile(picked)
  }

  const refId = 'proof-reference'
  const describedBy = [showError ? `${refId}-err` : `${refId}-help`].join(' ')

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center gap-2">
        <h2 tabIndex={-1} data-step-heading className="text-2xl font-bold text-slate-800 outline-none">Add your payment proof</h2>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">Required</span>
      </div>
      <p className="mt-1 text-sm text-slate-500">Enter the reference number and upload your receipt so your therapist can verify the payment.</p>

      {rejectedReason !== undefined && rejectedReason !== null && (
        <p role="alert" className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-800">
          <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span><strong>Payment not received.</strong> {rejectedReason ? `${rejectedReason}. ` : ''}Check your receipt and send your proof again.</span>
        </p>
      )}

      {holdBanner}

      <label htmlFor={refId} className="mt-4 text-sm font-bold text-slate-800">{rule.label} reference number <span className="text-red-600" aria-hidden="true">*</span></label>
      <div className={`relative mt-1.5 flex items-center rounded-xl border-2 border-solid bg-white px-3 transition-colors ${showError ? 'border-red-400' : check.ok ? 'border-pm-green' : 'border-slate-200 focus-within:border-slate-400'}`}>
        <input
          id={refId}
          ref={refInput}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          placeholder={method === 'gcash' ? '0000 000 000 000' : 'Reference number'}
          value={reference}
          aria-required="true"
          aria-invalid={showError}
          aria-describedby={describedBy}
          onChange={(e) => onReference(formatReference(normalizeReference(e.target.value).slice(0, rule.max), method))}
          onBlur={() => setTouched(true)}
          className="min-h-[48px] w-full border-0 border-solid bg-transparent py-2 font-mono text-base tracking-wide text-slate-900 outline-none placeholder:text-slate-300"
        />
        {check.ok && <span className="ml-2 flex shrink-0 items-center gap-1 text-xs font-bold text-pm-green-dark"><Check size={13} strokeWidth={3.5} aria-hidden="true" /> {check.count} digits</span>}
      </div>
      {showError
        ? <p id={`${refId}-err`} role="alert" className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-red-600"><AlertCircle size={13} aria-hidden="true" /> {check.error}</p>
        : <p id={`${refId}-help`} className="mt-1.5 text-xs text-slate-500">{rule.where}</p>}

      <span id="proof-file-label" className="mt-4 text-sm font-bold text-slate-800">Screenshot of your receipt <span className="text-red-600" aria-hidden="true">*</span></span>
      <input
        ref={inputRef} type="file" accept="image/jpeg,image/png" className="sr-only" tabIndex={-1} aria-labelledby="proof-file-label"
        onChange={(e) => { take(e.target.files?.[0]); e.target.value = '' }}
      />
      {file ? (
        <div className="mt-1.5 flex items-center gap-3 rounded-xl border-2 border-solid border-pm-green/60 bg-green-50/50 p-3">
          {preview ? <img src={preview} alt="Preview of your receipt" className="h-[88px] w-[68px] shrink-0 rounded-lg border border-solid border-slate-200 bg-white object-cover" /> : <FileImage size={40} className="text-slate-400" aria-hidden="true" />}
          <div className="min-w-0 flex-1">
            <p className="m-0 truncate text-sm font-bold text-slate-800" title={file.name}>{file.name}</p>
            <p className="m-0 mt-0.5 flex items-center gap-1 text-xs text-slate-500">{formatBytes(file.size)} · ready to send <Check size={12} strokeWidth={3.5} className="text-pm-green-dark" aria-hidden="true" /></p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => inputRef.current?.click()} className="min-h-[36px] rounded-lg border border-solid border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-pm-green/40">Replace</button>
              <button type="button" onClick={() => { onFile(null); setFileError('') }} className="min-h-[36px] rounded-lg border border-solid border-red-200 bg-white px-3 text-xs font-bold text-red-700 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300">Remove</button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); take(e.dataTransfer.files?.[0]) }}
          aria-describedby="proof-file-help"
          className={`mt-1.5 flex min-h-[120px] w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-solid border-dashed px-4 py-5 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-pm-green/40 ${drag ? 'border-pm-green bg-green-50' : fileError ? 'border-red-300 bg-red-50/40' : 'border-slate-300 bg-slate-50/60 hover:border-slate-400'}`}
        >
          <UploadCloud size={26} className="text-slate-400" aria-hidden="true" />
          <span className="text-sm font-bold text-slate-700">Choose a screenshot or drag it here</span>
        </button>
      )}
      {fileError
        ? <p role="alert" className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-red-600"><AlertCircle size={13} aria-hidden="true" /> {fileError}</p>
        : <p id="proof-file-help" className="mt-1.5 text-xs text-slate-400">JPG or PNG · up to 5 MB</p>}

      {error && <p role="alert" className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-800"><AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" /> <span>{error}</span></p>}

      <p aria-live="polite" className="sr-only">{done} of 2 required items done</p>
      <span data-done-count={done} hidden />
    </div>
  )
}

// The "N of 2 required done" counter in the modal footer.
export const proofProgress = (method, reference, file) => (validateReference(reference, method).ok ? 1 : 0) + (file ? 1 : 0)
