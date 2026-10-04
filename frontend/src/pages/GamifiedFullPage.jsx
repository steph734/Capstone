import { useNavigate } from 'react-router-dom'
import { useEffect, useState, useRef } from 'react'
import PictureWordGame from '../components/picture-word-game/PictureWordGame'
import SlowMotionEchoGame from './games/SlowMotionEchoGame'
import PuzzlePiecesGame from './games/PuzzlePiecesGame'
import SortTheBasketGame from './games/SortTheBasketGame'
import StoryBuilder from '../components/story-builder/StoryBuilder'
import PaoCustomizePage, { BadgeCasePage } from './games/PaoCustomizePage'
import PandaMascot from './games/PandaMascot'
import { Sun, Cloud, HillsScenery } from './games/SunnyScenery'
import PuzzlePickerModal from './games/PuzzlePickerModal'
import MoneyMatchPage from './games/MoneyMatchPage'
import DailyRoutinesPage from './games/DailyRoutinesPage'
import BadgeMedal from '../components/BadgeMedal'
import { useSharedProgress } from '../context/ProgressContext'
import { PaoProvider, usePao } from '../context/PaoContext'
import { useActivitySession } from '../context/ActivitySessionContext'
import WhoIsPlayingModal from '../components/WhoIsPlayingModal'
import AppErrorBoundary from '../components/AppErrorBoundary'
import { speakPao, stopPaoVoice } from '../utils/paoVoice'
import { getPaoLanguage, setPaoLanguage, PAO_LANGUAGES } from '../utils/paoLanguage'
import { FULL_PAGE_LINES, CLICK_REACT_LINES, pickLine } from '../utils/paoLines'
import { fetchGameBadge } from '../utils/gameProgress'

// ─── Intro stages ──────────────────────────────────────────────────────────────

const INTRO_STAGES = [
  { key: 'hello',     icon: '👋', label: 'Meet Pao!',           lineKey: 'introHello' },
  { key: 'mechanics', icon: '🎮', label: 'How to Play',         lineKey: 'introMechanics' },
  { key: 'levels',    icon: '⬆️', label: 'Level Up & Stats',    lineKey: 'introLevels' },
  { key: 'badges',    icon: '🏆', label: 'Badges & Customize',  lineKey: 'introBadges' },
]

// ─── Game list ────────────────────────────────────────────────────────────────

const GAMES = [
  { id: 'puzzle-pieces', title: 'Puzzle Pals',        emoji: '🐾', desc: 'Place each piece where it belongs!', color: '#34d399', requiredLevel: 1,  category: 'cognitive',    difficulty: 'easy',
    instructions: 'Drag each piece into the hole with the same shape. Learn on top, under and next to, with animals, fruits, vehicles and more!', badge: 'Puzzle Pro',    badgeEmoji: '🧩', xp: 100,
    benefits: 'Builds spatial awareness and positional vocabulary (on top, under, next to), strengthens visual matching and problem-solving, and supports fine motor coordination through drag-and-place actions.' },
  { id: 'picture-word', title: 'Picture-Word Matching', emoji: '🖼️', desc: 'Match a picture to the right word!', color: '#f59e0b', requiredLevel: 1,  category: 'speech',       difficulty: 'easy',
    instructions: 'Look at the picture, then tap the word that matches it. Get it right to move on to the next one!', badge: 'Word Wizard',   badgeEmoji: '🧙', xp: 100,
    benefits: 'Grows expressive and receptive vocabulary, reinforces picture-word association, and builds focus and quick decision-making with instant, encouraging feedback.' },
  { id: 'echo',         title: 'Slow-Motion Echo',      emoji: '🐢', desc: 'Say each syllable, nice and slow!', color: '#14b8a6', requiredLevel: 2,  category: 'speech',       difficulty: 'easy',
    instructions: 'Listen to Pao say a word slowly, syllable by syllable, then repeat each syllable out loud, nice and slow!', badge: 'Echo Master',   badgeEmoji: '📣', xp: 100,
    benefits: 'Improves articulation and syllable segmentation, strengthens auditory discrimination, and builds speaking confidence at a self-paced, pressure-free speed — great for kids working through speech delays.' },
  { id: 'sound-hunt',   title: 'Sound Hunt',            emoji: '🔍', desc: 'Find words with the same sound!',   color: '#10b981', requiredLevel: 3,  category: 'speech',       difficulty: 'easy',
    instructions: 'Listen carefully, then find and tap every picture whose word starts with the same sound!', badge: 'Sound Hunter',  badgeEmoji: '🔎', xp: 100,
    benefits: 'Sharpens phonological awareness by isolating beginning sounds, trains auditory discrimination, and lays an early-literacy foundation for reading.' },
  { id: 'sentence',     title: 'Sentence Builder',      emoji: '🧩', desc: 'Build sentences like a wizard!',    color: '#6366f1', requiredLevel: 5,  category: 'cognitive',    difficulty: 'medium',
    instructions: 'Put the scrambled words in the right order to build a complete, correct sentence!', badge: 'Sentence Star', badgeEmoji: '✍️', xp: 100,
    benefits: 'Strengthens grammar and sentence structure, builds sequencing and working-memory skills, and supports expressive language development.' },
  { id: 'rhyme',        title: 'Rhyme Time',            emoji: '🎵', desc: 'Find words that rhyme!',            color: '#ec4899', requiredLevel: 7,  category: 'speech',       difficulty: 'easy',
    instructions: 'Listen to the word, then pick the picture whose name rhymes with it!', badge: 'Rhyme Master',  badgeEmoji: '🎵', xp: 100,
    benefits: 'Builds phonological awareness through rhyme detection, strengthens auditory memory and pattern recognition, and supports pre-reading skills.' },
  { id: 'story',        title: 'Story Builder',         emoji: '📖', desc: 'Create your own short story!',      color: '#8b5cf6', requiredLevel: 1,  category: 'cognitive',    difficulty: 'hard',
    instructions: 'Pick a story, then choose what happens next at each step to tell your own version!', badge: 'Story Builder', badgeEmoji: '📖', xp: 100,
    benefits: 'Builds narrative sequencing and comprehension, encourages decision-making and cause-and-effect reasoning, and supports social-emotional learning through story choices.' },
  { id: 'alphabet',     title: 'Alphabet Blast',        emoji: '🚀', desc: 'Zoom through the alphabet!',        color: '#ef4444', requiredLevel: 12, category: 'speech',       difficulty: 'medium',
    instructions: 'Blast off through the alphabet by tapping each letter in order, as fast as you can!', badge: 'Alphabet Blast', badgeEmoji: '🚀', xp: 100,
    benefits: 'Reinforces letter recognition and alphabet sequencing, builds processing speed, and strengthens an early-literacy foundation for reading and writing.' },
  { id: 'daily-routines', title: 'Daily Routines', emoji: '🌅', desc: 'Put everyday routines in the right order!', color: '#F59E0B', requiredLevel: 1, category: 'cognitive', difficulty: 'easy',
    instructions: 'Pick a routine, then put its pictures in order from first to last.', badge: 'Daily Routines', badgeEmoji: '🌅', xp: 100,
    benefits: 'Builds the order of everyday routines, one step at a time, so getting ready feels easier.' },
  { id: 'money-match', title: 'Money Match', emoji: '💵', desc: 'Sort the money into the right place!', color: '#16a34a', requiredLevel: 1, category: 'cognitive', difficulty: 'easy',
    instructions: 'Put the bills in the wallet first, then the coins in the coin purse.', badge: 'Money Match', badgeEmoji: '💵', xp: 100,
    benefits: 'Teaches coins and bills and where each one goes, a first step toward paying at the sari-sari store.' },
  { id: 'sort-basket',  title: 'Sort the Basket',       emoji: '🧺', desc: 'Sort each item into the right basket!', color: '#f59e0b', requiredLevel: 1,  category: 'cognitive',    difficulty: 'easy',
    instructions: 'One item appears at a time. Tap or drag it into the basket it belongs in — Food, Clothes, or Toys!', badge: 'Basket Sorter', badgeEmoji: '🧺', xp: 100,
    benefits: 'Teaches categorisation — grouping things that belong together even when they look nothing alike — which underlies vocabulary growth, word retrieval, and everyday tasks like packing a bag. Uses errorless learning, so a wrong guess is never far off and confidence stays protected.' },
]

