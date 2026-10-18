// Pao's poses live in public/games/emergency-ready/ and are loaded by URL (never imported).
const base = import.meta.env.BASE_URL || '/'
const pose = (file) => `${base}games/emergency-ready/pao-${file}.svg`

export const paoPoses = {
  welcome: pose('welcome'),
  explaining: pose('explaining'),
  showing: pose('showing'),
  calm: pose('calm'),
  thinking: pose('thinking'),
  gentleNo: pose('gentle-no'),
  packed: pose('packed'),
  safetyStar: pose('safety-star'),
}

export const FALLBACK_PAO = `${base}pao.png`
