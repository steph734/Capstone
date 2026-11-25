// Single place where Pao "talks". Speech comes from ElevenLabs (Pao's voice,
// via the server route /api/tts so the API key never reaches the browser).
// If that fails (offline, no credits, autoplay blocked) we fall back to the
// browser's speechSynthesis so Pao is never silent. Only one thing plays at a
// time: starting a new line or calling stopPaoVoice() cancels the previous.
const MAX_TEXT = 600
const CACHE_LIMIT = 40

let gen = 0 // bumped on every speak/stop; stale async work checks it and bails
let audioEl = null
let wordTimers = []
const cache = new Map() // text -> object URL (repeat lines replay without a new API call)
let ttsDisabledUntil = 0 // after a hard failure, skip the API briefly and use the fallback

function clearWordTimers() {
  wordTimers.forEach(clearTimeout)
  wordTimers = []
}

export function stopPaoVoice() {
  gen += 1
  clearWordTimers()
  if (audioEl) {
    try { audioEl.pause() } catch { /* ignore */ }
    audioEl.onended = audioEl.onerror = audioEl.onplaying = null
    audioEl = null
  }
  try { window.speechSynthesis?.cancel() } catch { /* ignore */ }
}

async function fetchAudioUrl(text) {
  if (cache.has(text)) return cache.get(text)
  const res = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) throw new Error(`tts ${res.status}`)
  const url = URL.createObjectURL(await res.blob())
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value
    URL.revokeObjectURL(cache.get(oldest))
    cache.delete(oldest)
  }
  cache.set(text, url)
  return url
}

// Fires onWord(prefix) per word, spread across the clip's duration by word
// length (ElevenLabs audio has no boundary events).
function scheduleWords(text, durationSec, myGen, onWord) {
  if (!onWord || !durationSec || !isFinite(durationSec)) return
  const re = /\S+/g
  const total = Math.max(1, text.length)
  let m
  while ((m = re.exec(text))) {
    const end = m.index + m[0].length
    const at = (m.index / total) * durationSec * 1000
    const prefix = text.slice(0, end)
    wordTimers.push(setTimeout(() => { if (myGen === gen) onWord(prefix) }, at))
  }
}

function speakBrowser(text, myGen, { onStart, onEnd, onWord, rate, pitch }) {
  if (!window.speechSynthesis) { onEnd?.(); return }
  try {
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.rate = rate
    u.pitch = pitch
    u.onstart = () => { if (myGen === gen) onStart?.() }
    u.onboundary = (e) => {
      if (myGen !== gen || (e.name && e.name !== 'word')) return
      const end = e.charIndex + (e.charLength || 0)
      onWord?.(text.slice(0, end || e.charIndex + 1))
    }
    u.onend = u.onerror = () => { if (myGen === gen) onEnd?.() }
    window.speechSynthesis.speak(u)
  } catch { onEnd?.() }
}

// onWord(partialText) fires as each word starts, with partialText being the
// prefix of `text` spoken so far — callers derive a word index by splitting
// it on whitespace. Treat highlighting as a nice-to-have, not functional.
// `rate`/`pitch` only apply to the browser-voice fallback.
export function speakPao(text, opts = {}) {
  const { onStart, onEnd, onWord, rate = 1, pitch = 1.15 } = opts
  if (!text?.trim()) return
  stopPaoVoice()
  const myGen = gen
  const clean = text.trim().slice(0, MAX_TEXT)
  const fallback = () => { if (myGen === gen) speakBrowser(clean, myGen, { onStart, onEnd, onWord, rate, pitch }) }

  if (typeof window === 'undefined' || Date.now() < ttsDisabledUntil) return fallback()

  fetchAudioUrl(clean)
    .then((url) => {
      if (myGen !== gen) return
      const audio = new Audio(url)
      audioEl = audio
      audio.onplaying = () => {
        audio.onplaying = null
        if (myGen !== gen) return
        onStart?.()
        scheduleWords(clean, audio.duration, myGen, onWord)
      }
      audio.onended = () => { if (myGen === gen) { clearWordTimers(); audioEl = null; onEnd?.() } }
      audio.onerror = () => { audioEl = null; fallback() }
      return audio.play().catch(() => { audioEl = null; fallback() }) // e.g. autoplay blocked
    })
    .catch(() => {
      ttsDisabledUntil = Date.now() + 30_000 // don't hammer a failing API
      fallback()
    })
}
