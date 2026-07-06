import { useNavigate } from 'react-router-dom'
import { useEffect, useState, useRef } from 'react'
import PictureWordGame from './games/PictureWordGame'
import SlowMotionEchoGame from './games/SlowMotionEchoGame'
import PuzzlePiecesGame from './games/PuzzlePiecesGame'
import StoryBuilderGame from './games/StoryBuilderGame'
import LittleRedRidingHoodGame from './games/LittleRedRidingHoodGame'
import PaoCustomizePage from './games/PaoCustomizePage'
import PandaMascot from './games/PandaMascot'
import { useSharedProgress } from '../context/ProgressContext'
import { speakPao, stopPaoVoice } from '../utils/paoVoice'

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
  { id: 'puzzle-pieces', title: 'Puzzle Pals',        emoji: '🐾', desc: 'Place each piece where it belongs!', color: '#34d399', requiredLevel: 1,  category: 'cognitive',    difficulty: 'easy'   },
  { id: 'picture-word', title: 'Picture-Word Matching', emoji: '🖼️', desc: 'Match a picture to the right word!', color: '#f59e0b', requiredLevel: 1,  category: 'speech',       difficulty: 'easy'   },
  { id: 'echo',         title: 'Slow-Motion Echo',      emoji: '🐢', desc: 'Say each syllable, nice and slow!', color: '#14b8a6', requiredLevel: 2,  category: 'speech',       difficulty: 'easy'   },
  { id: 'sound-hunt',   title: 'Sound Hunt',            emoji: '🔍', desc: 'Find words with the same sound!',   color: '#10b981', requiredLevel: 3,  category: 'speech',       difficulty: 'easy'   },
  { id: 'sentence',     title: 'Sentence Builder',      emoji: '🧩', desc: 'Build sentences like a wizard!',    color: '#6366f1', requiredLevel: 5,  category: 'cognitive',    difficulty: 'medium' },
  { id: 'rhyme',        title: 'Rhyme Time',            emoji: '🎵', desc: 'Find words that rhyme!',            color: '#ec4899', requiredLevel: 7,  category: 'speech',       difficulty: 'easy'   },
  { id: 'story',        title: 'Story Builder',         emoji: '📖', desc: 'Create your own short story!',      color: '#8b5cf6', requiredLevel: 1,  category: 'cognitive',    difficulty: 'hard'   },
  { id: 'alphabet',     title: 'Alphabet Blast',        emoji: '🚀', desc: 'Zoom through the alphabet!',        color: '#ef4444', requiredLevel: 12, category: 'speech',       difficulty: 'medium' },
]

const GAME_CATEGORIES = [
  { id: 'all',          label: 'All Games',        icon: '🎮', color: '#6366f1' },
  { id: 'cognitive',    label: 'Cognitive',        icon: '🧠', color: '#8b5cf6' },
  { id: 'speech',       label: 'Speech & Language', icon: '🗣️', color: '#10b981' },
  { id: 'physical',     label: 'Physical Therapy', icon: '🏃', color: '#3b82f6' },
  { id: 'occupational', label: 'Occupational',     icon: '🖐️', color: '#f59e0b' },
]

const GAME_DIFFICULTIES = [
  { id: 'all',    label: 'All Levels', color: '#6366f1' },
  { id: 'easy',   label: 'Easy',       color: '#22c55e' },
  { id: 'medium', label: 'Medium',     color: '#f59e0b' },
  { id: 'hard',   label: 'Hard',       color: '#ef4444' },
]

const STATS_META = [
  { key: 'intelligence', label: 'Intelligence', icon: '📚', color: '#6366f1' },
  { key: 'focus',        label: 'Focus',        icon: '🎯', color: '#f59e0b' },
  { key: 'resistance',   label: 'Resistance',   icon: '🛡️', color: '#10b981' },
  { key: 'creativity',   label: 'Creativity',   icon: '🎨', color: '#ec4899' },
  { key: 'speed',        label: 'Speed',        icon: '💨', color: '#06b6d4' },
  { key: 'memory',       label: 'Memory',       icon: '🧠', color: '#8b5cf6' },
]

