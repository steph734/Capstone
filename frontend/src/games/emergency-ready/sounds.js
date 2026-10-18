// Soft, gentle sounds made with Web Audio. Quiet by design: no buzzers, no alarms.
let ctx
function tone(notes, { dur = 0.22, vol = 0.035 } = {}) {
  try {
    const C = window.AudioContext || window.webkitAudioContext
    if (!C) return
    ctx = ctx || new C()
    if (ctx.state === 'suspended') ctx.resume()
    notes.forEach((f, i) => {
      const t = ctx.currentTime + i * (dur + 0.04)
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'sine'
      o.frequency.setValueAtTime(f, t)
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(vol, t + 0.03)
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
      o.connect(g); g.connect(ctx.destination)
      o.start(t); o.stop(t + dur + 0.02)
    })
  } catch { /* sound is a nice-to-have */ }
}

export const sounds = {
  chime: () => tone([660]),
  pack: () => tone([520, 700], { dur: 0.14 }),
  done: () => tone([523, 659, 784], { dur: 0.25 }),
}
