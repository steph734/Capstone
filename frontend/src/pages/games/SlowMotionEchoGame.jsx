import { useState, useEffect, useRef } from 'react'
import PandaMascot from './PandaMascot'
import { useAnalytics } from '../../context/AnalyticsContext'
import { createSessionId, createEventLogger } from '../../utils/gameplayLogger'

// ─── Word bank, grouped by in-game level ──────────────────────────────────────

const WORD_LEVELS = [
  { id: 1, label: 'Level 1', sub: '2-syllable words', words: [
    { word: 'table',  emoji: '🪑', syllables: ['ta', 'ble'] },
    { word: 'window', emoji: '🪟', syllables: ['win', 'dow'] },
    { word: 'monkey', emoji: '🐒', syllables: ['mon', 'key'] },
    { word: 'candle', emoji: '🕯️', syllables: ['can', 'dle'] },
    { word: 'pencil', emoji: '✏️', syllables: ['pen', 'cil'] },
  ]},
  { id: 2, label: 'Level 2', sub: '3-syllable words', words: [
    { word: 'butterfly', emoji: '🦋', syllables: ['but', 'ter', 'fly'] },
    { word: 'elephant',  emoji: '🐘', syllables: ['el', 'e', 'phant'] },
    { word: 'umbrella',  emoji: '☂️', syllables: ['um', 'brel', 'la'] },
    { word: 'banana',    emoji: '🍌', syllables: ['ba', 'na', 'na'] },
    { word: 'dinosaur',  emoji: '🦕', syllables: ['di', 'no', 'saur'] },
  ]},
  { id: 3, label: 'Level 3', sub: 'Tricky consonant blends', words: [
    { word: 'strawberry',  emoji: '🍓', syllables: ['straw', 'ber', 'ry'] },
    { word: 'spaghetti',   emoji: '🍝', syllables: ['spa', 'ghet', 'ti'] },
    { word: 'grasshopper', emoji: '🦗', syllables: ['grass', 'hop', 'per'] },
    { word: 'astronaut',   emoji: '🧑‍🚀', syllables: ['as', 'tro', 'naut'] },
    { word: 'sandwich',    emoji: '🥪', syllables: ['sand', 'wich'] },
  ]},
  { id: 4, label: 'Level 4', sub: 'Short phrases', words: [
    { word: 'big dog',   emoji: '🐕', syllables: ['big', 'dog'] },
    { word: 'red ball',  emoji: '🔴', syllables: ['red', 'ball'] },
    { word: 'blue car',  emoji: '🚙', syllables: ['blue', 'car'] },
    { word: 'my turtle', emoji: '🐢', syllables: ['my', 'tur', 'tle'] },
    { word: 'ice cream', emoji: '🍦', syllables: ['ice', 'cream'] },
  ]},
]

const PACE_PRESETS = [
  { id: 'slow',   label: 'Slow',         rate: 0.85, gapMs: 600 },
  { id: 'slower', label: 'Slower',       rate: 0.7,  gapMs: 750 },
  { id: 'turtle', label: 'Turtle-speed', rate: 0.55, gapMs: 900 },
]

const SYLLABLE_COLORS = ['#f59e0b', '#10b981', '#6366f1', '#ec4899', '#8b5cf6']

const CHEERS_FULL  = ['Wow! You said it perfectly! Yay!', 'Amazing! That was just right!', 'Super! You got every sound!', 'Fantastic job, speech star!']
const CHEERS_CLOSE = ['Nice try! Let us hear it once more!', 'So close! Listen again and try!', 'Good effort! One more time!']
const CHEERS_NONE  = ['That is okay! Let us try again together!', 'No worries! Listen closely and try!', 'Let us give it another go!']

const WORDS_PER_SESSION = 5

function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5) }

function normalize(s) { return (s || '').toLowerCase().replace(/[^a-z ]/g, '').trim() }

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0))
  for (let i = 0; i <= a.length; i++) dp[i][0] = i
  for (let j = 0; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1])
    }
  }
  return dp[a.length][b.length]
}

// Full match / close (fuzzy) match / no match — never a hard "wrong".
function matchTier(transcript, target) {
  const t = normalize(transcript)
  const w = normalize(target)
  if (!t) return 'none'
  if (t === w) return 'full'
  const dist = levenshtein(t, w)
  if (dist <= Math.max(1, Math.round(w.length * 0.3))) return 'close'
  return 'none'
}

