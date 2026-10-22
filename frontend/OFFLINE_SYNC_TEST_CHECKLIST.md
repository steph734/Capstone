# Offline sync: test checklist

Use Chrome with the deployed (or `npm run build && npm run preview`) site, logged in as a **Therapist**.
Offline = DevTools → **Network** → tick **Offline** (or the "No throttling" menu → Offline).
Look at the **sync pill** in the page header: *Online · Offline · N changes pending · Syncing… · Sync error · Review N*.
Inspect data in DevTools → **Application → IndexedDB → therapypro-offline** (tables: `outbox`, `soapNotes`, `gameSessions`, …).

## 0. Automated tests (run first, no browser needed)
```
npx vitest run src/offline api/_lib/syncRules.test.js
```
Expect **22 passed**. They cover: unique ids, one outbox entry per record, encrypted note text, logout wipe, push only cleared after "ok", backoff when unreachable, expired login keeps data, SOAP conflict (both choices), refused change, pull never overwrites unsent edits, and the server rules (idempotent create, 409 conflict, signed-meanwhile, assignment check, appointment overlap).

## 1. App loads offline
- [ ] Open Notes, Appointments and one game once while online.
- [ ] Go Offline, reload. The app loads; art you opened before still shows.
- [ ] The pill reads **Offline**.

## 2. SOAP draft written offline → exactly one copy on the server
- [ ] Online: open **Notes & Progress** once (this downloads your patients to the device).
- [ ] Go **Offline**, reload the Notes page. Your patients still list.
- [ ] Choose a patient → New note → write something in Subjective → **Save draft**.
- [ ] The yellow strip **"Saved on this device (1)"** appears. The pill says **Offline · 1 pending**.
- [ ] IndexedDB → `soapNotes`: the row has a `sealed` field and **no readable text** (encrypted).
- [ ] IndexedDB → `outbox`: one entry (`soapNotes`, `create`).
- [ ] Go **Online**. Within a few seconds the pill shows *Syncing…* then **Online**, the strip disappears, `outbox` is empty.
- [ ] MongoDB `therapy_notes`: **one** note with that `_id`, text encrypted (`v1.…`); `soap_note_versions` has one row.
- [ ] Repeat the push by clicking the pill twice quickly: still one note.

## 3. Game session played offline
- [ ] Online: start "Who is playing today?" for a patient and open the games list.
- [ ] Go **Offline**, play a game to the end.
- [ ] The finish card says **"Saved on this device"** (rewards come later). The pill shows **1 pending**.
- [ ] Go **Online**: the entry syncs. `game_sessions` has **one** completed session with `offline: true`, and the patient got XP/badge **once**.

## 4. Speech recording offline
- [ ] Online: open Speech to Text once. Go **Offline**, record and stop.
- [ ] Message: "transcript is saved on this device and will sync". The pill shows 1 pending.
- [ ] Go **Online**: `speechtextrecording` has one new row (transcript, no audio file; audio stays on the device).

## 5. Appointment update offline
- [ ] Offline: Appointments → mark a session **Completed**. Toast: "Saved offline…".
- [ ] Online: the appointment's `status` becomes `Completed` in MongoDB.

## 6. SOAP conflict (two devices)
- [ ] Device A and device B (or two browsers) both open the same **draft** note while online.
- [ ] Device B goes **Offline**, edits Subjective, saves (pending).
- [ ] Device A edits the same note and saves (online).
- [ ] Device B goes **Online**. The pill shows **Review 1**.
- [ ] Click it: **"This note was changed on another device"** shows *your version* and *the other version* side by side.
- [ ] **Use the other version**: your text is replaced, nothing is sent. OR
- [ ] **Keep my version**: it syncs, and the server note now has your text with a higher version.
- [ ] The server was never overwritten before you chose.
- [ ] Online-only variant: A edits and saves; B (still online, with the note open since before) saves → error "This note was changed on another device…" (409).
- [ ] If the note was **signed** on the other device meanwhile, only "Discard my changes" is offered.

## 7. Appointment overlap is refused
- [ ] (API test, see below) push a therapist appointment that overlaps one of your sessions. The pill shows **Review 1** and the message names the clashing time. **OK, remove it** clears it.

## 8. Expired login while offline
- [ ] Offline, keep writing drafts (they save locally).
- [ ] In the console run `sessionStorage.removeItem('sessionToken')`, then go Online.
- [ ] The pill says **Sign in to sync · N pending**. Nothing is lost.
- [ ] Log in again: the pending changes push.

## 9. Idle lock does not get bypassed
- [ ] Leave the app idle for 15+ minutes while online. The Notes page locks as before (background sync does **not** keep the session alive).
- [ ] The pill shows **Locked: unlock to sync** until you unlock.

## 10. Logout wipes the device
- [ ] With pending drafts, click **Logout**.
- [ ] IndexedDB `therapypro-offline`: every table is empty and the encryption key is gone.

## 11. Server errors back off, never drop
- [ ] DevTools → Network → right-click `sync/push` → **Block request URL**, save a draft, wait.
- [ ] `outbox` entry stays, `tries` goes up 1, 2, 3… and `nextTryAt` moves out (2s, 4s, 8s … max 5 min). Unblock: it sends and clears.

---
### API checks (browser console while logged in as Therapist)
```js
const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionStorage.getItem('sessionToken')}` }
// pull what is on the server for you
await (await fetch('/api/sync/pull', { headers: h })).json()
// push the SAME draft twice -> both "ok", one note in MongoDB
const id = Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, '0')).join('')
const e = { collection: 'soapNotes', op: 'create', docId: id, doc: { _id: id, patient_id: '<an assigned patient _id>', session_date: '2026-10-22', subjective: 'Sync test note, safe to delete.', baseVersion: 0 } }
const push = () => fetch('/api/sync/push', { method: 'POST', headers: h, body: JSON.stringify({ entries: [e] }) }).then(r => r.json())
console.log(await push(), await push())
```
Delete any test notes afterwards (this writes to the real database).

### Known limits (say these to your panel honestly)
- **Therapists only.** Patients/guardians are not covered.
- **Signing a note needs the internet** (password + signature). Drafts work offline.
- Offline games are saved only when started from a therapist's **"Who is playing today?"** session.
- **Audio files** from Speech to Text stay on the device; only the transcript syncs.
- The device must have been online once (to load patients) and logged in; if the tab is closed offline the user must reconnect to log in (unsent data stays in IndexedDB and is sent after login).
- Local encryption protects stored data at rest, not a stolen *unlocked* session; the 15-minute idle lock covers that.
- Profiles/settings "last write wins" is not implemented (nothing in the local database holds profiles).
