import { useState, useMemo, useEffect } from 'react'
import TherapistPageShell from './TherapistPageShell'
import { getTherapistMenuItems } from './therapistSidebarConfig'
import { logActivity } from '../../utils/auditLog'
import './TherapistAppointmentsPage.css'

/* ── Data ─────────────────────────────────────────────────── */
const PATIENTS = [
  { id: 0,  name: 'Alvrin',        avatar: 'https://i.pravatar.cc/150?img=33', condition: 'Anxiety Disorder'  },
  { id: 1,  name: 'Aira Lopez',    avatar: 'https://i.pravatar.cc/150?img=1',  condition: 'Cerebral Palsy'    },
  { id: 2,  name: 'Mika Santos',   avatar: 'https://i.pravatar.cc/150?img=2',  condition: 'ADHD'              },
  { id: 3,  name: 'Noah Cruz',     avatar: 'https://i.pravatar.cc/150?img=3',  condition: 'Autism Spectrum'   },
  { id: 4,  name: 'Lea Reyes',     avatar: 'https://i.pravatar.cc/150?img=4',  condition: 'Dyslexia'          },
  { id: 5,  name: 'Sam Torres',    avatar: 'https://i.pravatar.cc/150?img=5',  condition: 'Down Syndrome'     },
  { id: 6,  name: 'Kim Flores',    avatar: 'https://i.pravatar.cc/150?img=6',  condition: 'Sensory Processing'},
  { id: 7,  name: 'Pat Ramos',     avatar: 'https://i.pravatar.cc/150?img=7',  condition: 'Motor Delay'       },
  { id: 8,  name: 'Jan Garcia',    avatar: 'https://i.pravatar.cc/150?img=8',  condition: 'Speech Delay'      },
  { id: 9,  name: 'Drew Bautista', avatar: 'https://i.pravatar.cc/150?img=9',  condition: 'Social Anxiety'    },
  { id: 10, name: 'Blake Mendoza', avatar: 'https://i.pravatar.cc/150?img=10', condition: 'Selective Mutism'  },
]

const SEED = [
  { id: 1,  patientId: 1,  date: '2026-07-04', time: '09:00', type: 'Follow-up',  duration: '60 min',  status: 'Confirmed', notes: 'Continue motor exercises'   },
  { id: 2,  patientId: 2,  date: '2026-07-04', time: '10:30', type: 'Assessment', duration: '90 min',  status: 'Pending',   notes: 'Monthly progress check'    },
  { id: 3,  patientId: 3,  date: '2026-07-04', time: '13:00', type: 'Follow-up',  duration: '60 min',  status: 'Confirmed', notes: ''                          },
  { id: 4,  patientId: 0,  date: '2026-07-05', time: '09:00', type: 'Follow-up',  duration: '60 min',  status: 'Confirmed', notes: 'Breathing exercises review' },
  { id: 5,  patientId: 4,  date: '2026-07-05', time: '11:00', type: 'Initial',    duration: '120 min', status: 'Confirmed', notes: 'First session – intake'     },
  { id: 6,  patientId: 5,  date: '2026-07-07', time: '09:00', type: 'Follow-up',  duration: '60 min',  status: 'Pending',   notes: ''                          },
  { id: 7,  patientId: 6,  date: '2026-07-07', time: '14:00', type: 'Group',      duration: '90 min',  status: 'Confirmed', notes: 'Group sensory session'      },
  { id: 8,  patientId: 7,  date: '2026-07-08', time: '10:00', type: 'Assessment', duration: '90 min',  status: 'Confirmed', notes: 'Quarterly motor assessment' },
  { id: 9,  patientId: 8,  date: '2026-07-09', time: '09:30', type: 'Follow-up',  duration: '60 min',  status: 'Cancelled', notes: 'Patient unavailable'        },
  { id: 10, patientId: 9,  date: '2026-07-10', time: '15:00', type: 'Follow-up',  duration: '60 min',  status: 'Confirmed', notes: ''                          },
  { id: 11, patientId: 10, date: '2026-07-11', time: '11:00', type: 'Follow-up',  duration: '60 min',  status: 'Pending',   notes: ''                          },
  { id: 12, patientId: 1,  date: '2026-07-12', time: '09:00', type: 'Follow-up',  duration: '60 min',  status: 'Confirmed', notes: ''                          },
]

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

