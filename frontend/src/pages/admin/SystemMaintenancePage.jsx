import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertTriangle, CalendarDays, Check, CheckCircle2, Clock, Info, Lock, Pencil, Play, Power, ShieldCheck, Users, UserRound, Building2, Wrench, X,
} from 'lucide-react'
import AdminPageShell from './AdminPageShell'
import { adminMenuItems } from './adminSidebarConfig'
import useDialogA11y from '../../components/payments/useDialogA11y'
import { PAO_SLEEPY, PAO_WOW } from '../../components/idle/IdleTimeoutModal'
import { sys } from '../../downtime/api'
import { computePlan, describeLead, validateSchedule, DEFAULT_AUDIENCE, DEFAULT_REMINDERS, PLAN_LABELS, MIN, HOUR, DAY } from '../../../api/_lib/downtimePlan.js'
import { countdownParts, durationText, fmtDate, fmtDateLong, fmtRange, fmtTime, fromManila, pad2, toManilaParts } from '../../downtime/time'
import './SystemMaintenancePage.css'

const CHIPS = [{ label: '30 min', ms: 30 * MIN }, { label: '1 hour', ms: HOUR }, { label: '2 hours', ms: 2 * HOUR }, { label: '4 hours', ms: 4 * HOUR }]
const CHECKS = [
  ['deployed', 'Update deployed and migrations finished'],
  ['adminChecked', 'Super Admin login and dashboard checked'],
  ['therapistChecked', 'Test therapist login and open Appointments'],
  ['patientChecked', 'Test a patient login and a payment screen'],
  ['notesChecked', 'Release notes are correct'],
]

function defaultForm() {
  const s = toManilaParts(new Date(Date.now() + 2 * DAY))
  const e = toManilaParts(new Date(fromManila(s.date, '22:00').getTime() + 2 * HOUR))
  return { title: 'Scheduled system update', message: 'We are rolling out new games and faster loading. TherapyPro will be unavailable while we update. Your data is safe.', notes: '', startDate: s.date, startTime: '22:00', endDate: e.date, endTime: e.time, audience: { ...DEFAULT_AUDIENCE }, reminders: { ...DEFAULT_REMINDERS } }
}
function formFrom(dt) {
  const s = toManilaParts(dt.startAt), e = toManilaParts(dt.endAt)
  return { title: dt.title, message: dt.message, notes: (dt.releaseNotes || []).join('\n'), startDate: s.date, startTime: s.time, endDate: e.date, endTime: e.time, audience: { ...dt.audience }, reminders: { ...DEFAULT_REMINDERS, ...dt.reminders } }
}

// A confirmation dialog: portal, fixed full-viewport overlay, focus trap, body scroll locked.
function Dialog({ icon, tone = 'amber', title, children, onClose }) {
  const ref = useDialogA11y({ onEscape: onClose })
  useEffect(() => { document.body.classList.add('tp-dt-lock'); return () => document.body.classList.remove('tp-dt-lock') }, [])
  return createPortal(
    <div className="tp-dt-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={ref} className="sm-dialog" role="dialog" aria-modal="true" aria-labelledby="sm-dlg-title" tabIndex={-1}>
        <span className={`sm-dialog-icon ${tone}`}>{icon}</span>
        <h2 id="sm-dlg-title">{title}</h2>
        {children}
      </div>
    </div>,
    document.body,
  )
}

const Check2 = ({ checked, onChange, disabled, children, sub, locked }) => (
  <label className={`sm-check${disabled ? ' disabled' : ''}`}>
    <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange?.(e.target.checked)} />
    <span className="sm-box" aria-hidden="true">{checked && <Check size={13} strokeWidth={3} />}</span>
    <span className="sm-check-text"><b>{children}{locked && <Lock size={12} aria-hidden="true" />}</b>{sub && <small>{sub}</small>}</span>
  </label>
)

