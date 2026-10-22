// The local database (IndexedDB, through Dexie). This is the device's copy of
// the data a therapist needs during a session, plus the "outbox": the list of
// changes that still have to be sent to the server.
//
// Only data for the signed-in user is kept here, and everything is erased on
// logout (see clearAll below, called from handleLogout in App.jsx).
import Dexie from 'dexie'

export const db = new Dexie('therapypro-offline')

// Only fields we search by are listed ("indexes"); records can hold any other fields.
//   syncStatus: 'pending' (not on the server yet) | 'synced'
//   outbox.seq is an auto-number, so changes are sent in the order they were made.
db.version(1).stores({
  patients: '_id, updated_at',
  appointments: '_id, employee_id, session_date, syncStatus, updated_at',
  soapNotes: '_id, patient_id, syncStatus, updated_at',
  gameSessions: '_id, patient_id, syncStatus',
  speechRecordings: '_id, patient_id, syncStatus',
  outbox: '++seq, collection, docId',
  meta: 'key', // small settings such as { key: 'lastSyncTime', value: '2026-10-22T...' }
})

// Tables that hold synced records (everything except outbox and meta).
export const SYNCED_COLLECTIONS = ['patients', 'appointments', 'soapNotes', 'gameSessions', 'speechRecordings']

// Wipes every table. Called on logout so nothing clinical stays on a shared device.
export async function clearAll() {
  await Promise.all(db.tables.map((t) => t.clear()))
}

export async function getMeta(key, fallback = null) {
  const row = await db.meta.get(key)
  return row ? row.value : fallback
}
export const setMeta = (key, value) => db.meta.put({ key, value })
