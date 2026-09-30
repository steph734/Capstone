import { useEffect, useRef, useState } from 'react'
import { SkyBackground, useSpeech } from './ui'
import { BuddyBubble } from './Modals'
import { EmojiPicture, SpeakerIcon, CheckIcon, HandTapIcon, StarIcon, BackArrowIcon } from './illustrations'

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
      <div className="relative z-10 flex items-center justify-between px-6 py-4">
        <button
          type="button"
          onClick={onBack}
          className="pwg-pressable flex h-14 items-center gap-2 rounded-full bg-white px-5 text-[15px] font-extrabold text-[#2B2A4C] shadow focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6]"
          style={{ fontFamily: "'Baloo 2', system-ui, sans-serif" }}
        >
          <BackArrowIcon size={20}/> Back
        </button>

        <div className="flex h-14 items-center gap-2.5 rounded-full bg-white px-5 shadow">
          {questions.map((_, i) => (
            <span
              key={i}
              aria-hidden="true"
              className="flex h-6 w-6 items-center justify-center"
            >
              {i < current || (i === current && correctPicked)
                ? <StarIcon size={20} className="text-[#F59E0B]"/>
                : i === current
                  ? <span className="block h-4 w-4 rounded-full border-[3px] border-[#F59E0B]"/>
                  : <span className="block h-2.5 w-2.5 rounded-full bg-[#D8D4E6]"/>
              }
            </span>
          ))}
        </div>

        <div className="flex h-14 items-center gap-2 rounded-full bg-white px-5 text-[17px] font-extrabold text-[#C97A00] shadow" style={{ fontFamily: "'Baloo 2', system-ui, sans-serif" }}>
          <StarIcon size={20} className="text-[#F59E0B]"/> {stars}
        </div>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-1 flex-wrap items-center justify-center gap-10 px-6 pb-8">

        {/* Picture card */}
        <div className="relative flex w-[min(440px,90vw)] flex-col items-center gap-6 rounded-[48px] bg-white p-8 shadow-xl" style={{ minHeight: 480 }}>
          {showBanner && (
            <div className="pwg-pop absolute -top-6 left-1/2 -translate-x-1/2 rounded-full bg-[#E3F4E8] px-5 py-2 text-[15px] font-extrabold text-[#2F8A4C] shadow" style={{ fontFamily: "'Baloo 2', system-ui, sans-serif" }}>
              🎉 Great job!
            </div>
          )}
          <EmojiPicture emoji={question.item.emoji} tint={question.item.tint} size={220}/>
          <button
            type="button"
            onClick={handleHearIt}
            aria-label={`Hear the word ${question.item.word}`}
            className="pwg-pressable flex h-16 items-center gap-2 rounded-full bg-[#F59E0B] px-7 text-[17px] font-extrabold text-white focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6]"
            style={{ boxShadow: '0 6px 0 #C97A00', fontFamily: "'Baloo 2', system-ui, sans-serif" }}
          >
            <SpeakerIcon size={22}/> Hear it
          </button>
        </div>

        {/* Word choices */}
        <div className="flex w-[min(420px,90vw)] flex-col gap-4">
          <h2 className="text-center text-[28px] font-extrabold text-[#2B2A4C]" style={{ fontFamily: "'Baloo 2', system-ui, sans-serif" }}>
            Which word is this?
          </h2>

          {question.options.map((word) => {
            const isCorrectWord = word === question.item.word
            const isFaded = wrongSet.has(word)
            const isChosenCorrect = correctPicked && isCorrectWord
            const isGlowing = hintOn && !correctPicked && isCorrectWord

            let cls = 'pwg-pressable flex h-[104px] items-center justify-center gap-3 rounded-[28px] border-[3px] px-6 text-center font-extrabold transition-all focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6]'
            let style = { fontFamily: "'Baloo 2', system-ui, sans-serif", fontSize: 'clamp(22px, 4vw, 40px)' }

            if (isChosenCorrect) {
              style = { ...style, background: '#2F8A4C', borderColor: '#256E3C', color: '#fff', boxShadow: '0 6px 0 #1F5C33' }
            } else if (isFaded) {
              style = { ...style, background: '#F4F2EA', borderColor: '#E4DFCE', color: '#B7B2A0', opacity: 0.55 }
            } else if (isGlowing) {
              style = { ...style, background: '#FFF0CC', borderColor: '#F59E0B', color: '#7A4E00', boxShadow: '0 0 0 6px rgba(245,158,11,.25), 0 6px 0 #F3D284' }
            } else {
              style = { ...style, background: '#fff', borderColor: '#E4DFCE', color: '#2B2A4C', boxShadow: '0 6px 0 #E4DFCE' }
            }

            return (
              <button
                key={word}
                type="button"
                onClick={() => handleSelect(word)}
                disabled={isFaded || correctPicked}
                className={`${cls} ${isFaded ? 'pwg-fade-out cursor-not-allowed' : 'cursor-pointer'}`}
                style={style}
              >
                {isChosenCorrect && <CheckIcon size={30}/>}
                {isGlowing && <HandTapIcon size={26}/>}
                {word}
              </button>
            )
          })}

          <button
            type="button"
            onClick={handleNeedHelp}
            disabled={correctPicked || hintOn}
            className="mx-auto mt-1 h-12 rounded-full px-6 text-[14px] font-bold text-[#5A5670] underline decoration-dotted underline-offset-4 disabled:opacity-40 focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6]"
          >
            Need help?
          </button>
        </div>
      </div>

      {/* Buddy bar */}
      <div className="relative z-10 flex items-center px-6 pb-6">
        <BuddyBubble Mascot={Mascot} mouthOpen={mouthOpen} message={bubble.message} tone={bubble.tone} pandaState={correctPicked ? 'excited' : 'happy'} pxWidth={110}/>
      </div>
    </div>
  )
}
