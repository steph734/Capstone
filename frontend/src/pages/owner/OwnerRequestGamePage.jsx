import { useMemo, useState } from 'react'
import OwnerPageShell from './OwnerPageShell'
import { getOwnerMenuItems } from './ownerSidebarConfig'
import { logActivity } from '../../utils/auditLog'
import './OwnerGamifiedSubpages.css'

const SKILL_FOCUS = [
  'Gross motor',
  'Fine motor',
  'Speech & language',
  'Cognitive',
  'Attention / SEL',
  'Social skills',
  'Sensory processing',
]

const STATUS_META = {
  pending: { label: 'Pending Review', pill: 'ogs-s-pending', dot: 'ogs-dot-pending' },
  approved: { label: 'Approved', pill: 'ogs-s-approved', dot: 'ogs-dot-approved' },
  dev: { label: 'In Development', pill: 'ogs-s-dev', dot: 'ogs-dot-dev' },
  live: { label: 'Live', pill: 'ogs-s-live', dot: 'ogs-dot-live' },
  declined: { label: 'Declined', pill: 'ogs-s-declined', dot: 'ogs-dot-declined' },
}

const INITIAL_REQUESTS = [
  { id: 1, name: 'Underwater Word Hunt', focus: 'Speech & language', ageFrom: 8, ageTo: 11, submitted: 'Jul 1, 2026', status: 'pending' },
  { id: 2, name: 'Shape Sorter Sprint', focus: 'Cognitive', ageFrom: 5, ageTo: 8, submitted: 'Jun 20, 2026', status: 'approved' },
  { id: 3, name: 'Balance Bridge Builder', focus: 'Gross motor', ageFrom: 9, ageTo: 13, submitted: 'Jun 10, 2026', status: 'dev' },
  { id: 4, name: 'Rhyme Time Rally', focus: 'Speech & language', ageFrom: 6, ageTo: 9, submitted: 'May 28, 2026', status: 'live' },
  { id: 5, name: 'Emoji Emotion Match', focus: 'Attention / SEL', ageFrom: 7, ageTo: 10, submitted: 'May 15, 2026', status: 'declined' },
]

const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)

const todayLabel = () =>
  new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

const EMPTY_FORM = {
  name: '',
  focus: SKILL_FOCUS[0],
  ageFrom: '',
  ageTo: '',
  priority: 'medium',
  reason: '',
  reference: '',
}

