import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Ban, CheckCircle2, Lock, MoreHorizontal, ShieldAlert, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import useDialogA11y from '../../../components/payments/useDialogA11y'
import { Chip, hapi } from './shared'
import { fmtDate, fmtTime } from '../../../downtime/time'

export function useModal(onClose) {
  const ref = useDialogA11y({ onEscape: onClose })
  useEffect(() => { document.body.classList.add('tp-dt-lock'); return () => document.body.classList.remove('tp-dt-lock') }, [])
  return ref
}
export const Overlay = ({ onClose, children }) => createPortal(<div className="tp-dt-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>{children}</div>, document.body)

const LVL = { high: ['red', 'High'], medium: ['amber', 'Medium'], low: ['blue', 'Low'], info: ['blue', 'Info'] }

export default function IncidentModal({ id, onClose, onChanged }) {
  const ref = useModal(onClose)
  const [e, setE] = useState(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState('')
  const [more, setMore] = useState(false)
  const [confirm, setConfirm] = useState(false)
  useEffect(() => { hapi('event', { query: { id } }).then(setE).catch((x) => setErr(x.message)) }, [id])

  const act = async (key, action, body, msg, close = false) => {
    setBusy(key); setErr('')
    try { await hapi(action, { method: 'POST', body }); onChanged(msg); if (close) onClose(); else setE(await hapi('event', { query: { id } })) } catch (x) { setErr(x.message) } finally { setBusy('') }
  }
  const lvl = e && LVL[e.level]
  return (
    <Overlay onClose={onClose}>
      <div ref={ref} className="sh-modal" role="dialog" aria-modal="true" aria-labelledby="sh-inc-title" tabIndex={-1}>
        {!e ? <p className="sh-empty">{err || 'Loading…'}</p> : (
          <>
            <header><span className="sh-ico red"><ShieldAlert size={22} aria-hidden="true" /></span>
              <div><h2 id="sh-inc-title">{e.title} <Chip tone={lvl[0]}>{lvl[1]}</Chip></h2><p>Security event {e.ref} . {fmtDate(e.createdAt)}, {fmtTime(e.createdAt)} . Detected by TherapyPro</p></div>
              <button type="button" className="sh-x" onClick={onClose} aria-label="Close"><X size={18} /></button></header>
            {e.handled && <div className="sh-handled"><CheckCircle2 size={18} aria-hidden="true" /><div><b>Handled automatically</b><span>{e.ipBlocked ? 'The IP is blocked' : 'Protection acted'}{e.hasAccount ? ' and the account is locked' : ''}. Nothing is required from you unless you want a longer block.</span></div></div>}
            <div className="sh-info4">
              <div><small>WHEN</small><b>{fmtDate(e.createdAt)}, {fmtTime(e.createdAt)}</b></div>
              <div><small>IP ADDRESS</small><b><code>{e.ip || 'Unknown'}</code></b></div>
              <div><small>LOCATION</small><b>{e.country || 'Unknown'}</b></div>
              <div><small>TARGET</small><b>{e.target || 'None'}</b></div>
            </div>
            <p className="sh-label">WHAT HAPPENED</p>
            <ol className="sh-timeline">{e.timeline.map((t, i) => (
              <li key={i}><i className={t.tone} aria-hidden="true" /><div><b>{t.title}{t.leftMin != null ? ` . ${t.leftMin} min left` : ''}</b><small>{t.sub}</small></div><time>{fmtTime(t.at)}</time></li>))}</ol>
            <Link className="sh-link" to="/admin/audit-logs" onClick={onClose}>View full audit log</Link>
            {err && <p className="sh-err" role="alert">{err}</p>}
            <footer>
              {e.ip && !e.permanent && <button type="button" className="sh-btn danger" disabled={!!busy} onClick={() => setConfirm(true)}><Ban size={15} aria-hidden="true" /> Block this IP permanently</button>}
              <span className="sh-grow" />
              <div className="sh-more"><button type="button" className="sh-btn icon" aria-label="More actions" aria-expanded={more} onClick={() => setMore((v) => !v)}><MoreHorizontal size={16} /></button>
                {more && <div className="sh-menu" role="menu">
                  {e.ipBlocked && <button type="button" role="menuitem" onClick={() => act('unblock', 'unblock-ip', { ip: e.ip }, 'IP unblocked.')}>Unblock this IP</button>}
                  <button type="button" role="menuitem" onClick={() => act('block1', 'block-ip', { ip: e.ip, duration: '24h' }, 'IP blocked for 24 hours.')} disabled={!e.ip}>Block this IP for 24 hours</button></div>}</div>
              {e.hasAccount && <button type="button" className="sh-btn" disabled={!!busy} onClick={() => act('unlock', 'unlock-account', { eventId: e.id }, 'Account unlocked.')}><Lock size={15} aria-hidden="true" /> {busy === 'unlock' ? 'Unlocking…' : 'Unlock account now'}</button>}
              {e.status !== 'resolved' && <button type="button" className="sh-btn primary" disabled={!!busy} onClick={() => act('resolve', 'event-resolve', { id: e.id }, 'Event marked resolved.', true)}>{busy === 'resolve' ? 'Saving…' : 'Mark resolved'}</button>}
            </footer>
            {confirm && (
              <div className="sh-confirm" role="alertdialog" aria-labelledby="sh-cf"><b id="sh-cf">Block {e.ip} permanently?</b><p>Anyone using this address, including real users on the same network, will be unable to reach TherapyPro until you unblock it.</p>
                <div><button type="button" className="sh-btn" onClick={() => setConfirm(false)}>Cancel</button><button type="button" className="sh-btn danger solid" disabled={!!busy} onClick={() => { setConfirm(false); act('block', 'block-ip', { ip: e.ip, duration: 'permanent' }, 'IP blocked permanently.') }}>Block permanently</button></div></div>)}
          </>
        )}
      </div>
    </Overlay>
  )
}
