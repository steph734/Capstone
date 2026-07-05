// GetStream Video config — read from environment variables so no credentials
// ever live in source. See `.env.example` for what to fill in and where to get it.
//
// This project has no backend, so auth uses Stream Dashboard "Developer Tokens"
// (Auth Checks disabled on the Stream app). That's fine for a demo/capstone —
// it is NOT secure enough for production (real apps must mint tokens server-side
// with the API Secret, which must never reach the browser).

export const STREAM_API_KEY = import.meta.env.VITE_STREAM_API_KEY || ''

export const STREAM_PATIENT_USER = {
  id: import.meta.env.VITE_STREAM_PATIENT_USER_ID || 'alvrin',
  name: 'Alvrin',
  token: import.meta.env.VITE_STREAM_PATIENT_TOKEN || '',
}

export const STREAM_THERAPIST_USER = {
  id: import.meta.env.VITE_STREAM_THERAPIST_USER_ID || 'dr-sarah-reyes',
  name: 'Dr. Sarah Reyes',
  token: import.meta.env.VITE_STREAM_THERAPIST_TOKEN || '',
}

// Fixed call room shared by both demo identities so they land in the same call.
export const STREAM_CALL_TYPE = 'default'
export const STREAM_CALL_ID = 'alvrin-sarah-reyes-session'

export function isStreamConfigured() {
  return Boolean(STREAM_API_KEY && STREAM_PATIENT_USER.token && STREAM_THERAPIST_USER.token)
}
