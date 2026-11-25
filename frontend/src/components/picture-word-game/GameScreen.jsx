import { useEffect, useRef, useState } from 'react'
import { PwSky, usePwSpeech } from './pwUi'
import { PaoBubble, PaoStage, usePictureWordPao } from './PicturePao'
import { WordPicture } from './wordArt'
import { SpeakerIcon, CheckIcon, StarIcon, BackArrowIcon } from './illustrations'
import { PAO_PROP_CSS } from '../../games/pictureWord/PaoProps'
import { IDLE_THINKING_MS, PICTURE_WORD_REACTIONS, STREAK_EVERY } from '../../games/pictureWord/paoReactions'
import usePwStage from './usePwStage'

const SearchIcon = (p) => (
  <svg width={p.size || 22} height={p.size || 22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
)
const RetryIcon = (p) => (
  <svg width={p.size || 24} height={p.size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 1 0 3-6.2" /><path d="M4 4v5h5" /></svg>
)
const ArrowRight = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
)

const TILES = ['#6366F1', '#F59E0B', '#EC4899']
const BURST = ['#FFD43B', '#4ADE80', '#F472B6', '#38BDF8', '#FB923C', '#A78BFA', '#FFD43B', '#4ADE80']

export default function GameScreen({
  questions, categoryLabel, readAloud = true, autoHintAfter = 2, preview = false, patientName = 'friend',
  onBack, onFinish, onWrongTry, logger,
}) {
  const [current, setCurrent] = useState(0)
  const [wrongSet, setWrongSet] = useState(() => new Set())
  const [lastWrong, setLastWrong] = useState(null)
  const [tries, setTries] = useState(0)
  const [hint, setHint] = useState(null) // { fade: word | null }
  const [correctPicked, setCorrectPicked] = useState(false)
  const [stars, setStars] = useState(0)
  const [results, setResults] = useState([]) // [{ word, firstTry, hint }]
  const [announce, setAnnounce] = useState('')

  const stage = usePwStage()
  const question = questions[current]
  const answer = question?.item.word || ''
  const letter = answer.charAt(0).toUpperCase()
  const pao = usePictureWordPao({ category: (categoryLabel || 'fruits').toLowerCase(), word: answer, letter, name: String(patientName).split(' ')[0] })
  const { speak, cancel } = usePwSpeech(readAloud, { onListening: pao.setListening })

  const promptShownAtRef = useRef(null)
  const startedAtRef = useRef(Date.now())
  const streakRef = useRef(0) // correct on the first try, in a row
  const thinkTimer = useRef(null)
  const tryRef = useRef(0)
  const wrongRef = useRef(new Set()) // refs mirror the state the delayed auto-hint needs to see fresh
  const hintRef = useRef(false)
  const correctRef = useRef(false)

  useEffect(() => () => { clearTimeout(thinkTimer.current); cancel() }, []) // eslint-disable-line

  // New word: reset the per-word state, then greet (first word) and ask the question while Pao listens.
  useEffect(() => {
    setWrongSet(new Set()); setLastWrong(null); setTries(0); setHint(null); setCorrectPicked(false); setAnnounce('')
    tryRef.current = 0; wrongRef.current = new Set(); hintRef.current = false; correctRef.current = false
    promptShownAtRef.current = Date.now()
    logger?.log('prompt_shown', {})
    const ask = () => {
      pao.say(PICTURE_WORD_REACTIONS.listening.lines[0])
      speak('Which word is this?', { listen: true })
    }
    const t = setTimeout(() => {
      if (current === 0) { const line = pao.play('ready'); speak(line, { onEnd: ask }) } else ask()
    }, 400)
    // No answer for a while: Pao thinks along (once per word).
    clearTimeout(thinkTimer.current)
    thinkTimer.current = setTimeout(() => pao.play('thinking'), IDLE_THINKING_MS + 400)
    return () => clearTimeout(t)
  }, [current]) // eslint-disable-line

  const stopThinking = () => clearTimeout(thinkTimer.current)

  const showHint = () => {
    if (hintRef.current || correctRef.current) return
    hintRef.current = true
    stopThinking()
    const candidates = question.options.filter((w) => w !== answer && !wrongRef.current.has(w))
    setHint({ fade: candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : null })
    const line = pao.play('hint', { letter })
    speak(line)
    setAnnounce(`Hint. It starts with ${letter}.`)
  }

  const select = (word) => {
    if (correctPicked || wrongSet.has(word) || hint?.fade === word) return
    stopThinking()
    const isCorrect = word === answer
    logger?.log('response_given', { responseTimeMs: promptShownAtRef.current ? Date.now() - promptShownAtRef.current : null, isCorrect, inputMethod: 'tap' })

    if (isCorrect) {
      const firstTry = tryRef.current === 0
      streakRef.current = firstTry ? streakRef.current + 1 : 0
      const isStreak = firstTry && streakRef.current > 0 && streakRef.current % STREAK_EVERY === 0
      setStars((s) => s + 1)
      setCorrectPicked(true)
      correctRef.current = true
      setResults((r) => [...r, { word: answer, firstTry, hint: Boolean(hint) }])
      const line = pao.play(isStreak ? 'streak' : 'correct', { word: answer.toLowerCase(), n: streakRef.current })
      speak(line)
      setAnnounce('Correct')
      logger?.log('praise_shown', {})
      return
    }

    streakRef.current = 0
    tryRef.current += 1
    wrongRef.current.add(word)
    onWrongTry?.()
    setLastWrong(word)
    setWrongSet((prev) => new Set(prev).add(word))
    const nextTries = tries + 1
    setTries(nextTries)
    const line = pao.play(tryRef.current >= 2 ? 'encourage' : 'oops')
    speak(line)
    setAnnounce('Try again')
    if (!hint && nextTries >= autoHintAfter) setTimeout(showHint, 1200) // helper after a couple of tries, as before
  }

  const next = () => {
    cancel()
    const last = current + 1 >= questions.length
    if (last) {
      const all = results
      onFinish({
        stars, firstTry: all.filter((r) => r.firstTry).length, hints: all.filter((r) => r.hint).length,
        seconds: Math.round((Date.now() - startedAtRef.current) / 1000), results: all,
      })
    } else setCurrent((c) => c + 1)
  }

  if (!question) return null

  const title = correctPicked ? 'You found it!' : lastWrong ? 'Almost! Try again' : 'Which word is this?'

  return (
    <div className="pw-root">
      <style>{PAO_PROP_CSS}</style>
      <PwSky />
      <div className={`pw-stage${stage.narrow ? ' narrow' : ''}`} style={stage.style}>
        <button type="button" className="pw-pill pw-back" onClick={() => { cancel(); onBack() }}><BackArrowIcon size={18} /> Back</button>

        <div className="pw-progress" role="img" aria-label={`${categoryLabel}, word ${current + 1} of ${questions.length}`}>
          <span className="pw-cat">{categoryLabel}</span>
          {questions.map((_, i) => {
            const done = i < current || (i === current && correctPicked)
            return (
              <span key={i} className={`pw-dot${done ? ' done' : i === current ? ' now' : ''}`}>
                {done ? <CheckIcon size={20} /> : i === current ? i + 1 : ''}
              </span>
            )
          })}
        </div>
        {preview && <div className="pw-preview">Preview mode: scores are not saved</div>}
        <div className="pw-pill pw-stars" aria-label={`${stars} stars`}><StarIcon size={26} className="pw-star-gold" /> {stars}</div>

        <section className="pw-picture-card">
          <span className="pw-chip">{categoryLabel}</span>
          {correctPicked && <span className="pw-plus" key={`p${current}`}><StarIcon size={20} /> +1 star</span>}
          <div className="pw-circle" style={{ background: question.item.tint }}>
            <WordPicture word={answer} size={230} />
            {correctPicked && <span className="pw-check-badge"><CheckIcon size={44} /></span>}
            {correctPicked && BURST.map((c, i) => <i key={i} className="pw-burst" style={{ '--a': `${i * 45 + 20}deg`, color: c }}><StarIcon size={18} /></i>)}
            {hint && !correctPicked && <span className="pw-hintpill"><b>{letter}</b> It starts with {letter}</span>}
          </div>
          <button type="button" className="pw-hear" onClick={() => speak(answer, { listen: true })} aria-label={`Hear the word ${answer}`}><SpeakerIcon size={24} /> Hear it</button>
        </section>

        <section className="pw-answers">
          <h2 className="pw-title">{title}</h2>
          {question.options.map((word, i) => {
            const isRight = word === answer
            const chosenRight = correctPicked && isRight
            const orange = !correctPicked && lastWrong === word
            const faded = (correctPicked && !isRight) || (!correctPicked && (hint?.fade === word || (wrongSet.has(word) && lastWrong !== word)))
            const cls = chosenRight ? ' right' : orange ? ' retry' : faded ? ' faded' : ''
            return (
              <div key={word} className={`pw-answer${cls}`}>
                <button type="button" className="pw-answer-main" onClick={() => select(word)} disabled={correctPicked || faded || orange} aria-label={word}>
                  <span className="pw-num" style={{ background: chosenRight ? '#22C55E' : orange ? '#FB923C' : TILES[i % 3] }}>
                    {chosenRight ? <CheckIcon size={26} /> : orange ? <RetryIcon /> : i + 1}
                  </span>
                  <span className="pw-word">{word}</span>
                  {chosenRight && <span className="pw-tag green">Great!</span>}
                  {orange && <span className="pw-tag orange">Try again</span>}
                </button>
                <button type="button" className="pw-speaker" onClick={() => speak(word, { listen: true })} aria-label={`Hear ${word}`}><SpeakerIcon size={22} /></button>
              </div>
            )
          })}
          {correctPicked
            ? <button type="button" className="pw-next" onClick={next} data-autofocus>{current + 1 >= questions.length ? 'See results' : 'Next word'} <ArrowRight /></button>
            : <button type="button" className={`pw-help${hint ? ' used' : ''}`} onClick={showHint} disabled={Boolean(hint)}><SearchIcon /> {hint ? 'Hint used' : 'Need help?'}</button>}
        </section>

        <div className="pw-pao-wrap">
          <PaoStage view={pao.view} height={stage.narrow ? 180 : 300} />
          <PaoBubble text={pao.line} />
        </div>
      </div>
      <div className="pw-sr" aria-live="polite">{announce}</div>
    </div>
  )
}
