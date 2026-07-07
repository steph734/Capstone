import { useNavigate } from 'react-router-dom'
import { useEffect, useState, useRef } from 'react'
import PictureWordGame from './games/PictureWordGame'
import PaoCustomizePage from './games/PaoCustomizePage'

// ─── Intro stages ──────────────────────────────────────────────────────────────

const INTRO_STAGES = [
  {
    key: 'hello', icon: '👋', label: 'Meet Pao!',
    script: `Hehe! Teehee! Oh wow, hello there, my brand new friend! I am Pao, your very own panda buddy! Yay! Welcome to Gamified Activities, the most super duper fun place in the whole wide world! I am so so excited to learn and play with you!`,
  },
  {
    key: 'mechanics', icon: '🎮', label: 'How to Play',
    script: `Here is how it works! You can play six super fun learning games right here! Each game helps you speak and learn better every single day! Finish games to earn experience points! The more you play, the stronger and smarter your character becomes!`,
  },
  {
    key: 'levels', icon: '⬆️', label: 'Level Up & Stats',
    script: `As you play games, your character will LEVEL UP! Whoosh! And every time you level up, your special stats get stronger! You have Intelligence for smart thinking, Focus for paying attention, Resistance for never giving up, Creativity for big ideas, Speed for quick answers, and Memory for remembering things! Some games need a higher level to unlock, so keep playing!`,
  },
  {
    key: 'badges', icon: '🏆', label: 'Badges & Customize',
    script: `And here is the most exciting part! When you finish games, you will earn special BADGES! Yay! You can use those badges to dress me up with brand new shoes, cool clothes, awesome pants, and fun hairstyles! Heehee! I cannot wait to see what you choose for me! Let us go!`,
  },
]

const PAO_GAMES_SCRIPT = `Hehe! Ta da! Look at all these amazing games! All just for you! The Picture Word Matching game is unlocked and ready! Click it to start! I know you are going to be amazing!`

const PAO_CLICK_SCRIPTS = [
  { pitch: 1.7,  text: `Hehe! Heehee! That was fun! Teehee! Hehe!` },
  { pitch: 1.68, text: `Yay! You found me! I am so happy you are here with me today!` },
  { pitch: 1.65, text: `Oh, hi there! You are doing such a great job!` },
  { pitch: 1.72, text: `Teehee! I like it when you visit me! Let us keep playing!` },
  { pitch: 1.66, text: `Hello hello! High five! We are best friends, you and me!` },
  { pitch: 1.7,  text: `Hehe! I am here with you! You can do it!` },
]

// ─── Game list ────────────────────────────────────────────────────────────────

const GAMES = [
  { id: 'picture-word', title: 'Picture-Word Matching', emoji: '🖼️', desc: 'Match a picture to the right word!', color: '#f59e0b', requiredLevel: 1  },
  { id: 'sound-hunt',   title: 'Sound Hunt',            emoji: '🔍', desc: 'Find words with the same sound!',   color: '#10b981', requiredLevel: 3  },
  { id: 'sentence',     title: 'Sentence Builder',      emoji: '🧩', desc: 'Build sentences like a wizard!',    color: '#6366f1', requiredLevel: 5  },
  { id: 'rhyme',        title: 'Rhyme Time',            emoji: '🎵', desc: 'Find words that rhyme!',            color: '#ec4899', requiredLevel: 7  },
  { id: 'story',        title: 'Story Builder',         emoji: '📖', desc: 'Create your own short story!',      color: '#8b5cf6', requiredLevel: 10 },
  { id: 'alphabet',     title: 'Alphabet Blast',        emoji: '🚀', desc: 'Zoom through the alphabet!',        color: '#ef4444', requiredLevel: 12 },
]

const STATS = [
  { key: 'intelligence', label: 'Intelligence', icon: '📚', value: 15, color: '#6366f1' },
  { key: 'focus',        label: 'Focus',        icon: '🎯', value: 10, color: '#f59e0b' },
  { key: 'resistance',   label: 'Resistance',   icon: '🛡️', value: 8,  color: '#10b981' },
  { key: 'creativity',   label: 'Creativity',   icon: '🎨', value: 12, color: '#ec4899' },
  { key: 'speed',        label: 'Speed',        icon: '💨', value: 6,  color: '#06b6d4' },
  { key: 'memory',       label: 'Memory',       icon: '🧠', value: 9,  color: '#8b5cf6' },
]

const STARS = [
  { x:'6%',  y:'10%', size:22, delay:0,   dur:2.8 },
  { x:'88%', y:'7%',  size:16, delay:0.6, dur:3.2 },
  { x:'4%',  y:'68%', size:14, delay:1.1, dur:2.6 },
  { x:'91%', y:'62%', size:20, delay:0.3, dur:3.5 },
  { x:'22%', y:'4%',  size:12, delay:1.5, dur:2.4 },
  { x:'76%', y:'78%', size:18, delay:0.8, dur:3.0 },
  { x:'50%', y:'90%', size:11, delay:1.9, dur:2.9 },
  { x:'81%', y:'28%', size:13, delay:0.4, dur:3.3 },
  { x:'14%', y:'40%', size:17, delay:1.2, dur:2.7 },
]

