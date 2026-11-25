import { useState } from 'react'
import { ArrowLeft, Bars, CheckI, Clock, Home, Play, Replay, Speaker, StarI, TurtleHero, TurtleIcon, EcModal } from './echoUi'
import { EchoPicture } from './echoArt'
import { PaoStage } from './EchoPao'
import BadgeMedal from '../BadgeMedal'
import { ECHO_REACTIONS } from '../../games/echo/paoReactions'

const BARS = { slow: 3, slower: 2, turtle: 1 } // more bars = faster
const SpeedBars = ({ n }) => (
  <span className="ec-speed" aria-hidden="true">{[1, 2, 3].map((i) => <i key={i} className={i <= n ? 'on' : ''} />)}</span>
)

// ─── Setup ───────────────────────────────────────────────────────────────────────

export function SetupScreen({ levels, paces, onStart, onExit, preview, narrow }) {
  const [levelId, setLevelId] = useState(1)
  const [paceId, setPaceId] = useState('slow')
  const [scaffold, setScaffold] = useState(true) // same default as before: echo one syllable at a time
  return (
    <>
      <button type="button" className="ec-pill ec-back" onClick={onExit}><ArrowLeft size={18} /> All Games</button>
      {preview && <div className="ec-preview top">Preview mode: scores are not saved</div>}
      <div className={`ec-setup${narrow ? ' narrow' : ''}`}>
        <TurtleHero width={130} />
        <h1>Slow-Motion Echo</h1>
        <p className="ec-desc">Listen to each word broken into syllables, nice and slow. Then say it back. No rush!</p>

        <div className="ec-label">Choose a level</div>
        <div className="ec-levels" role="radiogroup" aria-label="Level">
          {levels.map((lvl) => {
            const on = levelId === lvl.id
            const ex = lvl.words[0]?.syllables?.join('·')
            return (
              <button key={lvl.id} type="button" role="radio" aria-checked={on} className={`ec-level${on ? ' on' : ''}`} onClick={() => setLevelId(lvl.id)}>
                <span className="ec-num">{lvl.id}</span>
                <span className="ec-level-t"><b>{lvl.label}</b><small>{lvl.sub}</small>{ex && <em>{ex}</em>}</span>
                <span className="ec-diff" aria-hidden="true">{[1, 2, 3, 4].map((d) => <i key={d} className={d <= lvl.id ? 'on' : ''} />)}</span>
                {on && <span className="ec-checkbadge"><CheckI size={18} /></span>}
              </button>
            )
          })}
        </div>

        <div className="ec-label">Pacing</div>
        <div className="ec-paces" role="radiogroup" aria-label="Pacing">
          {paces.map((p) => (
            <button key={p.id} type="button" role="radio" aria-checked={paceId === p.id} className={`ec-pace${paceId === p.id ? ' on' : ''}`} onClick={() => setPaceId(p.id)}>
              <TurtleIcon size={30} /> <b>{p.label}</b> <SpeedBars n={BARS[p.id] || 2} />
            </button>
          ))}
        </div>

        <div className="ec-toggle-row">
          <span className="ec-toggle-ico"><Speaker size={26} /></span>
          <span className="ec-toggle-t"><b id="ec-scaffold-l">Echo one syllable at a time</b><small>Turn off when your child is ready to echo the whole word.</small></span>
          <button type="button" role="switch" aria-checked={scaffold} aria-labelledby="ec-scaffold-l" className={`ec-switch${scaffold ? ' on' : ''}`} onClick={() => setScaffold((v) => !v)}><i /></button>
        </div>

        <button type="button" className="ec-go" onClick={() => onStart({ levelId, paceId, scaffold })} data-autofocus><Play size={24} /> Let us go!</button>
      </div>
    </>
  )
}

// ─── Results ─────────────────────────────────────────────────────────────────────

