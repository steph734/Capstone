import { useState, useEffect, useRef } from 'react'
import PandaMascot from './PandaMascot'
import { OutfitThumbnail } from './PaoOutfits'

const INTRO_SCRIPT = `Heehee! Welcome to my very own wardrobe! This is where you can dress me up! Every time you earn a badge from finishing a game, you unlock brand new items! Right now most things are locked, but as you play more games and earn badges, you will get cool hairstyles, awesome clothes, stylish pants, and cute shoes just for me! I cannot wait to see my new look! Teehee!`

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
}

// ─── Outfit categories ────────────────────────────────────────────────────────

const CATEGORIES = [
  {
    id: 'hair', label: 'Hair', icon: '💇',
    items: [
      { id:'none',         name:'Natural',          preview:null,  badge:null,            desc:'Just Pao being Pao!' },
      { id:'party_hat',    name:'Party Hat',         preview:'🎉',  badge:'First Win',     desc:'Cone hat with pompom — celebrate your first win!' },
      { id:'flower_crown', name:'Flower Crown',      preview:'🌸',  badge:'Perfect Score', desc:'Soft daisy chain crown, cute & gender-neutral' },
      { id:'wizard_hat',   name:'Wizard Hat',        preview:'🧙',  badge:'Word Wizard',   desc:'Starry wizard hat — perfect for the Word Wizard!' },
      { id:'backwards_cap',name:'Backwards Cap',     preview:'🧢',  badge:'Level 3',       desc:'Casual & playful, a mid-tier look' },
      { id:'bunny_ears',   name:'Bunny Ears',        preview:'🐰',  badge:'Word Master',   desc:'Soft rounded bunny ears headband' },
    ],
  },
  {
    id: 'clothes', label: 'Clothes', icon: '👕',
    items: [
      { id:'none',         name:'Natural',           preview:null,  badge:null,            desc:'Pao in his natural fluffiness!' },
      { id:'rainbow_tee',  name:'Rainbow Tee',       preview:'🌈',  badge:'First Win',     desc:'Simple tee with a rainbow stripe across the chest' },
      { id:'astronaut',    name:'Astronaut Suit',    preview:'👨‍🚀', badge:'Alphabet Blast', desc:'Puffy white suit with round belly window' },
      { id:'hero_tee',     name:'Superhero Cape',    preview:'🦸',  badge:'Super Player',  desc:'Logo on chest + tiny cape flutter!' },
      { id:'cozy_hoodie',  name:'Cozy Hoodie',       preview:'🧥',  badge:'Cozy Player',   desc:'Hoodie with panda ears sewn on top & paw-print pocket' },
      { id:'overalls',     name:'Star Overalls',     preview:'⭐',  badge:'Star Collector', desc:'Denim overalls with one big star patch on the pocket' },
    ],
  },
  {
    id: 'pants', label: 'Pants', icon: '👖',
    items: [
      { id:'none',         name:'Natural',            preview:null,  badge:null,           desc:'Pao likes keeping it minimal!' },
      { id:'polka_dots',   name:'Polka Dot Leggings', preview:'🟣',  badge:'First Win',    desc:'Colorful dots all over — fun & easy to spot!' },
      { id:'cargo',        name:'Cargo Shorts',       preview:'🩳',  badge:'Explorer',     desc:'Adventurer look, matches Explorer badge' },
      { id:'pajamas',      name:'Pajama Pants',       preview:'😴',  badge:'Story Builder', desc:'Cozy striped sleepwear for bedtime stories' },
      { id:'overalls_b',   name:'Denim Overalls',     preview:'👖',  badge:'Level 5',      desc:'Pairs as a matching set with Star Overalls top' },
    ],
  },
  {
    id: 'shoes', label: 'Shoes', icon: '👟',
    items: [
      { id:'none',         name:'Natural',            preview:null,  badge:null,           desc:"Pao's natural soft paws!" },
      { id:'rockets',      name:'Rocket Sneakers',    preview:'🚀',  badge:'Alphabet Blast',desc:'Sneakers with little flame & star trail graphic' },
      { id:'rain_boots',   name:'Rain Boots',         preview:'🟡',  badge:'Level 2',      desc:'Bright yellow boots — fun rounded shape' },
      { id:'ballet',       name:'Ballet Flats',       preview:'🩰',  badge:'Fashionista',  desc:'Soft ballet flats with a little bow' },
      { id:'hightops',     name:'High-Top Stars',     preview:'👟',  badge:'Star Collector',desc:'High-tops covered in star motifs' },
    ],
  },
]