const GAME_CATEGORIES = [
  { id: 'all',          label: 'All Games',        icon: '🎮', color: '#6366f1' },
  { id: 'cognitive',    label: 'Cognitive',        icon: '🧠', color: '#8b5cf6' },
  { id: 'speech',       label: 'Speech & Language', icon: '🗣️', color: '#10b981' },
]

const GAME_DIFFICULTIES = [
  { id: 'all',    label: 'All Levels', color: '#6366f1' },
  { id: 'easy',   label: 'Easy',       color: '#22c55e' },
  { id: 'medium', label: 'Medium',     color: '#f59e0b' },
  { id: 'hard',   label: 'Hard',       color: '#ef4444' },
]

const STATS_META = [
  { key: 'intelligence', label: 'Intelligence', icon: '📚', color: '#6366f1' },
  { key: 'focus',        label: 'Focus',        icon: '🎯', color: '#f59e0b' },
  { key: 'resistance',   label: 'Resistance',   icon: '🛡️', color: '#10b981' },
  { key: 'creativity',   label: 'Creativity',   icon: '🎨', color: '#ec4899' },
  { key: 'speed',        label: 'Speed',        icon: '💨', color: '#06b6d4' },
  { key: 'memory',       label: 'Memory',       icon: '🧠', color: '#8b5cf6' },
]

// ─── Category modal ───────────────────────────────────────────────────────────

const CATEGORIES = [
  { id:'fruits',     label:'Fruits',     emoji:'🍎', color:'#ef4444', desc:'10 yummy fruits!' },
  { id:'vegetables', label:'Vegetables', emoji:'🥕', color:'#22c55e', desc:'10 healthy veggies!' },
  { id:'animals',    label:'Animals',    emoji:'🐾', color:'#f59e0b', desc:'10 fun animals!' },
  { id:'things',     label:'Things',     emoji:'🎒', color:'#6366f1', desc:'10 everyday things!' },
]