// ─── Sunny scenery (sun, clouds, hills, flowers) ──────────────────────────────

function Sun() {
  return (
    <div style={{ position:'absolute', top:'5%', left:'6%', width:130, height:130, animation:'gfSunPulse 5s ease-in-out infinite', pointerEvents:'none' }}>
      <svg viewBox="0 0 120 120" width={130} height={130}>
        <defs>
          <radialGradient id="gfSunGrad" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#ffe28a"/>
            <stop offset="100%" stopColor="#ffb648"/>
          </radialGradient>
        </defs>
        <g fill="#ffd76a">
          {[...Array(12)].map((_,i) => (
            <rect key={i} x="57" y="2" width="6" height="20" rx="3" transform={`rotate(${i*30} 60 60)`}/>
          ))}
        </g>
        <circle cx="60" cy="60" r="34" fill="url(#gfSunGrad)"/>
        <circle cx="42" cy="66" r="6" fill="#ff9eb0" opacity=".55"/>
        <circle cx="78" cy="66" r="6" fill="#ff9eb0" opacity=".55"/>
        <circle cx="50" cy="57" r="3.5" fill="#7a5324"/>
        <circle cx="70" cy="57" r="3.5" fill="#7a5324"/>
        <path d="M48 69 Q60 79 72 69" stroke="#7a5324" strokeWidth="3" fill="none" strokeLinecap="round"/>
      </svg>
    </div>
  )
}

function Cloud({ x, y, size = 100, delay = 0, dur = 7 }) {
  return (
    <div style={{ position:'absolute', left:x, top:y, animation:`gfCloudDrift ${dur}s ease-in-out ${delay}s infinite`, pointerEvents:'none' }}>
      <svg viewBox="0 0 100 60" width={size} height={size * 0.6}>
        <ellipse cx="30" cy="38" rx="26" ry="18" fill="#fff"/>
        <ellipse cx="55" cy="26" rx="23" ry="21" fill="#fff"/>
        <ellipse cx="76" cy="40" rx="20" ry="15" fill="#fff"/>
        <rect x="16" y="36" width="68" height="18" rx="9" fill="#fff"/>
      </svg>
    </div>
  )
}

function Flower({ x, bottom, hue }) {
  return (
    <div style={{ position:'absolute', left:x, bottom, pointerEvents:'none' }}>
      <svg viewBox="0 0 24 24" width={22} height={22}>
        <g fill={hue}>
          <circle cx="12" cy="6" r="4"/>
          <circle cx="18" cy="12" r="4"/>
          <circle cx="12" cy="18" r="4"/>
          <circle cx="6" cy="12" r="4"/>
        </g>
        <circle cx="12" cy="12" r="4" fill="#ffd93d"/>
      </svg>
    </div>
  )
}

const FLOWERS = [
  { x:'3%',  bottom:'16vh', hue:'#ffffff' },
  { x:'9%',  bottom:'11vh', hue:'#f59e0b' },
  { x:'15%', bottom:'15vh', hue:'#ec4899' },
  { x:'86%', bottom:'12vh', hue:'#f59e0b' },
  { x:'91%', bottom:'17vh', hue:'#ffffff' },
  { x:'80%', bottom:'10vh', hue:'#ec4899' },
]

