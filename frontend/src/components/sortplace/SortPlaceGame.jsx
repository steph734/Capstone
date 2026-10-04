import { useEffect, useMemo, useRef, useState } from 'react'
import SunnyScenery from '../../pages/games/SunnyScenery'
import PaoGuide from '../PaoGuide'
import GameFinishScreen from '../GameFinishScreen'
import { resolveSequence, activeZoneKey, stepIndexOf, tapPiece, tapZone, isLevelComplete, withItemIds, isCoinItem, correctZoneFor } from './sortLogic'

// A generic "sort into zones" game driven entirely by the game document:
// zones (array order = sorting order), sequence, levels, and support settings.
// Tap a piece, then tap its zone. Mistakes are gentle, never red or buzzing.
const HEADING = { fontFamily: "'Baloo 2', system-ui, sans-serif" }
const BODY = { fontFamily: "'Atkinson Hyperlegible', system-ui, sans-serif" }
const SPEECH_LANG = { en: 'en-US', tl: 'fil-PH', ceb: 'fil-PH' }
const ZONE_ICON = { wallet: '👛', purse: '🪙' }

// Phones get smaller pieces so the tray and zones fit without sideways scrolling.
function useIsNarrow() {
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    const on = () => setNarrow(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return narrow
}

function speakLine(text, lang, enabled) {
  if (!enabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return
  try {
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 0.85
    u.lang = SPEECH_LANG[lang] || 'en-US'
    window.speechSynthesis.speak(u)
  } catch { /* read-aloud is best-effort */ }
}

export default function SortPlaceGame({ game, lang = 'en', onExit, onFinish }) {
  const sp = game.typeSettings?.sort_place || {}
  const zones = sp.zones || []
  const sequence = resolveSequence(sp.sequence)
  const levels = game.levels || []
  const readAloud = game.support?.read_aloud !== false
  const glowAfter = game.support?.prompt_level === 'full_model' ? 2 : null

  const [levelIdx, setLevelIdx] = useState(0)
  const [placed, setPlaced] = useState(() => new Set())
  const [selectedId, setSelectedId] = useState(null)
  const [wrongByItem, setWrongByItem] = useState({})
  const [glowZone, setGlowZone] = useState(null)
  const [line, setLine] = useState({ text: '', tone: 'neutral' })
  const [levelDone, setLevelDone] = useState(false)
  const [finished, setFinished] = useState(false)
  const totals = useRef({ placed: 0, wrong: 0, hints: 0 })
  const finishedRef = useRef(false)

  const level = levels[levelIdx]
  const items = useMemo(() => withItemIds(level?.items, level?.level_order ?? levelIdx + 1), [level, levelIdx])
  const activeKey = activeZoneKey(items, placed, zones, sequence)
  const activeIdx = stepIndexOf(zones, activeKey)

  const say = (text, tone = 'neutral') => {
    setLine({ text, tone })
    speakLine(text, lang, readAloud)
  }

  useEffect(() => {
    if (!items.length) return
    say(sequence === 'zone_by_zone' && activeKey
      ? `Let's sort! Start with the ${zoneLabel(activeKey)}. Tap a piece, then tap the ${zoneLabel(activeKey)}.`
      : "Let's sort! Tap a piece, then tap the zone it goes in.", 'neutral')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelIdx])

  useEffect(() => () => { try { window.speechSynthesis?.cancel() } catch { /* ignore */ } }, [])

  const zoneLabel = (key) => zones.find((z) => z.zone_key === key)?.label || key

  const handlePieceTap = (item) => {
    if (levelDone) return
    const r = tapPiece(items, placed, zones, sequence, item.id)
    if (r.status === 'placed') return
    if (r.status === 'wrong_step') {
      setSelectedId(null)
      say(isCoinItem(item)
        ? `That is a coin. ${zoneLabel(activeKey)} first! Find the ${zoneLabel(activeKey) === 'Wallet' ? 'paper money' : 'coins'}.`
        : `Not yet! Put the ${zoneLabel(activeKey).toLowerCase()} first.`, 'hint')
      return
    }
    setSelectedId((cur) => (cur === item.id ? null : item.id))
    say(`Now tap the ${zoneLabel(item.zone_key)}.`, 'neutral')
  }

  const handleZoneTap = (zoneKey) => {
    if (levelDone) return
    const r = tapZone(items, placed, zones, sequence, selectedId, zoneKey)
    if (r.status === 'no_selection') {
      say('First, tap a piece.', 'hint')
      return
    }
    if (r.status === 'wrong_step') {
      say(`Bills first! The ${zoneLabel(activeKey).toLowerCase()} go in the ${zoneLabel(activeKey)}.`, 'hint')
      return
    }
    if (r.status === 'wrong_zone') {
      const item = items.find((it) => it.id === selectedId)
      totals.current.wrong += 1
      const misses = (wrongByItem[selectedId] || 0) + 1
      setWrongByItem((m) => ({ ...m, [selectedId]: misses }))
      say(`That is ${isCoinItem(item) ? 'a coin' : 'paper money'}. ${zoneLabel(item.zone_key)} is the right place.`, 'hint')
      if (glowAfter && misses >= glowAfter) {
        const correct = correctZoneFor(items, selectedId)
        if (glowZone !== correct) {
          setGlowZone(correct)
          totals.current.hints += 1
        }
      }
      return
    }

    // placed
    const next = new Set(placed)
    next.add(r.itemId)
    totals.current.placed += 1
    setPlaced(next)
    setSelectedId(null)
    setGlowZone(null)
    setLine({ text: `Yes! The ${items.find((it) => it.id === r.itemId).label} goes in the ${zoneLabel(zoneKey)}.`, tone: 'success' })
    speakLine(`Yes! The ${items.find((it) => it.id === r.itemId).label} goes in the ${zoneLabel(zoneKey)}.`, lang, readAloud)

    if (isLevelComplete(items, next)) {
      setLevelDone(true)
      const billsText = sequence === 'zone_by_zone' && zones.length > 1
        ? `All the ${zoneLabel(zones[0].zone_key).toLowerCase()} are in the ${zoneLabel(zones[0].zone_key)}! Now put the ${zoneLabel(zones[1].zone_key).toLowerCase()} in the ${zoneLabel(zones[1].zone_key)}.`
        : 'All sorted!'
      if (levelIdx === levels.length - 1) {
        // Final level done: this is the moment the game is finished and rewarded.
        setTimeout(() => finishGame(next), 900)
      } else {
        setTimeout(() => say(billsText, 'success'), 500)
      }
    }
  }

  const finishGame = (finalPlaced) => {
    if (finishedRef.current) return
    finishedRef.current = true
    setFinished(true)
    const t = totals.current
    const total = levels.reduce((n, l) => n + (l.items?.length || 0), 0)
    const result = {
      correct: total,
      attempts: t.placed + t.wrong,
      hints_used: t.hints,
      stars: total,
      detail: { level_order: levels[levelIdx]?.level_order ?? levelIdx + 1, levels: levels.length, placed: finalPlaced?.size ?? 0 },
    }
    onFinish?.(result)
    say('All sorted! Pao is so proud of you!', 'success')
  }

  const nextLevel = () => {
    setLevelIdx((i) => i + 1)
    setPlaced(new Set())
    setSelectedId(null)
    setWrongByItem({})
    setGlowZone(null)
    setLevelDone(false)
  }

  const levelLabel = level ? `Level ${level.level_order} · ${level.level_name}` : ''
  const billsOrder = zones.map((z, i) => `${i + 1}. ${z.label}`).join('  ')
  const narrow = useIsNarrow()
  const pieceSize = (it) => (isCoinItem(it) ? (narrow ? 60 : 84) : (narrow ? 104 : 124))

  if (finished) {
    const total = levels.reduce((n, l) => n + (l.items?.length || 0), 0)
    const isLast = levelIdx >= levels.length - 1
    const gains = Object.entries(game.statGains || {}).filter(([, v]) => v > 0).map(([k, v]) => `${k[0].toUpperCase()}${k.slice(1)} +${v}`)
    const restart = () => { finishedRef.current = false; totals.current = { placed: 0, wrong: 0, hints: 0 }; setFinished(false); setLevelIdx(0); nextLevel() }
    const nextOne = () => { finishedRef.current = false; setFinished(false); nextLevel() }
    return (
      <GameFinishScreen
        title={isLast ? 'All sorted!' : 'Level done!'}
        subtitle={`All ${total} pieces are in the right places.`}
        badge={game.badge ? { name: game.badge.name, shape: game.badge.shape, colour: game.badge.colour, symbol: game.badge.symbol } : null}
        badgeFallback={{ emoji: '💵', name: game.badge?.name || 'Money Match' }}
        xp={game.pointsPerPlay ?? 100}
        chips={gains}
        replayLabel={isLast ? 'Play again' : 'Next level'}
        onReplay={isLast ? restart : nextOne}
        onExit={onExit}
      />
    )
  }

  return (
    <Shell>
      {/* Top bar */}
      <div className="relative z-10 flex flex-shrink-0 flex-wrap items-center justify-between gap-2 px-4 py-3">
        <button type="button" onClick={onExit} className="flex h-12 items-center gap-2 rounded-full bg-white px-4 text-[15px] font-extrabold text-[#2B2366] shadow-md focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6]" style={HEADING}>← Games</button>
        <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-md" style={HEADING}>
          <span className="text-[16px] font-extrabold text-[#2B2366]">{game.name}</span>
          <span className="rounded-full bg-[#ede9fe] px-2.5 py-0.5 text-[13px] font-bold text-[#5b21b6]">{levelLabel}</span>
        </div>
        <div className="flex h-12 items-center gap-1.5 rounded-full bg-white px-4 text-[17px] font-extrabold text-[#C97A00] shadow-md" style={HEADING}>⭐ {totals.current.placed}</div>
      </div>

      {/* Step pills */}
      <div className="relative z-10 flex flex-shrink-0 flex-wrap justify-center gap-2 px-4 pb-2">
        {zones.map((z, i) => {
          const zoneItems = items.filter((it) => it.zone_key === z.zone_key)
          const done = zoneItems.length > 0 && zoneItems.every((it) => placed.has(it.id))
          const active = sequence === 'zone_by_zone' ? z.zone_key === activeKey : !done
          return (
            <span key={z.zone_key} className={`rounded-full px-4 py-1.5 text-[14px] font-extrabold ${done ? 'bg-[#2F8A4C] text-white' : active ? 'bg-[#6D4AE0] text-white' : 'bg-white text-[#5A5670]'}`} style={HEADING}>
              {done ? '✓ ' : ''}{i + 1}. {zoneLabelTitle(z)}
            </span>
          )
        })}
      </div>

      {/* Tray — all items of the level, mixed in their saved order */}
      <div className="relative z-10 mx-4 flex flex-shrink-0 flex-wrap items-center justify-center gap-3 rounded-[32px] sm:gap-4 bg-white/85 px-5 py-4 shadow-lg" role="group" aria-label="Pieces to sort">
        {items.filter((it) => !placed.has(it.id)).map((it) => {
          const isSel = selectedId === it.id
          const dim = sequence === 'zone_by_zone' && activeKey && it.zone_key !== activeKey
          return (
            <Piece
              key={it.id}
              item={it}
              width={pieceSize(it)}
              selected={isSel}
              dim={dim}
              onTap={() => handlePieceTap(it)}
            />
          )
        })}
        {items.every((it) => placed.has(it.id)) && <p className="text-[16px] font-bold text-[#2F8A4C]">Every piece is sorted.</p>}
      </div>

      {/* Pao + bubble */}
      <PaoGuide tone={line.tone} bubbleStyle={BODY}>
        {line.text}
      </PaoGuide>

      {levelDone && levelIdx < levels.length - 1 && (
        <div className="relative z-10 mx-4 mb-2 flex justify-center">
          <button type="button" onClick={nextLevel} className="h-14 rounded-2xl bg-[#6D4AE0] px-8 text-[18px] font-extrabold text-white focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6]" style={HEADING}>Next level</button>
        </div>
      )}

      {/* Zones — in zones order */}
      <div className="relative z-10 mx-4 mt-3 grid flex-1 grid-cols-1 gap-4 pb-4 md:grid-cols-2">
        {zones.map((z) => {
          const zoneItems = items.filter((it) => it.zone_key === z.zone_key)
          const sorted = zoneItems.filter((it) => placed.has(it.id))
          const isActive = sequence === 'zone_by_zone' ? z.zone_key === activeKey : true
          const glow = glowZone === z.zone_key
          return (
            <button
              key={z.zone_key}
              type="button"
              onClick={() => handleZoneTap(z.zone_key)}
              aria-label={`${z.label}: ${sorted.length} of ${zoneItems.length} sorted`}
              className={`flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-[32px] border-[3px] border-dashed bg-white/80 p-4 transition-opacity focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6] ${isActive ? 'opacity-100' : 'opacity-55'} ${glow ? 'ring-4 ring-[#F59E0B]' : ''}`}
              style={{ borderColor: z.color || '#8A5A3B', ...(sp.show_target_outlines === false ? { borderStyle: 'solid' } : {}) }}
            >
              <span className="text-[44px]" aria-hidden="true">{ZONE_ICON[z.zone_key] || '📦'}</span>
              <span className="text-[22px] font-extrabold text-[#2B2366]" style={HEADING}>{z.label}</span>
              <span className="rounded-full px-3 py-1 text-[13px] font-extrabold" style={{ background: sorted.length === zoneItems.length && zoneItems.length ? '#E3F4E8' : '#FFF0CC', color: sorted.length === zoneItems.length && zoneItems.length ? '#2F8A4C' : '#C97A00' }}>
                {sorted.length === zoneItems.length && zoneItems.length ? `Done ${sorted.length} / ${zoneItems.length}` : `${sorted.length} / ${zoneItems.length}`}
              </span>
              <span className="flex min-h-[48px] flex-wrap justify-center gap-1.5">
                {sorted.map((it) => <Piece key={it.id} item={it} width={isCoinItem(it) ? (narrow ? 26 : 34) : (narrow ? 42 : 52)} small />)}
              </span>
            </button>
          )
        })}
      </div>
      {billsOrder && <p className="sr-only">Sort order: {billsOrder}</p>}
    </Shell>
  )
}

function zoneLabelTitle(z) {
  return z.label
}

function Shell({ children }) {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col overflow-y-auto overscroll-contain" style={BODY}>
      <SunnyScenery />
      <div className="relative z-10 flex min-h-full flex-col">{children}</div>
    </div>
  )
}

function Piece({ item, width, selected = false, dim = false, small = false, onTap }) {
  const coin = isCoinItem(item)
  const [broken, setBroken] = useState(false)
  const Tag = onTap ? 'button' : 'span'
  return (
    <Tag
      type={onTap ? 'button' : undefined}
      onClick={(e) => { if (onTap) { e.stopPropagation(); onTap() } }}
      aria-pressed={onTap ? selected : undefined}
      aria-label={item.label}
      className={`flex flex-col items-center justify-center transition-transform ${onTap ? 'min-h-[64px] cursor-pointer' : ''} ${selected ? '-translate-y-2' : ''} ${dim ? 'opacity-60' : ''} focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6]`}
      style={{ width, ...(selected ? { filter: 'drop-shadow(0 0 0 #6D4AE0)' } : {}) }}
    >
      <span
        className={`flex items-center justify-center overflow-hidden bg-white ${coin ? 'rounded-full shadow-none' : 'rounded-xl shadow-md'} ${selected ? 'ring-4 ring-[#6D4AE0]' : ''}`}
        style={{ width, height: coin ? width : Math.round(width * 0.5), borderRadius: coin ? '50%' : undefined }}
      >
        {!broken && item.image_url
          ? <img src={item.image_url} alt={item.label} onError={() => setBroken(true)} className="h-full w-full object-contain" draggable={false} />
          : <span className="text-[28px]" aria-hidden="true">{coin ? '🪙' : '💵'}</span>}
      </span>
      {!small && <span className="mt-1 text-[15px] font-extrabold text-[#2B2A4C]" style={HEADING}>{item.text || item.label}</span>}
    </Tag>
  )
}
