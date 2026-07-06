import { useState, useEffect, useRef } from 'react'
import PandaMascot from './PandaMascot'
import { OutfitThumbnail } from './PaoOutfits'
import { speakPao, stopPaoVoice } from '../../utils/paoVoice'

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
  'Echo Master':    { emoji:'📣', color:'#14b8a6', how:'Say every syllable clearly across all 4 Echo levels' },
  'Puzzle Pro':     { emoji:'🧩', color:'#34d399', how:'Finish Puzzle Pals' },
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
      { id:'thinking_cap', name:'Thinking Cap',      preview:'🎓',  badge:'Puzzle Pro',    desc:'Graduation cap with a green tassel — for great problem solvers!' },
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
      { id:'echo_scarf',   name:'Echo Scarf',        preview:'🧣',  badge:'Echo Master',   desc:'Soft scarf stitched with little sound-wave patterns' },
      { id:'puzzle_vest',  name:'Patchwork Puzzle Vest', preview:'🧩', badge:'Puzzle Pro', desc:'Vest stitched from colorful puzzle-piece patches' },
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
  speakPao(text, { pitch: 1.62, rate: 1.1, onStart, onEnd, onWord })
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
    return () => { clearTimeout(t); stopPaoVoice() }
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
    <div style={{ position:'fixed', inset:0, zIndex:9999, background:'radial-gradient(circle, rgba(255,255,255,.06) 1.5px, transparent 2px) 0 0/28px 28px, linear-gradient(180deg,#182552 0%,#1f2f63 100%)', color:'#3a2e6b', fontFamily:"'Segoe UI',system-ui,sans-serif", overflow:'hidden' }}>
      <style>{`
        @keyframes cpFloat     { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes cpPop       { 0%{transform:scale(1)} 45%{transform:scale(1.18)} 100%{transform:scale(1)} }
        @keyframes cpSoundWave { 0%,100%{transform:scaleY(.3)} 50%{transform:scaleY(1)} }
        @keyframes cpCursor    { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes cpShine     { 0%{transform:translateX(-120%)} 100%{transform:translateX(120%)} }
        @keyframes cpSlideIn   { from{opacity:0;transform:scale(.92) translateY(8px)} to{opacity:1;transform:scale(1) translateY(0)} }
      `}</style>

      {/* ══════ Room backdrop: night wall, window, wardrobe, shelf, desk, bed, rug, bean bag ══════ */}

      {/* Wardrobe (green, two doors + drawers) */}
      <div style={{ position:'absolute', left:'3%', top:'8%', width:130, height:260, zIndex:0, background:'linear-gradient(160deg,#4caf7d 0%,#3a9468 100%)', borderRadius:8, boxShadow:'0 14px 34px rgba(0,0,0,.35)', pointerEvents:'none' }}>
        <div style={{ position:'absolute', inset:'8px 8px 60px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:5 }}>
          <div style={{ background:'rgba(255,255,255,.08)', borderRadius:4, position:'relative' }}><div style={{ position:'absolute', right:6, top:'50%', width:5, height:5, borderRadius:'50%', background:'#fdf6ec' }}/></div>
          <div style={{ background:'rgba(255,255,255,.08)', borderRadius:4, position:'relative' }}><div style={{ position:'absolute', left:6, top:'50%', width:5, height:5, borderRadius:'50%', background:'#fdf6ec' }}/></div>
        </div>
        <div style={{ position:'absolute', left:8, right:8, bottom:8, height:24, background:'#e8933f', borderRadius:4 }}/>
        <div style={{ position:'absolute', left:8, right:8, bottom:36, height:16, background:'#e8933f', borderRadius:4 }}/>
      </div>

      {/* Shelf with books above desk */}
      <div style={{ position:'absolute', left:'15%', top:'10%', width:150, height:10, zIndex:0, background:'#c88748', borderRadius:3, boxShadow:'0 4px 10px rgba(0,0,0,.3)', pointerEvents:'none' }}>
        <div style={{ position:'absolute', bottom:10, left:4, display:'flex', alignItems:'flex-end', gap:2 }}>
          {['#ef4444','#f59e0b','#10b981','#6366f1','#ec4899'].map((c,i) => (
            <div key={i} style={{ width:12, height:22+(i%3)*6, background:c, borderRadius:'2px 2px 0 0' }}/>
          ))}
        </div>
      </div>

      {/* Desk + lamp + chair */}
      <div style={{ position:'absolute', left:'15%', top:'46%', width:150, height:70, zIndex:0, background:'linear-gradient(180deg,#f4e3c5,#e0c898)', borderRadius:'4px 4px 0 0', boxShadow:'0 10px 24px rgba(0,0,0,.28)', pointerEvents:'none' }}>
        <div style={{ position:'absolute', top:-30, right:14, width:14, height:30, background:'#94a3b8', borderRadius:2 }}/>
        <div style={{ position:'absolute', top:-46, right:6, width:30, height:20, background:'radial-gradient(circle,#ffe9a8,rgba(255,233,168,0))', borderRadius:'50% 50% 50% 4px' }}/>
      </div>
      <div style={{ position:'absolute', left:'12.5%', top:'52%', width:34, height:44, zIndex:0, background:'#4caf7d', borderRadius:'4px 4px 2px 2px', boxShadow:'0 8px 18px rgba(0,0,0,.25)', pointerEvents:'none' }}>
        <div style={{ position:'absolute', top:-22, left:0, right:0, height:22, background:'#4caf7d', borderRadius:'4px 4px 0 0' }}/>
      </div>

      {/* Window with glow + curtains */}
      <div style={{ position:'absolute', right:'20%', top:'4%', width:150, height:180, zIndex:0, pointerEvents:'none' }}>
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(160deg,#fff3c4,#ffe08a)', border:'9px solid #fdf6ec', borderRadius:6, boxShadow:'0 0 60px 12px rgba(255,224,138,.35)' }}>
          <div style={{ position:'absolute', left:'50%', top:0, bottom:0, width:5, background:'#fdf6ec', transform:'translateX(-50%)' }}/>
          <div style={{ position:'absolute', top:'50%', left:0, right:0, height:5, background:'#fdf6ec', transform:'translateY(-50%)' }}/>
        </div>
        <div style={{ position:'absolute', left:-18, top:-14, width:34, height:210, background:'linear-gradient(180deg,#f2b84b,#e0983a)', borderRadius:'40% 10% 10% 40%' }}/>
        <div style={{ position:'absolute', right:-18, top:-14, width:34, height:210, background:'linear-gradient(180deg,#f2b84b,#e0983a)', borderRadius:'10% 40% 40% 10%' }}/>
      </div>

      {/* Bed with purple blanket + yellow trim */}
      <div style={{ position:'absolute', right:'3%', top:'28%', width:220, height:160, zIndex:0, pointerEvents:'none' }}>
        <div style={{ position:'absolute', left:0, top:0, width:26, height:'100%', background:'#c4a6f0', borderRadius:8, boxShadow:'0 8px 20px rgba(0,0,0,.28)' }}/>
        <div style={{ position:'absolute', left:20, top:14, width:60, height:36, background:'#fdf6ec', borderRadius:8, boxShadow:'0 4px 10px rgba(0,0,0,.15)' }}/>
        <div style={{ position:'absolute', left:20, top:44, right:0, bottom:0, background:'linear-gradient(180deg,#a78bda,#8f6fd1)', borderRadius:10, boxShadow:'0 12px 28px rgba(0,0,0,.28)' }}>
          <div style={{ position:'absolute', left:0, right:0, bottom:0, height:14, background:'#f2c84b', borderRadius:'0 0 10px 10px' }}/>
        </div>
      </div>

      {/* Small shelf unit with teddy + boat */}
      <div style={{ position:'absolute', right:'2%', top:'62%', width:170, height:80, zIndex:0, background:'linear-gradient(160deg,#c4a6f0,#a98be0)', borderRadius:8, boxShadow:'0 12px 28px rgba(0,0,0,.3)', display:'flex', pointerEvents:'none' }}>
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', borderRight:'2px solid rgba(255,255,255,.25)' }}><Teddy size={44}/></div>
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}><Boat size={44}/></div>
      </div>

      {/* Bean bag */}
      <div style={{ position:'absolute', left:'5%', bottom:'13vh', width:90, height:84, zIndex:0, background:'radial-gradient(circle at 35% 30%,#b08bf0,#8f63d8)', borderRadius:'48% 52% 45% 55%/55% 50% 55% 45%', boxShadow:'0 10px 22px rgba(0,0,0,.3)', pointerEvents:'none' }}/>

      {/* Wood floor */}
      <div style={{ position:'absolute', left:0, right:0, bottom:0, height:'12vh', zIndex:0, background:'linear-gradient(180deg,#caa06a 0%,#a9793f 100%)', boxShadow:'0 -2px 12px rgba(0,0,0,.2) inset', pointerEvents:'none' }}>
        <div style={{ position:'absolute', inset:0, backgroundImage:'repeating-linear-gradient(90deg, rgba(80,55,20,.15) 0, rgba(80,55,20,.15) 2px, transparent 2px, transparent 90px)' }}/>
      </div>

      {/* Round rug */}
      <div style={{ position:'absolute', left:'50%', bottom:'2vh', width:300, height:'9vh', transform:'translateX(-50%)', zIndex:0, background:'radial-gradient(ellipse,#f2b84b,#e0983a)', borderRadius:'50%', opacity:.9, boxShadow:'0 6px 18px rgba(0,0,0,.25)', pointerEvents:'none' }}/>

      {/* ══════ Floating content card (frames the room around it) ══════ */}
      <div style={{ position:'absolute', inset:'3.5vh 3vw', zIndex:1, display:'flex', borderRadius:26, overflow:'hidden', boxShadow:'0 24px 70px rgba(0,0,0,.45)' }}>

      {/* ══════ LEFT: Preview panel ══════ */}
      <div style={{ width:260, flexShrink:0, display:'flex', flexDirection:'column', alignItems:'center', padding:'20px 14px 16px', borderRight:'1px solid rgba(120,90,40,.15)', background:'rgba(255,251,240,.95)', gap:10, overflowY:'auto' }}>
        <h2 style={{ margin:0, fontSize:11, fontWeight:800, color:'rgba(58,46,107,.5)', letterSpacing:1.6, textTransform:'uppercase' }}>Preview</h2>

        {/* Pao with SVG outfit overlays */}
        <div style={{ animation:'cpFloat 3s ease-in-out infinite', flexShrink:0 }}>
          <PandaMascot entered={true} mouthOpen={mouthOpen} pxWidth={200} accessories={equipped} viewPad={{ top:72, bottom:8 }}/>
        </div>

        {/* Equipped slots */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, width:'100%' }}>
          {CATEGORIES.map(cat => (
            <div key={cat.id} onClick={() => setActiveTab(cat.id)} style={{ display:'flex', alignItems:'center', gap:7, background: activeTab===cat.id ? 'rgba(139,92,246,.16)' : 'rgba(124,79,224,.06)', border:`1px solid ${activeTab===cat.id ? 'rgba(139,92,246,.45)' : 'rgba(124,79,224,.15)'}`, borderRadius:11, padding:'7px 9px', cursor:'pointer', transition:'all .2s' }}>
              <span style={{ fontSize:20 }}>{cat.icon}</span>
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:9, color:'rgba(58,46,107,.5)', fontWeight:700, textTransform:'uppercase', letterSpacing:.8 }}>{cat.label}</div>
                <div style={{ fontSize:11, fontWeight:700, color: activeTab===cat.id ? '#6d28d9' : 'rgba(45,42,74,.65)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{getEquippedName(cat.id)}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Speech bubble */}
        <div style={{ width:'100%', background:'rgba(255,255,255,.85)', border:'1.5px solid rgba(124,79,224,.18)', borderRadius:'4px 14px 14px 14px', padding:'6px 10px', minHeight:32, maxHeight:68, overflowY:'auto' }}>
          {talking && (
            <div style={{ display:'flex', gap:3, alignItems:'center', marginBottom:5 }}>
              {[0,.1,.05,.15,.02].map((d,i) => (
                <div key={i} style={{ width:3, height:10, borderRadius:4, background:'rgba(124,79,224,.75)', animation:`cpSoundWave .5s ease-in-out ${d}s infinite` }}/>
              ))}
            </div>
          )}
          <div style={{ fontSize:10, fontWeight:600, color:'#3a2e6b', lineHeight:1.5 }}>
            {displayText || <span style={{ color:'rgba(58,46,107,.4)', fontStyle:'italic', fontSize:9 }}>Pao is excited!</span>}
            {talking && <span style={{ animation:'cpCursor .7s step-end infinite', marginLeft:2, color:'#7c3aed' }}>|</span>}
          </div>
        </div>

        <button onClick={() => { stopPaoVoice(); onDone() }}
          style={{ width:'100%', background:'linear-gradient(135deg,#7c3aed,#b084ff)', border:'none', color:'#fff', borderRadius:14, padding:'12px', fontSize:14, fontWeight:800, cursor:'pointer', boxShadow:'0 4px 20px rgba(124,58,237,.35)', transition:'transform .15s' }}
          onMouseEnter={e => e.currentTarget.style.transform='scale(1.03)'}
          onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}>
          Let's Play! 🎮
        </button>
      </div>

      {/* ══════ RIGHT: Wardrobe ══════ */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', position:'relative', zIndex:1, background:'rgba(255,251,240,.88)' }}>

        {/* Badge Case button — top right */}
        <button onClick={() => setShowBadgeCase(true)}
          style={{ position:'absolute', top:16, right:18, zIndex:10, display:'flex', alignItems:'center', gap:7, background:'rgba(15,52,96,.85)', border:'1.5px solid rgba(96,165,250,.5)', color:'#bfdbfe', borderRadius:12, padding:'7px 14px', fontSize:13, fontWeight:700, cursor:'pointer', transition:'all .2s', backdropFilter:'blur(6px)' }}
          onMouseEnter={e => { e.currentTarget.style.background='rgba(15,52,96,1)'; e.currentTarget.style.borderColor='rgba(96,165,250,.9)' }}
          onMouseLeave={e => { e.currentTarget.style.background='rgba(15,52,96,.85)'; e.currentTarget.style.borderColor='rgba(96,165,250,.5)' }}>
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
          <h1 style={{ margin:'0 0 3px', fontSize:20, fontWeight:900, color:'#3a2e6b' }}>✨ Customize Pao!</h1>
          <p style={{ margin:0, fontSize:12, color:'rgba(58,46,107,.55)' }}>Earn badges by finishing games to unlock new items for Pao</p>
        </div>

        {/* Info strip */}
        <div style={{ margin:'10px 22px 0', padding:'9px 13px', background:'rgba(255,183,3,.14)', border:'1px solid rgba(255,183,3,.35)', borderRadius:12, display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
          <span style={{ fontSize:20 }}>🏆</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#92400e' }}>Each item shows the badge needed to unlock it</div>
            <div style={{ fontSize:11, color:'rgba(58,46,107,.55)', marginTop:2 }}>Play Picture-Word Matching → earn Word Wizard → unlock Wizard Hat!</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:6, padding:'10px 22px 0', flexShrink:0 }}>
          {CATEGORIES.map(cat => (
            <button key={cat.id} onClick={() => setActiveTab(cat.id)}
              style={{ background: activeTab===cat.id ? 'rgba(139,92,246,.2)' : 'rgba(124,79,224,.06)', border:`1.5px solid ${activeTab===cat.id ? 'rgba(139,92,246,.5)' : 'rgba(124,79,224,.18)'}`, borderRadius:11, padding:'7px 14px', color: activeTab===cat.id ? '#6d28d9' : 'rgba(58,46,107,.55)', fontSize:12, fontWeight:700, cursor:'pointer', transition:'all .2s', display:'flex', alignItems:'center', gap:5 }}>
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
                    background: isEquipped ? 'rgba(139,92,246,.22)' : unlocked && hoveredItem===item.id ? 'rgba(255,255,255,.95)' : isLocked ? 'rgba(0,0,0,.03)' : 'rgba(255,255,255,.7)',
                    border: `2px solid ${isEquipped ? '#8b5cf6' : isLocked ? 'rgba(0,0,0,.08)' : hoveredItem===item.id ? 'rgba(124,79,224,.4)' : 'rgba(124,79,224,.18)'}`,
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
                    <div style={{ fontSize:13, fontWeight:800, color: isEquipped ? '#6d28d9' : isLocked ? 'rgba(45,42,74,.4)' : '#2d2a4a', marginBottom:2 }}>
                      {item.name}
                    </div>
                    <div style={{ fontSize:10, color:'rgba(45,42,74,.55)', lineHeight:1.4, padding:'0 4px' }}>
                      {item.desc}
                    </div>
                  </div>

                  {/* Lock info */}
                  {isLocked && badge && (
                    <div style={{ width:'100%' }}>
                      <div style={{ height:'1px', background:'rgba(45,42,74,.12)', margin:'2px 0 6px' }}/>
                      <div style={{ display:'flex', flexDirection:'column', gap:3, alignItems:'center' }}>
                        <div style={{ fontSize:10, color:'rgba(45,42,74,.5)', fontWeight:600 }}>Unlock with badge:</div>
                        <div style={{ display:'flex', alignItems:'center', gap:5, background:`${badge.color}18`, border:`1px solid ${badge.color}50`, borderRadius:20, padding:'4px 10px' }}>
                          <span style={{ fontSize:14 }}>{badge.emoji}</span>
                          <div>
                            <div style={{ fontSize:11, fontWeight:800, color:badge.color }}>{item.badge}</div>
                            <div style={{ fontSize:9, color:'rgba(45,42,74,.55)' }}>{badge.how}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Status label */}
                  {isEquipped && (
                    <div style={{ fontSize:11, color:'#7c3aed', fontWeight:700 }}>✓ Equipped</div>
                  )}
                  {!isEquipped && unlocked && item.badge && (
                    <div style={{ fontSize:11, color:'#16a34a', fontWeight:700 }}>🔓 Unlocked!</div>
                  )}
                  {!isEquipped && !item.badge && (
                    <div style={{ fontSize:11, color:'rgba(45,42,74,.45)' }}>Tap to wear</div>
                  )}

                  {/* Shine sweep on equipped */}
                  {isEquipped && (
                    <div style={{ position:'absolute', inset:0, background:'linear-gradient(105deg,transparent 35%,rgba(139,92,246,.18) 50%,transparent 65%)', animation:'cpShine 2.2s ease-in-out infinite', pointerEvents:'none' }}/>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      </div>

      {showBadgeCase && <BadgeCaseModal earnedBadges={earnedBadges} onClose={() => setShowBadgeCase(false)}/>}
    </div>
  )
}
