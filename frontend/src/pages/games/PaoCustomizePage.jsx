import { useState, useEffect, useMemo, useRef } from 'react'
import PandaMascot from './PandaMascot'
import { OutfitThumbnail } from './PaoOutfits'
import { DesignedOutfitThumbnail } from './PaoDesignedOutfit'
import { speakPao, stopPaoVoice } from '../../utils/paoVoice'
import { CUSTOMIZE_LINES, pickLine } from '../../utils/paoLines'
import { usePao } from '../../context/PaoContext'
import { getWardrobe, getPaoStyles } from '../../utils/paoApi'
import { describeUnlock } from '../admin/PaoClothingDesigner'
import BadgeCaseView from '../../components/hub/BadgeCase'
import PaoLayered from '../../components/pao/PaoLayered'
import PaoAvatar from '../../components/pao/PaoAvatar'
import PaoSpeechBubble from '../../components/pao/PaoSpeechBubble'
import { paoSay } from '../../components/pao/paoLines'
import { loadLayerManifest, layerUrl, resolveItemKey, LAYER_CATEGORIES } from '../../components/pao/paoLayers'
import { usePaoReaction } from '../../components/pao/usePaoReaction'

const EQUIP_LINES = ["Ooh, I love it!", "So stylish!", "Looking good!", "Yay, perfect!", "This is my favorite!"]
function useReducedMotionCM() {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => setReduced(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return reduced
}
function softPop() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const osc = ctx.createOscillator(); const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(560, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(820, ctx.currentTime + 0.08)
    gain.gain.setValueAtTime(0.05, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
    osc.start(); osc.stop(ctx.currentTime + 0.16)
    osc.onended = () => ctx.close()
  } catch { /* sound is a nice-to-have */ }
}

// Card icon for a single hat/clothes/pants/shoes item: the item's own
// layer art (there's no full-body render set yet), cropped to the relevant
// body part. Locked items stay in full colour at reduced opacity with a
// lock chip, rather than a grey silhouette.
//
// Every layer shares one 300x380 canvas (viewBox "0 -40 300 380"). Rather
// than fight object-fit/object-position math, each category's crop is a
// measured center point (as a fraction of that canvas) plus a zoom, used to
// pan+scale a full-size <img>. Centers were read off the actual SVGs:
// hats sit around y=20%-30% of the canvas, clothes bodies around y=75%-85%,
// pants around y=85%-95%, shoes (a left+right pair) around y=90%-95% and
// need a wider zoom to keep both shoes in frame.
const LAYER_PICK = { hats: 'hat', clothes: 'body', pants: 'body', shoes: 'fore' }
const CROP_CENTER = { hats: { x: 0.5, y: 0.28 }, clothes: { x: 0.5, y: 0.79 }, pants: { x: 0.5, y: 0.895 }, shoes: { x: 0.5, y: 0.92 } }
const CROP_ZOOM = { hats: 2.4, clothes: 2.1, pants: 2.6, shoes: 1.6 }
const CANVAS_ASPECT = 380 / 300

function LayerCardIcon({ manifest, category, itemKey, unlocked, width = 64, natural = false }) {
  const layer = natural ? { file: 'base-bottom.svg' } : manifest?.layers?.find((l) => l.category === category && l.item_key === itemKey && l.layer === (LAYER_PICK[category] || l.layer))
    || manifest?.layers?.find((l) => l.category === category && l.item_key === itemKey)
  if (!layer) return null

  const zoom = CROP_ZOOM[category] || 2.2
  const center = CROP_CENTER[category] || { x: 0.5, y: 0.5 }
  const imgW = width * zoom
  const imgH = imgW * CANVAS_ASPECT
  const left = -(center.x * imgW - width / 2)
  const top = -(center.y * imgH - width / 2)

  return (
    <div style={{ width, height: width, borderRadius: 10, overflow: 'hidden', background: 'transparent', position: 'relative' }}>
      <img
        src={layerUrl(layer.file)}
        alt=""
        draggable={false}
        style={{ position: 'absolute', width: imgW, height: imgH, left, top, opacity: unlocked ? 1 : 0.55, filter: unlocked ? 'none' : 'grayscale(1)' }}
        onError={(e) => { e.currentTarget.parentElement.style.display = 'none' }}
      />
      {!unlocked && (
        <span style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: '50%', background: '#1e293b', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }} aria-hidden="true"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></span>
      )}
    </div>
  )
}

// ─── Badge definitions ────────────────────────────────────────────────────────

const BADGES = {
  'First Win':      { emoji:'🥇', color:'#f59e0b', how:'Complete any game once' },
  'Word Wizard':    { emoji:'🧙', color:'#8b5cf6', how:'Finish Picture-Word Matching' },
  'Perfect Score':  { emoji:'⭐', color:'#fbbf24', how:'Get 6/6 in any game' },
  'Level 2':        { emoji:'⬆️', color:'#10b981', how:'Gain 100 XP' },
  'Level 3':        { emoji:'⬆️', color:'#10b981', how:'Gain 300 XP' },
  'Level 5':        { emoji:'⬆️', color:'#10b981', how:'Gain 700 XP' },
  'Word Master':    { emoji:'📚', color:'#6366f1', how:'Complete all 4 word categories' },
  'Super Player':   { emoji:'🦸', color:'#ef4444', how:'Play 5 games without stopping' },
  'Cozy Player':    { emoji:'🌙', color:'#8b5cf6', how:'Play after 8pm' },
  'Star Collector': { emoji:'✨', color:'#f59e0b', how:'Score 3 stars in any game' },
  'Explorer':       { emoji:'🗺️', color:'#10b981', how:'Try all 4 categories' },
  'Story Builder':  { emoji:'📖', color:'#7c3aed', how:'Finish the Story Builder game' },
  'Fashionista':    { emoji:'💅', color:'#ec4899', how:'Unlock 5 outfit pieces' },
  'Alphabet Blast': { emoji:'🚀', color:'#ef4444', how:'Finish the Alphabet Blast game' },
  'Echo Master':    { emoji:'📣', color:'#14b8a6', how:'Say every syllable clearly across all 4 Echo levels' },
  'Puzzle Pro':     { emoji:'🧩', color:'#34d399', how:'Finish Puzzle Pals' },
  'Sound Hunter':   { emoji:'🔎', color:'#0ea5e9', how:'Finish Sound Hunt' },
  'Rhyme Master':   { emoji:'🎵', color:'#ec4899', how:'Finish Rhyme Time' },
  'Sentence Star':  { emoji:'✍️', color:'#6366f1', how:'Finish Sentence Builder' },
  'Early Bird':     { emoji:'🌅', color:'#f59e0b', how:'Play before 9am' },
  'Streak Keeper':  { emoji:'🔥', color:'#ef4444', how:'Play 3 days in a row' },
  'Big Brain':      { emoji:'🧠', color:'#8b5cf6', how:'Reach Level 10' },
  'Marathoner':     { emoji:'🏃', color:'#10b981', how:'Play 10 games total' },
  'Helping Hand':   { emoji:'🤝', color:'#14b8a6', how:'Complete an assigned exercise' },
  'Basket Sorter':  { emoji:'🧺', color:'#f59e0b', how:'Finish Sort the Basket' },
}