function CategoryModal({ onSelect, onClose, lang }) {
  useEffect(() => {
    speakPao(pickLine(FULL_PAGE_LINES.categoryPrompt, lang), { pitch: 1.62, rate: 1.1 })
    return () => stopPaoVoice()
  }, []) // eslint-disable-line

  return (
    <div style={{ position:'fixed', inset:0, zIndex:10000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(8px)', background:'rgba(60,50,90,0.45)' }}>
      <style>{`@keyframes gfModalIn{from{opacity:0;transform:scale(.88) translateY(18px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
      <div style={{ background:'linear-gradient(145deg,#ffffff,#fdf3e3)', border:'1.5px solid rgba(124,79,224,.2)', borderRadius:28, padding:'32px 28px', width:400, maxWidth:'92vw', animation:'gfModalIn .45s cubic-bezier(.34,1.56,.64,1)', boxShadow:'0 24px 64px rgba(80,60,20,.25)' }}>
        <h2 style={{ color:'#3a2e6b', fontFamily:"'Segoe UI',system-ui,sans-serif", fontSize:22, fontWeight:800, margin:'0 0 6px', textAlign:'center' }}>Choose a Category! 🎯</h2>
        <p style={{ color:'rgba(58,46,107,.6)', fontFamily:"'Segoe UI',system-ui,sans-serif", fontSize:13, margin:'0 0 20px', textAlign:'center' }}>Pick what you want to practice today</p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          {CATEGORIES.map(cat => (
            <button key={cat.id} onClick={() => onSelect(cat.id)} style={{ background:`${cat.color}1f`, border:`2px solid ${cat.color}70`, borderRadius:16, padding:'18px 10px', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:7, transition:'all .2s', color:'#3a2e6b', fontFamily:"'Segoe UI',system-ui,sans-serif" }}
              onMouseEnter={e => { e.currentTarget.style.background=`${cat.color}38`; e.currentTarget.style.transform='scale(1.04)' }}
              onMouseLeave={e => { e.currentTarget.style.background=`${cat.color}1f`; e.currentTarget.style.transform='scale(1)' }}
            >
              <span style={{ fontSize:36 }}>{cat.emoji}</span>
              <span style={{ fontWeight:800, fontSize:15 }}>{cat.label}</span>
              <span style={{ fontSize:11, opacity:.7 }}>{cat.desc}</span>
            </button>
          ))}
        </div>
        <button onClick={onClose} style={{ marginTop:16, width:'100%', background:'rgba(124,79,224,.06)', border:'1px solid rgba(124,79,224,.15)', color:'rgba(58,46,107,.6)', borderRadius:12, padding:'10px', cursor:'pointer', fontFamily:"'Segoe UI',system-ui,sans-serif", fontSize:13, fontWeight:600 }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── Game instructions modal — shown before a game launches ──────────────────

// Games that open their own start screen (or picker) after the card is tapped.
const SELF_START_GAMES = new Set(['money-match', 'daily-routines', 'picture-word', 'puzzle-pieces', 'echo'])

function GameInstructionsModal({ game, onStart, onClose }) {
  const [realBadge, setRealBadge] = useState(null)

  useEffect(() => {
    let cancelled = false
    setRealBadge(null)
    fetchGameBadge(game.title).then((b) => { if (!cancelled) setRealBadge(b) })
    return () => { cancelled = true }
  }, [game.title])

  return (
    <div style={{ position:'fixed', inset:0, zIndex:10000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(8px)', background:'rgba(60,50,90,0.45)', fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
      <style>{`@keyframes gfModalIn{from{opacity:0;transform:scale(.88) translateY(18px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
      <div style={{ background:'linear-gradient(145deg,#ffffff,#fdf3e3)', border:`1.5px solid ${game.color}40`, borderRadius:28, padding:'32px 28px', width:400, maxWidth:'92vw', animation:'gfModalIn .45s cubic-bezier(.34,1.56,.64,1)', boxShadow:'0 24px 64px rgba(80,60,20,.25)' }}>
        <div style={{ fontSize:44, textAlign:'center', marginBottom:6 }}>{game.emoji}</div>
        <h2 style={{ color:'#3a2e6b', fontSize:22, fontWeight:800, margin:'0 0 10px', textAlign:'center' }}>{game.title}</h2>
        <p style={{ color:'rgba(58,46,107,.75)', fontSize:14, lineHeight:1.5, margin:'0 0 20px', textAlign:'center' }}>{game.instructions || game.desc}</p>

        <div style={{ display:'flex', gap:10, marginBottom:16 }}>
          <div style={{ flex:1, background:`${game.color}1a`, border:`1.5px solid ${game.color}55`, borderRadius:16, padding:'12px 10px', display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
            {realBadge ? (
              <BadgeMedal shape={realBadge.shape} colour={realBadge.colour} symbol={realBadge.symbol} size={44} />
            ) : (
              <span style={{ fontSize:26 }}>{game.badgeEmoji}</span>
            )}
            <span style={{ fontSize:11, color:'rgba(58,46,107,.55)', fontWeight:700 }}>Badge</span>
            <span style={{ fontSize:12.5, color:'#3a2e6b', fontWeight:800, textAlign:'center' }}>{realBadge ? realBadge.name : game.badge}</span>
          </div>
          <div style={{ flex:1, background:`${game.color}1a`, border:`1.5px solid ${game.color}55`, borderRadius:16, padding:'12px 10px', display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
            <span style={{ fontSize:26 }}>⭐</span>
            <span style={{ fontSize:11, color:'rgba(58,46,107,.55)', fontWeight:700 }}>Points</span>
            <span style={{ fontSize:12.5, color:'#3a2e6b', fontWeight:800 }}>+{game.xp} XP</span>
          </div>
        </div>

        {game.benefits && (
          <div style={{ background:'rgba(16,185,129,.08)', border:'1.5px solid rgba(16,185,129,.3)', borderRadius:16, padding:'14px 16px', marginBottom:22, display:'flex', gap:10, alignItems:'flex-start' }}>
            <span style={{ fontSize:20, flexShrink:0 }}>🌱</span>
            <div>
              <div style={{ fontSize:11, color:'#0d9488', fontWeight:800, letterSpacing:.4, textTransform:'uppercase', marginBottom:4 }}>Why this helps</div>
              <p style={{ margin:0, fontSize:12.5, lineHeight:1.55, color:'rgba(58,46,107,.85)' }}>{game.benefits}</p>
            </div>
          </div>
        )}

        <button onClick={() => onStart(game)} style={{ width:'100%', background:game.color, border:'none', color:'#fff', borderRadius:14, padding:'13px', cursor:'pointer', fontFamily:"'Segoe UI',system-ui,sans-serif", fontSize:15, fontWeight:800, boxShadow:`0 6px 16px ${game.color}55`, marginBottom:10 }}>
          Start Game 🎮
        </button>
        <button onClick={onClose} style={{ width:'100%', background:'rgba(124,79,224,.06)', border:'1px solid rgba(124,79,224,.15)', color:'rgba(58,46,107,.6)', borderRadius:12, padding:'10px', cursor:'pointer', fontFamily:"'Segoe UI',system-ui,sans-serif", fontSize:13, fontWeight:600 }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── Pao language modal — shown before the intro on every visit to Games ─────

function PaoLanguageModal({ selected, onSelect }) {
  return (
    <div style={{ position:'fixed', inset:0, zIndex:10001, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(8px)', background:'rgba(60,50,90,0.45)', fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
      <style>{`@keyframes gfModalIn{from{opacity:0;transform:scale(.88) translateY(18px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
      <div style={{ background:'linear-gradient(145deg,#ffffff,#fdf3e3)', border:'1.5px solid rgba(124,79,224,.2)', borderRadius:28, padding:'32px 28px', width:400, maxWidth:'92vw', animation:'gfModalIn .45s cubic-bezier(.34,1.56,.64,1)', boxShadow:'0 24px 64px rgba(80,60,20,.25)' }}>
        <div style={{ fontSize:44, textAlign:'center', marginBottom:6 }}>🐼</div>
        <h2 style={{ color:'#3a2e6b', fontSize:22, fontWeight:800, margin:'0 0 6px', textAlign:'center' }}>Choose Pao's Voice! 🗣️</h2>
        <p style={{ color:'rgba(58,46,107,.6)', fontSize:13, margin:'0 0 20px', textAlign:'center' }}>What language should Pao speak today?</p>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {PAO_LANGUAGES.map(l => (
            <button key={l.id} onClick={() => onSelect(l.id)} style={{
              background: selected === l.id ? 'rgba(139,92,246,.22)' : 'rgba(139,92,246,.08)',
              border: `2px solid ${selected === l.id ? '#8b5cf6' : 'rgba(139,92,246,.25)'}`,
              borderRadius:16, padding:'14px 16px', cursor:'pointer', display:'flex', alignItems:'center', gap:12,
              transition:'all .2s', color:'#3a2e6b', fontFamily:"'Segoe UI',system-ui,sans-serif", textAlign:'left',
            }}
              onMouseEnter={e => { e.currentTarget.style.background='rgba(139,92,246,.22)'; e.currentTarget.style.transform='scale(1.02)' }}
              onMouseLeave={e => { e.currentTarget.style.background = selected === l.id ? 'rgba(139,92,246,.22)' : 'rgba(139,92,246,.08)'; e.currentTarget.style.transform='scale(1)' }}
            >
              <span style={{ fontSize:26 }}>{l.flag}</span>
              <span style={{ fontWeight:800, fontSize:16, flex:1 }}>{l.label}</span>
              {selected === l.id && <span style={{ fontSize:18, color:'#7c3aed' }}>✓</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── In-game profile view ──────────────────────────────────────────────────────
// A playful, kid-facing profile just for this page — separate from the real
// account settings page at /patient/profile.
function GamifiedProfileView({ progress, pao, onBack, onViewAllBadges }) {
  const { patientName, characterStats, badges, streak, weekly } = progress
  const level = pao?.level ?? 1
  const xp = pao?.xp ?? 0
  const xpNeeded = pao?.xpToNext ?? Math.max(1, xp)
  const statValues = pao?.stats || characterStats || {}

  return (
    <div style={{ position:'fixed', inset:0, background:'linear-gradient(180deg,#87ceeb 0%,#b8e6f5 60%,#d4f1e8 100%)' }}>
      {/* Background scenery — pinned to the viewport, independent of content scroll */}
      <Sun/>
      <Cloud x="8%" y="8%" size={90} delay={0} dur={8}/>
      <Cloud x="70%" y="5%" size={110} delay={1.5} dur={9}/>
      <Cloud x="85%" y="22%" size={70} delay={.6} dur={7}/>
      <HillsScenery/>

      <button onClick={onBack} style={{ position:'absolute', top:20, left:20, zIndex:10, display:'flex', alignItems:'center', gap:6, background:'rgba(255,255,255,.85)', border:'1.5px solid rgba(124,79,224,.25)', color:'#5b21b6', borderRadius:12, padding:'8px 16px', fontSize:13, fontWeight:700, cursor:'pointer' }}>
        ← Back
      </button>

      {/* Scrollable content layer, separate from the fixed background */}
      <div style={{ position:'absolute', inset:0, overflowY:'auto', zIndex:2 }}>
      <div style={{ maxWidth:640, margin:'0 auto', padding:'90px 24px 60px', display:'flex', flexDirection:'column', gap:20 }}>

        {/* Header card */}
        <div style={{ background:'rgba(255,255,255,.9)', backdropFilter:'blur(10px)', border:'1.5px solid rgba(124,79,224,.2)', borderRadius:24, padding:24, display:'flex', alignItems:'center', gap:18, boxShadow:'0 8px 32px rgba(80,60,20,.12)' }}>
          <PandaMascot pxWidth={90} mouthOpen={false}/>
          <div style={{ flex:1 }}>
            <h2 style={{ margin:0, fontSize:22, fontWeight:900, color:'#3a2e6b' }}>{patientName}</h2>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:8 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(255,183,3,.14)', border:'1px solid rgba(255,183,3,.4)', borderRadius:20, padding:'4px 12px 4px 8px' }}>
                <span style={{ fontSize:14 }}>⭐</span>
                <span style={{ fontSize:11, fontWeight:700, color:'#92400e' }}>LVL</span>
                <span style={{ fontSize:18, fontWeight:900, color:'#d97706' }}>{level}</span>
              </div>
              <div style={{ flex:1 }}>
                <span style={{ fontSize:10, color:'rgba(58,46,107,.5)', fontWeight:600 }}>XP {xp}/{xpNeeded}</span>
                <div style={{ height:6, background:'rgba(124,79,224,.12)', borderRadius:4, overflow:'hidden', marginTop:2 }}>
                  <div style={{ height:'100%', width:`${(xp / xpNeeded) * 100}%`, background:'linear-gradient(90deg,#6366f1,#8b5cf6)', borderRadius:4 }}/>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Streak + weekly summary */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          <div style={{ background:'rgba(255,255,255,.9)', border:'1.5px solid rgba(124,79,224,.18)', borderRadius:18, padding:'16px 18px', textAlign:'center' }}>
            <div style={{ fontSize:28 }}>🔥</div>
            <div style={{ fontSize:24, fontWeight:900, color:'#d97706' }}>{streak?.current ?? 0}</div>
            <div style={{ fontSize:12, color:'rgba(58,46,107,.6)', fontWeight:600 }}>Day Streak</div>
          </div>
          <div style={{ background:'rgba(255,255,255,.9)', border:'1.5px solid rgba(124,79,224,.18)', borderRadius:18, padding:'16px 18px', textAlign:'center' }}>
            <div style={{ fontSize:28 }}>🎮</div>
            <div style={{ fontSize:24, fontWeight:900, color:'#8b5cf6' }}>{weekly?.gamesCompleted ?? 0}</div>
            <div style={{ fontSize:12, color:'rgba(58,46,107,.6)', fontWeight:600 }}>Games This Week</div>
          </div>
        </div>

        {/* Character stats */}
        <div style={{ background:'rgba(255,255,255,.9)', border:'1.5px solid rgba(124,79,224,.18)', borderRadius:20, padding:20 }}>
          <h3 style={{ margin:'0 0 14px', fontSize:16, fontWeight:800, color:'#3a2e6b' }}>Character Stats</h3>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            {STATS_META.map((meta) => {
              const value = statValues[meta.key] ?? 0
              return (
                <div key={meta.key}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:700, color:'#3a2e6b', marginBottom:4 }}>
                    <span>{meta.icon} {meta.label}</span>
                    <span style={{ color: meta.color }}>{value}</span>
                  </div>
                  <div style={{ height:6, background:'rgba(124,79,224,.1)', borderRadius:4, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${value}%`, background: meta.color, borderRadius:4 }}/>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Badges */}
        <div style={{ background:'rgba(255,255,255,.9)', border:'1.5px solid rgba(124,79,224,.18)', borderRadius:20, padding:20 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <h3 style={{ margin:0, fontSize:16, fontWeight:800, color:'#3a2e6b' }}>Badges Earned</h3>
            <button onClick={onViewAllBadges} style={{ background:'none', border:'none', color:'#7c3aed', fontSize:12, fontWeight:700, cursor:'pointer', padding:0 }}>
              View All →
            </button>
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:10 }}>
            {(badges || []).map((b) => (
              <div key={b.id} style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(139,92,246,.08)', border:'1px solid rgba(139,92,246,.2)', borderRadius:14, padding:'8px 14px' }}>
                <span style={{ fontSize:20 }}>{b.icon}</span>
                <div>
                  <div style={{ fontSize:12, fontWeight:700, color:'#3a2e6b' }}>{b.label}</div>
                  <div style={{ fontSize:10, color:'rgba(58,46,107,.5)' }}>{b.dateEarned}</div>
                </div>
              </div>
            ))}
            {(!badges || badges.length === 0) && (
              <p style={{ margin:0, fontSize:13, color:'rgba(58,46,107,.5)' }}>No badges earned yet — keep playing!</p>
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

// Whose Pao this is: a therapist's picked patient (via the activity session),
// or the signed-in patient on their own device. Practice mode has no Pao.
export default function GamifiedFullPage({ requirePlayer = false, ...rest }) {
  const activity = useActivitySession()
  let ident = null
  if (requirePlayer) {
    if (activity.isActive && !activity.isPractice) ident = { activitySessionId: activity.session.id }
  } else if (rest.patientEmail) {
    ident = { patientEmail: rest.patientEmail }
  }
  const navigate = useNavigate()
  return (
    <PaoProvider ident={ident}>
      <AppErrorBoundary label="games" onReset={() => navigate(rest.backPath || '/dashboard')}>
        <GamifiedFullPageInner requirePlayer={requirePlayer} {...rest} />
      </AppErrorBoundary>
    </PaoProvider>
  )
}

function GamifiedFullPageInner({ backPath = '/dashboard', patientId = 'alvrin', patientEmail = null, requirePlayer = false, therapistEmail = null }) {
  const navigate = useNavigate()
  const pao = usePao()
  const activity = useActivitySession()
  const [justStarted, setJustStarted] = useState(null)

  const [phase,        setPhase]        = useState('intro')
  const [introStage,   setIntroStage]   = useState(0)
  const [showUI,       setShowUI]       = useState(false)
  const [talking,      setTalking]      = useState(false)
  const [displayText,  setDisplayText]  = useState('')
  const [gamesIn,      setGamesIn]      = useState(false)
  const [showCatModal, setShowCatModal] = useState(false)
  const [selCategory,  setSelCategory]  = useState('fruits')
  const [previewGame,  setPreviewGame]  = useState(null)
  const [puzzlePicker, setPuzzlePicker] = useState(false)
  const [puzzleConfig, setPuzzleConfig] = useState({ setId: 'animals', level: 'easy' })
  const [showStats,    setShowStats]    = useState(false)
  const [gameCatFilter,  setGameCatFilter]  = useState('all')
  const [gameDiffFilter, setGameDiffFilter] = useState('all')

  // Pao's spoken language — chosen fresh each visit via the modal below,
  // prefilled with whatever was picked last time.
  const [lang,          setLang]          = useState(() => getPaoLanguage())
  const [showLangModal, setShowLangModal] = useState(true)
  const sessionReady = !requirePlayer || !activity.loading
  const showPicker = requirePlayer && !showLangModal && sessionReady
    && (activity.pickerOpen || !activity.isActive || !!justStarted)
  const gateOpen = !showLangModal && sessionReady && !showPicker
  const introStartedRef = useRef(false)

  // Character level/XP/stats — live, driven by played sessions (ProgressContext).
  const { progress } = useSharedProgress()
  // Real Pao progression from the server (see PaoContext), not local progress.
  const character = {
    level: pao.profile?.level ?? 1,
    xp: pao.profile?.xp ?? 0,
    xpNeeded: pao.profile?.xpToNext ?? Math.max(1, pao.profile?.xp ?? 1),
  }
  const headerName = requirePlayer
    ? (activity.isPractice ? 'Practice mode' : (activity.patient?.displayName || ''))
    : progress.patientName

  const advTimer = useRef(null)
  const stageRef = useRef(0)

  // ── Cleanup ──────────────────────────────────────────────────────────────────
  useEffect(() => () => {
    stopPaoVoice()
  }, [])

  // ── TTS helper ───────────────────────────────────────────────────────────────
  const speakScript = (script, pitchOverride, onDone) => {
    setDisplayText('')
    speakPao(script, {
      pitch: pitchOverride ?? 1.62,
      rate: 1.12,
      onStart: () => setTalking(true),
      onEnd: () => { setTalking(false); onDone?.() },
      onWord: (partial) => setDisplayText(partial),
    })
  }

  // ── Intro stage speech — plays speech only, does NOT auto-advance ────────────
  const speakStage = (idx) => {
    setDisplayText('')
    speakScript(pickLine(FULL_PAGE_LINES[INTRO_STAGES[idx].lineKey], lang), 1.62)
  }

  // ── Language picker → persist choice, then start the intro ───────────────────
  const handleLanguageSelect = (langId) => {
    setPaoLanguage(langId)
    setLang(langId)
    setShowLangModal(false)
  }

  // ── Go to customize (after intro) ────────────────────────────────────────────
  const goToCustomize = () => {
    stopPaoVoice()
    setDisplayText('')
    setTalking(false)
    setPhase('customize')
  }

  // ── Go to games (after customize or returning from game) ──────────────────────
  const goToGames = () => {
    stopPaoVoice()
    setDisplayText('')
    setTalking(false)
    setPhase('games')
    setTimeout(() => setGamesIn(true), 80)
    setTimeout(() => speakScript(pickLine(FULL_PAGE_LINES.gamesScript, lang)), 500)
  }

  // ── Skip / Next buttons ───────────────────────────────────────────────────────
  const handleSkip = () => {
    stopPaoVoice()
    setTalking(false)
    goToCustomize()
  }

  const handleNextStage = () => {
    stopPaoVoice()
    setTalking(false)
    if (stageRef.current < INTRO_STAGES.length - 1) {
      const next = stageRef.current + 1
      stageRef.current = next
      setIntroStage(next)
      speakStage(next)
    } else {
      goToCustomize()
    }
  }

  // ── Intro enter — waits for a language to be chosen first ────────────────────
  useEffect(() => {
    if (!gateOpen || introStartedRef.current) return
    introStartedRef.current = true
    setShowUI(true)
    speakStage(0)
  }, [gateOpen]) // eslint-disable-line

  // ── Pao click → gentle reaction + friendly line ──────────────────────────────
  const clickCountRef = useRef(0)
  const handlePandaClick = () => {
    const pick = CLICK_REACT_LINES[clickCountRef.current % CLICK_REACT_LINES.length]
    clickCountRef.current += 1
    speakScript(pickLine(pick, lang), pick.pitch)
  }

  // ── Category + game start ─────────────────────────────────────────────────────
  const handleCatSelect = (catId) => {
    setSelCategory(catId)
    setShowCatModal(false)
    stopPaoVoice()
    setPhase('picture-word')
  }

  const startGame = (game) => {
    setPreviewGame(null)
    if (game.id === 'echo') { stopPaoVoice(); setPhase('echo') }
    else if (game.id === 'picture-word') { stopPaoVoice(); setPhase('picture-word') }
    else if (game.id === 'puzzle-pieces') { stopPaoVoice(); setPuzzlePicker(true) }
    else if (game.id === 'sort-basket') { stopPaoVoice(); setPhase('sort-basket') }
    else if (game.id === 'money-match') { stopPaoVoice(); setPhase('money-match') }
    else if (game.id === 'daily-routines') { stopPaoVoice(); setPhase('daily-routines') }
    else if (game.id === 'story') { stopPaoVoice(); setPhase('story-select') }
    else setShowCatModal(true)
  }

  const backToGames = () => {
    setPhase('games'); setGamesIn(true); setDisplayText('')
    setTimeout(() => speakScript(pickLine(FULL_PAGE_LINES.gamesScript, lang)), 400)
  }

  if (phase === 'profile') {
    return <GamifiedProfileView progress={progress} pao={pao.profile} onViewAllBadges={() => setPhase('badges')} onBack={backToGames}/>
  }

  if (phase === 'badges') {
    return <BadgeCasePage patientEmail={patientEmail} onBack={() => setPhase('profile')}/>
  }

  if (phase === 'customize') {
    return <PaoCustomizePage lang={lang} patientEmail={patientEmail} onDone={() => {
      setDisplayText(''); setTalking(false)
      setPhase('games')
      setTimeout(() => setGamesIn(true), 60)
      setTimeout(() => speakScript(pickLine(FULL_PAGE_LINES.customizeReady, lang)), 400)
    }}/>
  }

  if (phase === 'picture-word') {
    return (
      <PictureWordGame
        Mascot={PandaMascot}
        readAloud={true}
        questionCount={6}
        patientId={patientId}
        patientEmail={patientEmail}
        onExit={backToGames}
      />
    )
  }

  if (phase === 'echo') {
    return <SlowMotionEchoGame patientId={patientId} patientEmail={patientEmail} lang={lang} onExit={backToGames}/>
  }

  if (phase === 'puzzle-pieces') {
    return <PuzzlePiecesGame patientId={patientId} patientEmail={patientEmail} lang={lang} setId={puzzleConfig.setId} level={puzzleConfig.level} onExit={backToGames}/>
  }

  if (phase === 'money-match') {
    return <MoneyMatchPage lang={lang} onExit={backToGames}/>
  }

  if (phase === 'daily-routines') {
    return <DailyRoutinesPage lang={lang} onExit={backToGames}/>
  }

  if (phase === 'sort-basket') {
    return <SortTheBasketGame patientId={patientId} patientEmail={patientEmail} lang={lang} onExit={backToGames}/>
  }

  if (phase === 'story-select') {
    return <StoryBuilder onExit={backToGames}/>
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:9999, background:'linear-gradient(180deg,#56b8ee 0%,#7dd0f5 55%,#bdeafd 100%)', overflow:'hidden', fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
      <style>{`
        @keyframes gfSunPulse  { 0%,100%{transform:scale(1)} 50%{transform:scale(1.06)} }
        @keyframes gfCloudDrift { 0%,100%{transform:translateX(0)} 50%{transform:translateX(14px)} }
        @keyframes gfCardIn    { from{opacity:0;transform:translateY(20px) scale(.93)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes gfPulse     { 0%,100%{box-shadow:0 0 0 0 rgba(245,158,11,.5)} 50%{box-shadow:0 0 0 8px rgba(245,158,11,0)} }
        @keyframes gfBubbleIn  { from{opacity:0;transform:scale(.88) translateY(6px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes gfCursor    { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes gfSoundWave { 0%,100%{transform:scaleY(.3)} 50%{transform:scaleY(1)} }
        @keyframes gfFadeIn    { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes gfStageIn   { from{opacity:0;transform:scale(.88) translateY(-6px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes gfLevelPop  { 0%{transform:scale(1)} 50%{transform:scale(1.15)} 100%{transform:scale(1)} }

        .pao-mascot-intro svg { max-width: 100%; height: auto; }
        @media (max-width: 480px) {
          .pao-mascot-intro svg { width: 190px !important; }
        }
      `}</style>

      <Sun/>
      <Cloud x="26%" y="8%"  size={90}  delay={0}   dur={7}/>
      <Cloud x="70%" y="6%"  size={110} delay={1.2} dur={8}/>
      <Cloud x="52%" y="16%" size={70}  delay={0.6} dur={6.5}/>
      <Cloud x="88%" y="22%" size={80}  delay={0.3} dur={7.5}/>
      <HillsScenery/>

      <button onClick={() => { stopPaoVoice(); navigate(backPath) }} style={{ position:'absolute', top:18, left:20, zIndex:10, background:'rgba(255,255,255,.8)', border:'1.5px solid rgba(124,79,224,.25)', color:'#4b3f7a', borderRadius:10, padding:'8px 18px', fontSize:13, fontWeight:700, cursor:'pointer', boxShadow:'0 2px 10px rgba(80,60,20,.1)' }}>
        ← Back
      </button>

      {/* ══════════════ INTRO PHASE ══════════════ */}
      {phase === 'intro' && (
        <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, padding:'70px 24px 24px' }}>

          {/* Stage progress + dots (top-right) */}
          {showUI && (
            <div style={{ position:'absolute', top:20, right:24, display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:12, color:'rgba(74,58,122,.5)', fontWeight:600 }}>Intro</span>
              {INTRO_STAGES.map((_,i) => (
                <div key={i} style={{ width:9, height:9, borderRadius:'50%', background: i <= introStage ? '#8b5cf6' : 'rgba(124,79,224,.16)', transition:'background .35s', boxShadow: i === introStage ? '0 0 8px #8b5cf6' : 'none' }}/>
              ))}
            </div>
          )}

          {/* Stage label */}
          {showUI && (
            <div key={`label-${introStage}`} style={{ background:'rgba(139,92,246,.14)', border:'1px solid rgba(139,92,246,.3)', borderRadius:20, padding:'5px 16px', fontSize:13, fontWeight:700, color:'#6d28d9', animation:'gfStageIn .35s ease', letterSpacing:.5 }}>
              {INTRO_STAGES[introStage].icon} {INTRO_STAGES[introStage].label}
            </div>
          )}

          {/* Pao mascot */}
          <div className="pao-mascot-intro" style={{ flexShrink:0 }}>
            <PandaMascot pxWidth={250} mouthOpen={talking} onClick={handlePandaClick}/>
          </div>

          {/* Speech bubble */}
          {showUI && (
            <div style={{ animation:'gfBubbleIn .5s cubic-bezier(.34,1.56,.64,1)', background:'rgba(255,255,255,.85)', backdropFilter:'blur(12px)', border:'1.5px solid rgba(124,79,224,.22)', borderRadius:24, padding:'16px 26px', maxWidth:560, width:'100%', minHeight:60, boxShadow:'0 8px 32px rgba(80,60,20,.12)' }}>
              {talking && (
                <div style={{ display:'flex', gap:3, alignItems:'center', marginBottom:8 }}>
                  {[0,.12,.06,.18,.03].map((d,i) => (
                    <div key={i} style={{ width:3, height:15, borderRadius:4, background:'rgba(124,79,224,.75)', animation:`gfSoundWave .5s ease-in-out ${d}s infinite` }}/>
                  ))}
                </div>
              )}
              <div style={{ fontSize:15, fontWeight:600, color:'#3a2e6b', lineHeight:1.65 }}>
                {displayText || <span style={{ color:'rgba(58,46,107,.4)', fontStyle:'italic', fontSize:14 }}>Pao is ready!</span>}
                {talking && <span style={{ animation:'gfCursor .7s step-end infinite', marginLeft:2, color:'#7c3aed' }}>|</span>}
              </div>
            </div>
          )}

          {/* Next / Skip buttons */}
          {showUI && (
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={handleNextStage} style={{ background:'rgba(139,92,246,.18)', border:'1.5px solid rgba(139,92,246,.5)', color:'#5b21b6', borderRadius:14, padding:'10px 26px', fontSize:14, fontWeight:700, cursor:'pointer', transition:'background .2s' }}
                onMouseEnter={e => e.currentTarget.style.background='rgba(139,92,246,.3)'}
                onMouseLeave={e => e.currentTarget.style.background='rgba(139,92,246,.18)'}>
                {introStage < INTRO_STAGES.length - 1 ? 'Next →' : "Let's Go! 🎮"}
              </button>
              <button onClick={handleSkip} style={{ background:'rgba(124,79,224,.06)', border:'1px solid rgba(124,79,224,.15)', color:'rgba(58,46,107,.55)', borderRadius:14, padding:'10px 20px', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                Skip Intro
              </button>
            </div>
          )}
        </div>
      )}

      {/* ══════════════ GAMES PHASE ══════════════ */}
      {phase === 'games' && (
        <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', overflow:'hidden' }}>

          {/* Profile button — top right */}
          <button onClick={() => { stopPaoVoice(); setPhase('profile') }} style={{ position:'absolute', top:18, right:20, zIndex:10, display:'flex', alignItems:'center', gap:7, background:'rgba(139,92,246,.14)', border:'1.5px solid rgba(139,92,246,.4)', color:'#5b21b6', borderRadius:12, padding:'8px 16px', fontSize:13, fontWeight:700, cursor:'pointer', transition:'all .2s' }}
            onMouseEnter={e => { e.currentTarget.style.background='rgba(139,92,246,.26)'; e.currentTarget.style.borderColor='rgba(139,92,246,.6)' }}
            onMouseLeave={e => { e.currentTarget.style.background='rgba(139,92,246,.14)'; e.currentTarget.style.borderColor='rgba(139,92,246,.4)' }}>
            👤 Profile
          </button>

          {/* Pao + speech bubble row */}
          <div style={{ display:'flex', alignItems:'flex-end', gap:16, padding:'14px 24px 0', flexShrink:0 }}>
            <div style={{ flexShrink:0 }}>
              <PandaMascot pxWidth={150} mouthOpen={talking} onClick={handlePandaClick}/>
            </div>
            <div style={{ flex:1, alignSelf:'center', display:'flex', flexDirection:'column', gap:6 }}>
              {/* Patient name */}
              <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                <span style={{ fontSize:15, fontWeight:800, color:'#3a2e6b' }}>{headerName}</span>
                {requirePlayer && (activity.isPractice
                  ? <span style={{ fontSize:12, fontWeight:800, color:'#065f46', background:'rgba(16,185,129,.14)', border:'1px solid rgba(16,185,129,.4)', borderRadius:20, padding:'3px 10px' }}>Practice mode</span>
                  : <button onClick={() => activity.changePlayer()} style={{ fontSize:12, fontWeight:800, color:'#5b21b6', background:'rgba(139,92,246,.12)', border:'1.5px solid rgba(139,92,246,.4)', borderRadius:12, padding:'4px 12px', cursor:'pointer', minHeight:32 }}>Change player</button>
                )}
              </div>

              {/* Level badge + stats toggle — practice mode saves nothing, so no Pao progress */}
              {!(requirePlayer && activity.isPractice) && (
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(255,183,3,.14)', border:'1px solid rgba(255,183,3,.4)', borderRadius:20, padding:'4px 12px 4px 8px' }}>
                  <span style={{ fontSize:14 }}>⭐</span>
                  <span style={{ fontSize:11, fontWeight:700, color:'#92400e', letterSpacing:.8 }}>LVL</span>
                  <span style={{ fontSize:20, fontWeight:900, color:'#d97706', lineHeight:1 }}>{character.level}</span>
                </div>
                {/* XP mini bar */}
                <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                  <span style={{ fontSize:9, color:'rgba(58,46,107,.5)', fontWeight:600 }}>XP {character.xp}/{character.xpNeeded}</span>
                  <div style={{ width:72, height:4, background:'rgba(124,79,224,.12)', borderRadius:3, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${(character.xp/character.xpNeeded)*100}%`, background:'linear-gradient(90deg,#6366f1,#8b5cf6)', borderRadius:3 }}/>
                  </div>
                </div>
                {/* Stats toggle icon */}
                <button onClick={() => setShowStats(s => !s)} title="View Stats" style={{ background: showStats ? 'rgba(139,92,246,.25)' : 'rgba(124,79,224,.08)', border:`1.5px solid ${showStats ? 'rgba(139,92,246,.5)' : 'rgba(124,79,224,.2)'}`, borderRadius:10, width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:16, transition:'all .2s', flexShrink:0 }}>
                  📊
                </button>
              </div>
              )}

              {/* Speech bubble */}
              <div style={{ background:'rgba(255,255,255,.82)', border:'1.5px solid rgba(124,79,224,.18)', borderRadius:'4px 18px 18px 18px', padding:'10px 16px', minHeight:48, animation:'gfBubbleIn .5s ease' }}>
                {talking && (
                  <div style={{ display:'flex', gap:3, alignItems:'center', marginBottom:5 }}>
                    {[0,.1,.05,.15,.02].map((d,i) => (
                      <div key={i} style={{ width:3, height:12, borderRadius:4, background:'rgba(124,79,224,.75)', animation:`gfSoundWave .5s ease-in-out ${d}s infinite` }}/>
                    ))}
                  </div>
                )}
                <div style={{ fontSize:13, fontWeight:600, color:'#3a2e6b', lineHeight:1.5 }}>
                  {displayText || <span style={{ color:'rgba(58,46,107,.4)', fontStyle:'italic', fontSize:12 }}>Pao is here!</span>}
                  {talking && <span style={{ animation:'gfCursor .7s step-end infinite', marginLeft:2, color:'#7c3aed' }}>|</span>}
                </div>
              </div>
            </div>
          </div>

          {/* ── Stats dropdown panel ── */}
          {showStats && (
            <div style={{ margin:'8px 24px 0', background:'rgba(255,255,255,.88)', border:'1.5px solid rgba(139,92,246,.25)', borderRadius:16, padding:'14px 18px', animation:'gfFadeIn .25s ease', backdropFilter:'blur(12px)', flexShrink:0 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <span style={{ fontSize:12, fontWeight:700, color:'rgba(58,46,107,.65)', letterSpacing:.5 }}>CHARACTER STATS</span>
                <button onClick={() => setShowStats(false)} style={{ background:'none', border:'none', color:'rgba(58,46,107,.4)', cursor:'pointer', fontSize:16, lineHeight:1 }}>✕</button>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
                {STATS_META.map(stat => {
                  const value = (pao.profile?.stats || progress.characterStats || {})[stat.key] ?? 0
                  return (
                    <div key={stat.key} style={{ display:'flex', flexDirection:'column', gap:4 }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <span style={{ fontSize:11, color:'rgba(58,46,107,.6)', fontWeight:600 }}>{stat.icon} {stat.label}</span>
                        <span style={{ fontSize:12, fontWeight:800, color:stat.color }}>{value}</span>
                      </div>
                      <div style={{ height:5, background:'rgba(124,79,224,.1)', borderRadius:3, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${value}%`, background:stat.color, borderRadius:3 }}/>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Games grid ── */}
          <div style={{ flex:1, display:'flex', flexDirection:'column', padding:'10px 24px 16px', gap:10, overflowY:'auto' }}>
            <h1 style={{ color:'#3a2e6b', fontSize:18, fontWeight:800, margin:0, opacity: gamesIn ? 1 : 0, transform: gamesIn ? 'none' : 'translateY(-10px)', transition:'all .5s ease' }}>
              Choose a Game!
            </h1>

            {/* Category filter chips */}
            <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
              {GAME_CATEGORIES.map(cat => {
                const active = gameCatFilter === cat.id
                return (
                  <button key={cat.id} onClick={() => setGameCatFilter(cat.id)} style={{
                    background: active ? cat.color : 'rgba(255,255,255,.88)',
                    border: `2px solid ${cat.color}`,
                    color: active ? '#fff' : cat.color,
                    borderRadius:22, padding:'8px 16px', fontSize:14, fontWeight:800,
                    cursor:'pointer', display:'flex', alignItems:'center', gap:6, transition:'all .18s',
                    boxShadow: active ? `0 3px 10px ${cat.color}55` : '0 2px 6px rgba(60,50,90,.12)',
                  }}>
                    <span style={{ fontSize:16 }}>{cat.icon}</span>{cat.label}
                  </button>
                )
              })}
            </div>

            {/* Difficulty filter chips */}
            <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:4 }}>
              {GAME_DIFFICULTIES.map(diff => {
                const active = gameDiffFilter === diff.id
                return (
                  <button key={diff.id} onClick={() => setGameDiffFilter(diff.id)} style={{
                    background: active ? diff.color : 'rgba(255,255,255,.88)',
                    border: `2px solid ${diff.color}`,
                    color: active ? '#fff' : diff.color,
                    borderRadius:22, padding:'7px 16px', fontSize:13.5, fontWeight:800,
                    cursor:'pointer', transition:'all .18s',
                    boxShadow: active ? `0 3px 10px ${diff.color}55` : '0 2px 6px rgba(60,50,90,.12)',
                  }}>
                    {diff.label}
                  </button>
                )
              })}
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, flex:1 }}>
              {GAMES.filter(g =>
                (gameCatFilter === 'all' || g.category === gameCatFilter) &&
                (gameDiffFilter === 'all' || g.difficulty === gameDiffFilter)
              ).map((game, i) => {
                const unlocked = character.level >= game.requiredLevel
                const catMeta = GAME_CATEGORIES.find(c => c.id === game.category)
                const diffMeta = GAME_DIFFICULTIES.find(d => d.id === game.difficulty)
                return (
                  <button key={game.id} onClick={() => {
                    if (!unlocked) return
                    // These games show their own start screen, so skip the generic preview (one modal only)
                    if (SELF_START_GAMES.has(game.id)) { startGame(game); return }
                    setPreviewGame(game)
                  }} style={{
                    background: unlocked ? `${game.color}1f` : 'rgba(0,0,0,.03)',
                    border: `2px solid ${unlocked ? game.color+'60' : 'rgba(0,0,0,.08)'}`,
                    borderRadius:18, padding:'16px 14px',
                    cursor: unlocked ? 'pointer' : 'not-allowed',
                    display:'flex', flexDirection:'column', alignItems:'flex-start', justifyContent:'space-between', gap:8,
                    animation: gamesIn
                      ? (unlocked
                          ? `gfCardIn .45s ease ${i*.07}s both, gfPulse 2.8s ease ${i*.07+0.5}s infinite`
                          : `gfCardIn .45s ease ${i*.07}s both`)
                      : 'none',
                    transition:'background .2s, transform .15s',
                    boxShadow: unlocked ? `0 0 14px 0 ${game.color}28` : 'none',
                    textAlign:'left', minHeight:110,
                    opacity: unlocked ? 1 : 0.5,
                  }}
                    onMouseEnter={e => unlocked && (e.currentTarget.style.transform='scale(1.04)')}
                    onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}>
                    <span style={{ fontSize:30, filter: unlocked ? 'none' : 'grayscale(.6)' }}>{game.emoji}</span>
                    <div>
                      <div style={{ color: unlocked ? '#2d2a4a' : 'rgba(45,42,74,.35)', fontWeight:800, fontSize:14 }}>{game.title}</div>
                      <div style={{ color:'rgba(45,42,74,.5)', fontSize:11, marginTop:2 }}>{game.desc}</div>
                      <div style={{ display:'flex', gap:6, marginTop:7, flexWrap:'wrap' }}>
                        {catMeta && (
                          <span style={{ background:catMeta.color, color:'#fff', borderRadius:8, padding:'3px 9px', fontSize:11, fontWeight:800, display:'flex', alignItems:'center', gap:4, boxShadow:`0 1px 4px ${catMeta.color}70` }}>
                            {catMeta.icon} {catMeta.label}
                          </span>
                        )}
                        {diffMeta && (
                          <span style={{ background:diffMeta.color, color:'#fff', borderRadius:8, padding:'3px 9px', fontSize:11, fontWeight:800, boxShadow:`0 1px 4px ${diffMeta.color}70` }}>
                            {diffMeta.label}
                          </span>
                        )}
                      </div>
                    </div>
                    {unlocked
                      ? <div style={{ background:`${game.color}30`, borderRadius:8, padding:'3px 10px', fontSize:11, color:game.color, fontWeight:700 }}>Play now! 🎮</div>
                      : <div style={{ background:'rgba(0,0,0,.04)', borderRadius:8, padding:'3px 10px', fontSize:10, color:'rgba(45,42,74,.4)', display:'flex', alignItems:'center', gap:4 }}>
                          🔒 Level {game.requiredLevel} required
                        </div>
                    }
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {previewGame && <GameInstructionsModal game={previewGame} onStart={startGame} onClose={() => setPreviewGame(null)}/>}
      {puzzlePicker && (
        <PuzzlePickerModal
          lang={lang}
          onBack={() => { setPuzzlePicker(false); setPreviewGame(GAMES.find((g) => g.id === 'puzzle-pieces')) }}
          onStart={(cfg) => { setPuzzlePicker(false); setPuzzleConfig(cfg); stopPaoVoice(); setPhase('puzzle-pieces') }}
        />
      )}
      {showCatModal && <CategoryModal onSelect={handleCatSelect} onClose={() => setShowCatModal(false)} lang={lang}/>}
      {showLangModal && <PaoLanguageModal selected={lang} onSelect={handleLanguageSelect}/>}
      {showPicker && (
        <WhoIsPlayingModal
          therapistEmail={therapistEmail}
          language={lang}
          onChangeVoice={() => setShowLangModal(true)}
          onClose={() => navigate(backPath)}
          confirmed={justStarted}
          onStart={async (opts) => {
            const s = await activity.start(opts)
            setJustStarted({ ...s, onChangePlayer: async () => { setJustStarted(null); await activity.changePlayer() } })
          }}
          onGoToGames={() => { setJustStarted(null); activity.closePicker() }}
        />
      )}
    </div>
  )
}
