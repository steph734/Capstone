import { useState } from 'react'
import OwnerPageShell from './OwnerPageShell'
import { getOwnerMenuItems } from './ownerSidebarConfig'
import { NewInvoiceButton, BILLING_SUBTITLE, peso, fmtDate } from './OwnerBillingShared'
import './OwnerBillingPage.css'

const SCHEDULES = [
  { id: 'weekly', label: 'every week' },
  { id: 'biweekly', label: 'every 2 weeks' },
  { id: 'monthly', label: 'every month' },
]

const PAYOUT_HISTORY = [
  { id: 'p1', date: '2026-08-29', amount: 12980 },
  { id: 'p2', date: '2026-08-15', amount: 14210 },
  { id: 'p3', date: '2026-08-01', amount: 11730 },
]

export default function OwnerBillingPayoutsPage({ user, onLogout, betaTier }) {
  const [schedule, setSchedule] = useState('biweekly')
  const [editingSchedule, setEditingSchedule] = useState(false)
  const [toast, setToast] = useState('')

  const flash = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2400)
  }

  const scheduleLabel = SCHEDULES.find((s) => s.id === schedule)?.label

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

      <div className="pay-hero">
        <div>
          <p className="pay-hero-label">Next payout</p>
          <p className="pay-hero-amount">{peso(15240)}</p>
          <p className="pay-hero-meta">
            Arriving {fmtDate('2026-09-12')} · {scheduleLabel}
          </p>
        </div>
        <button
          type="button"
          className="pay-hero-btn"
          onClick={() => setEditingSchedule((v) => !v)}
        >
          Change Schedule
        </button>
      </div>

      {editingSchedule && (
        <section className="sba-card" style={{ marginBottom: 20 }}>
          <h3 className="sba-card-title" style={{ marginBottom: 12 }}>Payout Schedule</h3>
          <div className="sba-filter-group">
            {SCHEDULES.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`sba-chip ${schedule === s.id ? 'active' : ''}`}
                onClick={() => {
                  setSchedule(s.id)
                  setEditingSchedule(false)
                  flash(`Payouts now run ${s.label}`)
                }}
              >
                {s.label[0].toUpperCase() + s.label.slice(1)}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="sba-card">
        <h3 className="sba-card-title">Payout Account</h3>
        <p className="sba-card-sub">Where your clinic&apos;s revenue gets deposited</p>

        <div className="pay-account">
          <span className="pay-account-icon" aria-hidden="true">🏦</span>
          <div className="pay-account-main">
            <div className="pay-account-name">BDO Savings •••• 4821</div>
            <div className="pay-account-sub">Primary payout account</div>
          </div>
          <button
            type="button"
            className="inv-btn ghost"
            onClick={() => flash('Manage payout account — coming soon')}
          >
            Manage
          </button>
        </div>

        <h3 className="sba-card-title" style={{ marginTop: 24 }}>Payout History</h3>
        <div className="pay-history">
          {PAYOUT_HISTORY.map((p) => (
            <div key={p.id} className="pay-history-row">
              <span className="inv-muted">{fmtDate(p.date)}</span>
              <span className="inv-amount">{peso(p.amount)}</span>
              <span className="sba-status paid">Paid out</span>
            </div>
          ))}
        </div>
      </section>
    </OwnerPageShell>
  )
}
