// Thin wrapper around window.speechSynthesis used everywhere Pao "talks" to a
// patient, so callers don't reach into the raw Web Speech API directly and so
// there's a single place enforcing "only one thing plays at a time".
let currentUtterance = null

export function stopPaoVoice() {
  if (window.speechSynthesis) window.speechSynthesis.cancel()
  currentUtterance = null
}

// onWord(partialText) fires as each word starts, with partialText being the
// prefix of `text` spoken so far — callers derive a word index by splitting
// it on whitespace. Not every browser fires word boundaries (notably some
// mobile browsers), so callers should treat highlighting as a nice-to-have
// and not depend on it for anything functional.
export function speakPao(text, { onStart, onEnd, onWord, rate = 1, pitch = 1.15 } = {}) {
  if (!text?.trim()) return
  if (!window.speechSynthesis) { onEnd?.(); return }
  stopPaoVoice()

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.rate = rate
  utterance.pitch = pitch
  utterance.onstart = () => onStart?.()
  utterance.onboundary = (e) => {
    if (e.name && e.name !== 'word') return
    const end = e.charIndex + (e.charLength || 0)
    onWord?.(text.slice(0, end || e.charIndex + 1))
  }
  utterance.onend = () => { currentUtterance = null; onEnd?.() }
  utterance.onerror = () => { currentUtterance = null; onEnd?.() }

  currentUtterance = utterance
  window.speechSynthesis.speak(utterance)
}
