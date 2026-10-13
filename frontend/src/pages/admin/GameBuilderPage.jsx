import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Stage from './builder/Stage'
import GamePlayer from './builder/Player'
import LeftRail from './builder/LeftRail'
import Inspector from './builder/Inspector'
import LevelStrip from './builder/LevelStrip'
import LockScreen from '../therapist/notes/IdleLock'
import {
  DEVICES, STAGE, TEMPLATE_BY_ID, alignElements, blankDoc, checklist, clone, distribute, newElement, newLevel, snapTo, uid,
} from './builder/model'
import { createGame, loadGame, markTestPlayed, publishGame, restoreVersion, saveGame, unpublishGame } from './builder/builderApi'

// /admin/games-library/builder/new and /builder/:gameId — the Game Builder
// workspace (Super Admin only; every call is checked on the server). Full
// screen, no admin sidebar. The document lives here; Stage, Inspector,
// LeftRail and LevelStrip edit it through small patches, and every gesture is
// one undo step.
const GREEN = '#234C40'
const AUTOSAVE_MS = 10000
const DEBOUNCE_MS = 1500
const HISTORY_LIMIT = 100
const BACK_PATH = '/admin/games-library/games'
const typing = (t) => t && (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable)

const barBtn = (primary, disabled) => ({ minHeight: 44, borderRadius: 14, padding: '0 16px', fontWeight: 800, fontSize: 14, fontFamily: 'inherit', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, border: primary ? 'none' : '1px solid #dbe3df', background: primary ? GREEN : '#fff', color: primary ? '#fff' : '#1f3d36', whiteSpace: 'nowrap' })
const iconBtn = (disabled) => ({ width: 44, height: 44, borderRadius: 12, border: '1px solid #dbe3df', background: '#fff', fontSize: 18, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1, color: '#1f3d36' })
const toolBtn = { minHeight: 40, minWidth: 40, borderRadius: 10, border: '1px solid #dbe3df', background: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', color: '#1f3d36', padding: '0 10px' }

function ago(ts) {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000))
  if (s < 10) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  return m < 60 ? `${m} min ago` : `${Math.floor(m / 60)} h ago`
}

