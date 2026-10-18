import { useEffect, useMemo, useRef, useState } from 'react'
import { Lightbulb } from 'lucide-react'
import { GoBagArt, ItemIcon } from './illustrations/Scene'
import { ITEM_LABELS, shuffle } from './emergencies'

// Pack the go-bag: 6 needed items and 2 that are not needed. A wrong item just returns, with a kind note.
export default function GoBag({ emergency, paused, talk, onPacked, onWrong, onHint, sound, playPack }) {
  const items = useMemo(() => shuffle([...emergency.goBag.needed, ...emergency.goBag.notNeeded]), [emergency])
  const [packed, setPacked] = useState([])
  const [wrongId, setWrongId] = useState(null)
  const [glow, setGlow] = useState(null)
  const idle = useRef(null)
  const needed = emergency.goBag.needed
  const total = needed.length

  // No tap for 8 seconds: a gentle nudge, never a countdown.
  useEffect(() => {
    if (paused || packed.length >= total) return undefined
    idle.current = setTimeout(() => talk('thinking', 'What would keep us *safe*?', 'What would keep us safe?'), 8000)
    return () => clearTimeout(idle.current)
  }, [paused, packed.length, wrongId, total, talk])

  const tap = (id) => {
    if (paused || packed.includes(id)) return
    if (needed.includes(id)) {
      const next = [...packed, id]
      setPacked(next)
      if (glow === id) setGlow(null)
      if (sound) playPack()
      talk('packed', `Good thinking! *${ITEM_LABELS[id]}* goes in the bag.`, `Good thinking! ${ITEM_LABELS[id]} goes in the bag.`)
      if (next.length === total) setTimeout(() => onPacked(), 1200)
    } else {
      onWrong()
      setWrongId(id)
      setTimeout(() => setWrongId((w) => (w === id ? null : w)), 2000)
      talk('gentleNo', `${ITEM_LABELS[id]} is fun, but it won't keep us *safe*.`, `${ITEM_LABELS[id]} is fun, but it won't keep us safe.`)
    }
  }

  const hint = () => {
    const id = needed.find((n) => !packed.includes(n))
    if (!id) return
    onHint()
    setGlow(id)
    talk('showing', `Look! *${ITEM_LABELS[id]}* would keep us safe.`, `Look! ${ITEM_LABELS[id]} would keep us safe.`)
  }

  return (
    <div className="er-main er-bagmain">
      <div className="er-bagcard">
        <GoBagArt className="er-bagart" />
        <strong>{packed.length} of {total} packed</strong>
        <small>Pack the things that keep you safe</small>
        <div className="er-slots">
          {Array.from({ length: total }, (_, i) => (
            <div key={i} className={`er-bslot${packed[i] ? ' on' : ''}`} aria-label={packed[i] ? ITEM_LABELS[packed[i]] : 'empty'}>{packed[i] && <ItemIcon id={packed[i]} />}</div>
          ))}
        </div>
      </div>
      <div className="er-items">
        <span className="er-label">Tap the things a go-bag needs</span>
        <div className="er-itemgrid">
          {items.map((id) => {
            const isPacked = packed.includes(id)
            return (
              <button key={id} type="button" className={`er-item${isPacked ? ' packed' : ''}${wrongId === id ? ' no' : ''}${glow === id ? ' glow' : ''}`} onClick={() => tap(id)} aria-label={ITEM_LABELS[id]} disabled={isPacked}>
                {wrongId === id && <span className="er-notneeded">Not needed in a go-bag</span>}
                <div className="er-itempic"><ItemIcon id={id} /></div>
                <span>{ITEM_LABELS[id]}</span>
              </button>
            )
          })}
        </div>
      </div>
      <div className="er-bagactions"><button type="button" className="er-white" onClick={hint}><Lightbulb size={20} aria-hidden="true" /> Hint</button></div>
    </div>
  )
}
