import { useState, useEffect, useRef } from 'react'
import PandaMascot from './PandaMascot'

// ─── Questions by category ────────────────────────────────────────────────────

export const QUESTIONS_BY_CATEGORY = {
  fruits: [
    { word: 'Apple',      emoji: '🍎', options: ['Apple',      'Orange',    'Banana',    'Grape']      },
    { word: 'Banana',     emoji: '🍌', options: ['Mango',      'Banana',    'Pineapple', 'Peach']      },
    { word: 'Orange',     emoji: '🍊', options: ['Orange',     'Lemon',     'Apple',     'Cherry']     },
    { word: 'Grape',      emoji: '🍇', options: ['Berry',      'Grape',     'Plum',      'Peach']      },
    { word: 'Strawberry', emoji: '🍓', options: ['Strawberry', 'Cherry',    'Blueberry', 'Raspberry']  },
    { word: 'Watermelon', emoji: '🍉', options: ['Melon',      'Watermelon','Pumpkin',   'Cucumber']   },
    { word: 'Pineapple',  emoji: '🍍', options: ['Pineapple',  'Coconut',   'Mango',     'Durian']     },
    { word: 'Mango',      emoji: '🥭', options: ['Papaya',     'Mango',     'Guava',     'Peach']      },
    { word: 'Cherry',     emoji: '🍒', options: ['Cherry',     'Berry',     'Grape',     'Plum']       },
    { word: 'Peach',      emoji: '🍑', options: ['Peach',      'Apricot',   'Plum',      'Mango']      },
  ],
  vegetables: [
    { word: 'Carrot',    emoji: '🥕', options: ['Carrot',   'Radish',   'Turnip',  'Parsnip'] },
    { word: 'Broccoli',  emoji: '🥦', options: ['Broccoli', 'Cabbage',  'Lettuce', 'Spinach'] },
    { word: 'Corn',      emoji: '🌽', options: ['Corn',     'Wheat',    'Rice',    'Barley']  },
    { word: 'Tomato',    emoji: '🍅', options: ['Tomato',   'Apple',    'Pepper',  'Cherry']  },
    { word: 'Eggplant',  emoji: '🍆', options: ['Eggplant', 'Beet',     'Radish',  'Turnip']  },
    { word: 'Cucumber',  emoji: '🥒', options: ['Cucumber', 'Zucchini', 'Pickle',  'Celery']  },
    { word: 'Pepper',    emoji: '🫑', options: ['Pepper',   'Chili',    'Tomato',  'Squash']  },
    { word: 'Onion',     emoji: '🧅', options: ['Onion',    'Garlic',   'Leek',    'Shallot'] },
    { word: 'Potato',    emoji: '🥔', options: ['Potato',   'Yam',      'Turnip',  'Beet']    },
    { word: 'Mushroom',  emoji: '🍄', options: ['Mushroom', 'Truffle',  'Onion',   'Garlic']  },
  ],
  animals: [
    { word: 'Dog',       emoji: '🐶', options: ['Cat',       'Dog',       'Wolf',      'Fox']       },
    { word: 'Cat',       emoji: '🐱', options: ['Dog',       'Cat',       'Mouse',     'Rabbit']    },
    { word: 'Elephant',  emoji: '🐘', options: ['Elephant',  'Hippo',     'Rhino',     'Giraffe']   },
    { word: 'Lion',      emoji: '🦁', options: ['Lion',      'Tiger',     'Leopard',   'Cheetah']   },
    { word: 'Rabbit',    emoji: '🐰', options: ['Rabbit',    'Hamster',   'Squirrel',  'Mouse']     },
    { word: 'Duck',      emoji: '🦆', options: ['Duck',      'Goose',     'Swan',      'Chicken']   },
    { word: 'Frog',      emoji: '🐸', options: ['Frog',      'Toad',      'Lizard',    'Turtle']    },
    { word: 'Butterfly', emoji: '🦋', options: ['Butterfly', 'Moth',      'Bee',       'Dragonfly'] },
    { word: 'Fish',      emoji: '🐠',  options: ['Fish',      'Dolphin',   'Whale',     'Shark']     },
    { word: 'Bear',      emoji: '🐻', options: ['Bear',      'Panda',     'Koala',     'Fox']       },
  ],
  things: [
    { word: 'Ball',     emoji: '⚽',  options: ['Ball',    'Bat',   'Kite',    'Toy']     },
    { word: 'Book',     emoji: '📚',  options: ['Pen',     'Book',  'Bag',     'Ruler']   },
    { word: 'House',    emoji: '🏠',  options: ['School',  'Park',  'House',   'Tree']    },
    { word: 'Car',      emoji: '🚗',  options: ['Car',     'Bus',   'Bike',    'Train']   },
    { word: 'Star',     emoji: '⭐',  options: ['Moon',    'Star',  'Planet',  'Sky']     },
    { word: 'Rainbow',  emoji: '🌈',  options: ['Rain',    'Cloud', 'Rainbow', 'Sun']     },
    { word: 'Cake',     emoji: '🎂',  options: ['Cake',    'Cookie','Bread',   'Pie']     },
    { word: 'Airplane', emoji: '✈️',  options: ['Boat',    'Train', 'Airplane','Rocket']  },
    { word: 'Sun',      emoji: '☀️',  options: ['Moon',    'Star',  'Cloud',   'Sun']     },
    { word: 'Flower',   emoji: '🌸',  options: ['Leaf',    'Tree',  'Grass',   'Flower']  },
  ],
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CHEERS_CORRECT = [
  'Yay! That is right!', 'Amazing! You got it!', 'Brilliant! Well done!',
  'Super! You are so smart!', 'Wow! Perfect match!', 'Awesome job!',
]
const CHEERS_WRONG = [
  'Good try! Let us keep going!', 'Almost there! Next one!',
  'Keep going, you are doing great!', 'That is okay! Try the next one!',
]
const CATEGORY_LABELS = { fruits:'🍎 Fruits', vegetables:'🥕 Vegetables', animals:'🐾 Animals', things:'🎒 Things' }

function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5) }

