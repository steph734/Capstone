// Daily.co config — a single public room URL, no API key or backend needed.
// Create one at dashboard.daily.co -> Rooms -> Create room, keep Privacy = Public,
// then paste its URL into VITE_DAILY_ROOM_URL in .env (see .env.example).
export const DAILY_ROOM_URL = import.meta.env.VITE_DAILY_ROOM_URL || ''

export function isDailyConfigured() {
  return Boolean(DAILY_ROOM_URL)
}
