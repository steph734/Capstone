import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminPageShell from './AdminPageShell'
import { adminMenuItems } from './adminSidebarConfig'
import { initialGames, initialBadges, defaultPointRules } from './gamifiedLibraryData'
import { GameControllerIcon, InboxIcon, MedalIcon, StarIcon, PlusIcon, CloseIcon, CheckIcon, FileIcon } from './gamifiedIcons'
import './GamifiedLibraryDashboard.css'

const initialRequests = [
  {
    id: 1,
    refId: 'R-0012',
    initial: 'A',
    color: '#3b82f6',
    owner: '[Owner name]',
    branch: '[Branch A]',
    date: 'Sep 22',
    status: 'Pending',
    title: 'Color Sorting',
    description: 'Sort objects by color to build visual discrimination in younger patients.',
    type: 'Cognitive',
    level: 'Easy',
    forPatients: 'Children with Down syndrome',
    ageRange: '4-7 yrs',
    suggestedGameType: 'Sort & Place',
    neededBy: 'Within 1 month',
    ownerDescription: 'Sort objects by color to build visual discrimination in younger patients. Our therapists currently use printed color cards; a digital version would let patients practice at home between sessions.',
    therapyGoals: ['Recognize and name 4 basic colors', 'Improve pincer grasp when dragging', 'Follow a one-step instruction'],
    attachments: ['color-cards-reference.pdf', 'therapist-notes.docx'],
    requestedBy: { role: 'Clinic owner', email: '[owner email]', phone: '[phone]' },
    conversation: [
      { author: '[Owner name]', date: 'Sep 22', text: 'Request submitted. Happy to share more examples from our sessions if needed.' },
    ],
  },
  {
    id: 2,
    refId: 'R-0013',
    initial: 'B',
    color: '#f59e0b',
    owner: '[Owner name]',
    branch: '[Branch B]',
    date: 'Sep 21',
    status: 'Pending',
    title: 'Breath Balloon',
    description: 'Blow into the mic to inflate a balloon for breath-control practice.',
    type: 'Speech',
    level: 'Medium',
    forPatients: 'Children with speech-language delays',
    ageRange: '5-9 yrs',
    suggestedGameType: 'Breath & Blow',
    neededBy: 'Within 2 months',
    ownerDescription: 'Blow into the mic to inflate a balloon for breath-control practice. We currently use physical pinwheels; a digital game would help us track progress across sessions.',
    therapyGoals: ['Sustain breath for 3+ seconds', 'Control exhale strength', 'Track progress session over session'],
    attachments: ['breath-exercise-notes.docx'],
    requestedBy: { role: 'Clinic owner', email: '[owner email]', phone: '[phone]' },
    conversation: [
      { author: '[Owner name]', date: 'Sep 21', text: 'Request submitted. Let me know if you need audio samples.' },
    ],
  },
  {
    id: 3,
    refId: 'R-0014',
    initial: 'C',
    color: '#8b5cf6',
    owner: '[Owner name]',
    branch: '[Branch C]',
    date: 'Sep 19',
    status: 'Pending',
    title: 'Pinch & Place',
    description: 'Drag small items into slots to train fine-motor precision.',
    type: 'Occupational',
    level: 'Medium',
    forPatients: 'Children working on fine-motor precision',
    ageRange: '3-6 yrs',
    suggestedGameType: 'Drag & Drop',
    neededBy: 'Within 6 weeks',
    ownerDescription: 'Drag small items into slots to train fine-motor precision. Our OTs currently use physical pegboards; a digital version would let patients warm up before sessions.',
    therapyGoals: ['Improve pincer grasp accuracy', 'Build hand-eye coordination', 'Complete the task within a time goal'],
    attachments: ['pegboard-reference.pdf'],
    requestedBy: { role: 'Clinic owner', email: '[owner email]', phone: '[phone]' },
    conversation: [
      { author: '[Owner name]', date: 'Sep 19', text: 'Request submitted. Happy to hop on a call if useful.' },
    ],
  },
]

const THERAPY_TYPES = [
  { type: 'Cognitive', color: '#3b82f6' },
  { type: 'Speech', color: '#e46a4b' },
  { type: 'Physical', color: '#2c4a3e' },
  { type: 'Occupational', color: '#d8eae0' },
]

