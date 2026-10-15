// Helpers for the voice recorder (SpeechFeaturesUI).

// The best container/codec this browser can actually record, or '' to let the
// browser choose. WebM/Opus first (Chrome, Edge, Firefox), MP4 for Safari.
export function pickRecorderMime() {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return ''
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/ogg;codecs=opus']
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || ''
}

export function extensionForMime(mime) {
  const m = String(mime || '').toLowerCase()
  if (m.includes('mp4')) return 'm4a'
  if (m.includes('ogg')) return 'ogg'
  if (m.includes('wav')) return 'wav'
  return 'webm'
}

// Decodes a recording and re-encodes it as 16-bit PCM WAV, which every player
// (Windows Media Player included) can open; browsers record WebM/Opus, which
// many desktop players cannot. Throws if the audio cannot be decoded, which
// also means the browser could not play it either.
export async function blobToWavBlob(blob) {
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) throw new Error('Audio decoding is not supported in this browser.')
  const ctx = new Ctx()
  try {
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer())
    const { numberOfChannels, sampleRate, length } = decoded
    const channels = Array.from({ length: numberOfChannels }, (_, i) => decoded.getChannelData(i))
    const bytes = 44 + length * 2
    const view = new DataView(new ArrayBuffer(bytes))
    const text = (offset, s) => { for (let i = 0; i < s.length; i += 1) view.setUint8(offset + i, s.charCodeAt(i)) }
    text(0, 'RIFF'); view.setUint32(4, bytes - 8, true); text(8, 'WAVE')
    text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
    view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true)
    text(36, 'data'); view.setUint32(40, length * 2, true)
    for (let i = 0; i < length; i += 1) {
      let sum = 0
      for (let c = 0; c < numberOfChannels; c += 1) sum += channels[c][i]
      const s = Math.max(-1, Math.min(1, sum / numberOfChannels))
      view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    }
    return new Blob([view], { type: 'audio/wav' })
  } finally {
    ctx.close?.().catch(() => {})
  }
}

// Resolves true when the browser can decode the audio (i.e. it will play).
export async function canDecodeAudio(blob) {
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx || !blob || blob.size === 0) return blob?.size > 0
  const ctx = new Ctx()
  try {
    await ctx.decodeAudioData(await blob.arrayBuffer())
    return true
  } catch {
    return false
  } finally {
    ctx.close?.().catch(() => {})
  }
}
