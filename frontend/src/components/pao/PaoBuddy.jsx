import { useEffect, useMemo, useRef, useState } from 'react'
import PandaMascot from '../../pages/games/PandaMascot'
import PaoLayered from './PaoLayered'
import {
  POSE_DESCRIPTION, REACTION_CYCLE, REACTION_CYCLE_CALM, CALM_SAFE_POSES,
  FALLBACK_PANDA_STATE, FALLBACK_TALKING_POSES, poseImagePaths, hasPoseArt,
  preloadPaoPoses, PRELOAD_FIRST, POSES, EXPLAIN_POSES, EXPLAIN_ART_POSES,
} from './paoPoses'

const EXPLAIN_SET = new Set(EXPLAIN_POSES)

const SPEECH_LANG = { en: 'en-US', tl: 'fil-PH', ceb: 'fil-PH' }

// A soft, quiet "pop" for a successful tap — never loud, never a buzzer.
function popSound() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(520, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(760, ctx.currentTime + 0.08)
    gain.gain.setValueAtTime(0.05, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
    osc.start()
    osc.stop(ctx.currentTime + 0.16)
    osc.onended = () => ctx.close()
  } catch { /* sound is a nice-to-have, never required */ }
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => setReduced(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return reduced
}

// Pao the panda: idle life (blink + breathing), tap-to-react, a subtle
// head-tilt toward the last touch, and a speech bubble that talks while
// speechSynthesis is speaking. Falls back to the existing illustrated
// <PandaMascot/> for any pose that has no pao-<pose>.svg/png yet, so this
// works today and upgrades automatically once real pose art is added.
export default function PaoBuddy({
  mood = 'idle', size = 220, say = '', interactive = true, outfit = null,
  calmVisuals = false, lang = 'en', readAloud = true, onTap, className = '',
}) {
  const reducedMotion = useReducedMotion()
  const calm = calmVisuals || reducedMotion

  const [reaction, setReaction] = useState(null) // temporary pose from a tap
  const reactingRef = useRef(false)
  const [blinking, setBlinking] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const reactionIdxRef = useRef(-1)
  const [tilt, setTilt] = useState({ x: 0, y: 0, rot: 0 })
  const rootRef = useRef(null)
  const blinkTimerRef = useRef(null)

  // Preload: the first-paint set right away, the rest after first paint.
  useEffect(() => {
    preloadPaoPoses(PRELOAD_FIRST)
    const t = setTimeout(() => preloadPaoPoses([...POSES, ...EXPLAIN_ART_POSES]), 800)
    return () => clearTimeout(t)
  }, [])

  // Idle life: a brief blink every 3-6s, only while truly idle (no reaction,
  // no speech, base mood is idle). Breathing itself is pure CSS (see style).
  useEffect(() => {
    clearTimeout(blinkTimerRef.current)
    if (mood !== 'idle' || reaction || speaking || calm) return
    const schedule = () => {
      blinkTimerRef.current = setTimeout(() => {
        setBlinking(true)
        setTimeout(() => setBlinking(false), 150)
        schedule()
      }, 3000 + Math.random() * 3000)
    }
    schedule()
    return () => clearTimeout(blinkTimerRef.current)
  }, [mood, reaction, speaking, calm])

  // Subtle whole-head tilt toward the last pointer position — disabled under
  // calm visuals / reduced motion, and never more than a few degrees/pixels.
  useEffect(() => {
    if (calm || !interactive) return
    const onMove = (e) => {
      const el = rootRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      const dx = Math.max(-1, Math.min(1, (e.clientX - cx) / (window.innerWidth / 2)))
      const dy = Math.max(-1, Math.min(1, (e.clientY - cy) / (window.innerHeight / 2)))
      setTilt({ x: dx * 6, y: dy * 6, rot: dx * 4 })
    }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [calm, interactive])

  // Speech sync: show `talk` while speechSynthesis plays `say`, then return.
  useEffect(() => {
    if (!say || !readAloud || typeof window === 'undefined' || !('speechSynthesis' in window)) return
    try {
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(say.split(/\s+/).slice(0, 24).join(' '))
      u.rate = 0.85
      u.lang = SPEECH_LANG[lang] || 'en-US'
      u.onstart = () => setSpeaking(true)
      u.onend = () => setSpeaking(false)
      u.onerror = () => setSpeaking(false)
      window.speechSynthesis.speak(u)
    } catch { /* read-aloud is best-effort */ }
    return () => { try { window.speechSynthesis.cancel() } catch { /* ignore */ } }
  }, [say, readAloud, lang])

  const handleTap = () => {
    if (!interactive || reactingRef.current) return // never spammable
    reactingRef.current = true
    const cycle = calm ? REACTION_CYCLE_CALM : REACTION_CYCLE
    reactionIdxRef.current = (reactionIdxRef.current + 1) % cycle.length
    const pose = cycle[reactionIdxRef.current]
    setReaction(pose)
    if (!calm) popSound()
    onTap?.(pose)
    setTimeout(() => { setReaction(null); reactingRef.current = false }, 1400)
  }

  // "Explaining" poses (the Meet Pao intro) have an open-mouth and a -b
  // closed-mouth frame; alternate every ~220ms while that bare pose is the
  // active mood, so Pao looks like he's talking. Calm visuals / reduced
  // motion skip the flicker and just show the smiling -b frame.
  const explainBase = reaction || (speaking ? '' : mood)
  const [explainOpen, setExplainOpen] = useState(true)
  useEffect(() => {
    if (!EXPLAIN_SET.has(explainBase)) return
    if (calm) { setExplainOpen(false); return }
    setExplainOpen(true)
    const id = setInterval(() => setExplainOpen((v) => !v), 220)
    return () => clearInterval(id)
  }, [explainBase, calm])

  const basePose = speaking ? 'talk' : reaction || (blinking ? 'blink' : mood)
  const displayPose = EXPLAIN_SET.has(basePose) ? (explainOpen ? basePose : `${basePose}-b`) : basePose
  const isExplainArt = (p) => EXPLAIN_SET.has(p) || EXPLAIN_SET.has(p?.replace(/-b$/, ''))
  const safePose = calm && !CALM_SAFE_POSES.has(displayPose) && !isExplainArt(displayPose)
    ? (CALM_SAFE_POSES.has(mood) ? mood : 'idle')
    : displayPose
  const art = hasPoseArt(safePose)
  const paths = useMemo(() => poseImagePaths(safePose), [safePose])
  const description = POSE_DESCRIPTION[safePose] || safePose

  // The layered wardrobe (hat/clothes/pants/shoes) only exists drawn for the
  // standing idle pose, so it only replaces the pose art there — any other
  // mood (hooray, dance, ...) still shows that pose's own single-image art.
  const OUTFIT_SAFE_POSES = useMemo(() => new Set(['idle', 'blink', 'hello', 'talk', 'listen', 'point']), [])
  const showOutfitLayers = !!outfit && Object.values(outfit).some(Boolean) && OUTFIT_SAFE_POSES.has(safePose)

  const minTarget = Math.max(size, 96)
  const transform = [
    !calm && reaction ? 'translateY(-12px)' : '',
    !calm ? `translate(${tilt.x}px, ${tilt.y}px) rotate(${tilt.rot}deg)` : '',
  ].filter(Boolean).join(' ')

  return (
    <div
      ref={rootRef}
      className={`relative inline-flex flex-col items-center ${className}`}
      style={{ width: minTarget, minHeight: minTarget }}
    >
      {say && (
        <div
          aria-live="polite"
          className="mb-2 max-w-[260px] rounded-[16px_16px_16px_4px] bg-white px-4 py-2.5 text-center shadow-[0_4px_14px_rgba(0,0,0,.12)]"
          style={{ fontFamily: "'Baloo 2', 'Atkinson Hyperlegible', system-ui, sans-serif", fontSize: 22, fontWeight: 700, color: '#2B2A4C' }}
        >
          {say.split(/\s+/).slice(0, 12).join(' ')}
        </div>
      )}
      <button
        type="button"
        onClick={handleTap}
        disabled={!interactive}
        aria-label={`Pao the panda, ${description}`}
        aria-live="off"
        className="flex items-center justify-center rounded-full focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6]"
        style={{
          width: minTarget, height: minTarget, background: 'transparent', border: 'none',
          cursor: interactive ? 'pointer' : 'default',
          transition: 'transform .25s ease',
          transform,
          animation: calm ? 'none' : 'paoBreathe 4s ease-in-out infinite',
        }}
      >
        <style>{`@keyframes paoBreathe{0%,100%{scale:1}50%{scale:1.03}} .pao-pose-img{transition:opacity .2s ease}`}</style>
        {showOutfitLayers ? (
          <PaoLayered equipped={outfit} size={size} />
        ) : art ? (
          <img
            src={paths.svg}
            onError={(e) => { if (e.currentTarget.src !== paths.png) e.currentTarget.src = paths.png }}
            alt=""
            className="pao-pose-img"
            style={{ width: size, height: size * (760 / 600), objectFit: 'contain' }}
            draggable={false}
          />
        ) : (
          <PandaMascot
            pxWidth={size}
            pandaState={FALLBACK_PANDA_STATE[safePose] || 'normal'}
            mouthOpen={FALLBACK_TALKING_POSES.has(safePose)}
            accessories={outfit || {}}
          />
        )}
      </button>
    </div>
  )
}
