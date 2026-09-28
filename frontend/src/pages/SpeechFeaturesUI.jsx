import { useState, useRef, useEffect, useMemo } from 'react'
import { jsPDF } from 'jspdf'
import { saveAudioBlob, getAudioBlob, deleteAudioBlob, newAudioKey } from '../utils/recordingsDb'
import { speakPao, stopPaoVoice } from '../utils/paoVoice'
import PandaMascot from './games/PandaMascot'
import {
  MicIcon as MicIconOutline, VolumeIcon, SwapIcon, FlaskIcon, DotIcon as DotIconOutline,
  MessageIcon, PenIcon, PlusIcon, ClockIcon, RepeatIcon, TurtleIcon, SaveIcon, ArrowLeftIcon,
} from '../components/icons/SpeechIcons'

// ─── "Talk to {patient}" — phrase groups, picture cues ────────────────────────

const PHRASE_GROUPS = [
  { key: 'start', label: 'Start', bg: '#e0f2fe', fg: '#0369a1', phrases: ['Hello {name}!', "Let's begin", 'Sit down please'] },
  { key: 'instructions', label: 'Instructions', bg: '#f5f3ff', fg: '#6d28d9', phrases: ['Look at me', 'Listen', 'Your turn', 'Say it again'] },
  { key: 'praise', label: 'Praise', bg: '#ecfdf5', fg: '#047857', phrases: ['Good job!', 'Great trying!', "I'm proud of you"] },
  { key: 'end', label: 'End', bg: '#fff7ed', fg: '#9a3412', phrases: ['Break time', 'All done', 'See you next time'] },
]

const CUE_MAP = {
  look: { emoji: '👀', label: 'Look' },
  listen: { emoji: '👂', label: 'Listen' },
  turn: { emoji: '🗣️', label: 'Your turn' },
  wait: { emoji: '✋', label: 'Wait' },
  great: { emoji: '⭐', label: 'Great job' },
}

function suggestCue(text) {
  const t = String(text || '').toLowerCase()
  if (t.includes('look')) return 'look'
  if (t.includes('listen')) return 'listen'
  if (t.includes('your turn') || t.includes('say')) return 'turn'
  if (t.includes('stop') || t.includes('wait')) return 'wait'
  if (t.includes('good') || t.includes('great') || t.includes('proud')) return 'great'
  return null
}

function fillName(phrase, firstName) {
  return phrase.replace(/\{name\}/g, firstName)
}

const PATIENT_AVATAR_PALETTE = ['#7c3aed', '#2563eb', '#db2777', '#ea580c', '#059669', '#0891b2', '#9333ea', '#dc2626']

function patientAvatarColor(id) {
  const s = String(id || '')
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return PATIENT_AVATAR_PALETTE[h % PATIENT_AVATAR_PALETTE.length]
}

function patientInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function MicIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="white">
      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
    </svg>
  )
}

function SpeakerIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="white">
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77 0-4.28-2.99-7.86-7-8.77z"/>
    </svg>
  )
}

function StopIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="white">
      <rect x="6" y="6" width="12" height="12" rx="2"/>
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z"/>
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1zM18 7H6v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7z"/>
    </svg>
  )
}

function FolderIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
    </svg>
  )
}

function BigCheckIcon() {
  return (
    <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5"/>
    </svg>
  )
}

// ─── Waveform ─────────────────────────────────────────────────────────────────

const BAR_COLORS = [
  '#a78bfa','#818cf8','#60a5fa','#34d399','#fbbf24',
  '#f87171','#c084fc','#38bdf8','#4ade80','#fb923c',
  '#a78bfa','#818cf8','#60a5fa','#34d399','#fbbf24',
  '#f87171','#c084fc','#38bdf8','#4ade80','#fb923c',
  '#a78bfa','#818cf8','#60a5fa','#34d399','#fbbf24',
  '#f87171','#c084fc','#38bdf8',
]

