import { useEffect, useRef, useState } from 'react'
import { CreditCard, QrCode, Check, Loader2, AlertTriangle, ImageIcon, X, Lock } from 'lucide-react'
import useDialogA11y from '../../../components/payments/useDialogA11y'
import { Dialog } from './ui'
import { REF_RULES, formatRef, refError, digitsOf, readAsDataUrl, peso } from './format'

// "Pay Online" for the first-session fee. QR only for now: the therapist sends the GCash / Maya reference number and a receipt
// screenshot, the payment is saved as "Awaiting verification" and appears in Payments to verify. Nothing here marks it paid.
const QR_IMG = { gcash: '/instapay-qr.jpg', paymaya: '/maya-qr.jpg' }

function SendingModal() {
  const ref = useDialogA11y({ locked: true })
  return (
    <div className="pm-backdrop top">
      <div className="pm-dialog narrow center" role="alertdialog" aria-modal="true" aria-labelledby="pm-sending-title" tabIndex={-1} ref={ref}>
        <div className="pm-dlg-body center">
          <Loader2 size={40} className="pm-spin" aria-hidden="true" />
          <h2 id="pm-sending-title" className="pm-center-title">Sending your payment details…</h2>
          <p className="pm-muted">Please keep this window open.</p>
        </div>
      </div>
    </div>
  )
}

