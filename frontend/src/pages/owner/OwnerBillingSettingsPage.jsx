import { useState } from 'react'
import OwnerPageShell from './OwnerPageShell'
import { getOwnerMenuItems } from './ownerSidebarConfig'
import { NewInvoiceButton, BILLING_SUBTITLE } from './OwnerBillingShared'
import './OwnerBillingPage.css'

const INITIAL_METHODS = [
  { id: 'card', icon: '💳', label: 'Credit / Debit Card', sub: 'Visa, Mastercard, JCB', on: true },
  { id: 'gcash', icon: '📱', label: 'GCash', sub: 'Direct wallet payment', on: true },
  { id: 'bank', icon: '🏦', label: 'Bank Transfer', sub: 'Manual reconciliation', on: false },
  { id: 'cash', icon: '🧾', label: 'Cash at Clinic', sub: 'Recorded manually by front desk', on: true },
]

const SELECTS = [
  { id: 'currency', label: 'Currency', options: ['PHP (₱)', 'USD ($)', 'EUR (€)'] },
  { id: 'terms', label: 'Payment terms', options: ['Due on receipt', 'Net 7', 'Net 15', 'Net 30'] },
  { id: 'lateFee', label: 'Late fee', options: ['None', '2% per week', '₱200 flat', '5% flat'] },
  {
    id: 'template',
    label: 'Receipt template',
    options: ['TherapyPro Standard', 'Minimal', 'Detailed (itemized)'],
  },
]

export default function OwnerBillingSettingsPage({ user, onLogout, betaTier }) {
  const [methods, setMethods] = useState(INITIAL_METHODS)
  const [prefs, setPrefs] = useState({
    currency: 'PHP (₱)',
    terms: 'Due on receipt',
    lateFee: 'None',
    template: 'TherapyPro Standard',
  })
  const [toast, setToast] = useState('')

  const toggle = (id) =>
    setMethods((list) => list.map((m) => (m.id === id ? { ...m, on: !m.on } : m)))

  const save = () => {
    setToast('Settings saved')
    setTimeout(() => setToast(''), 2400)
  }

  return (
    <OwnerPageShell
      user={user}
      onLogout={onLogout}
      title="Sales / Billing"
      subtitle={BILLING_SUBTITLE}
      icon="💰"
      menuItems={getOwnerMenuItems(betaTier)}
      headerActions={<NewInvoiceButton />}
    >
      {toast && <div className="sb-toast">{toast}</div>}

      <div className="set-grid">
        <section className="sba-card">
          <h3 className="sba-card-title">Accepted Payment Methods</h3>
          <p className="sba-card-sub">Choose how guardians can pay their invoices</p>

          <div className="set-methods">
            {methods.map((m) => (
              <div key={m.id} className="set-method">
                <span className="set-method-icon" aria-hidden="true">{m.icon}</span>
                <div className="set-method-main">
                  <div className="set-method-label">{m.label}</div>
                  <div className="set-method-sub">{m.sub}</div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={m.on}
                  aria-label={`${m.label} ${m.on ? 'enabled' : 'disabled'}`}
                  className={`set-toggle ${m.on ? 'on' : ''}`}
                  onClick={() => toggle(m.id)}
                >
                  <span className="set-toggle-knob" />
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="sba-card">
          <h3 className="sba-card-title">Invoice Preferences</h3>
          <p className="sba-card-sub">Applies to every new invoice you send</p>

          <div className="set-fields">
            {SELECTS.map((s) => (
              <label key={s.id} className="set-field">
                <span>{s.label}</span>
                <select
                  value={prefs[s.id]}
                  onChange={(e) => setPrefs((p) => ({ ...p, [s.id]: e.target.value }))}
                >
                  {s.options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          <button type="button" className="set-save" onClick={save}>
            Save Settings
          </button>
        </section>
      </div>
    </OwnerPageShell>
  )
}
