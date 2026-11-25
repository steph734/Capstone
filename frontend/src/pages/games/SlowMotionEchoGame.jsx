import { useState, useEffect, useRef } from 'react'
import { useAnalytics } from '../../context/AnalyticsContext'
import { createSessionId, createEventLogger } from '../../utils/gameplayLogger'
import { ECHO_GAME_LINES, pickLine, pickRandomLine } from '../../utils/paoLines'
import { pickBrowserVoiceForLang } from '../../utils/paoLanguage'
import { fetchGameBadge } from '../../utils/gameProgress'
import { useGameSession } from '../../hooks/useGameSession'
import { EcSky, ArrowLeft, ArrowRight, CheckI, Mic, Replay, Speaker, StarI, TurtleIcon } from '../../components/echo-game/echoUi'
import { EchoPicture } from '../../components/echo-game/echoArt'
import { PaoBubble, PaoStage, useEchoPao } from '../../components/echo-game/EchoPao'
import { ResultsScreen, SetupScreen } from '../../components/echo-game/EchoScreens'
import usePwStage from '../../components/picture-word-game/usePwStage'
import { PAO_PROP_CSS } from '../../games/echo/PaoProps'
import { PAO_PROP_CSS as PICTURE_WORD_PROP_CSS } from '../../games/pictureWord/PaoProps'
import { STREAK_EVERY } from '../../games/echo/paoReactions'
import '../../components/echo-game/echo.css'

// ─── Word bank, grouped by in-game level (words and syllable splits are unchanged) ───────────────────────────

const WORD_LEVELS = [
  { id: 1, label: 'Level 1', sub: '2-syllable words', words: [
    { word: 'table',  syllables: ['ta', 'ble'] },
    { word: 'window', syllables: ['win', 'dow'] },
    { word: 'monkey', syllables: ['mon', 'key'] },
    { word: 'candle', syllables: ['can', 'dle'] },
    { word: 'pencil', syllables: ['pen', 'cil'] },
  ]},
  { id: 2, label: 'Level 2', sub: '3-syllable words', words: [
    { word: 'butterfly', syllables: ['but', 'ter', 'fly'] },
    { word: 'elephant',  syllables: ['el', 'e', 'phant'] },
    { word: 'umbrella',  syllables: ['um', 'brel', 'la'] },
    { word: 'banana',    syllables: ['ba', 'na', 'na'] },
    { word: 'dinosaur',  syllables: ['di', 'no', 'saur'] },
  ]},
  { id: 3, label: 'Level 3', sub: 'Tricky consonant blends', words: [
    { word: 'strawberry',  syllables: ['straw', 'ber', 'ry'] },
    { word: 'spaghetti',   syllables: ['spa', 'ghet', 'ti'] },
    { word: 'grasshopper', syllables: ['grass', 'hop', 'per'] },
    { word: 'astronaut',   syllables: ['as', 'tro', 'naut'] },
    { word: 'sandwich',    syllables: ['sand', 'wich'] },
  ]},
  { id: 4, label: 'Level 4', sub: 'Short phrases', words: [
    { word: 'big dog',   syllables: ['big', 'dog'] },
    { word: 'red ball',  syllables: ['red', 'ball'] },
    { word: 'blue car',  syllables: ['blue', 'car'] },
    { word: 'my turtle', syllables: ['my', 'tur', 'tle'] },
    { word: 'ice cream', syllables: ['ice', 'cream'] },
  ]},
]

const PACE_PRESETS = [
  { id: 'slow',   label: 'Slow',         rate: 0.85, gapMs: 600 },
  { id: 'slower', label: 'Slower',       rate: 0.7,  gapMs: 750 },
  { id: 'turtle', label: 'Turtle-speed', rate: 0.55, gapMs: 900 },
]

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

