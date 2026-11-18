import { useState } from 'react'
import { Modal } from './FinanceUi'
import { call } from './financeApi'
import { money, DEMO_MAX_PESOS } from '../../../hooks/useDemoWallet'
import './DemoWallet.css'

export const INVALID_AMOUNT_MSG = 'Enter an amount between ₱0.00 and ₱1,000,000.00'
const CHIPS = [5000, 10000, 15240, 50000, 100000]

// Validates what the Owner typed: required, numeric, 0..1,000,000, at most 2 decimals. Returns centavos or null.
export function parseDemoAmount(text) {
  const s = String(text ?? '').replace(/,/g, '').trim()
  if (!/^(\d+(\.\d{0,2})?|\.\d{1,2})$/.test(s)) return null
  const n = Number(s)
  if (!Number.isFinite(n) || n < 0 || n > DEMO_MAX_PESOS) return null
  return Math.round(n * 100)
}

export function SetAmountModal({ balance, onClose, onSaved }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [serverError, setServerError] = useState('')
  const cents = parseDemoAmount(text)
  const invalid = text.trim() !== '' && cents === null
  const canSave = cents !== null && !busy
  const delta = cents === null ? 0 : cents - balance

  const submit = async (e) => {
    e?.preventDefault()
    if (!canSave) return
    setBusy(true); setServerError('')
    try {
      const d = await call('demo-wallet/set-amount', { method: 'POST', body: { amount: cents / 100 } })
      onSaved(d.balance)
    } catch (err) {
      setServerError(err.message || INVALID_AMOUNT_MSG)
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Set demo wallet amount"
      subtitle="Choose how much demo money your clinic has. No real money is involved."
      onClose={busy ? () => {} : onClose}
      wide={false}
      footer={(
        <div className="dw-foot">
          <button type="button" className="dw-btn light" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" form="dw-set-form" className="dw-btn primary" disabled={!canSave}>{busy ? 'Saving…' : 'Set balance'}</button>
        </div>
      )}
    >
      <form id="dw-set-form" onSubmit={submit} noValidate>
        <div className="dw-current"><span>Current balance</span><strong>{money(balance)}</strong></div>
        <label className="dw-label" htmlFor="dw-amount">New demo balance</label>
        <div className={`dw-input ${invalid ? 'invalid' : ''}`}>
          <span aria-hidden="true">₱</span>
          <input
            id="dw-amount" data-autofocus inputMode="decimal" autoComplete="off" placeholder="0.00" value={text}
            aria-invalid={invalid || undefined} aria-describedby={invalid ? 'dw-amount-err' : undefined}
            onChange={(e) => { setText(e.target.value); setServerError('') }}
          />
        </div>
        {(invalid || serverError) && <p className="dw-err" id="dw-amount-err" role="alert">{invalid ? INVALID_AMOUNT_MSG : serverError}</p>}
        <div className="dw-chips">
          {CHIPS.map((v) => (
            <button key={v} type="button" className={`fin-chip ${cents === v * 100 ? 'on' : ''}`} onClick={() => { setText(String(v)); setServerError('') }}>
              ₱{v.toLocaleString('en-PH')}
            </button>
          ))}
        </div>
        {cents !== null && (
          <div className="dw-preview">
            <span>Balance after saving</span>
            <span>{money(cents)} ({delta < 0 ? '−' : '+'}{money(Math.abs(delta))})</span>
          </div>
        )}
        <p className="dw-note">This replaces the current balance. Your history is kept and a “Set Amount” entry is added.</p>
      </form>
    </Modal>
  )
}

export function ConfirmResetModal({ busy, onCancel, onConfirm }) {
  return (
    <Modal
      title="Reset demo funds?"
      onClose={busy ? () => {} : onCancel}
      wide={false}
      footer={(
        <div className="dw-foot">
          <button type="button" className="dw-btn light" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="dw-btn primary" onClick={onConfirm} disabled={busy} data-autofocus>{busy ? 'Resetting…' : 'Reset'}</button>
        </div>
      )}
    >
      <p style={{ margin: 0 }}>Reset your demo wallet to {money(1524000)}? Your history is kept.</p>
    </Modal>
  )
}

const fmtDay = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

// One row of "Demo Wallet History". Mapping:
//   reset 'Starting demo funds' -> green +amount, "Funded"     reset (other)  -> "Reset"
//   set_amount -> blue "Set Amount" (amount = new balance)
//   payment Succeeded -> method tag, red -amount, "Paid"       Failed -> red "Failed" (not deducted)   Refunded -> amber
export function HistoryRow({ t }) {
  let pill = 'reset'; let label = 'Reset'; let amt = { text: money(t.amount), cls: '' }
  if (t.type === 'reset' && t.description === 'Starting demo funds') { pill = 'funded'; label = 'Funded'; amt = { text: `+${money(t.amount)}`, cls: 'plus' } }
  else if (t.type === 'set_amount') { pill = 'setamount'; label = 'Set Amount' }
  else if (t.type === 'payment') {
    if (t.status === 'Succeeded') { pill = 'paid'; label = 'Paid'; amt = { text: `−${money(t.amount)}`, cls: 'minus' } }
    else if (t.status === 'Refunded') { pill = 'refunded'; label = 'Refunded' }
    else { pill = 'failed'; label = 'Failed'; amt = { text: money(t.amount), cls: 'muted' } }
  }
  return (
    <div className="dw-row">
      <span className="dw-row-date">{fmtDay(t.created_at)}</span>
      <span className="dw-row-desc">
        {t.description || (t.type === 'payment' ? 'Subscription payment' : label)}
        {t.type === 'payment' && t.method && <span className="dw-method">{t.method}</span>}
      </span>
      <span className={`dw-row-amt ${amt.cls}`} title={t.status === 'Failed' ? 'Not deducted' : undefined}>{amt.text}</span>
      <span className={`dw-pill ${pill}`}>{label}</span>
    </div>
  )
}
