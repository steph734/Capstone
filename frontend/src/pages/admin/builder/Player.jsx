import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import StageViewport from './StageViewport'
import ElementView from './ElementView'
import { STAGE, isCorrectDrop, levelCards, levelMode, speechMatches, starsFor } from './model'
import { canListen, listenOnce, playSound, speak, stopSpeaking } from './speak'

// Runs a builder game. The SAME ElementView draws every element here and in
// the editor, on the same 1024×768 stage, so what the Super Admin builds is
// what the patient sees. Used by Test play (results go nowhere) and by the
// patient/therapist game screen (results go to useGameSession).
//
// Rules by level shape:  drop slots → drag each card to its correct slot ·
// no slots, a speak answer → say the word · otherwise → tap the right card.
export function Caption({ text }) {
  if (!text) return null
  return <div style={{ position: 'absolute', left: 140, right: 140, bottom: 14, textAlign: 'center', fontSize: 22, fontWeight: 800, color: '#1f3d36', background: 'rgba(255,255,255,.8)', borderRadius: 14, padding: '6px 14px', pointerEvents: 'none', zIndex: 4000 }}>{text}</div>
}

const sortZ = (els) => [...els].sort((a, b) => a.z - b.z)

function LevelRun({ level, stageRef, language, readAloud, onDone, onRestart }) {
  const mode = levelMode(level)
  const cards = useMemo(() => levelCards(level), [level])
  const slots = useMemo(() => level.elements.filter((e) => e.type === 'drop_slot'), [level])
  const toPlace = cards.filter((c) => c.props.correctSlot)
  const timerEl = level.elements.find((e) => e.type === 'timer')
  const limit = level.timeLimit || (timerEl ? timerEl.props.seconds : 0)
  const hasAnimation = level.elements.find((e) => e.type === 'animation')

  const [placed, setPlaced] = useState({}) // cardId -> { slotId, x, y, s }
  const [drag, setDrag] = useState(null) // { id, x, y }
  const [wrongs, setWrongs] = useState(0)
  const [flash, setFlash] = useState({}) // cardId -> 'ok' | 'bad'
  const [hintOn, setHintOn] = useState(false)
  const [hintSlot, setHintSlot] = useState(null)
  const [message, setMessage] = useState(null)
  const [timeLeft, setTimeLeft] = useState(limit)
  const [done, setDone] = useState(null) // { stars, timedOut }
  const [listening, setListening] = useState(false)
  const [correctTaps, setCorrectTaps] = useState(0)
  const hintsUsed = useRef(0)
  const startedAt = useRef(Date.now())
  const finished = useRef(false)
  const stopListen = useRef(null)

  const finish = useCallback((timedOut = false, w = wrongs) => {
    if (finished.current) return
    finished.current = true
    const stars = starsFor(level, w, timedOut)
    playSound('cheer')
    setDone({ stars, timedOut })
    stopSpeaking()
  }, [level, wrongs])

  // Read the instructions / first voice prompt when the level opens.
  useEffect(() => {
    if (!readAloud) return undefined
    const vp = level.elements.find((e) => e.type === 'voice_prompt')
    const t = setTimeout(() => speak(level.voice || vp?.props.voice, vp?.props.language || language), 400)
    return () => { clearTimeout(t); stopSpeaking() }
  }, [level, readAloud, language])

  // Time limit: running out ends the level (with fewer stars), it never fails the game.
  useEffect(() => {
    if (!limit || done) return undefined
    const t = setInterval(() => setTimeLeft((v) => v - 1), 1000)
    return () => clearInterval(t)
  }, [limit, done])
  useEffect(() => { if (limit && timeLeft <= 0 && !done) finish(true) }, [timeLeft, limit, done, finish])

  const noteWrong = (card) => {
    const w = wrongs + 1
    setWrongs(w)
    playSound('wrong')
    setFlash((f) => ({ ...f, [card.id]: 'bad' }))
    setTimeout(() => setFlash((f) => { const n = { ...f }; delete n[card.id]; return n }), 650)
    const after = card.props.hintAfter || 2
    if (card.props.onWrong === 'hint' || w >= after) {
      if (!hintOn) hintsUsed.current += 1
      setHintOn(true)
      setHintSlot(card.props.correctSlot || null)
      setMessage('Try this one!')
      setTimeout(() => { setHintSlot(null); setMessage(null) }, 2600)
    }
    return w
  }

  const noteRight = (card) => {
    playSound(card.props.sound || 'ding')
    setFlash((f) => ({ ...f, [card.id]: 'ok' }))
    setTimeout(() => setFlash((f) => { const n = { ...f }; delete n[card.id]; return n }), 700)
  }

  // ── Dragging a card onto a slot ─────────────────────────────────────────
  const toStage = (clientX, clientY) => {
    const r = stageRef.current.getBoundingClientRect()
    return { x: ((clientX - r.left) / r.width) * STAGE.w, y: ((clientY - r.top) / r.height) * STAGE.h }
  }
  const startDrag = (e, card) => {
    if (done || mode !== 'slots' || !card.props.correctSlot || placed[card.id]) return
    e.preventDefault()
    const start = toStage(e.clientX, e.clientY)
    let moved = false
    const base = { x: card.x, y: card.y }
    setDrag({ id: card.id, x: base.x, y: base.y })
    const move = (ev) => {
      const p = toStage(ev.clientX, ev.clientY)
      if (Math.hypot(p.x - start.x, p.y - start.y) > 6) moved = true
      setDrag({ id: card.id, x: base.x + p.x - start.x, y: base.y + p.y - start.y })
    }
    const up = (ev) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setDrag(null)
      if (!moved) { if (card.props.readOnTap) speak(card.props.voice || card.props.label, card.props.language || language); return }
      const p = toStage(ev.clientX, ev.clientY)
      const slot = slots
        .filter((s) => p.x >= s.x - 24 && p.x <= s.x + s.w + 24 && p.y >= s.y - 24 && p.y <= s.y + s.h + 24)
        .sort((a, b) => Math.hypot(p.x - (a.x + a.w / 2), p.y - (a.y + a.h / 2)) - Math.hypot(p.x - (b.x + b.w / 2), p.y - (b.y + b.h / 2)))[0]
      if (!slot) return // dropped on nothing: it just slides back, no penalty
      const inSlot = Object.values(placed).filter((x) => x.slotId === slot.id)
      if (!slot.props.multiple && inSlot.length) return // a numbered slot holds one card
      if (!isCorrectDrop(card, slot)) { noteWrong(card); return }
      noteRight(card)
      let x = slot.x + (slot.w - card.w) / 2, y = slot.y + (slot.h - card.h) / 2, s = 1
      if (slot.props.multiple) {
        s = 0.55
        const cw = card.w * s + 8, ch = card.h * s + 8
        const cols = Math.max(1, Math.floor(slot.w / cw))
        const n = inSlot.length
        x = slot.x + 8 + (n % cols) * cw - (card.w - card.w * s) / 2
        y = slot.y + 34 + Math.floor(n / cols) * ch - (card.h - card.h * s) / 2
      }
      const next = { ...placed, [card.id]: { slotId: slot.id, x, y, s } }
      setPlaced(next)
      if (toPlace.every((c) => next[c.id])) setTimeout(() => finish(false, wrongs), 450)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  // ── Tap / speak levels ──────────────────────────────────────────────────
  const tapCard = (card) => {
    if (done) return
    if (mode === 'slots') return
    if (card.props.readOnTap) speak(card.props.voice || card.props.label, card.props.language || language)
    if (mode !== 'tap') return
    if (card.props.isAnswer) { noteRight(card); setCorrectTaps((n) => n + 1); setTimeout(() => finish(false, wrongs), 500) } else noteWrong(card)
  }
  const speakAnswer = (el) => {
    if (done) return
    if (!canListen()) return
    if (listening) { stopListen.current?.(); return }
    setListening(true)
    stopListen.current = listenOnce(language, (alts) => {
      if (alts.some((a) => speechMatches(a, el.props.expected))) { playSound('ding'); setCorrectTaps(1); setTimeout(() => finish(false, wrongs), 400) } else { playSound('wrong'); setWrongs((w) => w + 1); setMessage('Try saying it again!'); setTimeout(() => setMessage(null), 2000) }
    }, () => setListening(false))
    if (!stopListen.current) setListening(false)
  }
  const assistedYes = () => { setCorrectTaps(1); finish(false, wrongs) }

  const pressButton = (el) => {
    if (el.props.action === 'hint') { if (!hintOn) hintsUsed.current += 1; setHintOn(true); return }
    if (el.props.action === 'restart') { onRestart(); return }
    if (el.props.action === 'next' && done) onDone({ wrongs, hints: hintsUsed.current, stars: done.stars, seconds: Math.round((Date.now() - startedAt.current) / 1000), correct: mode === 'slots' ? toPlace.length : correctTaps || 1 })
  }

  const goNext = () => onDone({ wrongs, hints: hintsUsed.current, stars: done.stars, seconds: Math.round((Date.now() - startedAt.current) / 1000), correct: mode === 'slots' ? toPlace.length : correctTaps || 1 })

  return (
    <>
      {sortZ(level.elements).map((el) => {
        if (el.type === 'sound_effect' || el.type === 'animation') return null
        const isCard = el.type === 'image_card'
        const inPlace = isCard && placed[el.id]
        const dragging = drag?.id === el.id
        const x = dragging ? drag.x : inPlace ? inPlace.x : el.x
        const y = dragging ? drag.y : inPlace ? inPlace.y : el.y
        const status = {
          ring: flash[el.id] === 'ok' ? '#16a34a' : flash[el.id] === 'bad' ? '#dc2626' : undefined,
          highlight: el.type === 'drop_slot' && hintSlot && el.props.slot === hintSlot,
          hintOn, timeLeft: Math.max(0, timeLeft), stars: done?.stars, message: el.type === 'pao_helper' ? message : undefined, listening,
        }
        const interactive = isCard || ['voice_prompt', 'speak_answer', 'button'].includes(el.type)
        const onClick = () => {
          if (el.type === 'voice_prompt') speak(el.props.voice || level.voice, el.props.language || language)
          else if (el.type === 'speak_answer') speakAnswer(el)
          else if (el.type === 'button') pressButton(el)
          else if (isCard) tapCard(el)
        }
        return (
          <div key={el.id} role={interactive ? 'button' : undefined} tabIndex={interactive ? 0 : -1} aria-label={isCard ? (el.props.alt || el.props.label || 'card') : undefined}
            onPointerDown={isCard ? (e) => startDrag(e, el) : undefined}
            onClick={onClick}
            onKeyDown={(e) => { if (interactive && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick() } }}
            style={{ position: 'absolute', left: x, top: y, width: el.w, height: el.h, zIndex: dragging ? 9000 : el.z + 1 + (inPlace ? 100 : 0), transform: inPlace ? `scale(${inPlace.s})` : dragging ? 'scale(1.06)' : undefined, transition: dragging ? 'none' : 'left .25s, top .25s, transform .2s', cursor: isCard && mode === 'slots' && !inPlace ? 'grab' : interactive ? 'pointer' : 'default', touchAction: isCard ? 'none' : undefined, animation: flash[el.id] === 'bad' ? 'gbShake .4s' : el.props.animation === 'bounce_in' ? 'gbBounceIn .5s both' : el.props.animation === 'fade_in' ? 'gbFadeIn .6s both' : undefined, outlineOffset: 4 }}>
            <ElementView el={el} mode="play" status={status} />
          </div>
        )
      })}

      <Caption text={level.instructions} />

      {mode === 'speak' && !canListen() && !done && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 80, display: 'flex', justifyContent: 'center', gap: 12, zIndex: 4500 }}>
          <span style={{ background: '#fff', borderRadius: 12, padding: '10px 16px', fontWeight: 700, color: '#5d7770' }}>No microphone here. Did they say it?</span>
          <button type="button" onClick={assistedYes} style={{ minHeight: 48, border: 'none', borderRadius: 12, background: '#234C40', color: '#fff', fontWeight: 800, padding: '0 22px', fontSize: 18, cursor: 'pointer' }}>✓ Yes</button>
        </div>
      )}

      {done && (
        <div role="dialog" aria-label="Level complete" style={{ position: 'absolute', inset: 0, zIndex: 9500, background: 'rgba(23,48,42,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {(hasAnimation?.props.animation !== 'none') && Array.from({ length: 18 }).map((_, i) => (
            <span key={i} aria-hidden="true" style={{ position: 'absolute', top: 0, left: `${(i * 53) % 100}%`, fontSize: 30, animation: `gbConfetti ${1.6 + (i % 5) * 0.3}s ease-in ${(i % 6) * 0.12}s both` }}>{['🎉', '⭐', '✨', '🎈'][i % 4]}</span>
          ))}
          <div style={{ background: '#fff', borderRadius: 28, padding: '34px 54px', textAlign: 'center', animation: 'gbBounceIn .5s both' }}>
            <div style={{ fontSize: 46 }} aria-hidden="true">🐼</div>
            <h2 style={{ margin: '4px 0', fontSize: 38, color: '#1f3d36' }}>{done.timedOut ? 'Time’s up — nice try!' : 'Great job!'}</h2>
            <div style={{ fontSize: 64 }} aria-label={`${done.stars} of 3 stars`}>{[1, 2, 3].map((n) => <span key={n} style={{ opacity: n <= done.stars ? 1 : 0.25, filter: n <= done.stars ? 'none' : 'grayscale(1)' }}>⭐</span>)}</div>
            <button type="button" onClick={goNext} autoFocus style={{ marginTop: 14, minHeight: 60, border: 'none', borderRadius: 18, background: '#234C40', color: '#fff', fontWeight: 800, fontSize: 24, padding: '0 40px', cursor: 'pointer' }}>Next ›</button>
          </div>
        </div>
      )}
    </>
  )
}

