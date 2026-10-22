// Encryption for SOAP note text stored on this device (IndexedDB).
//
// Why: the app promises clinical note text is never left readable in browser
// storage. So before a draft is written to Dexie, its text fields are sealed
// with AES-256-GCM (the browser's built-in WebCrypto).
//
// The key is created once per login, stored in IndexedDB as a NON-EXTRACTABLE
// CryptoKey (page code can use it, but can never read the key bytes out), and
// deleted together with everything else on logout (clearAll in db.js).
//
// Honest limit: this protects the data at rest (a copied IndexedDB file, a disk
// image, a browser export). It cannot protect against someone using the
// still-logged-in browser, which is why the session also locks after 15 minutes.
import { getMeta, setMeta, onClear } from './db'

const KEY_META = 'noteKey'
const enc = new TextEncoder()
const dec = new TextDecoder()

const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)))
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

let keyPromise = null
function getKey() {
  if (!keyPromise) {
    keyPromise = (async () => {
      let key = await getMeta(KEY_META)
      if (!key) {
        key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
        await setMeta(KEY_META, key)
      }
      return key
    })()
  }
  return keyPromise
}
// After logout the stored key is gone, so forget the cached one too.
export function forgetKey() { keyPromise = null }
onClear(forgetKey)

// object -> { iv, data } (both base64). A fresh random IV is used for every seal.
export async function seal(obj) {
  const key = await getKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj)))
  return { iv: toB64(iv), data: toB64(data) }
}

// { iv, data } -> object. Throws if the data was tampered with or the key is gone.
export async function open(sealed) {
  const key = await getKey()
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(sealed.iv) }, key, fromB64(sealed.data))
  return JSON.parse(dec.decode(plain))
}
