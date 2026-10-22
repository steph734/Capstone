# Session notes (SOAP) security: what was built, how to migrate, how to test

Law context: health records are sensitive personal information under the Data Privacy Act of 2012 (RA 10173).
Everything below is enforced **on the server**; the browser only mirrors it.

## 1. Who can do what (server-enforced, every route)
| Role | Rule | Where |
|---|---|---|
| Therapist | Create / read / edit only notes of patients they have an appointment with. The patient id in the URL or body is never trusted. Only the **author** may edit a draft, sign, add an addendum, void or download the voice log. | `notes-create.js`, `notes-item.js`, `noteAccess.js` |
| Parent / guardian | Read only **signed**, un-voided notes of their **own** child that the therapist **shared**, and only the shared sections. Never drafts. | `notes-item.js` |
| Owner | Read only, and only with a stated reason (logged). Cannot edit, sign, void or download voice logs. | `notes-item.js` |
| Super Admin | No access to note content (role gate refuses). Can read the **Audit Logs** page only. | `session.js`, `audit-logs.js` |
| Patient account | No notes access except the guardian view above. | `notes-item.js` |

Every refusal is a **403** and is written to the audit trail as `denied` (`requireSession(... auditDenied: true)`).

## 2. Draft → signed lifecycle
- `status`: `draft` | `signed`. A signed note cannot be changed: edit and delete are rejected by the API itself, and there is **no delete route** (a mistaken note is *voided* with a reason).
- Signing needs: all four SOAP fields (10–5000 characters), a drawn signature, and the account password (client sends SHA-256, server does `bcrypt.compare`).
- Corrections are **addenda**: a separate linked document with its own author, server timestamp, reason, text, **drawn signature** and password check.
- Note date, sign time and author are set by the **server** (`manilaDate.js`). A date sent by the browser is ignored. (Offline drafts: the device date is accepted only if real, not in the future and at most 7 days old, and is flagged `date_source: device_offline`.)
- **Signing lock:** 5 wrong passwords lock *signing* for **15 minutes** (own counter in `sign_attempts`; login keeps its own 5-minute lock). Every wrong password is logged as `sign_failed`, the lock as `sign_locked`.
- **Versioning:** every save writes a row in `soap_note_versions` (version, editor, time, encrypted content). An edit made from an older version gets **409** instead of overwriting.

## 3. Encryption at rest
- AES-256-GCM (`soapCrypto.js`) for subjective, objective, assessment, plan, the voice log text, addendum text/reason and now the **signature image**. The note id and field name are bound into each ciphertext, so a value copied to another note cannot be decrypted.
- Key: environment variable `SOAP_ENCRYPTION_KEY` (64 hex characters), never committed (see `.env.example`).
  Generate one: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
  **Back it up.** Without it the notes cannot be read.

## 4. Audit logging
Each action writes two rows: a detailed row in `audit_logs` (who, role, patient, note, IP, details) and a readable row in `auditlogs`, which the **Super Admin Audit Logs page** reads. Logged: note created, viewed, draft saved, signed, **sign failed**, **signing locked**, addendum added, shared/unshared, voided, exported/printed, **voice log downloaded**, **access denied**. Descriptions never contain note text or patient names.
`GET /api/audit-logs` previously had no login check; it is now **Super Admin only**.