function pgSpeak(text, { rate = 1, pitch = 1.6, lang = 'en', onStart, onEnd, onWord } = {}) {
  if (!window.speechSynthesis) { onEnd?.(); return }
  window.speechSynthesis.cancel()
  const utt = new SpeechSynthesisUtterance(text)
  utt.rate = rate; utt.pitch = pitch; utt.volume = 1
  if (onStart) utt.onstart = onStart
  utt.onend = () => onEnd?.()
  utt.onerror = () => onEnd?.()
  if (onWord) utt.onboundary = (e) => { if (e.name === 'word') onWord(text.substring(0, e.charIndex + e.charLength)) }
  const go = () => {
    // The practice words themselves are always spoken as English (they're the
    // literal exercise content) — only Pao's coaching lines use `lang` to pick
    // a matching voice, when the language picker chose something other than English.
    const v = pickBrowserVoiceForLang(window.speechSynthesis.getVoices(), lang)
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

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)
const hyphen = (syl) => cap(syl.join('-'))

// ─── Main game ────────────────────────────────────────────────────────────────

export default function SlowMotionEchoGame({ onExit, patientId = 'alvrin', patientEmail = null, exerciseId = 'slow-motion-echo', domain = 'Speech', lang = 'en', preview = false, patientName = 'friend' }) {
  const gameSession = useGameSession({ gameName: 'Slow-Motion Echo' })
  const stageBox = usePwStage()
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
  const [realBadge, setRealBadge] = useState(null)
  const [levelsMastered, setLevelsMastered] = useState(0)
  const [wordPaceId, setWordPaceId] = useState('slow') // "Hear it slower" moves this one step slower, for this word only
  const [resultInfo, setResultInfo] = useState(null)
  const [announce, setAnnounce] = useState('')
  const [finishLine, setFinishLine] = useState('')

  const tallyRef       = useRef({ full: 0, close: 0, none: 0 })
  const finalTierRef   = useRef([]) // final (post-retry) tier per word index — clarity, not attempt count
  const missedSyllablesRef = useRef({})
  const cancelSeqRef    = useRef(null)
  const recognizerRef   = useRef(null)
  const listenStartRef  = useRef(null)
  // New counters for the results screen (presentation only; they are added to the result post as optional fields).
  const attemptsRef     = useRef([]) // mic/confirm attempts per word
  const firstTryRef     = useRef([]) // true when the first attempt was a full echo
  const slowerRef       = useRef([]) // "Hear it slower" presses per word
  const replaysRef      = useRef(0)
  const streakRef       = useRef(0)

  const { submitEventBatch } = useAnalytics()
  const sessionIdRef     = useRef(createSessionId())
  const loggerRef        = useRef(createEventLogger({ patientId, exerciseId, sessionId: sessionIdRef.current, domain, onFlush: submitEventBatch }))
  const promptShownAtRef = useRef(null)
  const sessionEndedRef  = useRef(false)

  const word = words[current]
  const pao = useEchoPao({ word: word ? hyphen(word.syllables) : '', name: String(patientName).split(' ')[0] })

  const logExitOnce = () => {
    if (sessionEndedRef.current) return
    sessionEndedRef.current = true
    loggerRef.current.log('exit', {})
  }

  useEffect(() => () => {
    cancelSeqRef.current?.()
    recognizerRef.current?.abort?.()
    window.speechSynthesis?.cancel()
    logExitOnce()
  }, []) // eslint-disable-line

  // Pao greets on the setup screen.
  useEffect(() => { if (!settings) pao.hold('ready') }, [settings]) // eslint-disable-line

  // `speak` defaults to English — that's what narrates the practice words and
  // syllables themselves. Coaching lines (cheers, badge) opt into `lang`.
  const speak = (text, { rate = 1.1, onEnd, lang: speakLang = 'en' } = {}) => {
    pgSpeak(text, { rate, pitch: 1.6, lang: speakLang, onEnd: () => onEnd?.() })
  }

  const pace = PACE_PRESETS.find(p => p.id === wordPaceId) || PACE_PRESETS[0]

  const startWord = (paceId = wordPaceId) => {
    if (!word) return
    const pc = PACE_PRESETS.find(p => p.id === paceId) || PACE_PRESETS[0]
    const n = word.syllables.length
    setStage('narrate')
    setSyllableIdx(-1)
    setEchoStep(0)
    setFeedback(null)
    setAnnounce('Listen')
    promptShownAtRef.current = Date.now()
    loggerRef.current.log('prompt_shown', {})
    cancelSeqRef.current = playSyllableSequence(
      word.syllables, pc.rate, pc.gapMs,
      (text, rate, onDone) => speak(text, { rate, onEnd: onDone }),
      (i) => { setSyllableIdx(i); pao.hold('beats', { count: n, active: i }, { withLine: false }); pao.say(`${word.syllables.slice(0, i + 1).join('... ')}...`) },
      () => {
        setTimeout(() => {
          pao.hold('listening')
          speak(word.word, { rate: pc.rate * 1.05, onEnd: () => {
            pao.hold('yourTurn')
            setAnnounce('Your turn')
            if (settings.scaffold) setStage('echo-syllable')
            else setStage('your-turn')
          }})
        }, pc.gapMs)
      }
    )
  }

  useEffect(() => {
    if (settings && words.length) { setWordPaceId(settings.paceId); startWord(settings.paceId) }
    return () => cancelSeqRef.current?.()
  }, [current, words]) // eslint-disable-line

  const replayWord = () => {
    replaysRef.current += 1
    cancelSeqRef.current?.()
    startWord()
  }

  const hearSlower = () => {
    const i = PACE_PRESETS.findIndex(p => p.id === wordPaceId)
    const next = PACE_PRESETS[Math.min(i + 1, PACE_PRESETS.length - 1)].id
    slowerRef.current[current] = (slowerRef.current[current] || 0) + 1
    setWordPaceId(next)
    cancelSeqRef.current?.()
    startWord(next)
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

  // Shows Pao's reaction for an echo result and says the line (English as written; localized cheers otherwise).
  const reactToResult = (tier) => {
    const n = (attemptsRef.current[current] || 0) + 1
    attemptsRef.current[current] = n
    pao.release()
    let text
    if (tier === 'full') {
      if (n === 1) { firstTryRef.current[current] = true; streakRef.current += 1 } else streakRef.current = 0
      const isStreak = n === 1 && streakRef.current > 0 && streakRef.current % STREAK_EVERY === 0
      text = pao.fx(isStreak ? 'streak' : 'great', { word: hyphen(word.syllables), n: streakRef.current })
      setAnnounce('Great echo')
    } else {
      streakRef.current = 0
      text = pao.fx((slowerRef.current[current] || 0) >= 2 ? 'encourage' : 'slower')
      setAnnounce('Try again slower')
    }
    if (lang !== 'en') {
      const cheer = pickRandomLine(tier === 'full' ? ECHO_GAME_LINES.cheersFull : tier === 'close' ? ECHO_GAME_LINES.cheersClose : ECHO_GAME_LINES.cheersNone, lang)
      pao.say(cheer)
      speak(cheer, { rate: 1.05, lang })
    } else speak(text, { rate: 1.05 })
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
      reactToResult(tier)
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
    reactToResult(tier)
  }

  const nextWord = () => {
    window.speechSynthesis?.cancel()
    if (current + 1 >= words.length) {
      finishSession()
    } else {
      setCurrent(c => c + 1)
    }
  }

  const finishSession = () => {
    logExitOnce()
    const t = tallyRef.current
    let perfectedCount = levelsMastered

    // Preview never saves anything, here or on the device.
    if (!preview) {
      try {
        const key = 'pao_echo_sessions'
        const sessions = JSON.parse(localStorage.getItem(key) || '[]')
        const hardest = Object.entries(missedSyllablesRef.current).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([syl]) => syl)
        sessions.push({
          patientId, date: new Date().toISOString(), levelId: settings.levelId, paceId: settings.paceId,
          scaffold: settings.scaffold, wordsAttempted: words.length,
          fullMatches: t.full, closeMatches: t.close, noMatches: t.none,
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
          && finalTierRef.current.every(x => x === 'full')

        const perfectKey = 'pao_echo_perfect_levels'
        let perfected = JSON.parse(localStorage.getItem(perfectKey) || '[]')
        if (allWordsClear && !perfected.includes(settings.levelId)) {
          perfected = [...perfected, settings.levelId]
          localStorage.setItem(perfectKey, JSON.stringify(perfected))
        }
        perfectedCount = perfected.length
        setLevelsMastered(perfected.length)

        const hasAllLevels = WORD_LEVELS.every(l => perfected.includes(l.id))
        if (hasAllLevels) {
          const earned = JSON.parse(localStorage.getItem('pao_badges') || '[]')
          if (!earned.includes('Echo Master')) {
            localStorage.setItem('pao_badges', JSON.stringify([...earned, 'Echo Master']))
            setBadgeEarned(true)
            fetchGameBadge('Slow-Motion Echo').then(setRealBadge)
          }
        }
      } catch {}
    }

    const firstTry = words.filter((_, i) => firstTryRef.current[i]).length
    const slower = slowerRef.current.reduce((a, b) => a + (b || 0), 0)
    try {
      gameSession.finish({
        correct: t.full, attempts: t.full + t.close + t.none, hints_used: 0, stars: t.full,
        detail: {
          wordsAttempted: words.length, closeMatches: t.close, noMatches: t.none,
          ...(firstTry ? { firstTryEchoes: firstTry } : {}), ...(slower ? { slowerTries: slower } : {}), ...(replaysRef.current ? { replays: replaysRef.current } : {}),
        },
      })
    } catch {}

    setResultInfo({
      firstTry, slower, replays: replaysRef.current, levelsMastered: perfectedCount, totalLevels: WORD_LEVELS.length,
      words: words.map((w, i) => ({ word: w.word, syllables: w.syllables, slower: (slowerRef.current[i] || 0) > 0 })),
    })
    pao.release()
    const pct = words.length ? t.full / words.length : 0
    const starsNow = pct >= 0.7 ? 3 : pct >= 0.4 ? 2 : 1
    const line = pao.lineFor('finished', { name: String(patientName).split(' ')[0] })
    const spoken = lang === 'en' ? line : pickLine(starsNow === 3 ? ECHO_GAME_LINES.finishStars3 : starsNow === 2 ? ECHO_GAME_LINES.finishStars2 : ECHO_GAME_LINES.finishStars1, lang)
    setFinishLine(spoken)
    speak(spoken, { rate: 1.05, lang })
    setDone(true)
  }

  const handleStart = (opts) => {
    const pool = WORD_LEVELS.find(l => l.id === opts.levelId)?.words || WORD_LEVELS[0].words
    setWords(shuffle(pool).slice(0, WORDS_PER_SESSION))
    setCurrent(0)
    tallyRef.current = { full: 0, close: 0, none: 0 }
    finalTierRef.current = []
    missedSyllablesRef.current = {}
    attemptsRef.current = []; firstTryRef.current = []; slowerRef.current = []; replaysRef.current = 0; streakRef.current = 0
    sessionEndedRef.current = false
    sessionIdRef.current = createSessionId()
    loggerRef.current = createEventLogger({ patientId, exerciseId, sessionId: sessionIdRef.current, domain, onFlush: submitEventBatch })
    setDone(false); setBadgeEarned(false); setRealBadge(null); setResultInfo(null); setFeedback(null)
    setSettings(opts)
    pao.release()
  }

  const handleExit = () => {
    logExitOnce()
    window.speechSynthesis?.cancel()
    onExit()
  }

  const level = settings ? WORD_LEVELS.find(l => l.id === settings.levelId) : null
  const nextLevel = level ? WORD_LEVELS.find(l => l.id === level.id + 1) || null : null
  const tally = tallyRef.current
  const pctFull = words.length ? tally.full / words.length : 0
  const stars = pctFull >= 0.7 ? 3 : pctFull >= 0.4 ? 2 : 1 // the existing star rule, unchanged

  const chipState = (i) => {
    if (stage === 'feedback') return feedback?.tier === 'full' ? 'done' : 'retry'
    if (stage === 'narrate') return syllableIdx === i ? 'active' : 'idle'
    if (stage === 'echo-syllable') return echoStep === i ? 'active' : i < echoStep ? 'done' : 'idle'
    return 'idle'
  }
  const sylNow = word ? word.syllables[stage === 'echo-syllable' ? echoStep : Math.max(0, syllableIdx)] : ''

  return (
    <div className="ec-root">
      <style>{PAO_PROP_CSS + PICTURE_WORD_PROP_CSS}</style>
      <EcSky />
      <div className={`ec-stage${stageBox.narrow ? ' narrow' : ''}`} style={stageBox.style}>

        {!settings && <SetupScreen levels={WORD_LEVELS} paces={PACE_PRESETS} onStart={handleStart} onExit={handleExit} preview={preview} narrow={stageBox.narrow} />}

        {settings && !done && word && (
          <>
            <button type="button" className="ec-pill ec-back" onClick={handleExit}><ArrowLeft size={18} /> All Games</button>
            <div className="ec-progress" role="img" aria-label={`Word ${current + 1} of ${words.length}`}>
              <span className="ec-cat">Word</span>
              {words.map((_, i) => (
                <span key={i} className={`ec-dot${i < current ? ' done' : i === current ? ' now' : ''}`}>{i < current ? <CheckI size={20} /> : i === current ? i + 1 : ''}</span>
              ))}
            </div>
            {preview && <div className="ec-preview">Preview mode: scores are not saved</div>}
            <div className="ec-pill ec-levelpill"><TurtleIcon size={34} /> {level.label} · {pace.label}</div>

            <section className="ec-card">
              <span className="ec-kicker">{stage === 'feedback' && feedback?.tier !== 'full' ? 'Try again' : `Word ${current + 1} of ${words.length}`}</span>
              <div className={`ec-circle${stage === 'feedback' ? (feedback?.tier === 'full' ? ' good' : ' retry') : ''}`}><EchoPicture word={word.word} size={134} /></div>

              <div className="ec-chips">
                {word.syllables.map((syl, i) => {
                  const st = chipState(i)
                  return (
                    <span key={i} className="ec-chip-wrap">
                      {i > 0 && <span className="ec-sep" aria-hidden="true" />}
                      <span className={`ec-chip ${st}`}>{syl}{st === 'done' && <span className="ec-chip-check"><CheckI size={20} /></span>}</span>
                    </span>
                  )
                })}
              </div>

              <div className={`ec-status ${stage === 'feedback' ? (feedback?.tier === 'full' ? 'good' : 'retry') : stage === 'narrate' ? 'hear' : 'turn'}`}>
                {stage === 'narrate' && <><span>Now hearing</span><span className="ec-wave" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <i key={i} style={{ animationDelay: `${(i % 5) * 0.08}s` }} />)}</span><b>{syllableIdx >= 0 ? sylNow : word.word}</b></>}
                {(stage === 'echo-syllable' || stage === 'your-turn') && <><Mic size={22} /><span>Your turn! Say <b>{stage === 'echo-syllable' ? sylNow : word.word}</b></span>{listening && <span className="ec-wave amber" aria-hidden="true">{Array.from({ length: 8 }, (_, i) => <i key={i} style={{ animationDelay: `${(i % 4) * 0.1}s` }} />)}</span>}</>}
                {stage === 'feedback' && feedback?.tier === 'full' && <><StarI size={34} className="ec-gold" /><b className="ec-great">{hyphen(word.syllables)}! Great echo!</b></>}
                {stage === 'feedback' && feedback?.tier !== 'full' && <><TurtleIcon size={34} /><span>Let us try that again, even slower</span></>}
              </div>

              <div className="ec-actions">
                {stage === 'narrate' && <>
                  <button type="button" className="ec-btn light" onClick={replayWord}><Replay size={22} /> Replay</button>
                  <button type="button" className="ec-btn light" onClick={hearSlower}><TurtleIcon size={26} /> Slower</button>
                </>}
                {(stage === 'echo-syllable' || stage === 'your-turn') && <>
                  <button type="button" className="ec-btn light" onClick={replayWord}><Speaker size={22} /> Hear it again</button>
                  {micSupported
                    ? <button type="button" className="ec-btn green" onClick={stage === 'echo-syllable' ? handleEchoSyllable : handleYourTurn} disabled={listening} data-autofocus><Mic size={22} /> {listening ? 'Listening...' : 'Tap and say it'}</button>
                    : <>
                        <button type="button" className="ec-btn green" onClick={() => { if (stage === 'echo-syllable') { if (echoStep + 1 >= word.syllables.length) setStage('your-turn'); else setEchoStep(s => s + 1) } else handleManualMark(true) }} data-autofocus><CheckI size={22} /> I said it!</button>
                        {stage === 'your-turn' && <button type="button" className="ec-btn light" onClick={() => handleManualMark(false)}><Replay size={22} /> Try again</button>}
                      </>}
                </>}
                {stage === 'feedback' && feedback?.tier === 'full' && <>
                  <button type="button" className="ec-btn light" onClick={replayWord}><Speaker size={22} /> Hear it again</button>
                  <button type="button" className="ec-btn green" onClick={nextWord} data-autofocus>{current + 1 >= words.length ? 'Finish' : 'Next word'} <ArrowRight size={22} /></button>
                </>}
                {stage === 'feedback' && feedback?.tier !== 'full' && <>
                  <button type="button" className="ec-btn amber" onClick={hearSlower} data-autofocus><TurtleIcon size={26} /> Hear it slower</button>
                  <button type="button" className="ec-btn light" onClick={nextWord}><ArrowRight size={22} /> Skip word</button>
                </>}
              </div>
              {stage === 'feedback' && feedback?.tier === 'full' && Array.from({ length: 9 }, (_, i) => <i key={i} className="ec-burst" style={{ '--a': `${i * 40}deg`, color: ['#FFD43B', '#4ADE80', '#F472B6', '#38BDF8'][i % 4] }}><StarI size={18} /></i>)}
            </section>
          </>
        )}

        {!done && (
          <div className="ec-pao-wrap">
            <PaoStage view={pao.view} extra={pao.extra} height={stageBox.narrow ? 180 : 300} />
            <PaoBubble text={pao.line} className={!settings ? 'above' : ''} />
          </div>
        )}
      </div>

      {settings && done && resultInfo && (
        <ResultsScreen
          stats={resultInfo} patientName={patientName} stars={stars} paceLabel={PACE_PRESETS.find(p => p.id === settings.paceId)?.label || ''}
          nextLevel={nextLevel} sayLine={finishLine} preview={preview}
          badge={badgeEarned ? { real: realBadge, totalLevels: WORD_LEVELS.length } : null}
          onReplay={() => handleStart(settings)} onNext={() => handleStart({ ...settings, levelId: nextLevel.id })} onExit={handleExit}
        />
      )}
      <div className="ec-sr" aria-live="polite">{announce}</div>
    </div>
  )
}