export function ResultsScreen({ stats, patientName, stars, paceLabel, nextLevel, sayLine, badge, preview, onReplay, onNext, onExit }) {
  const total = stats.words.length
  const recommend = total > 0 && stats.firstTry / total >= 0.8
  const finishedLine = ECHO_REACTIONS.finished.lines[0].replace('{name}', String(patientName).split(' ')[0])
  return (
    <EcModal onClose={onExit} width={1070} label="Results" className="ec-results">
      <h2 className="ec-res-title">You echoed all {total} words!</h2>
      <p className="ec-res-says">Pao says: &ldquo;{sayLine || finishedLine}&rdquo;</p>
      <div className="ec-res-hero">
        <div className="ec-res-pao"><PaoStage view="finished" height={220} /></div>
        <div className="ec-res-stars" role="img" aria-label={`${stars} out of 3 stars`}>
          {[1, 2, 3].map((n) => <StarI key={n} size={n === 2 ? 110 : 82} className={n <= stars ? 'ec-gold' : 'ec-dark'} />)}
        </div>
      </div>
      <div className="ec-stat-grid">
        <div><span className="ec-tile-i" style={{ background: '#22C55E' }}><CheckI size={26} /></span><b>{stats.firstTry} of {total}</b><small>First try</small></div>
        <div><span className="ec-tile-i" style={{ background: '#F59E0B' }}><TurtleIcon size={30} /></span><b>{stats.slower}</b><small>Slower tries</small></div>
        <div><span className="ec-tile-i" style={{ background: '#14B8A6' }}><Replay size={24} /></span><b>{stats.replays}</b><small>Replays</small></div>
        <div><span className="ec-tile-i" style={{ background: '#6366F1' }}><Clock size={24} /></span><b>{paceLabel}</b><small>Pace</small></div>
      </div>
      <div className="ec-words" style={{ gridTemplateColumns: `repeat(${Math.min(total, 5) || 1}, 1fr)` }}>
        {stats.words.map((w, i) => (
          <div key={i} className="ec-wordcard">
            <span className={`ec-wbadge ${w.slower ? 'amber' : 'green'}`} aria-label={w.slower ? 'Needed a slower try' : 'Echoed'}>{w.slower ? <TurtleIcon size={18} /> : <CheckI size={16} />}</span>
            <EchoPicture word={w.word} size={50} />
            <b>{w.syllables.join('·')}</b>
          </div>
        ))}
      </div>
      <div className="ec-suggest">
        <span className="ec-suggest-ico"><Bars size={26} /></span>
        <div className="ec-suggest-t">
          {recommend && nextLevel
            ? <><b>Ready for Level {nextLevel.id}?</b><small>{nextLevel.sub} like {nextLevel.words[0]?.syllables?.join('·')}</small></>
            : <><b>Play again at this level</b><small>A little more practice makes it easier.</small></>}
        </div>
        <span className="ec-suggest-r">You echoed {stats.firstTry} of {total} on the first try</span>
      </div>
      {badge && (
        <div className="ec-badge-row">
          {badge.real ? <BadgeMedal shape={badge.real.shape} colour={badge.real.colour} symbol={badge.real.symbol} size={56} /> : <span className="ec-badge-ico"><Speaker size={26} /></span>}
          <div><b>Badge earned: {badge.real ? badge.real.name : 'Echo Master'}</b><small>Every syllable said clearly across all {badge.totalLevels} levels. Echo Scarf unlocked in Customize Pao!</small></div>
        </div>
      )}
      {!badge && stats.levelsMastered > 0 && stats.levelsMastered < stats.totalLevels && (
        <p className="ec-mastered">{stats.levelsMastered} of {stats.totalLevels} levels said perfectly clear. Keep going for the Echo Master badge!</p>
      )}
      <div className="ec-res-btns" style={{ gridTemplateColumns: nextLevel ? '1.2fr 1fr 1fr' : '1fr 1fr' }}>
        <button type="button" className="ec-btn green" onClick={onReplay} data-autofocus><Replay size={22} /> Play again</button>
        {nextLevel && <button type="button" className={`ec-btn teal${recommend ? '' : ' soft'}`} onClick={onNext}><Bars size={22} /> Try Level {nextLevel.id}</button>}
        <button type="button" className="ec-btn light" onClick={onExit}><Home size={22} /> All games</button>
      </div>
      {preview && <p className="ec-foot">Preview mode: this score was not saved</p>}
    </EcModal>
  )
}