// ─── Word Wizard Badge SVG ────────────────────────────────────────────────────

function WordWizardBadge({ size = 120, animate = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" style={{ filter:'drop-shadow(0 0 18px rgba(251,191,36,.55))', animation: animate ? 'badgePop .7s cubic-bezier(.34,1.56,.64,1) both' : 'none' }}>
      {/* Outer ring */}
      <circle cx="60" cy="60" r="57" fill="none" stroke="url(#bRing)" strokeWidth="4"/>
      <defs>
        <radialGradient id="bBg" cx="40%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#fbbf24"/>
          <stop offset="60%" stopColor="#d97706"/>
          <stop offset="100%" stopColor="#92400e"/>
        </radialGradient>
        <linearGradient id="bRing" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fde68a"/>
          <stop offset="100%" stopColor="#f59e0b"/>
        </linearGradient>
        <radialGradient id="bShine" cx="30%" cy="25%" r="60%">
          <stop offset="0%" stopColor="rgba(255,255,255,.45)"/>
          <stop offset="100%" stopColor="rgba(255,255,255,0)"/>
        </radialGradient>
      </defs>
      {/* Badge body */}
      <circle cx="60" cy="60" r="54" fill="url(#bBg)"/>
      <circle cx="60" cy="60" r="54" fill="url(#bShine)"/>
      {/* Picture frame */}
      <rect x="30" y="52" width="60" height="44" rx="5" fill="#7c2d12" stroke="#fbbf24" strokeWidth="3"/>
      <rect x="35" y="57" width="50" height="34" rx="3" fill="#1a1430"/>
      {/* Picture frame inner art — simple landscape lines */}
      <ellipse cx="60" cy="74" rx="16" ry="9" fill="#065f46" opacity=".7"/>
      <ellipse cx="60" cy="62" rx="10" ry="7" fill="#fbbf24" opacity=".55"/>
      {/* Wizard hat */}
      <polygon points="60,14 45,52 75,52" fill="#7c3aed" stroke="#c4b5fd" strokeWidth="1.5" strokeLinejoin="round"/>
      <rect x="40" y="50" width="40" height="6" rx="3" fill="#a78bfa" stroke="#c4b5fd" strokeWidth="1"/>
      {/* Hat star */}
      <polygon points="60,22 61.5,27 66.5,27 62.5,30 64,35 60,32 56,35 57.5,30 53.5,27 58.5,27" fill="#fde68a" opacity=".9"/>
      {/* Sparkle wand — diagonal bottom-right */}
      <line x1="74" y1="90" x2="96" y2="112" stroke="#fbbf24" strokeWidth="3.5" strokeLinecap="round"/>
      <circle cx="74" cy="90" r="5" fill="#fde68a" stroke="#f59e0b" strokeWidth="1.5"/>
      {/* Wand sparkles */}
      {[[88,102,8],[82,96,6],[94,108,5]].map(([x,y,s],i)=>(
        <g key={i}>
          <line x1={x} y1={y-s} x2={x} y2={y+s} stroke="#fde68a" strokeWidth="1.8" strokeLinecap="round" opacity=".8"/>
          <line x1={x-s} y1={y} x2={x+s} y2={y} stroke="#fde68a" strokeWidth="1.8" strokeLinecap="round" opacity=".8"/>
        </g>
      ))}
      {/* Badge label area */}
      <rect x="18" y="100" width="84" height="0" rx="0" fill="none"/>
    </svg>
  )
}