// ─── Outfit categories ────────────────────────────────────────────────────────
// The catalog itself (names/art/descriptions) now comes from MongoDB — the
// `clothes` collection (hats/clothes/pants/shoes) and `pao_hair` collection
// (hairstyles), fetched in the component below. What stays local here is
// just which of the *original* built-in items each badge unlocks, so the
// existing gameplay-earned-badge experience (BADGES + earnedBadges, a
// separate localStorage mechanic from the admin's Mongo `badges`
// collection) keeps working exactly as before for those 21 pieces.
// Admin-designed pieces added later aren't wired into that badge-gating
// system yet, so they show up already unlocked.
const CATEGORY_META = [
  { id: 'hair', label: 'Hair', icon: '💇' },
  { id: 'hats', label: 'Hats', icon: '🎩' },
  { id: 'clothes', label: 'Clothes', icon: '👕' },
  { id: 'pants', label: 'Pants', icon: '👖' },
  { id: 'shoes', label: 'Shoes', icon: '👟' },
]

const STYLE_TABS = [
  { type: 'pose', label: 'Poses', single: 'POSE' },
  { type: 'expression', label: 'Expressions', single: 'EXPRESSION' },
]

const NATURAL_DESC = {
  hair: 'Just Pao being Pao!',
  hats: 'No hat today!',
  clothes: 'Pao in his natural fluffiness!',
  pants: 'Pao likes keeping it minimal!',
  shoes: "Pao's natural soft paws!",
}

const LEGACY_BADGE_BY_CODE = {
  party_hat: 'First Win', flower_crown: 'Perfect Score', wizard_hat: 'Word Wizard',
  backwards_cap: 'Level 3', bunny_ears: 'Word Master', thinking_cap: 'Puzzle Pro',
  rainbow_tee: 'First Win', astronaut: 'Alphabet Blast', hero_tee: 'Super Player',
  cozy_hoodie: 'Cozy Player', overalls: 'Star Collector', echo_scarf: 'Echo Master', puzzle_vest: 'Puzzle Pro',
  polka_dots: 'First Win', cargo: 'Explorer', pajamas: 'Story Builder', overalls_b: 'Level 5',
  rockets: 'Alphabet Blast', rain_boots: 'Level 2', ballet: 'Fashionista', hightops: 'Star Collector',
}

// The hand-drawn art (OUTFIT_MAP) for built-in pieces, or the generated
// render for admin-designed ones.
function WardrobeThumb({ item, categoryId, width = 72 }) {
  if (item.id === 'none' || !item.code) return <img src="/games/pao-poses-expressions/poses/pose_relax.png" alt="" draggable={false} style={{ width, height: width, objectFit: 'contain', objectPosition: '50% 20%' }} />
  if (item.design) return <DesignedOutfitThumbnail category={categoryId} design={item.design} width={width} />
  return <OutfitThumbnail category={categoryId === 'hats' ? 'hair' : categoryId} itemId={item.code} width={width} />
}

// ─── TTS helper ───────────────────────────────────────────────────────────────

function tts(text, { onStart, onEnd, onWord } = {}) {
  speakPao(text, { pitch: 1.62, rate: 1.1, onStart, onEnd, onWord })
}

// The Badge Case is shared with the hub (src/components/hub/BadgeCase.jsx).
export { default as BadgeCasePage } from '../../components/hub/BadgeCase'

// ─── Bedroom scenery ────────────────────────────────────────────────────────────

function Teddy({ size = 46 }) {
  return (
    <svg viewBox="0 0 60 60" width={size} height={size}>
      <circle cx="15" cy="14" r="7" fill="#c98a4b"/>
      <circle cx="45" cy="14" r="7" fill="#c98a4b"/>
      <circle cx="30" cy="30" r="20" fill="#dba05f"/>
      <circle cx="22" cy="26" r="3" fill="#4a2f16"/>
      <circle cx="38" cy="26" r="3" fill="#4a2f16"/>
      <ellipse cx="30" cy="35" rx="7" ry="5" fill="#f3d9b1"/>
      <circle cx="30" cy="35" r="2" fill="#4a2f16"/>
    </svg>
  )
}

function Boat({ size = 46 }) {
  return (
    <svg viewBox="0 0 60 60" width={size} height={size}>
      <path d="M10,42 L50,42 L44,54 L16,54 Z" fill="#e2e8f0"/>
      <rect x="28" y="8" width="3" height="34" fill="#8b5cf6"/>
      <path d="M31,10 L31,38 L50,38 Z" fill="#f59e0b"/>
      <path d="M28,10 L28,38 L14,34 Z" fill="#60a5fa"/>
    </svg>
  )
}

// Left-menu icons (line icons, same set for every tab).
const NAV_ICONS = {
  hair: <path d="M3 7l6 5-6 5V7zM21 7l-6 5 6 5V7zM9 12h6" />,
  hats: <path d="M4 18h16M6 18c0-6 2-10 6-10s6 4 6 10" />,
  clothes: <path d="M8 4L3 8l3 3 2-1v10h8V10l2 1 3-3-5-4a4 4 0 0 1-8 0z" />,
  pants: <path d="M7 3h10l1 18h-5l-1-9-1 9H6z" />,
  shoes: <path d="M3 16c4 0 4-5 7-5l3 3h5c2 0 3 1 3 3v1H3z" />,
  pose: <><circle cx="12" cy="5" r="2" /><path d="M12 8v6m-4-4h8m-6 11l2-7 2 7" /></>,
  expression: <><circle cx="12" cy="12" r="9" /><path d="M8.5 14a4 4 0 0 0 7 0M9 9.5h.01M15 9.5h.01" /></>,
}