export default function GameBuilderPage({ user, onLogout }) {
  const { gameId } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()

  const [doc, setDoc] = useState(null)
  // Undo history lives in refs (state would double-apply under StrictMode); `hist` just tells the buttons.
  const pastRef = useRef([])
  const futureRef = useRef([])
  const [hist, setHist] = useState({ u: 0, r: 0 })
  const syncHist = () => setHist({ u: pastRef.current.length, r: futureRef.current.length })
  const [game, setGame] = useState({ id: gameId === 'new' ? null : gameId, status: 'draft', legacy: false, testPlayed: false })
  const [versions, setVersions] = useState([])
  const [loadError, setLoadError] = useState('')
  const [li, setLi] = useState(0)
  const [selection, setSelection] = useState([])
  const [tab, setTab] = useState('game')
  const [tool, setTool] = useState('build')
  const [zoom, setZoom] = useState(1)
  const [showGrid, setShowGrid] = useState(true)
  const [saveState, setSaveState] = useState({ status: 'saved', at: Date.now() })
  const [, tick] = useState(0)
  const [testing, setTesting] = useState(false)
  const [busy, setBusy] = useState('')
  const [toast, setToast] = useState('')
  const [locked, setLocked] = useState(false)
  const [sessionGone, setSessionGone] = useState(false)
  const [conflict, setConflict] = useState(false)
  const [publishInfo, setPublishInfo] = useState(null)

  const docRef = useRef(null)
  const savedDocRef = useRef(null)
  const idRef = useRef(game.id)
  const versionRef = useRef(0)
  const savingRef = useRef(false)
  const dirtyRef = useRef(false)
  const gestureBase = useRef(null)
  const requestId = params.get('request') || null
  docRef.current = doc

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2600) }

  // ── Load ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    if (gameId === 'new') {
      const d = blankDoc()
      if (params.get('name')) d.meta.name = params.get('name').slice(0, 80)
      if (params.get('type')) d.meta.therapyType = params.get('type')
      if (params.get('desc')) d.meta.description = params.get('desc').slice(0, 500)
      setDoc(d); savedDocRef.current = d
      return undefined
    }
    loadGame(gameId).then((b) => {
      if (cancelled) return
      setDoc(b.doc); savedDocRef.current = b.doc
      versionRef.current = b.version
      setVersions(b.versions)
      setGame({ id: gameId, status: b.game.status, legacy: b.game.legacy, testPlayed: b.game.testPlayed })
      if (b.game.legacy) setTab('game')
    }).catch((err) => {
      if (cancelled) return
      if (err.code === 'NO_SESSION') setSessionGone(true)
      else if (err.code === 'SESSION_LOCKED') setLocked(true)
      else setLoadError(err.message)
    })
    return () => { cancelled = true }
  }, [gameId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Document edits (with undo history) ────────────────────────────────
  const commit = useCallback((mutate, { history = true } = {}) => {
    const prev = docRef.current
    const next = clone(prev)
    mutate(next)
    if (history) { pastRef.current = [...pastRef.current.slice(-(HISTORY_LIMIT - 1)), prev]; futureRef.current = []; syncHist() }
    docRef.current = next
    setDoc(next)
    dirtyRef.current = true
    setSaveState((s) => (s.status === 'saving' ? s : { ...s, status: 'dirty' }))
  }, [])

  const level = doc?.levels[Math.min(li, (doc?.levels.length || 1) - 1)]
  const levelIndex = doc ? Math.min(li, doc.levels.length - 1) : 0
  const patchLevel = (fn, opts) => commit((d) => fn(d.levels[levelIndex]), opts)
  const patchElement = (id, fn, opts) => patchLevel((lv) => { const e = lv.elements.find((x) => x.id === id); if (e) fn(e) }, opts)
  const grid = doc?.settings.grid ?? 8
  const snap = doc?.settings.snap !== false

  const undo = useCallback(() => {
    if (!pastRef.current.length) return
    const prev = pastRef.current[pastRef.current.length - 1]
    pastRef.current = pastRef.current.slice(0, -1)
    futureRef.current = [docRef.current, ...futureRef.current]
    docRef.current = prev; setDoc(prev); dirtyRef.current = true; syncHist()
    setSelection((s) => s.filter((id) => prev.levels.some((l) => l.elements.some((e) => e.id === id))))
  }, [])
  const redo = useCallback(() => {
    if (!futureRef.current.length) return
    const next = futureRef.current[0]
    futureRef.current = futureRef.current.slice(1)
    pastRef.current = [...pastRef.current, docRef.current]
    docRef.current = next; setDoc(next); dirtyRef.current = true; syncHist()
  }, [])

  // Gestures (drag / resize) → live patches, ONE undo entry.
  const onGestureStart = () => { gestureBase.current = docRef.current }
  const onLive = (patchMap) => commit((d) => {
    const lv = d.levels[levelIndex]
    for (const e of lv.elements) if (patchMap[e.id]) Object.assign(e, patchMap[e.id])
  }, { history: false })
  const onGestureEnd = () => {
    const base = gestureBase.current
    gestureBase.current = null
    if (base && base !== docRef.current) { pastRef.current = [...pastRef.current.slice(-(HISTORY_LIMIT - 1)), base]; futureRef.current = []; syncHist() }
  }

  // ── Element / level / game actions ────────────────────────────────────
  const topZ = (lv) => lv.elements.reduce((m, e) => Math.max(m, e.z), -1) + 1
  const addElement = (type, cx, cy, extra) => {
    const el = newElement(type, 0, 0, extra)
    const x = snapTo((cx ?? STAGE.w / 2) - el.w / 2 + (cx == null ? (level.elements.length % 6) * 20 : 0), grid, snap)
    const y = snapTo((cy ?? STAGE.h / 2) - el.h / 2 + (cy == null ? (level.elements.length % 6) * 20 : 0), grid, snap)
    Object.assign(el, { x, y, z: topZ(level) })
    commit((d) => d.levels[levelIndex].elements.push(el))
    setSelection([el.id]); setTab('element')
  }
  const addImage = (asset) => addElement('image_card', null, null, { imageUrl: asset.url, emoji: '', label: '', alt: '' })

  const applyTemplate = (id) => {
    const t = TEMPLATE_BY_ID[id]
    if (level.elements.length && !window.confirm(`Replace what is on "${level.title}" with the "${t.label}" template?`)) return
    commit((d) => { d.levels[levelIndex].elements = t.build(); d.meta.template = id })
    setSelection([])
  }

  const deleteSelection = () => {
    if (!selection.length) return
    patchLevel((lv) => { lv.elements = lv.elements.filter((e) => !selection.includes(e.id)) })
    setSelection([])
  }
  const duplicateSelection = () => {
    if (!selection.length) return
    const ids = []
    patchLevel((lv) => {
      let z = topZ(lv)
      for (const e of lv.elements.filter((x) => selection.includes(x.id))) {
        const c = clone(e); c.id = uid(); c.x += 24; c.y += 24; c.z = z++; ids.push(c.id); lv.elements.push(c)
      }
    })
    setSelection(ids)
  }
  const layer = (id, how) => patchLevel((lv) => {
    const sorted = [...lv.elements].sort((a, b) => a.z - b.z)
    const i = sorted.findIndex((e) => e.id === id)
    const [e] = sorted.splice(i, 1)
    const to = how === 'front' ? sorted.length : how === 'back' ? 0 : how === 'forward' ? Math.min(sorted.length, i + 1) : Math.max(0, i - 1)
    sorted.splice(to, 0, e)
    sorted.forEach((x, n) => { x.z = n })
    lv.elements = sorted
  })
  const onToolbar = (action, id) => {
    if (action === 'edit') setTab('element')
    else if (action === 'duplicate') duplicateSelection()
    else if (action === 'delete') deleteSelection()
    else if (action.startsWith('layer-')) layer(id, action.slice(6))
  }

  const nudge = (dx, dy) => { if (selection.length) patchLevel((lv) => { for (const e of lv.elements) if (selection.includes(e.id)) { e.x += dx; e.y += dy } }) }
  const align = (mode) => {
    const els = level.elements.filter((e) => selection.includes(e.id))
    const patch = mode === 'dh' ? distribute(els, 'h') : mode === 'dv' ? distribute(els, 'v') : alignElements(els, mode)
    patchLevel((lv) => { for (const e of lv.elements) if (patch[e.id]) Object.assign(e, patch[e.id]) })
  }

  const addLevel = () => { commit((d) => d.levels.push(newLevel(d.levels.length + 1))); setLi(doc.levels.length); setSelection([]) }
  const duplicateLevel = (i) => {
    commit((d) => { const c = clone(d.levels[i]); c.id = uid('lv'); c.title = `${c.title} copy`; c.elements.forEach((e) => { e.id = uid() }); d.levels.splice(i + 1, 0, c) })
    setLi(i + 1); setSelection([])
  }
  const deleteLevel = (i) => {
    if (doc.levels.length < 2) return
    if (doc.levels[i].elements.length && !window.confirm(`Delete "${doc.levels[i].title}" and everything on it?`)) return
    commit((d) => { d.levels.splice(i, 1) })
    setLi(Math.max(0, i - 1)); setSelection([])
  }
  const moveLevel = (from, to) => {
    commit((d) => { const [lv] = d.levels.splice(from, 1); d.levels.splice(to, 0, lv) })
    setLi(to)
  }

  // ── Saving ────────────────────────────────────────────────────────────
  const handleSaveError = (err) => {
    if (err.code === 'STALE') { setConflict(true); setSaveState({ status: 'error', at: Date.now() }); return }
    if (err.code === 'SESSION_LOCKED') { setLocked(true); return }
    if (err.code === 'NO_SESSION') { setSessionGone(true); return }
    setSaveState({ status: 'error', at: Date.now(), message: err.message })
  }

  const save = useCallback(async (kind = 'autosave') => {
    if (savingRef.current || conflict) return false
    const toSave = docRef.current
    if (!toSave) return false
    savingRef.current = true
    setSaveState((s) => ({ ...s, status: 'saving' }))
    try {
      if (!idRef.current) {
        const r = await createGame(toSave, requestId)
        idRef.current = r.id; versionRef.current = r.version
        setGame((g) => ({ ...g, id: r.id }))
        // Swap the URL without remounting, so the work in progress isn't reset.
        window.history.replaceState(null, '', `/admin/games-library/builder/${r.id}`)
      } else {
        const r = await saveGame(idRef.current, toSave, versionRef.current, kind, game.legacy)
        versionRef.current = r.version
      }
      savedDocRef.current = toSave
      dirtyRef.current = docRef.current !== toSave
      setSaveState({ status: dirtyRef.current ? 'dirty' : 'saved', at: Date.now() })
      if (kind === 'draft' && idRef.current) loadGame(idRef.current).then((b) => setVersions(b.versions)).catch(() => {})
      return true
    } catch (err) {
      handleSaveError(err)
      return false
    } finally { savingRef.current = false }
  }, [conflict, game.legacy, requestId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Autosave: shortly after a change, and every 10 seconds while dirty.
  useEffect(() => {
    if (!doc || !dirtyRef.current) return undefined
    const t = setTimeout(() => { if (dirtyRef.current) save('autosave') }, DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [doc, save])
  useEffect(() => {
    const t = setInterval(() => { if (dirtyRef.current && !savingRef.current) save('autosave'); tick((n) => n + 1) }, AUTOSAVE_MS)
    return () => clearInterval(t)
  }, [save])

  useEffect(() => {
    const warn = (e) => { if (dirtyRef.current) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])

  const goBack = async () => {
    if (dirtyRef.current) {
      const ok = await save('autosave')
      if (!ok && !window.confirm('Your latest changes could not be saved. Leave anyway and lose them?')) return
    }
    navigate(BACK_PATH)
  }

  const saveDraft = async () => {
    setBusy('draft')
    const ok = await save('draft')
    setBusy('')
    if (ok) flash('Draft saved')
  }

  const publish = async () => {
    setBusy('publish'); setPublishInfo(null)
    try {
      if (dirtyRef.current || !idRef.current) { if (!(await save('draft'))) return }
      await publishGame(idRef.current)
      setGame((g) => ({ ...g, status: 'published' }))
      flash('Published — it now appears in the Activity Library and to therapists')
      loadGame(idRef.current).then((b) => setVersions(b.versions)).catch(() => {})
    } catch (err) {
      if (err.data?.checklist) setPublishInfo(err.data.checklist)
      handleSaveError(err)
      if (!err.data?.checklist) flash(err.message)
    } finally { setBusy('') }
  }
  const unpublish = async () => {
    if (!window.confirm('Unpublish this game? Patients and therapists will no longer see it. Past results and badges are kept.')) return
    setBusy('unpublish')
    try { await unpublishGame(idRef.current); setGame((g) => ({ ...g, status: 'draft' })); flash('Unpublished') } catch (err) { handleSaveError(err); flash(err.message) } finally { setBusy('') }
  }

  const restore = async (v) => {
    if (!window.confirm(`Restore version ${v.version}? Your current version stays in History.`)) return
    try {
      const r = await restoreVersion(idRef.current, v.version)
      versionRef.current = r.version
      docRef.current = r.doc; setDoc(r.doc); pastRef.current = []; futureRef.current = []; syncHist(); setSelection([]); setLi(0)
      savedDocRef.current = r.doc; dirtyRef.current = false
      setSaveState({ status: 'saved', at: Date.now() })
      loadGame(idRef.current).then((b) => setVersions(b.versions)).catch(() => {})
      flash(`Restored version ${v.version}`)
    } catch (err) { handleSaveError(err); flash(err.message) }
  }

  const onTestFinished = () => {
    commit((d) => { d.meta.testPlayed = true }, { history: false })
    if (idRef.current) markTestPlayed(idRef.current).then(() => setGame((g) => ({ ...g, testPlayed: true }))).catch(() => {})
  }

  // ── Keyboard ──────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (testing || typing(e.target) || !docRef.current) return
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo() }
      else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo() }
      else if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); saveDraft() }
      else if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateSelection() }
      else if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); setSelection(level.elements.map((x) => x.id)) }
      else if (e.key === 'Delete' || e.key === 'Backspace') { if (selection.length) { e.preventDefault(); deleteSelection() } }
      else if (e.key === 'Escape') setSelection([])
      else if (e.key.startsWith('Arrow') && selection.length) {
        e.preventDefault()
        const step = e.shiftKey ? 10 : (snap ? grid : 1)
        nudge(e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0, e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const selected = useMemo(() => (level && selection.length === 1 ? level.elements.find((e) => e.id === selection[0]) || null : null), [level, selection])
  const result = useMemo(() => (doc ? checklist(doc, { testPlayed: game.testPlayed }) : null), [doc, game.testPlayed])
  const legacy = game.legacy
  const published = game.status === 'published'
  const statusText = saveState.status === 'saving' ? 'Saving…' : saveState.status === 'dirty' ? 'Unsaved changes' : saveState.status === 'error' ? (conflict ? 'Changed elsewhere' : 'Couldn’t save — retrying') : `All changes saved · ${ago(saveState.at)}`

  // ── Screens that replace the builder ──────────────────────────────────
  if (sessionGone) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 1500, background: '#f5f8f6', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        <div style={{ maxWidth: 420 }}>
          <h1 style={{ fontSize: 24, color: '#1f3d36' }}>Sign in with your Super Admin account</h1>
          <p style={{ color: '#5d7770', lineHeight: 1.5 }}>The Game Builder checks on the server that you are a Super Admin. Sign in again with your clinic Super Admin account to continue.</p>
          <button type="button" style={barBtn(true)} onClick={onLogout}>Go to sign in</button>
        </div>
      </div>
    )
  }
  if (loadError) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 1500, background: '#f5f8f6', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        <div><p role="alert" style={{ color: '#b91c1c', fontWeight: 700 }}>{loadError}</p><button type="button" style={barBtn(false)} onClick={() => navigate(BACK_PATH)}>Back to games</button></div>
      </div>
    )
  }
  if (!doc) return <div style={{ position: 'fixed', inset: 0, zIndex: 1500, background: '#f5f8f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5d7770' }}>{locked ? '' : 'Opening the builder…'}{locked && <LockScreen reason="Your session was locked after a period of inactivity." userName={user?.name} onUnlocked={() => window.location.reload()} onSignOut={onLogout} />}</div>

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1500, background: '#f5f8f6', display: 'flex', flexDirection: 'column', fontFamily: "'Plus Jakarta Sans','Segoe UI',system-ui,sans-serif", color: '#1f3d36', minWidth: 0 }}>
      {/* Top bar */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', background: '#fff', borderBottom: '1px solid #e3e8e4', flexWrap: 'wrap', rowGap: 6 }}>
        <button type="button" onClick={goBack} aria-label="Back to games" style={iconBtn(false)}>←</button>
        <div style={{ minWidth: 150, flex: '0 1 280px' }}>
          <input aria-label="Game name" value={doc.meta.name} maxLength={80} onChange={(e) => commit((d) => { d.meta.name = e.target.value }, { history: false })}
            style={{ width: '100%', boxSizing: 'border-box', border: 'none', borderBottom: '2px solid transparent', background: 'transparent', fontSize: 20, fontWeight: 800, color: '#1f3d36', fontFamily: 'inherit', padding: '2px 0' }}
            onFocus={(e) => { e.target.style.borderBottomColor = '#1FA58A' }} onBlur={(e) => { e.target.style.borderBottomColor = 'transparent' }} />
          <div role="status" aria-live="polite" style={{ fontSize: 12, color: saveState.status === 'error' ? '#b91c1c' : '#6b7c75' }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: saveState.status === 'saved' ? '#16a34a' : saveState.status === 'error' ? '#dc2626' : '#f59e0b', marginRight: 6 }} />{statusText}
          </div>
        </div>
        <span style={{ borderRadius: 999, padding: '4px 12px', fontSize: 12.5, fontWeight: 800, background: published ? '#D9F2E3' : '#FFF1D6', color: published ? '#166534' : '#92400E' }}>{published ? 'Published' : 'Draft'}</span>
        <button type="button" onClick={undo} disabled={!hist.u} aria-label="Undo (Ctrl+Z)" title="Undo (Ctrl+Z)" style={iconBtn(!hist.u)}>↶</button>
        <button type="button" onClick={redo} disabled={!hist.r} aria-label="Redo (Ctrl+Shift+Z)" title="Redo (Ctrl+Shift+Z)" style={iconBtn(!hist.r)}>↷</button>
        <div role="group" aria-label="Device preview" style={{ display: 'flex', gap: 2, background: '#f1f5f3', borderRadius: 14, padding: 3, margin: '0 auto' }}>
          {Object.entries(DEVICES).map(([id, d]) => (
            <button key={id} type="button" aria-pressed={doc.settings.device === id} onClick={() => commit((x) => { x.settings.device = id }, { history: false })}
              style={{ minHeight: 38, borderRadius: 11, border: 'none', padding: '0 14px', fontWeight: 800, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit', background: doc.settings.device === id ? '#fff' : 'transparent', color: doc.settings.device === id ? GREEN : '#5d7770', boxShadow: doc.settings.device === id ? '0 1px 4px rgba(0,0,0,.12)' : 'none' }}>{d.icon} {d.label}</button>
          ))}
        </div>
        <button type="button" onClick={() => setTab('game')} style={barBtn(false)}>⚙ Game settings</button>
        <button type="button" onClick={() => setTesting(true)} disabled={legacy || !doc.levels.some((l) => l.elements.length)} style={{ ...barBtn(false, legacy || !doc.levels.some((l) => l.elements.length)), background: '#e4f2ec', borderColor: '#bfe3d3' }}>▶ Test play</button>
        <button type="button" onClick={saveDraft} disabled={busy === 'draft'} style={barBtn(false, busy === 'draft')}>{busy === 'draft' ? 'Saving…' : 'Save draft'}</button>
        {published
          ? <button type="button" onClick={unpublish} disabled={!!busy} style={barBtn(false, !!busy)}>Unpublish</button>
          : <button type="button" onClick={publish} disabled={!!busy || (!legacy && !result.ready)} title={!legacy && !result.ready ? 'Finish the checklist on the right first' : undefined} style={barBtn(true, !!busy || (!legacy && !result.ready))}>{busy === 'publish' ? 'Publishing…' : 'Publish'}</button>}
      </header>

      {conflict && <div role="alert" style={{ background: '#FEF2F2', color: '#991B1B', padding: '8px 16px', fontSize: 13.5, fontWeight: 700 }}>This game was changed somewhere else, so autosave is paused. <button type="button" onClick={() => window.location.reload()} style={{ ...barBtn(false), minHeight: 34, marginLeft: 10 }}>Reload the latest</button></div>}
      {publishInfo && <div role="alert" style={{ background: '#FFF7E0', color: '#7a4b06', padding: '8px 16px', fontSize: 13.5, fontWeight: 700 }}>Not ready to publish: {publishInfo.items.filter((i) => !i.ok).map((i) => i.hint).join(' ')}</div>}
      {legacy && <div style={{ background: '#EEF6FF', color: '#1E40AF', padding: '8px 16px', fontSize: 13.5, fontWeight: 700 }}>This is a built-in game. You can change its details and publish status here; its gameplay is part of the app.</div>}

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <LeftRail tool={tool} onTool={setTool} doc={doc} settings={doc.settings} onTemplate={applyTemplate} onAdd={(t) => addElement(t)} onAddImage={addImage}
          onSettings={(p) => commit((d) => { Object.assign(d.settings, p) }, { history: false })} versions={versions} onRestore={restore} canRestore={!!idRef.current && !legacy} disabled={legacy && tool !== 'history'} />

        <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {/* Canvas toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', flexWrap: 'wrap', borderBottom: '1px solid #e3e8e4', background: '#fafcfb' }} role="toolbar" aria-label="Canvas tools">
            <span style={{ fontSize: 13, fontWeight: 800, marginRight: 8 }}>{level.title}</span>
            {[['left', '⇤', 'Align left'], ['hcenter', '↔', 'Centre horizontally'], ['right', '⇥', 'Align right'], ['top', '⤒', 'Align top'], ['vcenter', '↕', 'Centre vertically'], ['bottom', '⤓', 'Align bottom'], ['dh', '⇹', 'Distribute horizontally'], ['dv', '⇳', 'Distribute vertically']].map(([m, icon, name]) => (
              <button key={m} type="button" aria-label={name} title={name} disabled={!selection.length || legacy} onClick={() => align(m)} style={{ ...toolBtn, opacity: selection.length && !legacy ? 1 : 0.4 }}>{icon}</button>
            ))}
            <button type="button" aria-pressed={showGrid} onClick={() => setShowGrid((v) => !v)} aria-label="Toggle grid" title="Show grid" style={{ ...toolBtn, background: showGrid ? '#e4f2ec' : '#fff' }}>▦</button>
            <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
              <button type="button" aria-label="Zoom out" style={toolBtn} onClick={() => setZoom((z) => Math.max(0.25, Math.round((z - 0.1) * 10) / 10))}>−</button>
              <span style={{ minWidth: 48, textAlign: 'center', fontSize: 13, fontWeight: 800 }}>{Math.round(zoom * 100)}%</span>
              <button type="button" aria-label="Zoom in" style={toolBtn} onClick={() => setZoom((z) => Math.min(2, Math.round((z + 0.1) * 10) / 10))}>+</button>
              <button type="button" style={toolBtn} onClick={() => setZoom(1)}>Fit</button>
            </span>
          </div>
          <div style={{ flex: 1, minHeight: 0, background: 'repeating-conic-gradient(#f0f4f2 0% 25%, #f6f9f7 0% 50%) 50% / 24px 24px' }}>
            <Stage level={level} device={doc.settings.device} zoom={zoom} selection={selection} grid={grid} snap={snap} showGrid={showGrid} disabled={legacy}
              onSelect={(ids) => { setSelection(ids); if (ids.length === 1) setTab((t) => (t === 'game' ? 'element' : t)) }}
              onGestureStart={onGestureStart} onLive={onLive} onGestureEnd={onGestureEnd}
              onPaletteDrop={(type, x, y) => addElement(type, x, y)} onToolbar={onToolbar} />
          </div>
          <LevelStrip levels={doc.levels} current={levelIndex} disabled={legacy} onSelect={(i) => { setLi(i); setSelection([]) }} onAdd={addLevel} onDuplicate={duplicateLevel} onDelete={deleteLevel} onMove={moveLevel}
            onDifficulty={(i, d) => commit((x) => { x.levels[i].difficulty = d })} />
        </main>

        <Inspector tab={tab} onTab={setTab} doc={doc} level={level} selected={selected} legacy={legacy} testPlayed={game.testPlayed}
          onElementProps={(id, p) => patchElement(id, (e) => Object.assign(e.props, p))}
          onElementGeom={(id, g) => patchElement(id, (e) => Object.assign(e, g))}
          onLevel={(p) => patchLevel((lv) => Object.assign(lv, p))}
          onMeta={(p) => commit((d) => Object.assign(d.meta, p))} />
      </div>

      {testing && (
        <div role="dialog" aria-modal="true" aria-label="Test play" style={{ position: 'fixed', inset: 0, zIndex: 2500, background: 'rgba(20,30,26,.8)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', color: '#fff' }}>
            <strong>Test play</strong><span style={{ opacity: 0.8, fontSize: 13.5 }}>Exactly what a patient sees. Results are not saved to any patient.</span>
            <button type="button" onClick={() => setTesting(false)} style={{ ...barBtn(false), marginLeft: 'auto' }}>Close</button>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <GamePlayer doc={doc} device={doc.settings.device} onFinish={onTestFinished} onExit={() => setTesting(false)} finishLabel="Close test" />
          </div>
        </div>
      )}

      {toast && <div role="status" style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 3500, background: GREEN, color: '#fff', borderRadius: 999, padding: '10px 20px', fontWeight: 700, fontSize: 14 }}>{toast}</div>}
      {locked && <LockScreen reason="Your session was locked after a period of inactivity." userName={user?.name} onUnlocked={() => { setLocked(false); save('autosave') }} onSignOut={onLogout} />}
    </div>
  )
}

