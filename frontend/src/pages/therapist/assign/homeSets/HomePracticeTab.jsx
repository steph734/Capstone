import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { authFetch } from '../../../../utils/session'
import PatientHomeCard from './PatientHomeCard'
import ChooseNextSetModal from './ChooseNextSetModal'
import RecommendedSetModal from './RecommendedSetModal'
import { sessionText } from './gameIcons'
import './homeSets.css'

// Home practice tab: summary tiles, filter pills, one card per patient, and the "choose the next set" flow.
const FILTERS = [['all', 'All patients'], ['needs', 'SOAP note needed'], ['progress', 'In progress'], ['idle', 'Not started']]
const matches = (p, f) => (f === 'all' ? true : f === 'needs' ? p.needsSoap : f === 'progress' ? !p.needsSoap && p.playsUsed > 0 : p.playsUsed === 0)

export default function HomePracticeTab({ overview, loading, error, onReload, onSetupHome }) {
  const [filter, setFilter] = useState('all')
  const [modalFor, setModalFor] = useState(null)
  const [recFor, setRecFor] = useState(null)
  const [params, setParams] = useSearchParams()
  const [toast, setToast] = useState(null) // { text, undo: { patientId, setId } | null }
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!toast?.undo) return undefined
    const t = setTimeout(() => setToast((x) => (x ? { ...x, undo: null } : x)), overview?.config?.undoWindowMs || 10000)
    return () => clearTimeout(t)
  }, [toast?.undo?.setId]) // eslint-disable-line react-hooks/exhaustive-deps

  const assigned = async (r) => { const p = modalFor; setModalFor(null); await afterAssigned(r, p) }
  const afterAssigned = async (r, p) => {
    const where = [r.useInTherapy ? `therapy session${r.therapyDate ? ` ${sessionText({ date: r.therapyDate })}` : ''}` : '', r.useAtHome ? `home practice (${r.plays ?? 3} plays per game)` : ''].filter(Boolean).join(' and ')
    setToast({ text: `New set assigned for ${r.firstName}: ${where}.`, undo: { patientId: p.patientId, setId: r.setId } })
    await onReload()
  }
  const undo = async () => {
    const u = toast?.undo
    if (!u) return
    try { await authFetch('/api/therapist/home-sets/undo', { method: 'POST', body: u }); setToast(null); await onReload() }
    catch (e) { setToast(null); setNote(e.message || 'Could not undo.') }
  }

  const patients = overview?.patients || []
  // "Review next set →" from Notes & Progress comes back here with ?review=<setId>: open that recommendation once.
  const reviewId = params.get('review')
  useEffect(() => {
    if (!reviewId || !overview) return
    const p = overview.patients.find((x) => x.setId === reviewId)
    if (p) setRecFor(p)
    setParams((cur) => { const n = new URLSearchParams(cur); n.delete('review'); return n }, { replace: true })
  }, [reviewId, overview]) // eslint-disable-line react-hooks/exhaustive-deps
  const counts = Object.fromEntries(FILTERS.map(([id]) => [id, patients.filter((p) => matches(p, id)).length]))
  const shown = patients.filter((p) => matches(p, filter))
  const s = overview?.summary

  return (
    <div className="hs-tab" role="tabpanel" id="panel-home" aria-labelledby="tab-home">
      {toast && (
        <div className="hs-toast" role="status"><span>✓ {toast.text}</span>{toast.undo && <button type="button" onClick={undo}>Undo</button>}</div>
      )}
      <div className="hs-title"><h2>Home practice</h2><p>Each game can be played {overview?.config?.playsPerGame ?? 3} times. When a set is finished, a SOAP note and the next set are drafted for you. You review, edit and approve both.</p></div>
      {note && <p className="hs-error-line" role="alert">{note}</p>}

      {error && !overview && <div className="hs-error" role="alert"><span>{error}</span><button type="button" className="hs-btn green" onClick={onReload}>Retry</button></div>}
      {loading && !overview && !error && <div aria-busy="true" aria-label="Loading home practice"><div className="hs-tiles">{[0, 1, 2, 3].map((i) => <div key={i} className="hs-skel" style={{ height: 92 }} />)}</div><div className="hs-skel" style={{ height: 260, marginTop: 16 }} /></div>}

      {overview && (
        <>
          <div className="hs-tiles">
            <div className="hs-tile"><b>{s.patients}</b><span>Patients with home practice</span></div>
            <div className="hs-tile amber"><b>{s.needSoap}</b><span>Set finished · SOAP note needed</span></div>
            <div className="hs-tile blue"><b>{s.playsUsed} of {s.playsAllowed}</b><span>Plays used</span></div>
            <div className="hs-tile"><b>{s.notStarted}</b><span>Not started yet</span></div>
          </div>

          {patients.length === 0 ? (
            <div className="hs-empty"><img src="/games/pao-money-match-poses/pao-thumbs-up.png" alt="" width="84" height="84" /><div><h3>No patients have home practice yet</h3><p>After a therapy session, use “Send games home” to keep games open for a patient. They will show up here.</p></div></div>
          ) : (
            <>
              <div className="hs-pills" role="group" aria-label="Filter patients">
                {FILTERS.map(([id, label]) => <button key={id} type="button" aria-pressed={filter === id} className={filter === id ? 'on' : ''} onClick={() => setFilter(id)}>{label}{id !== 'all' ? ` · ${counts[id]}` : ''}</button>)}
              </div>
              <div className="hs-list">
                {shown.map((p) => <PatientHomeCard key={p.setId} patient={p} onReview={setRecFor} onRetry={onReload} openSetup={onSetupHome} />)}
                {shown.length === 0 && <p className="hs-muted">No patients in this group.</p>}
              </div>
            </>
          )}
        </>
      )}

      {recFor && <RecommendedSetModal patient={recFor} config={overview?.config} onClose={() => setRecFor(null)} onAssigned={async (r) => { const p = recFor; setRecFor(null); await afterAssigned(r, p) }} onChangeGames={(rec) => { setModalFor({ ...recFor, preselect: rec?.games.map((g) => g.gameId) || [] }); setRecFor(null) }} />}
      {modalFor && <ChooseNextSetModal patient={modalFor} config={overview?.config} onClose={() => setModalFor(null)} onAssigned={assigned} />}
    </div>
  )
}