// ─── Finish screen ────────────────────────────────────────────────────────────

function FinishScreen({ score, total, onReplay, onExit }) {
  const pct        = score / total
  const stars      = pct >= 0.85 ? 3 : pct >= 0.55 ? 2 : 1
  const scoreMsg   = stars === 3 ? 'Perfect score! You are absolutely amazing!'
    : stars === 2  ? 'Great job! You are getting really good at this!'
    : 'Good effort! Practice makes perfect, keep going!'

  const [phase,       setPhase]       = useState('score')   // 'score' | 'badge'
  const [talking,     setTalking]     = useState(false)
  const [mouthOpen,   setMouthOpen]   = useState(false)
  const [displayText, setDisplayText] = useState('')
  const mouthRef = useRef(null)

  const BADGE_SCRIPT = `Heehee! Congratulations! You just earned the WORD WIZARD badge! Yay! That wizard hat is all yours now! And guess what? This badge unlocks brand new items you can use to customize ME! Go to the Customize page and try them on! I cannot wait to wear something cool! Teehee!`

  useEffect(() => {
    if (talking) { mouthRef.current = setInterval(() => setMouthOpen(p => !p), 155) }
    else { clearInterval(mouthRef.current); setMouthOpen(false) }
    return () => clearInterval(mouthRef.current)
  }, [talking])

  useEffect(() => {
    return () => window.speechSynthesis?.cancel()
  }, [])

  const speakWithDisplay = (text, onDone) => {
    setDisplayText('')
    pgSpeak(text, {
      onStart: () => setTalking(true),
      onEnd:   () => { setTalking(false); setMouthOpen(false); if (onDone) onDone() },
      onWord:  (partial) => setDisplayText(partial),
    })
  }

  useEffect(() => {
    // Stage 1: score speech
    setTimeout(() => {
      speakWithDisplay(`You got ${score} out of ${total}! ${scoreMsg}`, () => {
        // After score speech, wait then show badge
        setTimeout(() => setPhase('badge'), 900)
      })
    }, 400)
  }, []) // eslint-disable-line

  // When badge phase starts: persist badge + speak congratulation
  useEffect(() => {
    if (phase !== 'badge') return
    try {
      const earned = JSON.parse(localStorage.getItem('pao_badges') || '[]')
      if (!earned.includes('Word Wizard')) {
        localStorage.setItem('pao_badges', JSON.stringify([...earned, 'Word Wizard']))
      }
    } catch {}
    setTimeout(() => speakWithDisplay(BADGE_SCRIPT), 600)
  }, [phase]) // eslint-disable-line

  return (
    <div style={{ position:'fixed', inset:0, zIndex:9999, background:'radial-gradient(ellipse at 50% 35%,#1a1430 0%,#0a0a0f 100%)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'#fff', fontFamily:"'Segoe UI',system-ui,sans-serif", gap:10, overflow:'hidden' }}>
      <style>{`
        @keyframes pgFadeUp  { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pgPop     { 0%{transform:scale(0)} 70%{transform:scale(1.15)} 100%{transform:scale(1)} }
        @keyframes pgFloat   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes badgePop  { 0%{transform:scale(0) rotate(-15deg)} 65%{transform:scale(1.18) rotate(4deg)} 85%{transform:scale(.95) rotate(-2deg)} 100%{transform:scale(1) rotate(0)} }
        @keyframes badgeGlow { 0%,100%{filter:drop-shadow(0 0 12px rgba(251,191,36,.5))} 50%{filter:drop-shadow(0 0 28px rgba(251,191,36,.9))} }
        @keyframes confetti  { 0%{transform:translateY(-20px) rotate(0deg);opacity:1} 100%{transform:translateY(80px) rotate(360deg);opacity:0} }
        @keyframes pgSoundWave { 0%,100%{transform:scaleY(.3)} 50%{transform:scaleY(1)} }
        @keyframes pgCursor  { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes unlockPop { from{opacity:0;transform:scale(.8) translateY(10px)} to{opacity:1;transform:scale(1) translateY(0)} }
      `}</style>

      {/* Confetti particles (badge phase only) */}
      {phase === 'badge' && ['#f59e0b','#fbbf24','#a78bfa','#34d399','#f472b6'].map((c,i)=>(
        Array.from({length:3},(_,j)=>(
          <div key={`${i}-${j}`} style={{ position:'absolute', top:0, left:`${10 + i*18 + j*5}%`, width:8, height:8, borderRadius:2, background:c, animation:`confetti ${1.4+j*.3}s ease-in ${i*.1+j*.15}s both`, pointerEvents:'none', transform:'rotate(45deg)' }}/>
        ))
      ))}

      {/* Pao */}
      <div style={{ animation:'pgFloat 2.5s ease-in-out infinite', fontSize:0, flexShrink:0 }}>
        <PandaMascot entered={true} mouthOpen={mouthOpen} pxWidth={160}/>
      </div>

      {/* Stars */}
      <div style={{ display:'flex', gap:6, fontSize:38, animation:'pgPop .6s .3s cubic-bezier(.34,1.56,.64,1) both' }}>
        {Array.from({length:3},(_,i)=><span key={i} style={{ opacity:i<stars?1:.2, filter:i<stars?'none':'grayscale(1)' }}>⭐</span>)}
      </div>

      <h1 style={{ fontSize:26, fontWeight:800, margin:'2px 0 0', animation:'pgFadeUp .5s .5s both' }}>{score} / {total} Correct!</h1>

      {/* Pao speech bubble */}
      <div style={{ maxWidth:480, width:'90%', background:'rgba(255,255,255,.07)', border:'1.5px solid rgba(255,255,255,.13)', borderRadius:'4px 18px 18px 18px', padding:'10px 16px', minHeight:48, animation:'pgFadeUp .5s .6s both' }}>
        {talking && (
          <div style={{ display:'flex', gap:3, alignItems:'center', marginBottom:6 }}>
            {[0,.1,.05,.15,.02].map((d,i)=>(
              <div key={i} style={{ width:3, height:12, borderRadius:4, background:'rgba(168,130,255,.85)', animation:`pgSoundWave .5s ease-in-out ${d}s infinite` }}/>
            ))}
          </div>
        )}
        <div style={{ fontSize:14, fontWeight:600, color:'rgba(255,255,255,.9)', lineHeight:1.55 }}>
          {displayText || <span style={{ color:'rgba(255,255,255,.3)', fontStyle:'italic', fontSize:13 }}>Pao is celebrating!</span>}
          {talking && <span style={{ animation:'pgCursor .7s step-end infinite', marginLeft:2, color:'#b084ff' }}>|</span>}
        </div>
      </div>

      {/* ── Badge reveal ── */}
      {phase === 'badge' && (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8, animation:'unlockPop .6s cubic-bezier(.34,1.56,.64,1) both', background:'rgba(251,191,36,.08)', border:'2px solid rgba(251,191,36,.3)', borderRadius:24, padding:'16px 32px' }}>
          <div style={{ fontSize:11, fontWeight:700, color:'rgba(251,191,36,.7)', letterSpacing:1.5, textTransform:'uppercase' }}>🎉 Badge Earned!</div>
          <div style={{ animation:'badgeGlow 2s ease-in-out infinite' }}>
            <WordWizardBadge size={100} animate={true}/>
          </div>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:18, fontWeight:900, color:'#fbbf24' }}>Word Wizard</div>
            <div style={{ fontSize:12, color:'rgba(255,255,255,.5)', marginTop:3 }}>Unlocks new Customize items for Pao!</div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(167,139,250,.12)', border:'1px solid rgba(167,139,250,.3)', borderRadius:10, padding:'6px 14px', fontSize:12, color:'#c4b5fd', fontWeight:600 }}>
            ✨ New items unlocked in Customize Pao!
          </div>
        </div>
      )}

      {/* Buttons */}
      <div style={{ display:'flex', gap:12, animation:'pgFadeUp .5s .8s both', marginTop:4 }}>
        <button onClick={onReplay} style={actionBtn('#7c3aed')}>Play Again 🎮</button>
        <button onClick={onExit}   style={actionBtn('#374151')}>← All Games</button>
      </div>
    </div>
  )
}

