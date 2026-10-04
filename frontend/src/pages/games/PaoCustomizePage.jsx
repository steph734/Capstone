import { useState, useEffect, useMemo, useRef } from 'react'
import PandaMascot from './PandaMascot'
import { OutfitThumbnail } from './PaoOutfits'
import { DesignedOutfitThumbnail } from './PaoDesignedOutfit'
import { speakPao, stopPaoVoice } from '../../utils/paoVoice'
import { CUSTOMIZE_LINES, pickLine } from '../../utils/paoLines'
import { usePao } from '../../context/PaoContext'
import { getWardrobe } from '../../utils/paoApi'
import { describeUnlock } from '../admin/PaoClothingDesigner'
import BadgeMedal from '../../components/BadgeMedal'

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
  if (item.id === 'none' || !item.code) return <span style={{ fontSize: width * 0.5, opacity: 0.7 }}>🐼</span>
  if (item.design) return <DesignedOutfitThumbnail category={categoryId} design={item.design} width={width} />
  return <OutfitThumbnail category={categoryId === 'hats' ? 'hair' : categoryId} itemId={item.code} width={width} />
}

// ─── TTS helper ───────────────────────────────────────────────────────────────

function tts(text, { onStart, onEnd, onWord } = {}) {
  speakPao(text, { pitch: 1.62, rate: 1.1, onStart, onEnd, onWord })
}

// ─── Badge Case Page ──────────────────────────────────────────────────────────

const BADGE_PAGE_SIZE = 8

