import { useEffect, useRef, useState } from 'react'
import { SkyBackground, useSpeech } from './ui'
import { BuddyBubble } from './Modals'
import { EmojiPicture, SpeakerIcon, CheckIcon, HandTapIcon, StarIcon, BackArrowIcon } from './illustrations'

const HEADING = { fontFamily: "'Baloo 2', system-ui, sans-serif" }

function article(word) {
  return /^[aeiou]/i.test(word) ? 'an' : 'a'
}

export default function GameScreen({
  questions, categoryLabel, Mascot, readAloud = true, autoHintAfter = 2,
  onBack, onFinish, logger,
}) {
  const [current, setCurrent]     = useState(0)
  const [wrongSet, setWrongSet]   = useState(() => new Set())
  const [tries, setTries]         = useState(0)
  const [hintOn, setHintOn]       = useState(false)
  const [correctPicked, setCorrectPicked] = useState(false)
  const [showBanner, setShowBanner] = useState(false)
  const [stars, setStars]         = useState(0)
  const [bubble, setBubble]       = useState({ message: 'Which word is this?', tone: 'neutral' })
  const [mouthOpen, setMouthOpen] = useState(false)

  const { speak, speaking } = useSpeech(readAloud)
  const mouthRef = useRef(null)
  const advanceRef = useRef(null)
  const promptShownAtRef = useRef(null)

  useEffect(() => {
    if (speaking) mouthRef.current = setInterval(() => setMouthOpen((p) => !p), 160)
    else { clearInterval(mouthRef.current); setMouthOpen(false) }
    return () => clearInterval(mouthRef.current)
  }, [speaking])

  useEffect(() => () => clearTimeout(advanceRef.current), [])

  const question = questions[current]

  // New question: reset per-question state and prompt.
  useEffect(() => {
    setWrongSet(new Set()); setTries(0); setHintOn(false); setCorrectPicked(false); setShowBanner(false)
    setBubble({ message: 'Which word is this?', tone: 'neutral' })
    promptShownAtRef.current = Date.now()
    logger?.log('prompt_shown', {})
    const t = setTimeout(() => speak('Which word is this?'), 400)
    return () => clearTimeout(t)
  }, [current]) // eslint-disable-line

  const handleHearIt = () => speak(question.item.word)

  const handleNeedHelp = () => {
    if (correctPicked || hintOn) return
    setHintOn(true)
    setBubble({ message: 'Look! The right word is glowing.', tone: 'hint' })
    speak('Look! The right word is glowing.')
  }

  const handleSelect = (word) => {
    if (correctPicked || wrongSet.has(word)) return
    const isCorrect = word === question.item.word
    const responseTimeMs = promptShownAtRef.current ? Date.now() - promptShownAtRef.current : null
    logger?.log('response_given', { responseTimeMs, isCorrect, inputMethod: 'tap' })

    if (isCorrect) {
      const nextStars = stars + 1
      setStars(nextStars)
      setCorrectPicked(true)
      setShowBanner(true)
      const line = `Yes! That is ${article(word)} ${word.toLowerCase()}!`
      setBubble({ message: line, tone: 'success' })
      speak(line)
      logger?.log('praise_shown', {})
      advanceRef.current = setTimeout(() => {
        if (current + 1 >= questions.length) onFinish(nextStars)
        else setCurrent((c) => c + 1)
      }, 1800)
      return
    }

    setWrongSet((prev) => new Set(prev).add(word))
    const nextTries = tries + 1
    setTries(nextTries)
    setBubble({ message: 'Almost! Try another one.', tone: 'hint' })
    speak('Almost! Try another one.')
    if (nextTries >= autoHintAfter) {
      setHintOn(true)
    }
  }

  if (!question) return null

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col overflow-hidden" style={{ fontFamily: "'Atkinson Hyperlegible', system-ui, sans-serif" }}>
      <SkyBackground/>

      {/* Top bar */}
      <div className="relative z-10 flex flex-shrink-0 flex-wrap items-center justify-between gap-2 px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="pwg-pressable flex h-12 items-center gap-2 rounded-full bg-white px-4 text-[15px] font-extrabold text-[#2B2A4C] shadow-md focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6]"
          style={HEADING}
        >
          <BackArrowIcon size={18}/> Back
        </button>

        <div className="flex h-12 items-center gap-2 rounded-full bg-white px-4 shadow-md">
          {questions.map((_, i) => (
            <span key={i} aria-hidden="true" className="flex h-5 w-5 items-center justify-center">
              {i < current || (i === current && correctPicked)
                ? <StarIcon size={18} className="text-[#F59E0B]"/>
                : i === current
                  ? <span className="block h-3.5 w-3.5 rounded-full border-[3px] border-[#F59E0B]"/>
                  : <span className="block h-2.5 w-2.5 rounded-full bg-[#D8D4E6]"/>
              }
            </span>
          ))}
        </div>

        <div className="flex h-12 items-center gap-2 rounded-full bg-white px-4 text-[17px] font-extrabold text-[#C97A00] shadow-md" style={HEADING}>
          <StarIcon size={18} className="text-[#F59E0B]"/> {stars}
        </div>
      </div>

      {/* Main content — the only part that scrolls, so the top bar and Pao stay visible */}
      <div className="relative z-10 flex min-h-0 flex-1 flex-wrap items-center justify-center gap-6 overflow-y-auto overscroll-contain px-4 py-3 md:gap-10">

        {/* Picture card — max 380px wide, 200px picture circle */}
        <div className="relative flex w-[min(380px,92vw)] flex-col items-center gap-4 rounded-[28px] bg-white p-6 shadow-lg">
          {showBanner && (
            <div className="pwg-pop absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#E3F4E8] px-4 py-1.5 text-[14px] font-extrabold text-[#2F8A4C] shadow-md" style={HEADING}>
              🎉 Great job!
            </div>
          )}
          <EmojiPicture emoji={question.item.emoji} tint={question.item.tint} size={200}/>
          <button
            type="button"
            onClick={handleHearIt}
            aria-label={`Hear the word ${question.item.word}`}
            className="pwg-pressable flex h-14 items-center gap-2 rounded-full bg-[#F59E0B] px-6 text-[17px] font-extrabold text-white focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6]"
            style={{ boxShadow: '0 4px 10px rgba(201,122,0,.35)', ...HEADING }}
          >
            <SpeakerIcon size={20}/> Hear it
          </button>
        </div>

        {/* Word choices — 3 buttons, 68px tall, 26px text */}
        <div className="flex w-[min(400px,92vw)] flex-col gap-2.5">
          <h2 className="text-center text-[26px] font-extrabold text-[#2B2A4C]" style={HEADING}>
            Which word is this?
          </h2>

          {question.options.map((word) => {
            const isCorrectWord = word === question.item.word
            const isFaded = wrongSet.has(word)
            const isChosenCorrect = correctPicked && isCorrectWord
            const isGlowing = hintOn && !correctPicked && isCorrectWord

            let style = { ...HEADING, fontSize: 26 }
            if (isChosenCorrect) {
              style = { ...style, background: '#2F8A4C', borderColor: '#256E3C', color: '#fff', boxShadow: '0 3px 8px rgba(47,138,76,.35)' }
            } else if (isFaded) {
              style = { ...style, background: '#F4F2EA', borderColor: '#E4DFCE', color: '#8A8578', opacity: 0.6 }
            } else if (isGlowing) {
              style = { ...style, background: '#FFF0CC', borderColor: '#F59E0B', color: '#7A4E00', boxShadow: '0 0 0 4px rgba(245,158,11,.3)' }
            } else {
              style = { ...style, background: '#fff', borderColor: '#E4DFCE', color: '#2B2A4C', boxShadow: '0 2px 6px rgba(43,42,76,.10)' }
            }

            return (
              <button
                key={word}
                type="button"
                onClick={() => handleSelect(word)}
                disabled={isFaded || correctPicked}
                className={`pwg-pressable flex h-[68px] items-center justify-center gap-2.5 rounded-2xl border-2 px-5 text-center font-extrabold transition-all focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6] ${isFaded ? 'pwg-fade-out cursor-not-allowed' : 'cursor-pointer'}`}
                style={style}
              >
                {isChosenCorrect && <CheckIcon size={24}/>}
                {isGlowing && <HandTapIcon size={22}/>}
                {word}
              </button>
            )
          })}

          <button
            type="button"
            onClick={handleNeedHelp}
            disabled={correctPicked || hintOn}
            className="mx-auto mt-1 flex h-11 items-center rounded-full px-5 text-[15px] font-bold text-[#5A5670] underline decoration-dotted underline-offset-4 disabled:opacity-40 focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6]"
          >
            Need help?
          </button>
        </div>
      </div>

      {/* Buddy bar — pinned to the bottom, always visible */}
      <div className="relative z-10 flex flex-shrink-0 items-center px-4 pb-3 pt-1 sm:px-6">
        <BuddyBubble Mascot={Mascot} mouthOpen={mouthOpen} message={bubble.message} tone={bubble.tone} pandaState={correctPicked ? 'excited' : 'happy'} pxWidth={96}/>
      </div>
    </div>
  )
}
