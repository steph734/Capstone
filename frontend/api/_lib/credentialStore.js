// Optional server-side store for prototype password resets, backed by Vercel KV
// (Upstash Redis, REST API). When the KV env vars are not set the helpers no-op
// and the client falls back to per-browser localStorage — so the flow still
// works on a single machine without any infrastructure.
//
// Vercel KV / Upstash inject these when a store is connected to the project:
//   KV_REST_API_URL / KV_REST_API_TOKEN   (also UPSTASH_REDIS_REST_URL/TOKEN)

function readEnv(name) {
  const raw = process.env[name]
  if (raw == null) return ''
  return raw.trim().replace(/^["']|["']$/g, '').trim()
}

function kvConfig() {
  return {
    url: readEnv('KV_REST_API_URL') || readEnv('UPSTASH_REDIS_REST_URL'),
    token: readEnv('KV_REST_API_TOKEN') || readEnv('UPSTASH_REDIS_REST_TOKEN'),
  }
}

export function isCredentialStoreConfigured() {
  const { url, token } = kvConfig()
  return Boolean(url && token)
}

// Runs one Redis command over the Upstash-compatible REST endpoint, e.g.
// ['SET', key, value] or ['GET', key]. Returns { configured, result }.
async function kvCommand(command) {
  const { url, token } = kvConfig()
  if (!url || !token) return { configured: false, result: null }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`KV ${command[0]} failed: ${res.status} ${detail}`.trim())
  }

  const data = await res.json()
  return { configured: true, result: data.result }
}

const keyFor = (email) => `pwreset:${String(email || '').trim().toLowerCase()}`

// Persists the new password for an account (identified by email + role).
// Returns true if it was actually written to KV, false if KV isn't configured.
export async function saveResetCredential({ email, role, password }) {
  if (!email || !password) {
    throw new Error('saveResetCredential needs an email and password')
  }
  const value = JSON.stringify({
    password,
    email: String(email).trim().toLowerCase(),
    role: role || null,
    updatedAt: Date.now(),
  })
  const { configured } = await kvCommand(['SET', keyFor(email), value])
  return configured
}

// Reads back { password, email, role, updatedAt } for an email, or null.
export async function getResetCredential(email) {
  const { configured, result } = await kvCommand(['GET', keyFor(email)])
  if (!configured || !result) return null
  try {
    return typeof result === 'string' ? JSON.parse(result) : result
  } catch {
    return null
  }
}
