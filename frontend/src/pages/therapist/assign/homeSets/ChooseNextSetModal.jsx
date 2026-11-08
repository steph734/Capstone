import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { authFetch } from '../../../../utils/session'
import { daysText, fmt12 } from '../homeSettings'
import { gameEmoji, sessionLong, shortDay } from './gameIcons'

// "Choose the next set of games": pick 2 to 4 games, where to use them, and the starting level. Esc or X closes it; nothing changes until
// "Assign new set". Focus stays inside the dialog while it is open.
const FILTERS = [['all', 'All games'], ['new', 'New for'], ['mastered', 'Mastered (review)']]
const LEVELS = [['warmup', 'Level 1 · Warm-up'], ['continue', 'Continue at Level 2']]

function Switch({ on, onChange, disabled, label }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} className={`hs-switch${on ? ' on' : ''}`} onClick={() => onChange(!on)}><i /></button>
}

export default function ChooseNextSetModal({ patient, config, onClose, onAssigned }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [picked, setPicked] = useState([])
  const [useTherapy, setUseTherapy] = useState(true)
  const [useHome, setUseHome] = useState(true)
  const [level, setLevel] = useState('warmup')
  const [busy, setBusy] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const box = useRef(null)
  const min = config?.minGames ?? 2
  const max = config?.maxGames ?? 4
  const first = patient.firstName

  const load = useCallback(() => {
    setError('')
    authFetch('/api/therapist/home-sets/games', { query: { patientId: patient.patientId } }).then((d) => {
      setData(d)
      if (!d.nextSession) setUseTherapy(false)
      setPicked((cur) => (cur.length ? cur : d.games.filter((g) => g.status === 'new').slice(0, min).map((g) => g.id)))
    }).catch((e) => setError(e.message || 'Could not load the games.'))
  }, [patient.patientId, min])
  useEffect(() => { load() }, [load])

  // Esc closes; Tab stays inside; focus returns to the button that opened the dialog.
  useEffect(() => {
    const back = document.activeElement
    box.current?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose() }
      if (e.key !== 'Tab' || !box.current) return
      const f = [...box.current.querySelectorAll('button:not([disabled]),[href],input,select,[tabindex]:not([tabindex="-1"])')].filter((el) => el.offsetParent !== null)
      if (!f.length) return
      const a = f[0], z = f[f.length - 1]
      if (e.shiftKey && (document.activeElement === a || document.activeElement === box.current)) { e.preventDefault(); z.focus() }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); back?.focus?.() }
  }, [onClose])

  const shown = useMemo(() => (data?.games || []).filter((g) => filter === 'all' || (filter === 'new' ? g.status === 'new' : g.status === 'mastered')), [data, filter])
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= max ? p : [...p, id]))
  const byId = useMemo(() => new Map((data?.games || []).map((g) => [g.id, g])), [data])
  const ok = picked.length >= min && picked.length <= max && (useTherapy || useHome) && !busy
  const mastered = patient.games.map((g) => g.name)
  const masteredText = mastered.length > 1 ? `${mastered.slice(0, -1).join(', ')} and ${mastered[mastered.length - 1]}` : mastered[0]

  const submit = async () => {
    if (!ok) return
    setBusy(true); setSubmitError('')
    try {
      const r = await authFetch('/api/therapist/home-sets/assign', { method: 'POST', body: { patientId: patient.patientId, gameIds: picked, startingLevel: level, useInTherapy: useTherapy, useAtHome: useHome } })
      onAssigned(r)
    } catch (e) { setSubmitError(e.message || 'Could not assign the new set.'); setBusy(false) }
  }

  return (
    <div className="hs-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="hs-modal" role="dialog" aria-modal="true" aria-labelledby="hs-modal-title" tabIndex={-1} ref={box}>
        <header className="hs-modal-head">
          <img src="/games/pao-money-match-poses/pao-level-complete.png" alt="" width="84" height="84" />
          <div>
            <h2 id="hs-modal-title">Choose the next set of games</h2>
            <p>{patient.name} finished {masteredText}. Pick the games for the next therapy session and home practice.</p>
          </div>
          <button type="button" className="hs-x" onClick={onClose} aria-label="Close">×</button>
        </header>

        {error ? (
          <div className="hs-error" role="alert"><span>{error}</span><button type="button" className="hs-btn green" onClick={load}>Retry</button></div>
        ) : !data ? (
          <div className="hs-modal-body"><div className="hs-skel" style={{ height: 260 }} /><div className="hs-skel" style={{ height: 260 }} /></div>
        ) : (
          <div className="hs-modal-body">
            <div className="hs-pick">
              <div className="hs-filters" role="group" aria-label="Filter games">
                {FILTERS.map(([id, label]) => <button key={id} type="button" aria-pressed={filter === id} className={filter === id ? 'on' : ''} onClick={() => setFilter(id)}>{id === 'new' ? `New for ${first}` : label}</button>)}
              </div>
              {shown.length === 0 && <p className="hs-muted">No games match this filter.</p>}
              <ul className="hs-grid">
                {shown.map((g) => {
                  const on = picked.includes(g.id)
                  const full = !on && picked.length >= max
                  return (
                    <li key={g.id}>
                      <button type="button" role="checkbox" aria-checked={on} disabled={full} title={full ? `Pick up to ${max} games` : ''} onClick={() => toggle(g.id)} className={`hs-pickcard${on ? ' on' : ''}${g.status === 'mastered' ? ' dim' : ''}`}>
                        <span className="hs-pick-head"><span className="hs-game-ico" aria-hidden="true">{gameEmoji(g.name)}</span><b>{g.name}</b><span className={`hs-check${on ? ' on' : ''}`} aria-hidden="true">{on ? '✓' : ''}</span></span>
                        <span className="hs-pick-desc">{g.description || 'A therapy game.'}</span>
                        <span className={`hs-tag ${g.recommended ? 'rec' : g.status}`}>
                          {g.recommended ? `★ Recommended · new for ${first}` : g.status === 'new' ? `New for ${first}` : g.status === 'mastered' ? `★ Mastered ${shortDay(g.masteredAt)}` : 'Played before'}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>

            <aside className="hs-side" aria-label={`Set ${data.setNumber} for ${first}`}>
              <h3>Set {data.setNumber} for {first}</h3>
              <ul className="hs-chosen">
                {picked.map((id) => (
                  <li key={id}><span className="hs-game-ico" aria-hidden="true">{gameEmoji(byId.get(id)?.name)}</span><b>{byId.get(id)?.name}</b><button type="button" onClick={() => toggle(id)} aria-label={`Remove ${byId.get(id)?.name}`}>×</button></li>
                ))}
              </ul>
              <p className={`hs-count${picked.length < min ? ' warn' : ''}`}>{picked.length} game{picked.length === 1 ? '' : 's'} selected · pick {min} to {max}</p>

              <h4>Where to use them</h4>
              <div className="hs-where">
                <div><div><b>Next therapy session</b><small>{data.nextSession ? `${sessionLong(data.nextSession)} · ${first} unlocks only these games` : 'No upcoming session is scheduled'}</small></div><Switch on={useTherapy} onChange={setUseTherapy} disabled={!data.nextSession} label="Use in the next therapy session" /></div>
                <div><div><b>Home practice</b><small>Goal {data.home.goal}× per game each week · {daysText(data.home.days)}, {fmt12(data.home.dailyStart).replace(':00', '')}–{fmt12(data.home.dailyEnd).replace(':00', '')}</small></div><Switch on={useHome} onChange={setUseHome} label="Use for home practice" /></div>
              </div>
              {!useTherapy && !useHome && <p className="hs-count warn" role="alert">Choose at least one place to use the games.</p>}

              <h4>Starting level</h4>
              <div className="hs-levels" role="radiogroup" aria-label="Starting level">
                {LEVELS.map(([id, label]) => <button key={id} type="button" role="radio" aria-checked={level === id} className={level === id ? 'on' : ''} onClick={() => setLevel(id)}>{label}</button>)}
              </div>
              <p className="hs-info">Set {data.setNumber - 1} moves to <b>Completed sets</b>. Mastered games stay available to replay for review.</p>
            </aside>
          </div>
        )}

        <footer className="hs-modal-foot">
          <p>{submitError ? <span className="hs-err-text" role="alert">{submitError}</span> : `${first} and the family are notified about the new home practice set.`}</p>
          <button type="button" className="hs-btn" onClick={onClose}>Cancel</button>
          <button type="button" className="hs-btn green" disabled={!ok || !data} onClick={submit}>{busy ? 'Assigning…' : 'Assign new set'}</button>
        </footer>
      </div>
    </div>
  )
}
