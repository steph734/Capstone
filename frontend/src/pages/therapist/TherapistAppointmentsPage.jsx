import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { CircleCheck, Ban } from 'lucide-react'
import TherapistPageShell from './TherapistPageShell'
import { getTherapistMenuItems } from './therapistSidebarConfig'
import { logActivity } from '../../utils/auditLog'
import { apiGet, apiPatch } from '../../utils/api'
import RecommendSessionModal from '../../components/RecommendSessionModal'
import './TherapistAppointmentsPage.css'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

/* ── Helpers ──────────────────────────────────────────────── */
function fmt12(t) {
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`
}
function fmtDate(iso) {
  return new Date(iso + 'T00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}
function fmtDateLong(iso) {
  return new Date(iso + 'T00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}
function fmtDateShort(iso) {
  return new Date(iso + 'T00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}
function fmtShort(iso) {
  return new Date(iso + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
function groupLabel(iso) {
  const today    = new Date().toISOString().slice(0,10)
  const tomorrow = new Date(Date.now()+86400000).toISOString().slice(0,10)
  if (iso === today)    return 'Today'
  if (iso === tomorrow) return 'Tomorrow'
  return new Date(iso+'T00:00').toLocaleDateString('en-US',{weekday:'long'})
}
// "TODAY" for today, "TOMORROW · SEP 26" / "THURSDAY · OCT 1" otherwise.
function groupHeader(iso) {
  const label = groupLabel(iso)
  return label === 'Today' ? 'TODAY' : `${label.toUpperCase()} · ${fmtShort(iso).toUpperCase()}`
}
function typeClass(t) {
  return ({Initial:'tapp-type-initial','Follow-up':'tapp-type-followup',Assessment:'tapp-type-assessment',Group:'tapp-type-group'})[t]||'tapp-type-followup'
}
function statusClass(s) {
  return ({Confirmed:'tapp-status-confirmed',Pending:'tapp-status-pending',Cancelled:'tapp-status-cancelled',Completed:'tapp-status-completed',Archived:'tapp-status-archived'})[s]||''
}
/* Matches the patient calendar's meaning: green = nothing booked yet,
   yellow = the day already has sessions on it. "Closed" stays defined in
   the legend/CSS for clinic-closed dates, same as the patient calendar. */
function dotClass(n) {
  return n > 0 ? 'tapp-dot-mid' : 'tapp-dot-few'
}
// Initials for the avatar circle, e.g. "Alvrine Santiago" -> "AS".
function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
}
// A stable avatar color for a given id — appointment ids are Mongo ObjectId
// strings, so this hashes the string down to a palette index.
const AVATAR_PALETTE = [
  { bg: '#e8f5f0', fg: '#2c4a3e' },
  { bg: '#e0f0ff', fg: '#1565c0' },
  { bg: '#fde8f3', fg: '#a3175c' },
  { bg: '#fef3c7', fg: '#92400e' },
  { bg: '#f3e8ff', fg: '#7b1fa2' },
  { bg: '#e0fbf5', fg: '#0f766e' },
]
function avatarColorFor(id) {
  const s = String(id)
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length]
}

/* ── Icons ────────────────────────────────────────────────── */
const PlusIcon    = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
const SearchIcon  = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
const CalIcon     = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="tapp-card-meta-icon"><path d="M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm2-7h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"/></svg>
const ClockIcon   = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="tapp-card-meta-icon"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/></svg>
const EyeIcon       = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
const PencilIcon    = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
const ArchiveIcon   = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM12 17.5L6.5 12H10v-2h4v2h3.5L12 17.5zM5.12 5l.81-1h12l.94 1H5.12z"/></svg>
const UnarchiveIcon = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM12 6.5l5.5 5.5H14v2h-4v-2H6.5L12 6.5zM5.12 5l.81-1h12l.94 1H5.12z"/></svg>
const ClinicIcon  = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="tapp-card-meta-icon"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-6 14h-2v-3H8v-2h3V9h2v3h3v2h-3v3z"/></svg>
const CheckIcon   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
const XIcon       = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
const DotsIcon    = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
const RefreshIcon = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08a5.99 5.99 0 0 1-5.65 4c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L14 11h7V4l-3.35 2.35z"/></svg>
const CheckCircleIcon = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
const strokeIcon = (children, size = 18) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
)
const BadgeCheckIcon  = ({ size = 26 }) => strokeIcon(<><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>, size)
const UserLineIcon    = () => strokeIcon(<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>, 16)
const CalLineIcon     = () => strokeIcon(<><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>, 16)
const ClipboardIcon   = () => strokeIcon(<><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" /></>, 16)
const RepeatIcon      = ({ size = 26 }) => strokeIcon(<><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></>, size)
const NotesIcon = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>

/* Has the session's start time (Asia/Manila, computed server-side) passed? */
function hasStarted(appt) {
  return !!appt.startedAt && new Date(appt.startedAt).getTime() <= Date.now()
}

/* ── Full Calendar ────────────────────────────────────────── */
function FullCalendar({ appointments, selectedDate, onSelectDate }) {
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth()) })

  const year  = calMonth.getFullYear()
  const month = calMonth.getMonth()
  const today = new Date().toISOString().slice(0,10)

  const firstDay    = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month+1, 0).getDate()

  const cells = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i+1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const iso = (d) => d ? `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}` : null

  const countForDay = (d) => {
    const s = iso(d)
    return s ? appointments.filter(a => a.date === s && a.status !== 'Archived').length : 0
  }

  const monthTotal = appointments.filter(a => {
    return a.date.startsWith(`${year}-${String(month+1).padStart(2,'0')}`) && a.status !== 'Archived'
  }).length

  return (
    <div className="tapp-cal-card">
      {/* Header */}
      <div className="tapp-cal-header">
        <div className="tapp-cal-heading">
          <h3 className="tapp-cal-title">Session Calendar</h3>
          <p className="tapp-cal-sub">Tap a day to view appointments</p>
        </div>
      </div>

      {/* Centered month navigation */}
      <div className="tapp-cal-nav-center">
        <button className="tapp-cal-nav" onClick={() => setCalMonth(new Date(year, month-1))}>‹</button>
        <span className="tapp-cal-month">{MONTHS[month]} {year}</span>
        <button className="tapp-cal-nav" onClick={() => setCalMonth(new Date(year, month+1))}>›</button>
      </div>

      {/* Day-of-week header */}
      <div className="tapp-cal-dow">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <span key={d}>{d}</span>)}
      </div>

      {/* Grid */}
      <div className="tapp-cal-grid">
        {cells.map((d, i) => {
          const s      = iso(d)
          const count  = countForDay(d)
          const isToday= s === today
          const isSel  = s === selectedDate
          return (
            <button
              key={i}
              disabled={!d}
              className={`tapp-cal-cell${isToday ? ' tapp-cal-today' : ''}${isSel ? ' tapp-cal-selected' : ''}`}
              onClick={() => d && onSelectDate(isSel ? null : s)}
            >
              {d && (
                <>
                  <span className="tapp-cal-day-num">{d}</span>
                  <div className="tapp-cal-dots">
                    <span className={`tapp-cal-dot ${dotClass(count)}`} />
                  </div>
                </>
              )}
            </button>
          )
        })}
      </div>

      {/* Footer */}
      <div className="tapp-cal-footer">
        <div className="tapp-cal-legend">
          <div className="tapp-legend-item">
            <span className="tapp-legend-dot tapp-dot-few" /> Available
          </div>
          <div className="tapp-legend-item">
            <span className="tapp-legend-dot tapp-dot-mid" /> Booked
          </div>
          <div className="tapp-legend-item">
            <span className="tapp-legend-dot tapp-dot-many" /> Closed
          </div>
        </div>
        <span className="tapp-cal-total">
          {MONTHS[month]} total: {monthTotal} session{monthTotal !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  )
}

/* ── Avatar ───────────────────────────────────────────────── */
function Avatar({ name, id, className = '' }) {
  const c = avatarColorFor(id)
  return (
    <div className={`tapp2-avatar ${className}`} style={{ background: c.bg, color: c.fg }}>
      {initials(name)}
    </div>
  )
}

/* ── View Modal ───────────────────────────────────────────── */
function ViewModal({ appt, patient, onClose, onEdit, onRestoreClick, onComplete, onRecommend, canRecommend }) {
  const canComplete = appt.status === 'Confirmed' && hasStarted(appt)
  return (
    <div className="tapp-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="tapp-modal">
        <div className="tapp-modal-header">
          <h2 className="tapp-modal-title">Appointment Details</h2>
          <button className="tapp-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="tapp-modal-body">
          <div className="tapp-view-hero">
            <Avatar name={patient.name} id={appt.id} className="tapp-view-avatar" />
            <div>
              <p className="tapp-view-patient-name">{patient.name}</p>
              <p className="tapp-view-patient-cond">{patient.condition}</p>
              <div style={{ marginTop: 8 }}>
                <span className={`tapp-status-badge ${statusClass(appt.status)}`}>{appt.status}</span>
              </div>
            </div>
          </div>
          <div className="tapp-view-details">
            <div className="tapp-view-field">
              <span className="tapp-view-field-lbl">Date</span>
              <span className="tapp-view-field-val">{fmtDate(appt.date)}</span>
            </div>
            <div className="tapp-view-field">
              <span className="tapp-view-field-lbl">Day</span>
              <span className="tapp-view-field-val">{new Date(appt.date+'T00:00').toLocaleDateString('en-US',{weekday:'long'})}</span>
            </div>
            <div className="tapp-view-field">
              <span className="tapp-view-field-lbl">Time</span>
              <span className="tapp-view-field-val">{fmt12(appt.time)}</span>
            </div>
            <div className="tapp-view-field">
              <span className="tapp-view-field-lbl">Duration</span>
              <span className="tapp-view-field-val">{appt.duration}</span>
            </div>
            <div className="tapp-view-field">
              <span className="tapp-view-field-lbl">Session Type</span>
              <span className="tapp-view-field-val">{appt.type}</span>
            </div>
            <div className="tapp-view-field">
              <span className="tapp-view-field-lbl">Status</span>
              <span className="tapp-view-field-val">{appt.status}</span>
            </div>
          </div>
          {appt.archivedAt && (
            <div className="tapp-view-archived-row">
              <span className="tapp-view-archived-icon">📦</span>
              <div>
                <span className="tapp-view-archived-lbl">Archived on</span>
                <span className="tapp-view-archived-val">
                  {new Date(appt.archivedAt).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}
                  {' · '}
                  {new Date(appt.archivedAt).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true})}
                </span>
              </div>
            </div>
          )}
          {appt.status === 'Completed' && appt.completedAt && (
            <div className="tapp-view-archived-row">
              <span className="tapp-view-archived-icon tapp-view-done-icon"><BadgeCheckIcon size={20} /></span>
              <div>
                <span className="tapp-view-archived-lbl">Completed on</span>
                <span className="tapp-view-archived-val">
                  {new Date(appt.completedAt).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}
                  {' · '}
                  {new Date(appt.completedAt).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true})}
                </span>
              </div>
            </div>
          )}
          <div className="tapp-view-notes">
            <span className="tapp-view-notes-lbl">{appt.completionRemarks ? 'Completion remarks' : 'Notes'}</span>
            <p className="tapp-view-notes-text">{appt.completionRemarks || appt.notes || 'No notes for this session.'}</p>
          </div>
        </div>
        <div className="tapp-modal-footer">
          {appt.status === 'Archived' ? (
            <>
              <button className="tapp-modal-cancel" onClick={() => { onRestoreClick(appt); onClose() }}>Restore</button>
              <button className="tapp-modal-submit" onClick={() => { onClose(); onEdit(appt) }}>Rebook Appointment</button>
            </>
          ) : (
            <>
              <button className="tapp-modal-cancel" onClick={onClose}>Close</button>
              {canComplete && (
                <button className="tapp-modal-submit" onClick={() => { onClose(); onComplete(appt) }}>
                  <CheckCircleIcon /> Mark as completed
                </button>
              )}
              {appt.status === 'Completed' ? (
                canRecommend && (
                  <button className="tapp-modal-submit" onClick={() => { onClose(); onRecommend(appt) }}>Recommend next session</button>
                )
              ) : (
                <button className={canComplete ? 'tapp-modal-cancel' : 'tapp-modal-submit'} onClick={() => { onClose(); onEdit(appt) }}>Edit Appointment</button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Restore Confirm Modal ────────────────────────────────── */
function RestoreConfirmModal({ appt, patient, appointments, onConfirm, onRebook, onClose }) {
  const conflict = appointments.find(a =>
    a.id !== appt.id &&
    a.date === appt.date &&
    a.time === appt.time &&
    a.status !== 'Archived' &&
    a.status !== 'Cancelled'
  )
  const conflictPatientName = conflict?.patientName || 'Another patient'

  return (
    <div className="tapp-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="tapp-confirm-modal">
        {conflict ? (
          <>
            <div className="tapp-confirm-icon">⚠️</div>
            <h3 className="tapp-confirm-title">Schedule Conflict</h3>
            <p className="tapp-confirm-msg">
              <strong>{conflictPatientName}</strong> already has an appointment
              on <strong>{fmtDate(appt.date)}</strong> at <strong>{fmt12(appt.time)}</strong>.
              <br /><br />
              You cannot restore to this slot. Please rebook to a different schedule.
            </p>
            <div className="tapp-confirm-actions">
              <button className="tapp-confirm-cancel" onClick={onClose}>Cancel</button>
              <button className="tapp-confirm-ok tapp-confirm-rebook" onClick={() => { onRebook(appt); onClose() }}>
                Rebook to New Schedule
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="tapp-confirm-icon">🔄</div>
            <h3 className="tapp-confirm-title">Restore Appointment?</h3>
            <p className="tapp-confirm-msg">
              This will restore <strong>{patient.name}</strong>'s appointment on{' '}
              <strong>{fmtDate(appt.date)}</strong> at <strong>{fmt12(appt.time)}</strong> back to Confirmed.
            </p>
            <div className="tapp-confirm-actions">
              <button className="tapp-confirm-cancel" onClick={onClose}>Cancel</button>
              <button className="tapp-confirm-ok" onClick={() => { onConfirm(appt.id); onClose() }}>
                Yes, Restore
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ── Accept/Decline Confirm Modal ──────────────────────────── */
function RespondConfirmModal({ req, action, busy, onConfirm, onClose }) {
  const accept = action === 'accept'
  return (
    <div className="tapp-overlay" onClick={e => e.target === e.currentTarget && !busy && onClose()}>
      <div className="tapp-confirm-modal">
        <div className={`tapp-confirm-icon ${accept ? 'is-accept' : 'is-decline'}`}>{accept ? <CircleCheck size={30} aria-hidden="true" /> : <Ban size={30} aria-hidden="true" />}</div>
        <h3 className="tapp-confirm-title">{accept ? 'Accept this request?' : 'Decline this request?'}</h3>
        <p className="tapp-confirm-msg">
          {accept ? (
            <>This will confirm <strong>{req.name}</strong>'s appointment on{' '}
              <strong>{fmtDate(req.date)}</strong> at <strong>{fmt12(req.start)}</strong>, and
              email the guardian that it was accepted.</>
          ) : (
            <>This will decline <strong>{req.name}</strong>'s appointment on{' '}
              <strong>{fmtDate(req.date)}</strong> at <strong>{fmt12(req.start)}</strong>, free the
              time slot, and email the guardian that it was declined.</>
          )}
        </p>
        <div className="tapp-confirm-actions">
          <button className="tapp-confirm-cancel" onClick={onClose} disabled={busy}>Cancel</button>
          <button className={`tapp-confirm-ok ${accept ? 'is-accept' : 'is-decline'}`} onClick={onConfirm} disabled={busy}>
            {busy ? 'Please wait…' : accept ? 'Accept' : 'Decline'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Mark-as-completed confirm modal ───────────────────────── */
function CompleteConfirmModal({ appt, patient, busy, error, onConfirm, onClose }) {
  const [remarks, setRemarks] = useState('')
  return (
    <div className="tapp-overlay" onClick={e => e.target === e.currentTarget && !busy && onClose()}>
      <div className="tapp-cm" role="dialog" aria-modal="true" aria-labelledby="tapp-complete-title">
        <div className="tapp-cm-head">
          <span className="tapp-cm-badge"><BadgeCheckIcon /></span>
          <div>
            <h3 id="tapp-complete-title">Mark session as completed</h3>
            <p>This will notify the parent and can't be undone.</p>
          </div>
        </div>

        <dl className="tapp-cm-rows">
          <div><dt><UserLineIcon /> Patient</dt><dd>{patient.name}</dd></div>
          <div><dt><CalLineIcon /> Date &amp; time</dt><dd>{fmtDateShort(appt.date)} · {fmt12(appt.time)}</dd></div>
          <div><dt><ClipboardIcon /> Session type</dt><dd>{appt.type}</dd></div>
        </dl>

        <label className="tapp-cm-label" htmlFor="tapp-complete-remarks">Remarks <span>(optional)</span></label>
        <textarea
          id="tapp-complete-remarks" className="tapp-cm-text" rows={3} maxLength={500}
          placeholder="How did the session go?" value={remarks} onChange={e => setRemarks(e.target.value)} disabled={busy}
        />
        <div className="tapp-cm-count">{remarks.length}/500</div>
        {error && <p className="tapp-complete-error" role="alert">{error}</p>}

        <div className="tapp-cm-actions">
          <button className="tapp-cm-btn tapp-cm-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="tapp-cm-btn tapp-cm-primary" onClick={() => onConfirm(remarks.trim())} disabled={busy}>
            <CheckCircleIcon /> {busy ? 'Saving…' : 'Mark as completed'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── "Recommend another session?" follow-up prompt ─────────── */
function RecommendPromptModal({ patient, onRecommend, onClose }) {
  return (
    <div className="tapp-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="tapp-cm tapp-cm-narrow tapp-cm-blue" role="dialog" aria-modal="true">
        <div className="tapp-cm-head">
          <span className="tapp-cm-badge"><RepeatIcon /></span>
          <div>
            <h3>Session completed</h3>
            <p>Recommend another session for <strong>{patient.name}</strong>?</p>
          </div>
        </div>
        <div className="tapp-cm-actions">
          <button className="tapp-cm-btn tapp-cm-ghost" onClick={onClose}>Not now</button>
          <button className="tapp-cm-btn tapp-cm-primary" onClick={onRecommend}>Recommend</button>
        </div>
      </div>
    </div>
  )
}

/* ── Time slot options (8 AM – 5 PM, every 1h 30min) ──────── */
const TIME_SLOTS = (() => {
  const slots = []
  for (let total = 8 * 60; total <= 17 * 60; total += 90) {
    const h     = Math.floor(total / 60)
    const m     = total % 60
    const val   = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
    const ampm  = h >= 12 ? 'PM' : 'AM'
    const h12   = h % 12 || 12
    const label = `${h12}:${String(m).padStart(2,'0')} ${ampm}`
    slots.push({ val, label })
  }
  return slots
})()

/* ── Add / Edit Modal ─────────────────────────────────────── */
function FormModal({ initial, onClose, onSave, appointments = [] }) {
  const isEdit = !!initial?.id

  const [form, setForm] = useState(initial || {
    patientName: '', date: new Date().toISOString().slice(0,10),
    time: '08:00', type: 'Follow-up', duration: '60 min', status: 'Pending', notes: '',
  })

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const bookedTimes = appointments
    .filter(a => a.date === form.date && a.id !== form.id && a.status !== 'Archived' && a.status !== 'Cancelled')
    .map(a => a.time)

  const handleSave = () => {
    if (!isEdit && !form.patientName?.trim()) return
    onSave({ ...form, id: form.id || Date.now() })
  }

  return (
    <div className="tapp-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="tapp-modal">
        <div className="tapp-modal-header">
          <h2 className="tapp-modal-title">{isEdit ? 'Edit Appointment' : 'New Appointment'}</h2>
          <button className="tapp-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="tapp-modal-body">

          {/* Patient name input */}
          {!isEdit && (
            <div className="tapp-field">
              <label>Patient Name</label>
              <input
                type="text"
                placeholder="Enter patient name…"
                value={form.patientName}
                onChange={e => set('patientName', e.target.value)}
              />
            </div>
          )}

          <div className="tapp-form-row">
            {/* Date — native calendar picker */}
            <div className="tapp-field">
              <label>Date</label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
            </div>

            {/* Time — single dropdown */}
            <div className="tapp-field">
              <label>Time</label>
              <select value={form.time} onChange={e => set('time', e.target.value)}>
                {TIME_SLOTS.map(s => {
                  const booked = bookedTimes.includes(s.val)
                  return (
                    <option key={s.val} value={s.val} disabled={booked}>
                      {s.label}{booked ? '  ·  Booked' : '  ·  Available'}
                    </option>
                  )
                })}
              </select>
            </div>
          </div>

          <div className="tapp-form-row">
            <div className="tapp-field">
              <label>Session Type</label>
              <select value={form.type} onChange={e => set('type', e.target.value)}>
                <option>Initial</option><option>Follow-up</option>
                <option>Assessment</option><option>Group</option>
              </select>
            </div>
            <div className="tapp-field">
              <label>Duration</label>
              <select value={form.duration} onChange={e => set('duration', e.target.value)}>
                <option>30 min</option><option>60 min</option>
                <option>90 min</option><option>120 min</option>
              </select>
            </div>
          </div>

          {isEdit && (
            <div className="tapp-field">
              <label>Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)}>
                <option>Pending</option><option>Confirmed</option>
                <option>Completed</option><option>Cancelled</option>
              </select>
            </div>
          )}
          <div className="tapp-field">
            <label>Notes (optional)</label>
            <textarea placeholder="Add session notes…" value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>
        <div className="tapp-modal-footer">
          <button className="tapp-modal-cancel" onClick={onClose}>Cancel</button>
          <button className="tapp-modal-submit" onClick={handleSave} disabled={!isEdit && !form.patientName?.trim()}>
            {isEdit ? 'Save Changes' : 'Add Appointment'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Pending request card ──────────────────────────────────── */
function RequestCard({ req, onAccept, onDecline }) {
  return (
    <div className="tapp2-req-card">
      <div className="tapp2-req-top">
        <Avatar name={req.name} id={req.id} />
        <div className="tapp2-req-info">
          <span className="tapp2-req-name">{req.name}</span>
          <span className="tapp2-req-sub">{req.age} · {req.condition}</span>
        </div>
        <div className="tapp2-req-actions">
          <span className="tapp2-req-requested">Requested {req.requestedAt}</span>
          <div className="tapp2-req-btns">
            <button className="tapp2-btn-accept" onClick={() => onAccept(req)}><CheckIcon /> Accept</button>
            <button className="tapp2-btn-decline" onClick={() => onDecline(req)}><XIcon /> Decline</button>
          </div>
        </div>
      </div>
      <div className="tapp2-req-meta">
        <span><CalIcon /> {fmtDateShort(req.date)}</span>
        <span><ClockIcon /> {fmt12(req.start)} – {fmt12(req.end)}</span>
        <span><ClinicIcon /> {req.location}</span>
      </div>
      <span className={`tapp-type-badge ${typeClass(req.evalType)}`}>{req.evalType}</span>
      <p className="tapp2-req-note">{req.note}</p>
    </div>
  )
}

/* ── Appointment row (with kebab menu) ────────────────────── */
function AppointmentRow({ appt, name, isToday, viewMode, canRecommend, onView, onEdit, onArchive, onRestoreClick, onStart, onComplete, onRecommend, onViewNotes }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return
    const close = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setMenuOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menuOpen])

  const started = hasStarted(appt)
  const showStart = isToday && appt.status === 'Confirmed'
  const canComplete = appt.status === 'Confirmed' && started
  const completed = appt.status === 'Completed'

  const kebab = (
    <div className="tapp2-kebab-wrap" ref={wrapRef}>
      <button className="tapp2-kebab" onClick={() => setMenuOpen(o => !o)} aria-label="More options" aria-expanded={menuOpen}>
        <DotsIcon />
      </button>
      {menuOpen && (
        <div className="tapp2-menu">
          {viewMode === 'archived' ? (
            <button className="tapp2-menu-item" onClick={() => { setMenuOpen(false); onRestoreClick() }}>
              <UnarchiveIcon /> Restore
            </button>
          ) : (
            <>
              {canComplete && (
                <button className="tapp2-menu-item tapp2-menu-success" onClick={() => { setMenuOpen(false); onComplete() }}>
                  <CheckCircleIcon /> Mark as completed
                </button>
              )}
              {completed && canRecommend && (
                <button className="tapp2-menu-item" onClick={() => { setMenuOpen(false); onRecommend() }}>
                  <RefreshIcon /> Recommend next session
                </button>
              )}
              {completed && (
                <button className="tapp2-menu-item" onClick={() => { setMenuOpen(false); onViewNotes() }}>
                  <NotesIcon /> View notes
                </button>
              )}
              {!completed && (
                <>
                  <button className="tapp2-menu-item" onClick={() => { setMenuOpen(false); onEdit() }}>
                    <PencilIcon /> Edit
                  </button>
                  <button className="tapp2-menu-item" onClick={() => { setMenuOpen(false); onEdit() }}>
                    <RefreshIcon /> Reschedule
                  </button>
                </>
              )}
              <button className="tapp2-menu-item tapp2-menu-danger" onClick={() => { setMenuOpen(false); onArchive() }}>
                <ArchiveIcon /> Archive
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )

  return (
    <div className="tapp2-row">
      <span className="tapp2-row-time">{fmt12(appt.time)}</span>
      <Avatar name={name} id={appt.id} />
      <div className="tapp2-row-info">
        <span className="tapp2-row-name">{name}</span>
        <span className="tapp2-row-sub">{appt.type} session · {appt.duration}</span>
      </div>
      <span className={`tapp-status-badge ${statusClass(appt.status)}`}>{appt.status}</span>
      {showStart ? (
        <>
          <button className="tapp2-btn-start" onClick={onStart}>Start session</button>
          {kebab}
        </>
      ) : (
        <>
          <button className="tapp2-btn-view" onClick={onView}><EyeIcon /> View</button>
          {kebab}
        </>
      )}
    </div>
  )
}

/* ── Main Page ────────────────────────────────────────────── */
export default function TherapistAppointmentsPage({ user, onLogout, betaTier }) {
  const [appointments, setAppointments] = useState([])
  const [loading,       setLoading]     = useState(true)
  const [loadError,     setLoadError]   = useState('')
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [viewMode,     setViewMode]     = useState('active')
  const [showAdd,      setShowAdd]      = useState(false)
  const [viewAppt,     setViewAppt]     = useState(null)
  const [editAppt,     setEditAppt]     = useState(null)
  const [confirmArchId,    setConfirmArchId]    = useState(null)
  const [confirmRestoreAppt,setConfirmRestoreAppt]= useState(null)
  const [selectedDate, setSelectedDate] = useState(null)
  const [toast,        setToast]        = useState('')
  const [respondTarget, setRespondTarget] = useState(null) // { req, action: 'accept' | 'decline' }
  const [respondBusy,   setRespondBusy]   = useState(false)
  const navigate = useNavigate()
  // Mark as completed
  const [completeTarget, setCompleteTarget] = useState(null)
  const [completeBusy,   setCompleteBusy]   = useState(false)
  const [completeError,  setCompleteError]  = useState('')
  // Recommend another session
  const [promptRec,       setPromptRec]       = useState(null) // appointment, right after completing one
  const [recommendTarget, setRecommendTarget] = useState(null) // appointment the modal is open for
  // Patients with a recommendation still waiting on the parent.
  const [openRecPatients, setOpenRecPatients] = useState(() => new Set())

  // Every appointment patients have actually booked with this therapist,
  // straight from the `appointments` collection (see
  // api/_lib/routes/appointments-therapist-list.js) — Add/Edit/Archive/
  // Restore below still only mutate this in-memory list; they aren't wired
  // to the backend yet, so those particular changes won't survive a reload.
  useEffect(() => {
    let cancelled = false
    if (!user?.email) {
      setLoading(false)
      setLoadError('Your account isn’t linked to a staff record yet.')
      return
    }
    setLoading(true)
    fetch(`/api/appointments/therapist-list?email=${encodeURIComponent(user.email)}`)
      .then(async (r) => {
        const body = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`)
        if (!cancelled) setAppointments(body.appointments || [])
      })
      .catch((e) => { if (!cancelled) setLoadError(e.message || 'Could not load appointments.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [user?.email])

  useEffect(() => {
    let cancelled = false
    apiGet('/api/recommendations')
      .then((body) => {
        if (cancelled) return
        const open = (body.recommendations || []).filter(r => r.status === 'Sent' && new Date(r.expiresAt) > new Date())
        setOpenRecPatients(new Set(open.map(r => r.patientId)))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [user?.email])

  const today = new Date().toISOString().slice(0,10)
  const todayCount = appointments.filter(a => a.date === today && a.status !== 'Archived').length
  const schedCount = appointments.filter(a => a.status === 'Confirmed' || a.status === 'Pending').length
  const doneCount  = appointments.filter(a => a.status === 'Completed').length
  const pendCount  = appointments.filter(a => a.status === 'Pending').length
  const archCount  = appointments.filter(a => a.status === 'Archived').length

  const filtered = useMemo(() => {
    return appointments
      .filter(a => {
        if (viewMode === 'archived') return a.status === 'Archived'
        if (a.status === 'Archived') return false
        if (statusFilter !== 'All' && a.status !== statusFilter) return false
        if (selectedDate && a.date !== selectedDate) return false
        if (search && !(a.patientName || '').toLowerCase().includes(search.toLowerCase())) return false
        return true
      })
      .sort((a,b) => a.date !== b.date ? a.date.localeCompare(b.date) : a.time.localeCompare(b.time))
  }, [appointments, search, statusFilter, selectedDate, viewMode])

  const groups = useMemo(() => {
    const map = {}
    filtered.forEach(a => { if (!map[a.date]) map[a.date] = []; map[a.date].push(a) })
    return Object.entries(map).sort(([a],[b]) => a.localeCompare(b))
  }, [filtered])

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2800) }
  const patient   = (a)   => ({ name: a.patientName || 'Unknown', condition: a.condition || '' })

  // Real bookings arrive as status 'Pending' until someone acts on them —
  // this is what used to be a separate static demo list.
  const incomingRequests = useMemo(() => appointments
    .filter(a => a.status === 'Pending' && !a.isArchived)
    .map(a => ({
      id: a.id,
      name: a.patientName || 'Unknown',
      condition: a.condition || 'No condition on file',
      age: a.age != null ? `${a.age} years old` : '—',
      evalType: a.type,
      date: a.date,
      start: a.time,
      end: a.endTime,
      location: 'Main Clinic',
      requestedAt: a.createdAt
        ? new Date(a.createdAt).toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
        : '—',
      note: a.guardianName ? `Guardian note: ${a.guardianName}` : 'No additional notes provided.',
    })), [appointments])

  const logAppt = (actionIcon, description, appt, status = 'Success') => {
    logActivity({
      role: 'Therapist',
      user: user?.name || 'Therapist',
      email: user?.email || '—',
      actionIcon,
      action: 'Appointment',
      description,
      entity: `Appointment #${appt.id}`,
      status,
    })
  }

  // A completed session can be followed up with a recommendation when it is the
  // patient's latest completed one, they have nothing upcoming, and no
  // recommendation is already waiting on the parent (the server re-checks).
  const canRecommendAppt = (appt) => {
    if (!appt || appt.status !== 'Completed' || !appt.patientId) return false
    if (openRecPatients.has(appt.patientId)) return false
    const mine = appointments.filter(a => a.patientId === appt.patientId && !a.isArchived)
    if (mine.some(a => (a.status === 'Confirmed' || a.status === 'Pending') && a.date >= today)) return false
    const latest = mine.filter(a => a.status === 'Completed').sort((x, y) => (y.completedAt || y.date).localeCompare(x.completedAt || x.date))[0]
    return !latest || latest.id === appt.id
  }

  const openComplete = (appt) => { setCompleteError(''); setCompleteTarget(appt) }

  const confirmComplete = async (remarks) => {
    if (!completeTarget) return
    const appt = completeTarget
    setCompleteBusy(true)
    setCompleteError('')
    try {
      const body = await apiPatch(`/api/appointments/${appt.id}/complete`, { remarks })
      const done = body.appointment || {}
      setAppointments(p => p.map(a => (a.id === appt.id
        ? { ...a, status: 'Completed', completedAt: done.completedAt || new Date().toISOString(), completionRemarks: done.completionRemarks || null }
        : a)))
      setCompleteTarget(null)
      showToast('Session marked as completed')
      logAppt('✅', `Marked ${patient(appt).name}'s session as completed`, appt)
      if (body.canRecommend) setPromptRec({ ...appt, status: 'Completed' })
    } catch (err) {
      setCompleteError(err.message || 'Could not mark the session as completed.')
    } finally {
      setCompleteBusy(false)
    }
  }

  const handleRecommendSent = (appt, result) => {
    setRecommendTarget(null)
    if (appt.patientId) setOpenRecPatients(prev => new Set(prev).add(appt.patientId))
    const failed = Object.keys(result?.failed || {})
    showToast(failed.length
      ? `Recommendation sent (couldn't send by ${failed.join(', ')}).`
      : 'Recommendation sent to the parent')
    logAppt('🔁', `Recommended another session for ${patient(appt).name}`, appt)
  }

  const handleAdd       = (appt) => {
    setAppointments(p => [...p, appt]); setShowAdd(false); showToast('Appointment added!')
    logAppt('📅', `Scheduled appointment for ${patient(appt).name} on ${appt.date}`, appt)
  }
  const handleSaveEdit  = (appt) => {
    const prev = appointments.find(a => a.id === appt.id)
    setAppointments(p => p.map(a => a.id===appt.id?appt:a)); setEditAppt(null); showToast('Appointment updated!')
    const statusChanged = prev && prev.status !== appt.status
    logAppt('✏️', statusChanged
      ? `${appt.status} appointment for ${patient(appt).name}`
      : `Updated appointment details for ${patient(appt).name}`, appt)
  }
  const handleArchive   = (id)   => {
    const appt = appointments.find(a => a.id === id)
    setAppointments(p => p.map(a => a.id===id?{...a,status:'Archived',archivedAt:new Date().toISOString()}:a)); showToast('Appointment archived.')
    if (appt) logAppt('🗃️', `Archived appointment for ${patient(appt).name}`, appt, 'Review')
  }
  const handleUnarchive = (id)   => {
    const appt = appointments.find(a => a.id === id)
    setAppointments(p => p.map(a => a.id===id?{...a,status:'Confirmed',archivedAt:null}:a)); showToast('Appointment restored.')
    if (appt) logAppt('♻️', `Restored appointment for ${patient(appt).name}`, appt)
  }

  // Accept/Decline open a confirmation modal first; the actual PATCH only
  // fires once the therapist confirms there (see confirmRespond below).
  const handleAcceptRequest = (req) => setRespondTarget({ req, action: 'accept' })
  const handleDeclineRequest = (req) => setRespondTarget({ req, action: 'decline' })

  const confirmRespond = async () => {
    if (!respondTarget) return
    const { req, action } = respondTarget
    setRespondBusy(true)
    try {
      const res = await fetch(`/api/appointments/${req.id}/respond`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Could not update the appointment.')

      const nextStatus = action === 'accept' ? 'Confirmed' : 'Cancelled'
      setAppointments(p => p.map(a => (a.id === req.id ? { ...a, status: nextStatus, cancelledReason: action === 'decline' ? 'Declined by therapist' : a.cancelledReason } : a)))
      showToast(
        action === 'accept'
          ? `Accepted ${req.name}'s request${body.emailSent ? ' — guardian notified by email.' : '.'}`
          : `Declined ${req.name}'s request${body.emailSent ? ' — guardian notified by email.' : '.'}`
      )
      logAppt(action === 'accept' ? '✅' : '🚫', `${action === 'accept' ? 'Accepted' : 'Declined'} appointment request for ${req.name}`, { id: req.id })
      setRespondTarget(null)
    } catch (err) {
      showToast(err.message || 'Something went wrong.')
    } finally {
      setRespondBusy(false)
    }
  }
  const handleStartSession = (name) => showToast(`Starting session with ${name}…`)

  return (
    <TherapistPageShell
      user={user}
      onLogout={onLogout}
      title="Appointments"
      subtitle="Manage patient sessions and schedules"
      icon="🗓️"
      menuItems={getTherapistMenuItems(betaTier)}
    >
      {loading ? (
        <p style={{ color: '#6b7c75', fontSize: 14 }}>Loading your appointments…</p>
      ) : loadError ? (
        <div className="tapp-empty">
          <div className="tapp-empty-icon">🗓️</div>
          <p className="tapp-empty-title">Couldn't load your appointments</p>
          <p className="tapp-empty-sub">{loadError}</p>
        </div>
      ) : (
      <div className="tapp2-wrap">

        {/* KPI strip */}
        <div className="tapp-stats">
          <div className="tapp-stat">
            <div className="tapp-stat-icon tapp-stat-green">📅</div>
            <div className="tapp-stat-body">
              <span className="tapp-stat-num">{todayCount}</span>
              <span className="tapp-stat-lbl">Today</span>
            </div>
          </div>
          <div className="tapp-stat">
            <div className="tapp-stat-icon tapp-stat-blue">📋</div>
            <div className="tapp-stat-body">
              <span className="tapp-stat-num">{schedCount}</span>
              <span className="tapp-stat-lbl">Scheduled</span>
            </div>
          </div>
          <div className="tapp-stat">
            <div className="tapp-stat-icon tapp-stat-amber">⏳</div>
            <div className="tapp-stat-body">
              <span className="tapp-stat-num">{pendCount}</span>
              <span className="tapp-stat-lbl">Pending</span>
            </div>
          </div>
          <div className="tapp-stat">
            <div className="tapp-stat-icon tapp-stat-blue"><BadgeCheckIcon size={20} /></div>
            <div className="tapp-stat-body">
              <span className="tapp-stat-num">{doneCount}</span>
              <span className="tapp-stat-lbl">Completed</span>
            </div>
          </div>
          <div className="tapp-stat">
            <div className="tapp-stat-icon tapp-stat-red" style={{ fontSize: 16 }}>📦</div>
            <div className="tapp-stat-body">
              <span className="tapp-stat-num">{archCount}</span>
              <span className="tapp-stat-lbl">Archived</span>
            </div>
          </div>
        </div>

        {/* Full-width Calendar */}
        <FullCalendar
          appointments={appointments}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />

        {/* Incoming appointment requests — every real booking still Pending */}
        {incomingRequests.length > 0 && (
          <section className="tapp2-requests">
            <div className="tapp2-requests-banner">
              <ClockIcon />
              <span>{incomingRequests.length} request{incomingRequests.length !== 1 ? 's' : ''} need{incomingRequests.length === 1 ? 's' : ''} your response</span>
            </div>
            {incomingRequests.map(req => (
              <RequestCard key={req.id} req={req} onAccept={handleAcceptRequest} onDecline={handleDeclineRequest} />
            ))}
          </section>
        )}

        {/* Header */}
        <div className="tapp2-header">
          <h2 className="tapp2-title">Appointments</h2>
          <p className="tapp2-subdate">
            {selectedDate ? `Showing ${fmtDate(selectedDate)}` : fmtDateLong(today)}
            {selectedDate && (
              <button type="button" className="tapp2-clear-date" onClick={() => setSelectedDate(null)}>Clear</button>
            )}
          </p>
        </div>

        {/* Toolbar */}
        <div className="tapp2-toolbar">
          <div className="tapp2-seg">
            <button
              className={`tapp2-seg-btn${viewMode === 'active' ? ' active' : ''}`}
              onClick={() => setViewMode('active')}
            >
              Active
            </button>
            <button
              className={`tapp2-seg-btn${viewMode === 'archived' ? ' active' : ''}`}
              onClick={() => setViewMode('archived')}
            >
              Archived{archCount > 0 && <span className="tapp2-seg-badge">{archCount}</span>}
            </button>
          </div>
          <div className="tapp2-search-wrap">
            <span className="tapp2-search-icon"><SearchIcon /></span>
            <input
              className="tapp2-search"
              placeholder="Search patient…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {viewMode === 'active' && (
            <select className="tapp2-status-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="All">All statuses</option>
              <option>Confirmed</option>
              <option>Pending</option>
              <option>Cancelled</option>
              <option>Completed</option>
            </select>
          )}
          {viewMode === 'active' && (
            <button className="tapp2-add-btn" onClick={() => setShowAdd(true)}>
              <PlusIcon /> Add appointment
            </button>
          )}
        </div>

        {/* Appointment list */}
        {groups.length === 0 ? (
          <div className="tapp-empty">
            <div className="tapp-empty-icon">🗓️</div>
            <p className="tapp-empty-title">No appointments found</p>
            <p className="tapp-empty-sub">
              Try adjusting filters or add a new appointment.
            </p>
          </div>
        ) : (
          groups.map(([date, appts]) => (
            <div key={date} className="tapp2-group">
              <div className="tapp2-group-label">{groupHeader(date)}</div>
              <div className="tapp2-rows">
                {appts.map(a => {
                  const p = patient(a)
                  return (
                    <AppointmentRow
                      key={a.id}
                      appt={a}
                      name={p.name}
                      isToday={a.date === today}
                      viewMode={viewMode}
                      canRecommend={canRecommendAppt(a)}
                      onComplete={() => openComplete(a)}
                      onRecommend={() => setRecommendTarget(a)}
                      onViewNotes={() => navigate('/therapist/notes-progress')}
                      onView={() => setViewAppt(a)}
                      onEdit={() => setEditAppt(a)}
                      onArchive={() => setConfirmArchId(a.id)}
                      onRestoreClick={() => setConfirmRestoreAppt(a)}
                      onStart={() => handleStartSession(p.name)}
                    />
                  )
                })}
              </div>
            </div>
          ))
        )}

      </div>
      )}

      {showAdd  && <FormModal onClose={() => setShowAdd(false)} onSave={handleAdd} appointments={appointments} />}
      {viewAppt && <ViewModal appt={viewAppt} patient={patient(viewAppt)} onClose={() => setViewAppt(null)} onEdit={a => setEditAppt(a)} onRestoreClick={a => { setViewAppt(null); setConfirmRestoreAppt(a) }} onComplete={openComplete} onRecommend={a => setRecommendTarget(a)} canRecommend={canRecommendAppt(viewAppt)} />}
      {completeTarget && (
        <CompleteConfirmModal
          appt={completeTarget}
          patient={patient(completeTarget)}
          busy={completeBusy}
          error={completeError}
          onConfirm={confirmComplete}
          onClose={() => !completeBusy && setCompleteTarget(null)}
        />
      )}
      {promptRec && (
        <RecommendPromptModal
          patient={patient(promptRec)}
          onRecommend={() => { setRecommendTarget(promptRec); setPromptRec(null) }}
          onClose={() => setPromptRec(null)}
        />
      )}
      {recommendTarget && (
        <RecommendSessionModal
          patient={{
            name: patient(recommendTarget).name,
            guardian: recommendTarget.guardianName,
            lastSessionLabel: `${fmtDateShort(recommendTarget.date)} · Completed`,
          }}
          appointmentId={recommendTarget.id}
          defaultType={recommendTarget.sessionType || recommendTarget.type}
          onClose={() => setRecommendTarget(null)}
          onSent={(result) => handleRecommendSent(recommendTarget, result)}
        />
      )}
      {editAppt && <FormModal initial={editAppt} onClose={() => setEditAppt(null)} onSave={handleSaveEdit} appointments={appointments} />}
      {confirmArchId && (
        <div className="tapp-overlay" onClick={e => e.target === e.currentTarget && setConfirmArchId(null)}>
          <div className="tapp-confirm-modal">
            <div className="tapp-confirm-icon">📦</div>
            <h3 className="tapp-confirm-title">Archive Appointment?</h3>
            <p className="tapp-confirm-msg">
              This appointment will be moved to the archived list. You can still view it later.
            </p>
            <div className="tapp-confirm-actions">
              <button className="tapp-confirm-cancel" onClick={() => setConfirmArchId(null)}>Cancel</button>
              <button className="tapp-confirm-ok" onClick={() => { handleArchive(confirmArchId); setConfirmArchId(null) }}>
                Yes, Archive
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmRestoreAppt && (
        <RestoreConfirmModal
          appt={confirmRestoreAppt}
          patient={patient(confirmRestoreAppt)}
          appointments={appointments}
          onConfirm={id => { handleUnarchive(id); setConfirmRestoreAppt(null) }}
          onRebook={a => { setEditAppt(a); setConfirmRestoreAppt(null) }}
          onClose={() => setConfirmRestoreAppt(null)}
        />
      )}
      {respondTarget && (
        <RespondConfirmModal
          req={respondTarget.req}
          action={respondTarget.action}
          busy={respondBusy}
          onConfirm={confirmRespond}
          onClose={() => !respondBusy && setRespondTarget(null)}
        />
      )}
      {toast    && <div className="tapp-toast">{toast}</div>}
    </TherapistPageShell>
  )
}
