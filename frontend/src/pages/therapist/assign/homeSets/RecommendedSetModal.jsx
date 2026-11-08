import { useCallback, useEffect, useRef, useState } from 'react'
import { authFetch } from '../../../../utils/session'
import { daysText, fmt12 } from '../homeSettings'
import Steps from './Steps'
import { gameEmoji, sessionLong } from './gameIcons'

// "Recommended next set for <Name>": what the finished set showed, objectives (editable), and the suggested games with WHY, SUPPORTS,
// BUILDS and START AT. Everything is auto-suggested and can be changed. Assigning stays locked until the SOAP note is signed.
export default function RecommendedSetModal({ patient, config, onClose, onAssigned, onChangeGames }) {
  const [rec, setRec] = useState(null)
  const [env, setEnv] = useState(null) // next session + home window
  const [error, setError] = useState('')
  const [objs, setObjs] = useState([])
  const [editing, setEditing] = useState(false)
  const [useTherapy, setUseTherapy] = useState(true)
  const [useHome, setUseHome] = useState(true)
  const [busy, setBusy] = useState('')
  const [submitError, setSubmitError] = useState('')
  const box = useRef(null)
  const first = patient.firstName

  const load = useCallback(() => {
    setError('')
    Promise.all([
      authFetch(`/api/therapist/home-sets/${patient.setId}/recommendation`),
      authFetch('/api/therapist/home-sets/games', { query: { patientId: patient.patientId } }),
    ]).then(([r, g]) => { setRec(r); setObjs(r.objectives || []); setEnv(g); if (!g.nextSession) setUseTherapy(false) })
      .catch((e) => setError(e.message || 'Could not load the recommendation.'))
  }, [patient.setId, patient.patientId])
  useEffect(() => { load() }, [load])

  useEffect(() => {
    const back = document.activeElement
    box.current?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose() }
      if (e.key !== 'Tab' || !box.current) return
      const f = [...box.current.querySelectorAll('button:not([disabled]),input,[href]')].filter((el) => el.offsetParent !== null)
      if (!f.length) return
      const a = f[0], z = f[f.length - 1]
      if (e.shiftKey && (document.activeElement === a || document.activeElement === box.current)) { e.preventDefault(); z.focus() }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); back?.focus?.() }
  }, [onClose])

  const saveObjectives = async (next) => {
    setObjs(next); setBusy('objectives')
    try { const r = await authFetch(`/api/therapist/home-sets/${patient.setId}/recommendation`, { method: 'PATCH', body: { objectives: next } }); setRec((x) => ({ ...x, recommendation: r.recommendation, objectives: r.objectives })); setObjs(r.objectives) }
    catch (e) { setSubmitError(e.message) } finally { setBusy('') }
  }
  const toggle = (id) => saveObjectives(objs.map((o) => (o.id === id ? { ...o, on: !o.on } : o)))
  const rename = (id, text) => setObjs((l) => l.map((o) => (o.id === id ? { ...o, text } : o)))
  const remove = (id) => saveObjectives(objs.filter((o) => o.id !== id))
  const add = () => setObjs((l) => [...l, { id: `o-${Date.now()}`, text: '', supports: [], stats: [], on: true }])

  const r = rec?.recommendation
  const signed = rec?.noteSigned
  const ids = r?.games.map((g) => g.gameId) || []
  const canAssign = signed && ids.length >= (config?.minGames ?? 2) && (useTherapy || useHome) && !busy
  const assign = async () => {
    if (!canAssign) return
    setBusy('assign'); setSubmitError('')
    try {
      const out = await authFetch('/api/therapist/home-sets/assign', { method: 'POST', body: { patientId: patient.patientId, gameIds: ids, startingLevel: 'warmup', useInTherapy: useTherapy, useAtHome: useHome, objectives: objs } })
      onAssigned(out)
    } catch (e) { setSubmitError(e.message || 'Could not assign the set.'); setBusy('') }
  }

  return (
    <div className="hs-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="hs-modal hs-rec-modal" role="dialog" aria-modal="true" aria-labelledby="hs-rec-title" tabIndex={-1} ref={box}>
        <Steps step={signed ? 3 : 2} playsText={`${patient.playsUsed} of ${patient.playsAllowed} plays done`} labels={[['Home games finished', ''], [signed ? 'SOAP note signed' : 'Review SOAP note', signed ? 'Home practice progress' : 'Sign it to unlock'], ['Approve Set ' + (patient.setNumber + 1), 'Therapy session + home practice']]} style={{ marginBottom: 14 }} />
        <header className="hs-modal-head">
          <img src="/games/pao-money-match-poses/pao-thumbs-up.png" alt="" width="84" height="84" />
          <div>
            <h2 id="hs-rec-title">Recommended next set for {first}</h2>
            <p>Picked from Set {patient.setNumber} results, {first}&apos;s lowest character stat and the objectives below. You can change anything before assigning.</p>
          </div>
          <span className="hs-auto-pill">✨ Auto-suggested</span>
          <button type="button" className="hs-x" onClick={onClose} aria-label="Close">×</button>
        </header>

        {error ? <div className="hs-error" role="alert"><span>{error}</span><button type="button" className="hs-btn green" onClick={load}>Retry</button></div>
          : !r ? <div className="hs-modal-body"><div className="hs-skel" style={{ height: 320 }} /><div className="hs-skel" style={{ height: 320 }} /></div> : (
            <div className="hs-rec-body">
              <aside className="hs-rec-left">
                <h3>What Set {patient.setNumber} showed</h3>
                <ul className="hs-insights">{r.insights.map((i) => <li key={i.text} className={i.tone}>{i.tone === 'low' ? '▲' : i.tone === 'up' ? '↗' : i.tone === 'days' ? '📅' : '✔'} {i.text}</li>)}</ul>
                <div className="hs-obj-head"><h3>Objectives for Set {patient.setNumber + 1}</h3><button type="button" className="hs-link" onClick={() => { if (editing) saveObjectives(objs.filter((o) => o.text.trim())); setEditing((v) => !v) }}>{editing ? 'Done' : 'Edit'}</button></div>
                <ul className="hs-objs">
                  {objs.map((o) => (
                    <li key={o.id}>
                      <input type="checkbox" checked={o.on} onChange={() => toggle(o.id)} aria-label={o.text || 'Objective'} />
                      {editing ? <><input className="hs-obj-text" value={o.text} onChange={(e) => rename(o.id, e.target.value)} aria-label="Objective text" maxLength={200} /><button type="button" className="hs-x-sm" onClick={() => remove(o.id)} aria-label={`Remove ${o.text}`}>×</button></> : <span>{o.text}</span>}
                    </li>
                  ))}
                </ul>
                {editing && <button type="button" className="hs-link" onClick={add}>+ Add objective</button>}
                <p className="hs-obj-note">The games below are matched to these. Change an objective and the picks update. They are drafts for you to approve, not clinical goals set by the app.</p>
              </aside>

              <div className="hs-rec-games-col">
                {r.short && <p className="hs-info">{r.short}</p>}
                {r.games.map((g, i) => (
                  <article key={g.gameId} className="hs-rec-card">
                    <header><span className="hs-game-ico" aria-hidden="true">{gameEmoji(g.name)}</span><div><h4>{g.name}</h4>{g.description && <p>{g.description}</p>}</div><span className="hs-rec-tag">★ Recommended</span></header>
                    <div className="hs-rec-cols">
                      <div>
                        <p className="hs-cap">WHY THIS GAME FOR {first.toUpperCase()}</p>
                        {g.reasons.length ? <ul>{g.reasons.map((x) => <li key={x}>✓ {x}</li>)}</ul> : <p className="hs-muted">Picked by order of play and objective match.</p>}
                      </div>
                      <div>
                        {g.supports.length > 0 && <><p className="hs-cap">SUPPORTS</p><p className="hs-sup">{g.supports.join(' · ')}</p></>}
                        {g.builds.length > 0 && <><p className="hs-cap">BUILDS</p><div className="hs-stat-chips">{g.builds.map((b) => <span key={b}>{b}</span>)}</div></>}
                        <p className="hs-cap">START AT</p><p className="hs-sup"><b>{g.startAt}</b>. {g.startReason}</p>
                      </div>
                    </div>
                  </article>
                ))}
                {r.notPicked.map((g) => (
                  <article key={g.gameId} className="hs-rec-card muted"><header><span className="hs-game-ico" aria-hidden="true">{gameEmoji(g.name)}</span><div><h4>{g.name}</h4><p>{g.reason}</p></div></header></article>
                ))}
                <div className="hs-rec-note">
                  <p>{r.availableText}</p>
                  {r.reviewGame && <p><b>Clinic review:</b> {r.reviewGame.reason}</p>}
                </div>
              </div>
            </div>
          )}

        {r && (
          <div className="hs-rec-where">
            <div><div><b>Next therapy session</b><small>{env?.nextSession ? `${sessionLong(env.nextSession)} · ${first} unlocks only these games` : 'No upcoming session is scheduled. You can continue with home practice only.'}</small></div><button type="button" role="switch" aria-checked={useTherapy} aria-label="Use in the next therapy session" disabled={!env?.nextSession} className={`hs-switch${useTherapy ? ' on' : ''}`} onClick={() => setUseTherapy((v) => !v)}><i /></button></div>
            <div><div><b>Home practice</b><small>{env ? `${patient.games[0]?.required ?? 3} plays per game · ${daysText(env.home.days)}, ${fmt12(env.home.dailyStart).replace(':00', '')}–${fmt12(env.home.dailyEnd).replace(':00', '')}` : ''}</small></div><button type="button" role="switch" aria-checked={useHome} aria-label="Use for home practice" className={`hs-switch${useHome ? ' on' : ''}`} onClick={() => setUseHome((v) => !v)}><i /></button></div>
          </div>
        )}

        <footer className="hs-modal-foot">
          <p>{submitError ? <span className="hs-err-text" role="alert">{submitError}</span> : signed ? `${first} and the family are notified about the new set. The SOAP note is not shared unless you share it.` : 'Sign the SOAP note to unlock assigning. Nothing is assigned or shared automatically.'}</p>
          <button type="button" className="hs-btn" onClick={() => onChangeGames(r)} disabled={!r}>Change games</button>
          <button type="button" className="hs-btn green" disabled={!canAssign} title={signed ? '' : 'Sign the SOAP note first'} onClick={assign}>{busy === 'assign' ? 'Assigning…' : signed ? 'Assign this set' : '🔒 Assign this set'}</button>
        </footer>
      </div>
    </div>
  )
}