// ─── Shared speak helper ──────────────────────────────────────────────────────

function pgSpeak(text, { onStart, onEnd, onWord } = {}) {
  if (!window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const utt = new SpeechSynthesisUtterance(text)
  utt.rate = 1.08; utt.pitch = 1.62; utt.volume = 1
  if (onStart)    utt.onstart    = onStart
  if (onEnd)      utt.onend      = onEnd
  if (onWord)     utt.onboundary = (e) => { if (e.name === 'word') onWord(text.substring(0, e.charIndex + e.charLength)) }
  const go = () => {
    const voices = window.speechSynthesis.getVoices()
    const v = voices.find(v => v.lang.startsWith('en') && /zira/i.test(v.name))    ||
              voices.find(v => v.lang.startsWith('en') && /samantha/i.test(v.name)) ||
              voices.find(v => v.lang === 'en-US')                                  ||
              voices.find(v => v.lang.startsWith('en'))                             ||
              voices[0]
    if (v) utt.voice = v
    window.speechSynthesis.speak(utt)
  }
  if (window.speechSynthesis.getVoices().length > 0) go()
  else window.speechSynthesis.onvoiceschanged = go
}

// ─── Main game ────────────────────────────────────────────────────────────────

export default function PictureWordGame({ onExit, category = 'fruits' }) {
  const pool = QUESTIONS_BY_CATEGORY[category] || QUESTIONS_BY_CATEGORY.fruits

  const [questions]    = useState(() => shuffle(pool).slice(0, 6))
  const [current,       setCurrent]      = useState(0)
  const [options,       setOptions]      = useState([])
  const [selected,      setSelected]     = useState(null)
  const [result,        setResult]       = useState(null)
  const [score,         setScore]        = useState(0)
  const [done,          setDone]         = useState(false)
  const [picAnim,       setPicAnim]      = useState('pgBounce')

  // Pao speech state
  const [talking,      setTalking]      = useState(false)
  const [mouthOpen,    setMouthOpen]    = useState(false)
  const [displayText,  setDisplayText]  = useState('')

  const mouthRef = useRef(null)
  const timerRef = useRef(null)

  /* mouth toggle while talking */
  useEffect(() => {
    if (talking) {
      mouthRef.current = setInterval(() => setMouthOpen(p => !p), 155)
    } else {
      clearInterval(mouthRef.current)
      setMouthOpen(false)
    }
    return () => clearInterval(mouthRef.current)
  }, [talking])

  /* cleanup on unmount */
  useEffect(() => () => {
    clearTimeout(timerRef.current)
    clearInterval(mouthRef.current)
    window.speechSynthesis?.cancel()
  }, [])

  const speak = (text) => {
    setDisplayText('')
    pgSpeak(text, {
      onStart: () => setTalking(true),
      onEnd:   () => { setTalking(false); setMouthOpen(false) },
      onWord:  (partial) => setDisplayText(partial),
    })
  }

  /* new question */
  useEffect(() => {
    const q = questions[current]
    if (!q) return
    setOptions(shuffle(q.options))
    setSelected(null); setResult(null); setPicAnim('pgBounce')
    setTimeout(() => speak('Look at the picture! Which word matches?'), 350)
  }, [current, questions]) // eslint-disable-line

  const handleSelect = (word) => {
    if (selected !== null) return
    setSelected(word)
    const isCorrect = word === questions[current].word
    setResult(isCorrect ? 'correct' : 'wrong')
    if (isCorrect) {
      setScore(s => s + 1)
      setPicAnim('pgCorrectPic')
      speak(CHEERS_CORRECT[Math.floor(Math.random() * CHEERS_CORRECT.length)])
    } else {
      speak(CHEERS_WRONG[Math.floor(Math.random() * CHEERS_WRONG.length)])
    }
    timerRef.current = setTimeout(() => {
      if (current + 1 >= questions.length) setDone(true)
      else setCurrent(c => c + 1)
    }, 2200)
  }

  const handleReplay = () => {
    window.speechSynthesis?.cancel()
    setCurrent(0); setScore(0); setDone(false)
    setDisplayText(''); setTalking(false)
  }

  if (done) return <FinishScreen score={score} total={questions.length} onReplay={handleReplay} onExit={onExit}/>

  const q = questions[current]

  return (
    <div style={{ position:'fixed', inset:0, zIndex:9999, background:'radial-gradient(ellipse at 50% 35%,#1a1430 0%,#0a0a0f 100%)', color:'#fff', fontFamily:"'Segoe UI',system-ui,sans-serif", display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <style>{`
        @keyframes pgFloat      { 0%,100%{transform:translateY(0)}       50%{transform:translateY(-10px)} }
        @keyframes pgBounce     { 0%,100%{transform:scale(1)}            50%{transform:scale(1.06)} }
        @keyframes pgCorrectPic { 0%{transform:scale(1) rotate(0)} 30%{transform:scale(1.2) rotate(-6deg)} 60%{transform:scale(1.2) rotate(6deg)} 100%{transform:scale(1) rotate(0)} }
        @keyframes pgCorrectBtn { 0%{transform:scale(1)} 40%{transform:scale(1.08)} 100%{transform:scale(1)} }
        @keyframes pgWrongBtn   { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-9px)} 40%{transform:translateX(9px)} 60%{transform:translateX(-6px)} 80%{transform:translateX(6px)} }
        @keyframes pgSlideIn    { from{opacity:0;transform:scale(.88)} to{opacity:1;transform:scale(1)} }
        @keyframes pgSoundWave  { 0%,100%{transform:scaleY(.35)} 50%{transform:scaleY(1)} }
        @keyframes pgCursor     { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes pgFadeIn     { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* ── Top bar ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 20px', boxSizing:'border-box', flexShrink:0 }}>
        <button onClick={() => { window.speechSynthesis?.cancel(); onExit() }} style={topBtnStyle}>← All Games</button>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ fontSize:12, fontWeight:700, background:'rgba(255,255,255,.1)', borderRadius:20, padding:'5px 13px', letterSpacing:.5 }}>
            {CATEGORY_LABELS[category] || '🎮 Game'}
          </div>
          <div style={{ display:'flex', gap:6 }}>
            {questions.map((_,i)=>(
              <div key={i} style={{ width:11, height:11, borderRadius:'50%', background: i<current?'#10b981':i===current?'#f59e0b':'rgba(255,255,255,.18)', transition:'background .35s', boxShadow:i===current?'0 0 8px #f59e0b':'none' }}/>
            ))}
          </div>
          <div style={{ fontSize:14, fontWeight:700, background:'rgba(255,215,0,.12)', border:'1px solid rgba(255,215,0,.3)', borderRadius:20, padding:'5px 14px' }}>⭐ {score}</div>
        </div>
      </div>

      {/* ── Game content ── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:14, padding:'0 20px 8px', boxSizing:'border-box', overflow:'hidden' }}>

        <p style={{ fontSize:12, opacity:.4, letterSpacing:1.2, textTransform:'uppercase', margin:0 }}>
          Question {current+1} of {questions.length}
        </p>

        {/* Big emoji picture */}
        <div style={{ fontSize:96, lineHeight:1, animation:`${picAnim} ${picAnim==='pgBounce'?'2.2s ease-in-out infinite':'0.6s ease forwards'}`, filter:'drop-shadow(0 10px 20px rgba(255,255,255,.1))', userSelect:'none' }}>
          {q.emoji}
        </div>

        <div style={{ fontSize:17, fontWeight:700, background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.12)', borderRadius:50, padding:'9px 24px', letterSpacing:.3 }}>
          Which word matches this picture?
        </div>

        {/* Word options 2×2 */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, width:'100%', maxWidth:500 }}>
          {options.map((word, i) => {
            const isSelected = selected === word
            const isCorrect  = isSelected && result === 'correct'
            const isWrong    = isSelected && result === 'wrong'
            const isReveal   = selected !== null && word === q.word && result === 'wrong'
            return (
              <button key={word} onClick={() => handleSelect(word)} style={{
                padding:'16px 10px', borderRadius:16, border:'2px solid',
                fontSize:17, fontWeight:700, cursor:selected?'default':'pointer',
                transition:'background .25s, border-color .25s',
                animation: isCorrect?'pgCorrectBtn .45s ease': isWrong?'pgWrongBtn .45s ease':`pgSlideIn .4s ease ${i*.07}s both`,
                background: isCorrect||isReveal?'rgba(16,185,129,.22)': isWrong?'rgba(239,68,68,.22)':'rgba(255,255,255,.06)',
                borderColor: isCorrect||isReveal?'#10b981': isWrong?'#ef4444':'rgba(255,255,255,.16)',
                color:'#fff', letterSpacing:.3,
              }}>
                {(isCorrect||isReveal)&&'✅ '}{isWrong&&'❌ '}{word}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Pao speech bar ── */}
      <div style={{
        display:'flex', alignItems:'flex-end', gap:14,
        padding:'10px 18px 14px', boxSizing:'border-box', flexShrink:0,
        background:'rgba(255,255,255,.03)',
        borderTop:'1px solid rgba(255,255,255,.07)',
        animation:'pgFadeIn .5s ease',
      }}>
        {/* Pao mascot */}
        <div style={{ animation:'pgFloat 3s ease-in-out infinite', flexShrink:0 }}>
          <PandaMascot entered={true} mouthOpen={mouthOpen} pxWidth={115} pandaState="normal"/>
        </div>

        {/* Speech bubble */}
        <div style={{
          flex:1,
          background:'rgba(255,255,255,.07)',
          border:'1px solid rgba(255,255,255,.13)',
          borderRadius:'4px 18px 18px 18px',
          padding:'12px 16px',
          minHeight:64, maxHeight:90,
          overflowY:'auto',
          display:'flex', flexDirection:'column', justifyContent:'center',
          gap:6,
        }}>
          {/* Sound wave while talking */}
          {talking && (
            <div style={{ display:'flex', gap:3, alignItems:'center' }}>
              {[0,.1,.06,.16,.03,.12].map((d,i)=>(
                <div key={i} style={{ width:3, height:18, borderRadius:4, background:'rgba(168,130,255,.85)', animation:`pgSoundWave .55s ease-in-out ${d}s infinite` }}/>
              ))}
            </div>
          )}

          {/* Word-by-word text */}
          <div style={{ fontSize:14, fontWeight:600, lineHeight:1.55, color:'rgba(255,255,255,.92)' }}>
            {displayText
              ? <>
                  {displayText}
                  {talking && <span style={{ animation:'pgCursor .7s step-end infinite', marginLeft:2, color:'#b084ff' }}>|</span>}
                </>
              : <span style={{ color:'rgba(255,255,255,.3)', fontStyle:'italic', fontSize:13 }}>Pao is watching…</span>
            }
          </div>
        </div>
      </div>
    </div>
  )
}

const topBtnStyle = { background:'rgba(255,255,255,.07)', border:'1.5px solid rgba(255,255,255,.15)', color:'#fff', borderRadius:10, padding:'8px 18px', fontSize:13, fontWeight:700, cursor:'pointer' }
function actionBtn(bg) { return { background:bg, border:'none', color:'#fff', borderRadius:14, padding:'13px 28px', fontSize:16, fontWeight:700, cursor:'pointer' } }