function Star({ x, y, size, delay, dur }) {
  return (
    <div style={{ position:'absolute', left:x, top:y, width:size, height:size, animation:`gfStarFloat ${dur}s ease-in-out ${delay}s infinite`, pointerEvents:'none' }}>
      <svg viewBox="0 0 20 20" width={size} height={size}>
        <polygon points="10,1 12.9,7 19.5,7.6 14.5,12 16.2,18.5 10,15 3.8,18.5 5.5,12 0.5,7.6 7.1,7" fill="rgba(255,255,255,0.5)"/>
      </svg>
    </div>
  )
}

// ─── Category modal ───────────────────────────────────────────────────────────

const CATEGORIES = [
  { id:'fruits',     label:'Fruits',     emoji:'🍎', color:'#ef4444', desc:'10 yummy fruits!' },
  { id:'vegetables', label:'Vegetables', emoji:'🥕', color:'#22c55e', desc:'10 healthy veggies!' },
  { id:'animals',    label:'Animals',    emoji:'🐾', color:'#f59e0b', desc:'10 fun animals!' },
  { id:'things',     label:'Things',     emoji:'🎒', color:'#6366f1', desc:'10 everyday things!' },
]

function CategoryModal({ onSelect, onClose }) {
  useEffect(() => {
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utt = new SpeechSynthesisUtterance(`Which category would you like to practice today? Pick one and let us go!`)
    utt.rate = 1.1; utt.pitch = 1.62; utt.volume = 1
    const go = () => {
      const v = window.speechSynthesis.getVoices()
      const voice = v.find(x => /zira/i.test(x.name)) || v.find(x => /samantha/i.test(x.name)) || v.find(x => x.lang === 'en-US') || v[0]
      if (voice) utt.voice = voice
      window.speechSynthesis.speak(utt)
    }
    if (window.speechSynthesis.getVoices().length > 0) go()
    else window.speechSynthesis.onvoiceschanged = go
    return () => window.speechSynthesis.cancel()
  }, [])

  return (
    <div style={{ position:'fixed', inset:0, zIndex:10000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(8px)', background:'rgba(0,0,0,0.6)' }}>
      <style>{`@keyframes gfModalIn{from{opacity:0;transform:scale(.88) translateY(18px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
      <div style={{ background:'linear-gradient(145deg,#1e1040,#120d28)', border:'1.5px solid rgba(255,255,255,.15)', borderRadius:28, padding:'32px 28px', width:400, maxWidth:'92vw', animation:'gfModalIn .45s cubic-bezier(.34,1.56,.64,1)', boxShadow:'0 24px 64px rgba(0,0,0,.6)' }}>
        <h2 style={{ color:'#fff', fontFamily:"'Segoe UI',system-ui,sans-serif", fontSize:22, fontWeight:800, margin:'0 0 6px', textAlign:'center' }}>Choose a Category! 🎯</h2>
        <p style={{ color:'rgba(255,255,255,.5)', fontFamily:"'Segoe UI',system-ui,sans-serif", fontSize:13, margin:'0 0 20px', textAlign:'center' }}>Pick what you want to practice today</p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          {CATEGORIES.map(cat => (
            <button key={cat.id} onClick={() => onSelect(cat.id)} style={{ background:`${cat.color}18`, border:`2px solid ${cat.color}55`, borderRadius:16, padding:'18px 10px', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:7, transition:'all .2s', color:'#fff', fontFamily:"'Segoe UI',system-ui,sans-serif" }}
              onMouseEnter={e => { e.currentTarget.style.background=`${cat.color}30`; e.currentTarget.style.transform='scale(1.04)' }}
              onMouseLeave={e => { e.currentTarget.style.background=`${cat.color}18`; e.currentTarget.style.transform='scale(1)' }}
            >
              <span style={{ fontSize:36 }}>{cat.emoji}</span>
              <span style={{ fontWeight:800, fontSize:15 }}>{cat.label}</span>
              <span style={{ fontSize:11, opacity:.55 }}>{cat.desc}</span>
            </button>
          ))}
        </div>
        <button onClick={onClose} style={{ marginTop:16, width:'100%', background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.1)', color:'rgba(255,255,255,.5)', borderRadius:12, padding:'10px', cursor:'pointer', fontFamily:"'Segoe UI',system-ui,sans-serif", fontSize:13, fontWeight:600 }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── Pao helper (layered PNG rig, gentle & interactive) ───────────────────────
// A calm, predictable companion for kids with Down syndrome, assembled from
// separate part images (arms/body/feet + three full-head expressions) so each
// part can move independently — always soft and slow, never fast or flashing.

const PAO_REACTIONS = ['pao-r-wave', 'pao-r-bounce', 'pao-r-wiggle', 'pao-r-nod', 'pao-r-clap']

function PaoHelper({ size = 220, talking = false, onClick, extraClassName = '' }) {
  const [reaction, setReaction] = useState('')
  const [blinking, setBlinking] = useState(false)
  const [bobPulse, setBobPulse] = useState(false)
  const [gestureArm, setGestureArm] = useState('')
  const [mouthFrame, setMouthFrame] = useState('closed')
  const reactionTimer = useRef(null)
  const blinkTimer = useRef(null)
  const bobTimer = useRef(null)
  const gestureTimer = useRef(null)
  const mouthTimer = useRef(null)
  const gestureSideRef = useRef('l')
  const reduceMotionRef = useRef(false)

  useEffect(() => {
    reduceMotionRef.current = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  }, [])

  // Gentle, randomly-spaced blink — subtle, never sudden
  useEffect(() => {
    let cancelled = false
    const schedule = () => {
      blinkTimer.current = setTimeout(() => {
        if (cancelled) return
        setBlinking(true)
        setTimeout(() => { if (!cancelled) setBlinking(false) }, 220)
        schedule()
      }, 3800 + Math.random() * 2600)
    }
    schedule()
    return () => { cancelled = true; clearTimeout(blinkTimer.current) }
  }, [])

  // Irregular head bob/tilt while talking — randomized gaps, never a metronome
  useEffect(() => {
    if (!talking || reduceMotionRef.current) { setBobPulse(false); return }
    let cancelled = false
    const schedule = () => {
      bobTimer.current = setTimeout(() => {
        if (cancelled) return
        setBobPulse(true)
        setTimeout(() => { if (!cancelled) setBobPulse(false) }, 500)
        schedule()
      }, 600 + Math.random() * 450)
    }
    schedule()
    return () => { cancelled = true; clearTimeout(bobTimer.current); setBobPulse(false) }
  }, [talking])

  // Gentle gesture pulses while talking — one arm at a time, alternating sides
  useEffect(() => {
    if (!talking || reduceMotionRef.current) { setGestureArm(''); return }
    let cancelled = false
    const schedule = () => {
      gestureTimer.current = setTimeout(() => {
        if (cancelled) return
        gestureSideRef.current = gestureSideRef.current === 'l' ? 'r' : 'l'
        setGestureArm(gestureSideRef.current)
        setTimeout(() => { if (!cancelled) setGestureArm('') }, 600)
        schedule()
      }, 900 + Math.random() * 700)
    }
    schedule()
    return () => { cancelled = true; clearTimeout(gestureTimer.current); setGestureArm('') }
  }, [talking])

  // Mouth while talking: closed ↔ open, each frame held 240–380 ms (randomized)
  // — unhurried and irregular, so it never reads as a mechanical flutter
  useEffect(() => {
    if (!talking || reduceMotionRef.current) { setMouthFrame('closed'); return }
    let cancelled = false
    const swap = (frame) => {
      mouthTimer.current = setTimeout(() => {
        if (cancelled) return
        setMouthFrame(frame)
        swap(frame === 'open' ? 'closed' : 'open')
      }, 240 + Math.random() * 140)
    }
    swap('open')
    return () => { cancelled = true; clearTimeout(mouthTimer.current) }
  }, [talking])

  useEffect(() => () => clearTimeout(reactionTimer.current), [])

  const activate = () => {
    const pick = PAO_REACTIONS[Math.floor(Math.random() * PAO_REACTIONS.length)]
    setReaction(pick)
    clearTimeout(reactionTimer.current)
    reactionTimer.current = setTimeout(() => setReaction(''), 1400)
    onClick?.()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      activate()
    }
  }

  // Which head expression shows: smile when idle; alternating while talking.
  // Under reduced motion, a static open mouth still communicates "talking".
  const headFrame = talking ? (reduceMotionRef.current ? 'open' : mouthFrame) : 'smile'

  return (
    <div
      className={`pao-helper ${extraClassName}`}
      style={{ width: size, height: size }}
      onClick={activate}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label="Friendly panda helper"
    >
      <div className={`pao-rig ${talking ? 'pao-talking' : ''} ${reaction}`}>
        {/* Arm files are named from Pao's own perspective, so his right arm
            renders on the SCREEN-LEFT side (paw flares outward) and vice versa */}
        <img src="/pao-right-arm.png" alt="" className={`pao-part pao-arm-l ${gestureArm === 'l' ? 'pao-arm-gesture' : ''}`} draggable={false} />
        <img src="/pao-left-arm.png" alt="" className={`pao-part pao-arm-r ${gestureArm === 'r' ? 'pao-arm-gesture' : ''}`} draggable={false} />
        <img src="/pao-body.png" alt="" className="pao-part pao-body" draggable={false} />
        <img src="/pao-left-foot.png" alt="" className="pao-part pao-foot-l" draggable={false} />
        <img src="/pao-right-foot.png" alt="" className="pao-part pao-foot-r" draggable={false} />
        <div className={`pao-head ${bobPulse ? 'pao-head-bob' : ''} ${blinking ? 'pao-blinking' : ''}`}>
          <img src="/pao-mouth-smile.png" alt="" className={`pao-head-img ${headFrame === 'smile' ? 'pao-visible' : ''}`} draggable={false} />
          <img src="/pao-mouth-closed.png" alt="" className={`pao-head-img ${headFrame === 'closed' ? 'pao-visible' : ''}`} draggable={false} />
          <img src="/pao-mouth-open.png" alt="" className={`pao-head-img ${headFrame === 'open' ? 'pao-visible' : ''}`} draggable={false} />
          <div className="pao-blink-lid pao-blink-lid-l" />
          <div className="pao-blink-lid pao-blink-lid-r" />
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function GamifiedFullPage({ backPath = '/dashboard' }) {
  const navigate = useNavigate()

  const [phase,        setPhase]        = useState('intro')
  const [introStage,   setIntroStage]   = useState(0)
  const [entered,      setEntered]      = useState(false)
  const [showUI,       setShowUI]       = useState(false)
  const [talking,      setTalking]      = useState(false)
  const [displayText,  setDisplayText]  = useState('')
  const [gamesIn,      setGamesIn]      = useState(false)
  const [showCatModal, setShowCatModal] = useState(false)
  const [selCategory,  setSelCategory]  = useState('fruits')
  const [showStats,    setShowStats]    = useState(false)

  // Placeholder character (would come from backend)
  const character = { level: 1, xp: 0, xpNeeded: 100 }

  const advTimer = useRef(null)
  const stageRef = useRef(0)

  // ── Cleanup ──────────────────────────────────────────────────────────────────
  useEffect(() => () => {
    window.speechSynthesis?.cancel()
  }, [])

  // ── TTS helper ───────────────────────────────────────────────────────────────
  const speakScript = (script, pitchOverride, onDone) => {
    if (!window.speechSynthesis) { if (onDone) setTimeout(onDone, 100); return }
    window.speechSynthesis.cancel()
    const utt = new SpeechSynthesisUtterance(script)
    utt.rate = 1.12; utt.pitch = pitchOverride ?? 1.62; utt.volume = 1
    utt.onstart = () => setTalking(true)
    utt.onend   = () => { setTalking(false); if (onDone) onDone() }
    utt.onerror = () => { setTalking(false); if (onDone) onDone() }
    utt.onboundary = (e) => { if (e.name === 'word') setDisplayText(script.substring(0, e.charIndex + e.charLength)) }
    const go = () => {
      const v = window.speechSynthesis.getVoices()
      const voice = v.find(x => /zira/i.test(x.name)) || v.find(x => /samantha/i.test(x.name)) || v.find(x => x.lang === 'en-US') || v.find(x => x.lang.startsWith('en')) || v[0]
      if (voice) utt.voice = voice
      window.speechSynthesis.speak(utt)
    }
    if (window.speechSynthesis.getVoices().length > 0) go()
    else window.speechSynthesis.onvoiceschanged = go
  }

  // ── Intro stage speech — plays speech only, does NOT auto-advance ────────────
  const speakStage = (idx) => {
    setDisplayText('')
    speakScript(INTRO_STAGES[idx].script, 1.62)
  }

  // ── Go to customize (after intro) ────────────────────────────────────────────
  const goToCustomize = () => {
    window.speechSynthesis?.cancel()
    setDisplayText('')
    setTalking(false)
    setPhase('customize')
  }

  // ── Go to games (after customize or returning from game) ──────────────────────
  const goToGames = () => {
    window.speechSynthesis?.cancel()
    setDisplayText('')
    setTalking(false)
    setPhase('games')
    setTimeout(() => setGamesIn(true), 80)
    setTimeout(() => speakScript(PAO_GAMES_SCRIPT), 500)
  }

  // ── Skip / Next buttons ───────────────────────────────────────────────────────
  const handleSkip = () => {
    window.speechSynthesis?.cancel()
    setTalking(false)
    goToCustomize()
  }

  const handleNextStage = () => {
    window.speechSynthesis?.cancel()
    setTalking(false)
    if (stageRef.current < INTRO_STAGES.length - 1) {
      const next = stageRef.current + 1
      stageRef.current = next
      setIntroStage(next)
      speakStage(next)
    } else {
      goToCustomize()
    }
  }

  // ── Intro enter ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const t1 = setTimeout(() => setEntered(true), 100)
    const t2 = setTimeout(() => { setShowUI(true); speakStage(0) }, 800)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, []) // eslint-disable-line

  // ── Pao click → gentle reaction + friendly line ──────────────────────────────
  const clickCountRef = useRef(0)
  const handlePandaClick = () => {
    const pick = PAO_CLICK_SCRIPTS[clickCountRef.current % PAO_CLICK_SCRIPTS.length]
    clickCountRef.current += 1
    speakScript(pick.text, pick.pitch)
  }

  // ── Category + game start ─────────────────────────────────────────────────────
  const handleCatSelect = (catId) => {
    setSelCategory(catId)
    setShowCatModal(false)
    window.speechSynthesis?.cancel()
    setPhase('picture-word')
  }

  if (phase === 'customize') {
    return <PaoCustomizePage onDone={() => {
      setDisplayText(''); setTalking(false)
      setPhase('games')
      setTimeout(() => setGamesIn(true), 60)
      setTimeout(() => speakScript('Hehe! Let us play some games now!'), 400)
    }}/>
  }

  if (phase === 'picture-word') {
    return <PictureWordGame category={selCategory} onExit={() => {
      setPhase('games'); setGamesIn(true); setDisplayText('')
      setTimeout(() => speakScript(PAO_GAMES_SCRIPT), 400)
    }}/>
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:9999, background:'radial-gradient(ellipse at 50% 35%,#1a1430 0%,#0a0a0f 100%)', overflow:'hidden', fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
      <style>{`
        @keyframes gfStarFloat { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-8px) scale(1.08)} }
        @keyframes pandaEnter  { 0%{opacity:0;transform:scale(.3) rotate(-15deg)} 60%{transform:scale(1.08) rotate(3deg)} 80%{transform:scale(.97) rotate(-1deg)} 100%{opacity:1;transform:scale(1) rotate(0)} }
        @keyframes gfCardIn    { from{opacity:0;transform:translateY(20px) scale(.93)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes gfPulse     { 0%,100%{box-shadow:0 0 0 0 rgba(245,158,11,.5)} 50%{box-shadow:0 0 0 8px rgba(245,158,11,0)} }
        @keyframes gfBubbleIn  { from{opacity:0;transform:scale(.88) translateY(6px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes gfCursor    { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes gfSoundWave { 0%,100%{transform:scaleY(.3)} 50%{transform:scaleY(1)} }
        @keyframes gfFadeIn    { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes gfStageIn   { from{opacity:0;transform:scale(.88) translateY(-6px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes gfLevelPop  { 0%{transform:scale(1)} 50%{transform:scale(1.15)} 100%{transform:scale(1)} }

        /* ── Pao helper: layered part rig — soft, slow, predictable ──
           Placement knobs: each part's width/left/top below. Nudge those
           percentages if a seam shows (head↓neck band, arms↔shoulders,
           feet↔lower legs). All motion is intentionally slow and small. */
        @keyframes paoBodyBreath { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.015); } }
        /* Arms carry a 35deg raised base pose; every arm keyframe oscillates
           around that base because a running animation replaces the transform */
        @keyframes paoArmSwayL     { 0%, 100% { transform: rotate(35deg); } 50% { transform: rotate(37.5deg); } }
        @keyframes paoArmSwayR     { 0%, 100% { transform: rotate(-35deg); } 50% { transform: rotate(-37.5deg); } }
        @keyframes paoArmSwayLTalk { 0%, 100% { transform: rotate(35deg); } 50% { transform: rotate(40deg); } }
        @keyframes paoArmSwayRTalk { 0%, 100% { transform: rotate(-35deg); } 50% { transform: rotate(-40deg); } }
        @keyframes paoArmGestureL  { 0%, 100% { transform: rotate(35deg); } 40% { transform: rotate(31deg); } }
        @keyframes paoArmGestureR  { 0%, 100% { transform: rotate(-35deg); } 40% { transform: rotate(-31deg); } }
        @keyframes paoFootIdle     { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(0.8deg); } }
        @keyframes paoHeadBob {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          40%      { transform: translateY(-2px) rotate(-2deg); }
          75%      { transform: translateY(0) rotate(1.2deg); }
        }
        @keyframes pandaBlink {
          0%, 100% { opacity: 0; transform: scaleY(0); }
          50%      { opacity: 1; transform: scaleY(1); }
        }
        @keyframes paoWave {
          0%, 100% { transform: rotate(-35deg); }
          30% { transform: rotate(-55deg); }
          55% { transform: rotate(-47deg); }
          75% { transform: rotate(-54deg); }
        }
        @keyframes paoClapL { 0%, 100% { transform: rotate(35deg); } 40% { transform: rotate(21deg); } 65% { transform: rotate(25deg); } }
        @keyframes paoClapR { 0%, 100% { transform: rotate(-35deg); } 40% { transform: rotate(-21deg); } 65% { transform: rotate(-25deg); } }
        @keyframes paoBounceRig {
          0%, 100% { transform: translateY(0); }
          35% { transform: translateY(-6px); }
          70% { transform: translateY(0); }
          85% { transform: translateY(-2px); }
        }
        @keyframes paoWiggleRig {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-3deg); }
          55% { transform: rotate(3deg); }
          80% { transform: rotate(-1.5deg); }
        }
        @keyframes paoNodHead {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          35% { transform: translateY(2px) rotate(3deg); }
          65% { transform: translateY(0) rotate(-1.5deg); }
        }

        .pao-helper {
          position: relative;
          display: inline-block;
          cursor: pointer;
          outline: none;
          border-radius: 28px;
        }
        .pao-helper:focus-visible {
          box-shadow: 0 0 0 4px rgba(176,132,255,.55);
        }
        .pao-rig {
          position: relative;
          width: 100%;
          height: 100%;
          filter: drop-shadow(0 10px 22px rgba(0,0,0,.45));
        }
        .pao-part {
          position: absolute;
          user-select: none;
          -webkit-user-drag: none;
        }
        .pao-arm-l  { width: 40%; left: 22%; top: 33%; transform: rotate(35deg);  transform-origin: 55% 16%; z-index: 1; animation: paoArmSwayL 4.2s ease-in-out infinite; }
        .pao-arm-r  { width: 40%; left: 38%; top: 33%; transform: rotate(-35deg); transform-origin: 45% 16%; z-index: 1; animation: paoArmSwayR 4.2s ease-in-out 2.1s infinite; }
        .pao-body   { width: 54%; left: 23%; top: 40%; z-index: 2; transform-origin: 50% 100%; animation: paoBodyBreath 3.8s ease-in-out infinite; }
        .pao-foot-l { width: 36%; left: 16%;  bottom: -3%; z-index: 3; animation: paoFootIdle 5.5s ease-in-out infinite; }
        .pao-foot-r { width: 36%; right: 16%; bottom: -3%; z-index: 3; animation: paoFootIdle 5.5s ease-in-out 2.7s infinite; }
        .pao-head {
          position: absolute;
          width: 68%;
          left: 16%;
          top: 0;
          aspect-ratio: 1 / 1;
          z-index: 4;
          transform-origin: 50% 85%;
        }
        .pao-head.pao-head-bob { animation: paoHeadBob 0.5s ease-out; }
        .pao-head-img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          opacity: 0;
          user-select: none;
          -webkit-user-drag: none;
        }
        .pao-head-img.pao-visible { opacity: 1; }
        .pao-blink-lid {
          position: absolute;
          width: 22%;
          height: 18%;
          border-radius: 50%;
          background: #1b1a1e;
          opacity: 0;
          pointer-events: none;
        }
        .pao-blink-lid-l { left: 23%;  top: 42%; }
        .pao-blink-lid-r { right: 23%; top: 42%; }
        .pao-head.pao-blinking .pao-blink-lid { animation: pandaBlink 0.22s ease-in-out; }

        /* Livelier (not faster) arm sway while talking */
        .pao-rig.pao-talking .pao-arm-l { animation: paoArmSwayLTalk 4.2s ease-in-out infinite; }
        .pao-rig.pao-talking .pao-arm-r { animation: paoArmSwayRTalk 4.2s ease-in-out 2.1s infinite; }
        /* One-arm gesture pulse — declared after the talking rules so it wins while active */
        .pao-rig .pao-arm-l.pao-arm-gesture { animation: paoArmGestureL 0.6s ease-out; }
        .pao-rig .pao-arm-r.pao-arm-gesture { animation: paoArmGestureR 0.6s ease-out; }
        /* Click reactions — declared last so they win over sway/gesture */
        .pao-rig.pao-r-bounce { animation: paoBounceRig 1.2s ease-out; }
        .pao-rig.pao-r-wiggle { animation: paoWiggleRig 1.3s ease-in-out; }
        .pao-rig.pao-r-wave .pao-arm-r { animation: paoWave 1.2s ease-in-out; }
        .pao-rig.pao-r-nod .pao-head   { animation: paoNodHead 1.2s ease-in-out; }
        .pao-rig.pao-r-clap .pao-arm-l { animation: paoClapL 1.3s ease-in-out; }
        .pao-rig.pao-r-clap .pao-arm-r { animation: paoClapR 1.3s ease-in-out; }

        @media (max-width: 480px) {
          .pao-helper-intro { width: 190px !important; height: 190px !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .pao-rig, .pao-rig * {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>

      {STARS.map((s,i) => <Star key={i} {...s}/>)}

      <button onClick={() => { window.speechSynthesis?.cancel(); navigate(backPath) }} style={{ position:'absolute', top:18, left:20, zIndex:10, background:'rgba(255,255,255,.08)', border:'1.5px solid rgba(255,255,255,.18)', color:'#fff', borderRadius:10, padding:'8px 18px', fontSize:13, fontWeight:700, cursor:'pointer' }}>
        ← Back
      </button>

      {/* ══════════════ INTRO PHASE ══════════════ */}
      {phase === 'intro' && (
        <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, padding:'70px 24px 24px' }}>

          {/* Stage progress + dots (top-right) */}
          {showUI && (
            <div style={{ position:'absolute', top:20, right:24, display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:12, color:'rgba(255,255,255,.35)', fontWeight:600 }}>Intro</span>
              {INTRO_STAGES.map((_,i) => (
                <div key={i} style={{ width:9, height:9, borderRadius:'50%', background: i <= introStage ? '#b084ff' : 'rgba(255,255,255,.18)', transition:'background .35s', boxShadow: i === introStage ? '0 0 8px #b084ff' : 'none' }}/>
              ))}
            </div>
          )}

          {/* Stage label */}
          {showUI && (
            <div key={`label-${introStage}`} style={{ background:'rgba(176,132,255,.14)', border:'1px solid rgba(176,132,255,.3)', borderRadius:20, padding:'5px 16px', fontSize:13, fontWeight:700, color:'#c9a8ff', animation:'gfStageIn .35s ease', letterSpacing:.5 }}>
              {INTRO_STAGES[introStage].icon} {INTRO_STAGES[introStage].label}
            </div>
          )}

          {/* Pao mascot */}
          <div style={{ animation: entered ? 'pandaEnter .9s cubic-bezier(.34,1.56,.64,1) both' : 'none', flexShrink:0 }}>
            <PaoHelper size={250} talking={talking} onClick={handlePandaClick} extraClassName="pao-helper-intro"/>
          </div>

          {/* Speech bubble */}
          {showUI && (
            <div style={{ animation:'gfBubbleIn .5s cubic-bezier(.34,1.56,.64,1)', background:'rgba(255,255,255,.07)', backdropFilter:'blur(12px)', border:'1.5px solid rgba(255,255,255,.16)', borderRadius:24, padding:'16px 26px', maxWidth:560, width:'100%', minHeight:60, boxShadow:'0 8px 32px rgba(0,0,0,.3)' }}>
              {talking && (
                <div style={{ display:'flex', gap:3, alignItems:'center', marginBottom:8 }}>
                  {[0,.12,.06,.18,.03].map((d,i) => (
                    <div key={i} style={{ width:3, height:15, borderRadius:4, background:'rgba(168,130,255,.9)', animation:`gfSoundWave .5s ease-in-out ${d}s infinite` }}/>
                  ))}
                </div>
              )}
              <div style={{ fontSize:15, fontWeight:600, color:'rgba(255,255,255,.92)', lineHeight:1.65 }}>
                {displayText || <span style={{ color:'rgba(255,255,255,.3)', fontStyle:'italic', fontSize:14 }}>Pao is ready!</span>}
                {talking && <span style={{ animation:'gfCursor .7s step-end infinite', marginLeft:2, color:'#b084ff' }}>|</span>}
              </div>
            </div>
          )}

          {/* Next / Skip buttons */}
          {showUI && (
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={handleNextStage} style={{ background:'rgba(176,132,255,.22)', border:'1.5px solid rgba(176,132,255,.45)', color:'#d4b4ff', borderRadius:14, padding:'10px 26px', fontSize:14, fontWeight:700, cursor:'pointer', transition:'background .2s' }}
                onMouseEnter={e => e.currentTarget.style.background='rgba(176,132,255,.35)'}
                onMouseLeave={e => e.currentTarget.style.background='rgba(176,132,255,.22)'}>
                {introStage < INTRO_STAGES.length - 1 ? 'Next →' : "Let's Go! 🎮"}
              </button>
              <button onClick={handleSkip} style={{ background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.1)', color:'rgba(255,255,255,.4)', borderRadius:14, padding:'10px 20px', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                Skip Intro
              </button>
            </div>
          )}
        </div>
      )}

      {/* ══════════════ GAMES PHASE ══════════════ */}
      {phase === 'games' && (
        <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', overflow:'hidden' }}>

          {/* Customize button — top right */}
          <button onClick={() => { window.speechSynthesis?.cancel(); setPhase('customize') }} style={{ position:'absolute', top:18, right:20, zIndex:10, display:'flex', alignItems:'center', gap:7, background:'rgba(176,132,255,.15)', border:'1.5px solid rgba(176,132,255,.35)', color:'#d4b4ff', borderRadius:12, padding:'8px 16px', fontSize:13, fontWeight:700, cursor:'pointer', transition:'all .2s' }}
            onMouseEnter={e => { e.currentTarget.style.background='rgba(176,132,255,.28)'; e.currentTarget.style.borderColor='rgba(176,132,255,.6)' }}
            onMouseLeave={e => { e.currentTarget.style.background='rgba(176,132,255,.15)'; e.currentTarget.style.borderColor='rgba(176,132,255,.35)' }}>
            ✨ Customize Pao
          </button>

          {/* Pao + speech bubble row */}
          <div style={{ display:'flex', alignItems:'flex-end', gap:16, padding:'14px 24px 0', flexShrink:0 }}>
            <div style={{ flexShrink:0 }}>
              <PaoHelper size={150} talking={talking} onClick={handlePandaClick}/>
            </div>
            <div style={{ flex:1, alignSelf:'center', display:'flex', flexDirection:'column', gap:6 }}>
              {/* Level badge + stats toggle */}
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(255,215,0,.12)', border:'1px solid rgba(255,215,0,.3)', borderRadius:20, padding:'4px 12px 4px 8px' }}>
                  <span style={{ fontSize:14 }}>⭐</span>
                  <span style={{ fontSize:11, fontWeight:700, color:'rgba(255,215,0,.7)', letterSpacing:.8 }}>LVL</span>
                  <span style={{ fontSize:20, fontWeight:900, color:'#ffd700', lineHeight:1, textShadow:'0 0 10px rgba(255,215,0,.5)' }}>{character.level}</span>
                </div>
                {/* XP mini bar */}
                <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                  <span style={{ fontSize:9, color:'rgba(255,255,255,.35)', fontWeight:600 }}>XP {character.xp}/{character.xpNeeded}</span>
                  <div style={{ width:72, height:4, background:'rgba(255,255,255,.08)', borderRadius:3, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${(character.xp/character.xpNeeded)*100}%`, background:'linear-gradient(90deg,#6366f1,#b084ff)', borderRadius:3 }}/>
                  </div>
                </div>
                {/* Stats toggle icon */}
                <button onClick={() => setShowStats(s => !s)} title="View Stats" style={{ background: showStats ? 'rgba(176,132,255,.25)' : 'rgba(255,255,255,.07)', border:`1.5px solid ${showStats ? 'rgba(176,132,255,.5)' : 'rgba(255,255,255,.12)'}`, borderRadius:10, width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:16, transition:'all .2s', flexShrink:0 }}>
                  📊
                </button>
              </div>

              {/* Speech bubble */}
              <div style={{ background:'rgba(255,255,255,.07)', border:'1.5px solid rgba(255,255,255,.13)', borderRadius:'4px 18px 18px 18px', padding:'10px 16px', minHeight:48, animation:'gfBubbleIn .5s ease' }}>
                {talking && (
                  <div style={{ display:'flex', gap:3, alignItems:'center', marginBottom:5 }}>
                    {[0,.1,.05,.15,.02].map((d,i) => (
                      <div key={i} style={{ width:3, height:12, borderRadius:4, background:'rgba(168,130,255,.85)', animation:`gfSoundWave .5s ease-in-out ${d}s infinite` }}/>
                    ))}
                  </div>
                )}
                <div style={{ fontSize:13, fontWeight:600, color:'rgba(255,255,255,.9)', lineHeight:1.5 }}>
                  {displayText || <span style={{ color:'rgba(255,255,255,.28)', fontStyle:'italic', fontSize:12 }}>Pao is here!</span>}
                  {talking && <span style={{ animation:'gfCursor .7s step-end infinite', marginLeft:2, color:'#b084ff' }}>|</span>}
                </div>
              </div>
            </div>
          </div>

          {/* ── Stats dropdown panel ── */}
          {showStats && (
            <div style={{ margin:'8px 24px 0', background:'rgba(15,10,35,.9)', border:'1.5px solid rgba(176,132,255,.25)', borderRadius:16, padding:'14px 18px', animation:'gfFadeIn .25s ease', backdropFilter:'blur(12px)', flexShrink:0 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <span style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,.6)', letterSpacing:.5 }}>CHARACTER STATS</span>
                <button onClick={() => setShowStats(false)} style={{ background:'none', border:'none', color:'rgba(255,255,255,.3)', cursor:'pointer', fontSize:16, lineHeight:1 }}>✕</button>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
                {STATS.map(stat => (
                  <div key={stat.key} style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <span style={{ fontSize:11, color:'rgba(255,255,255,.55)', fontWeight:600 }}>{stat.icon} {stat.label}</span>
                      <span style={{ fontSize:12, fontWeight:800, color:stat.color }}>{stat.value}</span>
                    </div>
                    <div style={{ height:5, background:'rgba(255,255,255,.07)', borderRadius:3, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${stat.value}%`, background:stat.color, borderRadius:3 }}/>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Games grid ── */}
          <div style={{ flex:1, display:'flex', flexDirection:'column', padding:'10px 24px 16px', gap:10, overflowY:'auto' }}>
            <h1 style={{ color:'#fff', fontSize:18, fontWeight:800, margin:0, opacity: gamesIn ? 1 : 0, transform: gamesIn ? 'none' : 'translateY(-10px)', transition:'all .5s ease' }}>
              Choose a Game!
            </h1>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, flex:1 }}>
              {GAMES.map((game, i) => {
                const unlocked = character.level >= game.requiredLevel
                return (
                  <button key={game.id} onClick={() => unlocked && setShowCatModal(true)} style={{
                    background: unlocked ? `${game.color}18` : 'rgba(255,255,255,.03)',
                    border: `2px solid ${unlocked ? game.color+'60' : 'rgba(255,255,255,.07)'}`,
                    borderRadius:18, padding:'16px 14px',
                    cursor: unlocked ? 'pointer' : 'not-allowed',
                    display:'flex', flexDirection:'column', alignItems:'flex-start', justifyContent:'space-between', gap:8,
                    animation: gamesIn
                      ? (unlocked
                          ? `gfCardIn .45s ease ${i*.07}s both, gfPulse 2.8s ease ${i*.07+0.5}s infinite`
                          : `gfCardIn .45s ease ${i*.07}s both`)
                      : 'none',
                    transition:'background .2s, transform .15s',
                    boxShadow: unlocked ? `0 0 14px 0 ${game.color}28` : 'none',
                    textAlign:'left', minHeight:110,
                    opacity: unlocked ? 1 : 0.5,
                  }}
                    onMouseEnter={e => unlocked && (e.currentTarget.style.transform='scale(1.04)')}
                    onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}>
                    <span style={{ fontSize:30, filter: unlocked ? 'none' : 'grayscale(.6)' }}>{game.emoji}</span>
                    <div>
                      <div style={{ color: unlocked ? '#fff' : 'rgba(255,255,255,.38)', fontWeight:800, fontSize:14 }}>{game.title}</div>
                      <div style={{ color:'rgba(255,255,255,.38)', fontSize:11, marginTop:2 }}>{game.desc}</div>
                    </div>
                    {unlocked
                      ? <div style={{ background:`${game.color}30`, borderRadius:8, padding:'3px 10px', fontSize:11, color:game.color, fontWeight:700 }}>Play now! 🎮</div>
                      : <div style={{ background:'rgba(255,255,255,.05)', borderRadius:8, padding:'3px 10px', fontSize:10, color:'rgba(255,255,255,.3)', display:'flex', alignItems:'center', gap:4 }}>
                          🔒 Level {game.requiredLevel} required
                        </div>
                    }
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {showCatModal && <CategoryModal onSelect={handleCatSelect} onClose={() => setShowCatModal(false)}/>}
    </div>
  )
}