export default function PayModal({ amount, patientName, sending, error, onBack, onSubmit }) {
  const [stage, setStage] = useState('pay') // 'pay' | 'confirm'
  const [qr, setQr] = useState('gcash')
  const [reference, setReference] = useState('')
  const [receipt, setReceipt] = useState(null) // { dataUrl, name, size }
  const [touched, setTouched] = useState(false)
  const [receiptError, setReceiptError] = useState('')
  const [asking, setAsking] = useState(false)
  const [agree, setAgree] = useState(false)
  const fileRef = useRef(null)
  const ref = useDialogA11y({ onEscape: onBack, locked: sending || asking })
  const refErr = refError(reference, qr)

  useEffect(() => { setReference((r) => formatRef(r, qr)) }, [qr])

  const pick = async (file) => {
    if (!file) return
    setReceiptError('')
    if (!['image/jpeg', 'image/png'].includes(file.type)) { setReceiptError('Only JPG or PNG images are allowed.'); return }
    if (file.size > 5 * 1024 * 1024) { setReceiptError('That image is larger than 5 MB. Choose a smaller screenshot.'); return }
    try { setReceipt({ dataUrl: await readAsDataUrl(file), name: file.name, size: file.size }) } catch (e) { setReceiptError(e.message) }
  }

  const review = () => {
    setTouched(true)
    if (refErr || !receipt) { if (!receipt) setReceiptError('Upload a screenshot of your receipt.'); return }
    setAgree(false); setAsking(true)
  }
  const send = async () => {
    setAsking(false)
    const ok = await onSubmit({ method: qr, reference: digitsOf(reference), receipt: receipt.dataUrl })
    if (!ok) setTouched(true)
  }

  return (
    <div className="pm-backdrop top" onMouseDown={(e) => { if (e.target === e.currentTarget && !sending && !asking) onBack() }}>
      <div className="pm-pay" role="dialog" aria-modal="true" aria-labelledby="pm-pay-title" tabIndex={-1} ref={ref}>
        <aside className="pm-pay-left">
          <p className="pm-kicker">Payment amount</p>
          <p className="pm-pay-amount">{peso(amount)}</p>
          <p className="pm-kicker">Payment for</p>
          <p className="pm-pay-for">TherapyPro · First session (Cognitive) for {patientName}</p>
          <div className="pm-pay-line"><span>Therapy Session</span><span>1 × {peso(amount)}</span></div>
          <div className="pm-pay-total"><span>Total</span><strong>{peso(amount)}</strong></div>
          <p className="pm-secure"><Lock size={12} aria-hidden="true" /> Secured checkout</p>
        </aside>

        <section className="pm-pay-right">
          <button type="button" className="pm-x abs" onClick={onBack} aria-label="Close payment" disabled={sending || asking}><X size={18} /></button>
          <ol className="pm-mini-steps" aria-label="Payment steps">
            <li className={stage === 'pay' ? 'on' : 'done'}><span>{stage === 'pay' ? 1 : <Check size={13} aria-hidden="true" />}</span> Pay</li>
            <li className={stage === 'confirm' ? 'on' : ''}><span>2</span> Confirm payment</li>
          </ol>

          {stage === 'pay' ? (
            <>
              <h2 id="pm-pay-title" className="pm-pay-title">Choose your payment method</h2>
              <div className="pm-pay-tiles">
                <button type="button" className="pm-tile" disabled aria-disabled="true"><CreditCard size={18} aria-hidden="true" /><strong>Pay with card</strong><em>Not available for new patients yet</em></button>
                <button type="button" className="pm-tile on" aria-pressed="true"><QrCode size={18} aria-hidden="true" /><strong>Pay with QR code</strong><em>GCash or Maya · scan to pay</em></button>
              </div>
              <div className="pm-qr-box">
                <p className="pm-kicker center">Scan to pay</p>
                <p className="pm-qr-amount">{peso(amount)}</p>
                <div className="pm-qr-tabs" role="tablist" aria-label="QR wallet">
                  {['gcash', 'paymaya'].map((m) => <button key={m} type="button" role="tab" aria-selected={qr === m} className={qr === m ? 'on' : ''} onClick={() => setQr(m)}>{REF_RULES[m].label}</button>)}
                </div>
                <img className="pm-qr-img" src={QR_IMG[qr]} alt={`${REF_RULES[qr].label} QR code`} />
                <p className="pm-qr-help">Open {REF_RULES[qr].label}, scan this code and send exactly <b>{peso(amount)}</b>.</p>
              </div>
              <div className="pm-pay-foot"><button type="button" className="pm-btn light" onClick={onBack}>Back</button><button type="button" className="pm-btn primary" onClick={() => setStage('confirm')} data-autofocus>Continue</button></div>
            </>
          ) : (
            <>
              <h2 id="pm-pay-title" className="pm-pay-title">Add your payment proof</h2>
              <p className="pm-muted">After sending {peso(amount)} by {REF_RULES[qr].label}, enter the reference number and upload your receipt.</p>
              <div className="pm-field">
                <label className="pm-label" htmlFor="pm-ref">Reference number <span className="pm-req" aria-hidden="true">*</span></label>
                <input id="pm-ref" className="pm-input mono" inputMode="numeric" value={reference} onChange={(e) => setReference(formatRef(e.target.value, qr))} placeholder={qr === 'gcash' ? '0000 000 000 000' : '0000 0000 0000'} aria-invalid={(touched && Boolean(refErr)) || undefined} autoComplete="off" data-autofocus />
                <p className="pm-hint">{qr === 'gcash' ? 'Find it on your GCash receipt, under “Ref No.” (13 digits).' : 'Find it on your Maya receipt, under “Reference ID” (10 to 16 digits).'}</p>
                {touched && refErr && <p className="pm-field-error" role="alert">{refErr}</p>}
              </div>
              <div className="pm-field">
                <span className="pm-label">Receipt screenshot <span className="pm-req" aria-hidden="true">*</span></span>
                {receipt ? (
                  <div className="pm-receipt"><img src={receipt.dataUrl} alt="Receipt preview" /><span>{receipt.name}</span><button type="button" className="pm-link-btn" onClick={() => fileRef.current?.click()}>Change</button></div>
                ) : (
                  <button type="button" className="pm-drop" onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files?.[0]) }}><ImageIcon size={20} aria-hidden="true" /> Upload a JPG or PNG (max 5 MB)</button>
                )}
                <input ref={fileRef} type="file" accept="image/jpeg,image/png" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = '' }} />
                {receiptError && <p className="pm-field-error" role="alert">{receiptError}</p>}
              </div>
              {error && <p className="pm-form-error" role="alert"><AlertTriangle size={15} aria-hidden="true" /> {error}</p>}
              <div className="pm-pay-foot"><button type="button" className="pm-btn light" onClick={() => setStage('pay')} disabled={sending}>Back</button><button type="button" className="pm-btn primary" onClick={review} disabled={sending}>Submit payment</button></div>
            </>
          )}
        </section>
      </div>

      {asking && (
        <Dialog narrow icon={CreditCard} title="Is your payment complete?" subtitle="Check these before we record it." onClose={() => setAsking(false)} labelId="pm-complete-title"
          footer={(<><button type="button" className="pm-btn light" onClick={() => setAsking(false)}>Go back</button><button type="button" className="pm-btn primary" onClick={send} disabled={!agree}>Yes, submit payment</button></>)}>
          <ul className="pm-checks big">
            <li><Check size={16} aria-hidden="true" /><span><b>Payment sent</b><em>{REF_RULES[qr].label} QR · {peso(amount)}</em></span></li>
            <li><Check size={16} aria-hidden="true" /><span><b>Reference number added</b><em>{reference}</em></span></li>
            <li><Check size={16} aria-hidden="true" /><span><b>Receipt image uploaded</b><em>{receipt?.name}</em></span></li>
          </ul>
          <label className="pm-invite"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /><span>I confirm the payment is complete and the reference number and receipt are correct.</span></label>
          <p className="pm-note amber"><AlertTriangle size={14} aria-hidden="true" /> Wrong details can delay the confirmation.</p>
        </Dialog>
      )}
      {sending && <SendingModal />}
    </div>
  )
}
