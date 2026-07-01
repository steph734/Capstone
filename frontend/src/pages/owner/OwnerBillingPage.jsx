import OwnerPageShell from './OwnerPageShell'
import { ownerMenuItems } from './ownerSidebarConfig'

const billingRows = [
  { item: 'Appointments', amount: '₱48,000', status: 'Paid' },
  { item: 'Subscriptions', amount: '₱22,500', status: 'Paid' },
  { item: 'Pending Invoices', amount: '₱7,400', status: 'Open' },
]

export default function OwnerBillingPage({ user, onLogout }) {
  return (
    <OwnerPageShell
      user={user}
      onLogout={onLogout}
      title="Sales / Billing"
      subtitle="Track income, invoices, and payment status"
      icon="💰"
      menuItems={ownerMenuItems}
    >
      <section className="admin-table-card">
        <table className="admin-table">
          <thead>
            <tr><th>Category</th><th>Amount</th><th>Status</th></tr>
          </thead>
          <tbody>
            {billingRows.map((row) => (
              <tr key={row.item}>
                <td>{row.item}</td>
                <td>{row.amount}</td>
                <td><span className={`admin-pill ${row.status === 'Paid' ? 'green' : 'yellow'}`}>{row.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </OwnerPageShell>
  )
}
