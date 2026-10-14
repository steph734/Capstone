import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ExternalLink, Minus, Send, Ticket, ThumbsDown, ThumbsUp, X, CheckCircle2, LifeBuoy } from 'lucide-react'
import paoImg from '../../assets/pao-bot.svg'
import { askPao, chatKey, getQuick, listTickets, sendFeedback } from './api'
import { getSessionToken } from '../../utils/session'
import { RichText, TicketForm, TicketList, TicketThread } from '../support/TicketUi'
import './PaoBot.css'

// Pao, the FAQ helper. One instance, mounted once in App for signed-in owners,
// therapists and guardians. It answers from the help centre (/api/faq/ask) and
// hands anything it can't answer, or that sounds like a bug, to a support
// ticket with the page and device details attached. Chat history lives in
// sessionStorage only and is cleared on logout.
const HIDDEN = [/^\/patient\/gamified-activities/, /^\/therapist\/gamified-activities\/games/, /^\/owner\/gamified-activities\/preview/, /^\/admin\//, /^\/(login|signup|verify|forgot|reset|set-password|staff-setup)/]
const MAX_STORED = 40
let nextId = 1
const mid = () => `m${Date.now().toString(36)}${nextId++}`
const FOCUSABLE = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'

export default function PaoBot({ user }) {
  const navigate = useNavigate()
  const location = useLocation()
  const userKey = user?.id || user?.email || 'anon'
  const firstName = String(user?.name || '').trim().split(/\s+/)[0] || 'there'

  const [open, setOpen] = useState(false)
  const [view, setView] = useState('chat') // chat | tickets | thread
  const [threadId, setThreadId] = useState(null)
  const [msgs, setMsgs] = useState(() => { try { return JSON.parse(sessionStorage.getItem(chatKey(userKey)) || '[]') } catch { return [] } })
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [quick, setQuick] = useState(null)
  const [tickets, setTickets] = useState(null)
  const [unread, setUnread] = useState(0)
  const [hint, setHint] = useState(false)
  const panel = useRef(null)
  const launcher = useRef(null)
  const inputRef = useRef(null)
  const endRef = useRef(null)

  const hidden = HIDDEN.some((re) => re.test(location.pathname))

  // Keep history in sessionStorage (never localStorage). Forms are transient.
  useEffect(() => {
    try { sessionStorage.setItem(chatKey(userKey), JSON.stringify(msgs.filter((m) => m.kind !== 'form').slice(-MAX_STORED))) } catch { /* storage unavailable */ }
  }, [msgs, userKey])

  // "Need help? Ask Pao" for six seconds on the very first visit.
  useEffect(() => {
    if (hidden) return undefined
    let seen = false
    try { seen = localStorage.getItem('paoHintSeen') === '1' } catch { seen = true }
    if (seen) return undefined
    const show = setTimeout(() => setHint(true), 800)
    const hide = setTimeout(() => { setHint(false); try { localStorage.setItem('paoHintSeen', '1') } catch { /* ignore */ } }, 6800)
    return () => { clearTimeout(show); clearTimeout(hide) }
  }, [hidden])

  // Red dot: any ticket with a reply I haven't read. Refreshed every minute.
  const refreshTickets = useCallback(() => (!getSessionToken() ? Promise.resolve() : listTickets()).then((b) => { if (b) { setTickets(b.tickets); setUnread(b.unread) } }).catch(() => {}), [])
  useEffect(() => {
    if (hidden) return undefined
    refreshTickets()
    const t = setInterval(refreshTickets, 60000)
    return () => clearInterval(t)
  }, [hidden, refreshTickets])

  useEffect(() => { if (open && quick === null) getQuick().then(setQuick).catch(() => setQuick([])) }, [open, quick])
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [msgs, typing, open, view])
  useEffect(() => { if (open && view === 'chat') setTimeout(() => inputRef.current?.focus(), 50) }, [open, view])

  const close = () => { setOpen(false); launcher.current?.focus() }
  const endChat = () => { setMsgs([]); try { sessionStorage.removeItem(chatKey(userKey)) } catch { /* ignore */ } setView('chat'); close() }

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); close(); return }
    if (e.key !== 'Tab') return
    const items = Array.from(panel.current?.querySelectorAll(FOCUSABLE) || []).filter((el) => el.offsetParent !== null)
    if (!items.length) return
    const first = items[0], last = items[items.length - 1]
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
  }

  const push = (...m) => setMsgs((cur) => [...cur, ...m.map((x) => ({ id: mid(), ...x }))])
  const addForm = (initial) => { setView('chat'); push({ role: 'bot', kind: 'form', initial }) }
  const sentAfterForm = (id, t) => setMsgs((cur) => cur.map((m) => (m.id === id ? { id, role: 'bot', kind: 'sent', ticket_no: t.ticket_no, ticket_id: t._id } : m)).concat({ id: mid(), role: 'bot', kind: 'text', text: 'Thanks. I\'ll keep an eye out for a reply for you.' }))
  const cancelForm = (id) => setMsgs((cur) => cur.filter((m) => m.id !== id))
  const showFaq = (faq, offerTicket = true) => push({ role: 'bot', kind: 'answer', faq, offerTicket })

  const send = async (raw) => {
    const text = String(raw || '').trim().slice(0, 300)
    if (!text || typing) return
    setInput(''); setView('chat')
    push({ role: 'user', kind: 'text', text })
    setTyping(true)
    try {
      const r = await askPao(text)
      setTyping(false)
      const useful = r.type === 'answer' && ['technical', 'billing', 'account'].includes(r.faq.category)
      if (r.suggest_ticket && !useful) {
        push({ role: 'bot', kind: 'text', text: 'That sounds like a bug, so I\'ll send it to our support team. I added your page and device details automatically.' })
        addForm({ category: 'bug', subject: text, message: '' })
      } else if (r.type === 'answer') showFaq(r.faq)
      else if (r.type === 'suggestions') push({ role: 'bot', kind: 'suggestions', faqs: r.faqs })
      else {
        push({ role: 'bot', kind: 'none', text })
      }
    } catch (e) {
      setTyping(false)
      push({ role: 'bot', kind: 'error', text: e.code === 'NO_SESSION' || e.status === 401 ? 'Please sign in again with your account to ask Pao.' : e.status === 429 ? 'You\'re asking very quickly. Give me a moment, then try again.' : 'Can\'t reach Pao right now. Please try again in a minute.' })
    }
  }

  const rate = (m, helpful) => {
    setMsgs((cur) => cur.map((x) => (x.id === m.id ? { ...x, rated: helpful ? 'up' : 'down' } : x)))
    sendFeedback(m.faq.id, helpful).catch(() => {})
  }
  const go = (path) => { close(); navigate(path) }

  if (hidden || !user) return null

  const isOwner = user.role === 'Owner'
  const lastUser = [...msgs].reverse().find((m) => m.role === 'user')?.text || ''
  const title = view === 'chat' ? 'Ask Pao' : view === 'tickets' ? 'My tickets' : 'Ticket'

  return (
    <div className="pao-root">
      {hint && !open && <div className="pao-hint" role="status">Need help? Ask Pao</div>}
      <button ref={launcher} type="button" className="pao-launcher" onClick={() => { setOpen((o) => !o); setHint(false) }} aria-label={unread ? `Ask Pao, ${unread} ticket ${unread === 1 ? 'reply' : 'replies'}` : 'Ask Pao'} aria-expanded={open} aria-haspopup="dialog">
        <img src={paoImg} alt="" />
        {unread > 0 && <span className="pao-badge" aria-hidden="true">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div ref={panel} className="pao-panel" role="dialog" aria-label="Ask Pao" aria-modal="false" onKeyDown={onKeyDown}>
          <header className="pao-head">
            <img src={paoImg} alt="" className="pao-avatar" />
            <div className="pao-head-text"><strong>{title}</strong><span><i className="pao-live" />Answers instantly · 24/7</span></div>
            <button type="button" className="pao-icon-btn" aria-label="My tickets" title="My tickets" onClick={() => { setView('tickets'); refreshTickets() }}><Ticket size={18} aria-hidden="true" /></button>
            <button type="button" className="pao-icon-btn" aria-label="Minimize" title="Minimize" onClick={close}><Minus size={18} aria-hidden="true" /></button>
            <button type="button" className="pao-icon-btn" aria-label="Close and clear the chat" title="Close" onClick={endChat}><X size={18} aria-hidden="true" /></button>
          </header>

          {view === 'chat' && (
            <>
              <div className="pao-body" aria-live="polite">
                <div className="pao-bubble pao-bot">Hi {firstName}! I'm Pao, your TherapyPro helper. What can I help you with?</div>
                {msgs.length === 0 && quick && quick.length > 0 && (
                  <div className="pao-chips">{quick.map((q) => <button key={q.id} type="button" className="pao-chip" onClick={() => send(q.question)}>{q.question}</button>)}
                    <button type="button" className="pao-chip" onClick={() => addForm({ category: 'question', subject: '', message: '' })}>Report a problem</button></div>
                )}
                {msgs.map((m) => (
                  <div key={m.id} className={m.role === 'user' ? 'pao-row-user' : 'pao-row-bot'}>
                    {m.kind === 'text' && <div className={`pao-bubble ${m.role === 'user' ? 'pao-user' : 'pao-bot'}`}>{m.text}</div>}
                    {m.kind === 'error' && <div className="pao-bubble pao-bot pao-err" role="alert">{m.text}</div>}
                    {m.kind === 'answer' && (
                      <>
                        <div className="pao-bubble pao-bot"><RichText text={m.faq.answer} />
                          {m.faq.link_path && <button type="button" className="pao-link" onClick={() => go(m.faq.link_path)}>{m.faq.link_label || 'Open'} <ExternalLink size={13} aria-hidden="true" /></button>}
                        </div>
                        <div className="pao-rate"><span>Did this help?</span>
                          <button type="button" aria-label="Yes, helpful" aria-pressed={m.rated === 'up'} className={m.rated === 'up' ? 'on' : ''} onClick={() => rate(m, true)}><ThumbsUp size={15} aria-hidden="true" /></button>
                          <button type="button" aria-label="No, not helpful" aria-pressed={m.rated === 'down'} className={m.rated === 'down' ? 'on' : ''} onClick={() => rate(m, false)}><ThumbsDown size={15} aria-hidden="true" /></button>
                        </div>
                        {m.offerTicket && (
                          <div className="pao-still"><span><LifeBuoy size={15} aria-hidden="true" /> Still need help?</span>
                            <button type="button" onClick={() => addForm({ category: 'question', subject: lastUser, message: '' })}>Send a ticket</button></div>
                        )}
                      </>
                    )}
                    {m.kind === 'suggestions' && (
                      <div className="pao-bubble pao-bot"><p className="sup-p">Did you mean one of these?</p>
                        <div className="pao-chips pao-chips-col">{m.faqs.map((f) => <button key={f.id} type="button" className="pao-chip" onClick={() => showFaq(f)}>{f.question}</button>)}</div>
                      </div>
                    )}
                    {m.kind === 'none' && (
                      <div className="pao-bubble pao-bot"><p className="sup-p">I couldn't find that. Want to send it to our support team?</p>
                        <button type="button" className="pao-send-ticket" onClick={() => addForm({ category: 'question', subject: m.text, message: '' })}>Send ticket</button></div>
                    )}
                    {m.kind === 'form' && (
                      <div className="pao-card"><TicketForm initial={m.initial} source="faq_bot" isOwner={isOwner} onSent={(t) => { sentAfterForm(m.id, t); refreshTickets() }} onCancel={() => cancelForm(m.id)} /></div>
                    )}
                    {m.kind === 'sent' && (
                      <div className="pao-sent" role="status"><CheckCircle2 size={16} aria-hidden="true" /> <span>Ticket {m.ticket_no} sent. We usually reply within 4 hours. <button type="button" className="pao-inline" onClick={() => { setThreadId(m.ticket_id); setView('thread') }}>Track it in My tickets</button></span></div>
                    )}
                  </div>
                ))}
                {typing && <div className="pao-bubble pao-bot pao-typing" aria-label="Pao is typing"><i /><i /><i /></div>}
                <div ref={endRef} />
              </div>
              <form className="pao-input" onSubmit={(e) => { e.preventDefault(); send(input) }}>
                <input ref={inputRef} value={input} maxLength={300} onChange={(e) => setInput(e.target.value)} placeholder="Ask a question…" aria-label="Ask a question" />
                <button type="submit" aria-label="Send" disabled={!input.trim() || typing}><Send size={18} aria-hidden="true" /></button>
              </form>
              <p className="pao-foot">Answers come from the TherapyPro help center</p>
            </>
          )}

          {view === 'tickets' && (
            <div className="pao-body">
              <button type="button" className="sup-link" onClick={() => setView('chat')}>← Back to chat</button>
              <TicketList tickets={tickets} onOpen={(id) => { setThreadId(id); setView('thread') }} empty="You have no tickets yet. Ask Pao a question, or send one from the chat." />
              <button type="button" className="sup-btn pao-new" onClick={() => addForm({ category: 'question', subject: '', message: '' })}>New ticket</button>
            </div>
          )}
          {view === 'thread' && (
            <div className="pao-body"><TicketThread ticketId={threadId} onBack={() => { setView('tickets'); refreshTickets() }} onChanged={refreshTickets} /></div>
          )}
        </div>
      )}
    </div>
  )
}