function HillsScenery() {
  return (
    <>
      <svg viewBox="0 0 1440 260" preserveAspectRatio="none" style={{ position:'absolute', left:0, right:0, bottom:0, width:'100%', height:'24vh', minHeight:150, pointerEvents:'none' }}>
        <path d="M0,120 C180,40 360,40 500,90 C650,145 750,60 900,70 C1080,82 1200,150 1440,110 L1440,260 L0,260 Z" fill="#8fe07a"/>
        <path d="M0,170 C200,120 380,195 560,160 C720,128 880,180 1000,158 C1150,132 1300,195 1440,160 L1440,260 L0,260 Z" fill="#6bcf5a"/>
      </svg>
      {FLOWERS.map((f,i) => <Flower key={i} {...f}/>)}
    </>
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
    speakPao(`Which category would you like to practice today? Pick one and let us go!`, { pitch: 1.62, rate: 1.1 })
    return () => stopPaoVoice()
  }, [])

  return (
    <div style={{ position:'fixed', inset:0, zIndex:10000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(8px)', background:'rgba(60,50,90,0.45)' }}>
      <style>{`@keyframes gfModalIn{from{opacity:0;transform:scale(.88) translateY(18px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
      <div style={{ background:'linear-gradient(145deg,#ffffff,#fdf3e3)', border:'1.5px solid rgba(124,79,224,.2)', borderRadius:28, padding:'32px 28px', width:400, maxWidth:'92vw', animation:'gfModalIn .45s cubic-bezier(.34,1.56,.64,1)', boxShadow:'0 24px 64px rgba(80,60,20,.25)' }}>
        <h2 style={{ color:'#3a2e6b', fontFamily:"'Segoe UI',system-ui,sans-serif", fontSize:22, fontWeight:800, margin:'0 0 6px', textAlign:'center' }}>Choose a Category! 🎯</h2>
        <p style={{ color:'rgba(58,46,107,.6)', fontFamily:"'Segoe UI',system-ui,sans-serif", fontSize:13, margin:'0 0 20px', textAlign:'center' }}>Pick what you want to practice today</p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          {CATEGORIES.map(cat => (
            <button key={cat.id} onClick={() => onSelect(cat.id)} style={{ background:`${cat.color}1f`, border:`2px solid ${cat.color}70`, borderRadius:16, padding:'18px 10px', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:7, transition:'all .2s', color:'#3a2e6b', fontFamily:"'Segoe UI',system-ui,sans-serif" }}
              onMouseEnter={e => { e.currentTarget.style.background=`${cat.color}38`; e.currentTarget.style.transform='scale(1.04)' }}
              onMouseLeave={e => { e.currentTarget.style.background=`${cat.color}1f`; e.currentTarget.style.transform='scale(1)' }}
            >
              <span style={{ fontSize:36 }}>{cat.emoji}</span>
              <span style={{ fontWeight:800, fontSize:15 }}>{cat.label}</span>
              <span style={{ fontSize:11, opacity:.7 }}>{cat.desc}</span>
            </button>
          ))}
        </div>
        <button onClick={onClose} style={{ marginTop:16, width:'100%', background:'rgba(124,79,224,.06)', border:'1px solid rgba(124,79,224,.15)', color:'rgba(58,46,107,.6)', borderRadius:12, padding:'10px', cursor:'pointer', fontFamily:"'Segoe UI',system-ui,sans-serif", fontSize:13, fontWeight:600 }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function GamifiedFullPage({ backPath = '/dashboard', patientId = 'alvrin' }) {
  const navigate = useNavigate()

  const [phase,        setPhase]        = useState('intro')
  const [introStage,   setIntroStage]   = useState(0)
  const [showUI,       setShowUI]       = useState(false)
  const [talking,      setTalking]      = useState(false)
  const [displayText,  setDisplayText]  = useState('')
  const [gamesIn,      setGamesIn]      = useState(false)
  const [showCatModal, setShowCatModal] = useState(false)
  const [selCategory,  setSelCategory]  = useState('fruits')
  const [showStats,    setShowStats]    = useState(false)
  const [gameCatFilter,  setGameCatFilter]  = useState('all')
  const [gameDiffFilter, setGameDiffFilter] = useState('all')

  // Character level/XP/stats — live, driven by played sessions (ProgressContext).
  const { progress } = useSharedProgress()
  const character = { level: progress.level, xp: progress.xp, xpNeeded: progress.xpNeeded }

  const advTimer = useRef(null)
  const stageRef = useRef(0)

  // ── Cleanup ──────────────────────────────────────────────────────────────────
  useEffect(() => () => {
    stopPaoVoice()
  }, [])

  // ── TTS helper ───────────────────────────────────────────────────────────────
  const speakScript = (script, pitchOverride, onDone) => {
    setDisplayText('')
    speakPao(script, {
      pitch: pitchOverride ?? 1.62,
      rate: 1.12,
      onStart: () => setTalking(true),
      onEnd: () => { setTalking(false); onDone?.() },
      onWord: (partial) => setDisplayText(partial),
    })
  }

  // ── Intro stage speech — plays speech only, does NOT auto-advance ────────────
  const speakStage = (idx) => {
    setDisplayText('')
    speakScript(INTRO_STAGES[idx].script, 1.62)
  }

  // ── Go to customize (after intro) ────────────────────────────────────────────
  const goToCustomize = () => {
    stopPaoVoice()
    setDisplayText('')
    setTalking(false)
    setPhase('customize')
  }

  // ── Go to games (after customize or returning from game) ──────────────────────
  const goToGames = () => {
    stopPaoVoice()
    setDisplayText('')
    setTalking(false)
    setPhase('games')
    setTimeout(() => setGamesIn(true), 80)
    setTimeout(() => speakScript(PAO_GAMES_SCRIPT), 500)
  }

  // ── Skip / Next buttons ───────────────────────────────────────────────────────
  const handleSkip = () => {
    stopPaoVoice()
    setTalking(false)
    goToCustomize()
  }

  const handleNextStage = () => {
    stopPaoVoice()
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
    const t2 = setTimeout(() => { setShowUI(true); speakStage(0) }, 800)
    return () => clearTimeout(t2)
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
    stopPaoVoice()
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
    return <PictureWordGame category={selCategory} patientId={patientId} onExit={() => {
      setPhase('games'); setGamesIn(true); setDisplayText('')
      setTimeout(() => speakScript(PAO_GAMES_SCRIPT), 400)
    }}/>
  }

  if (phase === 'echo') {
    return <SlowMotionEchoGame patientId={patientId} onExit={() => {
      setPhase('games'); setGamesIn(true); setDisplayText('')
      setTimeout(() => speakScript(PAO_GAMES_SCRIPT), 400)
    }}/>
  }

  if (phase === 'puzzle-pieces') {
    return <PuzzlePiecesGame patientId={patientId} onExit={() => {
      setPhase('games'); setGamesIn(true); setDisplayText('')
      setTimeout(() => speakScript(PAO_GAMES_SCRIPT), 400)
    }}/>
  }

  if (phase === 'story-select') {
    return <StoryBuilderGame onSelect={(storyId) => {
      if (storyId === 'red-riding-hood') setPhase('story-red-riding-hood')
    }} onExit={() => {
      setPhase('games'); setGamesIn(true); setDisplayText('')
      setTimeout(() => speakScript(PAO_GAMES_SCRIPT), 400)
    }}/>
  }

  if (phase === 'story-red-riding-hood') {
    return <LittleRedRidingHoodGame patientId={patientId} onExit={() => {
      setPhase('games'); setGamesIn(true); setDisplayText('')
      setTimeout(() => speakScript(PAO_GAMES_SCRIPT), 400)
    }}/>
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:9999, background:'linear-gradient(180deg,#56b8ee 0%,#7dd0f5 55%,#bdeafd 100%)', overflow:'hidden', fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
      <style>{`
        @keyframes gfSunPulse  { 0%,100%{transform:scale(1)} 50%{transform:scale(1.06)} }
        @keyframes gfCloudDrift { 0%,100%{transform:translateX(0)} 50%{transform:translateX(14px)} }
        @keyframes gfCardIn    { from{opacity:0;transform:translateY(20px) scale(.93)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes gfPulse     { 0%,100%{box-shadow:0 0 0 0 rgba(245,158,11,.5)} 50%{box-shadow:0 0 0 8px rgba(245,158,11,0)} }
        @keyframes gfBubbleIn  { from{opacity:0;transform:scale(.88) translateY(6px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes gfCursor    { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes gfSoundWave { 0%,100%{transform:scaleY(.3)} 50%{transform:scaleY(1)} }
        @keyframes gfFadeIn    { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes gfStageIn   { from{opacity:0;transform:scale(.88) translateY(-6px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes gfLevelPop  { 0%{transform:scale(1)} 50%{transform:scale(1.15)} 100%{transform:scale(1)} }

        .pao-mascot-intro svg { max-width: 100%; height: auto; }
        @media (max-width: 480px) {
          .pao-mascot-intro svg { width: 190px !important; }
        }
      `}</style>

      <Sun/>
      <Cloud x="26%" y="8%"  size={90}  delay={0}   dur={7}/>
      <Cloud x="70%" y="6%"  size={110} delay={1.2} dur={8}/>
      <Cloud x="52%" y="16%" size={70}  delay={0.6} dur={6.5}/>
      <Cloud x="88%" y="22%" size={80}  delay={0.3} dur={7.5}/>
      <HillsScenery/>

      <button onClick={() => { stopPaoVoice(); navigate(backPath) }} style={{ position:'absolute', top:18, left:20, zIndex:10, background:'rgba(255,255,255,.8)', border:'1.5px solid rgba(124,79,224,.25)', color:'#4b3f7a', borderRadius:10, padding:'8px 18px', fontSize:13, fontWeight:700, cursor:'pointer', boxShadow:'0 2px 10px rgba(80,60,20,.1)' }}>
        ← Back
      </button>

      {/* ══════════════ INTRO PHASE ══════════════ */}
      {phase === 'intro' && (
        <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, padding:'70px 24px 24px' }}>

          {/* Stage progress + dots (top-right) */}
          {showUI && (
            <div style={{ position:'absolute', top:20, right:24, display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:12, color:'rgba(74,58,122,.5)', fontWeight:600 }}>Intro</span>
              {INTRO_STAGES.map((_,i) => (
                <div key={i} style={{ width:9, height:9, borderRadius:'50%', background: i <= introStage ? '#8b5cf6' : 'rgba(124,79,224,.16)', transition:'background .35s', boxShadow: i === introStage ? '0 0 8px #8b5cf6' : 'none' }}/>
              ))}
            </div>
          )}

          {/* Stage label */}
          {showUI && (
            <div key={`label-${introStage}`} style={{ background:'rgba(139,92,246,.14)', border:'1px solid rgba(139,92,246,.3)', borderRadius:20, padding:'5px 16px', fontSize:13, fontWeight:700, color:'#6d28d9', animation:'gfStageIn .35s ease', letterSpacing:.5 }}>
              {INTRO_STAGES[introStage].icon} {INTRO_STAGES[introStage].label}
            </div>
          )}

          {/* Pao mascot */}
          <div className="pao-mascot-intro" style={{ flexShrink:0 }}>
            <PandaMascot pxWidth={250} mouthOpen={talking} onClick={handlePandaClick}/>
          </div>

          {/* Speech bubble */}
          {showUI && (
            <div style={{ animation:'gfBubbleIn .5s cubic-bezier(.34,1.56,.64,1)', background:'rgba(255,255,255,.85)', backdropFilter:'blur(12px)', border:'1.5px solid rgba(124,79,224,.22)', borderRadius:24, padding:'16px 26px', maxWidth:560, width:'100%', minHeight:60, boxShadow:'0 8px 32px rgba(80,60,20,.12)' }}>
              {talking && (
                <div style={{ display:'flex', gap:3, alignItems:'center', marginBottom:8 }}>
                  {[0,.12,.06,.18,.03].map((d,i) => (
                    <div key={i} style={{ width:3, height:15, borderRadius:4, background:'rgba(124,79,224,.75)', animation:`gfSoundWave .5s ease-in-out ${d}s infinite` }}/>
                  ))}
                </div>
              )}
              <div style={{ fontSize:15, fontWeight:600, color:'#3a2e6b', lineHeight:1.65 }}>
                {displayText || <span style={{ color:'rgba(58,46,107,.4)', fontStyle:'italic', fontSize:14 }}>Pao is ready!</span>}
                {talking && <span style={{ animation:'gfCursor .7s step-end infinite', marginLeft:2, color:'#7c3aed' }}>|</span>}
              </div>
            </div>
          )}

          {/* Next / Skip buttons */}
          {showUI && (
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={handleNextStage} style={{ background:'rgba(139,92,246,.18)', border:'1.5px solid rgba(139,92,246,.5)', color:'#5b21b6', borderRadius:14, padding:'10px 26px', fontSize:14, fontWeight:700, cursor:'pointer', transition:'background .2s' }}
                onMouseEnter={e => e.currentTarget.style.background='rgba(139,92,246,.3)'}
                onMouseLeave={e => e.currentTarget.style.background='rgba(139,92,246,.18)'}>
                {introStage < INTRO_STAGES.length - 1 ? 'Next →' : "Let's Go! 🎮"}
              </button>
              <button onClick={handleSkip} style={{ background:'rgba(124,79,224,.06)', border:'1px solid rgba(124,79,224,.15)', color:'rgba(58,46,107,.55)', borderRadius:14, padding:'10px 20px', fontSize:13, fontWeight:600, cursor:'pointer' }}>
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
          <button onClick={() => { stopPaoVoice(); setPhase('customize') }} style={{ position:'absolute', top:18, right:20, zIndex:10, display:'flex', alignItems:'center', gap:7, background:'rgba(139,92,246,.14)', border:'1.5px solid rgba(139,92,246,.4)', color:'#5b21b6', borderRadius:12, padding:'8px 16px', fontSize:13, fontWeight:700, cursor:'pointer', transition:'all .2s' }}
            onMouseEnter={e => { e.currentTarget.style.background='rgba(139,92,246,.26)'; e.currentTarget.style.borderColor='rgba(139,92,246,.6)' }}
            onMouseLeave={e => { e.currentTarget.style.background='rgba(139,92,246,.14)'; e.currentTarget.style.borderColor='rgba(139,92,246,.4)' }}>
            ✨ Customize Pao
          </button>

          {/* Pao + speech bubble row */}
          <div style={{ display:'flex', alignItems:'flex-end', gap:16, padding:'14px 24px 0', flexShrink:0 }}>
            <div style={{ flexShrink:0 }}>
              <PandaMascot pxWidth={150} mouthOpen={talking} onClick={handlePandaClick}/>
            </div>
            <div style={{ flex:1, alignSelf:'center', display:'flex', flexDirection:'column', gap:6 }}>
              {/* Level badge + stats toggle */}
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(255,183,3,.14)', border:'1px solid rgba(255,183,3,.4)', borderRadius:20, padding:'4px 12px 4px 8px' }}>
                  <span style={{ fontSize:14 }}>⭐</span>
                  <span style={{ fontSize:11, fontWeight:700, color:'#92400e', letterSpacing:.8 }}>LVL</span>
                  <span style={{ fontSize:20, fontWeight:900, color:'#d97706', lineHeight:1 }}>{character.level}</span>
                </div>
                {/* XP mini bar */}
                <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                  <span style={{ fontSize:9, color:'rgba(58,46,107,.5)', fontWeight:600 }}>XP {character.xp}/{character.xpNeeded}</span>
                  <div style={{ width:72, height:4, background:'rgba(124,79,224,.12)', borderRadius:3, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${(character.xp/character.xpNeeded)*100}%`, background:'linear-gradient(90deg,#6366f1,#8b5cf6)', borderRadius:3 }}/>
                  </div>
                </div>
                {/* Stats toggle icon */}
                <button onClick={() => setShowStats(s => !s)} title="View Stats" style={{ background: showStats ? 'rgba(139,92,246,.25)' : 'rgba(124,79,224,.08)', border:`1.5px solid ${showStats ? 'rgba(139,92,246,.5)' : 'rgba(124,79,224,.2)'}`, borderRadius:10, width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:16, transition:'all .2s', flexShrink:0 }}>
                  📊
                </button>
              </div>

              {/* Speech bubble */}
              <div style={{ background:'rgba(255,255,255,.82)', border:'1.5px solid rgba(124,79,224,.18)', borderRadius:'4px 18px 18px 18px', padding:'10px 16px', minHeight:48, animation:'gfBubbleIn .5s ease' }}>
                {talking && (
                  <div style={{ display:'flex', gap:3, alignItems:'center', marginBottom:5 }}>
                    {[0,.1,.05,.15,.02].map((d,i) => (
                      <div key={i} style={{ width:3, height:12, borderRadius:4, background:'rgba(124,79,224,.75)', animation:`gfSoundWave .5s ease-in-out ${d}s infinite` }}/>
                    ))}
                  </div>
                )}
                <div style={{ fontSize:13, fontWeight:600, color:'#3a2e6b', lineHeight:1.5 }}>
                  {displayText || <span style={{ color:'rgba(58,46,107,.4)', fontStyle:'italic', fontSize:12 }}>Pao is here!</span>}
                  {talking && <span style={{ animation:'gfCursor .7s step-end infinite', marginLeft:2, color:'#7c3aed' }}>|</span>}
                </div>
              </div>
            </div>
          </div>

          {/* ── Stats dropdown panel ── */}
          {showStats && (
            <div style={{ margin:'8px 24px 0', background:'rgba(255,255,255,.88)', border:'1.5px solid rgba(139,92,246,.25)', borderRadius:16, padding:'14px 18px', animation:'gfFadeIn .25s ease', backdropFilter:'blur(12px)', flexShrink:0 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <span style={{ fontSize:12, fontWeight:700, color:'rgba(58,46,107,.65)', letterSpacing:.5 }}>CHARACTER STATS</span>
                <button onClick={() => setShowStats(false)} style={{ background:'none', border:'none', color:'rgba(58,46,107,.4)', cursor:'pointer', fontSize:16, lineHeight:1 }}>✕</button>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
                {STATS_META.map(stat => {
                  const value = progress.characterStats[stat.key]
                  return (
                    <div key={stat.key} style={{ display:'flex', flexDirection:'column', gap:4 }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <span style={{ fontSize:11, color:'rgba(58,46,107,.6)', fontWeight:600 }}>{stat.icon} {stat.label}</span>
                        <span style={{ fontSize:12, fontWeight:800, color:stat.color }}>{value}</span>
                      </div>
                      <div style={{ height:5, background:'rgba(124,79,224,.1)', borderRadius:3, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${value}%`, background:stat.color, borderRadius:3 }}/>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Games grid ── */}
          <div style={{ flex:1, display:'flex', flexDirection:'column', padding:'10px 24px 16px', gap:10, overflowY:'auto' }}>
            <h1 style={{ color:'#3a2e6b', fontSize:18, fontWeight:800, margin:0, opacity: gamesIn ? 1 : 0, transform: gamesIn ? 'none' : 'translateY(-10px)', transition:'all .5s ease' }}>
              Choose a Game!
            </h1>

            {/* Category filter chips */}
            <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
              {GAME_CATEGORIES.map(cat => {
                const active = gameCatFilter === cat.id
                return (
                  <button key={cat.id} onClick={() => setGameCatFilter(cat.id)} style={{
                    background: active ? cat.color : 'rgba(255,255,255,.88)',
                    border: `2px solid ${cat.color}`,
                    color: active ? '#fff' : cat.color,
                    borderRadius:22, padding:'8px 16px', fontSize:14, fontWeight:800,
                    cursor:'pointer', display:'flex', alignItems:'center', gap:6, transition:'all .18s',
                    boxShadow: active ? `0 3px 10px ${cat.color}55` : '0 2px 6px rgba(60,50,90,.12)',
                  }}>
                    <span style={{ fontSize:16 }}>{cat.icon}</span>{cat.label}
                  </button>
                )
              })}
            </div>

            {/* Difficulty filter chips */}
            <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:4 }}>
              {GAME_DIFFICULTIES.map(diff => {
                const active = gameDiffFilter === diff.id
                return (
                  <button key={diff.id} onClick={() => setGameDiffFilter(diff.id)} style={{
                    background: active ? diff.color : 'rgba(255,255,255,.88)',
                    border: `2px solid ${diff.color}`,
                    color: active ? '#fff' : diff.color,
                    borderRadius:22, padding:'7px 16px', fontSize:13.5, fontWeight:800,
                    cursor:'pointer', transition:'all .18s',
                    boxShadow: active ? `0 3px 10px ${diff.color}55` : '0 2px 6px rgba(60,50,90,.12)',
                  }}>
                    {diff.label}
                  </button>
                )
              })}
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, flex:1 }}>
              {GAMES.filter(g =>
                (gameCatFilter === 'all' || g.category === gameCatFilter) &&
                (gameDiffFilter === 'all' || g.difficulty === gameDiffFilter)
              ).map((game, i) => {
                const unlocked = character.level >= game.requiredLevel
                const catMeta = GAME_CATEGORIES.find(c => c.id === game.category)
                const diffMeta = GAME_DIFFICULTIES.find(d => d.id === game.difficulty)
                return (
                  <button key={game.id} onClick={() => {
                    if (!unlocked) return
                    if (game.id === 'echo') { stopPaoVoice(); setPhase('echo') }
                    else if (game.id === 'puzzle-pieces') { stopPaoVoice(); setPhase('puzzle-pieces') }
                    else if (game.id === 'story') { stopPaoVoice(); setPhase('story-select') }
                    else setShowCatModal(true)
                  }} style={{
                    background: unlocked ? `${game.color}1f` : 'rgba(0,0,0,.03)',
                    border: `2px solid ${unlocked ? game.color+'60' : 'rgba(0,0,0,.08)'}`,
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
                      <div style={{ color: unlocked ? '#2d2a4a' : 'rgba(45,42,74,.35)', fontWeight:800, fontSize:14 }}>{game.title}</div>
                      <div style={{ color:'rgba(45,42,74,.5)', fontSize:11, marginTop:2 }}>{game.desc}</div>
                      <div style={{ display:'flex', gap:6, marginTop:7, flexWrap:'wrap' }}>
                        {catMeta && (
                          <span style={{ background:catMeta.color, color:'#fff', borderRadius:8, padding:'3px 9px', fontSize:11, fontWeight:800, display:'flex', alignItems:'center', gap:4, boxShadow:`0 1px 4px ${catMeta.color}70` }}>
                            {catMeta.icon} {catMeta.label}
                          </span>
                        )}
                        {diffMeta && (
                          <span style={{ background:diffMeta.color, color:'#fff', borderRadius:8, padding:'3px 9px', fontSize:11, fontWeight:800, boxShadow:`0 1px 4px ${diffMeta.color}70` }}>
                            {diffMeta.label}
                          </span>
                        )}
                      </div>
                    </div>
                    {unlocked
                      ? <div style={{ background:`${game.color}30`, borderRadius:8, padding:'3px 10px', fontSize:11, color:game.color, fontWeight:700 }}>Play now! 🎮</div>
                      : <div style={{ background:'rgba(0,0,0,.04)', borderRadius:8, padding:'3px 10px', fontSize:10, color:'rgba(45,42,74,.4)', display:'flex', alignItems:'center', gap:4 }}>
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