export function BadgeCasePage({ patientEmail, onBack }) {
  const [badges, setBadges] = useState([])
  const [earnedCodes, setEarnedCodes] = useState(() => new Set())
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)

  // Reads the durable patient_badges record (same source as the Pao profile),
  // so a badge earned at the end of a game shows here straight away.
  const pao = usePao()
  const ident = pao?.ident || {}
  const identQuery = ident.activitySessionId
    ? `activitySessionId=${encodeURIComponent(ident.activitySessionId)}`
    : `patientEmail=${encodeURIComponent(patientEmail || ident.patientEmail || '')}`

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/pao/badges?${identQuery}`)
      .then((r) => r.json())
      .then((body) => {
        if (cancelled) return
        const list = (body.badges || []).filter((b) => b.isActive)
        setBadges(list)
        setEarnedCodes(new Set(list.filter((b) => b.earned).map((b) => b.code)))
      })
      .catch(() => { if (!cancelled) setBadges([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [identQuery])

  const pageCount = Math.max(1, Math.ceil(badges.length / BADGE_PAGE_SIZE))
  const pageBadges = badges.slice(page * BADGE_PAGE_SIZE, page * BADGE_PAGE_SIZE + BADGE_PAGE_SIZE)
  const percent = badges.length ? Math.round((earnedCodes.size / badges.length) * 100) : 0

  const goPage = (p) => setPage(Math.max(0, Math.min(pageCount - 1, p)))

  return (
    <div style={{ position:'fixed', inset:0, zIndex:9999, overflowY:'auto', background:'radial-gradient(circle, rgba(255,255,255,.05) 1.5px, transparent 2px) 0 0/28px 28px, #0b2b30', fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
      <style>{`
        @keyframes bcIn   { from{opacity:0;transform:scale(.88) translateY(18px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes bcBadge{ 0%{transform:scale(0) rotate(-10deg)} 65%{transform:scale(1.12) rotate(3deg)} 100%{transform:scale(1) rotate(0)} }
        @keyframes bcPulse{ 0%,100%{opacity:.4} 50%{opacity:1} }
        @keyframes bcGlow { 0%,100%{box-shadow:0 0 14px rgba(96,165,250,.3)} 50%{box-shadow:0 0 30px rgba(96,165,250,.65)} }
      `}</style>

      <button onClick={onBack} style={{ position:'absolute', top:20, left:20, zIndex:10, display:'flex', alignItems:'center', gap:6, background:'#fff', border:'1px solid rgba(15,23,42,.12)', color:'#1e293b', borderRadius:10, padding:'8px 16px', fontSize:13, fontWeight:700, cursor:'pointer', boxShadow:'0 2px 8px rgba(0,0,0,.18)' }}>
        ← Back
      </button>

      <div style={{ minHeight:'100%', display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'86px 20px 40px' }}>
      <div style={{ width:520, maxWidth:'95vw', animation:'bcIn .45s cubic-bezier(.34,1.56,.64,1)' }}>

        {/* ── Lid ── */}
        <div style={{ background:'linear-gradient(180deg,#1c1c2e 0%,#16213e 100%)', border:'3px solid #1e3a5f', borderBottom:'none', borderRadius:'16px 16px 0 0', padding:'12px 16px 8px' }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
            <div>
              <h2 style={{ margin:0, fontSize:16, fontWeight:900, color:'#e2e8f0' }}>🏆 Pao's Badge Case</h2>
              <div style={{ fontSize:11, color:'rgba(96,165,250,.7)', marginTop:2, fontWeight:600 }}>
                {earnedCodes.size} / {badges.length} badges collected
              </div>
            </div>
            {/* LED dots */}
            <div style={{ display:'flex', gap:4, marginTop:3 }}>
              {[0,0.15,0.3,0.45,0.6].map((d,i) => (
                <div key={i} style={{ width:6, height:6, borderRadius:'50%', background:'#60a5fa', animation:`bcPulse 1.8s ease-in-out ${d}s infinite`, boxShadow:'0 0 6px #60a5fa' }}/>
              ))}
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:10 }}>
            <div style={{ flex:1, height:5, background:'rgba(255,255,255,.08)', borderRadius:4, position:'relative' }}>
              <div style={{ height:'100%', width:`${percent}%`, background:'linear-gradient(90deg,#38bdf8,#60a5fa)', borderRadius:4 }}/>
              <div style={{ position:'absolute', left:`${percent}%`, top:'50%', transform:'translate(-50%,-50%)', width:11, height:11, borderRadius:'50%', background:'#60a5fa', border:'2px solid #0d1b2a', boxShadow:'0 0 8px rgba(96,165,250,.7)' }}/>
            </div>
            <span style={{ fontSize:11, fontWeight:700, color:'rgba(96,165,250,.85)', whiteSpace:'nowrap' }}>{percent}% Complete</span>
          </div>
        </div>

        {/* ── Hinge ── */}
        <div style={{ height:6, background:'linear-gradient(90deg,#0d2b4a,#1a4a7a,#1a4a7a,#0d2b4a)', position:'relative' }}>
          <div style={{ position:'absolute', inset:'2px 18%', background:'rgba(96,165,250,.2)', borderRadius:2 }}/>
          {[25, 75].map(p => (
            <div key={p} style={{ position:'absolute', left:`${p}%`, top:'50%', transform:'translate(-50%,-50%)', width:9, height:9, borderRadius:'50%', background:'#1b3a5c', border:'2px solid rgba(96,165,250,.4)' }}/>
          ))}
        </div>

        {/* ── Interior ── */}
        <div style={{ background:'linear-gradient(180deg,#090912 0%,#0d0d1c 100%)', border:'3px solid #1e3a5f', borderTop:'none', borderRadius:'0 0 16px 16px', padding:'16px 16px 14px', boxShadow:'inset 0 6px 28px rgba(0,0,0,.7), 0 20px 56px rgba(0,0,0,.7)' }}>

          {loading ? (
            <p style={{ textAlign:'center', color:'rgba(191,219,254,.7)', fontSize:12, fontWeight:600, padding:'20px 0' }}>Loading badges…</p>
          ) : badges.length === 0 ? (
            <p style={{ textAlign:'center', color:'rgba(191,219,254,.5)', fontSize:12, fontWeight:600, padding:'20px 0' }}>No badges yet — check back soon!</p>
          ) : (
          <div key={page} style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
            {pageBadges.map((b, idx) => {
              const earned = earnedCodes.has(b.code)
              return (
                <div key={b.id} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                  {/* Slot */}
                  <div style={{
                    width:'100%', aspectRatio:'1', borderRadius:12,
                    background: earned ? 'rgba(96,165,250,.1)' : 'rgba(255,255,255,.025)',
                    border: `2px solid ${earned ? 'rgba(96,165,250,.35)' : 'rgba(255,255,255,.06)'}`,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    position:'relative', overflow:'hidden', padding:4,
                    boxShadow: earned ? '0 0 20px rgba(96,165,250,.2)' : 'none',
                    animation: earned ? `bcBadge .5s ${idx*.04}s cubic-bezier(.34,1.56,.64,1) both` : 'none',
                  }}>
                    <BadgeMedal shape={b.shape} colour={b.colour} symbol={b.symbol} size={56} muted={!earned} />
                  </div>

                  {/* Label */}
                  <div style={{ textAlign:'center' }}>
                    <div style={{ fontSize:9.5, fontWeight:700, color: earned ? '#93c5fd' : 'rgba(255,255,255,.18)', lineHeight:1.25 }}>{b.name}</div>
                    <div style={{ fontSize:8.5, color: earned ? 'rgba(147,197,253,.7)' : 'rgba(255,255,255,.13)', lineHeight:1.25, marginTop:1 }}>
                      {earned ? 'Collected!' : 'Locked'}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          )}

          {/* Pagination */}
          {pageCount > 1 && (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:14, marginTop:16 }}>
              <button onClick={() => goPage(page - 1)} disabled={page === 0}
                style={{ background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.12)', color: page===0 ? 'rgba(255,255,255,.2)' : '#bfdbfe', borderRadius:8, width:28, height:28, cursor: page===0 ? 'default' : 'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center' }}>
                ‹
              </button>
              <div style={{ display:'flex', gap:6 }}>
                {Array.from({ length: pageCount }).map((_, i) => (
                  <button key={i} onClick={() => goPage(i)}
                    style={{ width:24, height:24, borderRadius:7, border:'none', cursor:'pointer', background: i===page ? '#60a5fa' : 'rgba(255,255,255,.1)', color: i===page ? '#0d1b2a' : 'rgba(191,219,254,.6)', fontSize:11, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center', transition:'all .2s' }}>
                    {i + 1}
                  </button>
                ))}
              </div>
              <button onClick={() => goPage(page + 1)} disabled={page === pageCount - 1}
                style={{ background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.12)', color: page===pageCount-1 ? 'rgba(255,255,255,.2)' : '#bfdbfe', borderRadius:8, width:28, height:28, cursor: page===pageCount-1 ? 'default' : 'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center' }}>
                ›
              </button>
              <span style={{ fontSize:11, fontWeight:700, color:'rgba(191,219,254,.7)', minWidth:52 }}>Page {page + 1} of {pageCount}</span>
            </div>
          )}

          {/* Bottom strip */}
          <div style={{ marginTop:14, textAlign:'center', fontSize:11, color:'rgba(96,165,250,.38)', fontWeight:600, letterSpacing:.5 }}>
            Play games to earn more badges and unlock Pao's outfits!
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}

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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PaoCustomizePage({ onDone, lang = 'en', patientEmail = null }) {
  const [activeTab,     setActiveTab]     = useState('hair')
  const pao = usePao()
  const [howToUnlockByCode, setHowToUnlockByCode] = useState({})
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
          badge: LEGACY_BADGE_BY_CODE[i.code] || null,
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

  useEffect(() => {
    const t = setTimeout(() => {
      tts(pickLine(CUSTOMIZE_LINES.intro, lang), {
        onStart: () => setTalking(true),
        onEnd:   () => { setTalking(false); setMouthOpen(false) },
        onWord:  (p) => setDisplayText(p),
      })
    }, 350)
    return () => { clearTimeout(t); stopPaoVoice() }
  }, []) // eslint-disable-line

  useEffect(() => {
    if (talking) { mouthRef.current = setInterval(() => setMouthOpen(p => !p), 155) }
    else { clearInterval(mouthRef.current); setMouthOpen(false) }
    return () => clearInterval(mouthRef.current)
  }, [talking])

  const isUnlocked = (item) => {
    if (item.unlock) return item.unlock.type === 'free' || unlockedItemCodes.has(item.code)
    return !item.badge || earnedBadges.has(item.badge)
  }

  const getEquippedName = (catId) =>
    categories.find(c => c.id === catId)?.items.find(i => i.id === equipped[catId])?.name ?? 'None'

  const equip = (catId, item) => {
    if (!isUnlocked(item)) return
    setEquipped(e => ({ ...e, [catId]: item.id }))
    pao.equip(catId, item.id === 'none' ? null : item.code).catch(() => { /* server keeps the last good outfit */ })
    tts(item.id === 'none' ? pickLine(CUSTOMIZE_LINES.backToNatural, lang) : pickLine(CUSTOMIZE_LINES.loveTheItem, lang, item.name), {})
  }

  const activeCategory = categories.find(c => c.id === activeTab)

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
    return <BadgeCasePage earnedBadges={earnedBadges} onBack={() => setShowBadgeCase(false)}/>
  }

  return (
    <div className="pc-root">
      <style>{`
        .pc-root { position:fixed; inset:0; z-index:9999; display:flex; align-items:center; justify-content:center; padding:18px; background:radial-gradient(circle,rgba(255,255,255,.06) 1.5px,transparent 2px) 0 0/26px 26px,linear-gradient(180deg,#1b2b5c,#14204a); font-family:'Segoe UI',system-ui,sans-serif; color:#1e293b; overflow:hidden; }
        .pc-panel { width:min(1100px,100%); height:min(640px,100%); display:flex; flex-direction:column; background:#f4f8ff; border-radius:22px; overflow:hidden; box-shadow:0 24px 70px rgba(0,0,0,.45); border:3px solid #7fb6ff; }
        .pc-title { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:12px 16px; background:linear-gradient(180deg,#5eaeff,#2f7fe8); color:#fff; flex-shrink:0; }
        .pc-title h1 { margin:0; font-size:20px; font-weight:900; letter-spacing:.3px; text-shadow:0 2px 0 rgba(0,0,0,.2); }
        .pc-close { width:36px; height:36px; border-radius:10px; border:2px solid #fff; background:#ef4444; color:#fff; font-size:18px; font-weight:900; cursor:pointer; flex-shrink:0; }
        .pc-badges { background:rgba(255,255,255,.2); border:1.5px solid rgba(255,255,255,.6); color:#fff; border-radius:10px; padding:6px 12px; font-size:13px; font-weight:800; cursor:pointer; white-space:nowrap; }
        .pc-body { flex:1; display:grid; grid-template-columns:200px 1fr 280px; min-height:0; }
        .pc-cats { background:#dbeafe; border-right:2px solid #93c5fd; padding:10px; display:flex; flex-direction:column; gap:8px; overflow-y:auto; }
        .pc-cat { display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:12px; border:2px solid #bfdbfe; background:#fff; cursor:pointer; text-align:left; font-weight:800; color:#1e3a8a; font-size:14px; }
        .pc-cat.on { background:#2f7fe8; border-color:#1d4ed8; color:#fff; }
        .pc-grid-wrap { display:flex; flex-direction:column; min-height:0; }
        .pc-note { margin:10px 12px 0; padding:8px 12px; border-radius:10px; background:#fff7d6; border:1.5px solid #facc15; font-size:12px; font-weight:700; color:#854d0e; }
        .pc-grid { flex:1; overflow-y:auto; display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; padding:12px; align-content:start; }
        .pc-tile { position:relative; background:#fff; border:2px solid #cbd5e1; border-radius:14px; padding:10px 8px; cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:4px; min-height:132px; font-family:inherit; }
        .pc-tile.on { border-color:#7c3aed; background:#f5f3ff; box-shadow:0 0 0 3px rgba(124,58,237,.25); }
        .pc-tile.lock { opacity:.6; cursor:not-allowed; background:#f1f5f9; }
        .pc-tile-name { font-size:12.5px; font-weight:800; text-align:center; color:#1e293b; }
        .pc-tile-sub { font-size:10.5px; color:#475569; text-align:center; line-height:1.3; }
        .pc-tile-tag { margin-top:auto; font-size:10.5px; font-weight:800; padding:3px 8px; border-radius:999px; background:#e2e8f0; color:#334155; text-align:center; }
        .pc-preview { background:#fff; border-left:2px solid #93c5fd; padding:14px; display:flex; flex-direction:column; align-items:center; gap:10px; overflow-y:auto; }
        .pc-equipped { display:grid; grid-template-columns:1fr 1fr; gap:6px; width:100%; }
        .pc-eq { background:#eff6ff; border:1.5px solid #bfdbfe; border-radius:10px; padding:6px 8px; font-size:11px; }
        .pc-eq b { display:block; color:#1e40af; font-size:10px; text-transform:uppercase; letter-spacing:.5px; }
        .pc-bubble { width:100%; background:#f8fafc; border:2px solid #cbd5e1; border-radius:14px; padding:8px 10px; font-size:12.5px; font-weight:700; color:#1e293b; min-height:40px; }
        .pc-play { width:100%; margin-top:auto; border:none; border-radius:14px; padding:13px; background:linear-gradient(180deg,#34d399,#16a34a); color:#fff; font-size:16px; font-weight:900; cursor:pointer; box-shadow:0 5px 0 #0f7a3a; }
        @media (max-width: 900px) {
          .pc-root { overflow-y:auto; align-items:flex-start; }
          .pc-panel { height:auto; min-height:100%; overflow:visible; }
          .pc-body { grid-template-columns:1fr; grid-template-rows:none; flex:none; }
          .pc-grid-wrap { min-height:340px; }
          .pc-grid { overflow:visible; }
          .pc-preview { order:-1; flex-direction:row; flex-wrap:wrap; justify-content:center; border-left:none; border-bottom:2px solid #93c5fd; padding:10px; }
          .pc-cats { flex-direction:row; overflow-x:auto; overflow-y:hidden; border-right:none; border-bottom:2px solid #93c5fd; padding:8px; }
          .pc-cat { flex-shrink:0; padding:8px 12px; }
          .pc-grid { grid-template-columns:repeat(3,minmax(0,1fr)); }
          .pc-play { margin-top:0; }
        }
        @media (max-width: 560px) {
          .pc-root { padding:0; }
          .pc-panel { border-radius:0; border:none; }
          .pc-grid { grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; padding:10px; }
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
            <button className="pc-close" aria-label="Close" onClick={() => { stopPaoVoice(); onDone() }}>✕</button>
          </div>
        </div>

        <div className="pc-body">
          <div className="pc-cats" role="tablist" aria-label="Categories">
            {categories.map(cat => (
              <button key={cat.id} role="tab" aria-selected={activeTab === cat.id}
                className={`pc-cat ${activeTab === cat.id ? 'on' : ''}`} onClick={() => setActiveTab(cat.id)}>
                <span style={{ fontSize:20 }} aria-hidden="true">{cat.icon}</span>
                {cat.label}
              </button>
            ))}
          </div>

          <div className="pc-grid-wrap">
            <div className="pc-note">Each item shows the badge needed to unlock it</div>
            {wardrobeLoading && <div style={{ padding:'14px 12px', fontSize:12, color:'#475569', fontWeight:700 }}>Loading Pao's wardrobe…</div>}
            <div className="pc-grid">
              {activeCategory?.items.map((item) => {
                const unlocked = isUnlocked(item)
                const isEquipped = equipped[activeTab] === item.id
                const badge = item.badge ? BADGES[item.badge] : null
                const unlockLabel = !badge && item.unlock && item.unlock.type !== 'free'
                  ? describeUnlock(item.unlock.type, { gameId: item.unlock.gameId, value: item.unlock.value, badgeCode: item.unlock.badgeCode }, games, [])
                  : null
                const tag = isEquipped ? '✓ Equipped'
                  : !unlocked ? (badge ? `🔒 ${item.badge}` : unlockLabel ? `🔒 ${unlockLabel}` : '🔒 Locked')
                  : 'Tap to wear'
                return (
                  <button key={item.id} type="button"
                    className={`pc-tile ${isEquipped ? 'on' : ''} ${!unlocked ? 'lock' : ''}`}
                    onClick={() => { if (unlocked) equip(activeTab, item) }}
                    aria-pressed={isEquipped}
                    aria-label={`${item.name}${unlocked ? '' : ', locked'}`}>
                    <div style={{ filter: unlocked ? 'none' : 'grayscale(1) opacity(.6)', display:'flex', alignItems:'center', justifyContent:'center', minHeight:56 }}>
                      <WardrobeThumb item={item} categoryId={activeTab} width={64}/>
                    </div>
                    <div className="pc-tile-name">{item.name}</div>
                    <div className="pc-tile-sub">{item.desc}</div>
                    <div className="pc-tile-tag" style={isEquipped ? { background:'#ede9fe', color:'#6d28d9' } : null}>{tag}</div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="pc-preview">
            <div style={{ animation:'cpFloat 3s ease-in-out infinite' }}>
              <PandaMascot entered={true} mouthOpen={mouthOpen} pxWidth={180} accessories={previewAccessories} viewPad={{ top:60, bottom:6 }}/>
            </div>
            <div className="pc-equipped">
              {categories.map(cat => (
                <div key={cat.id} className="pc-eq"><b>{cat.label}</b>{getEquippedName(cat.id)}</div>
              ))}
            </div>
            <div className="pc-bubble" aria-live="polite">
              {talking && <span style={{ color:'#7c3aed', marginRight:6 }}>🎵</span>}
              {displayText || 'Pao is excited!'}
            </div>
            <button className="pc-play" onClick={() => { stopPaoVoice(); onDone() }}>Let's Play! 🎮</button>
          </div>
        </div>
      </div>
    </div>
  )
}
