// Identity for every Pao request. A therapist-run session identifies the
// patient through its activity session; a patient on their own device is
// identified by email. Practice mode has no patient, so it sends nothing.
export function identQuery(ident) {
  if (!ident) return ''
  if (ident.activitySessionId) return `activitySessionId=${encodeURIComponent(ident.activitySessionId)}`
  if (ident.patientEmail) return `patientEmail=${encodeURIComponent(ident.patientEmail)}`
  return ''
}

export function identBody(ident) {
  if (ident?.activitySessionId) return { activitySessionId: ident.activitySessionId }
  if (ident?.patientEmail) return { patientEmail: ident.patientEmail }
  return {}
}

export function hasIdent(ident) {
  return !!(ident?.activitySessionId || ident?.patientEmail)
}

async function jsonOrThrow(res) {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data.error || `Request failed (${res.status})`), { status: res.status })
  return data
}

export async function getPaoProfile(ident) {
  return jsonOrThrow(await fetch(`/api/pao?${identQuery(ident)}`))
}

export async function getWardrobe(ident) {
  return jsonOrThrow(await fetch(`/api/pao/wardrobe?${identQuery(ident)}`))
}

export async function getPaoBadges(ident) {
  return jsonOrThrow(await fetch(`/api/pao/badges?${identQuery(ident)}`))
}

export async function equipPao(ident, slot, code) {
  return jsonOrThrow(await fetch('/api/pao/equip', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...identBody(ident), slot, code }),
  }))
}

export async function equipPaoTheme(ident, themeCode) {
  return jsonOrThrow(await fetch('/api/pao/equip-theme', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...identBody(ident), themeCode }),
  }))
}

export async function markPaoSeen(ident, { badgeCodes = [], unlocks = [] }) {
  return jsonOrThrow(await fetch('/api/pao/seen', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...identBody(ident), badgeCodes, unlocks }),
  }))
}