export default function SystemMaintenancePage({ user, onLogout }) {
  const [data, setData] = useState(null) // { downtime }
  const [history, setHistory] = useState([])
  const [counts, setCounts] = useState({ online: {}, accounts: {} })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [flash, setFlash] = useState('')
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState(defaultForm)
  const [fieldErrors, setFieldErrors] = useState({})
  const [editing, setEditing] = useState(false)
  const [dialog, setDialog] = useState(null) // 'start' | 'cancel' | 'end'
  const [ack, setAck] = useState(false)
  const [notify, setNotify] = useState(true)
  const [, setTick] = useState(0)
  const offsetRef = useRef(0)

  const load = useCallback(async () => {
    try {
      const [cur, hist, cnt] = await Promise.all([sys('current'), sys('history'), sys('online-count')])
      offsetRef.current = Date.parse(cur.serverTime) - Date.now()
      setData(cur); setHistory(hist.history || []); setCounts(cnt); setError('')
    } catch (e) { setError(e.message || 'Could not load the downtime.') } finally { setLoading(false) }
  }, [])
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t) }, [load])
  useEffect(() => { const t = setInterval(() => setTick((n) => n + 1), 1000); return () => clearInterval(t) }, [])

  const now = Date.now() + offsetRef.current
  const dt = data?.downtime || null
  const startMs = dt ? Date.parse(dt.startAt) : 0
  const endMs = dt ? Date.parse(dt.endAt) : 0
  const phase = !dt ? 'none' : dt.status === 'active' && now >= startMs ? 'active' : 'scheduled'

  // Re-open the form in "edit" mode with the saved values.
  const startEdit = () => { setForm(formFrom(dt)); setFieldErrors({}); setEditing(true) }

  const run = async (fn, okText) => {
    setBusy(true); setError('')
    try { const r = await fn(); if (okText) setFlash(okText); await load(); return r } catch (e) {
      setFieldErrors(e.fields || {}); setError(e.message || 'Something went wrong.'); return null
    } finally { setBusy(false) }
  }
  useEffect(() => { if (!flash) return undefined; const t = setTimeout(() => setFlash(''), 5000); return () => clearTimeout(t) }, [flash])

  // ── form helpers ──
  const startAt = fromManila(form.startDate, form.startTime)
  const endAt = fromManila(form.endDate, form.endTime)
  const validStart = !Number.isNaN(startAt.getTime())
  const durMs = validStart && !Number.isNaN(endAt.getTime()) ? endAt.getTime() - startAt.getTime() : null
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const setStart = (patch) => setForm((f) => {
    const next = { ...f, ...patch }
    const a = fromManila(f.startDate, f.startTime), b = fromManila(f.endDate, f.endTime)
    const keep = !Number.isNaN(a.getTime()) && !Number.isNaN(b.getTime()) && b > a ? b - a : 2 * HOUR // moving the start keeps the length
    const s = fromManila(next.startDate, next.startTime)
    if (Number.isNaN(s.getTime())) return next
    const e = toManilaParts(new Date(s.getTime() + keep))
    return { ...next, endDate: e.date, endTime: e.time }
  })
  const chip = (ms) => { if (!validStart) return; const e = toManilaParts(new Date(startAt.getTime() + ms)); set({ endDate: e.date, endTime: e.time }) }
  const payload = () => ({
    title: form.title, message: form.message, releaseNotes: form.notes.split('\n').map((x) => x.trim()).filter(Boolean),
    startAt: validStart ? startAt.toISOString() : '', endAt: Number.isNaN(endAt.getTime()) ? '' : endAt.toISOString(), audience: form.audience, reminders: form.reminders,
  })
  const plan = useMemo(() => (validStart ? computePlan({ startAt, now: new Date(now), reminders: form.reminders, existing: editing ? dt?.plan?.map((p) => ({ ...p, sendAt: new Date(p.sendAt) })) : [] }) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form.startDate, form.startTime, form.reminders, editing, Math.floor(now / 60000)])

  const submit = async (e) => {
    e.preventDefault()
    setFieldErrors({})
    const { fields } = validateSchedule(payload(), { now: new Date(now), keepStartAt: editing ? dt.startAt : null })
    if (Object.keys(fields).length) { setFieldErrors(fields); setError(Object.values(fields)[0]); return }
    const r = await run(() => (editing ? sys('edit', { method: 'PATCH', id: dt.id, body: payload() }) : sys('schedule', { method: 'POST', body: payload() })), editing ? 'Schedule updated. The reminder plan was recalculated.' : 'Downtime scheduled. Users will see the banner now.')
    if (r) setEditing(false)
  }

  const headerPill = (
    <span className={`sm-pill ${phase === 'active' ? 'red' : phase === 'scheduled' ? 'amber' : 'green'}`}>
      {phase === 'scheduled' ? <Clock size={13} aria-hidden="true" /> : <i aria-hidden="true" />}
      {phase === 'active' ? 'Downtime active' : phase === 'scheduled' ? 'Downtime scheduled' : 'System online'}
    </span>
  )

  const onlineNow = counts.online || {}
  const accounts = counts.accounts || {}

  return (
    <AdminPageShell user={user} onLogout={onLogout} title="System Maintenance" subtitle="Schedule downtime for system updates. Every user is told in advance." menuItems={adminMenuItems} headerActions={headerPill}>
      <div className="sm-wrap">
        {flash && <div className="sm-flash ok" role="status"><CheckCircle2 size={16} aria-hidden="true" /> {flash}</div>}
        {error && <div className="sm-flash bad" role="alert"><AlertTriangle size={16} aria-hidden="true" /> {error}</div>}
        {loading && <p className="sm-muted">Loading…</p>}

        {!loading && (phase === 'none' || editing) && (
          <form className="sm-grid" onSubmit={submit} noValidate>
            <div className="sm-col">
              <section className="sm-card">
                <h3><span className="sm-num">1</span> What is happening</h3>
                <label className="sm-label" htmlFor="sm-title">TITLE</label>
                <input id="sm-title" className={`sm-input${fieldErrors.title ? ' err' : ''}`} value={form.title} maxLength={80} onChange={(e) => set({ title: e.target.value })} />
                {fieldErrors.title && <p className="sm-err">{fieldErrors.title}</p>}
                <label className="sm-label" htmlFor="sm-msg">MESSAGE TO USERS</label>
                <textarea id="sm-msg" className={`sm-input${fieldErrors.message ? ' err' : ''}`} rows={3} value={form.message} maxLength={400} onChange={(e) => set({ message: e.target.value })} />
                {fieldErrors.message ? <p className="sm-err">{fieldErrors.message}</p> : <p className="sm-hint">Shown in the banner, the notice pop-up and the maintenance screen.</p>}
                <label className="sm-label" htmlFor="sm-notes">WHAT IS NEW (SHOWN WHEN WE ARE BACK, OPTIONAL)</label>
                <textarea id="sm-notes" className={`sm-input${fieldErrors.releaseNotes ? ' err' : ''}`} rows={3} value={form.notes} placeholder="One item per line (up to 6)" onChange={(e) => set({ notes: e.target.value })} />
                {fieldErrors.releaseNotes && <p className="sm-err">{fieldErrors.releaseNotes}</p>}
              </section>

              <section className="sm-card">
                <h3><span className="sm-num">2</span> When</h3>
                <div className="sm-two">
                  <div><label className="sm-label" htmlFor="sm-sd">START DATE</label><input id="sm-sd" type="date" className={`sm-input${fieldErrors.startAt ? ' err' : ''}`} value={form.startDate} onChange={(e) => setStart({ startDate: e.target.value })} /></div>
                  <div><label className="sm-label" htmlFor="sm-st">START TIME</label><input id="sm-st" type="time" className={`sm-input${fieldErrors.startAt ? ' err' : ''}`} value={form.startTime} onChange={(e) => setStart({ startTime: e.target.value })} /></div>
                  <div><label className="sm-label" htmlFor="sm-ed">END DATE</label><input id="sm-ed" type="date" className={`sm-input${fieldErrors.endAt ? ' err' : ''}`} value={form.endDate} onChange={(e) => set({ endDate: e.target.value })} /></div>
                  <div><label className="sm-label" htmlFor="sm-et">END TIME (ESTIMATED)</label><input id="sm-et" type="time" className={`sm-input${fieldErrors.endAt ? ' err' : ''}`} value={form.endTime} onChange={(e) => set({ endTime: e.target.value })} /></div>
                </div>
                {fieldErrors.startAt && <p className="sm-err">{fieldErrors.startAt}</p>}
                {fieldErrors.endAt && <p className="sm-err">{fieldErrors.endAt}</p>}
                <div className="sm-chips" role="group" aria-label="Quick duration">
                  <span className="sm-label inline">QUICK DURATION</span>
                  {CHIPS.map((c) => <button type="button" key={c.label} className={`sm-chip${durMs === c.ms ? ' on' : ''}`} onClick={() => chip(c.ms)}>{c.label}</button>)}
                </div>
                <p className="sm-hint"><Clock size={13} aria-hidden="true" /> {durMs > 0 ? `Duration: ${durationText(durMs)}. ` : ''}Philippine Time (UTC+8)</p>
              </section>

              <section className="sm-card">
                <h3><span className="sm-num">3</span> Who is notified</h3>
                <div className="sm-aud">
                  {[['owners', 'Owners', `${accounts.owners ?? 0} accounts`], ['therapists', 'Therapists', `${accounts.therapists ?? 0} accounts`], ['patients', 'Patients', `${accounts.patients ?? 0} accounts incl. guardians`]].map(([k, label, sub]) => (
                    <label key={k} className={`sm-aud-card${form.audience[k] ? ' on' : ''}`}>
                      <input type="checkbox" checked={form.audience[k]} onChange={(e) => set({ audience: { ...form.audience, [k]: e.target.checked } })} />
                      <span className="sm-box" aria-hidden="true">{form.audience[k] && <Check size={13} strokeWidth={3} />}</span>
                      <b>{label}</b><small>{sub}</small>
                    </label>
                  ))}
                </div>
                {fieldErrors.audience && <p className="sm-err">{fieldErrors.audience}</p>}
                <Check2 checked disabled locked sub="Always on, so you can finish the update and bring the system back.">Super Admins can still sign in during downtime</Check2>
              </section>

              <section className="sm-card">
                <h3><span className="sm-num">4</span> Reminders</h3>
                <div className="sm-rem">
                  <Check2 checked={form.reminders.bannerNow} onChange={(v) => set({ reminders: { ...form.reminders, bannerNow: v } })} sub="Appears on every page as soon as you schedule.">Show banner right away</Check2>
                  <Check2 checked={form.reminders.week} onChange={(v) => set({ reminders: { ...form.reminders, week: v } })} sub="Pop-up notice, when scheduled a week or more ahead.">1 week before</Check2>
                  <Check2 checked={form.reminders.h24} onChange={(v) => set({ reminders: { ...form.reminders, h24: v } })} sub="Pop-up notice on next login or page load.">24 hours before</Check2>
                  <Check2 checked={form.reminders.h1} onChange={(v) => set({ reminders: { ...form.reminders, h1: v } })} sub="Pop-up notice.">1 hour before</Check2>
                  <Check2 checked={form.reminders.m15} onChange={(v) => set({ reminders: { ...form.reminders, m15: v } })} sub="Pop-up notice.">15 minutes before</Check2>
                  <Check2 checked disabled locked sub="Save-your-work warning, then sign-out.">5-minute countdown</Check2>
                </div>
              </section>

              {validStart && (
                <section className="sm-card" aria-labelledby="sm-plan-h">
                  <h3 id="sm-plan-h"><Info size={16} aria-hidden="true" /> Automatic notification plan</h3>
                  <ol className="sm-plan">
                    {plan.map((p) => (
                      <li key={p.key} className={p.status === 'skipped' ? 'skip' : p.status === 'sent' ? 'done' : ''}>
                        <span className="dot" aria-hidden="true">{p.status === 'sent' && <Check size={11} strokeWidth={3} />}</span>
                        <div><b>{PLAN_LABELS[p.key]}</b><small>{p.key === 'now' && p.status !== 'sent' ? 'When you press Schedule' : `${fmtDate(p.sendAt)}, ${fmtTime(p.sendAt)}`}{p.status === 'skipped' ? ` · Skipped: ${p.skipReason}` : ''}</small></div>
                      </li>
                    ))}
                  </ol>
                  <div className="sm-how">
                    <b>How TherapyPro decides</b>
                    <p>{describeLead(startAt, new Date(now))}</p>
                    <ul>
                      <li>Example: scheduled Nov 24 for Dec 1 sends the week, 24-hour, 1-hour, 15-minute and 5-minute notices.</li>
                      <li>Example: scheduled Nov 24 for Nov 25 skips the week notice and starts at 24 hours.</li>
                      <li>A reminder whose time has already passed is skipped. It is never sent late.</li>
                    </ul>
                  </div>
                </section>
              )}

              <div className="sm-footer">
                <p className="sm-hint"><Info size={13} aria-hidden="true" /> Users are signed out automatically at the start time.</p>
                <div>
                  <button type="button" className="sm-btn" onClick={() => { if (editing) setEditing(false); else { setForm(defaultForm()); setFieldErrors({}); setError('') } }}>Cancel</button>
                  <button type="submit" className="sm-btn primary" disabled={busy}><CalendarDays size={16} aria-hidden="true" /> {editing ? 'Save changes' : 'Schedule downtime'}</button>
                </div>
              </div>
            </div>

            <aside className="sm-col side">
              <section className="sm-card">
                <small className="sm-eyebrow">PREVIEW</small>
                <h3 className="sm-h-plain">What users will see</h3>
                <div className="sm-pv-banner"><Wrench size={14} aria-hidden="true" /><span>Scheduled update: {validStart ? `${fmtDate(startAt)}, ${fmtRange(startAt, Number.isNaN(endAt.getTime()) ? startAt : endAt)}` : 'pick a date'}</span><u>Details</u></div>
                <div className="sm-pv-notice">
                  <img src={PAO_WOW} alt="" width="90" height="110" />
                  <b>TherapyPro will be down for updates</b>
                  <small>{validStart ? `${fmtDate(startAt)} · ${fmtRange(startAt, Number.isNaN(endAt.getTime()) ? startAt : endAt)}` : ''}</small>
                  <p>{form.message}</p>
                  <div><span className="sm-pv-btn">Remind me</span><span className="sm-pv-btn dark">Got it</span></div>
                </div>
              </section>
              <section className="sm-card">
                <h3 className="sm-h-plain">Before you schedule</h3>
                <ul className="sm-tips">
                  <li><Clock size={16} aria-hidden="true" /> Schedule at least 24 hours ahead so everyone sees the notice.</li>
                  <li><ShieldCheck size={16} aria-hidden="true" /> Payments in progress are given up to 5 minutes to finish before sign-out.</li>
                  <li><Info size={16} aria-hidden="true" /> Uploads and sessions in progress get a save-your-work warning.</li>
                  <li><Users size={16} aria-hidden="true" /> Patients, therapists and owners all see the same message and time.</li>
                </ul>
              </section>
            </aside>
          </form>
        )}

        {!loading && phase === 'scheduled' && !editing && dt && (
          <>
            <section className="sm-hero amber">
              <span className="sm-hero-icon"><Wrench size={28} aria-hidden="true" /></span>
              <div className="sm-hero-body">
                <span className="sm-tag amber"><Clock size={12} aria-hidden="true" /> {dt.startedEarly ? 'STARTING NOW' : 'DOWNTIME SCHEDULED'}</span>
                <h2>{dt.title}</h2>
                <p><CalendarDays size={15} aria-hidden="true" /> {fmtDateLong(dt.startAt)} <Clock size={15} aria-hidden="true" /> {fmtRange(dt.startAt, dt.endAt)} ({durationText(endMs - startMs)})</p>
              </div>
              <div className="sm-tiles" aria-label="Time until the downtime starts">
                {(() => { const c = countdownParts(startMs - now); return [[c.days, 'DAYS'], [c.hours, 'HOURS'], [c.minutes, 'MINUTES']].map(([n, l]) => <div key={l}><b>{pad2(n)}</b><small>{l}</small></div>) })()}
              </div>
            </section>
            <div className="sm-actions">
              {dt.status === 'scheduled' && <button type="button" className="sm-btn" onClick={startEdit}><Pencil size={15} aria-hidden="true" /> Edit schedule</button>}
              {dt.status === 'scheduled' && <button type="button" className="sm-btn amber" onClick={() => { setAck(false); setDialog('start') }}><Play size={15} aria-hidden="true" /> Start now</button>}
              <button type="button" className="sm-btn danger" onClick={() => { setNotify(true); setDialog('cancel') }}><X size={15} aria-hidden="true" /> Cancel downtime</button>
            </div>
            <div className="sm-grid2">
              <section className="sm-card">
                <h3 className="sm-h-plain">Notification schedule</h3>
                <p className="sm-hint">Sent automatically to every selected group.</p>
                <ol className="sm-plan">
                  {dt.plan.map((p) => (
                    <li key={p.key} className={p.status === 'skipped' ? 'skip' : p.status === 'sent' ? 'done' : ''}>
                      <span className="dot" aria-hidden="true">{p.status === 'sent' && <Check size={11} strokeWidth={3} />}</span>
                      <div><b>{p.label}</b><small>{fmtDate(p.sendAt)}, {fmtTime(p.sendAt)}{p.status === 'skipped' ? ` · Skipped: ${p.skipReason}` : ''}</small></div>
                      {p.status === 'sent' && <em>SENT</em>}
                    </li>
                  ))}
                  <li className="end"><span className="dot ring" aria-hidden="true" /><div><b>Back online (estimated)</b><small>{fmtDate(dt.endAt)}, {fmtTime(dt.endAt)}</small></div></li>
                </ol>
              </section>
              <div className="sm-col">
                <WhoCards audience={dt.audience} accounts={accounts} />
                <HistoryCard rows={history} />
              </div>
            </div>
          </>
        )}

        {!loading && phase === 'active' && !editing && dt && (
          <>
            <ActiveHero dt={dt} now={now} startMs={startMs} endMs={endMs} />
            <div className="sm-actions">
              <button type="button" className="sm-btn primary" disabled={busy || !dt.checklist.deployed || !dt.checklist.adminChecked} title={!dt.checklist.deployed || !dt.checklist.adminChecked ? 'Tick the first two checks below first' : undefined} onClick={() => setDialog('end')}><Power size={15} aria-hidden="true" /> Bring system back online</button>
              <button type="button" className="sm-btn amber" disabled={busy} onClick={() => run(() => sys('extend', { method: 'POST', id: dt.id, body: { minutes: 30 } }), 'Extended by 30 minutes.')}><Clock size={15} aria-hidden="true" /> Extend by 30 min</button>
              <button type="button" className="sm-btn amber" disabled={busy} onClick={() => run(() => sys('extend', { method: 'POST', id: dt.id, body: { minutes: 60 } }), 'Extended by 1 hour.')}><Clock size={15} aria-hidden="true" /> Extend by 1 hour</button>
            </div>
            <div className="sm-grid2">
              <section className="sm-card">
                <h3 className="sm-h-plain">Before you bring it back online</h3>
                <p className="sm-hint">Tick each one so nothing opens early. Only you can see this list.</p>
                <div className="sm-checklist">
                  {CHECKS.map(([k, label]) => (
                    <Check2 key={k} checked={!!dt.checklist[k]} disabled={busy} onChange={(v) => run(() => sys('checklist', { method: 'PATCH', id: dt.id, body: { checklist: { [k]: v } } }))}>{label}</Check2>
                  ))}
                </div>
              </section>
              <div className="sm-col">
                <section className="sm-card">
                  <h3 className="sm-h-plain">Right now</h3>
                  <div className="sm-stats">
                    <div><ShieldCheck size={18} aria-hidden="true" /><b>{onlineNow.superAdmins ?? 1}</b><small>Super Admin signed in</small></div>
                    <div><Users size={18} aria-hidden="true" /><b>{dt.sessionsEnded}</b><small>sessions ended at {fmtTime(dt.startAt)}</small></div>
                    <div><Lock size={18} aria-hidden="true" /><b>0</b><small>user logins let through</small></div>
                  </div>
                </section>
                <section className="sm-card">
                  <h3 className="sm-h-plain">What users see</h3>
                  <div className="sm-see"><img src={PAO_SLEEPY} alt="" width="70" height="90" /><div><b>We are updating TherapyPro</b><small>Expected back {fmtDate(dt.endAt)}, {fmtTime(dt.endAt)}</small></div></div>
                </section>
              </div>
            </div>
          </>
        )}
      </div>

      {dialog === 'start' && (
        <Dialog icon={<Power size={26} />} title="Start downtime now?" onClose={() => setDialog(null)}>
          <p>The scheduled update will begin immediately instead of {fmtDate(dt.startAt)} at {fmtTime(dt.startAt)}. People who are signed in see a 5-minute countdown, then are signed out.</p>
          <small className="sm-eyebrow">SIGNED IN RIGHT NOW</small>
          <div className="sm-stats three"><div><b>{onlineNow.owners ?? 0}</b><small>Owners</small></div><div><b>{onlineNow.therapists ?? 0}</b><small>Therapists</small></div><div><b>{onlineNow.patients ?? 0}</b><small>Patients</small></div></div>
          <Check2 checked={ack} onChange={setAck}>I understand people will be signed out</Check2>
          <div className="sm-dlg-actions"><button type="button" className="sm-btn" onClick={() => setDialog(null)}>Keep schedule</button><button type="button" className="sm-btn red" disabled={!ack || busy} onClick={async () => { const r = await run(() => sys('start-now', { method: 'POST', id: dt.id }), 'Downtime is starting. Users see the 5-minute countdown.'); if (r) setDialog(null) }}><Power size={15} aria-hidden="true" /> Start downtime now</button></div>
        </Dialog>
      )}
      {dialog === 'cancel' && (
        <Dialog icon={<X size={26} />} tone="red" title="Cancel this downtime?" onClose={() => setDialog(null)}>
          <p>The update on {fmtDate(dt.startAt)} at {fmtTime(dt.startAt)} will not happen. The banner is removed and no more reminders are sent. Reminders that were already sent cannot be unsent.</p>
          <Check2 checked={notify} onChange={setNotify} sub="They see a short notice the next time they open TherapyPro.">Tell users it was cancelled</Check2>
          <div className="sm-dlg-actions"><button type="button" className="sm-btn" onClick={() => setDialog(null)}>Keep downtime</button><button type="button" className="sm-btn red" disabled={busy} onClick={async () => { const r = await run(() => sys('cancel', { method: 'POST', id: dt.id, body: { notifyUsers: notify } }), 'Downtime cancelled.'); if (r) setDialog(null) }}><X size={15} aria-hidden="true" /> Cancel downtime</button></div>
        </Dialog>
      )}
      {dialog === 'end' && (
        <Dialog icon={<Power size={26} />} tone="green" title="Bring TherapyPro back online?" onClose={() => setDialog(null)}>
          <p>Owners, therapists and patients will be able to sign in again, and they will see the back-online screen with the release notes once.</p>
          <div className="sm-dlg-actions"><button type="button" className="sm-btn" onClick={() => setDialog(null)}>Not yet</button><button type="button" className="sm-btn primary" disabled={busy} onClick={async () => { const r = await run(() => sys('end', { method: 'POST', id: dt.id, body: { checklist: dt.checklist } }), 'TherapyPro is back online.'); if (r) setDialog(null) }}><Power size={15} aria-hidden="true" /> Bring system back online</button></div>
        </Dialog>
      )}
    </AdminPageShell>
  )
}