function pgSpeak(text, { rate = 1, pitch = 1.6, onStart, onEnd, onWord } = {}) {
  if (!window.speechSynthesis) { onEnd?.(); return }
  window.speechSynthesis.cancel()
  const utt = new SpeechSynthesisUtterance(text)
  utt.rate = rate; utt.pitch = pitch; utt.volume = 1
  if (onStart) utt.onstart = onStart
  utt.onend = () => onEnd?.()
  utt.onerror = () => onEnd?.()
  if (onWord) utt.onboundary = (e) => { if (e.name === 'word') onWord(text.substring(0, e.charIndex + e.charLength)) }
  const go = () => {
    const voices = window.speechSynthesis.getVoices()
    const v = voices.find(v => v.lang.startsWith('en') && /zira/i.test(v.name)) ||
              voices.find(v => v.lang.startsWith('en') && /samantha/i.test(v.name)) ||
              voices.find(v => v.lang === 'en-US') ||
              voices.find(v => v.lang.startsWith('en')) || voices[0]
    if (v) utt.voice = v
    window.speechSynthesis.speak(utt)
  }
  if (window.speechSynthesis.getVoices().length > 0) go()
  else window.speechSynthesis.onvoiceschanged = go
}

function createRecognizer() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SR) return null
  const r = new SR()
  r.lang = 'en-US'
  r.continuous = false
  r.interimResults = false
  r.maxAlternatives = 1
  return r
}

// Plays each syllable in sequence with a pause between, calling onStepStart(i)
// as each one begins and speakStep(text, rate, onEnd) to actually voice it
// (the caller supplies this so Pao's mouth/speech-bubble state stays in sync).
// Returns a cancel function.
function playSyllableSequence(syllables, rate, gapMs, speakStep, onStepStart, onDone) {
  let cancelled = false
  const step = (i) => {
    if (cancelled) return
    if (i >= syllables.length) { onDone?.(); return }
    onStepStart(i)
    speakStep(syllables[i], rate, () => { if (cancelled) return; setTimeout(() => step(i + 1), gapMs) })
  }
  step(0)
  return () => { cancelled = true; window.speechSynthesis?.cancel() }
}

// ─── Setup screen ─────────────────────────────────────────────────────────────