## 5. Hardening added
- `helmet` security headers on the API; `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, HSTS on the website (`vercel.json`), plus a **report-only** Content-Security-Policy (see the browser console for violations, then switch it to enforcing).
- **CORS:** the API only answers its own site. `sameSiteOnly` refuses POST/PATCH/DELETE whose `Origin` is another website (extra sites via `ALLOWED_ORIGINS`).
- **Rate limits** (stored in MongoDB so they work on Vercel): login 40 per 10 min per address and 15 per 10 min per account; signing/addendum 20 per 15 min per user. Answer: 429.
- `$operators` are stripped from every request body (NoSQL injection). Lengths (5000) and dates are validated on the server; note text is HTML-escaped on save and React escapes on display.

## 6. Token storage (explanation only, nothing changed)
Today the login token is in **sessionStorage** (not localStorage): it disappears when the tab closes and is not shared between tabs.
| | sessionStorage (now) | httpOnly + Secure + SameSite cookie |
|---|---|---|
| Stolen by an XSS script | **Yes**, JavaScript can read it | No, JavaScript cannot read it |
| CSRF (another site makes your browser send a request) | Not possible (token is added by our code) | Possible, so it needs `SameSite=Strict` and a CSRF token |
| Work to switch | none | login, `requireSession`, `authFetch`, offline sync, logout, and a CSRF token on every change |
| Survives closing the tab | No | Only if it is a persistent cookie |
The `sameSiteOnly` check and idle lock already reduce both risks. Moving to cookies is a sensible next step after the capstone.

## 7. Migration note for existing notes
1. Make sure `SOAP_ENCRYPTION_KEY` is set (and backed up) in `frontend/.env`, and the new code is deployed (old plain signatures still display until migrated).
2. Dry run: `node api/_lib/seeders/encryptLegacyNotes.js`, which lists legacy notes (not yet `enc: 1`) and plain signature images. Nothing is changed.
3. Apply: `node api/_lib/seeders/encryptLegacyNotes.js --apply`. It encrypts the four fields, sets `enc`, `version`, the SHA-256 hash for signed notes, writes version 1, converts the old "shared" flag into a share row, and **encrypts every plain signature image**. Safe to run again.
4. Check in MongoDB that `subjective…plan` and `signature_image` now start with `v1.`.

## 8. Test checklist
Automated (no browser): `npx vitest run api/_lib/noteSecurity.test.js api/_lib/syncRules.test.js`

Manual (deployed site; use two therapists, one guardian, one owner, one super admin):
- [ ] **Edit a signed note through the API is rejected.** Sign a note, then in the browser console:
  `await (await fetch('/api/notes/<id>',{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:'Bearer '+sessionStorage.getItem('sessionToken')},body:JSON.stringify({subjective:'changed text here'})})).json()` → **409** "Signed notes are read-only".
- [ ] **Change `?patient=` to another therapist's patient** → the note list/create returns **403**, and Audit Logs shows *Access Denied*.
- [ ] **Wrong password at signing** → "Incorrect password. 4 attempts left", logged as *Sign Failed*; after the **5th** → "Signing is locked for 15 minutes", logged *Signing Locked*; even the correct password is refused until the time passes; you can still log in.
- [ ] **A parent cannot see drafts or another child's note**: guardian opens `/api/notes/<draft id>` → **404**; another child's signed shared note → **404**.
- [ ] **Owner** can open a note only with a reason; trying `PATCH`/sign/void → **403** (logged). **Super Admin** opening `/api/notes/<id>` → **403**.
- [ ] **Voice log** download by the author works and is logged *Voice Log Downloaded*; by an owner or super admin → **403** (logged).
- [ ] **Unreadable in MongoDB:** in Atlas open `therapy_notes`; `subjective`, `objective`, `assessment`, `plan` and `signature_image` all start with `v1.` (no readable text).
- [ ] **Addendum** needs reason + text + a drawn signature + password; the original stays unchanged.
- [ ] **Date:** the form shows the server date; changing the PC clock does not change the saved note date.
- [ ] **Password field:** browser does not offer to autofill it, it is empty each time the form opens, and empty after every attempt.
- [ ] **Audit Logs page** (Super Admin) lists each action above: created, viewed, draft saved, signed, sign failed, signing locked, addendum, voice log downloaded, access denied.
- [ ] **Audit API is protected:** logged out, `fetch('/api/audit-logs')` → **401**; as a therapist → **403**.
- [ ] **Rate limit:** 16 wrong logins for one email within 10 minutes → **429**.
- [ ] **Cross-site refusal:** from another website's console, a `fetch('https://<your-app>/api/...', {method:'POST'})` is refused (**403** / blocked).
