// The sync engine: moves data between this device (Dexie) and the server.
//
//   PUSH  sends the outbox (changes made on this device) to POST /api/sync/push
//   PULL  asks GET /api/sync/pull?since=... for what changed on the server
//
// When it runs: at app start, when the browser fires "online", every 60 seconds,
// and a moment after any local save. It does NOT use the Background Sync API
// (Safari on iPhone/iPad does not support it).
//
// Safety rules, in plain words:
//   * An outbox entry is deleted ONLY after the server answers "ok" for it.
//   * A failed or unreachable server just means "try again later", with waits of
//     2s, 4s, 8s ... up to 5 minutes (exponential backoff). Nothing is dropped.
//   * If the login expired, we stop sending, keep everything locally, and ask the
//     user to sign in again. Data is never discarded because of that.
//   * Only the SERVER's clock is used to decide "what changed since".
import { db, getMeta, setMeta, SYNCED_COLLECTIONS } from './db'
import { getDoc, putSynced, saveLocal, watch } from './repo'
import { getSessionToken } from '../utils/session'

const SYNC_EVERY_MS = 60 * 1000
const BATCH_SIZE = 50
const MAX_BACKOFF_MS = 5 * 60 * 1000
// Fields that only exist on this device; never sent to the server.
const LOCAL_ONLY = ['syncStatus', 'serverCopy', 'local_changed_at', 'rejectedMessage', 'unreadable', 'sealed']

// ───────────────────────────── observable state (for the header indicator) ─────────────────────────────
let state = {
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  syncing: false,
  pending: 0, // changes waiting to be sent
  conflicts: 0, // SOAP notes that need the therapist to choose
  rejected: 0, // changes the server refused (with a message)
  error: '', // last problem reaching the server
  needsLogin: false, // token missing or expired: sign in again to send changes
  locked: false, // session idle-locked: unlock to send changes
  lastSyncAt: null,
}
const listeners = new Set()
const setState = (patch) => { state = { ...state, ...patch }; listeners.forEach((fn) => fn()) }
export const getSyncState = () => state
export const subscribeSync = (fn) => { listeners.add(fn); return () => listeners.delete(fn) }

async function refreshCounts() {
  const count = async (status) => {
    let n = 0
    for (const c of SYNCED_COLLECTIONS) if (c !== 'patients') n += await db[c].where('syncStatus').equals(status).count()
    return n
  }
  setState({ pending: await db.outbox.count(), conflicts: await count('conflict'), rejected: await count('rejected') })
}

// ───────────────────────────── helpers ─────────────────────────────
const isNetworkError = (e) => !(e && e.status)
const backoffMs = (tries) => Math.min(2000 * 2 ** tries, MAX_BACKOFF_MS)

async function callApi(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getSessionToken()}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data.error || `Request failed (${res.status})`), { status: res.status, code: data.code })
  return data
}

// Marks every entry in a batch as "try again later" (server unreachable or erroring).
async function backoff(entries, message) {
  for (const e of entries) {
    const tries = (e.tries || 0) + 1
    await db.outbox.update(e.seq, { tries, nextTryAt: Date.now() + backoffMs(tries), lastError: message })
  }
}

