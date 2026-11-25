import { CATEGORIES } from './data'
import { PwModal, PwSky } from './pwUi'
import { PaoBubble, PaoStage } from './PicturePao'
import { WordPicture } from './wordArt'
import { BackArrowIcon, CheckIcon, GearIcon, StarIcon } from './illustrations'
import { PAO_PROP_CSS } from '../../games/pictureWord/PaoProps'
import usePwStage from './usePwStage'

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
)
const Svg = ({ children, size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
)
const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

// ─── Category picker ──────────────────────────────────────────────────────────

export function CategoryScreen({ onSelect, onClose, onOpenSettings, patientName = 'friend', wordsPerRound = 6, mastered = {} }) {
  const stage = usePwStage()
  const greeting = `Hi ${String(patientName).split(' ')[0]}! What shall we read today?`
  return (
    <div className="pw-root">
      <style>{PAO_PROP_CSS}</style>
      <PwSky />
      <div className={`pw-stage${stage.narrow ? ' narrow' : ''}`} style={stage.style}>
        <button type="button" className="pw-pill pw-back" onClick={onClose}><BackArrowIcon size={18} /> Back</button>
        <div className="pw-pao-wrap"><PaoStage view="ready" height={stage.narrow ? 180 : 300} /><PaoBubble text={greeting} className="above" /></div>
      </div>
      <PwModal onClose={onClose} width={720} label="Choose a category" className="pw-picker">
        {onOpenSettings && <button type="button" className="pw-x left" onClick={onOpenSettings} aria-label="Therapist settings"><GearIcon size={20} /></button>}
        <button type="button" className="pw-x" onClick={onClose} aria-label="Close"><Svg><path d="M6 6l12 12M18 6L6 18" /></Svg></button>
        <h2 className="pw-picker-title">What do you want to play?</h2>
        <p className="pw-picker-sub">Tap a picture to start. Stars show the words you have mastered.</p>
        <div className="pw-tiles">
          {CATEGORIES.map((cat) => (
            <button key={cat.id} type="button" className="pw-tile" onClick={() => onSelect(cat.id)} style={{ background: cat.light, borderColor: cat.dark, boxShadow: `0 8px 0 ${cat.dark}`, color: cat.ink }}>
              <WordPicture word={cat.art} size={92} />
              <b>{cat.label}</b>
              <small>{wordsPerRound} words</small>
              <span className="pw-dots" aria-label={`${Math.min(mastered[cat.id] || 0, wordsPerRound)} of ${wordsPerRound} words mastered`}>
                {Array.from({ length: wordsPerRound }, (_, i) => <i key={i} className={i < (mastered[cat.id] || 0) ? 'on' : ''} />)}
              </span>
            </button>
          ))}
        </div>
        <button type="button" className="pw-later" onClick={onClose}>Maybe later</button>
      </PwModal>
    </div>
  )
}

// ─── Results ──────────────────────────────────────────────────────────────────

// 3 stars when at least 5 of 6 were right on the first try with at most 1 hint, 2 for at least 3 of 6, else 1.
export function starRating(firstTry, total, hints) {
  if (total && firstTry / total >= 5 / 6 && hints <= 1) return 3
  if (total && firstTry / total >= 0.5) return 2
  return 1
}

export function ResultsScreen({ categoryLabel, patientName = 'friend', stats, badge, preview, onReplay, onNewGroup, onBack }) {
  const stage = usePwStage()
  const total = stats.results.length
  const rating = starRating(stats.firstTry, total, stats.hints)
  const left = badge && badge.target ? Math.max(0, badge.target - (badge.progress || 0)) : 0
  const pct = badge && badge.target ? Math.min(100, Math.round(((badge.progress || 0) / badge.target) * 100)) : 0
  const note = !badge ? '' : badge.earned ? 'Badge earned!' : left > 0 && badge.rewardOutfit ? `${left} more win${left === 1 ? '' : 's'} unlock the ${badge.rewardOutfit}` : left > 0 ? `${left} more win${left === 1 ? '' : 's'} to earn it` : ''
  return (
    <div className="pw-root">
      <style>{PAO_PROP_CSS}</style>
      <PwSky />
      <div className={`pw-stage${stage.narrow ? ' narrow' : ''}`} style={stage.style}>
        <button type="button" className="pw-pill pw-back" onClick={onBack}><BackArrowIcon size={18} /> Back</button>
      </div>
      <PwModal onClose={onBack} width={1050} label="Results" className="pw-results">
        <h2 className="pw-res-title">You read all the {categoryLabel} words!</h2>
        <p className="pw-res-says">Pao says: &ldquo;Super reading, {String(patientName).split(' ')[0]}!&rdquo;</p>
        <div className="pw-res-hero">
          <div className="pw-res-pao"><PaoStage view="finished" height={210} /></div>
          <div className="pw-res-stars" role="img" aria-label={`${rating} out of 3 stars`}>
            {[1, 2, 3].map((n) => <StarIcon key={n} size={n === 2 ? 110 : 80} className={n <= rating ? 'pw-gold' : 'pw-dark'} />)}
          </div>
        </div>
        <div className="pw-stat-grid">
          <div><span className="pw-tile-i" style={{ background: '#22C55E' }}><CheckIcon size={26} /></span><b>{stats.firstTry} of {total}</b><small>First try</small></div>
          <div><span className="pw-tile-i" style={{ background: '#F59E0B' }}><SearchIcon /></span><b>{stats.hints}</b><small>Hints used</small></div>
          <div><span className="pw-tile-i" style={{ background: '#6366F1' }}><Svg><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg></span><b>{clock(stats.seconds)}</b><small>Time</small></div>
          <div><span className="pw-tile-i" style={{ background: '#F59E0B' }}><StarIcon size={24} filled={false} /></span><b>{rating} of 3</b><small>Stars</small></div>
        </div>
        <div className="pw-words" style={{ gridTemplateColumns: `repeat(${Math.min(total, 6) || 1}, 1fr)` }}>
          {stats.results.map((r, i) => (
            <div key={i} className="pw-wordcard">
              <span className={`pw-wbadge ${r.hint ? 'amber' : 'green'}`} aria-label={r.hint ? 'Used a hint' : 'Right'}>{r.hint ? <SearchIcon /> : <CheckIcon size={16} />}</span>
              <WordPicture word={r.word} size={56} />
              <b>{r.word}</b>
            </div>
          ))}
        </div>
        {badge && badge.target > 0 && (
          <div className="pw-badge-row">
            <span className="pw-badge-ico"><Svg size={26}><circle cx="12" cy="9" r="6" /><path d="M8.5 14L7 22l5-3 5 3-1.5-8" /></Svg></span>
            <div className="pw-badge-mid"><b>{badge.name}{/badge/i.test(badge.name) ? '' : ' badge'}</b><div className="pw-bar" role="progressbar" aria-valuemin={0} aria-valuemax={badge.target} aria-valuenow={badge.progress || 0}><i style={{ width: `${pct}%` }} /></div></div>
            <div className="pw-badge-r"><b>{badge.progress || 0}/{badge.target}</b>{note && <small>{note}</small>}</div>
          </div>
        )}
        <div className="pw-res-btns">
          <button type="button" className="pw-btn green" onClick={onReplay} data-autofocus><Svg><path d="M4 12a8 8 0 1 0 3-6.2" /><path d="M4 4v5h5" /></Svg> Play again</button>
          <button type="button" className="pw-btn light" onClick={onNewGroup}><Svg><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></Svg> Pick another</button>
          <button type="button" className="pw-btn light" onClick={onBack}><Svg><path d="M4 11l8-7 8 7v9H4z" /></Svg> Back to games</button>
        </div>
        {preview && <p className="pw-foot">Preview mode: this score was not saved</p>}
      </PwModal>
    </div>
  )
}
