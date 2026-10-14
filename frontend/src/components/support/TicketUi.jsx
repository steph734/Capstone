import { useCallback, useEffect, useRef, useState } from 'react'
import { Bug, CircleAlert, Paperclip, Send, X } from 'lucide-react'
import { attachmentUrl, contextLabel, createTicket, getTicket, replyTicket, ticketContext } from '../PaoBot/api'
import './support.css'

// Pieces shared by the Pao panel and the Help & Support page: the ticket list,
// a ticket thread (never shows internal notes: the server doesn't send them)
// and the "new ticket" form.
export const STATUS_LABEL = { open: 'Open', in_progress: 'In progress', waiting_on_user: 'Waiting on you', resolved: 'Resolved', closed: 'Closed' }
export const CATEGORY_LABEL = { bug: 'Bug / error', billing: 'Billing / payment', account: 'Account / login', question: 'Question', other: 'Other', game_request: 'Game request', branch: 'Branch' }

export function StatusPill({ status }) {
  return <span className={`sup-pill sup-pill-${status}`}>{STATUS_LABEL[status] || status}</span>
}

const when = (d) => new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

// **bold**, numbered "1. steps" and paragraphs: all rendered as elements, never as HTML.
function inline(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part))
}
export function RichText({ text }) {
  const blocks = []
  let list = null
  for (const line of String(text || '').split('\n')) {
    const m = line.match(/^\s*(\d+)\.\s+(.*)$/)
    if (m) { if (!list) { list = []; blocks.push({ type: 'ol', items: list }) } list.push(m[2]) } else { list = null; if (line.trim()) blocks.push({ type: 'p', text: line }) }
  }
  return (
    <>
      {blocks.map((b, i) => (b.type === 'ol'
        ? <ol key={i} className="sup-ol">{b.items.map((it, j) => <li key={j}>{inline(it)}</li>)}</ol>
        : <p key={i} className="sup-p">{inline(b.text)}</p>))}
    </>
  )
}

export function TicketList({ tickets, onOpen, empty }) {
  if (!tickets) return <p className="sup-muted">Loading…</p>
  if (tickets.length === 0) return <p className="sup-muted">{empty || 'You have no tickets yet.'}</p>
  return (
    <ul className="sup-list">
      {tickets.map((t) => (
        <li key={t.id}>
          <button type="button" className="sup-row" onClick={() => onOpen(t.id)}>
            <span className="sup-row-main">
              <span className="sup-row-subject">{t.unread && <span className="sup-dot" aria-label="New reply" />}{t.subject}</span>
              <span className="sup-row-meta">{t.ticket_no} · {when(t.last_message_at || t.created_at)}</span>
            </span>
            <StatusPill status={t.status} />
          </button>
        </li>
      ))}
    </ul>
  )
}