// ───────────────────────────── push ─────────────────────────────
async function pushOnce(force) {
  const now = Date.now()
  const ready = (await db.outbox.orderBy('seq').toArray()).filter((e) => force || (e.nextTryAt || 0) <= now).slice(0, BATCH_SIZE)
  if (!ready.length) return 'idle'

  // Build the payload from the CURRENT local record (not a stale copy).
  const items = []
  for (const e of ready) {
    const rec = await getDoc(e.collection, e.docId)
    if (!rec) { await db.outbox.delete(e.seq); continue } // record was removed locally
    if (rec.unreadable) { await db.outbox.delete(e.seq); continue } // cannot be decrypted: nothing to send
    const doc = Object.fromEntries(Object.entries(rec).filter(([k]) => !LOCAL_ONLY.includes(k)))
    items.push({ entry: e, snapshotAt: rec.local_changed_at, body: { collection: e.collection, op: e.op, docId: e.docId, doc } })
  }
  if (!items.length) return 'more'

  let answer
  try {
    answer = await callApi('/api/sync/push', { method: 'POST', body: { entries: items.map((i) => i.body) } })
  } catch (err) {
    if (err.status === 401) { // login expired or session locked: keep everything, stop pushing
      setState({ needsLogin: err.code !== 'SESSION_LOCKED', locked: err.code === 'SESSION_LOCKED', error: '' })
      return 'blocked'
    }
    setState({ error: isNetworkError(err) ? '' : err.message }) // an unreachable server just means "offline-ish"
    await backoff(items.map((i) => i.entry), err.message)
    return 'failed'
  }

  setState({ needsLogin: false, locked: false })
  for (const item of items) {
    const { entry, snapshotAt } = item
    const r = (answer.results || []).find((x) => x.docId === entry.docId && x.collection === entry.collection)
    if (!r || r.status === 'error') { await backoff([entry], r?.message || 'No answer from the server'); continue }

    const current = await getDoc(entry.collection, entry.docId)
    // The user edited the record again while this push was in flight: keep it pending, send the newer text next round.
    const editedMeanwhile = current && current.local_changed_at !== snapshotAt

    if (r.status === 'ok') {
      if (editedMeanwhile) {
        await db.outbox.update(entry.seq, { tries: 0, nextTryAt: 0 })
        if (r.version) await db[entry.collection].update(entry.docId, { baseVersion: r.version, version: r.version })
      } else {
        await db.outbox.delete(entry.seq)
        const patch = { syncStatus: 'synced', serverCopy: undefined, rejectedMessage: undefined }
        if (r.version) { patch.version = r.version; patch.baseVersion = r.version }
        await db[entry.collection].update(entry.docId, patch)
      }
    } else if (r.status === 'conflict') {
      // Never overwrite: keep both versions and let the therapist choose.
      await db.outbox.delete(entry.seq)
      await patchSealed(entry.collection, entry.docId, { syncStatus: 'conflict', serverCopy: r.server, conflictCode: r.code })
    } else if (r.status === 'rejected') {
      await db.outbox.delete(entry.seq)
      await db[entry.collection].update(entry.docId, { syncStatus: 'rejected', rejectedMessage: r.message || 'The server did not accept this change.' })
    }
  }
  return 'more'
}

// Updates a record that may hold sealed fields, WITHOUT adding an outbox entry.
async function patchSealed(collection, id, patch) {
  const rec = await getDoc(collection, id)
  if (!rec) return
  const { syncStatus, ...rest } = { ...rec, ...patch }
  await db[collection].delete(id)
  await putSynced(collection, rest)
  await db[collection].update(id, { syncStatus })
}

async function pushAll(force) {
  for (let i = 0; i < 20; i += 1) { // at most 20 batches per run
    const result = await pushOnce(force)
    if (result !== 'more') return result
  }
  return 'more'
}

// ───────────────────────────── pull ─────────────────────────────
async function pull() {
  const since = await getMeta('lastSyncTime')
  let answer
  try {
    answer = await callApi(`/api/sync/pull${since ? `?since=${encodeURIComponent(since)}` : ''}`)
  } catch (err) {
    if (err.status === 401) { setState({ needsLogin: err.code !== 'SESSION_LOCKED', locked: err.code === 'SESSION_LOCKED' }); return false }
    setState({ error: isNetworkError(err) ? '' : err.message })
    return false
  }

  const docs = answer.docs || {}
  // First pull on this device: start from a clean copy of the read-only sets.
  if (!since) { await db.patients.clear(); await db.appointments.where('syncStatus').equals('synced').delete() }

  for (const collection of ['patients', 'appointments', 'soapNotes', 'speechRecordings']) {
    for (const doc of docs[collection] || []) {
      const local = await db[collection].get(doc._id)
      // Never overwrite a record that has unsent local changes (or a conflict to resolve).
      if (local && local.syncStatus && local.syncStatus !== 'synced') continue
      const record = collection === 'soapNotes' ? { ...doc, baseVersion: doc.version } : doc
      await putSynced(collection, record)
    }
  }
  await setMeta('lastSyncTime', answer.serverTime) // the SERVER's clock, never the device's
  return true
}