export default function OwnerRequestGamePage({ user, onLogout, betaTier }) {
  const [requests, setRequests] = useState(INITIAL_REQUESTS)
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [toast, setToast] = useState('')

  const setField = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: '' }))
  }

  const stats = useMemo(() => {
    const pending = requests.filter((r) => r.status === 'pending').length
    const dev = requests.filter((r) => r.status === 'dev').length
    const approvedThisMonth = requests.filter((r) => r.status === 'approved').length
    const live = requests.filter((r) => r.status === 'live').length
    return { pending, dev, approvedThisMonth, live: live + 4 }
  }, [requests])

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2400)
  }

  const focusNewRequest = () => {
    document.getElementById('ogs-game-name')?.focus()
  }

  const validate = () => {
    const e = {}
    if (!form.name.trim()) e.name = 'Give the game a name or a short idea.'
    const from = Number(form.ageFrom)
    const to = Number(form.ageTo)
    if (!form.ageFrom || from < 1) e.ageFrom = 'Enter a start age.'
    if (!form.ageTo || to < 1) e.ageTo = 'Enter an end age.'
    if (!e.ageFrom && !e.ageTo && from > to) e.ageTo = 'End age must be after the start age.'
    if (!form.reason.trim()) e.reason = 'Tell the Super Admin how this helps your patients.'
    return e
  }

  const handleSubmit = (evt) => {
    evt.preventDefault()
    const e = validate()
    if (Object.keys(e).length) {
      setErrors(e)
      return
    }
    const newRequest = {
      id: Date.now(),
      name: form.name.trim(),
      focus: form.focus,
      ageFrom: Number(form.ageFrom),
      ageTo: Number(form.ageTo),
      submitted: todayLabel(),
      status: 'pending',
    }
    setRequests((list) => [newRequest, ...list])
    setForm(EMPTY_FORM)
    setErrors({})
    showToast('Request sent to the Super Admin')
    logActivity({
      role: 'Owner',
      user: user?.name || 'Owner',
      email: user?.email || '—',
      actionIcon: '🎮',
      action: 'Game Request',
      description: `Requested a new gamified activity: "${newRequest.name}" (${newRequest.focus}, ages ${newRequest.ageFrom}–${newRequest.ageTo})`,
      entity: 'Gamified Activities',
      status: 'Success',
    })
  }

  return (
    <OwnerPageShell
      user={user}
      onLogout={onLogout}
      title="Gamified Activities"
      subtitle="Track patient engagement with gamified exercises across all branches"
      menuItems={getOwnerMenuItems(betaTier)}
      beta
    >
      <div className="ogs-head">
        <div>
          <h2>Request a Game</h2>
          <p>Ask the Super Admin to build a new gamified activity for your clinic.</p>
        </div>
        <button type="button" className="ogs-new-btn" onClick={focusNewRequest}>
          <PlusIcon /> New Request
        </button>
      </div>

      <div className="ogs-stat-strip">
        <div className="ogs-stat">
          <span className="ogs-stat-num">{stats.pending}</span>
          <span className="ogs-stat-lbl">Pending Review</span>
        </div>
        <div className="ogs-stat">
          <span className="ogs-stat-num">{stats.dev}</span>
          <span className="ogs-stat-lbl">In Development</span>
        </div>
        <div className="ogs-stat">
          <span className="ogs-stat-num">{stats.approvedThisMonth}</span>
          <span className="ogs-stat-lbl">Approved This Month</span>
        </div>
        <div className="ogs-stat">
          <span className="ogs-stat-num">{stats.live}</span>
          <span className="ogs-stat-lbl">Live Games Added</span>
        </div>
      </div>

      <div className="ogs-grid">
        {/* My Requests */}
        <section className="ogs-card">
          <h3 className="ogs-card-title">My Requests</h3>
          <p className="ogs-card-sub">Track what you&apos;ve asked for and what the Super Admin says back</p>

          <div className="ogs-req-list">
            {requests.map((r) => {
              const meta = STATUS_META[r.status]
              return (
                <div key={r.id} className="ogs-req-row">
                  <span className={`ogs-req-dot ${meta.dot}`} />
                  <div className="ogs-req-main">
                    <div className="ogs-req-name">{r.name}</div>
                    <div className="ogs-req-meta">
                      {r.focus} · Ages {r.ageFrom}–{r.ageTo} · Submitted {r.submitted}
                    </div>
                  </div>
                  <span className={`ogs-req-pill ${meta.pill}`}>{meta.label}</span>
                </div>
              )
            })}
          </div>
        </section>

        {/* New Request form */}
        <section className="ogs-card">
          <h3 className="ogs-card-title">New Request</h3>
          <p className="ogs-card-sub">The Super Admin&apos;s team reviews every request within 3–5 business days</p>

          <form className="ogs-form" onSubmit={handleSubmit} noValidate>
            <div className="ogs-field">
              <label htmlFor="ogs-game-name">Game name or idea</label>
              <input
                id="ogs-game-name"
                type="text"
                placeholder="e.g. Underwater Word Hunt"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                className={errors.name ? 'ogs-field-error' : ''}
              />
              {errors.name && <span className="ogs-err-text">{errors.name}</span>}
            </div>

            <div className="ogs-field">
              <label htmlFor="ogs-focus">Skill focus</label>
              <select
                id="ogs-focus"
                value={form.focus}
                onChange={(e) => setField('focus', e.target.value)}
              >
                {SKILL_FOCUS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="ogs-row2">
              <div className="ogs-field">
                <label htmlFor="ogs-age-from">Age from</label>
                <input
                  id="ogs-age-from"
                  type="number"
                  min="1"
                  max="18"
                  placeholder="6"
                  value={form.ageFrom}
                  onChange={(e) => setField('ageFrom', e.target.value)}
                  className={errors.ageFrom ? 'ogs-field-error' : ''}
                />
                {errors.ageFrom && <span className="ogs-err-text">{errors.ageFrom}</span>}
              </div>
              <div className="ogs-field">
                <label htmlFor="ogs-age-to">Age to</label>
                <input
                  id="ogs-age-to"
                  type="number"
                  min="1"
                  max="18"
                  placeholder="10"
                  value={form.ageTo}
                  onChange={(e) => setField('ageTo', e.target.value)}
                  className={errors.ageTo ? 'ogs-field-error' : ''}
                />
                {errors.ageTo && <span className="ogs-err-text">{errors.ageTo}</span>}
              </div>
            </div>

            <div className="ogs-field">
              <label>Priority</label>
              <div className="ogs-priority">
                {['low', 'medium', 'high'].map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`${p} ${form.priority === p ? 'active' : ''}`}
                    onClick={() => setField('priority', p)}
                  >
                    {p[0].toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="ogs-field">
              <label htmlFor="ogs-reason">Why this would help your patients</label>
              <textarea
                id="ogs-reason"
                placeholder="Tell the Super Admin what problem this game solves and which patients it's for."
                value={form.reason}
                onChange={(e) => setField('reason', e.target.value)}
                className={errors.reason ? 'ogs-field-error' : ''}
              />
              {errors.reason && <span className="ogs-err-text">{errors.reason}</span>}
            </div>

            <div className="ogs-field">
              <label htmlFor="ogs-reference">
                Reference or inspiration link <span className="ogs-optional">(optional)</span>
              </label>
              <input
                id="ogs-reference"
                type="url"
                placeholder="https://..."
                value={form.reference}
                onChange={(e) => setField('reference', e.target.value)}
              />
            </div>

            <button type="submit" className="ogs-submit">Send to Super Admin</button>
          </form>
        </section>
      </div>

      {toast && <div className="ogs-toast">{toast}</div>}
    </OwnerPageShell>
  )
}
