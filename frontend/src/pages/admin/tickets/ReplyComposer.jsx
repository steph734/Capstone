import { useRef, useState } from 'react'
import { CANNED_REPLIES, fillCanned, firstNameOf } from './ticketConfig'

// Reply / internal-note box, used in the reading pane (variant "pane": tabs, quick chips, Send & resolve) and on
// the full page (variant "page": canned menu and an Internal note checkbox).
// `onSend({ body, internal, file })` returns a promise. The box clears at once (the thread shows the message
// optimistically); if the send fails the text comes back with an error and a Retry button.
export default function ReplyComposer({ requesterName, variant = 'pane', onSend, onSendAndResolve, disabled }) {
  const first = firstNameOf(requesterName)
  const [mode, setMode] = useState('reply') // reply | note
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [sending, setSending] = useState(false)
  const [failed, setFailed] = useState(null) // { body, internal, file, message }
  const [cannedOpen, setCannedOpen] = useState(false)
  const fileRef = useRef(null)
  const areaRef = useRef(null)
  const internal = mode === 'note'

  const insert = (value) => {
    setText((t) => (t.trim() ? `${t.replace(/\s+$/, '')}\n${value}` : value))
    areaRef.current?.focus()
  }

  const deliver = async (payload) => {
    setSending(true)
    setFailed(null)
    try { await onSend(payload) } catch (e) {
      setText((t) => t || payload.body)
      setFile((f) => f || payload.file || null)
      setFailed({ ...payload, message: e.message || 'Could not send.' })
      return false
    } finally { setSending(false) }
    return true
  }

  const send = async () => {
    if ((!text.trim() && !file) || sending) return
    const payload = { body: text.trim(), internal, file }
    setText(''); setFile(null)
    await deliver(payload)
  }
  const sendAndResolve = async () => {
    if (!text.trim() || sending) return
    const payload = { body: text.trim(), internal: false, file }
    setText(''); setFile(null)
    if (await deliver(payload)) onSendAndResolve?.(payload.body)
  }
  const retry = async () => { if (failed) { const { body, internal: i, file: f } = failed; setText(''); setFile(null); await deliver({ body, internal: i, file: f }) } }

  if (disabled) return null
  const label = internal ? 'Internal note' : `Reply to ${first}`
  const empty = !text.trim() && !file

  const attachBtn = (
    <>
      <button type="button" className="tk-btn tk-btn-ghost" onClick={() => fileRef.current?.click()}><span aria-hidden="true">📎</span> Attach</button>
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden aria-label="Attach an image" onChange={(e) => { setFile(e.target.files?.[0] || null); e.target.value = '' }} />
    </>
  )

  return (
    <div className={`tk-composer tk-composer-${variant}`}>
      {variant === 'pane' && (
        <div className="tk-composer-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={!internal} className={!internal ? 'on' : ''} onClick={() => setMode('reply')}>Reply to {first}</button>
          <button type="button" role="tab" aria-selected={internal} className={internal ? 'on' : ''} onClick={() => setMode('note')}><span aria-hidden="true">🔒</span> Internal note</button>
        </div>
      )}
      <textarea
        ref={areaRef}
        aria-label={label}
        rows={variant === 'pane' ? 4 : 3}
        maxLength={5000}
        value={text}
        placeholder={internal ? 'Only admins can see this note…' : variant === 'pane' ? 'Write your reply…' : 'Write your reply to the requester…'}
        onChange={(e) => setText(e.target.value)}
      />
      {file && <p className="tk-file"><span aria-hidden="true">📎</span> {file.name} <button type="button" className="tk-link" onClick={() => setFile(null)} aria-label="Remove attachment">Remove</button></p>}
      {failed && (
        <p className="tk-error" role="alert">
          {failed.message} <button type="button" className="tk-link" onClick={retry}>Retry</button>
        </p>
      )}
      {variant === 'pane' && !internal && (
        <div className="tk-quick" aria-label="Quick replies">
          {CANNED_REPLIES.map((c) => <button key={c.id} type="button" onClick={() => insert(fillCanned(c.text, first))}>{c.label}</button>)}
        </div>
      )}
      <div className="tk-composer-actions">
        {variant === 'page' ? (
          <>
            <div className="tk-menu-wrap">
              <button type="button" className="tk-btn tk-btn-ghost" aria-haspopup="menu" aria-expanded={cannedOpen} onClick={() => setCannedOpen((o) => !o)}>Canned replies ▾</button>
              {cannedOpen && (
                <div className="tk-menu" role="menu" onKeyDown={(e) => { if (e.key === 'Escape') setCannedOpen(false) }}>
                  {CANNED_REPLIES.map((c) => <button key={c.id} type="button" role="menuitem" onClick={() => { insert(fillCanned(c.text, first)); setCannedOpen(false) }}>{c.label}</button>)}
                </div>
              )}
            </div>
            {attachBtn}
            <label className="tk-check"><input type="checkbox" checked={internal} onChange={(e) => setMode(e.target.checked ? 'note' : 'reply')} /> <span aria-hidden="true">🔒</span> Internal note</label>
          </>
        ) : attachBtn}
        <span className="tk-spacer" />
        {variant === 'pane' && !internal && onSendAndResolve && (
          <button type="button" className="tk-btn tk-btn-outline" disabled={sending || !text.trim()} onClick={sendAndResolve}>Send &amp; resolve</button>
        )}
        <button type="button" className="tk-btn tk-btn-primary" disabled={sending || empty} onClick={send}>
          {sending ? 'Sending…' : internal ? 'Add note' : 'Send reply →'}
        </button>
      </div>
    </div>
  )
}
