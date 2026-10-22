// The only way the UI should save data. Every create/update does TWO things in
// one transaction, so they succeed or fail together:
//   1. writes the record to its local table with syncStatus 'pending'
//   2. adds an entry to the outbox, so the sync engine will push it later
// The UI never waits for the network.
//
// SOAP note text is clinical data, so it is sealed (encrypted, see noteCrypto.js)
// before it touches IndexedDB and opened again when read.
import { liveQuery } from 'dexie'
import { db, SYNCED_COLLECTIONS } from './db'
import { newId } from './ids'
import { seal, open } from './noteCrypto'

// Fields that hold clinical text, per collection. Everything else stays plain.
const SEALED_FIELDS = { soapNotes: ['subjective', 'objective', 'assessment', 'plan', 'diagnosis', 'serverCopy'] }

// plain record -> record as stored (secret fields moved into one encrypted blob)
async function sealRecord(collection, record) {
  const fields = SEALED_FIELDS[collection]
  if (!fields) return record
  const secret = {}
  const rest = { ...record }
  for (const f of fields) { if (f in rest) { secret[f] = rest[f]; delete rest[f] } }
  return { ...rest, sealed: await seal(secret) }
}

// stored record -> plain record. A record that cannot be decrypted (key lost,
// data tampered) is returned without its text and flagged, never as garbage.
export async function openRecord(collection, stored) {
  if (!stored || !SEALED_FIELDS[collection] || !stored.sealed) return stored
  const { sealed, ...rest } = stored
  try { return { ...rest, ...(await open(sealed)) } } catch { return { ...rest, unreadable: true } }
}

// op is 'create' or 'update'. `doc` may be partial for an update: it is merged
// into the stored record. Returns the saved (plain) record.
export async function saveLocal(collection, doc, op = 'create') {
  if (!SYNCED_COLLECTIONS.includes(collection)) throw new Error(`Unknown collection "${collection}"`)
  const table = db[collection]
  const id = doc._id || newId()

  // Encryption is asynchronous, so it is done BEFORE the transaction opens
  // (a Dexie transaction closes if it waits on a non-Dexie promise).
  const existing = await openRecord(collection, await table.get(id))
  // local_changed_at is shown to the user only. The server never trusts the
  // device clock: conflicts and "what changed since" use the server's updated_at.
  const record = { ...(existing || {}), ...doc, _id: id, syncStatus: 'pending', local_changed_at: new Date().toISOString() }
  const stored = await sealRecord(collection, record)

  await db.transaction('rw', table, db.outbox, async () => {
    await table.put(stored)
    // One outbox entry per record is enough: the push always sends the record's
    // latest state. If the record was never pushed, it stays a 'create'.
    const queued = await db.outbox.where({ collection, docId: id }).first()
    if (!queued) await db.outbox.add({ collection, op: existing ? op : (op === 'update' ? 'update' : 'create'), docId: id, at: new Date().toISOString(), tries: 0, nextTryAt: 0 })
    else await db.outbox.update(queued.seq, { tries: 0, nextTryAt: 0 }) // a new edit: try again right away
  })
  return record
}

// Writes a record that came FROM the server (already synced). Used by pull and by
// conflict resolution. Never touches the outbox.
export async function putSynced(collection, doc) {
  const stored = await sealRecord(collection, { ...doc, syncStatus: 'synced' })
  await db[collection].put(stored)
}

// Reads. These are plain Dexie queries, so they work with no connection.
export async function getDoc(collection, id) { return openRecord(collection, await db[collection].get(id)) }
export async function listDocs(collection) { return Promise.all((await db[collection].toArray()).map((r) => openRecord(collection, r))) }

// Number of changes still waiting to be sent (drives the "N changes pending" label).
export const pendingCount = () => db.outbox.count()

// Lets a React component re-render whenever a query's result changes:
//   const sub = watchPending(setCount); return () => sub.unsubscribe()
export function watchPending(callback) {
  return liveQuery(() => db.outbox.count()).subscribe({ next: callback, error: () => {} })
}
export function watch(querier, callback) {
  return liveQuery(querier).subscribe({ next: callback, error: () => {} })
}
