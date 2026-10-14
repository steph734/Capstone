import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCircle2, Plus } from 'lucide-react'
import { listTickets } from '../PaoBot/api'
import { TicketForm, TicketList, TicketThread } from './TicketUi'
import './support.css'

// "My tickets" + "New ticket", used on the Help & Support page for every role.
// ?ticket=<id> (from a notification) opens that ticket straight away.
export default function SupportCenter({ isOwner = false }) {
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useState(params.get('ticket') ? 'thread' : 'tickets')
  const [threadId, setThreadId] = useState(params.get('ticket'))
  const [tickets, setTickets] = useState(null)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(null)

  const load = useCallback(() => listTickets().then((b) => setTickets(b.tickets)).catch((e) => setError(e.code === 'NO_SESSION' ? 'Please sign in again to see your tickets.' : e.message)), [])
  useEffect(() => { load() }, [load])

  const open = (id) => { setThreadId(id); setTab('thread'); setSent(null) }
  const back = () => { setTab('tickets'); setThreadId(null); if (params.get('ticket')) { const n = new URLSearchParams(params); n.delete('ticket'); setParams(n, { replace: true }) } load() }

  return (
    <div className="sup-center">
      <div className="sup-tabs" role="tablist" aria-label="Support">
        <button type="button" role="tab" aria-selected={tab !== 'new'} className={tab !== 'new' ? 'on' : ''} onClick={back}>My tickets{tickets && tickets.some((t) => t.unread) ? ' •' : ''}</button>
        <button type="button" role="tab" aria-selected={tab === 'new'} className={tab === 'new' ? 'on' : ''} onClick={() => { setTab('new'); setSent(null) }}><Plus size={14} aria-hidden="true" /> New ticket</button>
      </div>
      {error && <p role="alert" className="sup-error">{error}</p>}
      {sent && <p role="status" className="sup-sent"><CheckCircle2 size={16} aria-hidden="true" /> Ticket {sent.ticket_no} sent. We usually reply within 4 hours.</p>}
      {tab === 'tickets' && <TicketList tickets={tickets} onOpen={open} empty="You have no tickets yet. Use “New ticket” to contact the support team." />}
      {tab === 'thread' && <TicketThread ticketId={threadId} onBack={back} onChanged={load} />}
      {tab === 'new' && <TicketForm source="help_page" isOwner={isOwner} onSent={(t) => { setSent(t); setTab('tickets'); load() }} onCancel={() => setTab('tickets')} />}
    </div>
  )
}