// ─── TTS helper ───────────────────────────────────────────────────────────────

function tts(text, { onStart, onEnd, onWord } = {}) {
  if (!window.speechSynthesis) { if (onEnd) onEnd(); return }
  window.speechSynthesis.cancel()
  const utt = new SpeechSynthesisUtterance(text)
  utt.rate = 1.1; utt.pitch = 1.62; utt.volume = 1
  if (onStart) utt.onstart    = onStart
  if (onEnd)   utt.onend      = onEnd
  if (onWord)  utt.onboundary = (e) => { if (e.name === 'word') onWord(text.substring(0, e.charIndex + e.charLength)) }
  const go = () => {
    const v = window.speechSynthesis.getVoices()
    const voice = v.find(x => /zira/i.test(x.name)) || v.find(x => /samantha/i.test(x.name)) || v.find(x => x.lang === 'en-US') || v[0]
    if (voice) utt.voice = voice
    window.speechSynthesis.speak(utt)
  }
  if (window.speechSynthesis.getVoices().length > 0) go()
  else window.speechSynthesis.onvoiceschanged = go
}

// ─── Badge Case Modal ─────────────────────────────────────────────────────────

function BadgeCaseModal({ earnedBadges, onClose }) {
  const ALL_KEYS = Object.keys(BADGES)
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position:'fixed', inset:0, zIndex:10010, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,.75)', backdropFilter:'blur(8px)' }}>
      <style>{`
        @keyframes bcIn   { from{opacity:0;transform:scale(.88) translateY(18px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes bcBadge{ 0%{transform:scale(0) rotate(-10deg)} 65%{transform:scale(1.12) rotate(3deg)} 100%{transform:scale(1) rotate(0)} }
        @keyframes bcPulse{ 0%,100%{opacity:.4} 50%{opacity:1} }
        @keyframes bcGlow { 0%,100%{box-shadow:0 0 14px rgba(96,165,250,.3)} 50%{box-shadow:0 0 30px rgba(96,165,250,.65)} }
      `}</style>

      <div style={{ width:580, maxWidth:'95vw', animation:'bcIn .45s cubic-bezier(.34,1.56,.64,1)' }}>

        {/* ── Lid ── */}
        <div style={{ background:'linear-gradient(180deg,#1c1c2e 0%,#16213e 100%)', border:'3px solid #1e3a5f', borderBottom:'none', borderRadius:'16px 16px 0 0', padding:'14px 20px 10px', display:'flex', alignItems:'center', justifyContent:'space-between', animation:'bcGlow 2.5s ease-in-out infinite' }}>
          <div>
            <h2 style={{ margin:0, fontSize:18, fontWeight:900, color:'#e2e8f0' }}>🏆 Pao's Badge Case</h2>
            <div style={{ fontSize:11, color:'rgba(96,165,250,.7)', marginTop:2, fontWeight:600 }}>
              {earnedBadges.size} / {ALL_KEYS.length} badges collected
            </div>
          </div>
          {/* LED dots */}
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ display:'flex', gap:4 }}>
              {[0,0.15,0.3,0.45,0.6].map((d,i) => (
                <div key={i} style={{ width:7, height:7, borderRadius:'50%', background:'#60a5fa', animation:`bcPulse 1.8s ease-in-out ${d}s infinite`, boxShadow:'0 0 7px #60a5fa' }}/>
              ))}
            </div>
            <button onClick={onClose} style={{ background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.14)', color:'rgba(255,255,255,.6)', borderRadius:8, width:30, height:30, cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center', padding:0 }}>✕</button>
          </div>
        </div>

        {/* ── Hinge ── */}
        <div style={{ height:7, background:'linear-gradient(90deg,#0d2b4a,#1a4a7a,#1a4a7a,#0d2b4a)', position:'relative' }}>
          <div style={{ position:'absolute', inset:'2px 18%', background:'rgba(96,165,250,.2)', borderRadius:2 }}/>
          {[25, 75].map(p => (
            <div key={p} style={{ position:'absolute', left:`${p}%`, top:'50%', transform:'translate(-50%,-50%)', width:11, height:11, borderRadius:'50%', background:'#1b3a5c', border:'2px solid rgba(96,165,250,.4)' }}/>
          ))}
        </div>

        {/* ── Interior ── */}
        <div style={{ background:'linear-gradient(180deg,#090912 0%,#0d0d1c 100%)', border:'3px solid #1e3a5f', borderTop:'none', borderRadius:'0 0 16px 16px', padding:'20px 20px 18px', boxShadow:'inset 0 6px 28px rgba(0,0,0,.7), 0 20px 56px rgba(0,0,0,.7)' }}>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
            {ALL_KEYS.map((key, idx) => {
              const b      = BADGES[key]
              const earned = earnedBadges.has(key)
              return (
                <div key={key} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:5 }}>
                  {/* Slot */}
                  <div style={{
                    width:'100%', aspectRatio:'1', borderRadius:14,
                    background: earned ? `${b.color}18` : 'rgba(255,255,255,.025)',
                    border: `2px solid ${earned ? b.color+'50' : 'rgba(255,255,255,.06)'}`,
                    display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column',
                    position:'relative', overflow:'hidden',
                    boxShadow: earned ? `0 0 20px ${b.color}28, inset 0 0 14px ${b.color}10` : 'none',
                  }}>
                    {earned ? (
                      <>
                        <div style={{ position:'absolute', inset:0, background:`radial-gradient(circle at 40% 30%,${b.color}25 0%,transparent 68%)`, pointerEvents:'none' }}/>
                        <div style={{ fontSize:36, animation:`bcBadge .5s ${idx*.04}s cubic-bezier(.34,1.56,.64,1) both`, position:'relative', zIndex:1 }}>
                          {b.emoji}
                        </div>
                        {/* Top shine */}
                        <div style={{ position:'absolute', top:0, left:0, right:0, height:1, background:`linear-gradient(90deg,transparent,${b.color}55,transparent)` }}/>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize:28, filter:'grayscale(1)', opacity:.12 }}>{b.emoji}</div>
                        <div style={{ fontSize:13, color:'rgba(255,255,255,.1)' }}>🔒</div>
                      </>
                    )}
                  </div>

                  {/* Label */}
                  <div style={{ textAlign:'center' }}>
                    <div style={{ fontSize:10, fontWeight:700, color: earned ? b.color : 'rgba(255,255,255,.18)', lineHeight:1.3 }}>{key}</div>
                    <div style={{ fontSize:9, color: earned ? `${b.color}80` : 'rgba(255,255,255,.13)', lineHeight:1.3, marginTop:1 }}>
                      {earned ? 'Collected!' : b.how}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Bottom strip */}
          <div style={{ marginTop:16, textAlign:'center', fontSize:11, color:'rgba(96,165,250,.38)', fontWeight:600, letterSpacing:.5 }}>
            Play games to earn more badges and unlock Pao's outfits!
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PaoCustomizePage({ onDone }) {
  const [activeTab,     setActiveTab]     = useState('hair')
  const [equipped,      setEquipped]      = useState({ hair:'none', clothes:'none', pants:'none', shoes:'none' })
  const [talking,       setTalking]       = useState(false)
  const [mouthOpen,     setMouthOpen]     = useState(false)
  const [displayText,   setDisplayText]   = useState('')
  const [hoveredItem,   setHoveredItem]   = useState(null)
  const [showBadgeCase, setShowBadgeCase] = useState(false)
  const [earnedBadges,  setEarnedBadges]  = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('pao_badges') || '[]')) }
    catch { return new Set() }
  })
  const mouthRef = useRef(null)

  // refresh when badge case opens (badge may have just been earned)
  useEffect(() => {
    if (!showBadgeCase) return
    try { setEarnedBadges(new Set(JSON.parse(localStorage.getItem('pao_badges') || '[]'))) }
    catch {}
  }, [showBadgeCase])

  useEffect(() => {
    const t = setTimeout(() => {
      tts(INTRO_SCRIPT, {
        onStart: () => setTalking(true),
        onEnd:   () => { setTalking(false); setMouthOpen(false) },
        onWord:  (p) => setDisplayText(p),
      })
    }, 350)
    return () => { clearTimeout(t); window.speechSynthesis?.cancel() }
  }, [])

  useEffect(() => {
    if (talking) { mouthRef.current = setInterval(() => setMouthOpen(p => !p), 155) }
    else { clearInterval(mouthRef.current); setMouthOpen(false) }
    return () => clearInterval(mouthRef.current)
  }, [talking])

  const isUnlocked = (item) => !item.badge || earnedBadges.has(item.badge)

  const getEquippedName = (catId) =>
    CATEGORIES.find(c => c.id === catId)?.items.find(i => i.id === equipped[catId])?.name ?? 'None'

  const equip = (catId, item) => {
    if (!isUnlocked(item)) return
    setEquipped(e => ({ ...e, [catId]: item.id }))
    tts(item.id === 'none' ? 'Back to natural!' : `Ooh I love the ${item.name}!`, {})
  }

  const activeCategory = CATEGORIES.find(c => c.id === activeTab)

  return (
    <div style={{ position:'fixed', inset:0, zIndex:9999, background:'radial-gradient(ellipse at 50% 35%,#1a1430 0%,#0a0a0f 100%)', color:'#fff', fontFamily:"'Segoe UI',system-ui,sans-serif", display:'flex', overflow:'hidden' }}>
      <style>{`
        @keyframes cpFloat     { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes cpPop       { 0%{transform:scale(1)} 45%{transform:scale(1.18)} 100%{transform:scale(1)} }
        @keyframes cpSoundWave { 0%,100%{transform:scaleY(.3)} 50%{transform:scaleY(1)} }
        @keyframes cpCursor    { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes cpShine     { 0%{transform:translateX(-120%)} 100%{transform:translateX(120%)} }
        @keyframes cpSlideIn   { from{opacity:0;transform:scale(.92) translateY(8px)} to{opacity:1;transform:scale(1) translateY(0)} }
      `}</style>

      {/* ══════ LEFT: Preview panel ══════ */}
      <div style={{ width:260, flexShrink:0, display:'flex', flexDirection:'column', alignItems:'center', padding:'20px 14px 16px', borderRight:'1px solid rgba(255,255,255,.07)', background:'rgba(255,255,255,.02)', gap:10, overflowY:'auto' }}>
        <h2 style={{ margin:0, fontSize:11, fontWeight:800, color:'rgba(255,255,255,.35)', letterSpacing:1.6, textTransform:'uppercase' }}>Preview</h2>

        {/* Pao with SVG outfit overlays */}
        <div style={{ animation:'cpFloat 3s ease-in-out infinite', flexShrink:0 }}>
          <PandaMascot entered={true} mouthOpen={mouthOpen} pxWidth={200} accessories={equipped} viewPad={{ top:72, bottom:8 }}/>
        </div>

        {/* Equipped slots */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, width:'100%' }}>
          {CATEGORIES.map(cat => (
            <div key={cat.id} onClick={() => setActiveTab(cat.id)} style={{ display:'flex', alignItems:'center', gap:7, background: activeTab===cat.id ? 'rgba(176,132,255,.15)' : 'rgba(255,255,255,.04)', border:`1px solid ${activeTab===cat.id ? 'rgba(176,132,255,.4)' : 'rgba(255,255,255,.07)'}`, borderRadius:11, padding:'7px 9px', cursor:'pointer', transition:'all .2s' }}>
              <span style={{ fontSize:20 }}>{cat.icon}</span>
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:9, color:'rgba(255,255,255,.35)', fontWeight:700, textTransform:'uppercase', letterSpacing:.8 }}>{cat.label}</div>
                <div style={{ fontSize:11, fontWeight:700, color: activeTab===cat.id ? '#d4b4ff' : 'rgba(255,255,255,.55)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{getEquippedName(cat.id)}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Speech bubble */}
        <div style={{ width:'100%', background:'rgba(255,255,255,.05)', border:'1.5px solid rgba(255,255,255,.09)', borderRadius:'4px 14px 14px 14px', padding:'6px 10px', minHeight:32, maxHeight:68, overflowY:'auto' }}>
          {talking && (
            <div style={{ display:'flex', gap:3, alignItems:'center', marginBottom:5 }}>
              {[0,.1,.05,.15,.02].map((d,i) => (
                <div key={i} style={{ width:3, height:10, borderRadius:4, background:'rgba(168,130,255,.85)', animation:`cpSoundWave .5s ease-in-out ${d}s infinite` }}/>
              ))}
            </div>
          )}
          <div style={{ fontSize:10, fontWeight:600, color:'rgba(255,255,255,.82)', lineHeight:1.5 }}>
            {displayText || <span style={{ color:'rgba(255,255,255,.28)', fontStyle:'italic', fontSize:9 }}>Pao is excited!</span>}
            {talking && <span style={{ animation:'cpCursor .7s step-end infinite', marginLeft:2, color:'#b084ff' }}>|</span>}
          </div>
        </div>

        <button onClick={() => { window.speechSynthesis?.cancel(); onDone() }}
          style={{ width:'100%', background:'linear-gradient(135deg,#7c3aed,#b084ff)', border:'none', color:'#fff', borderRadius:14, padding:'12px', fontSize:14, fontWeight:800, cursor:'pointer', boxShadow:'0 4px 20px rgba(124,58,237,.35)', transition:'transform .15s' }}
          onMouseEnter={e => e.currentTarget.style.transform='scale(1.03)'}
          onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}>
          Let's Play! 🎮
        </button>
      </div>

      {/* ══════ RIGHT: Wardrobe ══════ */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', position:'relative' }}>

        {/* Badge Case button — top right */}
        <button onClick={() => setShowBadgeCase(true)}
          style={{ position:'absolute', top:16, right:18, zIndex:10, display:'flex', alignItems:'center', gap:7, background:'rgba(15,52,96,.6)', border:'1.5px solid rgba(96,165,250,.4)', color:'#93c5fd', borderRadius:12, padding:'7px 14px', fontSize:13, fontWeight:700, cursor:'pointer', transition:'all .2s', backdropFilter:'blur(6px)' }}
          onMouseEnter={e => { e.currentTarget.style.background='rgba(15,52,96,.9)'; e.currentTarget.style.borderColor='rgba(96,165,250,.8)' }}
          onMouseLeave={e => { e.currentTarget.style.background='rgba(15,52,96,.6)'; e.currentTarget.style.borderColor='rgba(96,165,250,.4)' }}>
          <span style={{ fontSize:16 }}>🏆</span>
          <span>Badge Case</span>
          {earnedBadges.size > 0 && (
            <span style={{ background:'#3b82f6', color:'#fff', borderRadius:10, padding:'1px 7px', fontSize:11, fontWeight:800, marginLeft:2 }}>
              {earnedBadges.size}
            </span>
          )}
        </button>

        {/* Header */}
        <div style={{ padding:'18px 22px 0', flexShrink:0 }}>
          <h1 style={{ margin:'0 0 3px', fontSize:20, fontWeight:900 }}>✨ Customize Pao!</h1>
          <p style={{ margin:0, fontSize:12, color:'rgba(255,255,255,.38)' }}>Earn badges by finishing games to unlock new items for Pao</p>
        </div>

        {/* Info strip */}
        <div style={{ margin:'10px 22px 0', padding:'9px 13px', background:'rgba(255,215,0,.06)', border:'1px solid rgba(255,215,0,.15)', borderRadius:12, display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
          <span style={{ fontSize:20 }}>🏆</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'rgba(255,215,0,.75)' }}>Each item shows the badge needed to unlock it</div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,.35)', marginTop:2 }}>Play Picture-Word Matching → earn Word Wizard → unlock Wizard Hat!</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:6, padding:'10px 22px 0', flexShrink:0 }}>
          {CATEGORIES.map(cat => (
            <button key={cat.id} onClick={() => setActiveTab(cat.id)}
              style={{ background: activeTab===cat.id ? 'rgba(176,132,255,.2)' : 'rgba(255,255,255,.04)', border:`1.5px solid ${activeTab===cat.id ? 'rgba(176,132,255,.5)' : 'rgba(255,255,255,.08)'}`, borderRadius:11, padding:'7px 14px', color: activeTab===cat.id ? '#d4b4ff' : 'rgba(255,255,255,.4)', fontSize:12, fontWeight:700, cursor:'pointer', transition:'all .2s', display:'flex', alignItems:'center', gap:5 }}>
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>

        {/* Items grid */}
        <div style={{ flex:1, overflowY:'auto', padding:'10px 22px 20px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
            {activeCategory?.items.map((item, idx) => {
              const unlocked   = isUnlocked(item)
              const isEquipped = equipped[activeTab] === item.id
              const isLocked   = !unlocked
              const badge      = item.badge ? BADGES[item.badge] : null
              return (
                <button key={item.id}
                  onClick={() => equip(activeTab, item)}
                  onMouseEnter={() => setHoveredItem(item.id)}
                  onMouseLeave={() => setHoveredItem(null)}
                  style={{
                    position:'relative', overflow:'hidden',
                    background: isEquipped ? 'rgba(176,132,255,.2)' : unlocked && hoveredItem===item.id ? 'rgba(255,255,255,.09)' : isLocked ? 'rgba(255,255,255,.02)' : 'rgba(255,255,255,.05)',
                    border: `2px solid ${isEquipped ? '#b084ff' : isLocked ? 'rgba(255,255,255,.06)' : hoveredItem===item.id ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.09)'}`,
                    borderRadius:16, padding:'14px 10px 12px',
                    cursor: isLocked ? 'not-allowed' : 'pointer',
                    display:'flex', flexDirection:'column', alignItems:'center', gap:7,
                    opacity: isLocked ? 0.55 : 1,
                    transition:'all .2s',
                    animation:`cpSlideIn .35s ease ${idx*.05}s both`,
                  }}>

                  {/* Unlocked-badge checkmark */}
                  {unlocked && item.badge && (
                    <div style={{ position:'absolute', top:8, right:8, fontSize:13 }}>✅</div>
                  )}

                  {/* Item thumbnail */}
                  <div style={{ filter: isLocked ? 'grayscale(1) opacity(.55)' : 'none', display:'flex', alignItems:'center', justifyContent:'center', minHeight:52 }}>
                    {item.id === 'none'
                      ? <span style={{ fontSize:36, opacity: isLocked ? .4 : .7 }}>🐼</span>
                      : <OutfitThumbnail category={activeTab} itemId={item.id} width={72}/>
                    }
                  </div>

                  {/* Name + desc */}
                  <div style={{ textAlign:'center', width:'100%' }}>
                    <div style={{ fontSize:13, fontWeight:800, color: isEquipped ? '#d4b4ff' : isLocked ? 'rgba(255,255,255,.35)' : '#fff', marginBottom:2 }}>
                      {item.name}
                    </div>
                    <div style={{ fontSize:10, color:'rgba(255,255,255,.35)', lineHeight:1.4, padding:'0 4px' }}>
                      {item.desc}
                    </div>
                  </div>

                  {/* Lock info */}
                  {isLocked && badge && (
                    <div style={{ width:'100%' }}>
                      <div style={{ height:'1px', background:'rgba(255,255,255,.07)', margin:'2px 0 6px' }}/>
                      <div style={{ display:'flex', flexDirection:'column', gap:3, alignItems:'center' }}>
                        <div style={{ fontSize:10, color:'rgba(255,255,255,.3)', fontWeight:600 }}>Unlock with badge:</div>
                        <div style={{ display:'flex', alignItems:'center', gap:5, background:`${badge.color}15`, border:`1px solid ${badge.color}40`, borderRadius:20, padding:'4px 10px' }}>
                          <span style={{ fontSize:14 }}>{badge.emoji}</span>
                          <div>
                            <div style={{ fontSize:11, fontWeight:800, color:badge.color }}>{item.badge}</div>
                            <div style={{ fontSize:9, color:'rgba(255,255,255,.35)' }}>{badge.how}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Status label */}
                  {isEquipped && (
                    <div style={{ fontSize:11, color:'#b084ff', fontWeight:700 }}>✓ Equipped</div>
                  )}
                  {!isEquipped && unlocked && item.badge && (
                    <div style={{ fontSize:11, color:'#86efac', fontWeight:700 }}>🔓 Unlocked!</div>
                  )}
                  {!isEquipped && !item.badge && (
                    <div style={{ fontSize:11, color:'rgba(255,255,255,.38)' }}>Tap to wear</div>
                  )}

                  {/* Shine sweep on equipped */}
                  {isEquipped && (
                    <div style={{ position:'absolute', inset:0, background:'linear-gradient(105deg,transparent 35%,rgba(176,132,255,.15) 50%,transparent 65%)', animation:'cpShine 2.2s ease-in-out infinite', pointerEvents:'none' }}/>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {showBadgeCase && <BadgeCaseModal earnedBadges={earnedBadges} onClose={() => setShowBadgeCase(false)}/>}
    </div>
  )
}
