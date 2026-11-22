import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CreditCard, QrCode, Check, Loader2, AlertTriangle, ImageIcon, X, Lock } from 'lucide-react'
import useDialogA11y from '../../../components/payments/useDialogA11y'
import { Dialog, useModalLock } from './ui'
import CardPay from './CardPay'
import useIdleBusy from '../../../hooks/useIdleBusy'
import { REF_RULES, formatRef, refError, digitsOf, readAsDataUrl, peso } from './format'

// "Pay Online" for the first-session fee. QR only for now: the therapist sends the GCash / Maya reference number and a receipt
// screenshot, the payment is saved as "Awaiting verification" and appears in Payments to verify. Nothing here marks it paid.
const QR_IMG = { gcash: '/instapay-qr.jpg', paymaya: '/maya-qr.jpg' }

function SendingModal({ therapistName }) {
  useIdleBusy('payment')
  const ref = useDialogA11y({ locked: true })
  useModalLock()
  const [secs, setSecs] = useState(0)
  useEffect(() => { const t = setInterval(() => setSecs((n) => n + 1), 1000); return () => clearInterval(t) }, [])
  const mm = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
  const rows = [
    { t: 'Payment confirmed', d: 'You confirmed the payment', state: 'done' },
    { t: 'Saving the patient, reference number and receipt', d: 'Saving…', state: 'now' },
    { t: `Sending to ${therapistName || 'your clinic'}`, d: 'Appears in Payments to verify', state: 'next' },
  ]
  return createPortal(
    <div className="pm-backdrop top">
      <div className="pm-dialog narrow center pm-sendbox" role="alertdialog" aria-modal="true" aria-labelledby="pm-sending-title" aria-describedby="pm-sending-desc" tabIndex={-1} ref={ref}>
        <div className="pm-dlg-body center">
          <h2 id="pm-sending-title" className="pm-center-title">Sending your payment details…</h2>
          <p id="pm-sending-desc" className="pm-muted">This usually takes a few seconds.</p>
          <div className="pm-ring" aria-hidden="true"><Loader2 size={44} className="pm-spin" /></div>
          <p className="pm-elapsed"><span>Elapsed {mm}</span> · usually under 30 sec</p>
          <ol className="pm-send-steps">
            {rows.map((r) => (
              <li key={r.t} className={r.state}>
                <span className="pm-send-dot">{r.state === 'done' ? <Check size={14} aria-hidden="true" /> : r.state === 'now' ? <Loader2 size={13} className="pm-spin" aria-hidden="true" /> : null}</span>
                <span><b>{r.t}</b><em>{r.d}</em></span>
              </li>
            ))}
          </ol>
          <p className="pm-note amber"><AlertTriangle size={14} aria-hidden="true" /> Please do not close this window, refresh, or press Back.</p>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default function PayModal({ amount, patientName, therapistName, sending, error, onBack, onSubmit, getCardIntent, cardEnabled = true }) {
  const [stage, setStage] = useState('pay') // 'pay' | 'confirm' | 'proof'
  const [sentOk, setSentOk] = useState(false)
  const [tab, setTab] = useState(cardEnabled ? 'card' : 'qr') // 'card' | 'qr'
  const [paidId, setPaidId] = useState('') // set once the card is charged, so a failed save is retried without charging again
  const [qr, setQr] = useState('gcash')
  const [reference, setReference] = useState('')
  const [receipt, setReceipt] = useState(null) // { dataUrl, name, size }
  const [touched, setTouched] = useState(false)
  const [receiptError, setReceiptError] = useState('')
  const [asking, setAsking] = useState(false)
  const [agree, setAgree] = useState(false)
  const fileRef = useRef(null)
  const ref = useDialogA11y({ onEscape: onBack, locked: sending || asking })
  useModalLock()
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

  return createPortal(
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
            {(tab === 'qr' ? ['Pay', 'Confirm payment', 'Reference & receipt'] : ['Pay']).map((label, n) => {
              const at = stage === 'pay' ? 0 : stage === 'confirm' ? 1 : 2
              return <li key={label} className={n < at ? 'done' : n === at ? 'on' : ''}><span>{n < at ? <Check size={13} aria-hidden="true" /> : n + 1}</span> {label}</li>
            })}
          </ol>

          {stage === 'pay' ? (
            <>
              <h2 id="pm-pay-title" className="pm-pay-title">Choose your payment method</h2>
              <div className="pm-pay-tiles">
                <button type="button" className={`pm-tile${tab === 'card' ? ' on' : ''}`} aria-pressed={tab === 'card'} disabled={!cardEnabled || Boolean(paidId)} onClick={() => setTab('card')}><CreditCard size={18} aria-hidden="true" /><strong>Pay with card</strong><em>{cardEnabled ? 'Visa, Mastercard, Stripe Link' : 'Not available right now'}</em></button>
                <button type="button" className={`pm-tile${tab === 'qr' ? ' on' : ''}`} aria-pressed={tab === 'qr'} disabled={Boolean(paidId)} onClick={() => setTab('qr')}><QrCode size={18} aria-hidden="true" /><strong>Pay with QR code</strong><em>GCash or Maya · scan to pay</em></button>
              </div>
              {tab === 'card' ? (
                <CardPay amount={amount} getIntent={getCardIntent} paidId={paidId} sending={sending} serverError={error}
                  onBack={onBack} onPaid={async (id) => { setPaidId(id); const ok = await onSubmit({ method: 'card', payment_intent_id: id }); if (ok) setPaidId('') }} />
              ) : (<>
              <div className="pm-qr-box">
                <p className="pm-kicker center">Scan to pay</p>
                <p className="pm-qr-amount">{peso(amount)}</p>
                <div className="pm-qr-tabs" role="tablist" aria-label="QR wallet">
                  {['gcash', 'paymaya'].map((m) => <button key={m} type="button" role="tab" aria-selected={qr === m} className={qr === m ? 'on' : ''} onClick={() => setQr(m)}>{REF_RULES[m].label}</button>)}
                </div>
                <img className="pm-qr-img" src={QR_IMG[qr]} alt={`${REF_RULES[qr].label} QR code`} />
                <p className="pm-qr-help">Open {REF_RULES[qr].label}, scan this code and send exactly <b>{peso(amount)}</b>.</p>
              </div>
              <div className="pm-pay-foot"><button type="button" className="pm-btn light" onClick={onBack}>Back</button><button type="button" className="pm-btn primary" onClick={() => { setSentOk(false); setStage('confirm') }} data-autofocus>Continue</button></div>
              </>)}
            </>
          ) : stage === 'confirm' ? (
            <>
              <h2 id="pm-pay-title" className="pm-pay-title">Confirm your payment</h2>
              <p className="pm-muted">Please check the details before we record the payment and add the patient.</p>
              <div className="pm-card pm-confirm-card">
                <div className="pm-sum-row"><span>Payment method</span><strong>{REF_RULES[qr].label} QR</strong></div>
                <div className="pm-sum-row"><span>Amount</span><strong>{peso(amount)}</strong></div>
                <div className="pm-sum-row"><span>Patient</span><strong>{patientName}</strong></div>
                <div className="pm-sum-row"><span>Therapist</span><strong>{therapistName || 'You'} · Cognitive</strong></div>
              </div>
              <label className="pm-invite"><input type="checkbox" checked={sentOk} onChange={(e) => setSentOk(e.target.checked)} /><span>I sent exactly <b>{peso(amount)}</b> using the {REF_RULES[qr].label} QR code</span></label>
              <div className="pm-pay-foot"><button type="button" className="pm-btn light" onClick={() => setStage('pay')}>Back</button><button type="button" className="pm-btn primary" disabled={!sentOk} onClick={() => setStage('proof')} data-autofocus>Yes, confirm payment</button></div>
            </>
          ) : (
            <>
              <h2 id="pm-pay-title" className="pm-pay-title">Add your payment proof <span className="pm-reqpill">Required</span></h2>
              <p className="pm-muted">Enter the {REF_RULES[qr].label} reference number and upload your receipt so it can be verified in Payments.</p>
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
              <div className="pm-pay-foot"><button type="button" className="pm-btn light" onClick={() => setStage('confirm')} disabled={sending}>Back</button><span className="pm-done-count">{(refErr ? 0 : 1) + (receipt ? 1 : 0)} of 2 required done</span><button type="button" className="pm-btn primary" onClick={review} disabled={sending}>Submit payment</button></div>
            </>
          )}
        </section>
      </div>

      {asking && (
        <Dialog narrow icon={CreditCard} title="Is your payment complete?" subtitle="Please check these before we send them for verification." onClose={() => setAsking(false)} labelId="pm-complete-title"
          footer={(<><button type="button" className="pm-btn light" onClick={() => setAsking(false)}>Go back</button><button type="button" className="pm-btn primary" onClick={send} disabled={!agree}>Yes, submit payment</button></>)}>
          <ul className="pm-checks big">
            <li><Check size={16} aria-hidden="true" /><span><b>Payment sent</b><em>{REF_RULES[qr].label} QR · {peso(amount)}</em></span></li>
            <li><Check size={16} aria-hidden="true" /><span><b>Reference number added</b><em>{reference}</em></span><button type="button" className="pm-mini-btn" onClick={() => { setAsking(false); setTimeout(() => document.getElementById('pm-ref')?.focus(), 0) }}>Edit</button></li>
            <li><Check size={16} aria-hidden="true" /><span><b>Receipt image uploaded</b><em>{receipt?.name}</em></span>{receipt && <img className="pm-thumb" src={receipt.dataUrl} alt="" />}<button type="button" className="pm-mini-btn" onClick={() => { setAsking(false); fileRef.current?.click() }}>Change</button></li>
          </ul>
          <label className="pm-invite"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /><span>I confirm the payment is complete and the reference number and receipt are correct.</span></label>
          <p className="pm-note amber"><AlertTriangle size={14} aria-hidden="true" /> Wrong details can delay the confirmation.</p>
        </Dialog>
      )}
      {sending && <SendingModal therapistName={therapistName} />}
    </div>,
    document.body,
  )
}
