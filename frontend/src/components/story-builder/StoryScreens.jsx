import { useEffect, useRef, useState } from 'react'
import StoryScene from '../../games/storyBuilder/StoryScene'
import { STORY_COVERS } from '../../games/storyBuilder/storyCovers'
import { PwModal } from '../picture-word-game/pwUi'
import { PaoBubble, PaoStage } from './StoryPao'
import { hasScene, storyKeyOf } from './storyKeys'
import { pickCountOf, pickedChoices } from './storyReducer'

const I = ({ size = 22, children, sw = 2.4 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
)
export const ArrowLeft = (p) => <I {...p}><path d="M19 12H5M11 18l-6-6 6-6" /></I>
export const ArrowRight = (p) => <I {...p}><path d="M5 12h14M13 6l6 6-6 6" /></I>
export const Check = (p) => <I {...p} sw={3.4}><path d="M5 13l4 4L19 7" /></I>
export const Speaker = (p) => <I {...p}><path d="M4 9v6h4l5 4V5L8 9H4Z" /><path d="M17 8a5 5 0 0 1 0 8" /><path d="M19.5 5.5a9 9 0 0 1 0 13" /></I>
export const Play = (p) => <I {...p}><path d="M8 5.5v13l11-6.5-11-6.5Z" /></I>
export const Pause = (p) => <I {...p}><path d="M8 5v14M16 5v14" /></I>
export const Redo = (p) => <I {...p}><path d="M4 12a8 8 0 1 0 3-6.2" /><path d="M4 4v5h5" /></I>
export const Home = (p) => <I {...p}><path d="M4 11l8-7 8 7v9H4z" /></I>
export const Clock = (p) => <I {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></I>
export const Book = (p) => <I {...p}><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M4 19V5" /></I>
export const Grid = (p) => <I {...p}><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></I>
export const InfoI = (p) => <I {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></I>
export const StarI = ({ size = 24, className = '', filled = true }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.6 6.1 20.6l1.3-6.6-4.9-4.6 6.6-.8L12 2.5Z" /></svg>
)

const CARD_COLORS = [
  { bg: '#FFE4EC', edge: '#F4A9C0', ink: '#A3123E' },
  { bg: '#FFE4F3', edge: '#F2A8D6', ink: '#9D174D' },
  { bg: '#FEF3C7', edge: '#F3D26B', ink: '#7A4B00' },
  { bg: '#DDF7E5', edge: '#86D3A0', ink: '#14724A' },
]

// A story's cover: the pack's illustration for the four known stories, otherwise the story's own picture.
function Cover({ story }) {
  const key = storyKeyOf(story)
  if (key && STORY_COVERS[key]) return <div className="sbn-cover" role="img" aria-label={`${story.level_name} cover`} dangerouslySetInnerHTML={{ __html: STORY_COVERS[key] }} />
  return <div className="sbn-cover">{story.cover_image && <img src={story.cover_image} alt="" />}</div>
}

// ─── Story picker (full page) ─────────────────────────────────────────────────────

export function PickerScreen({ stories, progress, onPick, onBack, preview, patientName }) {
  return (
    <>
      <button type="button" className="sbn-pill sbn-back" onClick={onBack}><ArrowLeft size={18} /> Games</button>
      <div className="sbn-title"><strong>Story Builder</strong><span className="sbn-sep" /><em>Pick a story</em></div>
      {preview && <div className="sbn-preview"><InfoI size={13} /> Preview mode: scores are not saved</div>}
      <div className="sbn-pill sbn-stars" aria-label="Stars"><StarI size={26} className="sbn-gold" /> 0</div>

      <div className={`sbn-stories${stories.length > 4 ? ' scroll' : ''}`}>
        {stories.map((story, i) => {
          const c = CARD_COLORS[i % CARD_COLORS.length]
          const total = story.items?.length || 0
          const done = Math.min(total, progress[storyKeyOf(story) || story.story_key || story.level_name] || 0)
          const status = done >= total && total > 0 ? 'Completed' : done > 0 ? `${done} of ${total} done` : 'Not started'
          return (
            <div key={story.story_key || i} className="sbn-story" style={{ background: c.bg, borderColor: c.edge, boxShadow: `0 8px 0 ${c.edge}`, color: c.ink }}>
              <Cover story={story} />
              <h3>{story.level_name}</h3>
              <span className="sbn-segs" aria-hidden="true">{Array.from({ length: total }, (_, k) => <i key={k} className={k < done ? 'on' : ''} />)}</span>
              <small>{total} steps · {status}</small>
              <button type="button" className="sbn-play" onClick={() => onPick(i)} data-autofocus={i === 0 ? true : undefined}><Play size={22} /> {done >= total && total > 0 ? 'Play again' : 'Play'}</button>
            </div>
          )
        })}
      </div>
      <div className="sbn-pao-wrap"><PaoStage view="ready" height={250} /><PaoBubble text={`Which story shall we build today?`} /></div>
      <span className="sbn-sr">{patientName}</span>
    </>
  )
}

// ─── One step ─────────────────────────────────────────────────────────────────────

const optionState = (choice, picks, missed, stepDone) => {
  if (picks.includes(choice.choice_key)) return 'right'
  if (missed.includes(choice.choice_key)) return 'wrong'
  return stepDone ? 'faded' : 'idle'
}

export function StepScreen({ story, item, stepIndex, state, paoView, paoLine, paoHeight, onTap, onNext, onRead, onBack, scene, preview, stars, order }) {
  const picks = state.picks[stepIndex] || []
  const missed = state.wrong[stepIndex] || []
  const need = pickCountOf(item)
  const left = Math.max(0, need - picks.length)
  const total = story.items.length
  const lastStep = stepIndex + 1 >= total
  const navRef = useRef(null)

  // keep the current step in view (and centred) in the scrolling stepper on narrow screens
  useEffect(() => {
    const cur = navRef.current?.querySelector('[aria-current="step"]')
    cur?.scrollIntoView?.({ inline: 'center', block: 'nearest' })
  }, [stepIndex])

  return (
    <>
      <button type="button" className="sbn-pill sbn-back" onClick={onBack}><ArrowLeft size={18} /> Stories</button>
      <div className="sbn-title"><strong>{story.short_title || story.level_name}</strong><span className="sbn-sep" /><em>Step {stepIndex + 1} of {total}</em></div>
      {preview && <div className="sbn-preview"><InfoI size={13} /> Preview mode: scores are not saved</div>}
      <div className="sbn-pill sbn-stars" aria-label={`${stars} steps right on the first try`}><StarI size={26} className="sbn-gold" /> {stars}</div>

      <nav className="sbn-stepper" aria-label="Story steps" ref={navRef}>
        {story.items.map((step, i) => {
          const st = i < stepIndex ? 'done' : i === stepIndex ? 'current' : 'next'
          return (
            <div key={i} className={`sbn-st ${st}`} aria-current={st === 'current' ? 'step' : undefined}>
              <span className="sbn-dot">{st === 'done' ? <Check size={20} /> : i + 1}</span>
              <small>{step.label}</small>
            </div>
          )
        })}
      </nav>

      <section className="sbn-scene-card" aria-label="Story scene">
        <div className="sbn-scene">
          {scene}
          <span className="sbn-scene-pill">Step {stepIndex + 1} of {total} · {item.label}</span>
        </div>
        <div className="sbn-narr">
          <p>{item.text}</p>
          <button type="button" className="sbn-hear" onClick={onRead}><Speaker size={22} /> Hear it</button>
        </div>
      </section>

      {order ? (
        <section className="sbn-q" aria-label="Put the story in order">
          <h2>{order.placed.length === 0 ? 'Put the story in order' : 'What happened next?'}</h2>
          <span className="sbn-chip">{order.placed.length} of {order.cards.length} placed</span>
          <div className="sbn-grid sbn-order">
            {order.cards.map((c) => {
              const pos = order.placed.indexOf(c.idx)
              const st = pos >= 0 ? 'right' : order.flash === c.idx ? 'wrong' : state.stepDone ? 'faded' : 'idle'
              return (
                <button key={c.idx} type="button" className={`sbn-opt sbn-ocard ${st}`} aria-pressed={pos >= 0} disabled={pos >= 0 || state.stepDone} onClick={() => order.onTap(c.idx)} aria-label={pos >= 0 ? `${c.label}, number ${pos + 1}` : c.label}>
                  {pos >= 0 && <span className="sbn-opt-mark green sbn-num">{pos + 1}</span>}
                  {st === 'wrong' && <span className="sbn-opt-mark orange"><Redo size={16} /></span>}
                  <span className="sbn-ocard-pic">{c.scene}</span>
                  <b>{c.label}</b>
                </button>
              )
            })}
            <div className="sbn-action">
              {state.stepDone
                ? <button type="button" className="sbn-next" onClick={onNext} data-autofocus>{lastStep ? 'See my story' : 'Next step'} <ArrowRight size={22} /></button>
                : <span className="sbn-wait">{order.flash != null && <Redo size={18} />} {order.flash != null ? 'Try again' : `Pick number ${order.placed.length + 1}`}</span>}
            </div>
          </div>
        </section>
      ) : (
      <section className="sbn-q" aria-label="Choose what happens next">
        <h2>{item.question}</h2>
        {need > 1 && <span className="sbn-chip">{picks.length} of {need} picked</span>}
        <div className="sbn-grid">
          {(item.choices || []).map((choice) => {
            const st = optionState(choice, picks, missed, state.stepDone)
            const disabled = st !== 'idle'
            return (
              <button key={choice.choice_key} type="button" className={`sbn-opt ${st}`} aria-pressed={st === 'right'} disabled={disabled} onClick={() => onTap(choice)} aria-label={choice.label}>
                {st === 'right' && <span className="sbn-opt-mark green"><Check size={18} /></span>}
                {st === 'wrong' && <span className="sbn-opt-mark orange"><Redo size={16} /></span>}
                <span className="sbn-opt-pic"><img src={choice.image_url} alt="" draggable="false" /></span>
                <b>{choice.label}</b>
                {st === 'right' && <em className="ok">Nice!</em>}
                {st === 'wrong' && <em className="no">{choice.feedback || 'Try another one!'}</em>}
              </button>
            )
          })}
          <div className="sbn-action">
            {state.stepDone
              ? <button type="button" className="sbn-next" onClick={onNext} data-autofocus>{lastStep ? 'See my story' : 'Next step'} <ArrowRight size={22} /></button>
              : need > 1
                ? <span className="sbn-wait">{missed.length > 0 && <Redo size={18} />} {left === need && missed.length === 0 ? `Pick ${need}` : `Pick ${left} more`}</span>
                : <span className="sbn-wait">{missed.length > 0 ? <><Redo size={18} /> Try again</> : 'Tap an answer'}</span>}
          </div>
        </div>
      </section>

      )}

      <div className="sbn-pao-wrap"><PaoStage view={paoView} height={paoHeight} /><PaoBubble text={paoLine} /></div>
    </>
  )
}

// A scene for one step: the animated scene, or the story's own picture when no animation exists for it.
export function SceneFor({ story, item, index, label, paused = false, restartKey = '' }) {
  const key = storyKeyOf(story)
  if (hasScene(key, index)) {
    // `restartKey` changes on a correct answer so the child sees the animation play again from the start
    return <div className="sbn-scene-fill" key={`${index}:${restartKey}`}><StoryScene story={key} index={index} paused={paused} label={label} /></div>
  }
  return <div className="sbn-scene-fill"><img src={item.image_url} alt={label} draggable="false" /></div>
}

// ─── Results + "Watch my story" ───────────────────────────────────────────────────

const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

export function ResultsScreen({ story, stats, stars, preview, onWatch, onOther, onExit }) {
  return (
    <PwModal onClose={onExit} width={520} label="Results" className="sbn-results">
      <div className="sbn-res-stars" role="img" aria-label={`${stars} out of 3 stars`}>
        {[1, 2, 3].map((n) => <StarI key={n} size={n === 2 ? 58 : 44} className={n <= stars ? 'sbn-gold' : 'sbn-dark'} />)}
      </div>
      <h2 className="sbn-res-title">Your story is built!</h2>
      <p className="sbn-res-says">{story.level_name}</p>
      <ul className="sbn-res-stats" aria-label="Your results">
        <li><b>{stats.steps} of {stats.steps}</b><small>Steps</small></li>
        <li><b>{stats.firstTry} of {stats.steps}</b><small>First try</small></li>
        <li><b>{clock(stats.seconds)}</b><small>Time</small></li>
      </ul>
      <div className="sbn-res-btns">
        <button type="button" className="sbn-btn indigo" onClick={onWatch} data-autofocus><Play size={20} /> Watch my story</button>
        <button type="button" className="sbn-btn light" onClick={onOther}><Grid size={20} /> Pick another story</button>
        <button type="button" className="sbn-btn light" onClick={onExit}><Home size={20} /> All games</button>
      </div>
      {preview && <p className="sbn-foot">Preview mode: this score was not saved</p>}
    </PwModal>
  )
}

const WATCH_MS = 6500

// Plays every scene in order (about 6.5 seconds each) with Back, Pause and Next.
export function WatchScreen({ story, panels, onClose }) {
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const last = panels.length - 1
  useEffect(() => {
    if (paused) return undefined
    const t = setTimeout(() => setI((n) => (n >= last ? n : n + 1)), WATCH_MS)
    return () => clearTimeout(t)
  }, [i, paused, last])
  const p = panels[i]
  return (
    <PwModal onClose={onClose} width={560} label="Watch my story" className={`sbn-watch${paused ? ' paused' : ''}`}>
      <button type="button" className="sbn-watch-x" onClick={onClose} aria-label="Close"><I size={20}><path d="M6 6l12 12M18 6L6 18" /></I></button>
      <div className="sbn-watch-head"><strong>{story.level_name}</strong><span>{i + 1} / {panels.length}</span></div>
      <div className="sbn-watch-scene">{p.scene}</div>
      <p className="sbn-watch-line">{p.line}</p>
      <div className="sbn-watch-ctl">
        <button type="button" className="sbn-wbtn" onClick={() => setI((n) => Math.max(0, n - 1))} disabled={i === 0} aria-label="Back"><ArrowLeft size={22} /><span>Back</span></button>
        <button type="button" className="sbn-wbtn main" onClick={() => setPaused((v) => !v)} data-autofocus aria-label={paused ? 'Play' : 'Pause'}>{paused ? <Play size={22} /> : <Pause size={22} />}<span>{paused ? 'Play' : 'Pause'}</span></button>
        <button type="button" className="sbn-wbtn" onClick={() => setI((n) => Math.min(last, n + 1))} disabled={i === last} aria-label="Next"><span>Next</span><ArrowRight size={22} /></button>
      </div>
    </PwModal>
  )}

export { pickedChoices }
