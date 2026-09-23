// Pao's spoken-language preference — persisted so it carries across the
// intro, the games list, and every individual game screen for the session.

const STORAGE_KEY = 'pao_language'

export const PAO_LANGUAGES = [
  { id: 'en',  label: 'English',           flag: '🇺🇸', voiceHints: ['en'] },
  { id: 'tl',  label: 'Tagalog',           flag: '🇵🇭', voiceHints: ['fil', 'tl'] },
  { id: 'ceb', label: 'Cebuano (Bisaya)',  flag: '🇵🇭', voiceHints: ['ceb', 'fil', 'tl'] },
]

export function getPaoLanguage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (PAO_LANGUAGES.some(l => l.id === saved)) return saved
  } catch {}
  return 'en'
}

export function setPaoLanguage(lang) {
  if (!PAO_LANGUAGES.some(l => l.id === lang)) return
  try { localStorage.setItem(STORAGE_KEY, lang) } catch {}
}

// Picks the best-matching browser speechSynthesis voice for a Pao language —
// used only by the couple of game screens that speak via the browser's
// built-in TTS instead of the Voice.ai proxy (which handles language
// switching itself from the text alone).
export function pickBrowserVoiceForLang(voices, lang) {
  const hints = (PAO_LANGUAGES.find(l => l.id === lang) || PAO_LANGUAGES[0]).voiceHints
  for (const hint of hints) {
    const match = voices.find(v => v.lang?.toLowerCase().startsWith(hint))
    if (match) return match
  }
  return (
    voices.find(v => /zira/i.test(v.name)) ||
    voices.find(v => /samantha/i.test(v.name)) ||
    voices.find(v => v.lang === 'en-US') ||
    voices.find(v => v.lang?.startsWith('en')) ||
    voices[0]
  )
}
