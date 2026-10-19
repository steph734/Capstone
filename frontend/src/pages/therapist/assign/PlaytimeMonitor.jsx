import { useState } from 'react'
import { Check, Clock, FileText, GripVertical, Pause, Play, Plus, Square } from 'lucide-react'
import { mmss, secondsLeft } from './useLiveMonitor'
import { addResultsToSoap } from './addToSoap'

const pad = (n) => String(n).padStart(2, '0')
const fmt12 = (iso) => { const d = new Date(new Date(iso).getTime() + 8 * 3600000); const h = d.getUTCHours(); return `${h % 12 || 12}:${pad(d.getUTCMinutes())} ${h >= 12 ? 'PM' : 'AM'}` }
const cap = (s) => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1)

export const STATUS_TEXT = (lv, playing) => (lv.status === 'scheduled' ? 'Not started' : lv.status === 'paused' ? 'Paused' : lv.status === 'ended' ? "Time's up" : playing ? 'Playing' : 'Open')

function Ring({ left, total, color }) {
  const r = 88
  const c = 2 * Math.PI * r
  const frac = total > 0 ? Math.max(0, Math.min(1, left / total)) : 0
  return (
    <svg viewBox="0 0 200 200" className="pm-ring" role="img" aria-label={`${mmss(left)} left`}>
      <circle cx="100" cy="100" r={r} fill="none" stroke="#e5efe9" strokeWidth="16" />
      <circle cx="100" cy="100" r={r} fill="none" stroke={color} strokeWidth="16" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} transform="rotate(-90 100 100)" style={{ transition: 'stroke-dashoffset .9s linear, stroke .4s' }} />
      <text x="100" y="104" textAnchor="middle" className="pm-big">{mmss(left)}</text>
      <text x="100" y="130" textAnchor="middle" className="pm-small">left of {mmss(total)}</text>
    </svg>
  )
}