function ActiveHero({ dt, now, startMs, endMs }) {
  const elapsed = Math.max(0, now - startMs), planned = endMs - startMs, left = endMs - now
  const over = left < 0
  const pct = Math.min(100, Math.max(2, (elapsed / planned) * 100))
  return (
    <section className="sm-hero red">
      <span className="sm-hero-icon red"><Power size={28} aria-hidden="true" /></span>
      <div className="sm-hero-body">
        <span className="sm-tag red"><Wrench size={12} aria-hidden="true" /> DOWNTIME IN PROGRESS</span>
        <h2>{dt.title}</h2>
        <p>Owners, therapists and patients are signed out and see the maintenance screen.</p>
      </div>
      <div className="sm-tiles">
        <div><b>{durationText(elapsed)}</b><small>ELAPSED</small></div>
        <div><b>{durationText(planned)}</b><small>PLANNED</small></div>
        <div className={over ? 'over' : ''}><b>{over ? `${durationText(-left)} over` : durationText(left)}</b><small>{over ? 'PAST PLAN' : 'LEFT'}</small></div>
      </div>
      <div className="sm-progress"><div className="sm-track" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin="0" aria-valuemax="100"><i style={{ width: `${pct}%` }} /></div><span>Started {fmtTime(dt.startAt)}</span><span>Planned end {fmtTime(dt.endAt)}</span></div>
    </section>
  )
}

