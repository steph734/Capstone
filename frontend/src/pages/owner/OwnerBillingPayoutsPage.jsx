import { useCallback, useEffect, useRef, useState } from 'react'
import OwnerPageShell from './OwnerPageShell'
import { getOwnerMenuItems } from './ownerSidebarConfig'
import { NewInvoiceButton, BILLING_SUBTITLE } from './OwnerBillingShared'
import { BillingTabs, Skeleton, useToast } from './billing/FinanceUi'
import { call } from './billing/financeApi'
import { SetAmountModal, ConfirmResetModal, HistoryRow } from './billing/DemoWalletUi'
import useDemoWallet, { money, DEMO_START_BALANCE } from '../../hooks/useDemoWallet'
import './billing/OwnerFinance.css'
import './OwnerBillingPage.css'
import './billing/DemoWallet.css'

const PAGE = 20

export default function OwnerBillingPayoutsPage({ user, onLogout, betaTier }) {
  const wallet = useDemoWallet()
  const [toastEl, toast] = useToast()
  const [history, setHistory] = useState({ rows: [], next: null, status: 'loading', error: '' })
  const [loadingMore, setLoadingMore] = useState(false)
  const [modal, setModal] = useState(null) // null | 'set' | 'reset'
  const [resetting, setResetting] = useState(false)
  const reqId = useRef(0)

  const loadFirst = useCallback(async () => {
    const id = ++reqId.current
    setHistory((h) => ({ ...h, status: h.rows.length ? 'ready' : 'loading', error: '' }))
    try {
      const d = await call('demo-wallet/transactions', { query: { limit: PAGE } })
      if (id === reqId.current) setHistory({ rows: d.transactions, next: d.next_before, status: 'ready', error: '' })
    } catch (err) {
      if (id === reqId.current) setHistory((h) => ({ ...h, status: 'error', error: err.message || 'Could not load the wallet history.' }))
    }
  }, [])

  // Reload whenever the shared wallet changes (set amount / reset / a payment made elsewhere).
  useEffect(() => { loadFirst() }, [loadFirst, wallet.revision])

  const loadMore = async () => {
    if (!history.next || loadingMore) return
    setLoadingMore(true)
    try {
      const d = await call('demo-wallet/transactions', { query: { limit: PAGE, before: history.next } })
      setHistory((h) => ({ ...h, rows: [...h.rows, ...d.transactions], next: d.next_before }))
    } catch (err) {
      toast(err.message || 'Could not load more.', 'err')
    } finally {
      setLoadingMore(false)
    }
  }

  const onSaved = (balance) => {
    wallet.setBalance(balance) // updates the hero and, through `revision`, reloads the history (new row on top)
    setModal(null)
    toast(`Demo wallet set to ${money(balance)}`)
  }

  const doReset = async () => {
    setResetting(true)
    try {
      const d = await call('demo-wallet/reset', { method: 'POST' })
      wallet.setBalance(d.balance)
      setModal(null)
      toast(`Demo wallet reset to ${money(d.balance)}`)
    } catch (err) {
      toast(err.message || 'Could not reset the demo wallet.', 'err')
    } finally {
      setResetting(false)
    }
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
      <BillingTabs />
      {toastEl}

      <div className="dw-hero">
        <div>
          <p className="dw-hero-label">Demo wallet balance</p>
          <p className="dw-hero-amount" aria-live="polite">{wallet.ready ? money(wallet.balance) : '—'}</p>
          <p className="dw-hero-meta">Stripe Test Mode · spent on subscriptions via Card or GCash</p>
        </div>
        <div className="dw-hero-actions">
          <div className="dw-hero-btns">
            <button type="button" className="dw-btn outline" onClick={() => setModal('set')} disabled={!wallet.ready}>✎ Set Amount</button>
            <button type="button" className="dw-btn yellow" onClick={() => setModal('reset')} disabled={!wallet.ready || resetting}>↺ Reset Demo Funds</button>
          </div>
          <p className="dw-hero-note">Reset returns to {money(DEMO_START_BALANCE)} · Set Amount picks any value</p>
        </div>
      </div>

      {wallet.error && !wallet.ready && (
        <div className="dw-error" role="alert" style={{ marginBottom: 16 }}>
          {wallet.error}
          <button type="button" className="inv-btn ghost" onClick={wallet.refresh}>Retry</button>
        </div>
      )}

      <section className="sba-card">
        <h3 className="sba-card-title">Demo Funding</h3>
        <p className="sba-card-sub">Where your demo money is spent</p>
        <div className="dw-funding">
          <span className="dw-funding-icon" aria-hidden="true">🧪</span>
          <div className="dw-funding-main">
            <div className="dw-funding-name">Stripe Test Mode · Card 4242 · GCash (test)</div>
            <div className="dw-funding-sub">Demo wallet balance is deducted after each successful test payment</div>
          </div>
          <span className="dw-pill test">● Test mode</span>
        </div>

        <h3 className="dw-history-title">Demo Wallet History</h3>
        {history.status === 'loading' && <Skeleton rows={3} />}
        {history.status === 'error' && (
          <div className="dw-error" role="alert">
            {history.error}
            <button type="button" className="inv-btn ghost" onClick={loadFirst}>Retry</button>
          </div>
        )}
        {history.status === 'ready' && history.rows.length === 0 && <p className="dw-empty">No demo wallet activity yet</p>}
        {history.rows.length > 0 && history.status !== 'loading' && (
          <div>
            {history.rows.map((t) => <HistoryRow key={t._id} t={t} />)}
            {history.next && (
              <button type="button" className="dw-btn light dw-more" onClick={loadMore} disabled={loadingMore}>{loadingMore ? 'Loading…' : 'Load more'}</button>
            )}
          </div>
        )}
      </section>

      {modal === 'set' && wallet.ready && <SetAmountModal balance={wallet.balance} onClose={() => setModal(null)} onSaved={onSaved} />}
      {modal === 'reset' && <ConfirmResetModal busy={resetting} onCancel={() => setModal(null)} onConfirm={doReset} />}
    </OwnerPageShell>
  )
}
