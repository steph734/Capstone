import { useState } from 'react'
import { X } from 'lucide-react'
import { hapi } from './shared'
import { Overlay, useModal } from './IncidentModal'

// What each risk's action button does. Nothing here changes Atlas: Vercel's outbound IPs are not fixed.
export default function RiskModal({ risk, onClose, onDone }) {
  const ref = useModal(onClose)
  const [days, setDays] = useState(365)
  const [ok, setOk] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const call = async (action, body, msg) => { setBusy(true); setErr(''); try { await hapi('risk-action', { method: 'POST', body: { action, ...body } }); onDone(msg) } catch (e) { setErr(e.message) } finally { setBusy(false) } }
  const k = risk.actionKey
  return (
    <Overlay onClose={onClose}>
      <div ref={ref} className="sh-modal narrow" role="dialog" aria-modal="true" aria-labelledby="sh-risk-t" tabIndex={-1}>
        <header><div><h2 id="sh-risk-t">{risk.title}</h2><p>{risk.detail}</p></div><button type="button" className="sh-x" onClick={onClose} aria-label="Close"><X size={18} /></button></header>
        {k === 'restrict' && <><p>Vercel serverless functions do not use fixed IP addresses, so restricting the Atlas network access list can lock the app out of its own database. Review the list in Atlas first and plan the change with care.</p><footer><button type="button" className="sh-btn" onClick={onClose}>Close</button><a className="sh-btn primary" href="https://cloud.mongodb.com" target="_blank" rel="noreferrer">Open Atlas network access</a></footer></>}
        {k === 'remind' && <><p>This sends every owner an in-app notification and an email asking them to turn on two-step verification.</p><footer><button type="button" className="sh-btn" onClick={onClose}>Cancel</button><button type="button" className="sh-btn primary" disabled={busy} onClick={() => call('remind', {}, 'Reminder sent to owners.')}>{busy ? 'Sending…' : 'Send reminder'}</button></footer></>}
        {k === 'rotate' && <><p>Change the SESSION_SECRET in your Vercel environment variables and redeploy. Everyone will need to sign in again. Then confirm here so the date is recorded.</p><footer><button type="button" className="sh-btn" onClick={onClose}>Cancel</button><button type="button" className="sh-btn primary" disabled={busy} onClick={() => call('rotate-confirm', {}, 'Rotation date recorded.')}>{busy ? 'Saving…' : 'I rotated it'}</button></footer></>}
        {k === 'retention' && <><label className="sh-label" htmlFor="sh-days">KEEP AUDIT LOGS FOR</label>
          <select id="sh-days" className="sh-input" value={days} onChange={(e) => setDays(Number(e.target.value))}>{[30, 90, 180, 365].map((d) => <option key={d} value={d}>{d} days</option>)}</select>
          <label className="sh-checkline"><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} /> I understand audit logs older than {days} days are deleted automatically.</label>
          <footer><button type="button" className="sh-btn" onClick={onClose}>Cancel</button><button type="button" className="sh-btn primary" disabled={busy || !ok} onClick={() => call('retention', { days, confirm: true }, `Audit logs are now kept for ${days} days.`)}>{busy ? 'Saving…' : 'Save'}</button></footer></>}
        {err && <p className="sh-err" role="alert">{err}</p>}
      </div>
    </Overlay>
  )
}
