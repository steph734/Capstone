// Short, soft sounds made with Web Audio (no audio files to ship).
let ctx
function tone(notes, { dur = 0.13, vol = 0.06, type = 'sine' } = {}) {
  try {
    const C = window.AudioContext || window.webkitAudioContext
    if (!C) return
    ctx = ctx || new C()
    if (ctx.state === 'suspended') ctx.resume()
    notes.forEach((f, i) => {
      const t = ctx.currentTime + i * (dur + 0.02)
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = type
      o.frequency.setValueAtTime(Array.isArray(f) ? f[0] : f, t)
      if (Array.isArray(f)) o.frequency.exponentialRampToValueAtTime(f[1], t + dur)
      g.gain.setValueAtTime(vol, t)
      g.gain.exponentialRampToValueAtTime(0.001, t + dur)
      o.connect(g); g.connect(ctx.destination)
      o.start(t); o.stop(t + dur + 0.02)
    })
  } catch { /* sound is a nice-to-have */ }
}

export const sounds = {
  place: () => tone([[500, 720]], { dur: 0.1, vol: 0.05 }),
  wrong: () => tone([[300, 230]], { dur: 0.2, vol: 0.04 }),
  done: () => tone([523, 659, 784, 1047], { dur: 0.15 }),
}