/* ── Helpers ──────────────────────────────────────────────── */
function fmt12(t) {
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`
}
function fmtDate(iso) {
  return new Date(iso + 'T00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}
function fmtDay(iso) {
  return new Date(iso + 'T00:00').toLocaleDateString('en-US', { weekday: 'short' })
}
function groupLabel(iso) {
  const today    = new Date().toISOString().slice(0,10)
  const tomorrow = new Date(Date.now()+86400000).toISOString().slice(0,10)
  if (iso === today)    return 'Today'
  if (iso === tomorrow) return 'Tomorrow'
  return new Date(iso+'T00:00').toLocaleDateString('en-US',{weekday:'long'})
}
function typeClass(t) {
  return ({Initial:'tapp-type-initial','Follow-up':'tapp-type-followup',Assessment:'tapp-type-assessment',Group:'tapp-type-group'})[t]||'tapp-type-followup'
}
function statusClass(s) {
  return ({Confirmed:'tapp-status-confirmed',Pending:'tapp-status-pending',Cancelled:'tapp-status-cancelled',Completed:'tapp-status-completed',Archived:'tapp-status-archived'})[s]||''
}
function dotClass(n) {
  if (n >= 7) return 'tapp-dot-many'
  if (n >= 4) return 'tapp-dot-mid'
  return 'tapp-dot-few'
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

/* ── Full Calendar ────────────────────────────────────────── */
function FullCalendar({ appointments, selectedDate, onSelectDate }) {
  const [calMonth, setCalMonth] = useState(new Date(2026, 6))

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
                  {count > 0 && (
                    <div className="tapp-cal-dots">
                      <span className={`tapp-cal-dot ${dotClass(count)}`} />
                    </div>
                  )}
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

/* ── View Modal ───────────────────────────────────────────── */
function ViewModal({ appt, patient, onClose, onEdit, onRestoreClick }) {
  return (
    <div className="tapp-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="tapp-modal">
        <div className="tapp-modal-header">
          <h2 className="tapp-modal-title">Appointment Details</h2>
          <button className="tapp-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="tapp-modal-body">
          <div className="tapp-view-hero">
            <img className="tapp-view-avatar" src={patient.avatar} alt={patient.name} />
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
          <div className="tapp-view-notes">
            <span className="tapp-view-notes-lbl">Notes</span>
            <p className="tapp-view-notes-text">{appt.notes || 'No notes for this session.'}</p>
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
              <button className="tapp-modal-submit" onClick={() => { onClose(); onEdit(appt) }}>Edit Appointment</button>
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
  const conflictPatient = conflict ? PATIENTS.find(p => p.id === conflict.patientId) : null

  return (
    <div className="tapp-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="tapp-confirm-modal">
        {conflict ? (
          <>
            <div className="tapp-confirm-icon">⚠️</div>
            <h3 className="tapp-confirm-title">Schedule Conflict</h3>
            <p className="tapp-confirm-msg">
              <strong>{conflictPatient?.name || 'Another patient'}</strong> already has an appointment
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

/* ── Main Page ────────────────────────────────────────────── */
export default function TherapistAppointmentsPage({ user, onLogout, betaTier }) {
  const [appointments, setAppointments] = useState(() => {
    try {
      const saved = localStorage.getItem('therapist_appointments')
      if (saved) return JSON.parse(saved)
    } catch {}
    return SEED
  })
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [selectedDate, setSelectedDate] = useState(null)
  const [viewMode,     setViewMode]     = useState('active')
  const [showAdd,      setShowAdd]      = useState(false)
  const [viewAppt,     setViewAppt]     = useState(null)
  const [editAppt,     setEditAppt]     = useState(null)
  const [confirmArchId,    setConfirmArchId]    = useState(null)
  const [confirmRestoreAppt,setConfirmRestoreAppt]= useState(null)
  const [toast,        setToast]        = useState('')

  useEffect(() => {
    localStorage.setItem('therapist_appointments', JSON.stringify(appointments))
  }, [appointments])

  const today = new Date().toISOString().slice(0,10)

  const todayCount = appointments.filter(a => a.date === today && a.status !== 'Archived').length
  const schedCount = appointments.filter(a => a.status !== 'Archived' && a.status !== 'Cancelled').length
  const pendCount  = appointments.filter(a => a.status === 'Pending').length
  const archCount  = appointments.filter(a => a.status === 'Archived').length

  const filtered = useMemo(() => {
    return appointments
      .filter(a => {
        if (viewMode === 'archived') return a.status === 'Archived'
        if (a.status === 'Archived') return false
        if (statusFilter !== 'All' && a.status !== statusFilter) return false
        if (search) {
          const p = PATIENTS.find(p => p.id === a.patientId)
          if (!p?.name.toLowerCase().includes(search.toLowerCase())) return false
        }
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
  const patient   = (a)   => PATIENTS.find(p => p.id === a.patientId) || { name: a.patientName || 'Unknown', avatar: `https://i.pravatar.cc/150?img=${(a.id % 70) + 1}`, condition: '' }

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

  return (
    <TherapistPageShell
      user={user}
      onLogout={onLogout}
      title="Appointments"
      subtitle="Manage patient sessions and schedules"
      icon="🗓️"
      menuItems={getTherapistMenuItems(betaTier)}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

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

        {/* View mode tabs + toolbar */}
        <div className="tapp-tabs-row">
          <div className="tapp-tabs">
            <button
              className={`tapp-tab${viewMode === 'active' ? ' tapp-tab-active' : ''}`}
              onClick={() => setViewMode('active')}
            >
              Active Appointments
            </button>
            <button
              className={`tapp-tab${viewMode === 'archived' ? ' tapp-tab-active' : ''}`}
              onClick={() => setViewMode('archived')}
            >
              📦 Archived{archCount > 0 && <span className="tapp-tab-badge">{archCount}</span>}
            </button>
          </div>
          {viewMode === 'active' && (
            <button className="tapp-add-btn" onClick={() => setShowAdd(true)}>
              <PlusIcon /> Add Appointment
            </button>
          )}
        </div>

        <div className="tapp-toolbar">
          <div className="tapp-search-wrap">
            <span className="tapp-search-icon"><SearchIcon /></span>
            <input
              className="tapp-search"
              placeholder="Search patient…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {viewMode === 'active' && (
            <select className="tapp-filter" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option>All</option>
              <option>Confirmed</option>
              <option>Pending</option>
              <option>Cancelled</option>
              <option>Completed</option>
            </select>
          )}
        </div>

        {/* Selected day banner */}
        {selectedDate && (
          <div className="tapp-day-banner">
            <span className="tapp-day-banner-date">{fmtDate(selectedDate)}</span>
            {selectedDate === today && <span className="tapp-day-banner-today">Today</span>}
          </div>
        )}

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
            <div key={date} className="tapp-group">
              <div className="tapp-group-header">
                <span className="tapp-group-label">{groupLabel(date)}</span>
                <span className="tapp-group-date">{fmtDate(date)}</span>
                <div className="tapp-group-divider" />
              </div>

              {appts.map(a => {
                const p = patient(a)
                return (
                  <div key={a.id} className={`tapp-card${a.status==='Archived'?' archived':''}`}>
                    <img className="tapp-card-avatar" src={p.avatar} alt={p.name} />
                    <div className="tapp-card-patient">
                      <span className="tapp-card-name">{p.name}</span>
                      <span className="tapp-card-condition">{p.condition}</span>
                    </div>
                    <div className="tapp-card-divider" />
                    <div className="tapp-card-meta">
                      <div className="tapp-card-meta-row"><CalIcon />{fmtDate(a.date)} · {fmtDay(a.date)}</div>
                      <div className="tapp-card-meta-row"><ClockIcon />{fmt12(a.time)} · {a.duration}</div>
                    </div>
                    <div className="tapp-card-divider" />
                    <span className={`tapp-type-badge ${typeClass(a.type)}`}>{a.type}</span>
                    <span className={`tapp-status-badge ${statusClass(a.status)}`}>{a.status}</span>
                    <div className="tapp-card-actions">
                      <button className="tapp-btn tapp-btn-view" onClick={() => setViewAppt(a)}><EyeIcon /> View</button>
                      {viewMode === 'active' && (
                        <button className="tapp-btn tapp-btn-edit" onClick={() => setEditAppt(a)}><PencilIcon /> Edit</button>
                      )}
                      {viewMode === 'active' && (
                        <button className="tapp-btn tapp-btn-archive" onClick={() => setConfirmArchId(a.id)}><ArchiveIcon /> Archive</button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ))
        )}

      </div>

      {showAdd  && <FormModal onClose={() => setShowAdd(false)} onSave={handleAdd} appointments={appointments} />}
      {viewAppt && <ViewModal appt={viewAppt} patient={patient(viewAppt)} onClose={() => setViewAppt(null)} onEdit={a => setEditAppt(a)} onRestoreClick={a => { setViewAppt(null); setConfirmRestoreAppt(a) }} />}
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
      {toast    && <div className="tapp-toast">{toast}</div>}
    </TherapistPageShell>
  )
}
