import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, Check, Clock, Info, LogIn, RefreshCw, Save, ShieldCheck, Sparkles, Wrench, X } from 'lucide-react'
import useDialogA11y from '../components/payments/useDialogA11y'
import { PAO_SLEEPY, PAO_WOW, PAO_WAVE } from '../components/idle/IdleTimeoutModal'
import { aboutText, fmtDate, fmtDateLong, fmtRange, fmtTime, pad2, untilText } from './time'
import './downtime.css'

// Body scroll lock while any downtime modal is open.
function useBodyLock() {
  useEffect(() => {
    document.body.classList.add('tp-dt-lock')
    return () => document.body.classList.remove('tp-dt-lock')
  }, [])
}

// Every modal: portal into <body>, fixed full-viewport overlay (z 1000), panel above it (z 1001), focus trap, aria-modal.
function Modal({ labelId, onClose, dismissible = false, pao, paoAlt, children, className = '' }) {
  useBodyLock()
  const ref = useDialogA11y({ onEscape: onClose, locked: !dismissible })
  return createPortal(
    <div className="tp-dt-overlay">
      <div className="tp-dt-stack">
        {pao && <img className="tp-dt-pao" src={pao} alt={paoAlt || ''} width="150" height="190" draggable="false" />}
        <div ref={ref} className={`tp-dt-panel ${className}`} role="dialog" aria-modal="true" aria-labelledby={labelId} tabIndex={-1}>{children}</div>
      </div>
    </div>,
    document.body,
  )
}

const Pill = ({ tone = 'amber', icon, children }) => <span className={`tp-dt-pill ${tone}`}>{icon}{children}</span>
const Bullet = ({ icon, children }) => <li><span className="tp-dt-bi" aria-hidden="true">{icon}</span><span>{children}</span></li>

// ── Banner (image 190) ──
export function DowntimeBanner({ dt, onDetails, onDismiss }) {
  useEffect(() => { document.body.classList.add('tp-dt-has-banner'); return () => document.body.classList.remove('tp-dt-has-banner') }, [])
  return createPortal(
    <div className="tp-dt-banner" role="status">
      <Wrench size={16} aria-hidden="true" />
      <span className="tp-dt-banner-text">Scheduled update: {fmtDate(dt.startAt)}, {fmtRange(dt.startAt, dt.endAt)}. Save your work before then.</span>
      <button type="button" className="tp-dt-banner-link" onClick={onDetails}>Details</button>
      <button type="button" className="tp-dt-banner-x" onClick={onDismiss} aria-label="Dismiss the update banner"><X size={16} aria-hidden="true" /></button>
    </div>,
    document.body,
  )
}

// ── Notices: 196 (week), 197 (24 h), 191 (standard), 202 (short) ──
const HEAD = { week: 'TherapyPro update planned next week', h24: 'TherapyPro update is tomorrow night', standard: 'TherapyPro will be down for updates' }
export function NoticeModal({ variant, dt, serverNow, onGotIt, onSnooze, snoozeLabel }) {
  const start = Date.parse(dt.startAt), end = Date.parse(dt.endAt)
  const short = variant === 'short'
  const left = start - serverNow
  const title = short ? `Update starts at ${fmtTime(dt.startAt)}` : HEAD[variant]
  return (
    <Modal labelId="tp-dt-notice-title" dismissible onClose={onGotIt} pao={PAO_WOW} paoAlt="Pao the panda is surprised">
      {short
        ? <Pill tone="red" icon={<Clock size={14} aria-hidden="true" />}>Starting in {untilText(left)}</Pill>
        : <Pill icon={<Wrench size={14} aria-hidden="true" />}>{dt.title}</Pill>}
      <h2 id="tp-dt-notice-title">{title}</h2>
      <p className="tp-dt-lead">{short ? `TherapyPro goes down in ${untilText(left)}. Finish what you are doing now.` : dt.message}</p>
      {!short && (
        <div className="tp-dt-facts">
          <div><small>WHEN</small><strong>{fmtDateLong(dt.startAt)}</strong><span>{fmtRange(dt.startAt, dt.endAt)}</span></div>
          <div><small>LENGTH</small><strong>{aboutText(end - start)}</strong><span>Philippine Time</span></div>
          <div><small>STARTS IN</small><strong>{untilText(left)}</strong><span>{fmtDate(dt.startAt)}</span></div>
        </div>
      )}
      <ul className="tp-dt-list">
        <Bullet icon={<Save size={16} />}>{short ? 'Save notes and finish uploads.' : `Save your work before ${fmtTime(dt.startAt)}.`}</Bullet>
        <Bullet icon={<LogIn size={16} />}>{short ? 'You will be signed out automatically.' : 'You will be signed out automatically when the update starts.'}</Bullet>
        {!short && <Bullet icon={<ShieldCheck size={16} />}>Appointments, notes and payments are not lost.</Bullet>}
      </ul>
      <div className="tp-dt-actions">
        {!short && onSnooze && <button type="button" className="tp-dt-btn light" onClick={onSnooze}>{snoozeLabel}</button>}
        <button type="button" className="tp-dt-btn primary" onClick={onGotIt} data-autofocus>Got it</button>
      </div>
    </Modal>
  )
}