export default function GamePlayer({ doc, language, device = 'fill', onFinish, onExit, finishLabel = 'Done' }) {
  const [li, setLi] = useState(0)
  const [run, setRun] = useState(0)
  const [results, setResults] = useState([])
  const [over, setOver] = useState(false)
  const stageRef = useRef(null)
  const startedAt = useRef(Date.now())
  const reported = useRef(false)
  const lang = language || doc.settings?.language || 'en'
  const level = doc.levels[li]

  const onDone = (r) => {
    const all = [...results, r]
    setResults(all)
    if (li + 1 < doc.levels.length) { setLi(li + 1); setRun((n) => n + 1); return }
    setOver(true)
    if (!reported.current) {
      reported.current = true
      const wrongs = all.reduce((a, x) => a + x.wrongs, 0)
      const correct = all.reduce((a, x) => a + x.correct, 0)
      const stars = Math.max(1, Math.round(all.reduce((a, x) => a + x.stars, 0) / all.length))
      onFinish?.({ correct, attempts: correct + wrongs, hints_used: all.reduce((a, x) => a + x.hints, 0), stars, perfect: wrongs === 0, duration_seconds: Math.round((Date.now() - startedAt.current) / 1000), detail: { levels: all.length } })
    }
  }
  const restartAll = () => { setLi(0); setRun((n) => n + 1); setResults([]); setOver(false); reported.current = false; startedAt.current = Date.now() }

  if (!level) return <div style={{ padding: 40, textAlign: 'center' }}>This game has no levels yet.</div>

  const totalStars = results.reduce((a, x) => a + x.stars, 0)
  return (
    <StageViewport device={device} background={over ? '#FFF4DE' : level.background} stageRef={stageRef}>
      {over ? (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, textAlign: 'center' }}>
          <div style={{ fontSize: 90 }} aria-hidden="true">🏆</div>
          <h2 style={{ margin: 0, fontSize: 52, color: '#1f3d36' }}>You finished {doc.meta.name}!</h2>
          <div style={{ fontSize: 34, fontWeight: 800, color: '#7a4b06' }}>⭐ {totalStars} star{totalStars === 1 ? '' : 's'}</div>
          <div style={{ display: 'flex', gap: 14, marginTop: 10 }}>
            <button type="button" onClick={restartAll} style={{ minHeight: 60, border: '2px solid #234C40', borderRadius: 18, background: '#fff', color: '#234C40', fontWeight: 800, fontSize: 22, padding: '0 30px', cursor: 'pointer' }}>Play again</button>
            <button type="button" onClick={onExit} style={{ minHeight: 60, border: 'none', borderRadius: 18, background: '#234C40', color: '#fff', fontWeight: 800, fontSize: 22, padding: '0 36px', cursor: 'pointer' }}>{finishLabel}</button>
          </div>
        </div>
      ) : (
        <LevelRun key={`${level.id}-${li}-${run}`} level={level} stageRef={stageRef} language={lang} readAloud={doc.settings?.readAloud !== false}
          onDone={onDone} onRestart={() => setRun((n) => n + 1)} />
      )}
    </StageViewport>
  )
}
