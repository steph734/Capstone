import { useEffect, useRef } from 'react'
import { Avatar, RoleChip } from './TicketChips'
import { firstNameOf, relativeTime } from './ticketConfig'
import { openAttachment } from './ticketsApi'

// Messages in order. Admin replies sit on the right, internal notes are boxed and labelled. All text is
// rendered as plain text (React escapes it); line breaks are kept with CSS.
export default function TicketThread({ messages, requesterName, onError }) {
  const end = useRef(null)
  useEffect(() => { end.current?.scrollIntoView?.({ block: 'nearest' }) }, [messages.length])
  const publicReplies = messages.filter((m) => m.authorRole === 'super_admin' && !m.internal)

  const open = async (m, a) => {
    try { const { url } = await openAttachment(m.id, a.index); window.open(url, '_blank', 'noopener,noreferrer') } catch (e) { onError?.(e.message) }
  }

  return (
    <div className="tk-thread" aria-live="polite">
      {messages.map((m) => {
        const admin = m.authorRole === 'super_admin'
        return (
          <div key={m.id} className={`tk-msg ${admin ? 'tk-msg-admin' : ''} ${m.internal ? 'tk-msg-internal' : ''} ${m.pending ? 'tk-msg-pending' : ''}`}>
            <Avatar name={m.author} size={34} />
            <div className="tk-msg-body">
              <div className="tk-msg-head">
                <strong>{m.author}</strong>
                <RoleChip role={m.authorRole} />
                <span>· {m.pending ? 'sending…' : relativeTime(m.createdAt)}</span>
              </div>
              {m.internal && <p className="tk-internal-flag"><span aria-hidden="true">🔒</span> Internal note · Only admins can see this</p>}
              <div className="tk-bubble">
                <p>{m.body}</p>
                {m.attachments.map((a) => <button key={a.index} type="button" className="tk-attach" onClick={() => open(m, a)}><span aria-hidden="true">📎</span> {a.fileName}</button>)}
              </div>
            </div>
          </div>
        )
      })}
      {publicReplies.length === 0 && <p className="tk-thread-note">No replies yet · Reply below to respond to {firstNameOf(requesterName)}</p>}
      <div ref={end} />
    </div>
  )
}
