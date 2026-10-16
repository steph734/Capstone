import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Download, File, FileText, Globe, Info, Mic, MicOff, Pause, Play, Sheet, Square, TriangleAlert, Undo2, Volume2 } from 'lucide-react'
import { COMMAND_HELP, SECTION_LABELS, SECTION_LETTER } from '../../../utils/voiceCommands'
import { downloadVoiceLog } from './voiceApi'
import './voice.css'

const TIME_OPTS = { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' }
const fmtTime = (iso) => new Date(iso).toLocaleTimeString('en-US', TIME_OPTS)
const FORMATS = [
  { key: 'pdf', label: 'PDF', hint: 'Printable, with patient, date and therapist name', Icon: FileText, tone: 'red' },
  { key: 'csv', label: 'CSV', hint: 'Open in Excel or Google Sheets', Icon: Sheet, tone: 'green' },
  { key: 'txt', label: 'TXT', hint: 'Plain text transcript', Icon: File, tone: 'blue' },
]

// Format + "include" choices, then the download. Used in the Voice log card and in the notes list.
export function VoiceDownloadMenu({ noteId, beforeDownload, onClose, floating = false }) {
  const [format, setFormat] = useState('pdf')
  const [commands, setCommands] = useState(true)
  const [dictation, setDictation] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [onClose])

  const go = async () => {
    setBusy(true); setError('')
    try {
      if (beforeDownload) await beforeDownload()
      await downloadVoiceLog(noteId, { format, commands, dictation })
      onClose()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  return (
    <div className={`vn-menu${floating ? ' floating' : ''}`} ref={ref} role="dialog" aria-label="Download voice log">
      <p className="vn-menu-title">Download voice log as</p>
      <div className="vn-formats" role="radiogroup" aria-label="File format">
        {FORMATS.map(({ key, label, hint, Icon, tone }) => (
          <button key={key} type="button" role="radio" aria-checked={format === key} className={`vn-format${format === key ? ' on' : ''}`} onClick={() => setFormat(key)}>
            <Icon size={18} className={`vn-format-ico ${tone}`} aria-hidden="true" />
            <span><b>{label}</b><small>{hint}</small></span>
          </button>
        ))}
      </div>
      <label className="vn-check"><input type="checkbox" checked={commands} onChange={(e) => setCommands(e.target.checked)} /><span className="vn-box" aria-hidden="true"><Check size={12} /></span> Include commands (Next section, Undo…)</label>
      <label className="vn-check"><input type="checkbox" checked={dictation} onChange={(e) => setDictation(e.target.checked)} /><span className="vn-box" aria-hidden="true"><Check size={12} /></span> Include dictated text</label>
      {error && <p className="vn-error" role="alert">{error}</p>}
      <button type="button" className="vn-download-go" onClick={go} disabled={busy || (!commands && !dictation)}>
        <Download size={16} aria-hidden="true" /> {busy ? 'Preparing…' : `Download ${format.toUpperCase()}`}
      </button>
    </div>
  )
}

// The pink "Dictate / Listening… / Dictated" button on each SOAP section.
export function SectionVoicePill({ listening, dictated, disabled, title, onClick }) {
  if (listening) return <button type="button" className="vn-pill listening" onClick={onClick} title={title}><Mic size={14} aria-hidden="true" /> Listening…</button>
  if (dictated) return <button type="button" className="vn-pill dictated" onClick={onClick} disabled={disabled} title={title}><Check size={14} aria-hidden="true" /> Dictated</button>
  return <button type="button" className="vn-pill" onClick={onClick} disabled={disabled} title={title}><Mic size={14} aria-hidden="true" /> Dictate</button>
}

// Sticky bar above the SOAP sections.
export function VoiceBar({ voice, enabled, disabledReason }) {
  const { isListening, isPaused, activeSection, language } = voice
  const live = isListening && !isPaused
  const heading = !isListening ? 'Voice dictation' : isPaused ? `Paused · ${SECTION_LABELS[activeSection]}` : `Listening · ${SECTION_LABELS[activeSection]}`
  return (
    <div className={`vn-bar${isListening ? ' active' : ''}`} role="region" aria-label="Voice dictation">
      <button type="button" className={`vn-mic${live ? ' live' : ''}`} disabled={!enabled}
        title={enabled ? (isListening ? 'Stop dictation' : 'Start dictation') : disabledReason}
        aria-label={isListening ? 'Stop dictation' : 'Start dictation'} aria-pressed={isListening}
        onClick={() => (isListening ? voice.stop() : voice.start(activeSection))}>
        {enabled ? <Mic size={22} aria-hidden="true" /> : <MicOff size={22} aria-hidden="true" />}
      </button>
      <div className="vn-bar-text">
        <strong>{heading}</strong>
        <span>{enabled ? (isListening ? 'Speak naturally. Say "next section" to move on.' : 'Tap the mic, then speak. Typing still works.') : disabledReason}</span>
      </div>
      <div className={`vn-wave${live ? ' on' : ''}`} aria-hidden="true">{Array.from({ length: 22 }, (_, i) => <i key={i} style={{ '--i': i }} />)}</div>
      <div className="vn-bar-actions">
        <label className="vn-lang"><Globe size={14} aria-hidden="true" />
          <select value={language} onChange={(e) => voice.setLanguage(e.target.value)} aria-label="Dictation language" disabled={!enabled}>
            <option value="en-US">English</option>
            <option value="fil-PH">Filipino</option>
          </select><ChevronDown size={13} aria-hidden="true" />
        </label>
        {isListening && (
          <>
            {isPaused
              ? <button type="button" className="vn-act" onClick={voice.resume}><Play size={14} aria-hidden="true" /> Resume</button>
              : <button type="button" className="vn-act" onClick={voice.pause}><Pause size={14} aria-hidden="true" /> Pause</button>}
            <button type="button" className="vn-act" onClick={voice.undoActive}><Undo2 size={14} aria-hidden="true" /> Undo</button>
            <button type="button" className="vn-act" onClick={voice.stop}><Square size={13} aria-hidden="true" /> Stop</button>
          </>
        )}
      </div>
    </div>
  )
}

const FILTERS = [['all', 'All'], ['command', 'Commands'], ['dictation', 'Dictation']]

// "Voice commands" help card + the "Voice log" card (filter, rows, download).
export function VoicePanel({ log, noteId, supported, enabled, disabledReason, onBeforeDownload, notice }) {
  const [filter, setFilter] = useState('all')
  const [showAll, setShowAll] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const rows = useMemo(() => {
    const sorted = [...log].sort((a, b) => new Date(a.time || a.spoken_at) - new Date(b.time || b.spoken_at))
    return filter === 'all' ? sorted : sorted.filter((e) => e.type === filter)
  }, [log, filter])
  const shown = showAll ? rows : rows.slice(-6)

  return (
    <aside className="vn-aside" aria-label="Voice tools">
      <section className="vn-card">
        <h3><Mic size={16} aria-hidden="true" /> Voice commands</h3>
        <p className="vn-card-sub">Say these while dictating</p>
        <dl className="vn-cmds">
          {COMMAND_HELP.map(([say, does]) => <div key={say}><dt>{say}</dt><dd>{does}</dd></div>)}
        </dl>
        {!supported && <p className="vn-warn"><TriangleAlert size={14} aria-hidden="true" /> Voice dictation needs Chrome or Edge.</p>}
        {supported && !enabled && disabledReason && <p className="vn-warn"><Info size={14} aria-hidden="true" /> {disabledReason}</p>}
      </section>

      <section className="vn-card">
        <div className="vn-log-head">
          <div>
            <h3><Volume2 size={16} aria-hidden="true" /> Voice log</h3>
            <p className="vn-card-sub">Everything said during this note · {log.length} item{log.length === 1 ? '' : 's'}</p>
          </div>
          <div className="vn-menu-anchor">
            <button type="button" className="vn-download-btn" onClick={() => setMenuOpen((o) => !o)} disabled={!noteId && log.length === 0} aria-expanded={menuOpen}
              title={noteId ? undefined : 'Save a draft first'}>
              <Download size={14} aria-hidden="true" /> Download
            </button>
            {menuOpen && noteId && <VoiceDownloadMenu noteId={noteId} beforeDownload={onBeforeDownload} onClose={() => setMenuOpen(false)} floating />}
            {menuOpen && !noteId && <div className="vn-menu floating"><p className="vn-menu-title">Save a draft first</p><p className="vn-card-sub">The voice log can be downloaded once the note is saved.</p></div>}
          </div>
        </div>
        <div className="vn-chips" role="tablist" aria-label="Filter voice log">
          {FILTERS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={filter === k} className={filter === k ? 'on' : ''} onClick={() => { setFilter(k); setShowAll(false) }}>{l}</button>)}
        </div>
        {rows.length === 0 ? <p className="vn-empty">Nothing here yet. Tap the mic and start speaking.</p> : (
          <ul className="vn-rows">
            {shown.map((e, i) => (
              <li key={`${e.time || e.spoken_at}-${i}`}>
                <time>{fmtTime(e.time || e.spoken_at)}</time>
                <span className={`vn-tag ${e.type}`}>{e.type === 'command' ? 'Command' : 'Dictation'}</span>
                <b className="vn-sec" title={SECTION_LABELS[e.section] || ''}>{SECTION_LETTER[e.section] || '—'}</b>
                <span className="vn-row-text" title={e.text}>
                  &ldquo;{e.text}&rdquo;{e.type === 'command' && e.result ? ` → ${e.result}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
        {rows.length > 6 && <button type="button" className="vn-showall" onClick={() => setShowAll((s) => !s)}>{showAll ? 'Show latest 6' : `Show all ${rows.length}`}</button>}
        {notice && <p className="vn-warn" role="status"><TriangleAlert size={14} aria-hidden="true" /> {notice}</p>}
      </section>

      <p className="vn-privacy"><Info size={15} aria-hidden="true" /> Review the text before saving. Speech is turned into text by your browser and may mishear names or numbers. Audio is not saved; the voice log keeps the text only.</p>
    </aside>
  )
}

// "Clear section" never happens silently.
export function ClearSectionConfirm({ section, onConfirm, onCancel }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])
  return (
    <div className="vn-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="vn-modal" role="alertdialog" aria-labelledby="vn-clear-title">
        <h3 id="vn-clear-title">Clear the {SECTION_LABELS[section]} section?</h3>
        <p>Everything in this section will be removed. You can still type new text afterwards.</p>
        <div className="vn-modal-actions">
          <button type="button" className="vn-act dark" onClick={onCancel} autoFocus>Keep it</button>
          <button type="button" className="vn-act danger" onClick={onConfirm}>Clear section</button>
        </div>
      </div>
    </div>
  )
}
