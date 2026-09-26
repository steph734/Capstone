import { useEffect, useMemo, useState } from 'react'
import TherapistPageShell from './TherapistPageShell'
import { getTherapistMenuItems } from './therapistSidebarConfig'
import { logActivity } from '../../utils/auditLog'
import { useSharedProgress } from '../../context/ProgressContext'
import { manilaDateKey, manilaMinutesOfDay } from '../../utils/manilaTime'
import { EXERCISE_GAMES } from '../../data/exerciseGames'
import './TherapistAssignExercisesPage.css'

const DOMAINS = ['Cognitive', 'Physical', 'Occupational', 'Speech']
// Fixed warm-up + wrap-up allowance carved out of every session before any
// games get picked — not configurable yet, matching the reference design.
const WARM_UP_MIN = 10

function dueLabel(iso) {
  if (!iso) return '—'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(iso + 'T00:00')
  const diff = Math.round((d - today) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function dueTone(iso) {
  const label = dueLabel(iso)
  if (label === 'Today' || label === 'Yesterday') return 'tae-due-red'
  if (label === 'Tomorrow') return 'tae-due-amber'
  return 'tae-due-gray'
}

function initials(name) {
  return String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?'
}

const AVATAR_COLORS = [
  { bg: '#d9efe7', color: '#159a72' },
  { bg: '#e7e3fb', color: '#6d5bd0' },
  { bg: '#d8ecfb', color: '#0284c7' },
  { bg: '#fbeacb', color: '#d97706' },
  { bg: '#fbdce8', color: '#db2777' },
]
function avatarColor(name) {
  const s = String(name || '')
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h + s.charCodeAt(i)) % AVATAR_COLORS.length
  return AVATAR_COLORS[h]
}

// 24h "HH:MM" -> "8:00 AM"
function fmt12(hhmm) {
  const [h, m] = String(hhmm || '0:0').split(':').map(Number)
  const h12 = h % 12 || 12
  return `${h12}:${String(m || 0).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}
function toMinutes(hhmm) {
  const [h, m] = String(hhmm || '0:0').split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}
function parseDurationMin(label) {
  const m = String(label || '').match(/\d+/)
  return m ? Number(m[0]) : 0
}
function statusSlug(status) {
  return { Finished: 'finished', 'In session': 'active', 'Up next': 'next', Upcoming: 'upcoming' }[status] || 'upcoming'
}

/* ── Icons ──────────────────────────────────────────────── */
const ico = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }
const ListIcon = () => <svg {...ico}><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" /></svg>
const CalIcon = () => <svg {...ico}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
const CalMiniIcon = () => <svg {...ico} width="12" height="12"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
const SendIcon = () => <svg {...ico}><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" /></svg>
const TrashIcon = () => <svg {...ico} width="15" height="15"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14M10 11v6M14 11v6" /></svg>
const BulbIcon = () => <svg {...ico}><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V18h6v-1.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z" /></svg>
const ClockIcon = () => <svg {...ico} width="13" height="13"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></svg>
const CheckIcon = () => <svg {...ico} width="14" height="14" strokeWidth={3}><path d="M20 6L9 17l-5-5" /></svg>

// therapy_notes-style API row -> the {patient, exercise, domain, due,
// status} shape the Assigned Exercises list already renders.
function fromApiAssignment(a) {
  return {
    id: a.id,
    patient: a.patientName,
    exercise: a.exercise,
    domain: a.domain,
    instructions: a.instructions,
    due: a.due,
    status: a.status,
  }
}

export default function TherapistAssignExercisesPage({ user, onLogout, betaTier }) {
  const [appointments, setAppointments] = useState([])
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [selectedSessionId, setSelectedSessionId] = useState(null)
  const [planGameIds, setPlanGameIds] = useState([])
  const [matchSessionType, setMatchSessionType] = useState(true)
  const [toast, setToast] = useState('')
  const [assigning, setAssigning] = useState(false)
  const { addExercise } = useSharedProgress()

  // Real bookings for this therapist (the session list on the left is
  // today's slice of it, plus a time-derived status — Finished/In session/
  // Up next — rather than anything stored server-side) and every exercise
  // already assigned, from the `exercise_assignments` collection.
  useEffect(() => {
    let cancelled = false
    if (!user?.email) {
      setLoading(false)
      setLoadError('Your account isn’t linked to a staff record yet.')
      return
    }
    setLoading(true)
    Promise.all([
      fetch(`/api/appointments/therapist-list?email=${encodeURIComponent(user.email)}`)
        .then(async (r) => {
          const body = await r.json().catch(() => ({}))
          if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`)
          return body.appointments || []
        }),
      fetch(`/api/exercises/therapist-list?email=${encodeURIComponent(user.email)}`)
        .then(async (r) => {
          const body = await r.json().catch(() => ({}))
          if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`)
          return body.assignments || []
        }),
    ])
      .then(([apiAppointments, apiAssignments]) => {
        if (cancelled) return
        setAppointments(apiAppointments)
        setAssignments(apiAssignments.map(fromApiAssignment))
      })
      .catch((e) => { if (!cancelled) setLoadError(e.message || 'Could not load your schedule.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [user?.email])

  const todayKey = manilaDateKey()
  const nowMin = manilaMinutesOfDay(new Date().toISOString())

  const todaysSessions = useMemo(() => {
    const list = appointments
      .filter((a) => a.date === todayKey && a.status !== 'Archived' && a.status !== 'Cancelled')
      .sort((a, b) => toMinutes(a.time) - toMinutes(b.time))
      .map((a) => {
        const start = toMinutes(a.time)
        const end = toMinutes(a.endTime)
        const computedStatus = nowMin >= end ? 'Finished' : nowMin >= start ? 'In session' : 'Upcoming'
        return { ...a, computedStatus }
      })
    let markedNext = false
    return list.map((s) => {
      if (s.computedStatus === 'Upcoming' && !markedNext) {
        markedNext = true
        return { ...s, computedStatus: 'Up next' }
      }
      return s
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointments, todayKey])

  // Default to whichever session is happening (or about to happen) right now.
  useEffect(() => {
    if (selectedSessionId != null || todaysSessions.length === 0) return
    const preferred = todaysSessions.find((s) => s.computedStatus === 'In session')
      || todaysSessions.find((s) => s.computedStatus === 'Up next')
      || todaysSessions[0]
    setSelectedSessionId(preferred.id)
  }, [todaysSessions, selectedSessionId])

  // A game plan is specific to one session — starting fresh when the
  // therapist switches patients avoids carrying over a plan that doesn't
  // fit (or even make domain sense for) the newly selected session.
  useEffect(() => { setPlanGameIds([]) }, [selectedSessionId])

  const selectedSession = todaysSessions.find((s) => s.id === selectedSessionId) || null
  const sessionDomain = selectedSession && DOMAINS.includes(selectedSession.type) ? selectedSession.type : null
  const totalMin = selectedSession ? parseDurationMin(selectedSession.duration) : 0
  const availableForGamesMin = Math.max(0, totalMin - WARM_UP_MIN)

  const planGames = EXERCISE_GAMES.filter((g) => planGameIds.includes(g.id))
  const gamesUsedMin = planGames.reduce((sum, g) => sum + g.durationMin, 0)
  const minutesLeft = Math.max(0, availableForGamesMin - gamesUsedMin)
  const overBudget = gamesUsedMin > availableForGamesMin

  const visibleGames = matchSessionType && sessionDomain
    ? EXERCISE_GAMES.filter((g) => g.domain === sessionDomain)
    : EXERCISE_GAMES

  const toggleGame = (id) => {
    setPlanGameIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2600) }

  const handleAssignPlan = async () => {
    if (!selectedSession || planGames.length === 0 || assigning) return
    setAssigning(true)
    try {
      const res = await fetch('/api/exercises/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: selectedSession.patientId,
          patientName: selectedSession.patientName,
          employeeEmail: user?.email,
          appointmentId: selectedSession.id,
          dueDate: todayKey,
          games: planGames.map((g) => ({
            gameId: g.id,
            name: g.name,
            domain: g.domain,
            difficulty: g.difficulty,
            durationMin: g.durationMin,
            rounds: g.rounds,
            instructions: g.description,
          })),
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)

      const newAssignments = planGames.map((g, i) => ({
        id: body.ids?.[i] || `${Date.now()}-${i}`,
        patient: selectedSession.patientName,
        exercise: g.name,
        domain: g.domain,
        instructions: g.description,
        due: todayKey,
        status: 'Assigned',
      }))
      setAssignments((prev) => [...newAssignments, ...prev])
      // Alvrin is the demo patient wired to the parent-facing Progress page.
      if (String(selectedSession.patientName || '').trim().toLowerCase() === 'alvrin') {
        newAssignments.forEach((a) => addExercise({ title: a.exercise, domain: a.domain, instructions: a.instructions, due: 'Today' }))
      }
      logActivity({
        role: 'Therapist',
        user: user?.name || 'Therapist',
        email: user?.email || '—',
        actionIcon: '🎯',
        action: 'Exercise',
        description: `Planned ${planGames.length} game${planGames.length === 1 ? '' : 's'} for ${selectedSession.patientName}'s session`,
        entity: `Patient · ${selectedSession.patientName}`,
        status: 'Success',
      })
      setPlanGameIds([])
      showToast(`Session plan assigned to ${selectedSession.patientName}!`)
    } catch (err) {
      showToast(err.message || 'Could not assign this plan. Please try again.')
    } finally {
      setAssigning(false)
    }
  }

  const handleDelete = async (id) => {
    const assignment = assignments.find((a) => a.id === id)
    setAssignments((current) => current.filter((a) => a.id !== id))
    try {
      const res = await fetch(`/api/exercises/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
    } catch (err) {
      // Restore it — the delete didn't actually happen server-side.
      if (assignment) setAssignments((current) => [assignment, ...current])
      showToast(err.message || 'Could not delete this assignment. Please try again.')
      return
    }
    if (assignment) {
      logActivity({
        role: 'Therapist',
        user: user?.name || 'Therapist',
        email: user?.email || '—',
        actionIcon: '🗑️',
        action: 'Exercise',
        description: `Removed "${assignment.exercise}" assignment for ${assignment.patient}`,
        entity: `Patient · ${assignment.patient}`,
        status: 'Review',
      })
    }
  }

  const todayLong = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <TherapistPageShell
      user={user}
      onLogout={onLogout}
      title="Assign Exercises"
      subtitle={`${todayLong} · pick a session, then choose games that fit the time.`}
      icon="🎯"
      menuItems={getTherapistMenuItems(betaTier)}
    >
      {loading ? (
        <p style={{ color: '#6b7c75', fontSize: 14 }}>Loading your schedule…</p>
      ) : loadError ? (
        <p style={{ color: '#b91c1c', fontSize: 14 }}>{loadError}</p>
      ) : (
      <div className="tae-page">
        <div className="tae-planner-grid">

          {/* ── Today's Schedule ── */}
          <section className="tae-card tae-schedule-card">
            <div className="tae-card-head">
              <span className="tae-card-icon"><CalIcon /></span>
              <div>
                <h3>Today's Schedule</h3>
                <p>{todaysSessions.length} session{todaysSessions.length === 1 ? '' : 's'}</p>
              </div>
            </div>

            <div className="tae-schedule-list">
              {todaysSessions.length === 0 ? (
                <p className="tae-empty">No sessions scheduled today.</p>
              ) : todaysSessions.map((s) => {
                const c = avatarColor(s.patientName)
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={`tae-session-row${selectedSessionId === s.id ? ' active' : ''}`}
                    onClick={() => setSelectedSessionId(s.id)}
                  >
                    <span className="tae-session-time">{fmt12(s.time)}</span>
                    <span className="tae-avatar" style={{ background: c.bg, color: c.color }}>{initials(s.patientName)}</span>
                    <div className="tae-session-info">
                      <span className="tae-session-name">{s.patientName}</span>
                      <span className="tae-session-meta">{s.type || s.sessionMode || 'Session'} · {s.duration}</span>
                    </div>
                    <span className={`tae-status-pill tae-status-${statusSlug(s.computedStatus)}`}>{s.computedStatus}</span>
                  </button>
                )
              })}
            </div>
          </section>

          {/* ── Session planner ── */}
          <section className="tae-card tae-planner-card">
            {!selectedSession ? (
              <p className="tae-empty">Select a session on the left to plan its games.</p>
            ) : (
              <>
                <div className="tae-time-head">
                  <span className="tae-time-label">Session time · {fmt12(selectedSession.time)} to {fmt12(selectedSession.endTime)}</span>
                  <span className={`tae-time-left${minutesLeft <= 0 ? ' zero' : ''}`}>{minutesLeft} min left for games</span>
                </div>
                <div className="tae-time-bar">
                  <div className="tae-time-seg tae-time-seg-warmup" style={{ width: `${Math.min(100, (WARM_UP_MIN / Math.max(totalMin, 1)) * 100)}%` }} />
                  <div className="tae-time-seg tae-time-seg-games" style={{ width: `${Math.min(100, (Math.min(gamesUsedMin, availableForGamesMin) / Math.max(totalMin, 1)) * 100)}%` }} />
                </div>
                <div className="tae-time-legend">
                  <span><i className="tae-dot tae-dot-warmup" /> Warm-up and wrap-up {WARM_UP_MIN} min</span>
                  <span><i className="tae-dot tae-dot-games" /> Games {gamesUsedMin} min</span>
                  <span>Total session {totalMin} min</span>
                </div>

                <div className="tae-games-head">
                  <div>
                    <h4>Games for {selectedSession.patientName}</h4>
                    <p>{selectedSession.condition || 'No condition on file'} · {(selectedSession.type || selectedSession.sessionMode || 'session').toString().toLowerCase()} session</p>
                  </div>
                  <label className="tae-match-toggle">
                    <input type="checkbox" checked={matchSessionType} onChange={(e) => setMatchSessionType(e.target.checked)} />
                    Match session type
                  </label>
                </div>

                <div className="tae-games-grid">
                  {visibleGames.length === 0 ? (
                    <p className="tae-empty">No games match this session's domain yet.</p>
                  ) : visibleGames.map((g) => {
                    const picked = planGameIds.includes(g.id)
                    return (
                      <button
                        key={g.id}
                        type="button"
                        className={`tae-game-card${picked ? ' picked' : ''}`}
                        onClick={() => toggleGame(g.id)}
                      >
                        {picked && <span className="tae-game-picked-badge"><CheckIcon /></span>}
                        <div className="tae-game-tags">
                          <span className="tae-tag tae-tag-domain">{g.domain}</span>
                          <span className={`tae-tag tae-tag-diff tae-diff-${g.difficulty.toLowerCase()}`}>{g.difficulty}</span>
                        </div>
                        <h5>{g.name}</h5>
                        <p>{g.description}</p>
                        <span className="tae-game-time"><ClockIcon /> {g.durationMin} min · {g.rounds} round{g.rounds === 1 ? '' : 's'} to finish</span>
                      </button>
                    )
                  })}
                </div>

                <div className="tae-plan-box">
                  <h4>Session plan</h4>
                  {planGames.length === 0 ? (
                    <p className="tae-plan-empty">Pick games for {selectedSession.patientName}. You have {availableForGamesMin} minutes to fill.</p>
                  ) : (
                    <>
                      <ul className="tae-plan-list">
                        {planGames.map((g) => (
                          <li key={g.id}>
                            <span className="tae-plan-item-name">{g.name}</span>
                            <span className="tae-plan-item-time">{g.durationMin} min</span>
                            <button type="button" className="tae-plan-remove" onClick={() => toggleGame(g.id)} aria-label={`Remove ${g.name}`}>×</button>
                          </li>
                        ))}
                      </ul>
                      <div className={`tae-plan-total${overBudget ? ' over' : ''}`}>
                        {gamesUsedMin} / {availableForGamesMin} min used
                      </div>
                      <button type="button" className="tae-btn-primary tae-plan-assign" onClick={handleAssignPlan} disabled={assigning}>
                        <SendIcon /> {assigning ? 'Assigning…' : `Assign to ${selectedSession.patientName}`}
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </section>
        </div>

        {/* ── Assigned Exercises ── */}
        <section className="tae-card tae-assigned-card">
          <div className="tae-card-head">
            <span className="tae-card-icon"><ListIcon /></span>
            <div>
              <h3>Assigned Exercises</h3>
              <p>Live list of active home exercises</p>
            </div>
          </div>

          <div className="tae-list">
            {assignments.length === 0 && <p className="tae-empty">No active assignments yet.</p>}
            {assignments.map((a) => {
              const c = avatarColor(a.patient)
              return (
                <div key={a.id} className="tae-assignment">
                  <span className="tae-avatar" style={{ background: c.bg, color: c.color }}>{initials(a.patient)}</span>
                  <div className="tae-assignment-body">
                    <span className="tae-assignment-name">{a.patient}</span>
                    <span className="tae-assignment-meta">{a.exercise} · {a.domain}</span>
                    <span className={`tae-due ${dueTone(a.due)}`}><CalMiniIcon /> Due {dueLabel(a.due)}</span>
                    <span className="tae-pill">{a.status}</span>
                  </div>
                  <button className="tae-delete" onClick={() => handleDelete(a.id)}><TrashIcon /> Delete</button>
                </div>
              )
            })}
          </div>

          <div className="tae-tip">
            <span className="tae-tip-icon"><BulbIcon /></span>
            <div>
              <strong>Tip</strong>
              <p>Consistent home practice helps patients make better progress.</p>
            </div>
          </div>
        </section>
      </div>
      )}

      {toast && <div className="tae-toast">{toast}</div>}
    </TherapistPageShell>
  )
}