// One left-menu row: icon tile, name, current value, state dot.
function NavItem({ id, label, value, on, off = false, active, onSelect }) {
  return (
    <button type="button" role="tab" aria-selected={active} onClick={onSelect}
      className={`pc-cat ${active ? 'on' : ''} ${off ? 'off' : ''}`}>
      <span className="pc-cat-ico" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{NAV_ICONS[id]}</svg>
      </span>
      <span className="pc-cat-txt">
        <span className="pc-cat-name">{label}</span>
        <span className="pc-cat-val">{value}</span>
      </span>
      <span className={`pc-dot ${on ? 'on' : ''}`} aria-hidden="true" />
    </button>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PaoCustomizePage({ onDone, lang = 'en', patientEmail = null }) {
  const [activeTab,     setActiveTab]     = useState('hair')
  const pao = usePao()
  const [howToUnlockByCode, setHowToUnlockByCode] = useState({})
  const [progressByCode, setProgressByCode] = useState({})
  const [equipped,      setEquipped]      = useState({ hair:'none', hats:'none', clothes:'none', pants:'none', shoes:'none' })
  const [talking,       setTalking]       = useState(false)
  const [mouthOpen,     setMouthOpen]     = useState(false)
  const [displayText,   setDisplayText]   = useState('')
  const [hoveredItem,   setHoveredItem]   = useState(null)
  const [showBadgeCase, setShowBadgeCase] = useState(false)
  const [earnedBadges,  setEarnedBadges]  = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('pao_badges') || '[]')) }
    catch { return new Set() }
  })
  const [wardrobeItems, setWardrobeItems] = useState([])
  const [wardrobeLoading, setWardrobeLoading] = useState(true)
  const [hop, setHop] = useState(false)
  const [layerManifest, setLayerManifest] = useState(null)
  const reducedMotion = useReducedMotionCM()
  useEffect(() => { loadLayerManifest().then(setLayerManifest) }, [])
  const reaction = usePaoReaction({
    calm: reducedMotion,
    // Pao's words are shown in the speech bubble (src/components/pao/paoLines.js);
    // nothing is read aloud unless the patient taps the speaker button.
    onSpeak: () => {},
  })
  // The one line Pao is "saying" right now (newest wins) and the locked card
  // that was last tapped (gets a blue ring).
  const [line, setLine] = useState(() => paoSay('open'))
  const [lockedRing, setLockedRing] = useState('')
  const say = (event, payload) => { const l = paoSay(event, payload); if (l) setLine({ ...l }) }
  const [styles, setStyles] = useState([])
  const [stylesLoading, setStylesLoading] = useState(true)
  const [styleError, setStyleError] = useState('')
  const [styleBusy, setStyleBusy] = useState(false)
  const [hoverKey, setHoverKey] = useState('')
  useEffect(() => {
    let cancelled = false
    getPaoStyles(pao.ident)
      .then((b) => { if (!cancelled) setStyles(b.items || []) })
      .catch(() => { if (!cancelled) setStyleError('Could not load poses and expressions.') })
      .finally(() => { if (!cancelled) setStylesLoading(false) })
    return () => { cancelled = true }
  }, [])
  const [games, setGames] = useState([])
  const [unlockedItemCodes, setUnlockedItemCodes] = useState(() => new Set())
  const mouthRef = useRef(null)

  // The full wardrobe (hats/clothes/pants/shoes + hairstyles), straight
  // from MongoDB — see src/pages/admin/GamifiedBadgesPage.jsx for the
  // admin side that manages these same two collections.
  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch('/api/pao-items/list').then((r) => r.json()),
      fetch('/api/pao-hair/list').then((r) => r.json()),
      fetch('/api/games/list').then((r) => r.json()),
    ])
      .then(([itemsBody, hairBody, gamesBody]) => {
        if (cancelled) return
        setWardrobeItems([...(itemsBody.items || []), ...(hairBody.items || [])])
        setGames(gamesBody.games || [])
      })
      .catch(() => { /* keep the "Natural" fallback for every slot */ })
      .finally(() => { if (!cancelled) setWardrobeLoading(false) })
    return () => { cancelled = true }
  }, [])

  // Real, admin-authored unlock state (finish a specific game, perfect a
  // score, earn a badge, …) — computed server-side from this patient's
  // recorded game completions. Refreshed whenever the Badge Case is opened,
  // same as the legacy localStorage badge set below, so a badge/item earned
  // moments ago (right after finishing a game) shows up immediately.
  const identKey = pao.ident?.activitySessionId || pao.ident?.patientEmail || ''
  useEffect(() => {
    let cancelled = false
    if (!identKey) return undefined
    getWardrobe(pao.ident).then((w) => {
      if (cancelled) return
      const codes = new Set()
      const howTo = {}
      const all = [...Object.values(w.items || {}).flat(), ...(w.hair || [])]
      for (const i of all) {
        if (i.unlocked) codes.add(i.code)
        else if (i.howToUnlock) howTo[i.code] = i.howToUnlock
      }
      setUnlockedItemCodes(codes)
      setHowToUnlockByCode(howTo)
      const prog = {}
      for (const i of all) { if (!i.unlocked && i.progress) prog[i.code] = i.progress }
      setProgressByCode(prog)
    }).catch(() => { /* keep whatever was last shown */ })
    return () => { cancelled = true }
  }, [identKey, showBadgeCase]) // eslint-disable-line react-hooks/exhaustive-deps

  // Mirror the server's equipped outfit (codes) into the on-screen slots.
  useEffect(() => {
    const eq = pao.profile?.equipped
    if (!eq) return
    const code = (v) => ((v && typeof v === 'object') ? v.code : v) || 'none'
    setEquipped({ hair: code(eq.hair), hats: code(eq.hats), clothes: code(eq.clothes), pants: code(eq.pants), shoes: code(eq.shoes) })
  }, [pao.profile])

  const categories = useMemo(() => CATEGORY_META.map((meta) => ({
    ...meta,
    items: [
      { id: 'none', code: 'none', name: 'Natural', design: null, badge: null, unlock: null, desc: NATURAL_DESC[meta.id] },
      ...wardrobeItems
        .filter((i) => i.category === meta.label)
        .map((i) => ({
          id: i.code, code: i.code, name: i.name, design: i.design,
          badge: null,
          unlock: i.unlock || null,
          desc: (!unlockedItemCodes.has(i.code) && howToUnlockByCode[i.code]) || i.description || '',
        })),
    ],
  })), [wardrobeItems, unlockedItemCodes, howToUnlockByCode])

  // refresh when badge case opens (badge may have just been earned)
  useEffect(() => {
    if (!showBadgeCase) return
    try { setEarnedBadges(new Set(JSON.parse(localStorage.getItem('pao_badges') || '[]'))) }
    catch {}
  }, [showBadgeCase])

  // The opening line is the initial `line` state; just make sure no old voice
  // keeps playing when the modal closes.
  useEffect(() => () => stopPaoVoice(), [])

  useEffect(() => {
    if (talking) { mouthRef.current = setInterval(() => setMouthOpen(p => !p), 155) }
    else { clearInterval(mouthRef.current); setMouthOpen(false) }
    return () => clearInterval(mouthRef.current)
  }, [talking])

  // One source of truth: the server's patient_unlocks (via the wardrobe API).
  // The old per-browser badge list (localStorage) made items look locked or
  // unlocked differently from the Badge Case.
  const isUnlocked = (item) => item.id === 'none' || unlockedItemCodes.has(item.code)

  const getEquippedName = (catId) =>
    categories.find(c => c.id === catId)?.items.find(i => i.id === equipped[catId])?.name ?? 'None'

  const isNatural = (catId) => !equipped[catId] || equipped[catId] === 'none'

  const unequip = (catId) => {
    const noneItem = categories.find(c => c.id === catId)?.items.find(i => i.id === 'none')
    if (noneItem) equip(catId, noneItem)
  }

  const unequipAll = () => {
    categories.forEach((cat) => { if (!isNatural(cat.id)) unequip(cat.id) })
    say('takeOff') // outfit only; pose and expression are untouched
  }

  const equip = (catId, item) => {
    if (!isUnlocked(item)) return
    setEquipped(e => ({ ...e, [catId]: item.id }))
    pao.equip(catId, item.id === 'none' ? null : item.code).catch(() => { /* server keeps the last good outfit */ })
    if (!reducedMotion) { setHop(true); setTimeout(() => setHop(false), 220) }
    softPop()
    setLockedRing('')
    say(item.id === 'none' ? 'remove' : 'wear', { slot: catId, name: item.name })
    if (item.id === 'none') {
      reaction.reactToUnequip()
    } else if (LAYER_CATEGORIES.includes(catId)) {
      reaction.reactToEquip(catId, resolveItemKey(item.name))
    } else {
      // Hair has no reaction mapping yet — same random-pool behaviour.
      reaction.reactToEquip('hair', resolveItemKey(item.name))
    }
  }

  // A locked card never changes what Pao wears; it just explains what to earn.
  const tapLocked = (item) => {
    setLockedRing(item.id)
    const badge = item.badge || null
    const goal = !badge && item.unlock && item.unlock.type !== 'free'
      ? describeUnlock(item.unlock.type, { gameId: item.unlock.gameId, value: item.unlock.value, badgeCode: item.unlock.badgeCode }, games, [])
      : howToUnlockByCode[item.code] || null
    const pr = progressByCode[item.code]
    say('locked', { name: item.name, badge, goal, have: pr?.have, need: pr?.need })
  }

  const activeCategory = categories.find(c => c.id === activeTab)

  // Poses and expressions: the list comes from the API (never hard-coded).
  // Pao uses a pose OR an expression, never both; nothing set = default Pao.
  // State is saved on the server and applied from its response.
  const isStyleTab = activeTab === 'pose' || activeTab === 'expression'
  const styleItems = styles.filter((s) => s.type === activeTab)
  const styleKey = (type) => (type === 'pose' ? pao.profile?.selectedPoseKey : pao.profile?.selectedExpressionKey) || null
  const styleName = (type) => styles.find((s) => s.type === type && s.key === styleKey(type))?.name || ''
  const activeStyleType = styleKey('pose') ? 'pose' : styleKey('expression') ? 'expression' : null
  const activeStyle = activeStyleType === 'pose' ? 'pose' : activeStyleType ? 'expr' : null
  const activeStyleName = activeStyleType ? styleName(activeStyleType) : ''
  const isOff = (type) => !!activeStyleType && activeStyleType !== type
  const blocked = isStyleTab && isOff(activeTab)
  const runStyle = (fn, onOk) => {
    setStyleError(''); setStyleBusy(true)
    fn().then(onOk).catch((err) => setStyleError(err.message || 'Could not save that choice.')).finally(() => setStyleBusy(false))
  }
  const chooseStyle = (type, key) => { if (styleKey(type) !== key) runStyle(() => pao.selectStyle(type, key), () => say(type, { key })) }
  const removeStyle = (type) => runStyle(() => pao.clearStyle(type), () => say('removeStyle'))

  // Which layer-art item_key is equipped in each of the four layered
  // categories, for <PaoLayered/>. Hair has no overlay art yet (see
  // paoLayers.js), so it isn't part of this and still shows as text only.
  const equippedLayerKeys = useMemo(() => {
    const out = {}
    for (const catId of LAYER_CATEGORIES) {
      const item = categories.find((c) => c.id === catId)?.items.find((i) => i.id === equipped[catId])
      if (item && item.id !== 'none') out[catId] = resolveItemKey(item.name)
    }
    return out
  }, [equipped, categories])

  // PandaMascot's `accessories` prop wants a built-in code string (for
  // OUTFIT_MAP lookups) or { design } for admin-designed pieces — `equipped`
  // itself just tracks each slot's code, so resolve that here.
  const previewAccessories = useMemo(() => {
    const out = {}
    Object.entries(equipped).forEach(([catId, code]) => {
      if (!code || code === 'none') return
      const item = categories.find((c) => c.id === catId)?.items.find((i) => i.code === code)
      if (!item) return
      out[catId] = item.design ? { design: item.design } : item.code
    })
    return out
  }, [equipped, categories])

  if (showBadgeCase) {
    return <BadgeCaseView patientEmail={patientEmail} onBack={() => setShowBadgeCase(false)}/>
  }

  return (
    <div className="pc-root">
      <style>{`
        .pc-root { position:fixed; inset:0; z-index:9999; display:flex; align-items:center; justify-content:center; padding:18px; background:radial-gradient(circle,rgba(255,255,255,.06) 1.5px,transparent 2px) 0 0/26px 26px,linear-gradient(180deg,#1b2b5c,#14204a); font-family:'Segoe UI',system-ui,sans-serif; color:#1e293b; overflow:hidden; }
        .pc-panel { width:min(1240px,100%); height:min(720px, calc(100vh - 36px)); display:flex; flex-direction:column; background:#f4f8ff; border-radius:22px; overflow:hidden; box-shadow:0 24px 70px rgba(0,0,0,.45); border:3px solid #7fb6ff; }
        .pc-skel { height:132px; border-radius:14px; background:linear-gradient(90deg,#e2e8f0 25%,#eef2f7 37%,#e2e8f0 63%); background-size:400% 100%; animation:pcSkel 1.4s ease infinite; }
        @keyframes pcSkel { 0%{background-position:100% 50%} 100%{background-position:0 50%} }
        @media (prefers-reduced-motion: reduce) { .pc-skel { animation:none; } }
        .pc-title { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:12px 16px; background:linear-gradient(180deg,#5eaeff,#2f7fe8); color:#fff; flex-shrink:0; }
        .pc-title h1 { margin:0; font-size:20px; font-weight:900; letter-spacing:.3px; text-shadow:0 2px 0 rgba(0,0,0,.2); }
        .pc-close { width:36px; height:36px; border-radius:10px; border:2px solid #fff; background:#ef4444; color:#fff; font-size:18px; font-weight:900; cursor:pointer; flex-shrink:0; }
        .pc-badges { background:rgba(255,255,255,.2); border:1.5px solid rgba(255,255,255,.6); color:#fff; border-radius:10px; padding:6px 12px; font-size:13px; font-weight:800; cursor:pointer; white-space:nowrap; }
        .pc-body { flex:1; display:grid; grid-template-columns:236px 1fr 340px; min-height:0; }
        .pc-cats { background:#dbeafe; border-right:2px solid #93c5fd; padding:10px; display:flex; flex-direction:column; gap:8px; overflow-y:auto; }
        .pc-cat { display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:12px; border:2px solid #bfdbfe; background:#fff; cursor:pointer; text-align:left; font-weight:800; color:#1e3a8a; font-size:14px; }
        .pc-cat.on { background:#2f7fe8; border-color:#1d4ed8; color:#fff; }
        .pc-cat { position:relative; min-height:52px; box-sizing:border-box; gap:10px; padding:8px 10px; text-align:left; font-family:inherit; }
        .pc-cat-ico { width:32px; height:32px; border-radius:9px; background:#eaf2ff; color:#2f6fd0; display:flex; align-items:center; justify-content:center; flex:none; }
        .pc-cat.on .pc-cat-ico { background:rgba(255,255,255,.22); color:#fff; }
        .pc-cat-txt { display:flex; flex-direction:column; min-width:0; flex:1; line-height:1.2; }
        .pc-cat-name { font-size:14px; font-weight:800; }
        .pc-cat-val { font-size:11px; font-weight:600; opacity:.75; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .pc-cat.off { border-style:dashed; opacity:.6; }
        .pc-cat.off.on { opacity:1; }
        .pc-dot { width:10px; height:10px; border-radius:50%; border:2px solid #b6c7e3; flex:none; box-sizing:border-box; }
        .pc-dot.on { background:#16a34a; border-color:#16a34a; box-shadow:0 0 0 2px rgba(22,163,74,.25); }
        .pc-navlabel { font-size:10.5px; font-weight:800; letter-spacing:1px; color:#475569; margin:6px 4px 0; }
        .pc-tile.on { border:3px solid #16a34a; background:#fff; box-shadow:0 0 0 3px rgba(22,163,74,.18); padding:7px; }
        .pc-thumb { position:relative; }
        .pc-lockchip { position:absolute; top:6px; right:6px; width:20px; height:20px; border-radius:50%; background:#1e293b; color:#fff; display:flex; align-items:center; justify-content:center; }
        .pc-lockrow { margin-top:auto; height:40px; box-sizing:border-box; display:flex; flex-direction:column; justify-content:center; gap:4px; padding:0 4px; }
        .pc-lockname { font-size:11.5px; font-weight:800; color:#334155; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .pc-lockbar { display:flex; align-items:center; gap:6px; }
        .pc-lockbar b { font-size:10.5px; color:#92400e; }
        .pc-bar { flex:1; height:6px; border-radius:6px; background:#e2e8f0; overflow:hidden; }
        .pc-bar i { display:block; height:100%; background:#f59e0b; border-radius:6px; }
        .pc-grid-wrap { display:flex; flex-direction:column; min-height:0; }
        .pc-note { margin:10px 12px 0; padding:8px 12px; border-radius:10px; background:#fff7d6; border:1.5px solid #facc15; font-size:12px; font-weight:700; color:#854d0e; }
        .pc-grid { flex:1; min-height:0; overflow-y:auto; display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; padding:12px 12px 16px; align-content:start; scrollbar-width:thin; scrollbar-color:#b6cdf0 transparent; }
        .pc-grid::-webkit-scrollbar { width:8px; } .pc-grid::-webkit-scrollbar-thumb { background:#b6cdf0; border-radius:8px; } .pc-grid::-webkit-scrollbar-track { background:transparent; }
        .pc-tile { position:relative; background:#fff; border:2px solid #cbd5e1; border-radius:14px; padding:8px; cursor:pointer; display:flex; flex-direction:column; align-items:stretch; gap:4px; min-height:0; font-family:inherit; text-align:left; }
        .pc-thumb { height:112px; border-radius:11px; background:#fff; border:1px solid #e2e8f0; display:flex; align-items:center; justify-content:center; overflow:hidden; }
        .pc-tile.on { border-color:#7c3aed; background:#f5f3ff; box-shadow:0 0 0 3px rgba(124,58,237,.25); }
        .pc-tile.lock { opacity:.6; cursor:not-allowed; background:#f1f5f9; }
        .pc-tile-name { font-size:13px; font-weight:800; color:#14306B; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .pc-tile-sub { font-size:11px; color:#475569; line-height:1.3; height:29px; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
        .pc-tile-tag { margin-top:auto; height:40px; box-sizing:border-box; display:flex; align-items:center; justify-content:center; font-size:12.5px; font-weight:800; padding:0 8px; border-radius:10px; background:#e2e8f0; color:#334155; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .pc-tile-tag.wear { background:#2f7fe8; color:#fff; } .pc-tile-tag.eq { background:#16a34a; color:#fff; }
        .pc-stage { width:100%; display:flex; flex-direction:column; align-items:center; flex:none; height:268px; overflow:hidden; border:2px solid #BFD4F5; border-radius:16px; background:#f8fbff; }
        .pc-tile.ring { border-color:#2f7fe8; box-shadow:0 0 0 3px rgba(47,127,232,.3); }
        .pc-sgrid { grid-template-columns:repeat(3,minmax(0,1fr)); padding-bottom:16px; }
        .pc-scard { display:flex; flex-direction:column; gap:6px; min-width:0; padding:8px; border:2px solid #D6E4FA; border-radius:16px; background:#fff; }
        .pc-scard.sel { border-color:#16a34a; box-shadow:0 0 0 3px rgba(22,163,74,.2); }
        .pc-scard.off { opacity:.6; background:#f8fafc; }
        .pc-scard.off .pc-sthumb img { filter:grayscale(1); }
        .pc-sthumb { position:relative; aspect-ratio:4/3; overflow:hidden; border-radius:11px; background:#fff; }
        .pc-sthumb img { width:100%; height:100%; object-fit:contain; display:block; }
        .pc-sfree { position:absolute; top:6px; left:6px; font-size:9.5px; font-weight:800; padding:1px 7px; border-radius:999px; background:#dcfce7; color:#166534; }
        .pc-slive { position:absolute; left:6px; bottom:6px; font-size:9.5px; font-weight:800; letter-spacing:.4px; padding:1px 7px; border-radius:999px; background:#e0edff; color:#1d4ed8; }
        .pc-scheck { position:absolute; top:6px; right:6px; width:20px; height:20px; border-radius:50%; background:#16a34a; color:#fff; font-size:12px; font-weight:900; display:flex; align-items:center; justify-content:center; }
        .pc-sname { font-weight:700; font-size:13px; color:#1e293b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .pc-sdesc { font-size:12px; color:#475569; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .pc-sbtn { width:100%; height:34px; box-sizing:border-box; border:none; border-radius:10px; background:#2f7fe8; color:#fff; font-family:inherit; font-size:13px; font-weight:800; cursor:pointer; }
        .pc-sbtn.sel { background:#16a34a; }
        .pc-sbtn:disabled { cursor:not-allowed; }
        .pc-scard.off .pc-sbtn { background:#e2e8f0; color:#64748b; }
        .pc-sbtn:focus-visible, .pc-remove:focus-visible { outline:3px solid #1d4ed8; outline-offset:2px; }
        .pc-remove { flex-shrink:0; border:1.5px solid currentColor; background:#fff; color:inherit; border-radius:10px; padding:5px 10px; font-family:inherit; font-size:12px; font-weight:800; cursor:pointer; }
        .pc-preview { background:#fff; border-left:2px solid #93c5fd; padding:12px; display:flex; flex-direction:column; align-items:center; gap:8px; overflow:hidden; min-height:0; }
        .pc-phead { width:100%; display:flex; align-items:center; justify-content:space-between; height:28px; flex:none; font-weight:800; color:#14306B; }
        .pc-pill { font-size:11px; font-weight:800; padding:3px 9px; border-radius:999px; background:#dcfce7; color:#166534; }
        .pc-wlabel { width:100%; height:16px; flex:none; font-size:10.5px; font-weight:800; letter-spacing:1px; color:#475569; }
        .pc-actions { width:100%; margin-top:auto; display:grid; grid-template-columns:1fr 1fr; gap:8px; flex:none; }
        .pc-equipped { display:grid; grid-template-columns:1fr 1fr; gap:6px; width:100%; }
        .pc-eq { background:#f0fdf4; border:1.5px solid #86efac; border-radius:10px; padding:0 9px; font-size:12.5px; font-weight:700; line-height:1.2; height:46px; box-sizing:border-box; min-width:0; display:flex; flex-direction:column; justify-content:center; }
        .pc-eq.idle { background:#f8fafc; border:1.5px solid #dbe5f3; }
        .pc-eq.off { border-style:dashed; }
        .pc-eq span { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0; }
        .pc-eq b { display:block; color:#1e40af; font-size:9px; text-transform:uppercase; letter-spacing:.5px; }
        .pc-unequip { flex-shrink:0; width:22px; height:22px; padding:0; border-radius:999px; border:1.5px solid #fca5a5; background:#fff; color:#b91c1c; font-size:11px; font-weight:900; cursor:pointer; line-height:1; display:flex; align-items:center; justify-content:center; }
        .pc-unequip-all { height:42px; box-sizing:border-box; border:1.5px solid #cbd5e1; background:#fff; color:#2f7fe8; border-radius:12px; font-size:13px; font-weight:800; cursor:pointer; } .pc-unequip-all:disabled { border-color:#E3EAF5; color:#A9B6CB; background:#fff; box-shadow:none; cursor:default; }
        .pc-bubble { width:100%; background:#f8fafc; border:2px solid #cbd5e1; border-radius:14px; padding:8px 10px; font-size:12.5px; font-weight:700; color:#1e293b; min-height:40px; }
        .pc-play { height:42px; box-sizing:border-box; border:none; border-radius:12px; background:linear-gradient(180deg,#34d399,#16a34a); color:#fff; font-size:15px; font-weight:900; cursor:pointer; box-shadow:0 3px 0 #0f7a3a; }
        @media (max-width: 900px) {
          .pc-root { overflow-y:auto; align-items:flex-start; }
          .pc-panel { height:auto; min-height:100%; overflow:visible; }
          .pc-body { grid-template-columns:1fr; grid-template-rows:none; flex:none; }
          .pc-grid-wrap { min-height:340px; }
          .pc-grid { overflow:visible; }
          .pc-preview { order:-1; flex-direction:row; flex-wrap:wrap; justify-content:center; border-left:none; border-bottom:2px solid #93c5fd; padding:10px; }
          .pc-cats { flex-direction:row; overflow-x:auto; overflow-y:hidden; border-right:none; border-bottom:2px solid #93c5fd; padding:8px; }
          .pc-cat { flex-shrink:0; padding:8px 12px; }
          .pc-grid, .pc-sgrid { grid-template-columns:repeat(3,minmax(0,1fr)); }
          .pc-preview { overflow:visible; }
          .pc-stage { height:268px; }
        }
        @media (max-width: 560px) {
          .pc-root { padding:0; }
          .pc-panel { border-radius:0; border:none; }
          .pc-grid, .pc-sgrid { grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; padding:10px; }
          .pc-tile { min-height:118px; }
          .pc-title h1 { font-size:17px; }
          .pc-preview .pc-equipped { grid-template-columns:repeat(2,1fr); }
        }
      `}</style>

      <div className="pc-panel">
        <div className="pc-title">
          <h1>✨ Customize Pao</h1>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <button className="pc-badges" onClick={() => setShowBadgeCase(true)}>🏆 Badge Case{earnedBadges.size > 0 ? ` (${earnedBadges.size})` : ''}</button>
            <button className="pc-close" aria-label="Close" onClick={() => { reaction.handoffNow(); stopPaoVoice(); onDone() }}>✕</button>
          </div>
        </div>

        <div className="pc-body">
          <div className="pc-cats" role="tablist" aria-label="Categories">
            {categories.map(cat => (
              <NavItem key={cat.id} id={cat.id} label={cat.label} value={isNatural(cat.id) ? 'Natural' : getEquippedName(cat.id)}
                on={!isNatural(cat.id)} active={activeTab === cat.id} onSelect={() => setActiveTab(cat.id)} />
            ))}
            <div className="pc-navlabel">STYLE (ONE AT A TIME)</div>
            {STYLE_TABS.map((t) => {
              const off = isOff(t.type)
              return (
                <NavItem key={t.type} id={t.type} label={t.label}
                  value={off ? `Off while ${activeStyleName} is on` : styleKey(t.type) ? styleName(t.type) : 'Not set'}
                  on={!!styleKey(t.type)} off={off} active={activeTab === t.type} onSelect={() => setActiveTab(t.type)} />
              )
            })}
          </div>

          <div className="pc-grid-wrap">
            {isStyleTab && activeStyle ? (
              <div className="pc-note" style={blocked ? { background:'#ffedd5', borderColor:'#fb923c', color:'#9a3412' } : null}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}>
                  <span>
                    {blocked
                      ? `Pao is using the ${activeStyleName} ${activeStyle === 'pose' ? 'pose' : 'expression'}, so ${activeTab === 'pose' ? 'poses' : 'expressions'} are off. Remove the ${activeStyle === 'pose' ? 'pose' : 'expression'} to pick one.`
                      : `${activeStyleName} is on. ${activeStyle === 'pose' ? 'Expressions' : 'Poses'} are off while ${activeStyle === 'pose' ? 'a pose' : 'an expression'} is on.`}
                  </span>
                  <button type="button" className="pc-remove" onClick={() => removeStyle(activeStyleType)}>
                    Remove {activeStyle === 'pose' ? 'pose' : 'expression'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="pc-note">
                {isStyleTab
                  ? `All 12 ${activeTab === 'pose' ? 'poses' : 'expressions'} are free. Pao can use a pose or an expression, not both.`
                  : 'Each item shows the badge needed to unlock it'}
              </div>
            )}
            {isStyleTab ? (
              <div className="pc-grid pc-sgrid">
                {stylesLoading && Array.from({ length: 6 }).map((_, i) => <div key={i} className="pc-skel" />)}
                {!stylesLoading && styleItems.length === 0 && <div className="pc-tile-sub" style={{ gridColumn:'1 / -1' }}>Nothing to show right now.</div>}
                {styleItems.map((s) => {
                  const selected = styleKey(activeTab) === s.key
                  const label = selected ? 'Selected' : blocked ? 'Unavailable' : 'Choose'
                  return (
                    <div key={s.key} className={`pc-scard ${selected ? 'sel' : ''} ${blocked ? 'off' : ''}`}
                      onMouseEnter={() => setHoverKey(s.key)} onMouseLeave={() => setHoverKey('')}
                      onFocus={() => setHoverKey(s.key)} onBlur={() => setHoverKey('')}>
                      <div className="pc-sthumb">
                        {/* Expressions are light, so they always play. The 12 pose
                            cards only animate when hovered, focused or selected;
                            the rest show a still picture (kinder to phones). */}
                        {s.type === 'expression' && s.is_animated
                          ? <PaoAvatar expression={s.key} variant="bust" />
                          : s.type === 'pose' && s.is_animated && (selected || hoverKey === s.key) && !blocked
                            ? <PaoAvatar pose={s.key} variant="card" />
                            : <img src={s.preview_image_url} alt="" draggable={false} />}
                        <span className="pc-sfree">FREE</span>
                        {s.is_animated && <span className="pc-slive">LIVE</span>}
                        {selected && <span className="pc-scheck" aria-hidden="true">&#10003;</span>}
                      </div>
                      <div className="pc-sname" title={s.name}>{s.name}</div>
                      <div className="pc-sdesc" title={s.motion_description || s.description}>{s.motion_description || s.description}</div>
                      <div style={{ marginTop:'auto' }}>
                        <button type="button" className={`pc-sbtn ${selected ? 'sel' : ''}`}
                          aria-pressed={selected} disabled={blocked || styleBusy}
                          aria-label={`${label}: ${s.name}`}
                          onClick={() => chooseStyle(activeTab, s.key)}>
                          {label}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : wardrobeLoading ? (
              <div className="pc-grid">
                {Array.from({ length: 8 }).map((_, i) => <div key={i} className="pc-skel" />)}
              </div>
            ) : (
            <div className="pc-grid">
              {activeCategory?.items.map((item) => {
                const unlocked = isUnlocked(item)
                const isEquipped = equipped[activeTab] === item.id
                const badge = item.badge ? BADGES[item.badge] : null
                const unlockLabel = !badge && item.unlock && item.unlock.type !== 'free'
                  ? describeUnlock(item.unlock.type, { gameId: item.unlock.gameId, value: item.unlock.value, badgeCode: item.unlock.badgeCode }, games, [])
                  : null
                const tag = isEquipped ? 'Equipped'
                  : !unlocked ? (badge ? `Locked: ${item.badge}` : unlockLabel ? `Locked: ${unlockLabel}` : 'Locked')
                  : 'Wear'
                const itemKey = item.id !== 'none' ? resolveItemKey(item.name) : null
                const hasLayerArt = itemKey && layerManifest?.layers?.some((l) => l.category === activeTab && l.item_key === itemKey)
                return (
                  <button key={item.id} type="button"
                    className={`pc-tile ${isEquipped ? 'on' : ''} ${!unlocked ? 'lock' : ''} ${!unlocked && lockedRing === item.id ? 'ring' : ''}`}
                    onClick={() => (unlocked ? equip(activeTab, item) : tapLocked(item))}
                    aria-pressed={isEquipped}
                    aria-label={`${item.name}${unlocked ? '' : ', locked'}`}>
                    <div className="pc-thumb">
                      {hasLayerArt
                        ? <LayerCardIcon manifest={layerManifest} category={activeTab} itemKey={itemKey} unlocked={unlocked} width={96} />
                        : item.id === 'none' && LAYER_CATEGORIES.includes(activeTab)
                          ? <LayerCardIcon manifest={layerManifest} category={activeTab} natural unlocked width={96} />
                          : <div style={{ opacity: unlocked ? 1 : 0.55, filter: unlocked ? 'none' : 'grayscale(1)' }}><WardrobeThumb item={item} categoryId={activeTab} width={88}/></div>}
                      {isEquipped && <span className="pc-scheck" aria-hidden="true">&#10003;</span>}
                      {!unlocked && <span className="pc-lockchip" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></span>}
                    </div>
                    <div className="pc-tile-name" title={item.name}>{item.name}</div>
                    <div className="pc-tile-sub">{item.desc}</div>
                    {unlocked
                      ? <div className={`pc-tile-tag ${isEquipped ? 'eq' : 'wear'}`}>{tag}</div>
                      : (() => {
                          const pr = progressByCode[item.code]
                          const label = item.badge || unlockLabel || howToUnlockByCode[item.code] || 'Locked'
                          return (
                            <div className="pc-lockrow">
                              <div className="pc-lockname" title={label}>{label}</div>
                              {pr ? (
                                <div className="pc-lockbar"><div className="pc-bar" role="progressbar" aria-valuemin={0} aria-valuemax={pr.need} aria-valuenow={pr.have}><i style={{ width: `${Math.round((pr.have / pr.need) * 100)}%` }} /></div><b>{pr.have}/{pr.need}</b></div>
                              ) : <div className="pc-lockbar"><span style={{ fontSize: 11, color: '#64748b' }}>Locked</span></div>}
                            </div>
                          )
                        })()}
                  </button>
                )
              })}
            </div>
            )}
          </div>

          <div className="pc-preview">
            <div className="pc-phead"><span>Pao's look</span><span className="pc-pill">{categories.filter(c => !isNatural(c.id)).length} outfit items on</span></div>
            {/* Stage: speech bubble (flex:none) above Pao. Pao shrinks first if the panel is short. */}
            <div className="pc-stage">
              <PaoSpeechBubble text={line?.text} kind={line?.kind} lang={lang} />
              <div style={{ flex: '1 1 0', minHeight: 0, width: '100%', padding: '0 8px 8px', boxSizing: 'border-box', animation: reducedMotion ? 'none' : 'cpFloat 3s ease-in-out infinite', transform: hop && !reducedMotion ? 'translateY(-10px)' : 'none', transition: 'transform .22s ease' }}>
                <PaoLayered
                  equipped={equippedLayerKeys}
                  pose={reaction.pose}
                  showFx={reaction.fx}
                  fill
                  interactive
                  onClick={reaction.tapCycle}
                />
              </div>
            </div>
            <div className="pc-wlabel">WEARING NOW</div>
            <div className="pc-equipped">
              {categories.map(cat => {
                const on = !isNatural(cat.id)
                return (
                  <div key={cat.id} className={`pc-eq ${on ? '' : 'idle'}`} style={{ position:'relative' }}>
                    <b>{cat.label}</b>
                    <span style={{ color: on ? undefined : '#94a3b8', paddingRight: on ? 26 : 0 }}>{on ? getEquippedName(cat.id) : 'Natural'}</span>
                    {on && (
                      <button type="button" className="pc-unequip" style={{ position:'absolute', right:6, top:'50%', transform:'translateY(-50%)' }} onClick={() => unequip(cat.id)} aria-label={`Take off ${cat.label}`} title="Take off">&#10005;</button>
                    )}
                  </div>
                )
              })}
              {STYLE_TABS.map((t) => {
                const on = !!styleKey(t.type)
                return (
                  <div key={t.type} className={`pc-eq ${on ? '' : 'idle'} ${isOff(t.type) ? 'off' : ''}`} style={{ position:'relative' }}>
                    <b>{t.single}</b>
                    <span style={{ color: on ? undefined : '#94a3b8', paddingRight: on ? 26 : 0 }}>{on ? styleName(t.type) : isOff(t.type) ? 'Off' : 'Not set'}</span>
                    {on && (
                      <button type="button" className="pc-unequip" style={{ position:'absolute', right:6, top:'50%', transform:'translateY(-50%)' }} onClick={() => removeStyle(t.type)} aria-label={`Remove ${t.single.toLowerCase()}`} title="Remove">&#10005;</button>
                    )}
                  </div>
                )
              })}
            </div>
            {styleError && <div role="alert" className="pc-bubble" style={{ borderColor:'#ef4444', color:'#b91c1c' }}>{styleError}</div>}
            <div className="pc-actions">
              <button type="button" className="pc-unequip-all" onClick={unequipAll} disabled={!categories.some(c => !isNatural(c.id))}>Take outfit off</button>
              <button className="pc-play" onClick={() => { reaction.handoffNow(); stopPaoVoice(); say('play'); setTimeout(onDone, 700) }}>Let's Play! <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ marginLeft: 4 }}><path d="M6 4l14 8-14 8z" /></svg></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
