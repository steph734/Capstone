// Pao's voice — realistic, human-like speech via the ElevenLabs TTS proxy
// (/api/tts, key stays server-side). Falls back to the browser's built-in
// speechSynthesis if the API is unreachable (e.g. offline, quota hit, or
// running the frontend without `vercel dev` locally) so Pao never goes silent.

const audioCache = new Map()
let currentAudio = null

function pickBrowserVoice(voices) {
  return (
    voices.find(v => /zira/i.test(v.name)) ||
    voices.find(v => /samantha/i.test(v.name)) ||
    voices.find(v => v.lang === 'en-US') ||
    voices.find(v => v.lang?.startsWith('en')) ||
    voices[0]
  )
}

function speakWithBrowserVoice(text, { pitch = 1.62, rate = 1.1, onStart, onEnd, onWord } = {}) {
  if (!window.speechSynthesis) { onEnd?.(); return }
  window.speechSynthesis.cancel()
  const utt = new SpeechSynthesisUtterance(text)
  utt.rate = rate; utt.pitch = pitch; utt.volume = 1
  utt.onstart = () => onStart?.()
  utt.onend = () => onEnd?.()
  utt.onerror = () => onEnd?.()
  utt.onboundary = (e) => { if (e.name === 'word') onWord?.(text.substring(0, e.charIndex + e.charLength)) }
  const go = () => {
    const voice = pickBrowserVoice(window.speechSynthesis.getVoices())
    if (voice) utt.voice = voice
    window.speechSynthesis.speak(utt)
  }
  if (window.speechSynthesis.getVoices().length > 0) go()
  else window.speechSynthesis.onvoiceschanged = go
}

export function stopPaoVoice() {
  window.speechSynthesis?.cancel()
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.onplay = null
    currentAudio.onended = null
    currentAudio.onerror = null
    currentAudio.ontimeupdate = null
    currentAudio = null
  }
}

// Speaks `text` as Pao. Options: onStart, onEnd, onWord(partialText),
// pitch/rate (used only by the browser-voice fallback).
export async function speakPao(text, { onStart, onEnd, onWord, pitch, rate } = {}) {
  stopPaoVoice()

  try {
    let blobUrl = audioCache.get(text)
    if (!blobUrl) {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) throw new Error(`tts request failed: ${res.status}`)
      const blob = await res.blob()
      if (!blob.type.startsWith('audio')) throw new Error('tts returned a non-audio response')
      blobUrl = URL.createObjectURL(blob)
      audioCache.set(text, blobUrl)
    }

    const audio = new Audio(blobUrl)
    currentAudio = audio

    audio.onplay = () => onStart?.()
    audio.onended = () => { onEnd?.(); if (currentAudio === audio) currentAudio = null }
    audio.onerror = () => { onEnd?.(); if (currentAudio === audio) currentAudio = null }

    if (onWord) {
      // ElevenLabs doesn't give us word-boundary events, so approximate the
      // word-by-word reveal by pacing it across the audio's real duration.
      const words = text.split(/\s+/)
      audio.ontimeupdate = () => {
        if (!audio.duration) return
        const idx = Math.min(words.length, Math.ceil((audio.currentTime / audio.duration) * words.length))
        onWord(words.slice(0, idx).join(' '))
      }
    }

    await audio.play()
  } catch (err) {
    console.warn('[paoVoice] ElevenLabs unavailable, falling back to browser voice:', err.message)
    speakWithBrowserVoice(text, { pitch, rate, onStart, onEnd, onWord })
  }
}