export function TicketThread({ ticketId, onBack, onChanged }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const end = useRef(null)
  const load = useCallback(() => getTicket(ticketId).then((d) => { setData(d); onChanged?.() }).catch((e) => setError(e.message)), [ticketId, onChanged])
  useEffect(() => { load() }, [load])
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [data?.messages.length])

  const send = async () => {
    if (!text.trim() || busy) return
    setBusy(true); setError('')
    try { await replyTicket(ticketId, text.trim()); setText(''); await load() } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  const openFile = async (m, a) => {
    try { const { url } = await attachmentUrl(m.id, a.index); window.open(url, '_blank', 'noopener') } catch (e) { setError(e.message) }
  }

  if (!data) return <div className="sup-thread">{onBack && <button type="button" className="sup-link" onClick={onBack}>← My tickets</button>}<p className="sup-muted">{error || 'Loading…'}</p></div>
  const { ticket, messages } = data
  return (
    <div className="sup-thread">
      <div className="sup-thread-head">
        {onBack && <button type="button" className="sup-link" onClick={onBack}>← My tickets</button>}
        <h3>{ticket.subject}</h3>
        <p className="sup-row-meta">{ticket.ticket_no} · {CATEGORY_LABEL[ticket.category] || ticket.category} <StatusPill status={ticket.status} /></p>
      </div>
      <div className="sup-msgs" aria-live="polite">
        {messages.map((m) => (
          <div key={m.id} className={`sup-msg ${m.from === 'me' ? 'sup-msg-me' : 'sup-msg-them'}`}>
            <span className="sup-msg-who">{m.from === 'me' ? 'You' : 'TherapyPro support'} · {when(m.created_at)}</span>
            <div className="sup-bubble"><RichText text={m.body} />
              {m.attachments.map((a) => <button key={a.index} type="button" className="sup-attach" onClick={() => openFile(m, a)}><Paperclip size={14} aria-hidden="true" /> {a.file_name}</button>)}
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>
      {error && <p role="alert" className="sup-error">{error}</p>}
      {ticket.status === 'closed'
        ? <p className="sup-muted">This ticket is closed. Please open a new ticket if you still need help.</p>
        : (
          <div className="sup-reply">
            <textarea aria-label="Reply" rows={2} maxLength={5000} value={text} placeholder="Write a reply…" onChange={(e) => setText(e.target.value)} />
            <button type="button" className="sup-btn" disabled={busy || !text.trim()} onClick={send}><Send size={16} aria-hidden="true" /> {busy ? 'Sending…' : 'Reply'}</button>
          </div>
        )}
    </div>
  )
}

export function TicketForm({ initial = {}, source = 'help_page', isOwner = false, onSent, onCancel }) {
  const [category, setCategory] = useState(initial.category || 'question')
  const [subject, setSubject] = useState((initial.subject || '').slice(0, 150))
  const [message, setMessage] = useState(initial.message || '')
  const [file, setFile] = useState(null)
  const [fileError, setFileError] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [fields, setFields] = useState({})
  const fileRef = useRef(null)
  const context = ticketContext()
  const categories = ['bug', 'billing', 'account', 'question', 'other', ...(isOwner ? ['game_request', 'branch'] : [])]

  const pickFile = (f) => {
    setFileError('')
    if (!f) return
    if (!/^image\//.test(f.type)) { setFileError('Attach an image.'); return }
    if (f.size > 5 * 1024 * 1024) { setFileError('Screenshots can be up to 5 MB.'); return }
    setFile(f)
  }
  const submit = async (e) => {
    e.preventDefault()
    const f = {}
    if (!subject.trim()) f.subject = 'Add a short subject.'
    if (!message.trim()) f.message = 'Tell us what happened.'
    setFields(f); setError('')
    if (Object.keys(f).length) return
    setBusy(true)
    try { onSent(await createTicket({ category, subject: subject.trim(), message: message.trim(), source, context }, file)) } catch (err) {
      setFields(err.fields || {}); setError(err.message); setBusy(false)
    }
  }

  return (
    <form className="sup-form" onSubmit={submit} noValidate>
      <label className="sup-label" htmlFor="sup-cat">Category</label>
      <div className="sup-select">
        <select id="sup-cat" value={category} onChange={(e) => setCategory(e.target.value)}>{categories.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}</select>
        {category === 'bug' && <Bug size={14} aria-hidden="true" className="sup-select-icon" />}
      </div>
      <label className="sup-label" htmlFor="sup-subject">Subject</label>
      <input id="sup-subject" className={fields.subject ? 'sup-bad' : ''} value={subject} maxLength={150} onChange={(e) => setSubject(e.target.value)} />
      {fields.subject && <span role="alert" className="sup-error">{fields.subject}</span>}
      <label className="sup-label" htmlFor="sup-msg">What happened?</label>
      <textarea id="sup-msg" className={fields.message ? 'sup-bad' : ''} rows={4} maxLength={5000} value={message} onChange={(e) => setMessage(e.target.value)} />
      {fields.message && <span role="alert" className="sup-error">{fields.message}</span>}
      <p className="sup-context"><CircleAlert size={13} aria-hidden="true" /> <span><strong>Attached:</strong> {contextLabel(context)}</span></p>
      {file ? (
        <p className="sup-file"><Paperclip size={14} aria-hidden="true" /> {file.name} <button type="button" className="sup-link" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = '' }} aria-label="Remove screenshot"><X size={14} aria-hidden="true" /></button></p>
      ) : (
        <button type="button" className="sup-dashed" onClick={() => fileRef.current?.click()}><Paperclip size={14} aria-hidden="true" /> Add screenshot (optional)</button>
      )}
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => pickFile(e.target.files?.[0])} aria-label="Screenshot" />
      {fileError && <span role="alert" className="sup-error">{fileError}</span>}
      {error && <p role="alert" className="sup-error">{error}</p>}
      <div className="sup-actions">
        {onCancel && <button type="button" className="sup-btn sup-btn-ghost" onClick={onCancel}>Cancel</button>}
        <button type="submit" className="sup-btn sup-btn-block" disabled={busy}><Send size={16} aria-hidden="true" /> {busy ? 'Sending…' : 'Send ticket'}</button>
      </div>
    </form>
  )
}
