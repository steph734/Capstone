import { Link } from 'react-router-dom'
import { ROLE_LABEL } from './ticketConfig'

const val = (v) => v || 'Not set'

// Requester details. The email is only ever sent to Super Admins and is shown only here.
export default function RequesterCard({ ticket }) {
  const r = ticket.requester
  const other = r.otherTickets || 0
  const rows = [
    ['Name', val(r.name)],
    ['Role', ROLE_LABEL[r.role] || val(r.role)],
    ['Branch', val(r.branch)],
    ['Email', val(r.email)],
  ]
  return (
    <section className="tk-card-panel">
      <h3>Requester</h3>
      <dl className="tk-kv">
        {rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd className={v === 'Not set' ? 'tk-dim' : ''}>{v}</dd></div>)}
        <div>
          <dt>Other tickets</dt>
          <dd>{other > 0 && r.name ? <Link to={`/admin/support-tickets?q=${encodeURIComponent(r.name)}`}>{other}</Link> : 'None'}</dd>
        </div>
      </dl>
    </section>
  )
}
