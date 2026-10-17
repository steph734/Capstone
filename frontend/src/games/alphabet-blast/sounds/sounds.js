// Short, soft sounds synthesised with Web Audio (no audio files to ship).
let ctx
const audio = () => {
  try {
    const C = window.AudioContext || window.webkitAudioContext
    if (!C) return null
    ctx = ctx || new C()
    if (ctx.state === 'suspended') ctx.resume()
    return ctx
  } catch { return null }
}

function tone(freqs, { dur = 0.15, type = 'sine', vol = 0.06, gap = 0 } = {}) {
  const a = audio()
  if (!a) return
  freqs.forEach((f, i) => {
    const t = a.currentTime + i * (dur + gap)
    const o = a.createOscillator()
    const g = a.createGain()
    o.type = type
    o.frequency.setValueAtTime(f[0] ?? f, t)
    if (f[1]) o.frequency.exponentialRampToValueAtTime(f[1], t + dur)
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    o.connect(g); g.connect(a.destination)
    o.start(t); o.stop(t + dur + 0.02)
  })
}

export const sounds = {
  pop: () => tone([[520, 820]], { dur: 0.14 }),
  wrong: () => tone([[260, 200]], { dur: 0.18, vol: 0.04 }),
  shoot: () => tone([[700, 1100]], { dur: 0.12, vol: 0.035, type: 'triangle' }),
  win: () => tone([523, 659, 784, 1047], { dur: 0.16, gap: 0.02, vol: 0.06 }),
}