// ───────────────────────────── one full sync run ─────────────────────────────
let running = null
export function syncNow({ force = false } = {}) {
  if (running) return running // one run at a time
  const run = (async () => {
    try {
      if (!navigator.onLine) { setState({ online: false }); return }
      if (!getSessionToken()) { setState({ needsLogin: true }); return }
      setState({ online: true, syncing: true })
      const pushed = await pushAll(force)
      if (pushed !== 'blocked') {
        const pulled = await pull()
        if (pulled && pushed !== 'failed') setState({ error: '', lastSyncAt: new Date().toISOString() })
      }
    } catch (err) {
      console.error('sync failed:', err)
      setState({ error: err.message || 'Sync failed' })
    } finally {
      setState({ syncing: false })
      refreshCounts()
    }
  })()
  // Cleared from OUTSIDE the async body: a run that returns before its first await
  // (offline, no token) would otherwise clear the flag before it was set, and block every later run.
  running = run
  run.finally(() => { if (running === run) running = null })
  return run
}

// ───────────────────────────── conflict + rejection helpers (used by the dialog) ─────────────────────────────
// "Keep my version": send it again, this time based on the server's newer version.
export async function resolveKeepMine(collection, id) {
  const rec = await getDoc(collection, id)
  if (!rec?.serverCopy) return
  await saveLocal(collection, { _id: id, baseVersion: rec.serverCopy.version, serverCopy: null, conflictCode: null }, 'update')
  syncNow({ force: true })
}
// "Use the other version": replace what is on this device with the server's copy.
export async function resolveUseTheirs(collection, id) {
  const rec = await getDoc(collection, id)
  if (!rec?.serverCopy) return
  const server = rec.serverCopy
  await db.outbox.where({ collection, docId: id }).delete()
  await db[collection].delete(id)
  await putSynced(collection, { ...server, baseVersion: server.version })
  await refreshCounts()
}
// Forget a change the server refused (the user has already read the reason).
export async function dismissRejected(collection, id) {
  await db.outbox.where({ collection, docId: id }).delete()
  await db[collection].delete(id)
  await refreshCounts()
}

// ───────────────────────────── start / stop ─────────────────────────────
let started = false
let timer = null
let debounce = null
let subs = []
const onOnline = () => { setState({ online: true }); syncNow({ force: true }) }
const onOffline = () => setState({ online: false })

export function startSync() {
  if (started) return
  started = true
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
  timer = setInterval(() => { if (navigator.onLine) syncNow() }, SYNC_EVERY_MS)
  // A local save changes the outbox: send it a moment later (batches rapid edits).
  subs.push(watch(() => db.outbox.count(), (n) => {
    setState({ pending: n })
    if (n > 0 && navigator.onLine) { clearTimeout(debounce); debounce = setTimeout(() => syncNow(), 800) }
    refreshCounts()
  }))
  syncNow({ force: true }) // app start
}

export function stopSync() {
  if (!started) return
  started = false
  window.removeEventListener('online', onOnline)
  window.removeEventListener('offline', onOffline)
  clearInterval(timer); clearTimeout(debounce)
  subs.forEach((s) => s.unsubscribe()); subs = []
  setState({ pending: 0, conflicts: 0, rejected: 0, error: '', needsLogin: false, locked: false, syncing: false })
}