function WhoCards({ audience, accounts }) {
  const rows = [[audience.owners, Building2, accounts.owners, 'Owners'], [audience.therapists, UserRound, accounts.therapists, 'Therapists'], [audience.patients, Users, accounts.patients, 'Patients and guardians']].filter((r) => r[0])
  return (
    <section className="sm-card">
      <h3 className="sm-h-plain">Who will be notified</h3>
      <div className="sm-who">{rows.map(([, Icon, n, label]) => <div key={label}><Icon size={18} aria-hidden="true" /><b>{n ?? 0}</b><small>{label}</small></div>)}</div>
    </section>
  )
}

function HistoryCard({ rows }) {
  return (
    <section className="sm-card">
      <h3 className="sm-h-plain">Past downtime</h3>
      {rows.length === 0 ? <p className="sm-hint">Nothing yet. Finished downtimes show up here.</p> : (
        <div className="sm-table-wrap">
          <table className="sm-table">
            <thead><tr><th>TITLE</th><th>DATE</th><th>LENGTH</th><th>RESULT</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><b>{r.title}</b></td><td>{fmtDate(r.startAt, { year: 'numeric' })}</td>
                  <td>{r.actualMs != null ? durationText(r.actualMs) : durationText(r.plannedMs)}</td>
                  <td>{r.result === 'on_time' ? <span className="sm-res ok">Completed on time</span> : r.result === 'ran_over' ? <span className="sm-res warn">Ran {durationText(r.overMs)} over</span> : <span className="sm-res">Cancelled</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
