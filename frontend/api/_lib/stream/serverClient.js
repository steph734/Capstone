// Server-side Stream client. Mints chat+video tokens (one JWT covers both —
// Stream Video's auth reuses the Chat/Feeds token format) and upserts users.
// STREAM_API_KEY/STREAM_API_SECRET are server-only env vars, never exposed
// to the browser (the client only ever sees VITE_STREAM_API_KEY + a token).
import { StreamChat } from 'stream-chat'

let cached = null

export function getStreamServerClient() {
  const apiKey = process.env.STREAM_API_KEY
  const apiSecret = process.env.STREAM_API_SECRET
  if (!apiKey || !apiSecret) {
    throw new Error('STREAM_API_KEY / STREAM_API_SECRET are not set on the server.')
  }
  if (!cached) {
    cached = StreamChat.getInstance(apiKey, apiSecret)
  }
  return cached
}

// A stable, Stream-legal user id (letters/numbers/@/_/- only) for a given
// identity. Patient-side identity is the clinical `patients._id` (not the
// `users._id`) so the same id resolves whether the guardian opens /messages
// themselves or a therapist starts the conversation first.
export function patientStreamId(patientId) {
  return `patient-${String(patientId)}`
}

export function therapistStreamId(employeeId) {
  return `therapist-${String(employeeId)}`
}

export async function upsertStreamUser(client, { id, name, image, appRole }) {
  await client.upsertUser({
    id,
    name: name || 'TherapyPro user',
    image: image || undefined,
    role: 'user',
    custom: { appRole },
  })
}