// ── Final countdown (192): cannot be dismissed or snoozed ──
const R = 62, C = 2 * Math.PI * R
export function CountdownModal({ remainingMs, totalMs, finishing, onSignOut }) {
  const secs = Math.max(0, Math.ceil(remainingMs / 1000))
  const red = secs < 60
  const progress = Math.max(0, Math.min(1, remainingMs / totalMs))
  const [spoken, setSpoken] = useState('')
  const last = useRef(null)
  useEffect(() => {
    if ([240, 180, 120, 60, 30, 10, 5].includes(secs) && last.current !== secs) { last.current = secs; setSpoken(`${Math.ceil(secs / 60) >= 2 && secs % 60 === 0 ? secs / 60 + ' minutes' : secs + ' seconds'} until TherapyPro goes down.`) }
  }, [secs])
  return (
    <Modal labelId="tp-dt-count-title" dismissible={false} pao={PAO_SLEEPY} paoAlt="Pao the panda is getting sleepy">
      <Pill tone="red" icon={<Clock size={14} aria-hidden="true" />}>Update starting soon</Pill>
      <h2 id="tp-dt-count-title">{finishing ? 'Finishing what you started' : 'Please save your work'}</h2>
      <p className="tp-dt-lead">{finishing ? 'Your upload or payment is still in progress, so you have a little extra time. You will be signed out as soon as it is done.' : 'TherapyPro will go down for updates in a few minutes. You will be signed out automatically.'}</p>
      <div className="tp-dt-ring" aria-hidden="true">
        <svg viewBox="0 0 140 140" width="150" height="150">
          <circle cx="70" cy="70" r={R} className="track" />
          <circle cx="70" cy="70" r={R} className={`bar${red ? ' red' : ''}`} strokeDasharray={C} strokeDashoffset={C * (1 - progress)} transform="rotate(-90 70 70)" />
        </svg>
        <div className={`tp-dt-ringnum${red ? ' red' : ''}`}><strong>{pad2(Math.floor(secs / 60))}:{pad2(secs % 60)}</strong><span>MIN : SEC</span></div>
      </div>
      <p className="tp-dt-sr" role="status" aria-live="polite">{spoken}</p>
      <p className="tp-dt-note"><Info size={15} aria-hidden="true" /> Uploads and payments in progress get a little extra time to finish.</p>
      <div className="tp-dt-actions"><button type="button" className="tp-dt-btn primary wide" onClick={onSignOut} data-autofocus><LogIn size={16} aria-hidden="true" /> Save and sign out now</button></div>
    </Modal>
  )
}

// ── Update cancelled (200) ──
export function CancelledModal({ title, startAt, onClose }) {
  return (
    <Modal labelId="tp-dt-cancel-title" dismissible onClose={onClose} pao={PAO_WAVE} paoAlt="Pao the panda waves">
      <Pill tone="green" icon={<Check size={14} aria-hidden="true" />}>Update cancelled</Pill>
      <h2 id="tp-dt-cancel-title">The update is cancelled</h2>
      <p className="tp-dt-lead">{title ? `"${title}"` : 'The scheduled update'}{startAt ? ` planned for ${fmtDate(startAt)} at ${fmtTime(startAt)}` : ''} will not happen. Nothing changes for you and you can keep using TherapyPro as usual.</p>
      <div className="tp-dt-actions"><button type="button" className="tp-dt-btn primary wide" onClick={onClose} data-autofocus>Got it</button></div>
    </Modal>
  )
}

