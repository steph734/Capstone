// Client-side id generator.
//
// Every new record gets its id on the device, before the server ever sees it.
// That makes retries safe: if a push is sent twice (flaky network), the server
// upserts by this id and still ends up with exactly ONE copy.
//
// Why not crypto.randomUUID()? The server's collections use MongoDB ObjectIds
// (validators and references expect 24 hex characters). So we build an
// ObjectId-shaped id: 4 bytes of time + 8 random bytes = 24 hex characters.
export function newId() {
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes.subarray(4))
  new DataView(bytes.buffer).setUint32(0, Math.floor(Date.now() / 1000))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
