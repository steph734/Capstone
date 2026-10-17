import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Lightbulb, Star } from 'lucide-react'
import { speakPao, stopPaoVoice } from '../../../utils/paoVoice'
import { pickTip } from './loadingTips'
import { FALLBACK_PAO, loadingPoses } from './paoLoadingPoses'
import './game-loading.css'

const MIN_MS = 1200
const HELLO_MS = 600

const poseFor = (phase, shown, hello) => {
  if (phase === 'slow') return 'slow'
  if (phase === 'ready') return 'ready'
  if (hello) return 'hello'
  if (shown < 30) return 'stretch'
  if (shown < 70) return 'juggle'
  return 'carry'
}

// The one loading screen every game goes through. `assets` comes from useGameAssets.
export default function GameLoadingModal({ game, assets, playerName, speak = true, onStart, onBack }) {
  const Icon = game.icon
  const reduceMotion = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const tip = useMemo(() => pickTip(game.tips), [game])
  const [shown, setShown] = useState(0)
  const [minDone, setMinDone] = useState(false)
  const [hello, setHello] = useState(true)
  const target = useRef(0)
  const startRef = useRef(onStart)
  useEffect(() => { startRef.current = onStart })
  useEffect(() => { target.current = assets.status === 'ready' ? 100 : assets.progress }, [assets.progress, assets.status])

  useEffect(() => {
    const a = setTimeout(() => setHello(false), HELLO_MS)
    const b = setTimeout(() => setMinDone(true), MIN_MS)
    return () => { clearTimeout(a); clearTimeout(b) }
  }, [])

  // Eased progress that only goes up.
  useEffect(() => {
    let raf = 0
    const tick = () => {
      setShown((s) => {
        const goal = Math.min(target.current, minDone || target.current < 100 ? 100 : 99)
        if (s >= goal) return s
        return Math.min(goal, s + Math.max(0.35, (goal - s) * 0.08))
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [minDone])

  const trouble = assets.status === 'slow' || assets.status === 'error'
  const ready = !trouble && assets.status === 'ready' && minDone && shown >= 99.5
  const phase = trouble ? 'slow' : ready ? 'ready' : 'loading'
  const pct = Math.round(shown)
  const pose = poseFor(phase, shown, hello)

  useEffect(() => {
    if (!speak) return undefined
    speakPao('Hi! Let me get your game ready.', { rate: 0.85, pitch: 1.1 })
    return () => stopPaoVoice()
  }, [speak])
  useEffect(() => { if (ready && speak) speakPao("All ready! Let's play!", { rate: 0.85, pitch: 1.1 }) }, [ready, speak])

  useEffect(() => {
    if (!ready || reduceMotion) return undefined
    const t = setTimeout(() => startRef.current?.(), 1500)
    return () => clearTimeout(t)
  }, [ready, reduceMotion])

  useEffect(() => {
    const on = (e) => { if (e.key === 'Escape') onBack?.() }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [onBack])

  const stage = phase === 'ready' ? 'Everything is loaded' : phase === 'slow' ? 'Still loading…' : shown < 30 ? 'Loading pictures…' : shown < 70 ? 'Loading sounds…' : 'Setting up the game…'
  const title = phase === 'ready' ? "All ready! Let's play!" : phase === 'slow' ? 'This is taking a bit longer' : 'Getting your game ready'
  const sub = phase === 'ready' ? `${game.name} is ready${playerName ? ` for ${playerName}` : ''}` : phase === 'slow' ? 'Check the internet, then try again' : `Pao is setting up ${game.name}`
  const g = assets.groups
  const firstOpen = ['pictures', 'sounds', 'pao'].find((k) => !g[k])
  const pill = (key, label) => (
    <span key={key} className={`gl-pill${g[key] ? ' done' : firstOpen === key ? ' active' : ''}`}>
      <i>{g[key] && <Check size={14} strokeWidth={4} aria-hidden="true" />}</i>{label}
    </span>
  )

  return (
    <div className="gl-overlay" role="dialog" aria-modal="true" aria-labelledby="gl-title">
      <div className={`gl-card ${reduceMotion ? 'gl-still' : ''}`}>
        <span className="gl-chip"><i><Icon size={18} aria-hidden="true" /></i>{game.name}</span>

        <div className="gl-pao">
          <div className={`gl-oval pose-${pose}`} />
          <img key={pose} className={`gl-img pose-${pose}`} src={loadingPoses[pose]} alt="Pao" draggable="false"
            onError={(e) => { if (!e.currentTarget.dataset.fb) { e.currentTarget.dataset.fb = '1'; e.currentTarget.src = FALLBACK_PAO } }} />
        </div>

        <h2 id="gl-title" className="gl-title">{title}{phase === 'loading' && <span className="gl-dots" aria-hidden="true"><i /><i /><i /></span>}</h2>
        <p className="gl-sub">{sub}</p>

        {!trouble && (
          <>
            <div className="gl-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Loading the game">
              <div className="gl-fill" style={{ width: `${Math.max(pct, 4)}%` }}><span className="gl-knob"><Star size={20} fill="#ffc83d" color="#f0a500" aria-hidden="true" /></span></div>
            </div>
            <div className="gl-meta"><span>{stage}</span><b>{pct}%</b></div>
          </>
        )}
        {trouble && (
          <>
            <div className="gl-bar slow" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
              <div className="gl-fill" style={{ width: `${Math.max(pct, 4)}%` }}><span className="gl-knob"><Star size={20} fill="#ffc83d" color="#f0a500" aria-hidden="true" /></span></div>
            </div>
            <div className="gl-meta"><span>Still loading…</span><b>{pct}%</b></div>
          </>
        )}

        <div className="gl-pills">{pill('pictures', 'Pictures')}{pill('sounds', 'Sounds')}{pill('pao', 'Pao')}</div>

        {phase === 'loading' && (
          <div className="gl-tip"><Lightbulb size={26} aria-hidden="true" /><div><small>Did you know?</small><p>{tip}</p></div></div>
        )}
        {phase === 'ready' && <button type="button" className="gl-btn primary" onClick={onStart} autoFocus>Let&apos;s go!</button>}
        {phase === 'slow' && (
          <div className="gl-actions">
            <button type="button" className="gl-btn primary" onClick={assets.retry} autoFocus>Try again</button>
            <button type="button" className="gl-btn ghost" onClick={onBack}>Back to games</button>
          </div>
        )}
      </div>
    </div>
  )
}