const TABS = ['Pending', 'Approved', 'Declined', 'All']

export default function GamifiedLibraryDashboardPage({ user, onLogout }) {
  const navigate = useNavigate()
  const [requests, setRequests] = useState(initialRequests)
  const [activeTab, setActiveTab] = useState('Pending')
  const [selectedRequestId, setSelectedRequestId] = useState(null)
  const [questionDraft, setQuestionDraft] = useState('')

  const stats = useMemo(() => {
    const live = initialGames.filter((game) => game.status === 'Published').length
    const draft = initialGames.filter((game) => game.status === 'Draft').length
    const pending = requests.filter((request) => request.status === 'Pending').length
    const activeBadges = initialBadges.filter((badge) => badge.status === 'Active').length
    return {
      totalGames: initialGames.length,
      live,
      draft,
      pending,
      activeBadges,
      pointRules: defaultPointRules.length,
    }
  }, [requests])

  const counts = useMemo(() => ({
    Pending: requests.filter((r) => r.status === 'Pending').length,
    Approved: requests.filter((r) => r.status === 'Approved').length,
    Declined: requests.filter((r) => r.status === 'Declined').length,
    All: requests.length,
  }), [requests])

  const visibleRequests = useMemo(() => {
    if (activeTab === 'All') return requests
    return requests.filter((request) => request.status === activeTab)
  }, [requests, activeTab])

  const gamesByType = useMemo(() => {
    const counted = THERAPY_TYPES.map(({ type, color }) => ({
      type,
      color,
      count: initialGames.filter((game) => game.type === type).length,
    }))
    const max = Math.max(1, ...counted.map((t) => t.count))
    return counted.map((t) => ({ ...t, percent: Math.round((t.count / max) * 100) }))
  }, [])

  const selectedRequest = useMemo(
    () => requests.find((request) => request.id === selectedRequestId) || null,
    [requests, selectedRequestId],
  )

  const updateStatus = (id, status) => {
    setRequests((current) => current.map((request) => (request.id === id ? { ...request, status } : request)))
  }

  const closeRequestModal = () => {
    setSelectedRequestId(null)
    setQuestionDraft('')
  }

  const sendQuestion = () => {
    const text = questionDraft.trim()
    if (!text || !selectedRequest) return
    setRequests((current) => current.map((request) => (
      request.id === selectedRequest.id
        ? { ...request, conversation: [...request.conversation, { author: 'You (Super Admin)', date: 'Just now', text }] }
        : request
    )))
    setQuestionDraft('')
  }

  return (
    <AdminPageShell
      user={user}
      onLogout={onLogout}
      title="Gamified Library"
      subtitle="Games, badges, and points that keep patients motivated"
      icon={<GameControllerIcon />}
      menuItems={adminMenuItems}
    >
      <div className="gl-hero">
        <h2>Library overview</h2>
        <p>Games, badges and points that keep patients motivated.</p>
      </div>

      <div className="admin-stats-grid">
        <section className="admin-stat-card">
          <div className="gl-stat-icon teal" aria-hidden="true"><GameControllerIcon /></div>
          <p className="admin-stat-label">Total games</p>
          <h3 className="admin-stat-value">{stats.totalGames}</h3>
          <p className="admin-stat-meta">{stats.live} live · {stats.draft} draft</p>
        </section>
        <section className="admin-stat-card">
          <div className="gl-stat-icon orange" aria-hidden="true"><InboxIcon /></div>
          <p className="admin-stat-label">Pending requests</p>
          <h3 className="admin-stat-value">{stats.pending}</h3>
          <p className="admin-stat-meta">From clinic owners</p>
        </section>
        <section className="admin-stat-card">
          <div className="gl-stat-icon purple" aria-hidden="true"><MedalIcon /></div>
          <p className="admin-stat-label">Active badges</p>
          <h3 className="admin-stat-value">{stats.activeBadges}</h3>
          <p className="admin-stat-meta">Visible to patients</p>
        </section>
        <section className="admin-stat-card">
          <div className="gl-stat-icon blue" aria-hidden="true"><StarIcon /></div>
          <p className="admin-stat-label">Point rules</p>
          <h3 className="admin-stat-value">{stats.pointRules}</h3>
          <p className="admin-stat-meta">Configured actions</p>
        </section>
      </div>

      <div className="gl-banner">
        <div className="gl-banner-header">
          <div className="gl-banner-title">
            <h3>Game requests from owners</h3>
            <span className="gl-pending-pill">{counts.Pending} pending</span>
          </div>
          <div className="gl-tab-row">
            {TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                className={`gl-tab ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="gl-request-grid">
          {visibleRequests.length === 0 && (
            <div className="gl-request-empty">No {activeTab.toLowerCase()} requests.</div>
          )}
          {visibleRequests.map((request) => (
            <div key={request.id} className="gl-request-card">
              <div className="gl-request-head">
                <div className="gl-request-who">
                  <span className="gl-avatar" style={{ background: request.color }}>{request.initial}</span>
                  <div>
                    <p>{request.owner}</p>
                    <span>{request.branch} · {request.date}</span>
                  </div>
                </div>
                <span className={`gl-status-pill ${request.status}`}>{request.status}</span>
              </div>

              <div className="gl-request-body">
                <h4>{request.title}</h4>
                <p>{request.description}</p>
              </div>

              <div className="admin-button-row">
                <span className="admin-pill gray">{request.type}</span>
                <span className="admin-pill yellow">{request.level}</span>
              </div>

              <button type="button" className="gl-request-link" onClick={() => setSelectedRequestId(request.id)}>
                View full request ›
              </button>

              {request.status === 'Pending' ? (
                <div className="gl-request-actions">
                  <button className="admin-btn-danger" type="button" onClick={() => updateStatus(request.id, 'Declined')}>
                    Decline
                  </button>
                  <button className="admin-btn" type="button" onClick={() => updateStatus(request.id, 'Approved')}>
                    Approve & Build
                  </button>
                </div>
              ) : (
                <div className="gl-request-actions">
                  <button className="admin-btn-secondary" type="button" onClick={() => updateStatus(request.id, 'Pending')}>
                    Move back to Pending
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="gl-bottom-grid">
        <div className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <h3>Request summary</h3>
            </div>
            <button className="admin-btn-secondary" type="button" onClick={() => navigate('/admin/games-library/games')}>
              Open in Games
            </button>
          </div>

          <div className="gl-summary-tiles">
            <div className="gl-summary-tile pending">
              <strong>{counts.Pending}</strong>
              <span>Pending</span>
            </div>
            <div className="gl-summary-tile approved">
              <strong>{counts.Approved}</strong>
              <span>Approved</span>
            </div>
            <div className="gl-summary-tile declined">
              <strong>{counts.Declined}</strong>
              <span>Declined</span>
            </div>
          </div>

          <p className="gl-summary-note">
            Approving a request opens it in the game editor with the owner's details filled in. The owner is
            notified when the game is published or declined.
          </p>
        </div>

        <div className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <h3>Games by therapy type</h3>
            </div>
          </div>

          <div className="gl-bar-list">
            {gamesByType.map((entry) => (
              <div key={entry.type}>
                <div className="gl-bar-row-label">
                  <span>{entry.type}</span>
                  <span>{entry.count}</span>
                </div>
                <div className="gl-bar-track">
                  <div className="gl-bar-fill" style={{ width: `${entry.percent}%`, background: entry.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="gl-actions-row">
        <button type="button" className="gl-action-card gl-action-primary" onClick={() => navigate('/admin/games-library/games')}>
          <span className="gl-action-icon" aria-hidden="true"><PlusIcon /></span>
          <div>
            <h4>Build a new game</h4>
            <p>Open the creation workspace</p>
          </div>
        </button>
        <button type="button" className="gl-action-card gl-action-secondary" onClick={() => navigate('/admin/games-library/badges')}>
          <span className="gl-action-icon" aria-hidden="true"><MedalIcon /></span>
          <div>
            <h4>Manage badges</h4>
            <p>Create or edit rewards</p>
          </div>
        </button>
        <button type="button" className="gl-action-card gl-action-secondary" onClick={() => navigate('/admin/games-library/stats')}>
          <span className="gl-action-icon" aria-hidden="true"><StarIcon /></span>
          <div>
            <h4>Tune point rules</h4>
            <p>Rewards, multipliers, levels</p>
          </div>
        </button>
      </div>

      {selectedRequest && (
        <div className="admin-modal-backdrop" onClick={closeRequestModal}>
          <div className="gl-req-modal" onClick={(event) => event.stopPropagation()}>
            <div className="gl-req-modal-topbar">
              <div className="gl-req-modal-eyebrow">
                <span className="gl-avatar-sm" style={{ background: selectedRequest.color }}>{selectedRequest.initial}</span>
                <span className="gl-req-eyebrow-text">REQUEST #{selectedRequest.refId}</span>
                <span className={`gl-status-pill ${selectedRequest.status}`}>{selectedRequest.status}</span>
              </div>
              <button className="gl-req-modal-close" onClick={closeRequestModal} aria-label="Close">
                <CloseIcon />
              </button>
            </div>

            <h2 className="gl-req-modal-title">{selectedRequest.title}</h2>
            <div className="admin-button-row gl-req-modal-tags">
              <span className="admin-pill gray">{selectedRequest.type}</span>
              <span className="admin-pill yellow">{selectedRequest.level}</span>
              <span className="admin-pill gray">Submitted {selectedRequest.date}</span>
            </div>

            <div className="gl-req-info-grid">
              <div className="gl-req-info-tile">
                <span>For patients</span>
                <p>{selectedRequest.forPatients}</p>
              </div>
              <div className="gl-req-info-tile">
                <span>Age range</span>
                <p>{selectedRequest.ageRange}</p>
              </div>
              <div className="gl-req-info-tile">
                <span>Suggested game type</span>
                <p>{selectedRequest.suggestedGameType}</p>
              </div>
              <div className="gl-req-info-tile">
                <span>Needed by</span>
                <p>{selectedRequest.neededBy}</p>
              </div>
            </div>

            <div className="gl-req-columns">
              <div>
                <div className="gl-req-section">
                  <h4>Owner's description</h4>
                  <p>{selectedRequest.ownerDescription}</p>
                </div>

                <div className="gl-req-section">
                  <h4>Therapy goals</h4>
                  <ul className="gl-req-goals">
                    {selectedRequest.therapyGoals.map((goal) => (
                      <li key={goal}>
                        <CheckIcon size={16} />
                        <span>{goal}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="gl-req-section">
                  <h4>Attachments</h4>
                  <div className="gl-req-attachments">
                    {selectedRequest.attachments.map((file) => (
                      <span key={file} className="gl-req-attachment-chip">
                        <FileIcon size={14} />
                        {file}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <div className="gl-req-section">
                  <h4>Requested by</h4>
                  <p className="gl-req-owner-name">{selectedRequest.owner}</p>
                  <p className="gl-req-owner-meta">{selectedRequest.requestedBy.role} · {selectedRequest.branch}</p>
                  <p className="gl-req-owner-meta">{selectedRequest.requestedBy.email} · {selectedRequest.requestedBy.phone}</p>
                </div>

                <div className="gl-req-section">
                  <h4>Conversation</h4>
                  <div className="gl-req-conversation">
                    {selectedRequest.conversation.map((message, index) => (
                      <div key={index} className="gl-req-message">
                        <p className="gl-req-message-meta"><strong>{message.author}</strong> · {message.date}</p>
                        <p>{message.text}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="gl-req-section gl-req-ask">
                  <h4>Ask the owner a question</h4>
                  <textarea
                    value={questionDraft}
                    onChange={(event) => setQuestionDraft(event.target.value)}
                    placeholder="e.g. Which colors do your patients already know?"
                  />
                  <button className="admin-btn" type="button" onClick={sendQuestion}>Send</button>
                </div>
              </div>
            </div>

            <div className="gl-req-footer">
              <button className="admin-btn-secondary" type="button" onClick={closeRequestModal}>Close</button>
              {selectedRequest.status === 'Pending' && (
                <div className="gl-req-footer-actions">
                  <button
                    className="admin-btn-danger"
                    type="button"
                    onClick={() => { updateStatus(selectedRequest.id, 'Declined'); closeRequestModal() }}
                  >
                    Decline
                  </button>
                  <button
                    className="admin-btn"
                    type="button"
                    onClick={() => { updateStatus(selectedRequest.id, 'Approved'); closeRequestModal() }}
                  >
                    Approve & Build
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminPageShell>
  )
}
