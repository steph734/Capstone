// Pao's poses live in public/games/daily-routines/ and are loaded by URL (never imported).
const base = import.meta.env.BASE_URL || '/'
const pose = (file) => `${base}games/daily-routines/pao-${file}.svg`

export const paoPoses = {
  welcome: pose('welcome'),
  showing: pose('showing'),
  asking: pose('asking'),
  goodStep: pose('good-step'),
  tryAgain: pose('try-again'),
  thinking: pose('thinking'),
  hint: pose('hint'),
  taskDone: pose('task-done'),
}

export const FALLBACK_PAO = `${base}pao.png`
