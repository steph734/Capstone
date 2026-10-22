// The only way the UI should save data. Every create/update does TWO things in
// one transaction, so they succeed or fail together:
//   1. writes the record to its local table with syncStatus 'pending'
//   2. adds an entry to the outbox, so the sync engine will push it later
// The UI never waits for the network.
import { liveQuery } from 'dexie'
import { db, SYNCED_COLLECTIONS } from './db'
import { newId } from './ids'

// op is 'create' or 'update'. `doc` may be partial for an update: it is merged
// into the stored record. Returns the saved record.
export async function saveLocal(collection, doc, op = 'create') {
  if (!SYNCED_COLLECTIONS.includes(collection)) throw new Error(`Unknown collection "${collection}"`)
  const table = db[collection]

  return db.transaction('rw', table, db.outbox, async () => {
    const id = doc._id || newId()
    const existing = op === 'update' ? await table.get(id) : null
    if (op === 'update' && !existing) throw new Error(`Cannot update ${collection}/${id}: not on this device`)

    // local_changed_at is shown to the user only. The server never trusts the
    // device clock: conflicts and "what changed since" use the server's updated_at.
    const record = { ...(existing || {}), ...doc, _id: id, syncStatus: 'pending', local_changed_at: new Date().toISOString() }
    await table.put(record)

    // One outbox entry per record is enough: the push always sends the record's
    // latest state. If the record was never pushed, it stays a 'create'.
    const queued = await db.outbox.where({ collection, docId: id }).first()
    if (!queued) await db.outbox.add({ collection, op, docId: id, at: new Date().toISOString(), tries: 0, nextTryAt: 0 })
    return record
  })
}

// Reads. These are plain Dexie queries, so they work with no connection.
export const getDoc = (collection, id) => db[collection].get(id)
export const listDocs = (collection) => db[collection].toArray()

// Number of changes still waiting to be sent (drives the "N changes pending" label).
export const pendingCount = () => db.outbox.count()

// Lets a React component re-render whenever the pending count changes:
//   const sub = watchPending(setCount); return () => sub.unsubscribe()
export function watchPending(callback) {
  return liveQuery(() => db.outbox.count()).subscribe({ next: callback, error: () => {} })
}
