// Text-to-speech, speech recognition and small sound effects for the builder
// and the player. All optional: where the browser has no voice or microphone
// support, callers get `false` back and show a friendly fallback.
const LANG = { en: 'en-US', fil: 'fil-PH', ceb: 'fil-PH' }

export function speak(text, language = 'en') {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text) return false
  try {
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(String(text))
    u.lang = LANG[language] || 'en-US'
    u.rate = 0.95
    const prefix = u.lang.slice(0, 2)
    const voices = window.speechSynthesis.getVoices()
    // Bisaya has no voice of its own; Filipino is the closest, then English.
    const voice = voices.find((v) => v.lang.toLowerCase().startsWith(prefix)) || voices.find((v) => v.lang.startsWith('en'))
    if (voice) u.voice = voice
    window.speechSynthesis.speak(u)
    return true
  } catch { return false }
}
export function stopSpeaking() { try { window.speechSynthesis?.cancel() } catch { /* nothing to stop */ } }

export const canListen = () => typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)

// Listens for one phrase. Returns a stop() function, or null if unsupported.
export function listenOnce(language, onResult, onEnd) {
  const Rec = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)
  if (!Rec) return null
  const rec = new Rec()
  rec.lang = LANG[language] || 'en-US'
  rec.interimResults = false
  rec.maxAlternatives = 3
  rec.onresult = (e) => onResult(Array.from(e.results[0]).map((a) => a.transcript))
  rec.onend = () => onEnd?.()
  rec.onerror = () => onEnd?.()
  try { rec.start() } catch { return null }
  return () => { try { rec.stop() } catch { /* already stopped */ } }
}

let ctx
export function playSound(kind) {
  if (kind === 'none' || typeof window === 'undefined') return
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)()
    const tone = (freq, start, dur, type = 'sine', gain = 0.12) => {
      const o = ctx.createOscillator(); const g = ctx.createGain()
      o.type = type; o.frequency.value = freq
      g.gain.setValueAtTime(gain, ctx.currentTime + start)
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur)
      o.connect(g); g.connect(ctx.destination); o.start(ctx.currentTime + start); o.stop(ctx.currentTime + start + dur)
    }
    if (kind === 'ding') { tone(880, 0, 0.25); tone(1320, 0.12, 0.3) }
    else if (kind === 'cheer') { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.28, 'triangle')) }
    else if (kind === 'pop') tone(440, 0, 0.12, 'square', 0.06)
    else if (kind === 'wrong') tone(220, 0, 0.22, 'sine', 0.08)
  } catch { /* audio blocked until a gesture; fine */ }
}
