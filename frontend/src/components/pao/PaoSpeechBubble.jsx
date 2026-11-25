import { useEffect, useRef, useState } from 'react'

// Pao's text box: shows the last thing Pao said, one short line at a time.
//   <PaoSpeechBubble text="Hi!" kind="say|locked" lang="en" onSpeak={(speaking) => ...} />
// The full line is always in an aria-live region (announced once per new
// line); the visible text may type in at ~40 characters per second unless the
// user prefers reduced motion. The speaker button reads the visible line.

const CPS = 40
const SPEECH_LANG = { en: 'en-US', tl: 'fil-PH', ceb: 'en-US' }
const COLORS = {
  say: { bg: '#EAF3FF', border: '#BFD4F5', text: '#14306B' },
  locked: { bg: '#FFF9DB', border: '#F1DE86', text: '#6B5400' },
}

function prefersReducedMotion() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}
const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance !== 'undefined'

export default function PaoSpeechBubble({ text, kind = 'say', lang = 'en', onSpeak }) {
  const c = COLORS[kind] || COLORS.say
  const [shown, setShown] = useState(text || '')
  const speakCb = useRef(onSpeak)
  speakCb.current = onSpeak

  // Newest line wins: restart the typewriter, stop any speech.
  useEffect(() => {
    if (canSpeak()) window.speechSynthesis.cancel()
    speakCb.current?.(false)
    if (!text) { setShown(''); return undefined }
    if (prefersReducedMotion()) { setShown(text); return undefined }
    let i = 0
    setShown('')
    const t = setInterval(() => {
      i += 1
      setShown(text.slice(0, i))
      if (i >= text.length) clearInterval(t)
    }, 1000 / CPS)
    return () => clearInterval(t)
  }, [text])

  // Closing the modal stops speech.
  useEffect(() => () => { if (canSpeak()) window.speechSynthesis.cancel() }, [])

  const speak = () => {
    if (!canSpeak() || !text) return
    window.speechSynthesis.cancel()
    const u = new window.SpeechSynthesisUtterance(text)
    u.lang = SPEECH_LANG[lang] || 'en-US'
    u.rate = 0.9
    u.onstart = () => speakCb.current?.(true)
    u.onend = () => speakCb.current?.(false)
    u.onerror = () => speakCb.current?.(false)
    window.speechSynthesis.speak(u)
  }

  if (!text) return null
  return (
    <div style={{ position: 'relative', flex: 'none', margin: '8px 10px 10px', width: 'calc(100% - 20px)', boxSizing: 'border-box', padding: '6px 10px 8px', borderRadius: 16, border: `2px solid ${c.border}`, background: c.bg, color: c.text, boxShadow: '0 4px 10px rgba(20,48,107,.12)', fontFamily: "Inter, 'Segoe UI', system-ui, sans-serif" }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 1, opacity: .75 }}>PAO SAYS</span>
        {canSpeak() && (
          <button type="button" onClick={speak} aria-label="Read Pao's words aloud" title="Read aloud"
            style={{ width: 22, height: 22, borderRadius: '50%', border: `1.5px solid ${c.border}`, background: '#fff', color: c.text, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M11 5 6 9H3v6h3l5 4V5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" />
            </svg>
          </button>
        )}
      </div>
      <div aria-hidden="true" style={{ marginTop: 2, fontWeight: 600, fontSize: 12.5, lineHeight: 1.35, maxHeight: 50, overflow: 'hidden' }}>{shown}</div>
      <div aria-live="polite" role="status" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>{text}</div>
      {/* tail pointing down to Pao */}
      <span aria-hidden="true" style={{ position: 'absolute', left: '50%', bottom: -8, width: 12, height: 12, background: c.bg, borderRight: `2px solid ${c.border}`, borderBottom: `2px solid ${c.border}`, transform: 'translateX(-50%) rotate(45deg)' }} />
    </div>
  )
}