// The live monitor that replaces the setup form once a plan exists. `offset` = server clock minus ours.
export default function PlaytimeMonitor({ lv, first, offset, today, onAct, onExtend, onEdit, onToast }) {
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [soapBusy, setSoapBusy] = useState(false)
  const left = secondsLeft(lv, offset)
  const color = lv.status === 'ended' || left === 0 ? '#dc2626' : left <= 300 && lv.status === 'active' ? '#f59e0b' : '#2c8a64'
  const np = lv.nowPlaying
  const nowMs = Date.now() + offset
  const inGame = np ? np.secondsInGame + Math.max(0, Math.round((nowMs - new Date(lv.now).getTime()) / 1000)) + 0 : 0
  const lastTapMin = np ? Math.max(0, Math.floor((nowMs - new Date(np.lastInputAt).getTime()) / 60000)) : 0
  const running = lv.status === 'active' || lv.status === 'paused' || lv.status === 'scheduled'

  const soap = async () => {
    setSoapBusy(true)
    try {
      const r = await addResultsToSoap({ planId: lv.planId, patientId: lv.patientId, today })
      onToast?.(r.created ? 'Created a draft note with the game results.' : 'Added the game results to the Objective section.', r.undo ? { label: 'Undo', run: r.undo } : null)
    } catch (e) { onToast?.(e.message || 'Could not add the results.') } finally { setSoapBusy(false) }
  }

  return (
    <div className="pm-wrap">
      <section className="ag-card pm-top">
        <Ring left={left} total={lv.totalSeconds} color={color} />
        <div className="pm-info">
          <span className={`pm-chip ${lv.status}${np ? ' playing' : ''}`}><i />{STATUS_TEXT(lv, np)}</span>
          <h3>Play time for {lv.patient.name}</h3>
          <p>
            {lv.startManually && lv.status === 'scheduled' ? 'Starts when you press Start play time' : `Started ${fmt12(lv.playStart)}`} · ends <b>{fmt12(lv.playEnd)}</b>
            {lv.warnAt ? ` · warning at ${fmt12(lv.warnAt)}` : ''} · finish current game: {lv.allowFinishCurrent ? 'on' : 'off'}
          </p>
          <div className="pm-btns">
            {lv.status === 'scheduled' && lv.startManually && <button type="button" className="pm-primary" onClick={() => onAct('start')}><Play size={16} /> Start play time</button>}
            {lv.status === 'active' && <button type="button" onClick={() => onAct('pause')}><Pause size={16} /> Pause</button>}
            {lv.status === 'paused' && <button type="button" className="pm-primary" onClick={() => onAct('resume')}><Play size={16} /> Resume</button>}
            {running && <button type="button" onClick={() => onExtend(5)} disabled={lv.extendedMinutes >= 30} title={lv.extendedMinutes >= 30 ? 'You can add at most 30 minutes in total' : ''}><Plus size={16} /> +5 min</button>}
            <button type="button" onClick={onEdit}><GripVertical size={16} /> Edit plan</button>
            {running && <button type="button" className="pm-danger" onClick={() => setConfirmEnd(true)}><Square size={16} /> End now</button>}
          </div>
          {np && (
            <div className="pm-now" aria-live="polite">
              <Play size={16} aria-hidden="true" /> Now playing: <b>{np.name}</b> · {mmss(inGame)} in game{np.round != null && np.totalRounds ? ` · round ${np.round} of ${np.totalRounds}` : np.round != null ? ` · round ${np.round}` : ''} · last tap {lastTapMin < 1 ? 'just now' : `${lastTapMin} min ago`}
            </div>
          )}
        </div>
      </section>

      <div className="pm-lower">
        <section className="ag-card">
          <div className="ag-head"><span className="ag-icon"><Play size={20} /></span><div><h3>Today&apos;s game plan · live</h3><p>{lv.summary.done} of {lv.summary.total} done · {lv.summary.minutesPlayed} of {lv.games.reduce((s, g) => s + g.plannedMinutes, 0)} planned minutes used</p></div></div>
          <ul className="pm-games">
            {lv.games.map((g) => (
              <li key={g.gameId} className={g.status}>
                <span className="pm-gico">{g.status === 'done' ? <Check size={18} /> : g.status === 'in_progress' ? <Play size={16} /> : <Clock size={16} />}</span>
                <span className="pm-gtext"><b>{g.name}</b><small>{g.status === 'pending' ? `${g.plannedMinutes} min planned` : [g.score != null ? `${g.score}` : null, g.accuracy != null ? `${g.accuracy}%` : null, `${g.hints || 0} hint${g.hints === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}</small></span>
                <span className={`pm-spill ${g.status}`}>{g.status === 'done' ? 'Done' : g.status === 'in_progress' ? 'Playing' : 'Waiting'}</span>
                <span className="pm-time">{g.secondsPlayed ? mmss(g.secondsPlayed) : '—'}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="ag-card">
          <div className="ag-head"><span className="ag-icon"><FileText size={20} /></span><div><h3>Session summary so far</h3><p>Updates every few seconds</p></div></div>
          <div className="pm-stats">
            <div><b>{lv.summary.done}/{lv.summary.total}</b><small>Games done</small></div>
            <div><b>{lv.summary.minutesPlayed}m</b><small>Played</small></div>
            <div><b>{lv.summary.accuracy != null ? `${lv.summary.accuracy}%` : '—'}</b><small>Accuracy</small></div>
            <div><b>{lv.summary.hints}</b><small>Hints</small></div>
          </div>
          <button type="button" className="ag-assign" onClick={soap} disabled={soapBusy || lv.summary.minutesPlayed === 0 && lv.summary.done === 0}><FileText size={18} /> {soapBusy ? 'Adding…' : 'Add results to SOAP notes'}</button>
          <p className="ag-note">Adds the game results to the Objective section of today&apos;s note for {first}.</p>
        </section>
      </div>

      {confirmEnd && (
        <div className="pm-modal" role="alertdialog" aria-modal="true" aria-label="End play time">
          <div>
            <h3>End play time now?</h3>
            <p>{first}&apos;s games lock right away. A game in progress is closed unless you allowed finishing it.</p>
            <div><button type="button" onClick={() => setConfirmEnd(false)}>Keep playing</button><button type="button" className="pm-danger" onClick={() => { setConfirmEnd(false); onAct('end') }}>End now</button></div>
          </div>
        </div>
      )}
    </div>
  )
}

export { cap }