// ── Full-screen pages (maintenance 193 / longer 201 / back online 194) ──
function FullPage({ children }) {
  useBodyLock()
  return createPortal(<div className="tp-dt-page" role="main"><div className="tp-dt-brand">TherapyPro</div>{children}</div>, document.body)
}

export function MaintenanceScreen({ dt, serverNow, onCheck, checking, onAdmin }) {
  const start = dt ? Date.parse(dt.startAt) : null
  const end = dt ? Date.parse(dt.endAt) : null
  const over = !!dt && serverNow > end
  const pct = dt ? Math.min(over ? 92 : 100, Math.max(4, ((serverNow - start) / Math.max(1, end - start)) * 100)) : 10
  return (
    <FullPage>
      <div className="tp-dt-stack">
        <img className="tp-dt-pao big" src={PAO_SLEEPY} alt="Pao the panda is sleeping" width="170" height="215" draggable="false" />
        <div className="tp-dt-panel wide-card" role="alertdialog" aria-labelledby="tp-dt-m-title" aria-describedby="tp-dt-m-desc">
          <Pill icon={<Wrench size={14} aria-hidden="true" />}>{over ? 'Taking a little longer' : 'Scheduled update'}</Pill>
          <h2 id="tp-dt-m-title">{over ? 'Almost there, thank you for waiting' : 'We are updating TherapyPro'}</h2>
          <p id="tp-dt-m-desc" className="tp-dt-lead">{over ? 'The update is taking longer than we planned. Pao is still working on it, and your data is safe.' : (dt?.message || 'TherapyPro is being updated. Your data is safe.')}</p>
          <div className="tp-dt-bar-row"><span>{over ? 'Finishing up' : 'In progress'}</span>{over && <b className="ok">Past the expected time</b>}</div>
          <div className={`tp-dt-bar${over ? ' stripes' : ''}`} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin="0" aria-valuemax="100"><i style={{ width: `${pct}%` }} /></div>
          <dl className="tp-dt-rows">
            <div><dt><Clock size={16} aria-hidden="true" /> Started</dt><dd>{dt ? `${fmtDate(dt.startAt)}, ${fmtTime(dt.startAt)}` : 'Just now'}</dd></div>
            <div><dt><CalendarDays size={16} aria-hidden="true" /> Expected back</dt><dd>{dt ? `${fmtDate(dt.endAt)}, ${fmtTime(dt.endAt)}${over ? ' (passed)' : ''}` : 'Soon'}</dd></div>
            <div><dt><ShieldCheck size={16} aria-hidden="true" /> Your data</dt><dd>Safe and backed up</dd></div>
          </dl>
          <div className="tp-dt-actions"><button type="button" className="tp-dt-btn primary" onClick={onCheck} disabled={checking} data-autofocus><RefreshCw size={16} aria-hidden="true" className={checking ? 'spin' : ''} /> Check again</button></div>
          <p className="tp-dt-foot">This page checks automatically every minute.</p>
          {onAdmin && <button type="button" className="tp-dt-admin" onClick={onAdmin}>Administrator sign-in</button>}
        </div>
      </div>
    </FullPage>
  )
}

export function BackOnlineScreen({ ended, onContinue }) {
  const notes = ended?.releaseNotes || []
  return (
    <FullPage>
      <div className="tp-dt-stack">
        <img className="tp-dt-pao big" src={PAO_WAVE} alt="Pao the panda waves hello" width="170" height="215" draggable="false" />
        <div className="tp-dt-panel wide-card" role="alertdialog" aria-labelledby="tp-dt-b-title">
          <Pill tone="green" icon={<Check size={14} aria-hidden="true" />}>Back online</Pill>
          <h2 id="tp-dt-b-title">TherapyPro is back!</h2>
          <p className="tp-dt-lead">Thanks for waiting. The update finished at {fmtTime(ended?.endedAt)}.</p>
          {notes.length > 0 && (
            <div className="tp-dt-notes"><small>WHAT IS NEW</small><ul>{notes.map((n, i) => <li key={i}><span className="tp-dt-bi"><Sparkles size={16} aria-hidden="true" /></span>{n}</li>)}</ul></div>
          )}
          <div className="tp-dt-actions"><button type="button" className="tp-dt-btn primary wide" onClick={onContinue} data-autofocus><LogIn size={16} aria-hidden="true" /> Continue to login</button></div>
        </div>
      </div>
    </FullPage>
  )
}

