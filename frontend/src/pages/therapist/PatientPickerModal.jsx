import { useState, useEffect, useMemo, useRef } from 'react'
import {
  UsersIcon, XIcon, SearchIcon, CalendarIcon, ChevronDownIcon, CakeIcon,
  StethoscopeIcon, DotIcon, ClockIcon, MicIcon, VolumeIcon, CheckIcon,
  ArrowRightIcon, FlaskIcon,
} from '../../components/icons/SpeechIcons'

const AVATAR_PALETTE = [
  '#7c3aed', '#2563eb', '#db2777', '#ea580c', '#059669', '#0891b2', '#9333ea', '#dc2626',
]

function avatarColorFor(id) {
  const s = String(id || '')
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length]
}

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
}

function formatDate(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

function isToday(iso) {
  if (!iso) return false
  return iso === new Date().toISOString().slice(0, 10)
}

export default function PatientPickerModal({ therapistEmail, initialTool = 'stt', onSelect, onPracticeMode, onClose }) {
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('today')
  const [sortOpen, setSortOpen] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [tool, setTool] = useState(initialTool)
  const [remember, setRemember] = useState(true)
  const listRef = useRef(null)

  const load = () => {
    setLoading(true); setError('')
    fetch(`/api/patients/therapist-list?email=${encodeURIComponent(therapistEmail)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((body) => {
        const list = body.patients || []
        setPatients(list)
        const todayPatient = list.find((p) => isToday(p.lastSessionDate))
        setSelectedId(todayPatient?.id ?? null)
      })
      .catch((err) => setError(err.message || 'Could not load your patients.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { if (therapistEmail) load(); else { setLoading(false); setError('Missing account email.') } // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [therapistEmail])

  const filtered = useMemo(() => {
    let list = patients
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((p) => (p.name || '').toLowerCase().includes(q))
    }
    list = [...list].sort((a, b) => {
      if (sort === 'today') {
        const aToday = isToday(a.lastSessionDate), bToday = isToday(b.lastSessionDate)
        if (aToday !== bToday) return aToday ? -1 : 1
        const aDate = a.lastSessionDate || '', bDate = b.lastSessionDate || ''
        return bDate.localeCompare(aDate)
      }
      return (a.name || '').localeCompare(b.name || '')
    })
    return list
  }, [patients, search, sort])

  const selectedPatient = filtered.find((p) => p.id === selectedId) || patients.find((p) => p.id === selectedId) || null

  const handleKeyDown = (e) => {
    if (!filtered.length) return
    const idx = filtered.findIndex((p) => p.id === selectedId)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const next = filtered[Math.min(filtered.length - 1, idx + 1)] || filtered[0]
      setSelectedId(next.id)
      document.getElementById(`ppm-card-${next.id}`)?.scrollIntoView({ block: 'nearest' })
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const prev = filtered[Math.max(0, idx - 1)] || filtered[0]
      setSelectedId(prev.id)
      document.getElementById(`ppm-card-${prev.id}`)?.scrollIntoView({ block: 'nearest' })
    } else if (e.key === 'Enter' && selectedPatient) {
      e.preventDefault()
      onSelect(selectedPatient, tool, remember)
    }
  }

  const handleBackdrop = (e) => { if (e.target === e.currentTarget) onClose?.() }

  return (
    <div className="ppm-backdrop" onClick={handleBackdrop}>
      <div className="ppm-modal" onKeyDown={handleKeyDown} tabIndex={-1}>
        <div className="ppm-header">
          <div className="ppm-header-top">
            <div className="ppm-header-icon"><UsersIcon size={28} /></div>
            <div className="ppm-header-text">
              <h2>Who is this session for?</h2>
            </div>
            <button className="ppm-close" onClick={onClose} aria-label="Close"><XIcon size={20} /></button>
          </div>
          <p className="ppm-subtitle">
            Choose the patient who will use Speech to Text and Text to Speech. Recordings and speech history are saved to their record.
          </p>
        </div>

        <div className="ppm-body">
          {loading ? (
            <div className="ppm-shimmer-list">
              {[0, 1, 2].map((i) => <div key={i} className="ppm-shimmer-card" />)}
            </div>
          ) : error ? (
            <div className="ppm-error">
              <p>⚠️ {error}</p>
              <button className="ppm-retry-btn" onClick={load}>Retry</button>
            </div>
          ) : patients.length === 0 ? (
            <div className="ppm-empty">
              <p>You don't have any patients yet — they appear here after their first appointment with you.</p>
            </div>
          ) : (
            <>
              <div className="ppm-toolbar">
                <div className="ppm-search">
                  <SearchIcon size={18} />
                  <input placeholder="Search patients by name…" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <div className="ppm-sort-wrap">
                  <button className="ppm-sort-chip" onClick={() => setSortOpen((v) => !v)}>
                    <CalendarIcon size={15} />
                    <span>{sort === 'today' ? "Today's patients first" : 'A–Z'}</span>
                    <ChevronDownIcon size={15} />
                  </button>
                  {sortOpen && (
                    <div className="ppm-sort-menu">
                      <button onClick={() => { setSort('today'); setSortOpen(false) }}>Today's patients first</button>
                      <button onClick={() => { setSort('az'); setSortOpen(false) }}>A–Z</button>
                    </div>
                  )}
                </div>
              </div>

              <div className="ppm-list-label">YOUR PATIENTS · {filtered.length}</div>

              <div className="ppm-list" ref={listRef}>
                {filtered.map((p) => {
                  const selected = p.id === selectedId
                  const color = avatarColorFor(p.id)
                  const lastLabel = formatDate(p.lastSessionDate)
                  return (
                    <button
                      key={p.id}
                      id={`ppm-card-${p.id}`}
                      className={`ppm-card ${selected ? 'ppm-card-selected' : ''}`}
                      onClick={() => setSelectedId(p.id)}
                      type="button"
                    >
                      <span className={`ppm-radio ${selected ? 'ppm-radio-on' : ''}`} />
                      <span className="ppm-avatar" style={{ background: color }}>{initials(p.name)}</span>
                      <span className="ppm-card-main">
                        <span className="ppm-card-name">{p.name}</span>
                        <span className="ppm-card-tags">
                          {p.age != null && <span className="ppm-tag ppm-tag-age"><CakeIcon size={13} />{p.age} yrs</span>}
                          {p.condition && <span className="ppm-tag ppm-tag-condition"><StethoscopeIcon size={13} />{p.condition}</span>}
                          {isToday(p.lastSessionDate) && <span className="ppm-tag ppm-tag-today"><DotIcon size={8} />Session today</span>}
                        </span>
                      </span>
                      <span className="ppm-card-side">
                        <span className="ppm-side-label"><ClockIcon size={13} />Last session</span>
                        <span className="ppm-side-date">{lastLabel || 'No sessions yet'}</span>
                      </span>
                    </button>
                  )
                })}
              </div>

              <div className="ppm-openwith-label">OPEN WITH</div>
              <div className="ppm-openwith-row">
                <button className={`ppm-tool-card ${tool === 'stt' ? 'ppm-tool-card-active' : ''}`} onClick={() => setTool('stt')} type="button">
                  <span className="ppm-tool-icon"><MicIcon size={20} /></span>
                  <span className="ppm-tool-text">
                    <strong>Speech to Text</strong>
                    <span>Record &amp; transcribe the session</span>
                  </span>
                </button>
                <button className={`ppm-tool-card ${tool === 'tts' ? 'ppm-tool-card-active' : ''}`} onClick={() => setTool('tts')} type="button">
                  <span className="ppm-tool-icon"><VolumeIcon size={20} /></span>
                  <span className="ppm-tool-text">
                    <strong>Text to Speech</strong>
                    <span>Read words aloud for the patient</span>
                  </span>
                </button>
              </div>

              <div className="ppm-footer">
                <label className="ppm-remember">
                  <span className={`ppm-checkbox ${remember ? 'ppm-checkbox-on' : ''}`} onClick={() => setRemember((v) => !v)}>
                    {remember && <CheckIcon size={13} />}
                  </span>
                  <span onClick={() => setRemember((v) => !v)}>Remember for this session</span>
                </label>
                <button
                  className="ppm-start-btn"
                  disabled={!selectedPatient}
                  onClick={() => selectedPatient && onSelect(selectedPatient, tool, remember)}
                >
                  <span>Start with {selectedPatient ? String(selectedPatient.name).split(' ')[0] : '…'}</span>
                  <ArrowRightIcon size={18} />
                </button>
              </div>
            </>
          )}

          <button className="ppm-practice-link" onClick={() => onPracticeMode(tool)}>
            <FlaskIcon size={15} />
            <span>Use without a patient (practice mode — nothing is saved to a record)</span>
          </button>
        </div>
      </div>

      <style>{`
        .ppm-backdrop {
          position:fixed; inset:0; background:rgba(15,23,42,0.55);
          backdrop-filter:blur(4px); z-index:1200;
          display:flex; align-items:center; justify-content:center;
          padding:20px; animation:ppmFadeIn 0.2s ease;
        }
        @keyframes ppmFadeIn{from{opacity:0}to{opacity:1}}
        .ppm-modal {
          background:#fff; border-radius:28px; width:100%; max-width:640px;
          max-height:92vh; display:flex; flex-direction:column; overflow:hidden;
          box-shadow:0 24px 80px rgba(0,0,0,0.25); animation:ppmSlideUp 0.25s ease;
          outline:none;
        }
        @keyframes ppmSlideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}

        .ppm-header { background:linear-gradient(135deg,#7c3aed 0%,#6366f1 50%,#38bdf8 100%); padding:22px 24px; flex-shrink:0; }
        .ppm-header-top { display:flex; align-items:center; gap:14px; }
        .ppm-header-icon { width:52px; height:52px; border-radius:16px; background:rgba(255,255,255,0.22); display:flex; align-items:center; justify-content:center; color:#fff; flex-shrink:0; }
        .ppm-header-text { flex:1; }
        .ppm-header-text h2 { margin:0; font-size:21px; font-weight:800; color:#fff; }
        .ppm-close { background:rgba(255,255,255,0.2); border:none; border-radius:10px; padding:7px; cursor:pointer; color:#fff; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .ppm-close:hover { background:rgba(255,255,255,0.35); }
        .ppm-subtitle { margin:12px 0 0; font-size:13px; color:rgba(255,255,255,0.92); font-weight:600; line-height:1.6; }

        .ppm-body { padding:20px 24px 22px; overflow-y:auto; flex:1; display:flex; flex-direction:column; }

        .ppm-toolbar { display:flex; gap:10px; flex-wrap:wrap; }
        .ppm-search { flex:2; min-width:180px; display:flex; align-items:center; gap:8px; padding:10px 14px; border-radius:12px; border:1.5px solid #e2e8f0; color:#94a3b8; }
        .ppm-search input { border:none; outline:none; flex:1; font-size:13.5px; font-family:inherit; color:#1e293b; }
        .ppm-search:focus-within { border-color:#a78bfa; color:#7c3aed; }
        .ppm-sort-wrap { position:relative; }
        .ppm-sort-chip { display:flex; align-items:center; gap:6px; padding:10px 14px; border-radius:12px; border:1.5px solid #e2e8f0; background:#fff; color:#6d28d9; font-size:13px; font-weight:700; cursor:pointer; white-space:nowrap; }
        .ppm-sort-chip:hover { border-color:#c4b5fd; }
        .ppm-sort-menu { position:absolute; top:calc(100% + 6px); right:0; background:#fff; border:1.5px solid #e2e8f0; border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,0.12); overflow:hidden; z-index:5; min-width:180px; }
        .ppm-sort-menu button { display:block; width:100%; text-align:left; padding:10px 14px; border:none; background:#fff; font-size:13px; font-weight:600; color:#334155; cursor:pointer; }
        .ppm-sort-menu button:hover { background:#f5f3ff; color:#6d28d9; }

        .ppm-list-label { font-size:11.5px; font-weight:800; color:#94a3b8; letter-spacing:0.5px; margin:16px 0 8px; }
        .ppm-list { display:flex; flex-direction:column; gap:8px; max-height:340px; overflow-y:auto; padding-right:2px; }

        .ppm-card {
          display:flex; align-items:center; gap:12px; padding:12px 14px; border-radius:16px;
          border:2px solid #e2e8f0; background:#fff; cursor:pointer; text-align:left; width:100%;
          font-family:inherit; transition:all 0.15s;
        }
        .ppm-card:hover { border-color:#c4b5fd; }
        .ppm-card-selected { border-color:#7c3aed; background:#faf5ff; box-shadow:0 4px 16px rgba(124,58,237,0.15); }
        .ppm-radio { width:18px; height:18px; border-radius:50%; border:2px solid #cbd5e1; flex-shrink:0; position:relative; }
        .ppm-radio-on { border-color:#7c3aed; }
        .ppm-radio-on::after { content:''; position:absolute; inset:3px; border-radius:50%; background:#7c3aed; }
        .ppm-avatar { width:40px; height:40px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:800; font-size:14px; flex-shrink:0; }
        .ppm-card-main { flex:1; min-width:0; display:flex; flex-direction:column; gap:5px; }
        .ppm-card-name { font-size:14.5px; font-weight:800; color:#1e293b; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:100%; }
        .ppm-card-tags { display:flex; flex-wrap:wrap; gap:6px; min-width:0; }
        .ppm-tag { display:inline-flex; align-items:center; gap:4px; padding:2px 9px; border-radius:20px; font-size:11.5px; font-weight:700; white-space:nowrap; }
        .ppm-tag-age { background:#f1f5f9; color:#475569; }
        .ppm-tag-condition { background:#ecfeff; color:#0e7490; }
        .ppm-tag-today { background:#ecfdf5; color:#059669; }
        .ppm-card-side { display:flex; flex-direction:column; align-items:flex-end; gap:3px; flex-shrink:0; }
        .ppm-side-label { display:flex; align-items:center; gap:4px; font-size:11px; font-weight:700; color:#94a3b8; white-space:nowrap; }
        .ppm-side-date { font-size:12.5px; font-weight:700; color:#334155; white-space:nowrap; }

        .ppm-openwith-label { font-size:11.5px; font-weight:800; color:#94a3b8; letter-spacing:0.5px; margin:18px 0 8px; }
        .ppm-openwith-row { display:flex; gap:10px; flex-wrap:wrap; }
        .ppm-tool-card { flex:1; min-width:180px; display:flex; align-items:center; gap:12px; padding:14px 16px; border-radius:16px; border:2px solid #e2e8f0; background:#fff; cursor:pointer; text-align:left; font-family:inherit; transition:all 0.15s; }
        .ppm-tool-card:hover { border-color:#c4b5fd; }
        .ppm-tool-icon { width:40px; height:40px; border-radius:12px; background:#ede9fe; color:#6d28d9; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .ppm-tool-text { display:flex; flex-direction:column; gap:2px; }
        .ppm-tool-text strong { font-size:13.5px; font-weight:800; color:#1e293b; }
        .ppm-tool-text span { font-size:11.5px; font-weight:600; color:#94a3b8; }
        .ppm-tool-card-active { border-color:#7c3aed; background:#faf5ff; box-shadow:0 4px 16px rgba(124,58,237,0.15); }
        .ppm-tool-card-active .ppm-tool-icon { background:linear-gradient(135deg,#7c3aed,#6366f1); color:#fff; }

        .ppm-footer { display:flex; align-items:center; justify-content:space-between; gap:14px; margin-top:20px; flex-wrap:wrap; }
        .ppm-remember { display:flex; align-items:center; gap:9px; cursor:pointer; font-size:13px; font-weight:700; color:#334155; }
        .ppm-checkbox { width:20px; height:20px; border-radius:6px; border:2px solid #cbd5e1; display:flex; align-items:center; justify-content:center; color:#fff; flex-shrink:0; cursor:pointer; }
        .ppm-checkbox-on { background:linear-gradient(135deg,#7c3aed,#6366f1); border-color:transparent; }
        .ppm-start-btn { display:flex; align-items:center; gap:8px; padding:13px 22px; border-radius:14px; border:none; background:linear-gradient(135deg,#7c3aed,#6366f1); color:#fff; font-size:14px; font-weight:800; cursor:pointer; box-shadow:0 8px 20px rgba(124,58,237,0.3); transition:transform 0.15s; white-space:nowrap; }
        .ppm-start-btn:hover:not(:disabled) { transform:translateY(-1px); }
        .ppm-start-btn:disabled { opacity:0.45; cursor:not-allowed; box-shadow:none; }

        .ppm-practice-link { display:flex; align-items:center; justify-content:center; gap:7px; width:100%; background:none; border:none; margin-top:16px; padding:4px; font-size:12.5px; font-weight:700; color:#6d28d9; text-decoration:underline; cursor:pointer; }
        .ppm-practice-link:hover { color:#4c1d95; }

        .ppm-shimmer-list { display:flex; flex-direction:column; gap:10px; }
        .ppm-shimmer-card { height:72px; border-radius:16px; background:linear-gradient(90deg,#f1f5f9 25%,#f8fafc 50%,#f1f5f9 75%); background-size:200% 100%; animation:ppmShimmer 1.4s ease-in-out infinite; }
        @keyframes ppmShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}

        .ppm-error { text-align:center; padding:24px; }
        .ppm-error p { color:#dc2626; font-size:14px; font-weight:600; margin:0 0 12px; }
        .ppm-retry-btn { padding:9px 20px; border-radius:12px; border:none; background:linear-gradient(135deg,#7c3aed,#6366f1); color:#fff; font-size:13px; font-weight:800; cursor:pointer; }

        .ppm-empty { text-align:center; padding:28px 12px; }
        .ppm-empty p { color:#64748b; font-size:14px; font-weight:500; line-height:1.7; margin:0; }
      `}</style>
    </div>
  )
}