function Waveform({ active }) {
  return (
    <div className="csf-waveform">
      {Array.from({ length: 28 }).map((_, i) => (
        <div
          key={i}
          className={`csf-bar ${active ? 'csf-bar-active' : ''}`}
          style={{ '--bar-color': BAR_COLORS[i], animationDelay: `${(i % 7) * 0.11}s` }}
        />
      ))}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(s) {
  const sec = Math.max(0, Math.floor(s || 0))
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`
}

function formatDateTime(date) {
  return (
    date.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
    + ' · '
    + date.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true })
  )
}

function statTimeParts(date) {
  return {
    time: date.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true }),
    date: date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase(),
  }
}

function wordCount(text) {
  const t = (text || '').trim()
  return t ? t.split(/\s+/).length : 0
}

function defaultSessionTitle(date) {
  return `Session – ${date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}`
}

// ─── Recording Saved Modal ────────────────────────────────────────────────────

function RecordingSavedModal({ recording, patients, onSaveMeta, onRecordAnother, onOpenRecordings }) {
  const [title, setTitle] = useState(recording.title)
  const [patientId, setPatientId] = useState(recording.patientId || '')
  const savedRef = useRef({ title: recording.title, patientId: recording.patientId || '' })

  // Auto-save the title/patient edits, debounced — no explicit save button.
  useEffect(() => {
    const t = setTimeout(() => {
      if (title !== savedRef.current.title || patientId !== savedRef.current.patientId) {
        savedRef.current = { title, patientId }
        onSaveMeta({ title, patientId })
      }
    }, 500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, patientId])

  const created = new Date(recording.createdAt)
  const { time, date } = statTimeParts(created)
  const hasTranscript = !!recording.transcript?.trim()

  return (
    <div className="rec-modal-backdrop">
      <div className="rsm-modal">
        <div className="rsm-header">
          <span className="rsm-sparkle rsm-sparkle-l">⭐</span>
          <span className="rsm-sparkle rsm-sparkle-r">✨</span>
          <div className="rsm-check-circle"><BigCheckIcon /></div>
          <h2 className="rsm-title">Recording saved!</h2>
          <p className="rsm-subtitle">
            {hasTranscript ? 'Your therapy session was recorded successfully. 🎉' : '🤔 No speech detected — audio only'}
          </p>
        </div>

        <div className="rsm-stats-card">
          <div className="rsm-stat"><strong>{formatTime(recording.durationSec)}</strong><span>DURATION</span></div>
          <div className="rsm-stat"><strong>{recording.wordCount}</strong><span>WORDS</span></div>
          <div className="rsm-stat"><strong>{time}</strong><span>{date}</span></div>
        </div>

        <div className="rsm-body">
          <div className="rsm-stored-box">
            <span className="rsm-stored-icon">🗂️</span>
            <div>
              <strong>Stored in your Recordings folder</strong>
              <p>Full recording + transcript saved · {hasTranscript ? 'Summary is being written' : 'No summary to write'}</p>
            </div>
          </div>

          <div className="rsm-fields">
            <label className="rsm-field">
              <span>Session title</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            {patients.length > 0 && (
              <label className="rsm-field">
                <span>Patient</span>
                <select value={patientId} onChange={(e) => setPatientId(e.target.value)}>
                  <option value="">— None —</option>
                  {patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
            )}
          </div>

          {hasTranscript && (
            <div className={`rsm-status rsm-status-${recording.summaryStatus}`}>
              {recording.summaryStatus === 'pending' && (
                <><span className="rsm-dots"><span /><span /><span /></span> ✨ Creating the session summary…</>
              )}
              {recording.summaryStatus === 'ready' && '✅ Summary ready'}
              {recording.summaryStatus === 'failed' && '⚠️ Summary unavailable — full recording is saved'}
            </div>
          )}

          <div className="rsm-actions">
            <button className="rsm-btn-secondary" onClick={onRecordAnother}>Record another</button>
            <button className="rsm-btn-primary" onClick={onOpenRecordings}>🗂️ Open Recordings</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Full Recording card (Full Recording tab) ────────────────────────────────

function FullRecordingCard({ rec, index, total, cardRef, onDelete, onViewSummary }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [curTime, setCurTime] = useState(0)
  const [rate, setRate] = useState(1)
  const durSec = rec.durationSec || 0

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) audio.pause()
    else audio.play().catch(() => {})
  }
  const seek = (e) => {
    const audio = audioRef.current
    if (!audio || !durSec) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    audio.currentTime = pct * durSec
    setCurTime(audio.currentTime)
  }
  const cycleRate = () => {
    const next = rate === 1 ? 1.5 : rate === 1.5 ? 0.75 : 1
    setRate(next)
    if (audioRef.current) audioRef.current.playbackRate = next
  }

  const activeSegIdx = rec.segments?.length
    ? rec.segments.reduce((best, s, i) => (s.t <= curTime ? i : best), -1)
    : -1

  const copyTranscript = () => navigator.clipboard?.writeText(rec.transcript || '').catch(() => {})
  const downloadAudio = () => {
    if (!rec.audioUrl) return
    const a = document.createElement('a')
    a.href = rec.audioUrl
    a.download = `${rec.title || 'recording'}.webm`
    a.click()
  }

  return (
    <div className="rec-card-2" ref={cardRef} id={`rec-full-${rec.id}`}>
      <div className="rec-card-2-top">
        <span className="rec-index-badge">#{total - index}</span>
        <div className="rec-card-2-heading">
          <h4>{rec.title}</h4>
          {rec.patientName && <span className="rec-patient-pill">👤 {rec.patientName}</span>}
        </div>
        <button className="rec-delete-btn" onClick={() => onDelete(rec)} title="Delete"><TrashIcon /></button>
      </div>
      <div className="rec-card-2-meta">🗓️ {formatDateTime(new Date(rec.createdAt))} · ⏱️ {formatTime(durSec)} · 📝 {rec.wordCount} words</div>

      {rec.audioUrl ? (
        <div className="rec-player">
          <audio
            ref={audioRef}
            src={rec.audioUrl}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onTimeUpdate={(e) => setCurTime(e.currentTarget.currentTime)}
            onEnded={() => setPlaying(false)}
          />
          <button className="rec-player-btn" onClick={togglePlay}>{playing ? <PauseIcon /> : <PlayIcon />}</button>
          <div className="rec-player-bar" onClick={seek}>
            <div className="rec-player-bar-fill" style={{ width: durSec ? `${Math.min(100, (curTime / durSec) * 100)}%` : '0%' }} />
          </div>
          <span className="rec-player-time">{formatTime(curTime)} / {formatTime(durSec)}</span>
          <button className="rec-player-rate" onClick={cycleRate}>{rate}×</button>
        </div>
      ) : (
        <p className="rec-no-transcript">Audio unavailable on this device</p>
      )}

      <div className="rec-transcript-box">
        {rec.segments?.length ? (
          rec.segments.map((s, i) => (
            <p key={i} className={`rec-transcript-line ${i === activeSegIdx ? 'rec-transcript-line-active' : ''}`}>
              <span className="rec-transcript-ts">{formatTime(s.t)}</span> {s.text}
            </p>
          ))
        ) : rec.transcript ? (
          <p className="rec-transcript-line">{rec.transcript}</p>
        ) : (
          <p className="rec-no-transcript">🤔 No speech detected</p>
        )}
      </div>

      <div className="rec-card-actions">
        <button className="rec-action-btn" onClick={onViewSummary}>✨ View summary</button>
        <button className="rec-action-btn" onClick={copyTranscript}>📋 Copy transcript</button>
        <button className="rec-action-btn" onClick={downloadAudio} disabled={!rec.audioUrl}>⬇ Download audio</button>
      </div>
    </div>
  )
}

// ─── Summarized card (Summarized tab) ────────────────────────────────────────

function exportSummaryPdf(rec) {
  const doc = new jsPDF()
  let y = 20
  doc.setFontSize(16); doc.text(rec.title || 'Session', 14, y); y += 9
  doc.setFontSize(10); doc.setTextColor(90)
  if (rec.patientName) { doc.text(`Patient: ${rec.patientName}`, 14, y); y += 6 }
  doc.text(`Date: ${formatDateTime(new Date(rec.createdAt))}`, 14, y); y += 6
  doc.text(`Duration: ${formatTime(rec.durationSec)}`, 14, y); y += 10
  doc.setTextColor(20)

  const section = (label, body) => {
    doc.setFontSize(12); doc.setFont(undefined, 'bold'); doc.text(label, 14, y); y += 6
    doc.setFont(undefined, 'normal'); doc.setFontSize(10)
    body(); y += 6
  }

  if (rec.summary) {
    section('Session Overview', () => {
      const lines = doc.splitTextToSize(rec.summary.overview || '—', 180)
      doc.text(lines, 14, y); y += lines.length * 5
    })
    section('Goals Worked On', () => {
      (rec.summary.goals.length ? rec.summary.goals : ['—']).forEach((g) => { doc.text(`• ${g}`, 14, y); y += 5 })
    })
    section('Progress', () => {
      (rec.summary.progress.length ? rec.summary.progress : ['—']).forEach((p) => { doc.text(`• ${p}`, 14, y); y += 5 })
    })
    section('Next Steps', () => {
      (rec.summary.nextSteps.length ? rec.summary.nextSteps : ['—']).forEach((s) => { doc.text(`• ${s}`, 14, y); y += 5 })
    })
  }
  doc.save(`${(rec.title || 'session').replace(/[^\w\- ]+/g, '')}.pdf`)
}

function SummarizedCard({ rec, index, total, cardRef, onDelete, onViewFull, onRetry, onPlay, isPlaying }) {
  const copyToNotes = () => {
    if (!rec.summary) return
    const text = [
      rec.title,
      '',
      'Overview:', rec.summary.overview,
      '', 'Goals:', ...rec.summary.goals.map((g) => `- ${g}`),
      '', 'Progress:', ...rec.summary.progress.map((p) => `- ${p}`),
      '', 'Next steps:', ...rec.summary.nextSteps.map((s) => `- ${s}`),
    ].join('\n')
    navigator.clipboard?.writeText(text).catch(() => {})
  }

  return (
    <div className="rec-card-2" ref={cardRef} id={`rec-sum-${rec.id}`}>
      <div className="rec-card-2-top">
        <span className="rec-index-badge">#{total - index}</span>
        <div className="rec-card-2-heading">
          <h4>{rec.title}</h4>
          {rec.patientName && <span className="rec-patient-pill">👤 {rec.patientName}</span>}
          {rec.summaryStatus === 'ready' && <span className="rec-ai-pill">✨ AI summary</span>}
        </div>
        <button className="rec-delete-btn" onClick={() => onDelete(rec)} title="Delete"><TrashIcon /></button>
      </div>
      <div className="rec-card-2-meta">🗓️ {formatDateTime(new Date(rec.createdAt))} · ⏱️ {formatTime(rec.durationSec)} · 📝 {rec.wordCount} words</div>

      {rec.summaryStatus === 'ready' && rec.summary && (
        <div className="rec-summary-grid">
          <div className="rec-summary-box rec-summary-overview">
            <span className="rec-summary-label">SESSION OVERVIEW</span>
            <p>{rec.summary.overview}</p>
          </div>
          <div className="rec-summary-side">
            <div className="rec-summary-box rec-summary-goals">
              <span className="rec-summary-label">GOALS WORKED ON</span>
              <ul>{rec.summary.goals.map((g, i) => <li key={i}>{g}</li>)}</ul>
            </div>
            <div className="rec-summary-box rec-summary-next">
              <span className="rec-summary-label">NEXT STEPS</span>
              <ul>{rec.summary.nextSteps.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </div>
          </div>
        </div>
      )}

      {rec.summaryStatus === 'pending' && (
        <div className="rec-summary-skeleton">
          <div className="rec-shimmer" /><div className="rec-shimmer" /><div className="rec-shimmer" style={{ width: '60%' }} />
          <p>✨ Creating summary…</p>
        </div>
      )}

      {rec.summaryStatus === 'failed' && (
        <div className="rec-summary-failed">
          <p>⚠️ Summary unavailable — full recording is saved</p>
          <button className="rec-retry-btn" onClick={() => onRetry(rec.id)}>↻ Try again</button>
        </div>
      )}

      {rec.summaryStatus === 'none' && (
        <p className="rec-no-transcript">🤔 No speech detected — nothing to summarize</p>
      )}

      <div className="rec-card-actions">
        <button className="rec-action-btn" onClick={() => onPlay(rec)}>{isPlaying ? '⏸ Pause' : '▶ Play'}</button>
        <button className="rec-action-btn" onClick={() => onViewFull(rec.id)}>📄 View full recording</button>
        <button className="rec-action-btn" onClick={copyToNotes} disabled={!rec.summary}>📋 Copy to Notes</button>
        <button className="rec-action-btn" onClick={() => exportSummaryPdf(rec)} disabled={!rec.summary}>⬇ Export PDF</button>
      </div>
    </div>
  )
}

// ─── Recordings Modal (Summarized / Full Recording tabs) ────────────────────

const RECORDINGS_TAB_KEY = 'csf_recordings_tab'

function RecordingsModal({ recordings, patients, playingId, onPlay, onDelete, onClearAll, onRetrySummary, onClose, initialTab, currentPatient }) {
  const [tab, setTab] = useState(() => {
    if (initialTab) return initialTab
    try { return localStorage.getItem(RECORDINGS_TAB_KEY) || 'summarized' } catch { return 'summarized' }
  })
  const [search, setSearch] = useState('')
  const [patientFilter, setPatientFilter] = useState('all')
  const [sort, setSort] = useState('newest')
  const [scope, setScope] = useState(currentPatient ? 'this' : 'all')

  useEffect(() => { try { localStorage.setItem(RECORDINGS_TAB_KEY, tab) } catch { /* ignore */ } }, [tab])

  const handleBackdrop = (e) => { if (e.target === e.currentTarget) onClose() }

  const filtered = useMemo(() => {
    let list = recordings.filter((r) => {
      if (currentPatient && scope === 'this' && r.patientId !== currentPatient.id) return false
      if (patientFilter !== 'all' && r.patientId !== patientFilter) return false
      if (search.trim()) {
        const q = search.trim().toLowerCase()
        return (r.title || '').toLowerCase().includes(q)
          || (r.patientName || '').toLowerCase().includes(q)
          || (r.transcript || '').toLowerCase().includes(q)
      }
      return true
    })
    list = [...list].sort((a, b) => {
      const diff = new Date(b.createdAt) - new Date(a.createdAt)
      return sort === 'newest' ? diff : -diff
    })
    return list
  }, [recordings, search, patientFilter, sort, scope, currentPatient])

  const jumpTo = (id, targetTab) => {
    setTab(targetTab)
    setTimeout(() => {
      const el = document.getElementById(`rec-${targetTab === 'full' ? 'full' : 'sum'}-${id}`)
      if (!el) return
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('rec-card-flash')
      setTimeout(() => el.classList.remove('rec-card-flash'), 1200)
    }, 60)
  }

  return (
    <div className="rec-modal-backdrop" onClick={handleBackdrop}>
      <div className="rec-modal rec-modal-wide">
        <div className="rec-modal-header">
          <div className="rec-modal-title">
            🗂️ My Recordings
            <span className="rec-count-badge">{recordings.length}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {recordings.length > 0 && (
              <button className="rec-clear-all-btn" onClick={onClearAll}>🗑️ Clear All</button>
            )}
            <button className="rec-modal-close" onClick={onClose}><CloseIcon /></button>
          </div>
        </div>

        <div className="rec-tabs-row">
          <button className={`rec-tab-pill ${tab === 'summarized' ? 'rec-tab-pill-active' : ''}`} onClick={() => setTab('summarized')}>
            <span className="rec-tab-pill-title">✨ Summarized</span>
            <span className="rec-tab-pill-sub">Key points, goals &amp; next steps</span>
          </button>
          <button className={`rec-tab-pill ${tab === 'full' ? 'rec-tab-pill-active' : ''}`} onClick={() => setTab('full')}>
            <span className="rec-tab-pill-title">📄 Full Recording</span>
            <span className="rec-tab-pill-sub">Audio + complete transcript</span>
          </button>
        </div>

        {currentPatient && (
          <div className="rec-scope-row">
            <button className={`rec-scope-pill ${scope === 'this' ? 'rec-scope-pill-active' : ''}`} onClick={() => setScope('this')}>
              This patient · {currentPatient.name}
            </button>
            <button className={`rec-scope-pill ${scope === 'all' ? 'rec-scope-pill-active' : ''}`} onClick={() => setScope('all')}>
              All patients
            </button>
          </div>
        )}

        <div className="rec-toolbar">
          <input className="rec-search" placeholder="🔍 Search sessions or patients..." value={search} onChange={(e) => setSearch(e.target.value)} />
          {(!currentPatient || scope === 'all') && (
            <select className="rec-toolbar-select" value={patientFilter} onChange={(e) => setPatientFilter(e.target.value)}>
              <option value="all">👤 All patients</option>
              {patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <select className="rec-toolbar-select" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="newest">🗓️ Newest first</option>
            <option value="oldest">🗓️ Oldest first</option>
          </select>
        </div>

        <div className="rec-modal-body">
          {filtered.length === 0 ? (
            <div className="rec-empty">
              <span className="rec-empty-icon">{tab === 'summarized' ? '✨' : '🎙️'}</span>
              <p>
                {tab === 'summarized'
                  ? 'No summaries yet — record a session and Pao will summarise it!'
                  : <>No recordings yet!<br />Tap the mic to make your first recording.</>}
              </p>
            </div>
          ) : (
            <div className="rec-list">
              {filtered.map((rec, idx) => (
                tab === 'summarized' ? (
                  <SummarizedCard
                    key={rec.id} rec={rec} index={idx} total={filtered.length}
                    cardRef={undefined}
                    onDelete={onDelete} onViewFull={(id) => jumpTo(id, 'full')} onRetry={onRetrySummary}
                    onPlay={onPlay} isPlaying={playingId === rec.id}
                  />
                ) : (
                  <FullRecordingCard
                    key={rec.id} rec={rec} index={idx} total={filtered.length}
                    cardRef={undefined}
                    onDelete={onDelete} onViewSummary={() => jumpTo(rec.id, 'summarized')}
                  />
                )
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── TTS History Modal ────────────────────────────────────────────────────────

function TtsHistoryModal({ history, activeId, onPlay, onReuse, onDelete, onClearAll, onClose, currentPatient }) {
  const handleBackdrop = (e) => { if (e.target === e.currentTarget) onClose() }
  const [scope, setScope] = useState(currentPatient ? 'this' : 'all')
  const visible = currentPatient && scope === 'this' ? history.filter((item) => item.patientId === currentPatient.id) : history

  return (
    <div className="rec-modal-backdrop" onClick={handleBackdrop}>
      <div className="rec-modal">
        <div className="rec-modal-header" style={{ background: 'linear-gradient(135deg,#059669,#0d9488)' }}>
          <div className="rec-modal-title">
            🗂️ Speech History
            <span className="rec-count-badge">{visible.length}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {history.length > 0 && (
              <button className="rec-clear-all-btn" onClick={onClearAll}>🗑️ Clear All</button>
            )}
            <button className="rec-modal-close" onClick={onClose}><CloseIcon /></button>
          </div>
        </div>

        {currentPatient && (
          <div className="rec-scope-row" style={{ padding: '14px 24px 0' }}>
            <button className={`rec-scope-pill ${scope === 'this' ? 'rec-scope-pill-active' : ''}`} style={scope === 'this' ? { background: 'linear-gradient(135deg,#059669,#0d9488)' } : undefined} onClick={() => setScope('this')}>
              This patient · {currentPatient.name}
            </button>
            <button className={`rec-scope-pill ${scope === 'all' ? 'rec-scope-pill-active' : ''}`} style={scope === 'all' ? { background: 'linear-gradient(135deg,#059669,#0d9488)' } : undefined} onClick={() => setScope('all')}>
              All patients
            </button>
          </div>
        )}

        <div className="rec-modal-body">
          {visible.length === 0 ? (
            <div className="rec-empty">
              <span className="rec-empty-icon">🔊</span>
              <p>No saved speech yet!<br />Tap the speaker to save your first one.</p>
            </div>
          ) : (
            <div className="rec-list">
              {visible.map((item, idx) => {
                const isPlaying = activeId === item.id
                return (
                  <div key={item.id} className="rec-card">
                    <div className="rec-card-top">
                      <div className="rec-index-badge" style={{ background: 'linear-gradient(135deg,#059669,#0d9488)' }}>
                        #{visible.length - idx}
                      </div>
                      <div className="rec-meta">
                        <span className="rec-date">🗓️ {formatDateTime(item.date)}{item.patientName ? ` · 👤 ${item.patientName}` : ''}</span>
                        <span className="rec-duration">
                          {item.rate <= 0.8 ? '🐢 Slow' : '🐇 Normal'}
                          {item.cue ? ` · ${CUE_MAP[item.cue]?.emoji || ''} ${CUE_MAP[item.cue]?.label || ''}` : ''}
                        </span>
                      </div>
                      <button className="rec-delete-btn" onClick={() => onDelete(item.id)} title="Delete">
                        <TrashIcon />
                      </button>
                    </div>

                    <div className="rec-transcript">
                      <span className="rec-transcript-label" style={{ color: '#0d9488' }}>💬 Text</span>
                      <p className="rec-transcript-text">"{item.text}"</p>
                    </div>

                    <div className="rec-audio-row">
                      <button
                        className={`rec-play-btn ${isPlaying ? 'rec-play-btn-active' : ''}`}
                        style={!isPlaying ? { background: 'linear-gradient(135deg,#059669,#0d9488)', boxShadow: '0 4px 12px rgba(5,150,105,0.25)' } : undefined}
                        onClick={() => onPlay(item)}
                      >
                        {isPlaying ? <PauseIcon /> : <PlayIcon />}
                        <span>{isPlaying ? 'Stop' : 'Play Again'}</span>
                      </button>
                      <button className="rec-reuse-btn" onClick={() => onReuse(item)}>✏️ Reuse</button>
                      {isPlaying && (
                        <div className="rec-playing-indicator">
                          <span className="rec-dot" /><span className="rec-dot" /><span className="rec-dot" />
                          <span style={{ marginLeft: 6, fontSize: 12, color: '#0d9488', fontWeight: 700 }}>Speaking...</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Talk to {patient} — therapist screen ────────────────────────────────────

function TalkTherapistView({
  toolsLocked, patientFirstName, customPhrases, onPhraseTap,
  addingPhrase, setAddingPhrase, newPhraseGroup, setNewPhraseGroup, newPhraseText, setNewPhraseText,
  onAddCustomPhrase, onRemoveCustomPhrase,
  messageText, setMessageText, onSayIt,
  speed, setSpeed, repeat, setRepeat,
  cueKey, onSetCue,
  sessionLog, sessionStart, onReplayLog, onCopyToNotes,
  onOpenHistory, historyCount, ttsError, toast,
}) {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSayIt() }
  }

  return (
    <div className="talk-view">
      <div className="talk-hero">
        <div className="talk-hero-text">
          <h2><MessageIcon size={22} /> Talk to {patientFirstName}</h2>
          <p>Type a message — Pao says it out loud</p>
        </div>
        <button className="talk-history-btn" onClick={onOpenHistory}>
          <ClockIcon size={16} /><span>History</span>
          {historyCount > 0 && <span className="rec-trigger-badge">{historyCount}</span>}
        </button>
      </div>

      <div className="talk-body">
        <div className="talk-columns">
          <div className="talk-col-left">
            {PHRASE_GROUPS.map((group) => (
              <div className="talk-phrase-group" key={group.key}>
                <div className="talk-phrase-label" style={{ color: group.fg }}><MessageIcon size={13} />{group.label.toUpperCase()}</div>
                <div className="talk-phrase-row">
                  {group.phrases.map((p) => (
                    <button key={p} className="talk-phrase-pill" style={{ background: group.bg, color: group.fg }}
                      onClick={() => onPhraseTap(p, group.key)} disabled={toolsLocked} type="button">
                      {fillName(p, patientFirstName)}
                    </button>
                  ))}
                  {(customPhrases[group.key] || []).map((p) => (
                    <span key={p.id} className="talk-phrase-pill talk-phrase-pill-custom" style={{ background: group.bg, color: group.fg }}>
                      <button className="talk-phrase-pill-text" onClick={() => onPhraseTap(p.text, group.key, { isCustom: true, phraseId: p.id })} disabled={toolsLocked} type="button">{fillName(p.text, patientFirstName)}</button>
                      <button className="talk-phrase-remove" onClick={() => onRemoveCustomPhrase(group.key, p)} title="Remove" type="button">×</button>
                    </span>
                  ))}
                </div>
              </div>
            ))}

            {addingPhrase ? (
              <div className="talk-add-form">
                <select value={newPhraseGroup} onChange={(e) => setNewPhraseGroup(e.target.value)}>
                  {PHRASE_GROUPS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
                </select>
                <input placeholder="Type a phrase…" value={newPhraseText} onChange={(e) => setNewPhraseText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && onAddCustomPhrase()} autoFocus />
                <button className="talk-add-confirm" onClick={onAddCustomPhrase} type="button"><PlusIcon size={14} /> Add</button>
                <button className="talk-add-cancel" onClick={() => { setAddingPhrase(false); setNewPhraseText('') }} type="button">Cancel</button>
              </div>
            ) : (
              <button className="talk-add-pill" onClick={() => setAddingPhrase(true)} type="button"><PlusIcon size={14} /> Add phrase</button>
            )}

            <div className="talk-message-block">
              <div className="talk-message-label"><PenIcon size={14} />YOUR MESSAGE</div>
              <textarea
                className="talk-textarea"
                value={messageText}
                maxLength={200}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type what you want Pao to say…"
                rows={3}
              />
              <div className="talk-char-count">{messageText.length}/200</div>
            </div>

            <div className="talk-options-row">
              <div className="talk-option-group">
                <button className={`talk-opt-chip ${speed === 0.75 ? 'talk-opt-chip-active' : ''}`} onClick={() => setSpeed(0.75)} type="button"><TurtleIcon size={14} /> Slow</button>
                <button className={`talk-opt-chip ${speed === 1 ? 'talk-opt-chip-active' : ''}`} onClick={() => setSpeed(1)} type="button">Normal</button>
              </div>
              <div className="talk-option-group">
                <button className={`talk-opt-chip ${repeat === 1 ? 'talk-opt-chip-active' : ''}`} onClick={() => setRepeat(1)} type="button"><RepeatIcon size={14} /> ×1</button>
                <button className={`talk-opt-chip ${repeat === 2 ? 'talk-opt-chip-active' : ''}`} onClick={() => setRepeat(2)} type="button">×2</button>
              </div>
              <div className="talk-option-group talk-cue-group">
                {Object.entries(CUE_MAP).map(([key, c]) => (
                  <button key={key} className={`talk-opt-chip ${cueKey === key ? 'talk-opt-chip-active' : ''}`} onClick={() => onSetCue(key)} type="button">
                    {c.emoji} {c.label}
                  </button>
                ))}
                {cueKey && <button className="talk-cue-clear" onClick={() => onSetCue(null)} type="button">✕ Clear cue</button>}
              </div>
            </div>

            {ttsError && <div className="csf-error-box">{ttsError}</div>}

            <button className="talk-say-btn" onClick={onSayIt} disabled={toolsLocked || !messageText.trim()} type="button">
              <VolumeIcon size={20} /> Say it
            </button>
          </div>

          <div className="talk-col-right">
            <div className="talk-session-card">
              <div className="talk-session-title"><ClockIcon size={15} /> TODAY'S SESSION · {sessionStart.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}</div>
              <div className="talk-session-log">
                {sessionLog.length === 0 ? (
                  <p className="talk-session-empty">Nothing said yet.</p>
                ) : (
                  sessionLog.map((entry) => (
                    <div key={entry.id} className="talk-log-row">
                      <span className="talk-log-time">{new Date(entry.time).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="talk-log-text">{entry.text}</span>
                      <button className="talk-log-replay" onClick={() => onReplayLog(entry)} title="Play again" type="button"><RepeatIcon size={13} /></button>
                    </div>
                  ))
                )}
              </div>
              <button className="talk-copy-btn" onClick={onCopyToNotes} disabled={!sessionLog.length} type="button">
                <SaveIcon size={15} /> Copy to session notes
              </button>
            </div>
          </div>
        </div>
      </div>

      {toast && <div className="talk-toast">{toast}</div>}
    </div>
  )
}

// ─── Talk to {patient} — patient screen ──────────────────────────────────────

function TalkPatientView({ patientFirstName, currentSpoken, spokenWordText, isSpeaking, onBack, onReplay, onOpenHistory, historyCount }) {
  useEffect(() => {
    const handler = (e) => {
      if (e.code === 'Space') { e.preventDefault(); onReplay() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onReplay])

  const text = currentSpoken?.text || ''
  const words = text.trim() ? text.trim().split(/\s+/) : []
  const spokenWords = spokenWordText.trim() ? spokenWordText.trim().split(/\s+/) : []
  const finished = !isSpeaking && spokenWordText === text && text.length > 0
  const currentIndex = spokenWords.length - 1
  const cue = currentSpoken?.cue ? CUE_MAP[currentSpoken.cue] : null

  return (
    <div className="talk-view">
      <div className="talk-hero">
        <div className="talk-hero-text">
          <h2><MessageIcon size={22} /> Pao is talking to {patientFirstName}</h2>
          <p>Tap the speaker to hear it again</p>
        </div>
        <button className="talk-history-btn" onClick={onOpenHistory}>
          <ClockIcon size={16} /><span>History</span>
          {historyCount > 0 && <span className="rec-trigger-badge">{historyCount}</span>}
        </button>
      </div>

      <div className="talk-body">
        <div className="talk-patient-topbar">
          <button className="talk-back-btn" onClick={onBack} type="button"><ArrowLeftIcon size={16} /> Back to therapist</button>
          <span className="talk-speed-chip"><TurtleIcon size={13} /> {currentSpoken?.speed === 0.75 ? 'Slow' : 'Normal'}</span>
        </div>

        <div className="talk-stage">
          <div className="talk-mascot">
            <PandaMascot mouthOpen={isSpeaking} pxWidth={200} pandaState="happy" />
          </div>
          <div className="talk-bubble">
            <p className="talk-bubble-text">
              {words.map((w, i) => {
                let cls = 'talk-word-pending'
                if (finished || i < currentIndex) cls = 'talk-word-said'
                else if (i === currentIndex && isSpeaking) cls = 'talk-word-current'
                return <span key={i} className={cls}>{w}{i < words.length - 1 ? ' ' : ''}</span>
              })}
            </p>
          </div>
        </div>

        {cue && (
          <div className="talk-cue-pill">
            <span className="talk-cue-emoji">{cue.emoji}</span>
            <span>{cue.label}</span>
          </div>
        )}

        <div className="talk-replay-area">
          <button className="talk-replay-btn" onClick={onReplay} aria-label="Hear it again" type="button">
            <VolumeIcon size={40} />
          </button>
          <span className="talk-replay-label">Hear it again</span>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

const TTS_HISTORY_LIMIT = 50
const EMPTY_PHRASE_GROUPS = { start: [], instructions: [], praise: [], end: [] }

export default function SpeechFeaturesUI({ user, patient = null, initialTab, onChangePatient, practiceMode = false }) {
  const [activeTab, setActiveTab] = useState(initialTab === 'tts' ? 'tts' : 'stt')
  const [showModal, setShowModal] = useState(false)
  const [recordingsModalTab, setRecordingsModalTab] = useState(null)
  const [showTtsModal, setShowTtsModal] = useState(false)

  useEffect(() => { if (initialTab) setActiveTab(initialTab) }, [initialTab])

  // Therapist flow only (onChangePatient is passed): tools stay locked until
  // a patient is picked or practice mode is explicitly chosen.
  const toolsLocked = !!onChangePatient && !patient && !practiceMode

  // ── STT state ──
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [sttError, setSttError] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [recordings, setRecordings] = useState([])
  const [playingId, setPlayingId] = useState(null)
  const [patients, setPatients] = useState([])
  const [savedRecording, setSavedRecording] = useState(null)

  const recognitionRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const streamRef = useRef(null)
  const audioChunksRef = useRef([])
  const timerRef = useRef(null)
  const transcriptRef = useRef('')
  const segmentsRef = useRef([])
  const elapsedRef = useRef(0)
  const playingAudioRef = useRef(null)

  const userEmail = (user?.email || '').trim().toLowerCase()

  // One id per browser tab, reused across a refresh (sessionStorage) so both
  // "today's session" panels and STT recordings can be grouped by visit.
  const [sessionId] = useState(() => {
    try {
      let id = sessionStorage.getItem('therapypro_talk_session_id')
      if (!id) {
        id = (window.crypto?.randomUUID ? window.crypto.randomUUID() : `s_${Date.now()}_${Math.random().toString(36).slice(2)}`)
        sessionStorage.setItem('therapypro_talk_session_id', id)
      }
      return id
    } catch {
      return `s_${Date.now()}`
    }
  })

  // ── "Talk to {patient}" (TTS) state ──
  const patientKey = patient?.id || '_general'
  const patientFirstName = patient?.name ? String(patient.name).split(' ')[0] : 'the patient'

  const [ttsView, setTtsView] = useState('therapist') // 'therapist' | 'patient'
  const [messageText, setMessageText] = useState('')
  const [speed, setSpeed] = useState(1)
  const [repeat, setRepeat] = useState(1)
  const [cueKey, setCueKey] = useState(null)
  const [cueManuallySet, setCueManuallySet] = useState(false)
  const [customPhrases, setCustomPhrases] = useState(EMPTY_PHRASE_GROUPS)
  const [addingPhrase, setAddingPhrase] = useState(false)
  const [newPhraseGroup, setNewPhraseGroup] = useState('start')
  const [newPhraseText, setNewPhraseText] = useState('')
  const [sessionLog, setSessionLog] = useState([])
  const [sessionStart] = useState(() => new Date())
  const [currentSpoken, setCurrentSpoken] = useState(null)
  const [spokenWordText, setSpokenWordText] = useState('')
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [ttsError, setTtsError] = useState('')
  const [ttsHistory, setTtsHistory] = useState([])
  const [ttsActiveId, setTtsActiveId] = useState(null)
  const [ttsToast, setTtsToast] = useState('')

  const repeatTimerRef = useRef(null)

  // Full "Speech History" (all-time, all patients) for the History modal —
  // backed by text_to_speech_messages rather than localStorage now.
  useEffect(() => {
    if (!userEmail) { setTtsHistory([]); return }
    fetch(`/api/speech-messages/list?therapistEmail=${encodeURIComponent(userEmail)}`)
      .then((r) => r.json())
      .then((body) => {
        setTtsHistory((body.messages || []).map((m) => ({
          id: m.id, date: new Date(m.createdAt), text: m.text, rate: m.speed, cue: m.cue,
          patientId: m.patientId, patientName: m.patientName,
        })))
      })
      .catch(() => {})
  }, [userEmail])

  // Speed/repeat are a UI preference (no DB field for it), kept per patient.
  // Custom phrases and "today's session" are DB-backed per patient.
  useEffect(() => {
    try {
      const savedSettings = JSON.parse(localStorage.getItem(`therapypro_talk_settings_${patientKey}`) || 'null')
      if (savedSettings) { setSpeed(savedSettings.speed || 1); setRepeat(savedSettings.repeat || 1) }
    } catch {
      // keep defaults
    }
    setMessageText(''); setCueKey(null); setCueManuallySet(false)
    setCurrentSpoken(null); setSpokenWordText(''); setTtsView('therapist')
    stopPaoVoice()

    if (!userEmail) { setCustomPhrases(EMPTY_PHRASE_GROUPS); setSessionLog([]); return }
    const patientQuery = patient?.id ? `&patientId=${encodeURIComponent(patient.id)}` : ''

    fetch(`/api/speech-phrases/list?therapistEmail=${encodeURIComponent(userEmail)}${patientQuery}`)
      .then((r) => r.json())
      .then((body) => {
        const grouped = { start: [], instructions: [], praise: [], end: [] }
        ;(body.phrases || []).forEach((p) => { if (grouped[p.group]) grouped[p.group].push(p) })
        setCustomPhrases(grouped)
      })
      .catch(() => setCustomPhrases(EMPTY_PHRASE_GROUPS))

    fetch(`/api/speech-messages/list?therapistEmail=${encodeURIComponent(userEmail)}&sessionId=${encodeURIComponent(sessionId)}${patientQuery}`)
      .then((r) => r.json())
      .then((body) => {
        setSessionLog((body.messages || []).map((m) => ({ id: m.id, time: m.createdAt, text: m.text, speed: m.speed, cue: m.cue })))
      })
      .catch(() => setSessionLog([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientKey, userEmail])

  useEffect(() => {
    try { localStorage.setItem(`therapypro_talk_settings_${patientKey}`, JSON.stringify({ speed, repeat })) } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speed, repeat])

  useEffect(() => {
    if (!cueManuallySet) setCueKey(suggestCue(messageText))
  }, [messageText, cueManuallySet])

  useEffect(() => { transcriptRef.current = transcript }, [transcript])

  useEffect(() => {
    if (isListening) {
      timerRef.current = setInterval(() => {
        setElapsed(e => { const n = e + 1; elapsedRef.current = n; return n })
      }, 1000)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [isListening])

  // ── Load this user's recordings + rebuild audio blob URLs from IndexedDB ──
  useEffect(() => {
    if (!userEmail) return
    let cancelled = false
    fetch(`/api/speech-recordings/list?therapistEmail=${encodeURIComponent(userEmail)}`)
      .then((r) => r.json())
      .then(async (body) => {
        if (cancelled || !body.recordings) return
        const withAudio = await Promise.all(body.recordings.map(async (rec) => {
          try {
            const blob = await getAudioBlob(rec.audioKey)
            return { ...rec, audioUrl: blob ? URL.createObjectURL(blob) : null }
          } catch {
            return { ...rec, audioUrl: null }
          }
        }))
        if (!cancelled) setRecordings(withAudio)
      })
      .catch(() => { /* recordings list just stays empty */ })
    return () => { cancelled = true }
  }, [userEmail])

  // ── Load this therapist's patients (skipped entirely if none / not a therapist) ──
  useEffect(() => {
    if (!userEmail) return
    let cancelled = false
    fetch(`/api/patients/therapist-list?email=${encodeURIComponent(userEmail)}`)
      .then((r) => (r.ok ? r.json() : { patients: [] }))
      .then((body) => { if (!cancelled) setPatients(body.patients || []) })
      .catch(() => { if (!cancelled) setPatients([]) })
    return () => { cancelled = true }
  }, [userEmail])

  useEffect(() => {
    return () => {
      recordings.forEach(r => { if (r.audioUrl) URL.revokeObjectURL(r.audioUrl) })
      playingAudioRef.current?.pause()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Start recording ──
  const startListening = async () => {
    if (toolsLocked) return
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { setSttError('❌ Use Google Chrome for speech recognition!'); return }

    let stream
    try {
      // Ask the browser's own audio pipeline to suppress steady background
      // noise (fans, hum, hallway chatter) and normalise volume, so the
      // recording stays focused on the therapist/patient conversation
      // instead of the room around them.
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      })
    } catch {
      setSttError('🎤 Microphone denied! Click the 🔒 lock icon in the address bar and allow microphone.')
      return
    }
    streamRef.current = stream

    const mediaRecorder = new MediaRecorder(stream)
    audioChunksRef.current = []
    mediaRecorderRef.current = mediaRecorder

    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
    mediaRecorder.onstop = async () => {
      const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
      const audioUrl = URL.createObjectURL(blob)
      const audioKey = newAudioKey()
      const finalTranscript = transcriptRef.current
      const durationSec = elapsedRef.current
      const words = wordCount(finalTranscript)
      streamRef.current?.getTracks().forEach(t => t.stop())

      try {
        await saveAudioBlob(audioKey, blob)
      } catch {
        // IndexedDB unavailable — playback for this session still works via the blob URL
      }

      if (!userEmail) {
        // No logged-in user context — keep the old local-only behaviour rather than losing the recording.
        setRecordings(prev => [{
          id: `local-${Date.now()}`, title: defaultSessionTitle(new Date()), transcript: finalTranscript,
          segments: segmentsRef.current, audioUrl, durationSec, wordCount: words,
          summaryStatus: 'none', summary: null, patientId: patient?.id || null, patientName: patient?.name || null, createdAt: new Date().toISOString(),
        }, ...prev])
        return
      }

      try {
        const res = await fetch('/api/speech-recordings/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            therapistEmail: userEmail,
            sessionId,
            title: defaultSessionTitle(new Date()),
            transcript: finalTranscript,
            segments: segmentsRef.current,
            durationSec, wordCount: words, audioKey, fileSize: blob.size,
            patientId: patient?.id || null,
            patientName: patient?.name || null,
          }),
        })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)

        const saved = { ...body.recording, audioUrl }
        setRecordings(prev => [saved, ...prev])
        setSavedRecording(saved)

        if (finalTranscript.trim()) {
          fetch(`/api/speech-recordings/${saved.id}/summarize`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ therapistEmail: userEmail }),
          })
            .then((r) => r.json())
            .then((sBody) => {
              if (!sBody.recording) return
              const updated = { ...sBody.recording, audioUrl }
              setRecordings(prev => prev.map(r => (r.id === updated.id ? updated : r)))
              setSavedRecording(prev => (prev && prev.id === updated.id ? updated : prev))
            })
            .catch(() => {})
        }
      } catch (err) {
        setSttError(err.message || 'Could not save the recording.')
      }
    }

    const recognition = new SR()
    recognition.lang = 'en-US'; recognition.continuous = true; recognition.interimResults = true
    recognition.onresult = (e) => {
      const text = Array.from(e.results).map(r => r[0].transcript).join('')
      setTranscript(text); transcriptRef.current = text
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i]
        if (result.isFinal) {
          const t = result[0].transcript.trim()
          if (t) segmentsRef.current.push({ t: elapsedRef.current, text: t })
        }
      }
    }
    recognition.onerror = (e) => { if (e.error !== 'no-speech') setSttError(`Oops! ${e.error} 😅`); setIsListening(false) }
    recognition.onend = () => setIsListening(false)
    recognitionRef.current = recognition

    mediaRecorder.start(200); recognition.start()
    setIsListening(true); setElapsed(0); elapsedRef.current = 0
    setTranscript(''); transcriptRef.current = ''; segmentsRef.current = []; setSttError('')
  }

  const stopListening = () => {
    recognitionRef.current?.stop()
    if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop()
    else streamRef.current?.getTracks().forEach(t => t.stop())
    setIsListening(false)
  }

  const handlePlay = (rec) => {
    if (playingAudioRef.current) { playingAudioRef.current.pause(); playingAudioRef.current = null }
    if (playingId === rec.id) { setPlayingId(null); return }
    if (!rec.audioUrl) return
    const audio = new Audio(rec.audioUrl)
    audio.play(); audio.onended = () => setPlayingId(null); audio.onerror = () => setPlayingId(null)
    playingAudioRef.current = audio; setPlayingId(rec.id)
  }

  const handleDelete = async (rec) => {
    if (playingId === rec.id) { playingAudioRef.current?.pause(); setPlayingId(null) }
    setRecordings(prev => prev.filter(x => x.id !== rec.id))
    if (rec.audioUrl) URL.revokeObjectURL(rec.audioUrl)
    if (rec.audioKey) deleteAudioBlob(rec.audioKey).catch(() => {})
    if (userEmail && !String(rec.id).startsWith('local-')) {
      fetch(`/api/speech-recordings/${rec.id}?therapistEmail=${encodeURIComponent(userEmail)}`, { method: 'DELETE' }).catch(() => {})
    }
  }

  const clearAll = () => {
    playingAudioRef.current?.pause(); setPlayingId(null)
    recordings.forEach((r) => {
      if (r.audioUrl) URL.revokeObjectURL(r.audioUrl)
      if (r.audioKey) deleteAudioBlob(r.audioKey).catch(() => {})
      if (userEmail && !String(r.id).startsWith('local-')) {
        fetch(`/api/speech-recordings/${r.id}?therapistEmail=${encodeURIComponent(userEmail)}`, { method: 'DELETE' }).catch(() => {})
      }
    })
    setRecordings([])
  }

  const handleRetrySummary = (id) => {
    if (!userEmail) return
    setRecordings(prev => prev.map(r => (r.id === id ? { ...r, summaryStatus: 'pending' } : r)))
    fetch(`/api/speech-recordings/${id}/summarize`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ therapistEmail: userEmail }),
    })
      .then((r) => r.json())
      .then((body) => {
        if (!body.recording) return
        setRecordings(prev => prev.map(r => (r.id === body.recording.id ? { ...body.recording, audioUrl: r.audioUrl } : r)))
      })
      .catch(() => {
        setRecordings(prev => prev.map(r => (r.id === id ? { ...r, summaryStatus: 'failed' } : r)))
      })
  }

  const handleSaveMeta = ({ title, patientId }) => {
    if (!savedRecording) return
    const patient = patients.find((p) => p.id === patientId)
    const patientName = patient?.name || null
    setRecordings(prev => prev.map(r => (r.id === savedRecording.id ? { ...r, title, patientId: patientId || null, patientName } : r)))
    setSavedRecording(prev => (prev ? { ...prev, title, patientId: patientId || null, patientName } : prev))
    if (userEmail && !String(savedRecording.id).startsWith('local-')) {
      fetch(`/api/speech-recordings/${savedRecording.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ therapistEmail: userEmail, title, patientId: patientId || null, patientName }),
      }).catch(() => {})
    }
  }

  const handleRecordAnother = () => {
    setSavedRecording(null)
    setTranscript(''); transcriptRef.current = ''
    setElapsed(0); elapsedRef.current = 0
    segmentsRef.current = []
  }

  const handleOpenRecordingsFromSaved = () => {
    setSavedRecording(null)
    setRecordingsModalTab('summarized')
    setShowModal(true)
  }

  const handleChangePatientClick = () => {
    if (!onChangePatient) return
    if (isListening) {
      if (!window.confirm('Stop the current recording?')) return
      stopListening()
    }
    onChangePatient()
  }

  // ── "Talk to {patient}" (TTS) ──
  const bumpReplayCount = (id) => {
    if (!id || String(id).startsWith('local-') || !userEmail) return
    fetch(`/api/speech-messages/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ therapistEmail: userEmail, incrementReplay: true }),
    }).catch(() => {})
  }

  const logSpokenMessage = async (text, spokenSpeed, cue, phraseGroup, phraseId) => {
    if (!userEmail) {
      const entry = { id: `local-${Date.now()}`, time: new Date().toISOString(), text, speed: spokenSpeed, cue }
      setSessionLog(prev => [...prev, entry])
      setTtsHistory(prev => [
        { id: entry.id, date: new Date(), text, rate: spokenSpeed, cue, patientId: patient?.id || null, patientName: patient?.name || null },
        ...prev,
      ].slice(0, TTS_HISTORY_LIMIT))
      return null
    }
    try {
      const res = await fetch('/api/speech-messages/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          therapistEmail: userEmail, patientId: patient?.id || null, patientName: patient?.name || null,
          sessionId, text, phraseGroup, phraseId, speed: spokenSpeed, repeatCount: repeat, cue,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
      const m = body.message
      setSessionLog(prev => [...prev, { id: m.id, time: m.createdAt, text: m.text, speed: m.speed, cue: m.cue }])
      setTtsHistory(prev => [
        { id: m.id, date: new Date(m.createdAt), text: m.text, rate: m.speed, cue: m.cue, patientId: m.patientId, patientName: m.patientName },
        ...prev,
      ].slice(0, TTS_HISTORY_LIMIT))
      return m.id
    } catch (err) {
      setTtsError(err.message || 'Could not save the message.')
      return null
    }
  }

  const speakMessage = (rawText, { cueOverride, phraseGroup = 'typed', phraseId = null } = {}) => {
    if (toolsLocked) return
    const text = String(rawText || '').trim()
    if (!text) return
    if (!window.speechSynthesis) { setTtsError('🔇 Not supported. Use Google Chrome!'); return }
    const cue = cueOverride !== undefined ? cueOverride : suggestCue(text)
    const spokenSpeed = speed
    clearTimeout(repeatTimerRef.current)
    stopPaoVoice()
    setTtsActiveId(null)
    setCurrentSpoken({ text, cue, speed: spokenSpeed, id: null })
    setSpokenWordText('')
    setTtsView('patient')
    setTtsError('')

    let remaining = repeat
    const runOnce = () => {
      speakPao(text, {
        rate: spokenSpeed,
        onStart: () => setIsSpeaking(true),
        onWord: (partial) => setSpokenWordText(partial),
        onEnd: () => {
          setSpokenWordText(text)
          remaining -= 1
          if (remaining > 0) {
            repeatTimerRef.current = setTimeout(runOnce, 500)
          } else {
            setIsSpeaking(false)
          }
        },
      })
    }
    runOnce()
    logSpokenMessage(text, spokenSpeed, cue, phraseGroup, phraseId)
      .then((id) => { if (id) setCurrentSpoken((prev) => (prev && prev.text === text ? { ...prev, id } : prev)) })
  }

  const handleSayIt = () => {
    if (!messageText.trim()) return
    speakMessage(messageText, { cueOverride: cueKey, phraseGroup: 'typed' })
  }

  const handlePhraseTap = (phraseText, group, { isCustom, phraseId } = {}) => {
    speakMessage(fillName(phraseText, patientFirstName), { phraseGroup: isCustom ? 'custom' : group, phraseId })
  }

  const replayCurrent = () => {
    if (!currentSpoken) return
    clearTimeout(repeatTimerRef.current)
    stopPaoVoice()
    setSpokenWordText('')
    bumpReplayCount(currentSpoken.id)
    speakPao(currentSpoken.text, {
      rate: currentSpoken.speed,
      onStart: () => setIsSpeaking(true),
      onWord: (partial) => setSpokenWordText(partial),
      onEnd: () => { setSpokenWordText(currentSpoken.text); setIsSpeaking(false) },
    })
  }

  const replayLogEntry = (entry) => {
    clearTimeout(repeatTimerRef.current)
    stopPaoVoice()
    setCurrentSpoken({ text: entry.text, cue: entry.cue, speed: entry.speed, id: entry.id })
    setSpokenWordText('')
    setTtsView('patient')
    bumpReplayCount(entry.id)
    speakPao(entry.text, {
      rate: entry.speed,
      onStart: () => setIsSpeaking(true),
      onWord: (partial) => setSpokenWordText(partial),
      onEnd: () => { setSpokenWordText(entry.text); setIsSpeaking(false) },
    })
  }

  const handleBackToTherapist = () => {
    clearTimeout(repeatTimerRef.current)
    stopPaoVoice()
    setIsSpeaking(false)
    setTtsView('therapist')
  }

  const handleAddCustomPhrase = async () => {
    const text = newPhraseText.trim()
    if (!text) { setAddingPhrase(false); return }
    if (!userEmail) { setNewPhraseText(''); setAddingPhrase(false); return }
    try {
      const res = await fetch('/api/speech-phrases/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ therapistEmail: userEmail, patientId: patient?.id || null, group: newPhraseGroup, text }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
      setCustomPhrases(prev => ({ ...prev, [newPhraseGroup]: [...(prev[newPhraseGroup] || []), body.phrase] }))
    } catch (err) {
      setTtsError(err.message || 'Could not save the phrase.')
    }
    setNewPhraseText(''); setAddingPhrase(false)
  }

  const handleRemoveCustomPhrase = (group, phrase) => {
    setCustomPhrases(prev => ({ ...prev, [group]: (prev[group] || []).filter((p) => p.id !== phrase.id) }))
    if (userEmail) {
      fetch(`/api/speech-phrases/${phrase.id}?therapistEmail=${encodeURIComponent(userEmail)}`, { method: 'DELETE' }).catch(() => {})
    }
  }

  const showTtsToast = (msg) => {
    setTtsToast(msg)
    setTimeout(() => setTtsToast(''), 2200)
  }

  const handleCopyToNotes = () => {
    if (!sessionLog.length) return
    const lines = sessionLog
      .map((e) => `${new Date(e.time).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })} — ${e.text}`)
      .join('\n')
    navigator.clipboard?.writeText(lines).then(() => showTtsToast('📋 Copied to clipboard!')).catch(() => showTtsToast('Could not copy.'))
  }

  const handleHistoryPlay = (item) => {
    if (ttsActiveId === item.id) { stopPaoVoice(); setTtsActiveId(null); return }
    setTtsActiveId(item.id)
    speakPao(item.text, { rate: item.rate, onEnd: () => setTtsActiveId(null) })
  }

  const handleHistoryReuse = (item) => {
    setMessageText(item.text)
    setCueKey(item.cue || null)
    setCueManuallySet(!!item.cue)
    setTtsView('therapist')
    setShowTtsModal(false)
  }

  const handleHistoryDelete = (id) => {
    if (ttsActiveId === id) { stopPaoVoice(); setTtsActiveId(null) }
    setTtsHistory(prev => prev.filter(x => x.id !== id))
    if (userEmail && !String(id).startsWith('local-')) {
      fetch(`/api/speech-messages/${id}?therapistEmail=${encodeURIComponent(userEmail)}`, { method: 'DELETE' }).catch(() => {})
    }
  }

  const clearTtsHistory = () => {
    stopPaoVoice(); setTtsActiveId(null)
    if (userEmail) {
      ttsHistory.forEach((item) => {
        if (!String(item.id).startsWith('local-')) {
          fetch(`/api/speech-messages/${item.id}?therapistEmail=${encodeURIComponent(userEmail)}`, { method: 'DELETE' }).catch(() => {})
        }
      })
    }
    setTtsHistory([])
  }

  return (
    <div className="csf-root">

      {/* Tabs */}
      <div className="csf-tabs">
        <button className={`csf-tab ${activeTab === 'stt' ? 'csf-tab-active csf-tab-mic' : ''}`} onClick={() => setActiveTab('stt')}>
          <span className="csf-tab-icon"><MicIconOutline size={18} /></span><span>Speech to Text</span>
        </button>
        <button className={`csf-tab ${activeTab === 'tts' ? 'csf-tab-active csf-tab-speaker' : ''}`} onClick={() => setActiveTab('tts')}>
          <span className="csf-tab-icon"><VolumeIcon size={18} /></span><span>Text to Speech</span>
        </button>
      </div>

      {/* Patient banner — therapist flow only */}
      {onChangePatient && (
        patient ? (
          <div className="pb-banner">
            <span className="pb-avatar" style={{ background: patientAvatarColor(patient.id) }}>{patientInitials(patient.name)}</span>
            <div className="pb-info">
              <div className="pb-title">Working with {patient.name}</div>
              <div className="pb-sub">
                {patient.age != null ? `${patient.age} yrs · ` : ''}
                {patient.condition ? `${patient.condition} · ` : ''}
                Recordings &amp; speech history save to {String(patient.name).split(' ')[0]}'s record
              </div>
            </div>
            <span className="pb-pill"><DotIconOutline size={8} />Session active</span>
            <button className="pb-swap-btn" onClick={handleChangePatientClick}><SwapIcon size={15} /><span>Change patient</span></button>
          </div>
        ) : practiceMode ? (
          <div className="pb-banner pb-banner-practice">
            <span className="pb-practice-icon"><FlaskIcon size={18} /></span>
            <div className="pb-info">
              <div className="pb-title">Practice mode</div>
              <div className="pb-sub">Nothing is saved to a patient record</div>
            </div>
            <button className="pb-swap-btn" onClick={handleChangePatientClick}><SwapIcon size={15} /><span>Choose a patient</span></button>
          </div>
        ) : (
          <div className="pb-banner pb-banner-practice">
            <span className="pb-practice-icon"><SwapIcon size={18} /></span>
            <div className="pb-info">
              <div className="pb-title">No patient selected</div>
              <div className="pb-sub">Choose a patient or continue in practice mode</div>
            </div>
            <button className="pb-swap-btn" onClick={handleChangePatientClick}><SwapIcon size={15} /><span>Choose a patient</span></button>
          </div>
        )
      )}

      {/* ══════════ SPEECH TO TEXT ══════════ */}
      {activeTab === 'stt' && (
        <div className="csf-card" style={{ position: 'relative' }}>

          {/* Recordings button — top right */}
          <button className="rec-trigger-btn" onClick={() => { setRecordingsModalTab(null); setShowModal(true) }}>
            <FolderIcon />
            <span>Recordings</span>
            {recordings.length > 0 && (
              <span className="rec-trigger-badge">{recordings.length}</span>
            )}
          </button>

          {/* Hero */}
          <div className="csf-hero csf-hero-mic">
            <div className="csf-hero-stars">
              <span className="csf-star s1">⭐</span><span className="csf-star s2">✨</span>
              <span className="csf-star s3">🌟</span><span className="csf-star s4">⭐</span>
              <span className="csf-star s5">✨</span>
            </div>
            <h2 className="csf-hero-title"><MicIconOutline size={22} /> Voice Recorder</h2>
            <p className="csf-hero-sub">Tap the mic — your voice will be recorded and converted to text!</p>
          </div>

          {/* Waveform */}
          <div className="csf-wave-area"><Waveform active={isListening} /></div>

          {/* Mic button */}
          <div className="csf-btn-area">
            {isListening && (
              <><span className="csf-ring csf-ring1"/><span className="csf-ring csf-ring2"/><span className="csf-ring csf-ring3"/></>
            )}
            <button
              className={`csf-main-btn ${isListening ? 'csf-btn-recording' : 'csf-btn-idle-mic'}`}
              onClick={isListening ? stopListening : startListening}
              disabled={toolsLocked}
            >
              {isListening ? <StopIcon /> : <MicIcon />}
            </button>
          </div>

          <div className={`csf-timer ${isListening ? 'csf-timer-live' : ''}`}>{formatTime(elapsed)}</div>
          <p className="csf-status-text">
            {toolsLocked ? 'Choose a patient to start' : (isListening ? '🔴 Recording... tap to stop!' : '👇 Tap the mic to start!')}
          </p>

          {sttError && <div className="csf-error-box">{sttError}</div>}

          {/* Live transcript */}
          {isListening && transcript && (
            <div className="csf-live-preview">
              <span className="csf-live-dot" />
              <span className="csf-live-label">Live transcript</span>
              <p className="csf-live-text">{transcript}</p>
            </div>
          )}
        </div>
      )}

      {/* ══════════ TALK TO {PATIENT} (TEXT TO SPEECH) ══════════ */}
      {activeTab === 'tts' && (
        <div className="csf-card talk-card">
          {ttsView === 'therapist' ? (
            <TalkTherapistView
              toolsLocked={toolsLocked}
              patientFirstName={patientFirstName}
              customPhrases={customPhrases}
              onPhraseTap={handlePhraseTap}
              addingPhrase={addingPhrase}
              setAddingPhrase={setAddingPhrase}
              newPhraseGroup={newPhraseGroup}
              setNewPhraseGroup={setNewPhraseGroup}
              newPhraseText={newPhraseText}
              setNewPhraseText={setNewPhraseText}
              onAddCustomPhrase={handleAddCustomPhrase}
              onRemoveCustomPhrase={handleRemoveCustomPhrase}
              messageText={messageText}
              setMessageText={setMessageText}
              onSayIt={handleSayIt}
              speed={speed}
              setSpeed={setSpeed}
              repeat={repeat}
              setRepeat={setRepeat}
              cueKey={cueKey}
              onSetCue={(k) => { setCueKey(k); setCueManuallySet(true) }}
              sessionLog={sessionLog}
              sessionStart={sessionStart}
              onReplayLog={replayLogEntry}
              onCopyToNotes={handleCopyToNotes}
              onOpenHistory={() => setShowTtsModal(true)}
              historyCount={ttsHistory.length}
              ttsError={ttsError}
              toast={ttsToast}
            />
          ) : (
            <TalkPatientView
              patientFirstName={patientFirstName}
              currentSpoken={currentSpoken}
              spokenWordText={spokenWordText}
              isSpeaking={isSpeaking}
              onBack={handleBackToTherapist}
              onReplay={replayCurrent}
              onOpenHistory={() => setShowTtsModal(true)}
              historyCount={ttsHistory.length}
            />
          )}
        </div>
      )}

      {/* ══════════ RECORDING SAVED MODAL ══════════ */}
      {savedRecording && (
        <RecordingSavedModal
          recording={savedRecording}
          patients={patients}
          onSaveMeta={handleSaveMeta}
          onRecordAnother={handleRecordAnother}
          onOpenRecordings={handleOpenRecordingsFromSaved}
        />
      )}

      {/* ══════════ RECORDINGS MODAL ══════════ */}
      {showModal && (
        <RecordingsModal
          recordings={recordings}
          patients={patients}
          playingId={playingId}
          onPlay={handlePlay}
          onDelete={handleDelete}
          onClearAll={clearAll}
          onRetrySummary={handleRetrySummary}
          onClose={() => setShowModal(false)}
          initialTab={recordingsModalTab}
          currentPatient={patient}
        />
      )}

      {/* ══════════ TTS HISTORY MODAL ══════════ */}
      {showTtsModal && (
        <TtsHistoryModal
          history={ttsHistory}
          activeId={ttsActiveId}
          onPlay={handleHistoryPlay}
          onReuse={handleHistoryReuse}
          onDelete={handleHistoryDelete}
          onClearAll={clearTtsHistory}
          onClose={() => setShowTtsModal(false)}
          currentPatient={patient}
        />
      )}

      <style>{`
        /* ── Root & Tabs ── */
        .csf-root { width:100%; max-width:640px; margin:0 auto; font-family:'Segoe UI',system-ui,sans-serif; }
        .csf-tabs { display:flex; gap:10px; margin-bottom:20px; }
        .csf-tab { flex:1; display:flex; align-items:center; justify-content:center; gap:8px; padding:13px 20px; border:2.5px solid #e2e8f0; border-radius:16px; background:#fff; color:#64748b; font-size:15px; font-weight:700; cursor:pointer; transition:all 0.25s; box-shadow:0 2px 8px rgba(0,0,0,0.04); }
        .csf-tab:hover { border-color:#a78bfa; color:#7c3aed; transform:translateY(-1px); }
        .csf-tab-icon { display:flex; align-items:center; }
        .csf-tab-active { transform:translateY(-2px); box-shadow:0 6px 20px rgba(0,0,0,0.12); }
        .csf-tab-mic { background:linear-gradient(135deg,#7c3aed,#6366f1); color:#fff !important; border-color:transparent; }
        .csf-tab-speaker { background:linear-gradient(135deg,#059669,#0d9488); color:#fff !important; border-color:transparent; }

        /* ── Card ── */
        .csf-card { background:#fff; border-radius:28px; overflow:hidden; box-shadow:0 8px 40px rgba(0,0,0,0.10); padding-bottom:28px; position:relative; }

        /* ── Recordings trigger button ── */
        .rec-trigger-btn {
          position:absolute; top:14px; right:14px; z-index:10;
          display:flex; align-items:center; gap:6px;
          background:rgba(255,255,255,0.22); backdrop-filter:blur(8px);
          border:1.5px solid rgba(255,255,255,0.5); border-radius:20px;
          color:#fff; font-size:13px; font-weight:700; cursor:pointer;
          padding:7px 14px; transition:all 0.2s;
        }
        .rec-trigger-btn:hover { background:rgba(255,255,255,0.35); transform:scale(1.04); }
        .rec-trigger-badge {
          background:#ef4444; color:#fff; border-radius:50%;
          width:20px; height:20px; font-size:11px; font-weight:800;
          display:flex; align-items:center; justify-content:center;
          margin-left:2px;
        }

        /* ── Patient banner (therapist flow) ── */
        .pb-banner {
          display:flex; align-items:center; gap:12px;
          background:linear-gradient(135deg,#f5f3ff,#ecfeff);
          border:2px solid #a78bfa; border-radius:20px;
          padding:12px 16px; margin-bottom:16px; flex-wrap:wrap;
        }
        .pb-banner-practice { background:#f8fafc; border-color:#cbd5e1; }
        .pb-avatar { width:44px; height:44px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:800; font-size:15px; flex-shrink:0; }
        .pb-practice-icon { width:44px; height:44px; border-radius:14px; background:#e2e8f0; color:#475569; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .pb-info { flex:1; min-width:160px; }
        .pb-title { font-size:14.5px; font-weight:800; color:#1e293b; }
        .pb-sub { font-size:12px; font-weight:600; color:#64748b; margin-top:2px; line-height:1.5; }
        .pb-pill { display:flex; align-items:center; gap:5px; background:#ecfdf5; color:#059669; border-radius:20px; padding:4px 11px; font-size:11.5px; font-weight:800; white-space:nowrap; flex-shrink:0; }
        .pb-swap-btn { display:flex; align-items:center; gap:6px; background:#fff; border:1.5px solid #ddd6fe; border-radius:12px; padding:8px 14px; font-size:12.5px; font-weight:800; color:#6d28d9; cursor:pointer; white-space:nowrap; flex-shrink:0; }
        .pb-swap-btn:hover { background:#f5f3ff; border-color:#c4b5fd; }

        /* ── Recordings/History patient scope toggle ── */
        .rec-scope-row { display:flex; gap:8px; padding:16px 24px 0; flex-wrap:wrap; }
        .rec-scope-pill { padding:8px 14px; border-radius:20px; border:1.5px solid #e2e8f0; background:#fff; color:#64748b; font-size:12.5px; font-weight:700; cursor:pointer; white-space:nowrap; }
        .rec-scope-pill-active { background:linear-gradient(135deg,#7c3aed,#6366f1); border-color:transparent; color:#fff; }

        /* ── Hero ── */
        .csf-hero { padding:28px 24px 24px; text-align:center; position:relative; overflow:hidden; }
        .csf-hero-mic { background:linear-gradient(135deg,#7c3aed 0%,#6366f1 50%,#38bdf8 100%); }
        .csf-hero-speaker { background:linear-gradient(135deg,#059669 0%,#0d9488 50%,#38bdf8 100%); }
        .csf-hero-title { font-size:26px; font-weight:800; color:#fff; margin:0 0 6px; text-shadow:0 2px 8px rgba(0,0,0,0.15); display:flex; align-items:center; justify-content:center; gap:8px; }
        .csf-hero-sub { font-size:14px; color:rgba(255,255,255,0.9); margin:0; font-weight:500; }
        .csf-hero-stars { position:absolute; inset:0; pointer-events:none; }
        .csf-star { position:absolute; font-size:18px; animation:sfFloat 3s ease-in-out infinite; opacity:0.8; }
        .s1{top:12px;left:14px;animation-delay:0s} .s2{top:8px;right:56px;animation-delay:0.5s;font-size:14px}
        .s3{bottom:14px;left:50%;transform:translateX(-50%);animation-delay:1s} .s4{bottom:10px;left:18px;animation-delay:1.5s;font-size:13px} .s5{bottom:12px;right:16px;animation-delay:0.8s}
        @keyframes sfFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}

        /* ── Waveform ── */
        .csf-wave-area { padding:8px 24px 0; }
        .csf-waveform { display:flex; align-items:center; justify-content:center; gap:3px; height:52px; }
        .csf-bar { width:5px; height:6px; border-radius:4px; background:#e2e8f0; }
        .csf-bar.csf-bar-active { background:var(--bar-color); animation:csfWave 0.85s ease-in-out infinite; }
        @keyframes csfWave{0%,100%{height:6px;}50%{height:36px;}}

        /* ── Buttons ── */
        .csf-btn-area { position:relative; display:flex; justify-content:center; align-items:center; height:160px; margin-top:4px; }
        .csf-ring { position:absolute; border-radius:50%; border:3px solid rgba(124,58,237,0.25); animation:csfRing 2s ease-out infinite; }
        .csf-ring-green { border-color:rgba(5,150,105,0.25); }
        .csf-ring1{width:112px;height:112px;animation-delay:0s} .csf-ring2{width:148px;height:148px;animation-delay:0.5s} .csf-ring3{width:184px;height:184px;animation-delay:1s}
        @keyframes csfRing{0%{transform:scale(0.9);opacity:1;}100%{transform:scale(1.2);opacity:0;}}
        .csf-main-btn { width:100px; height:100px; border-radius:50%; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; position:relative; z-index:2; transition:transform 0.15s; }
        .csf-main-btn:hover { transform:scale(1.1); }
        .csf-main-btn:active { transform:scale(0.95); }
        .csf-main-btn:disabled { opacity:0.35; cursor:not-allowed; transform:none !important; }
        .csf-btn-idle-mic { background:linear-gradient(135deg,#7c3aed,#6366f1); box-shadow:0 8px 30px rgba(124,58,237,0.45),0 0 0 6px rgba(124,58,237,0.12); animation:csfBounce 2.5s ease-in-out infinite; }
        .csf-btn-recording { background:linear-gradient(135deg,#ef4444,#dc2626); box-shadow:0 8px 30px rgba(239,68,68,0.5),0 0 0 6px rgba(239,68,68,0.15); animation:csfPulseRed 1.2s ease-in-out infinite; }
        .csf-btn-idle-speaker { background:linear-gradient(135deg,#059669,#0d9488); box-shadow:0 8px 30px rgba(5,150,105,0.45),0 0 0 6px rgba(5,150,105,0.12); animation:csfBounce 2.5s ease-in-out infinite; }
        .csf-btn-speaking { background:linear-gradient(135deg,#f59e0b,#f97316); box-shadow:0 8px 30px rgba(245,158,11,0.5),0 0 0 6px rgba(245,158,11,0.15); animation:csfPulseOrange 1.2s ease-in-out infinite; }
        @keyframes csfBounce{0%,100%{transform:translateY(0) scale(1);}50%{transform:translateY(-6px) scale(1.03);}}
        @keyframes csfPulseRed{0%,100%{box-shadow:0 8px 30px rgba(239,68,68,0.5),0 0 0 0 rgba(239,68,68,0.4);}50%{box-shadow:0 8px 30px rgba(239,68,68,0.5),0 0 0 18px rgba(239,68,68,0);}}
        @keyframes csfPulseOrange{0%,100%{box-shadow:0 8px 30px rgba(245,158,11,0.5),0 0 0 0 rgba(245,158,11,0.4);}50%{box-shadow:0 8px 30px rgba(245,158,11,0.5),0 0 0 18px rgba(245,158,11,0);}}

        /* ── Timer & status ── */
        .csf-timer { text-align:center; font-size:38px; font-weight:900; font-family:'Courier New',monospace; color:#cbd5e1; letter-spacing:4px; margin:2px 0 0; }
        .csf-timer.csf-timer-live { color:#ef4444; }
        .csf-status-text { text-align:center; font-size:15px; color:#94a3b8; font-weight:600; margin:8px 0 0; }
        .csf-error-box { margin:12px 24px 0; padding:12px 16px; background:#fef2f2; border:1.5px solid #fca5a5; border-radius:12px; font-size:14px; color:#dc2626; font-weight:500; text-align:center; }

        /* ── Live preview ── */
        .csf-live-preview { margin:16px 20px 0; background:linear-gradient(135deg,#faf5ff,#eff6ff); border:2px dashed #a78bfa; border-radius:16px; padding:14px 16px; }
        .csf-live-dot { display:inline-block; width:8px; height:8px; background:#ef4444; border-radius:50%; animation:csfPulseRed 1s ease-in-out infinite; margin-right:6px; vertical-align:middle; }
        .csf-live-label { font-size:12px; font-weight:800; color:#7c3aed; text-transform:uppercase; letter-spacing:0.5px; }
        .csf-live-text { font-size:15px; color:#1e293b; margin:8px 0 0; line-height:1.6; font-style:italic; }

        /* ── Modal backdrop ── */
        .rec-modal-backdrop {
          position:fixed; inset:0; background:rgba(15,23,42,0.55);
          backdrop-filter:blur(4px); z-index:1000;
          display:flex; align-items:center; justify-content:center;
          padding:20px; animation:modalFadeIn 0.2s ease;
        }
        @keyframes modalFadeIn{from{opacity:0}to{opacity:1}}

        /* ── Modal ── */
        .rec-modal {
          background:#fff; border-radius:28px;
          width:100%; max-width:560px; max-height:86vh;
          display:flex; flex-direction:column;
          box-shadow:0 24px 80px rgba(0,0,0,0.25);
          animation:modalSlideUp 0.25s ease;
          overflow:hidden;
        }
        .rec-modal-wide { max-width:760px; }
        @keyframes modalSlideUp{from{transform:translateY(24px);opacity:0}to{transform:translateY(0);opacity:1}}

        .rec-modal-header {
          display:flex; align-items:center; justify-content:space-between;
          padding:20px 24px; border-bottom:1.5px solid #f1f5f9;
          background:linear-gradient(135deg,#7c3aed,#6366f1);
          flex-shrink:0;
        }
        .rec-modal-title { display:flex; align-items:center; gap:10px; font-size:18px; font-weight:800; color:#fff; }
        .rec-count-badge { background:rgba(255,255,255,0.25); color:#fff; border-radius:20px; padding:3px 12px; font-size:13px; font-weight:800; }
        .rec-modal-close { background:rgba(255,255,255,0.2); border:none; border-radius:10px; padding:7px; cursor:pointer; color:#fff; display:flex; align-items:center; justify-content:center; transition:background 0.15s; }
        .rec-modal-close:hover { background:rgba(255,255,255,0.35); }
        .rec-clear-all-btn { background:rgba(255,255,255,0.15); border:1.5px solid rgba(255,255,255,0.35); color:#fff; border-radius:10px; padding:7px 14px; font-size:13px; font-weight:700; cursor:pointer; }
        .rec-clear-all-btn:hover { background:rgba(255,255,255,0.25); }

        .rec-modal-body { overflow-y:auto; padding:20px 24px; flex:1; }

        /* ── Tabs row (Summarized / Full Recording) ── */
        .rec-tabs-row { display:flex; gap:10px; padding:16px 24px 0; flex-shrink:0; }
        .rec-tab-pill { flex:1; text-align:left; display:flex; flex-direction:column; gap:2px; padding:11px 16px; border-radius:16px; border:1.5px solid #e0e7ff; background:#fff; cursor:pointer; transition:all 0.2s; }
        .rec-tab-pill:hover { border-color:#c4b5fd; }
        .rec-tab-pill-title { font-size:14px; font-weight:800; color:#4338ca; }
        .rec-tab-pill-sub { font-size:11px; color:#818cf8; font-weight:600; }
        .rec-tab-pill-active { background:linear-gradient(135deg,#7c3aed,#6366f1); border-color:transparent; box-shadow:0 6px 18px rgba(124,58,237,0.3); }
        .rec-tab-pill-active .rec-tab-pill-title { color:#fff; }
        .rec-tab-pill-active .rec-tab-pill-sub { color:rgba(255,255,255,0.85); }

        /* ── Toolbar ── */
        .rec-toolbar { display:flex; gap:8px; padding:14px 24px 0; flex-shrink:0; flex-wrap:wrap; }
        .rec-search { flex:2; min-width:160px; padding:10px 14px; border-radius:12px; border:1.5px solid #e2e8f0; font-size:13px; font-family:inherit; outline:none; }
        .rec-search:focus { border-color:#a78bfa; }
        .rec-toolbar-select { flex:1; min-width:130px; padding:10px 12px; border-radius:12px; border:1.5px solid #e2e8f0; font-size:13px; font-family:inherit; background:#fff; color:#475569; cursor:pointer; }

        /* ── Recording cards (legacy TTS history layout) ── */
        .rec-list { display:flex; flex-direction:column; gap:14px; }
        .rec-card { background:#f8fafc; border-radius:18px; padding:16px 18px; border:1.5px solid #e2e8f0; }
        .rec-card-top { display:flex; align-items:center; gap:10px; margin-bottom:12px; }
        .rec-index-badge { background:linear-gradient(135deg,#7c3aed,#6366f1); color:#fff; border-radius:10px; padding:4px 12px; font-size:13px; font-weight:800; white-space:nowrap; flex-shrink:0; }
        .rec-meta { flex:1; display:flex; flex-direction:column; gap:2px; }
        .rec-date { font-size:12px; font-weight:600; color:#475569; }
        .rec-duration { font-size:11px; color:#94a3b8; font-weight:500; }
        .rec-delete-btn { background:#fef2f2; border:1.5px solid #fca5a5; color:#ef4444; border-radius:10px; padding:7px; cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .rec-delete-btn:hover { background:#fee2e2; }
        .rec-transcript { background:#fff; border-radius:12px; padding:12px 14px; margin-bottom:12px; border:1px solid #e0e7ff; }
        .rec-transcript-label { font-size:11px; font-weight:800; color:#6366f1; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:5px; }
        .rec-transcript-text { font-size:14px; color:#1e293b; line-height:1.6; margin:0; font-style:italic; }
        .rec-no-transcript { font-size:13px; color:#94a3b8; font-style:italic; margin:0 0 12px; text-align:center; }
        .rec-audio-row { display:flex; align-items:center; gap:10px; }
        .rec-play-btn { display:flex; align-items:center; gap:7px; padding:9px 18px; border-radius:12px; border:none; cursor:pointer; font-size:13px; font-weight:700; background:linear-gradient(135deg,#7c3aed,#6366f1); color:#fff; box-shadow:0 4px 12px rgba(124,58,237,0.25); transition:transform 0.15s; }
        .rec-play-btn:hover { transform:scale(1.04); }
        .rec-play-btn-active { background:linear-gradient(135deg,#f59e0b,#f97316); box-shadow:0 4px 12px rgba(245,158,11,0.25); }
        .rec-reuse-btn { display:flex; align-items:center; gap:6px; padding:9px 16px; border-radius:12px; border:1.5px solid #a7f3d0; cursor:pointer; font-size:13px; font-weight:700; background:#ecfdf5; color:#0d9488; transition:transform 0.15s; }
        .rec-reuse-btn:hover { transform:scale(1.04); background:#d1fae5; }
        .rec-playing-indicator { display:flex; align-items:center; }
        .rec-dot { width:6px; height:6px; background:#f59e0b; border-radius:50%; margin-right:3px; animation:csfBounce 0.6s ease-in-out infinite; }
        .rec-dot:nth-child(2){animation-delay:0.15s} .rec-dot:nth-child(3){animation-delay:0.3s}

        /* ── New recording cards (card-2, Summarized / Full tabs) ── */
        .rec-card-2 { background:#f8fafc; border-radius:18px; padding:16px 18px; border:1.5px solid #e2e8f0; transition:box-shadow 0.3s, border-color 0.3s; }
        .rec-card-2.rec-card-flash { border-color:#a78bfa; box-shadow:0 0 0 4px rgba(167,139,250,0.35); }
        .rec-card-2-top { display:flex; align-items:flex-start; gap:10px; }
        .rec-card-2-heading { flex:1; display:flex; flex-wrap:wrap; align-items:center; gap:8px; min-width:0; }
        .rec-card-2-heading h4 { margin:0; font-size:15px; font-weight:800; color:#1e293b; }
        .rec-patient-pill { background:#fff7ed; color:#c2410c; border-radius:20px; padding:2px 10px; font-size:11px; font-weight:700; white-space:nowrap; }
        .rec-ai-pill { background:#ecfdf5; color:#059669; border-radius:20px; padding:2px 10px; font-size:11px; font-weight:700; white-space:nowrap; }
        .rec-card-2-meta { font-size:12px; color:#94a3b8; font-weight:600; margin:6px 0 12px; }

        /* Summary grid */
        .rec-summary-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px; }
        .rec-summary-box { border-radius:12px; padding:12px 14px; }
        .rec-summary-overview { background:#f5f3ff; }
        .rec-summary-side { display:flex; flex-direction:column; gap:10px; }
        .rec-summary-goals { background:#ecfeff; }
        .rec-summary-next { background:#fefce8; }
        .rec-summary-label { display:block; font-size:10.5px; font-weight:800; letter-spacing:0.4px; color:#6366f1; text-transform:uppercase; margin-bottom:6px; }
        .rec-summary-box p { margin:0; font-size:13px; color:#334155; line-height:1.6; }
        .rec-summary-box ul { margin:0; padding-left:18px; font-size:13px; color:#334155; line-height:1.7; }
        @media (max-width:520px) { .rec-summary-grid { grid-template-columns:1fr; } }

        .rec-summary-skeleton { padding:14px; background:#fff; border-radius:12px; margin-bottom:12px; }
        .rec-shimmer { height:11px; border-radius:6px; margin-bottom:8px; background:linear-gradient(90deg,#e2e8f0 25%,#f1f5f9 50%,#e2e8f0 75%); background-size:200% 100%; animation:recShimmer 1.4s ease-in-out infinite; }
        @keyframes recShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        .rec-summary-skeleton p { margin:6px 0 0; font-size:12px; color:#7c3aed; font-weight:700; }
        .rec-summary-failed { padding:12px 14px; background:#fff7ed; border-radius:12px; margin-bottom:12px; display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; }
        .rec-summary-failed p { margin:0; font-size:12.5px; color:#9a3412; font-weight:600; }
        .rec-retry-btn { background:#fff; border:1.5px solid #fdba74; color:#c2410c; border-radius:10px; padding:6px 14px; font-size:12px; font-weight:800; cursor:pointer; white-space:nowrap; }
        .rec-retry-btn:hover { background:#fff7ed; }

        /* Audio player row */
        .rec-player { display:flex; align-items:center; gap:10px; background:#fff; border-radius:14px; padding:10px 14px; margin-bottom:12px; border:1px solid #e2e8f0; }
        .rec-player-btn { flex-shrink:0; width:36px; height:36px; border-radius:50%; border:none; background:linear-gradient(135deg,#7c3aed,#6366f1); color:#fff; display:flex; align-items:center; justify-content:center; cursor:pointer; }
        .rec-player-bar { flex:1; height:6px; border-radius:4px; background:#e2e8f0; cursor:pointer; position:relative; }
        .rec-player-bar-fill { position:absolute; inset:0; width:0; border-radius:4px; background:linear-gradient(90deg,#7c3aed,#6366f1); }
        .rec-player-time { font-size:11px; color:#64748b; font-weight:700; white-space:nowrap; font-family:'Courier New',monospace; }
        .rec-player-rate { flex-shrink:0; background:#f1f5f9; border:none; border-radius:8px; padding:5px 9px; font-size:11px; font-weight:800; color:#475569; cursor:pointer; }
        .rec-player-rate:hover { background:#e2e8f0; }

        /* Transcript box */
        .rec-transcript-box { background:#fff; border-radius:12px; padding:12px 14px; margin-bottom:12px; border:1px solid #e0e7ff; max-height:180px; overflow-y:auto; }
        .rec-transcript-line { margin:0 0 8px; font-size:13px; color:#334155; line-height:1.6; padding:3px 6px; border-radius:6px; }
        .rec-transcript-line:last-child { margin-bottom:0; }
        .rec-transcript-line-active { background:#f5f3ff; color:#1e293b; font-weight:600; }
        .rec-transcript-ts { font-family:'Courier New',monospace; font-size:11px; font-weight:800; color:#7c3aed; margin-right:6px; }

        .rec-card-actions { display:flex; gap:8px; flex-wrap:wrap; }
        .rec-action-btn { background:#fff; border:1.5px solid #e2e8f0; border-radius:10px; padding:8px 13px; font-size:12px; font-weight:700; color:#475569; cursor:pointer; transition:all 0.15s; }
        .rec-action-btn:hover:not(:disabled) { border-color:#a78bfa; color:#7c3aed; }
        .rec-action-btn:disabled { opacity:0.4; cursor:not-allowed; }

        /* ── Empty state ── */
        .rec-empty { text-align:center; padding:40px 20px; color:#94a3b8; }
        .rec-empty-icon { font-size:56px; display:block; margin-bottom:14px; }
        .rec-empty p { font-size:15px; font-weight:500; line-height:1.7; margin:0; }

        /* ── Recording Saved Modal ── */
        .rsm-modal { background:#fff; border-radius:28px; width:100%; max-width:460px; max-height:90vh; overflow-y:auto; box-shadow:0 24px 80px rgba(0,0,0,0.3); animation:modalSlideUp 0.3s ease; }
        .rsm-header { position:relative; background:linear-gradient(135deg,#7c3aed 0%,#6366f1 50%,#38bdf8 100%); padding:32px 24px 44px; text-align:center; overflow:hidden; }
        .rsm-sparkle { position:absolute; font-size:22px; animation:sfFloat 3s ease-in-out infinite; opacity:0.85; }
        .rsm-sparkle-l { top:18px; left:20px; }
        .rsm-sparkle-r { top:16px; right:22px; animation-delay:0.6s; }
        .rsm-check-circle { width:78px; height:78px; margin:0 auto 14px; border-radius:50%; background:#fff; display:flex; align-items:center; justify-content:center; box-shadow:0 8px 24px rgba(0,0,0,0.18); animation:rsmPop 0.5s cubic-bezier(.34,1.56,.64,1) both; }
        @keyframes rsmPop{0%{transform:scale(0)}60%{transform:scale(1.15)}100%{transform:scale(1)}}
        .rsm-title { margin:0 0 6px; font-size:24px; font-weight:900; color:#fff; text-shadow:0 2px 8px rgba(0,0,0,0.15); }
        .rsm-subtitle { margin:0; font-size:13.5px; color:rgba(255,255,255,0.92); font-weight:600; }

        .rsm-stats-card { position:relative; margin:-30px 20px 0; background:#fff; border-radius:20px; box-shadow:0 10px 28px rgba(0,0,0,0.14); display:flex; padding:16px 8px; }
        .rsm-stat { flex:1; text-align:center; display:flex; flex-direction:column; gap:3px; border-right:1.5px solid #f1f5f9; }
        .rsm-stat:last-child { border-right:none; }
        .rsm-stat strong { font-size:17px; font-weight:900; color:#4338ca; }
        .rsm-stat span { font-size:9.5px; font-weight:800; color:#94a3b8; letter-spacing:0.5px; }

        .rsm-body { padding:20px 24px 24px; }
        .rsm-stored-box { display:flex; gap:10px; background:#faf5ff; border:2px dashed #c4b5fd; border-radius:16px; padding:12px 14px; margin-bottom:16px; }
        .rsm-stored-icon { font-size:20px; flex-shrink:0; }
        .rsm-stored-box strong { font-size:13px; color:#4338ca; display:block; }
        .rsm-stored-box p { margin:3px 0 0; font-size:11.5px; color:#6b7280; line-height:1.5; }

        .rsm-fields { display:flex; flex-direction:column; gap:12px; margin-bottom:14px; }
        .rsm-field { display:flex; flex-direction:column; gap:5px; }
        .rsm-field span { font-size:10.5px; font-weight:800; color:#94a3b8; text-transform:uppercase; letter-spacing:0.5px; }
        .rsm-field input, .rsm-field select { padding:10px 12px; border-radius:12px; border:1.5px solid #e2e8f0; font-size:14px; font-weight:700; color:#1e293b; font-family:inherit; outline:none; }
        .rsm-field input:focus, .rsm-field select:focus { border-color:#a78bfa; }

        .rsm-status { display:flex; align-items:center; gap:8px; padding:10px 14px; border-radius:12px; font-size:12.5px; font-weight:700; margin-bottom:16px; }
        .rsm-status-pending { background:#ecfdf5; color:#059669; }
        .rsm-status-ready { background:#ecfdf5; color:#059669; }
        .rsm-status-failed { background:#fff7ed; color:#c2410c; }
        .rsm-dots { display:inline-flex; gap:3px; }
        .rsm-dots span { width:5px; height:5px; border-radius:50%; background:#059669; animation:csfBounce 0.6s ease-in-out infinite; }
        .rsm-dots span:nth-child(2){animation-delay:0.15s} .rsm-dots span:nth-child(3){animation-delay:0.3s}

        .rsm-actions { display:flex; gap:10px; }
        .rsm-btn-secondary, .rsm-btn-primary { flex:1; border:none; border-radius:14px; padding:13px; font-size:14px; font-weight:800; cursor:pointer; transition:transform 0.15s; }
        .rsm-btn-secondary { background:#f1f5f9; color:#475569; }
        .rsm-btn-secondary:hover { background:#e2e8f0; }
        .rsm-btn-primary { background:linear-gradient(135deg,#7c3aed,#6366f1); color:#fff; box-shadow:0 6px 18px rgba(124,58,237,0.3); }
        .rsm-btn-primary:hover { transform:translateY(-1px); }

        /* ── TTS controls ── */
        .csf-input-area { padding:20px 24px 0; }
        .csf-textarea { width:100%; box-sizing:border-box; background:linear-gradient(135deg,#f8fafc,#f1f5f9); border:2.5px solid #e2e8f0; border-radius:18px; padding:18px; font-size:16px; line-height:1.7; color:#1e293b; resize:none; outline:none; font-family:inherit; transition:border-color 0.2s,box-shadow 0.2s; }
        .csf-textarea:focus { border-color:#059669; box-shadow:0 0 0 4px rgba(5,150,105,0.1); background:#fff; }
        .csf-textarea::placeholder { color:#94a3b8; }
        .csf-controls-row { display:flex; flex-direction:column; gap:10px; padding:16px 24px 0; }
        .csf-control-pill { display:flex; align-items:center; gap:10px; background:#f8fafc; border-radius:14px; padding:12px 16px; border:1.5px solid #e2e8f0; }
        .csf-ctl-emoji { font-size:20px; }
        .csf-control-pill input[type=range] { flex:1; accent-color:#059669; height:6px; }
        .csf-ctl-badge { background:#059669; color:#fff; border-radius:8px; padding:3px 10px; font-size:12px; font-weight:800; min-width:38px; text-align:center; }
        .csf-action-btn { border:none; border-radius:12px; padding:10px 24px; font-size:14px; font-weight:700; cursor:pointer; transition:transform 0.15s; display:block; margin:0 auto; }
        .csf-action-btn:hover { transform:translateY(-2px); }
        .csf-btn-clear { background:#fef2f2; color:#ef4444; border:1.5px solid #fca5a5; }

        /* ── Talk to {patient} ── */
        .talk-card { padding-bottom:0; }
        .talk-view { display:flex; flex-direction:column; }
        .talk-hero {
          background:linear-gradient(135deg,#059669 0%,#0d9488 55%,#38bdf8 100%);
          padding:20px 24px; display:flex; align-items:flex-start; justify-content:space-between; gap:14px; flex-wrap:wrap;
        }
        .talk-hero-text h2 { margin:0 0 4px; font-size:20px; font-weight:800; color:#fff; display:flex; align-items:center; gap:9px; }
        .talk-hero-text p { margin:0; font-size:13px; color:rgba(255,255,255,0.9); font-weight:600; }
        .talk-history-btn {
          display:flex; align-items:center; gap:6px; background:rgba(255,255,255,0.22); backdrop-filter:blur(8px);
          border:1.5px solid rgba(255,255,255,0.5); border-radius:20px; color:#fff; font-size:13px; font-weight:700;
          cursor:pointer; padding:8px 15px; flex-shrink:0; transition:all 0.2s;
        }
        .talk-history-btn:hover { background:rgba(255,255,255,0.35); transform:scale(1.03); }

        .talk-body { padding:20px 24px 24px; }
        .talk-columns { display:flex; gap:22px; align-items:flex-start; }
        .talk-col-left { flex:1; min-width:0; }
        .talk-col-right { width:330px; flex-shrink:0; }
        @media (max-width:760px) { .talk-columns { flex-direction:column; } .talk-col-right { width:100%; } }

        .talk-phrase-group { margin-bottom:14px; }
        .talk-phrase-label { display:flex; align-items:center; gap:6px; font-size:11px; font-weight:800; letter-spacing:0.5px; margin-bottom:8px; }
        .talk-phrase-row { display:flex; flex-wrap:wrap; gap:8px; }
        .talk-phrase-pill { border:none; border-radius:20px; padding:9px 16px; font-size:13.5px; font-weight:700; cursor:pointer; transition:transform 0.15s; font-family:inherit; }
        .talk-phrase-pill:hover:not(:disabled) { transform:translateY(-1px) scale(1.02); }
        .talk-phrase-pill:disabled { opacity:0.5; cursor:not-allowed; }
        .talk-phrase-pill-custom { display:inline-flex; align-items:center; gap:4px; padding:0; border-radius:20px; }
        .talk-phrase-pill-text { border:none; background:none; padding:9px 6px 9px 16px; font-size:13.5px; font-weight:700; cursor:pointer; font-family:inherit; color:inherit; }
        .talk-phrase-remove { border:none; background:rgba(0,0,0,0.08); color:inherit; width:20px; height:20px; border-radius:50%; margin-right:8px; cursor:pointer; font-size:14px; line-height:1; display:flex; align-items:center; justify-content:center; font-family:inherit; }
        .talk-phrase-remove:hover { background:rgba(0,0,0,0.18); }

        .talk-add-pill { display:inline-flex; align-items:center; gap:6px; background:none; border:2px dashed #cbd5e1; border-radius:20px; padding:8px 16px; font-size:13px; font-weight:700; color:#64748b; cursor:pointer; margin-top:2px; margin-bottom:18px; }
        .talk-add-pill:hover { border-color:#0d9488; color:#0d9488; }
        .talk-add-form { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-bottom:18px; background:#f0fdfa; border:1.5px solid #99f6e4; border-radius:16px; padding:10px 12px; }
        .talk-add-form select { border:1.5px solid #e2e8f0; border-radius:10px; padding:8px 10px; font-size:13px; font-family:inherit; background:#fff; }
        .talk-add-form input { flex:1; min-width:140px; border:1.5px solid #e2e8f0; border-radius:10px; padding:8px 12px; font-size:13px; font-family:inherit; outline:none; }
        .talk-add-form input:focus { border-color:#0d9488; }
        .talk-add-confirm { display:flex; align-items:center; gap:4px; border:none; border-radius:10px; padding:8px 14px; background:linear-gradient(135deg,#059669,#0d9488); color:#fff; font-size:13px; font-weight:800; cursor:pointer; }
        .talk-add-cancel { border:none; background:none; color:#94a3b8; font-size:13px; font-weight:700; cursor:pointer; padding:8px 6px; }

        .talk-message-block { margin-bottom:16px; }
        .talk-message-label { display:flex; align-items:center; gap:6px; font-size:11px; font-weight:800; color:#94a3b8; letter-spacing:0.5px; margin-bottom:8px; }
        .talk-textarea {
          width:100%; box-sizing:border-box; border:3px solid #0d9488; border-radius:18px; padding:16px;
          font-size:22px; font-weight:700; color:#134e4a; font-family:inherit; resize:none; outline:none;
          transition:box-shadow 0.2s; background:#f0fdfa;
        }
        .talk-textarea:focus { box-shadow:0 0 0 5px rgba(13,148,136,0.18); }
        .talk-char-count { text-align:right; font-size:11px; color:#94a3b8; font-weight:700; margin-top:4px; }

        .talk-options-row { display:flex; flex-wrap:wrap; gap:10px; margin-bottom:16px; align-items:center; }
        .talk-option-group { display:flex; gap:6px; background:#f8fafc; border-radius:14px; padding:5px; border:1.5px solid #e2e8f0; }
        .talk-cue-group { flex-wrap:wrap; background:none; border:none; padding:0; gap:8px; }
        .talk-opt-chip { display:flex; align-items:center; gap:5px; border:none; background:none; border-radius:10px; padding:7px 12px; font-size:12.5px; font-weight:700; color:#64748b; cursor:pointer; font-family:inherit; white-space:nowrap; }
        .talk-cue-group .talk-opt-chip { background:#fff; border:1.5px solid #e2e8f0; }
        .talk-opt-chip-active { background:linear-gradient(135deg,#059669,#0d9488); color:#fff; }
        .talk-cue-group .talk-opt-chip-active { border-color:transparent; }
        .talk-cue-clear { border:none; background:none; color:#94a3b8; font-size:12px; font-weight:700; cursor:pointer; text-decoration:underline; }

        .talk-say-btn { display:flex; align-items:center; justify-content:center; gap:9px; width:100%; border:none; border-radius:18px; padding:17px; background:linear-gradient(135deg,#059669,#0d9488); color:#fff; font-size:17px; font-weight:800; cursor:pointer; box-shadow:0 10px 26px rgba(5,150,105,0.32); transition:transform 0.15s; }
        .talk-say-btn:hover:not(:disabled) { transform:translateY(-2px); }
        .talk-say-btn:disabled { opacity:0.4; cursor:not-allowed; box-shadow:none; }

        .talk-session-card { background:#f0fdfa; border-radius:20px; border:1.5px solid #ccfbf1; padding:16px; position:sticky; top:16px; }
        .talk-session-title { display:flex; align-items:center; gap:6px; font-size:11px; font-weight:800; color:#0d9488; letter-spacing:0.4px; margin-bottom:12px; }
        .talk-session-log { display:flex; flex-direction:column; gap:10px; max-height:340px; overflow-y:auto; margin-bottom:14px; }
        .talk-session-empty { font-size:12.5px; color:#94a3b8; font-style:italic; margin:0; }
        .talk-log-row { display:flex; align-items:flex-start; gap:8px; font-size:12.5px; }
        .talk-log-time { color:#0d9488; font-weight:800; font-family:'Courier New',monospace; flex-shrink:0; }
        .talk-log-text { flex:1; color:#334155; font-weight:600; line-height:1.5; }
        .talk-log-replay { flex-shrink:0; border:none; background:#ccfbf1; color:#0d9488; width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; }
        .talk-log-replay:hover { background:#99f6e4; }
        .talk-copy-btn { width:100%; display:flex; align-items:center; justify-content:center; gap:7px; border:none; border-radius:12px; padding:11px; background:#fff; color:#0d9488; border:1.5px solid #99f6e4; font-size:13px; font-weight:800; cursor:pointer; }
        .talk-copy-btn:hover:not(:disabled) { background:#ccfbf1; }
        .talk-copy-btn:disabled { opacity:0.4; cursor:not-allowed; }

        .talk-toast { position:fixed; bottom:28px; left:50%; transform:translateX(-50%); background:#134e4a; color:#fff; padding:11px 22px; border-radius:14px; font-size:13.5px; font-weight:700; box-shadow:0 10px 30px rgba(0,0,0,0.25); z-index:1300; animation:modalFadeIn 0.2s ease; }

        /* ── Talk to {patient} — patient screen ── */
        .talk-patient-topbar { display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; flex-wrap:wrap; gap:10px; }
        .talk-back-btn { display:flex; align-items:center; gap:7px; border:1.5px solid #e2e8f0; background:#fff; border-radius:12px; padding:9px 15px; font-size:13px; font-weight:700; color:#334155; cursor:pointer; }
        .talk-back-btn:hover { border-color:#99f6e4; color:#0d9488; }
        .talk-speed-chip { display:flex; align-items:center; gap:5px; background:#f0fdfa; border:1.5px solid #ccfbf1; border-radius:20px; padding:6px 13px; font-size:12px; font-weight:800; color:#0d9488; }

        .talk-stage { display:flex; align-items:center; gap:24px; flex-wrap:wrap; justify-content:center; margin-bottom:20px; }
        .talk-mascot { flex-shrink:0; }
        .talk-bubble {
          flex:1; min-width:260px; max-width:480px; position:relative;
          background:linear-gradient(135deg,#ffffff,#f0fdfa); border:4px solid #99f6e4; border-radius:32px;
          padding:28px 30px;
        }
        .talk-bubble::before {
          content:''; position:absolute; left:-22px; top:50%; transform:translateY(-50%);
          border:12px solid transparent; border-right-color:#99f6e4;
        }
        .talk-bubble::after {
          content:''; position:absolute; left:-16px; top:50%; transform:translateY(-50%);
          border:10px solid transparent; border-right-color:#f0fdfa;
        }
        .talk-bubble-text { margin:0; font-size:32px; font-weight:800; line-height:1.5; }
        @media (max-width:600px) { .talk-bubble-text { font-size:24px; } .talk-bubble::before, .talk-bubble::after { display:none; } }
        .talk-word-pending { color:#cbd5e1; }
        .talk-word-said { color:#0d9488; }
        .talk-word-current { background:#fde68a; box-shadow:0 3px 0 #f59e0b; border-radius:6px; padding:0 2px; color:#1e293b; }

        .talk-cue-pill { display:flex; align-items:center; gap:10px; justify-content:center; margin:0 auto 20px; width:fit-content; background:#f5f3ff; color:#6d28d9; border-radius:24px; padding:12px 26px; font-size:19px; font-weight:800; }
        .talk-cue-emoji { font-size:34px; }

        .talk-replay-area { display:flex; flex-direction:column; align-items:center; gap:10px; }
        .talk-replay-btn { width:120px; height:120px; border-radius:50%; border:none; background:linear-gradient(135deg,#059669,#0d9488); color:#fff; display:flex; align-items:center; justify-content:center; cursor:pointer; box-shadow:0 12px 32px rgba(5,150,105,0.4); transition:transform 0.15s; }
        .talk-replay-btn:hover { transform:scale(1.06); }
        .talk-replay-btn:active { transform:scale(0.96); }
        .talk-replay-label { font-size:15px; font-weight:800; color:#0d9488; }
      `}</style>
    </div>
  )
}