function SetupScreen({ onStart }) {
  const [levelId, setLevelId]     = useState(1)
  const [paceId, setPaceId]       = useState('slow')
  const [scaffold, setScaffold]   = useState(true)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, padding: '20px', overflowY: 'auto' }}>
      <div style={{ fontSize: 56 }}>🐢</div>
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Slow-Motion Echo</h1>
      <p style={{ margin: 0, opacity: .6, fontSize: 13, textAlign: 'center', maxWidth: 420 }}>
        Listen to each word broken into syllables, nice and slow. Then say it back — no rush!
      </p>

      <div style={{ width: '100%', maxWidth: 460 }}>
        <div style={{ fontSize: 12, fontWeight: 700, opacity: .55, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Choose a level</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {WORD_LEVELS.map(lvl => (
            <button key={lvl.id} onClick={() => setLevelId(lvl.id)} style={{
              background: levelId === lvl.id ? 'rgba(20,184,166,.22)' : 'rgba(255,255,255,.06)',
              border: `2px solid ${levelId === lvl.id ? '#14b8a6' : 'rgba(255,255,255,.14)'}`,
              borderRadius: 14, padding: '12px 10px', cursor: 'pointer', textAlign: 'left', color: '#fff',
            }}>
              <div style={{ fontWeight: 800, fontSize: 14 }}>{lvl.label}</div>
              <div style={{ fontSize: 11.5, opacity: .65, marginTop: 2 }}>{lvl.sub}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ width: '100%', maxWidth: 460 }}>
        <div style={{ fontSize: 12, fontWeight: 700, opacity: .55, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Pacing</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {PACE_PRESETS.map(p => (
            <button key={p.id} onClick={() => setPaceId(p.id)} style={{
              background: paceId === p.id ? '#14b8a6' : 'rgba(255,255,255,.06)',
              border: `2px solid ${paceId === p.id ? '#14b8a6' : 'rgba(255,255,255,.14)'}`,
              color: '#fff', borderRadius: 20, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: 'rgba(255,255,255,.06)', border: '1.5px solid rgba(255,255,255,.14)', borderRadius: 14, padding: '10px 16px', maxWidth: 460, width: '100%' }}>
        <input type="checkbox" checked={scaffold} onChange={e => setScaffold(e.target.checked)} style={{ width: 18, height: 18 }}/>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Echo one syllable at a time</div>
          <div style={{ fontSize: 11, opacity: .6, marginTop: 1 }}>Turn off if your child is ready to echo the whole word at once</div>
        </div>
      </label>

      <button onClick={() => onStart({ levelId, paceId, scaffold })} style={{ background: '#14b8a6', border: 'none', color: '#fff', borderRadius: 16, padding: '14px 36px', fontSize: 16, fontWeight: 800, cursor: 'pointer', marginTop: 4 }}>
        Let's Go! 🐢
      </button>
    </div>
  )
}

// ─── Echo Master badge SVG ────────────────────────────────────────────────────

function EchoMasterBadge({ size = 120, animate = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" style={{ filter: 'drop-shadow(0 0 18px rgba(20,184,166,.55))', animation: animate ? 'seBadgePop .7s cubic-bezier(.34,1.56,.64,1) both' : 'none' }}>
      <defs>
        <radialGradient id="ebBg" cx="40%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#5eead4"/>
          <stop offset="60%" stopColor="#0d9488"/>
          <stop offset="100%" stopColor="#134e4a"/>
        </radialGradient>
        <linearGradient id="ebRing" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#99f6e4"/>
          <stop offset="100%" stopColor="#14b8a6"/>
        </linearGradient>
        <radialGradient id="ebShine" cx="30%" cy="25%" r="60%">
          <stop offset="0%" stopColor="rgba(255,255,255,.45)"/>
          <stop offset="100%" stopColor="rgba(255,255,255,0)"/>
        </radialGradient>
      </defs>
      <circle cx="60" cy="60" r="57" fill="none" stroke="url(#ebRing)" strokeWidth="4"/>
      <circle cx="60" cy="60" r="54" fill="url(#ebBg)"/>
      <circle cx="60" cy="60" r="54" fill="url(#ebShine)"/>
      {/* Megaphone body */}
      <path d="M 38,50 L 58,38 L 58,82 L 38,70 Z" fill="#f0fdfa"/>
      <rect x="30" y="50" width="8" height="20" rx="2" fill="#ccfbf1"/>
      <path d="M 58,38 Q 82,30 88,20 L 88,100 Q 82,90 58,82 Z" fill="#ecfeff" opacity=".92"/>
      {/* Sound waves */}
      <path d="M 96,42 Q 104,60 96,78" fill="none" stroke="#f0fdfa" strokeWidth="4" strokeLinecap="round" opacity=".85"/>
      <path d="M 104,32 Q 116,60 104,88" fill="none" stroke="#f0fdfa" strokeWidth="4" strokeLinecap="round" opacity=".6"/>
    </svg>
  )
}

// ─── Finish screen ────────────────────────────────────────────────────────────

const BADGE_SCRIPT = `Wow! You just earned the ECHO MASTER badge! Every single syllable, nice and clear, across every level! That Echo Scarf is all yours now! Go to the Customize page and try it on! Teehee!`

function FinishScreen({ tally, total, onReplay, onExit, badgeEarned, levelsMastered, totalLevels }) {
  const pct = total ? tally.full / total : 0
  const stars = pct >= 0.7 ? 3 : pct >= 0.4 ? 2 : 1
  const msg = stars === 3 ? 'Amazing echoing! Your sounds are getting so clear!'
    : stars === 2 ? 'Great practice! You are getting stronger every time!'
    : 'Good try today! Slow and steady practice really helps!'

  const [phase, setPhase] = useState('score') // 'score' | 'badge'
  const [talking, setTalking] = useState(false)
  const [mouthOpen, setMouthOpen] = useState(false)
  const [displayText, setDisplayText] = useState('')
  const mouthRef = useRef(null)

  useEffect(() => {
    if (talking) mouthRef.current = setInterval(() => setMouthOpen(p => !p), 155)
    else { clearInterval(mouthRef.current); setMouthOpen(false) }
    return () => clearInterval(mouthRef.current)
  }, [talking])

  // Let the score sink in first, then reveal the badge — same beat as Word Wizard.
  useEffect(() => {
    if (!badgeEarned) return
    const t = setTimeout(() => setPhase('badge'), 1600)
    return () => clearTimeout(t)
  }, [badgeEarned])

  useEffect(() => {
    if (phase !== 'badge') return
    const t = setTimeout(() => {
      pgSpeak(BADGE_SCRIPT, {
        rate: 1.05, pitch: 1.6,
        onStart: () => setTalking(true),
        onEnd: () => setTalking(false),
        onWord: (p) => setDisplayText(p),
      })
    }, 500)
    return () => clearTimeout(t)
  }, [phase]) // eslint-disable-line

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 20, position: 'relative', overflow: 'hidden', width: '100%' }}>

      {/* Confetti particles (badge phase only) */}
      {phase === 'badge' && ['#14b8a6', '#5eead4', '#fbbf24', '#a78bfa', '#f472b6'].map((c, i) => (
        Array.from({ length: 3 }, (_, j) => (
          <div key={`${i}-${j}`} style={{ position: 'absolute', top: 0, left: `${10 + i * 18 + j * 5}%`, width: 8, height: 8, borderRadius: 2, background: c, animation: `seConfetti ${1.4 + j * .3}s ease-in ${i * .1 + j * .15}s both`, pointerEvents: 'none', transform: 'rotate(45deg)' }}/>
        ))
      ))}

      <div style={{ animation: 'seFloat 2.5s ease-in-out infinite' }}>
        <PandaMascot entered={true} mouthOpen={mouthOpen} pxWidth={140}/>
      </div>
      <div style={{ display: 'flex', gap: 6, fontSize: 34 }}>
        {Array.from({ length: 3 }, (_, i) => <span key={i} style={{ opacity: i < stars ? 1 : .2, filter: i < stars ? 'none' : 'grayscale(1)' }}>⭐</span>)}
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{tally.full} / {total} words said perfectly!</h1>
      <p style={{ fontSize: 13, opacity: .65, maxWidth: 420, textAlign: 'center', margin: 0 }}>{msg}</p>
      <div style={{ display: 'flex', gap: 10, fontSize: 12, opacity: .8 }}>
        <span style={{ background: 'rgba(16,185,129,.15)', border: '1px solid rgba(16,185,129,.3)', borderRadius: 10, padding: '4px 10px' }}>✅ {tally.full} perfect</span>
        <span style={{ background: 'rgba(245,158,11,.15)', border: '1px solid rgba(245,158,11,.3)', borderRadius: 10, padding: '4px 10px' }}>🌤️ {tally.close} close</span>
        <span style={{ background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.15)', borderRadius: 10, padding: '4px 10px' }}>🔁 {tally.none} practiced</span>
      </div>

      {/* Pao speech bubble — only while narrating the badge congrats */}
      {phase === 'badge' && (
        <div style={{ maxWidth: 480, width: '90%', background: 'rgba(255,255,255,.07)', border: '1.5px solid rgba(255,255,255,.13)', borderRadius: '4px 18px 18px 18px', padding: '10px 16px', minHeight: 48, animation: 'seFadeIn .4s ease' }}>
          {talking && (
            <div style={{ display: 'flex', gap: 3, alignItems: 'center', marginBottom: 6 }}>
              {[0, .1, .05, .15, .02].map((d, i) => (
                <div key={i} style={{ width: 3, height: 12, borderRadius: 4, background: 'rgba(94,234,212,.85)', animation: `seWave .5s ease-in-out ${d}s infinite` }}/>
              ))}
            </div>
          )}
          <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,.9)', lineHeight: 1.55 }}>
            {displayText || <span style={{ color: 'rgba(255,255,255,.3)', fontStyle: 'italic', fontSize: 13 }}>Pao is celebrating!</span>}
          </div>
        </div>
      )}

      {/* Badge reveal */}
      {phase === 'badge' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, animation: 'seBadgeCardIn .6s cubic-bezier(.34,1.56,.64,1) both', background: 'rgba(20,184,166,.1)', border: '2px solid rgba(20,184,166,.35)', borderRadius: 24, padding: '16px 32px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(94,234,212,.8)', letterSpacing: 1.5, textTransform: 'uppercase' }}>🎉 Badge Earned!</div>
          <div style={{ animation: 'seBadgeGlow 2s ease-in-out infinite' }}>
            <EchoMasterBadge size={100} animate={true}/>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#5eead4' }}>Echo Master</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', marginTop: 3 }}>Every syllable, said clearly, across all {totalLevels} levels!</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(20,184,166,.12)', border: '1px solid rgba(20,184,166,.3)', borderRadius: 10, padding: '6px 14px', fontSize: 12, color: '#99f6e4', fontWeight: 600 }}>
            🧣 Echo Scarf unlocked in Customize Pao!
          </div>
        </div>
      )}
      {phase !== 'badge' && !badgeEarned && levelsMastered > 0 && levelsMastered < totalLevels && (
        <div style={{ fontSize: 12, color: 'rgba(94,234,212,.75)', background: 'rgba(20,184,166,.08)', border: '1px solid rgba(20,184,166,.25)', borderRadius: 20, padding: '6px 16px' }}>
          🔊 {levelsMastered}/{totalLevels} levels said perfectly clear — keep going for the Echo Master badge!
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <button onClick={onReplay} style={{ background: '#14b8a6', border: 'none', color: '#fff', borderRadius: 14, padding: '13px 28px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>Play Again 🐢</button>
        <button onClick={onExit} style={{ background: '#374151', border: 'none', color: '#fff', borderRadius: 14, padding: '13px 28px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>← All Games</button>
      </div>
    </div>
  )
}

// ─── Main game ────────────────────────────────────────────────────────────────

export default function SlowMotionEchoGame({ onExit, patientId = 'alvrin', exerciseId = 'slow-motion-echo', domain = 'Speech' }) {
  const [settings, setSettings] = useState(null) // { levelId, paceId, scaffold }
  const [words, setWords]       = useState([])
  const [current, setCurrent]   = useState(0)
  const [stage, setStage]       = useState('narrate') // narrate | echo-syllable | your-turn | feedback
  const [syllableIdx, setSyllableIdx] = useState(-1)
  const [echoStep, setEchoStep] = useState(0) // which syllable is being echoed in scaffold mode
  const [listening, setListening] = useState(false)
  const [feedback, setFeedback] = useState(null) // { tier, transcript }
  const [micSupported] = useState(() => !!(window.SpeechRecognition || window.webkitSpeechRecognition))
  const [done, setDone] = useState(false)
  const [badgeEarned, setBadgeEarned] = useState(false)
  const [levelsMastered, setLevelsMastered] = useState(0)

  // Pao's speech state — mascot + speech bubble stay in sync with whatever
  // is being narrated (syllables, the whole word, or a cheer line).
  const [talking,     setTalking]     = useState(false)
  const [mouthOpen,   setMouthOpen]   = useState(false)
  const [displayText, setDisplayText] = useState('')
  const mouthRef = useRef(null)

  const tallyRef       = useRef({ full: 0, close: 0, none: 0 })
  const finalTierRef   = useRef([]) // final (post-retry) tier per word index — clarity, not attempt count
  const missedSyllablesRef = useRef({})
  const cancelSeqRef    = useRef(null)
  const recognizerRef   = useRef(null)
  const listenStartRef  = useRef(null)

  const { submitEventBatch } = useAnalytics()
  const sessionIdRef     = useRef(createSessionId())
  const loggerRef        = useRef(createEventLogger({ patientId, exerciseId, sessionId: sessionIdRef.current, domain, onFlush: submitEventBatch }))
  const promptShownAtRef = useRef(null)
  const sessionEndedRef  = useRef(false)

  const logExitOnce = () => {
    if (sessionEndedRef.current) return
    sessionEndedRef.current = true
    loggerRef.current.log('exit', {})
  }

  /* mouth toggle while talking */
  useEffect(() => {
    if (talking) mouthRef.current = setInterval(() => setMouthOpen(p => !p), 155)
    else { clearInterval(mouthRef.current); setMouthOpen(false) }
    return () => clearInterval(mouthRef.current)
  }, [talking])

  useEffect(() => () => {
    cancelSeqRef.current?.()
    recognizerRef.current?.abort?.()
    window.speechSynthesis?.cancel()
    logExitOnce()
  }, []) // eslint-disable-line

  const speak = (text, { rate = 1.1, onEnd } = {}) => {
    setDisplayText('')
    pgSpeak(text, {
      rate, pitch: 1.6,
      onStart: () => setTalking(true),
      onEnd:   () => { setTalking(false); onEnd?.() },
      onWord:  (partial) => setDisplayText(partial),
    })
  }

  const pace = PACE_PRESETS.find(p => p.id === settings?.paceId) || PACE_PRESETS[0]
  const word = words[current]

  const startWord = () => {
    if (!word) return
    setStage('narrate')
    setSyllableIdx(-1)
    setEchoStep(0)
    setFeedback(null)
    promptShownAtRef.current = Date.now()
    loggerRef.current.log('prompt_shown', {})
    cancelSeqRef.current = playSyllableSequence(
      word.syllables, pace.rate, pace.gapMs,
      (text, rate, onDone) => speak(text, { rate, onEnd: onDone }),
      (i) => setSyllableIdx(i),
      () => {
        setTimeout(() => {
          speak(word.word, { rate: pace.rate * 1.05, onEnd: () => {
            if (settings.scaffold) setStage('echo-syllable')
            else setStage('your-turn')
          }})
        }, pace.gapMs)
      }
    )
  }

  useEffect(() => {
    if (settings && words.length) startWord()
    return () => cancelSeqRef.current?.()
  }, [current, words]) // eslint-disable-line

  const replayWord = () => {
    cancelSeqRef.current?.()
    startWord()
  }

  // Speech recognition can hang with no callback at all — no mic device, an
  // ignored permission prompt, or a child who just stays quiet. A hard
  // timeout guarantees the game always moves forward instead of leaving the
  // mic spinning forever.
  const LISTEN_TIMEOUT_MS = 6000

  const listenFor = (onResult) => {
    const recognizer = createRecognizer()
    if (!recognizer) { onResult({ transcript: '', confidence: null }); return }
    recognizerRef.current = recognizer
    listenStartRef.current = Date.now()
    setListening(true)
    let settled = false
    const finish = (result) => {
      if (settled) return
      settled = true
      clearTimeout(timeoutId)
      setListening(false)
      onResult(result)
    }
    recognizer.onresult = (e) => {
      const alt = e.results[0]?.[0]
      finish({ transcript: alt?.transcript || '', confidence: alt?.confidence ?? null })
    }
    recognizer.onerror = () => finish({ transcript: '', confidence: null })
    recognizer.onend   = () => finish({ transcript: '', confidence: null })
    const timeoutId = setTimeout(() => { recognizer.abort?.(); finish({ transcript: '', confidence: null }) }, LISTEN_TIMEOUT_MS)
    try { recognizer.start() } catch { finish({ transcript: '', confidence: null }) }
  }

  const handleEchoSyllable = () => {
    listenFor(() => {
      // Low-stakes practice step — no scoring, just move the child forward.
      setTimeout(() => {
        if (echoStep + 1 >= word.syllables.length) setStage('your-turn')
        else setEchoStep(s => s + 1)
      }, 400)
    })
  }

  const handleYourTurn = () => {
    listenFor(({ transcript, confidence }) => {
      const tier = transcript ? matchTier(transcript, word.word) : 'none'
      const voiceDurationMs = listenStartRef.current ? Date.now() - listenStartRef.current : null
      const responseTimeMs = promptShownAtRef.current ? Date.now() - promptShownAtRef.current : null

      tallyRef.current[tier] += 1
      finalTierRef.current[current] = tier
      if (tier === 'none') {
        word.syllables.forEach(syl => { missedSyllablesRef.current[syl] = (missedSyllablesRef.current[syl] || 0) + 1 })
      }

      loggerRef.current.log('response_given', {
        responseTimeMs, isCorrect: tier !== 'none', inputMethod: 'voice',
        sttConfidenceScore: confidence, voiceDurationMs,
      })

      setFeedback({ tier, transcript })
      setStage('feedback')

      const line = tier === 'full' ? CHEERS_FULL[Math.floor(Math.random() * CHEERS_FULL.length)]
        : tier === 'close' ? CHEERS_CLOSE[Math.floor(Math.random() * CHEERS_CLOSE.length)]
        : CHEERS_NONE[Math.floor(Math.random() * CHEERS_NONE.length)]
      speak(line, { rate: 1.05 })
    })
  }

  const handleManualMark = (worked) => {
    const tier = worked ? 'full' : 'none'
    tallyRef.current[tier] += 1
    finalTierRef.current[current] = tier
    if (!worked) word.syllables.forEach(syl => { missedSyllablesRef.current[syl] = (missedSyllablesRef.current[syl] || 0) + 1 })
    const responseTimeMs = promptShownAtRef.current ? Date.now() - promptShownAtRef.current : null
    loggerRef.current.log('response_given', { responseTimeMs, isCorrect: worked, inputMethod: 'voice' })
    setFeedback({ tier, transcript: '' })
    setStage('feedback')
    speak(worked ? CHEERS_FULL[0] : CHEERS_NONE[0], { rate: 1.05 })
  }

  const nextWord = () => {
    if (current + 1 >= words.length) {
      finishSession()
    } else {
      setCurrent(c => c + 1)
    }
  }

  const finishSession = () => {
    logExitOnce()
    try {
      const key = 'pao_echo_sessions'
      const sessions = JSON.parse(localStorage.getItem(key) || '[]')
      const hardest = Object.entries(missedSyllablesRef.current).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([syl]) => syl)
      sessions.push({
        patientId, date: new Date().toISOString(), levelId: settings.levelId, paceId: settings.paceId,
        scaffold: settings.scaffold, wordsAttempted: words.length,
        fullMatches: tallyRef.current.full, closeMatches: tallyRef.current.close, noMatches: tallyRef.current.none,
        hardestSounds: hardest,
      })
      localStorage.setItem(key, JSON.stringify(sessions.slice(-100)))
    } catch {}

    // Echo Master rewards clarity, not speed or first-try luck: every word in
    // the session must land on a clean 'full' echo by the time the child moves
    // on (retries are fine — matchTier is re-checked and overwrites the entry
    // each time). Earning it requires that clean sweep on every level, mirroring
    // how Word Master needs all 4 word categories rather than just one round.
    try {
      const allWordsClear = words.length > 0
        && finalTierRef.current.length === words.length
        && finalTierRef.current.every(t => t === 'full')

      const perfectKey = 'pao_echo_perfect_levels'
      let perfected = JSON.parse(localStorage.getItem(perfectKey) || '[]')
      if (allWordsClear && !perfected.includes(settings.levelId)) {
        perfected = [...perfected, settings.levelId]
        localStorage.setItem(perfectKey, JSON.stringify(perfected))
      }
      setLevelsMastered(perfected.length)

      const hasAllLevels = WORD_LEVELS.every(l => perfected.includes(l.id))
      if (hasAllLevels) {
        const earned = JSON.parse(localStorage.getItem('pao_badges') || '[]')
        if (!earned.includes('Echo Master')) {
          localStorage.setItem('pao_badges', JSON.stringify([...earned, 'Echo Master']))
          setBadgeEarned(true)
        }
      }
    } catch {}

    setDone(true)
  }

  const handleStart = (opts) => {
    const pool = WORD_LEVELS.find(l => l.id === opts.levelId)?.words || WORD_LEVELS[0].words
    setWords(shuffle(pool).slice(0, WORDS_PER_SESSION))
    setCurrent(0)
    tallyRef.current = { full: 0, close: 0, none: 0 }
    finalTierRef.current = []
    missedSyllablesRef.current = {}
    sessionEndedRef.current = false
    setSettings(opts)
  }

  const handleReplaySession = () => {
    sessionIdRef.current = createSessionId()
    loggerRef.current = createEventLogger({ patientId, exerciseId, sessionId: sessionIdRef.current, domain, onFlush: submitEventBatch })
    setDone(false)
    setBadgeEarned(false)
    setSettings(null)
    setWords([])
  }

  const handleExit = () => {
    logExitOnce()
    window.speechSynthesis?.cancel()
    onExit()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'radial-gradient(ellipse at 50% 35%,#1a1430 0%,#0a0a0f 100%)', color: '#fff', fontFamily: "'Segoe UI',system-ui,sans-serif", display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <style>{`
        @keyframes seFloat    { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes sePulse    { 0%,100%{box-shadow:0 0 0 0 rgba(20,184,166,.5)} 50%{box-shadow:0 0 0 14px rgba(20,184,166,0)} }
        @keyframes seSyllable { 0%{transform:scale(1)} 40%{transform:scale(1.16)} 100%{transform:scale(1)} }
        @keyframes seFadeIn   { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes seWave     { 0%,100%{transform:scaleY(.3)} 50%{transform:scaleY(1)} }
        @keyframes seBadgePop { 0%{transform:scale(0) rotate(-15deg)} 65%{transform:scale(1.18) rotate(4deg)} 85%{transform:scale(.95) rotate(-2deg)} 100%{transform:scale(1) rotate(0)} }
        @keyframes seBadgeCardIn { from{opacity:0;transform:scale(.85) translateY(12px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes seBadgeGlow   { 0%,100%{filter:drop-shadow(0 0 12px rgba(20,184,166,.5))} 50%{filter:drop-shadow(0 0 28px rgba(20,184,166,.9))} }
        @keyframes seConfetti    { 0%{transform:translateY(-20px) rotate(0deg);opacity:1} 100%{transform:translateY(80px) rotate(360deg);opacity:0} }
      `}</style>

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', flexShrink: 0 }}>
        <button onClick={handleExit} style={{ background: 'rgba(255,255,255,.07)', border: '1.5px solid rgba(255,255,255,.15)', color: '#fff', borderRadius: 10, padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          ← All Games
        </button>
        {settings && !done && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, background: 'rgba(20,184,166,.15)', border: '1px solid rgba(20,184,166,.35)', borderRadius: 20, padding: '5px 13px' }}>
              🐢 {WORD_LEVELS.find(l => l.id === settings.levelId)?.label} · {PACE_PRESETS.find(p => p.id === settings.paceId)?.label}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {words.map((_, i) => (
                <div key={i} style={{ width: 11, height: 11, borderRadius: '50%', background: i < current ? '#10b981' : i === current ? '#14b8a6' : 'rgba(255,255,255,.18)', boxShadow: i === current ? '0 0 8px #14b8a6' : 'none' }}/>
              ))}
            </div>
          </div>
        )}
      </div>

      {!settings && <SetupScreen onStart={handleStart}/>}

      {settings && done && (
        <FinishScreen
          tally={tallyRef.current} total={words.length} onReplay={handleReplaySession} onExit={handleExit}
          badgeEarned={badgeEarned} levelsMastered={levelsMastered} totalLevels={WORD_LEVELS.length}
        />
      )}

      {settings && !done && word && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, padding: '0 20px 8px', overflow: 'hidden' }}>
          <p style={{ fontSize: 12, opacity: .4, letterSpacing: 1.2, textTransform: 'uppercase', margin: 0 }}>Word {current + 1} of {words.length}</p>

          <div style={{ fontSize: 84, lineHeight: 1, filter: 'drop-shadow(0 10px 20px rgba(255,255,255,.1))' }}>{word.emoji}</div>

          {/* Syllable blocks */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            {word.syllables.map((syl, i) => {
              const isActive = stage === 'narrate' && syllableIdx === i
              const isEchoTarget = stage === 'echo-syllable' && echoStep === i
              return (
                <div key={i} style={{
                  background: SYLLABLE_COLORS[i % SYLLABLE_COLORS.length] + (isActive || isEchoTarget ? 'ff' : '33'),
                  border: `2px solid ${SYLLABLE_COLORS[i % SYLLABLE_COLORS.length]}`,
                  color: isActive || isEchoTarget ? '#1a1430' : '#fff',
                  borderRadius: 14, padding: '10px 20px', fontSize: 22, fontWeight: 800,
                  animation: (isActive || isEchoTarget) ? 'seSyllable .5s ease' : 'none',
                  transition: 'background .2s, color .2s',
                }}>
                  {syl}
                </div>
              )
            })}
          </div>

          <button onClick={replayWord} style={{ background: 'rgba(255,255,255,.08)', border: '1.5px solid rgba(255,255,255,.18)', color: '#fff', borderRadius: 20, padding: '7px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            🔁 Replay
          </button>

          {/* Stage-specific UI */}
          {stage === 'narrate' && (
            <p style={{ fontSize: 13, opacity: .55, margin: 0 }}>Listen closely… here comes the word!</p>
          )}

          {stage === 'echo-syllable' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, animation: 'seFadeIn .3s ease' }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Say: <span style={{ color: SYLLABLE_COLORS[echoStep % SYLLABLE_COLORS.length] }}>{word.syllables[echoStep]}</span></div>
              {micSupported ? (
                <button onClick={handleEchoSyllable} disabled={listening} style={{
                  width: 76, height: 76, borderRadius: '50%', background: listening ? '#10b981' : '#14b8a6',
                  border: 'none', color: '#fff', fontSize: 30, cursor: listening ? 'default' : 'pointer',
                  animation: listening ? 'sePulse 1.2s ease-in-out infinite' : 'none',
                }}>🎤</button>
              ) : (
                <button onClick={() => { if (echoStep + 1 >= word.syllables.length) setStage('your-turn'); else setEchoStep(s => s + 1) }} style={miniBtnStyle}>
                  ✅ I said it — Next
                </button>
              )}
            </div>
          )}

          {stage === 'your-turn' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, animation: 'seFadeIn .3s ease' }}>
              <div style={{ fontSize: 17, fontWeight: 800 }}>Your turn! Put it all together 🌟</div>
              {micSupported ? (
                <button onClick={handleYourTurn} disabled={listening} style={{
                  width: 92, height: 92, borderRadius: '50%', background: listening ? '#10b981' : '#14b8a6',
                  border: 'none', color: '#fff', fontSize: 36, cursor: listening ? 'default' : 'pointer',
                  animation: listening ? 'sePulse 1.2s ease-in-out infinite' : 'none',
                }}>🎤</button>
              ) : (
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => handleManualMark(true)} style={miniBtnStyle}>✅ I said it!</button>
                  <button onClick={() => handleManualMark(false)} style={{ ...miniBtnStyle, background: 'rgba(255,255,255,.08)' }}>🔁 Try again</button>
                </div>
              )}
              {listening && (
                <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                  {[0, .1, .06, .16, .03].map((d, i) => (
                    <div key={i} style={{ width: 4, height: 20, borderRadius: 4, background: 'rgba(20,184,166,.85)', animation: `seWave .5s ease-in-out ${d}s infinite` }}/>
                  ))}
                </div>
              )}
            </div>
          )}

          {stage === 'feedback' && feedback && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, animation: 'seFadeIn .3s ease' }}>
              <div style={{
                fontSize: 15, fontWeight: 800, borderRadius: 14, padding: '10px 22px',
                background: feedback.tier === 'full' ? 'rgba(16,185,129,.18)' : feedback.tier === 'close' ? 'rgba(245,158,11,.18)' : 'rgba(255,255,255,.08)',
                border: `2px solid ${feedback.tier === 'full' ? '#10b981' : feedback.tier === 'close' ? '#f59e0b' : 'rgba(255,255,255,.2)'}`,
              }}>
                {feedback.tier === 'full' ? '🎉 Perfect!' : feedback.tier === 'close' ? '🌤️ So close!' : '💛 Nice try!'}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                {feedback.tier !== 'full' && (
                  <button onClick={() => { setStage('your-turn'); setFeedback(null) }} style={miniBtnStyle}>🔁 Try Again</button>
                )}
                <button onClick={nextWord} style={{ ...miniBtnStyle, background: '#14b8a6' }}>
                  {current + 1 >= words.length ? 'Finish 🏁' : 'Next Word →'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Pao speech bar */}
        <div style={{
          display: 'flex', alignItems: 'flex-end', gap: 14,
          padding: '10px 18px 14px', flexShrink: 0,
          background: 'rgba(255,255,255,.03)', borderTop: '1px solid rgba(255,255,255,.07)',
          animation: 'seFadeIn .5s ease',
        }}>
          <div style={{ animation: 'seFloat 3s ease-in-out infinite', flexShrink: 0 }}>
            <PandaMascot entered={true} mouthOpen={mouthOpen} pxWidth={110} pandaState="normal"/>
          </div>
          <div style={{
            flex: 1, background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.13)',
            borderRadius: '4px 18px 18px 18px', padding: '12px 16px', minHeight: 60, maxHeight: 84,
            overflowY: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6,
          }}>
            {talking && (
              <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                {[0, .1, .06, .16, .03, .12].map((d, i) => (
                  <div key={i} style={{ width: 3, height: 16, borderRadius: 4, background: 'rgba(20,184,166,.85)', animation: `seWave .55s ease-in-out ${d}s infinite` }}/>
                ))}
              </div>
            )}
            <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.5, color: 'rgba(255,255,255,.92)' }}>
              {displayText || <span style={{ color: 'rgba(255,255,255,.3)', fontStyle: 'italic', fontSize: 12 }}>Pao is listening…</span>}
            </div>
          </div>
        </div>
        </div>
      )}
    </div>
  )
}

const miniBtnStyle = { background: 'rgba(255,255,255,.1)', border: '1.5px solid rgba(255,255,255,.2)', color: '#fff', borderRadius: 14, padding: '11px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }
