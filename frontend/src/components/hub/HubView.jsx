import { useEffect, useMemo, useState } from 'react'
import { usePao } from '../../context/PaoContext'
import { identQuery } from '../../utils/paoApi'
import PaoLayered from '../pao/PaoLayered'
import { resolveItemKey, LAYER_CATEGORIES } from '../pao/paoLayers'
import { hubLine } from '../pao/paoLines'
import { Icon, Medal, Scenery, TopChips, badgeIcon, formatManila } from './HubParts'
import './hub.css'

// Bar scale for Character Stats: percent = min(100, value / SCALE * 100).
// The design assumes 15. CONFIRM WITH THE PRODUCT OWNER BEFORE RELEASE
// (the server's stat cap is 100, so a low scale fills bars quickly).
const SCALE = 15

const STATS = [
  { key: 'intelligence', label: 'Intelligence', icon: 'book', color: '#6366F1' },
  { key: 'focus', label: 'Focus', icon: 'target', color: '#F59E0B' },
  { key: 'resistance', label: 'Resistance', icon: 'shield', color: '#10B981' },
  { key: 'creativity', label: 'Creativity', icon: 'palette', color: '#EC4899' },
  { key: 'speed', label: 'Speed', icon: 'bolt', color: '#06B6D4' },
  { key: 'memory', label: 'Memory', icon: 'brain', color: '#8B5CF6' },
]
const pctOf = (v) => Math.min(100, Math.max(0, ((Number(v) || 0) / SCALE) * 100))
const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

// Hexagon radar, six axes, rings at 25/50/75/100% of SCALE.
function Radar({ stats }) {
  const C = 150; const R = 88
  const pt = (i, f) => { const a = -Math.PI / 2 + (i * Math.PI) / 3; return [C + Math.cos(a) * R * f, C + Math.sin(a) * R * f] }
  const poly = (f) => STATS.map((_, i) => pt(i, f).join(',')).join(' ')
  const data = STATS.map((s, i) => pt(i, pctOf(stats?.[s.key]) / 100))
  const labelPos = [[C, 28, 'middle'], [C + 112, 100, 'start'], [C + 112, 214, 'start'], [C, 276, 'middle'], [C - 112, 214, 'end'], [C - 112, 100, 'end']]
  return (
    <svg className="hb-radar" viewBox="0 0 300 300" role="img" aria-label="Character stats radar chart">
      {[0.25, 0.5, 0.75, 1].map((f) => <polygon key={f} points={poly(f)} fill="none" stroke="#DCE6F7" strokeWidth="1.5" />)}
      {STATS.map((_, i) => { const [x, y] = pt(i, 1); return <line key={i} x1={C} y1={C} x2={x} y2={y} stroke="#E4ECF8" strokeWidth="1.5" /> })}
      <polygon points={data.map((p) => p.join(',')).join(' ')} fill="#6D4AE0" fillOpacity=".25" stroke="#6D4AE0" strokeWidth="2.5" strokeLinejoin="round" />
      {data.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="5.5" fill={STATS[i].color} stroke="#fff" strokeWidth="1.5" />)}
      {STATS.map((s, i) => <text key={s.key} x={labelPos[i][0]} y={labelPos[i][1]} textAnchor={labelPos[i][2]} fontFamily="Inter, sans-serif" fontWeight="700" fontSize="13" fill="#14306B">{s.label}</text>)}
    </svg>
  )
}

export function HubView({ patientName, onBack, onPlay, onCustomize, onOpenBadges, onPlayGame }) {
  const pao = usePao()
  const profile = pao?.profile
  const ident = pao?.ident
  const [hub, setHub] = useState(null)
  const [error, setError] = useState('')
  const query = identQuery(ident)

  useEffect(() => {
    if (!query) return undefined
    let cancelled = false
    fetch(`/api/pao/hub?${query}`).then((r) => r.json())
      .then((b) => { if (!cancelled) { if (b.error) setError(b.error); else setHub(b) } })
      .catch(() => { if (!cancelled) setError('Could not load your progress.') })
    return () => { cancelled = true }
  }, [query])

  // Same renderer as Customize Pao: the equipped outfit, plus the chosen pose or expression.
  const equippedKeys = useMemo(() => {
    const out = {}
    for (const cat of LAYER_CATEGORIES) {
      const it = profile?.equipped?.[cat]
      if (it && it.name) out[cat] = resolveItemKey(it.name)
    }
    return out
  }, [profile])

  const level = profile?.level ?? null
  const xp = profile?.xp ?? 0
  const xpNext = profile?.xpToNext ?? null
  const xpAway = xpNext ? Math.max(0, xpNext - xp) : null
  const first = String(patientName || '').trim().split(/\s+/)[0]
  const bubble = hubLine({ name: first, xpAway, nextLevel: level ? level + 1 : null })
  const stats = profile?.stats || {}
  const wk = hub?.week || []
  const maxDay = Math.max(1, ...wk.map((d) => d.games))
  const nextOutfitKey = hub?.nextOutfit ? resolveItemKey(hub.nextOutfit.name) : null
  const crop = { hair: 0, hats: 0, clothes: -64, pants: -104, shoes: -138 }[hub?.nextOutfit?.category] ?? 0

  return (
    <div className="hb-root">
      <Scenery />
      <TopChips onBack={onBack} />
      <div className="hb-scroll">
        <div className="hb-col hub">

          <section className="hb-card hb-hero" aria-label="Your Pao">
            <div className="hb-stage">
              <div className="hb-bubble" role="status">{bubble}</div>
              <div className="hb-pao"><PaoLayered equipped={equippedKeys} fill /></div>
            </div>
            <div className="hb-info">
              <div className="hb-kicker">WELCOME BACK</div>
              <h1 className="hb-name">{patientName || 'Friend'}</h1>
              {level != null && (
                <>
                  <div className="hb-lvlrow">
                    <span className="hb-lvl"><Icon name="star" size={18} /> LEVEL {level}</span>
                    {xpNext ? <span className="hb-xp">{xp} / {xpNext} XP</span> : null}
                    {xpAway != null && xpAway > 0 && <span className="hb-xpnext">{xpAway} XP to Level {level + 1}</span>}
                  </div>
                  {xpNext ? <div className="hb-xpbar" role="progressbar" aria-valuemin={0} aria-valuemax={xpNext} aria-valuenow={xp}><i style={{ width: `${Math.min(100, (xp / xpNext) * 100)}%` }} /></div> : null}
                </>
              )}
              <div className="hb-btns">
                <button type="button" className="hb-btn play" onClick={onPlay}><Icon name="play" size={18} fill /> Play games</button>
                <button type="button" className="hb-btn" onClick={onCustomize}><Icon name="shirt" size={20} /> Customize Pao</button>
                {hub && <button type="button" className="hb-btn" onClick={onOpenBadges}><Icon name="trophy" size={20} /> Badge Case {hub.earnedCount}/{hub.totalBadges}</button>}
              </div>
            </div>
          </section>

          {error && <div className="hb-card" style={{ padding: 16 }} role="alert">{error}</div>}

          {hub && (
            <div className="hb-tiles">
              <section className="hb-card hb-tile" aria-label="Day streak">
                <div className="hb-thead">
                  <div className="hb-ticon" style={{ background: '#FFE9D2', color: '#EA7A0B' }}><Icon name="flame" size={30} /></div>
                  <div>
                    <div className="hb-tbig" style={{ color: '#B45309' }}><b>{hub.streakDays}</b>day streak</div>
                    <div className="hb-tsub">{hub.playedToday ? 'Great job today!' : `Play today to make it ${hub.streakDays + 1}!`}</div>
                  </div>
                </div>
                <div className="hb-days">
                  {wk.map((d, i) => (
                    <div key={d.weekday} className="hb-day" aria-label={`${d.weekday}: ${d.games > 0 ? 'played' : 'no games'}`}>
                      <div className={`hb-flame ${d.games > 0 ? 'on' : 'off'} ${d.isToday ? 'today' : ''}`}>{d.games > 0 && <Icon name="flame" size={20} fill />}</div>
                      {DAY_LETTERS[i]}
                    </div>
                  ))}
                </div>
              </section>

              <section className="hb-card hb-tile" aria-label="Games this week">
                <div className="hb-thead">
                  <div className="hb-ticon" style={{ background: '#ECE6FF', color: '#6D4AE0' }}><Icon name="gamepad" size={30} /></div>
                  <div>
                    <div className="hb-tbig" style={{ color: '#4527B8' }}><b>{hub.gamesThisWeek}</b>games this week</div>
                    {hub.bestDay && <div className="hb-tsub">Best day: {hub.bestDay.weekday}, {hub.bestDay.games} {hub.bestDay.games === 1 ? 'game' : 'games'}</div>}
                  </div>
                </div>
                <div className="hb-bars">
                  {wk.map((d, i) => (
                    <div key={d.weekday} className="hb-barcol" aria-label={`${d.weekday}: ${d.games} games`}>
                      <div className={`hb-bar ${d.games > 0 ? 'on' : ''}`} style={{ height: d.games > 0 ? Math.max(14, (d.games / maxDay) * 44) : 6 }} />
                      {DAY_LETTERS[i]}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {profile && (
            <section className="hb-card hb-stats" aria-label="Character stats">
              <h2 className="hb-title">Character Stats</h2>
              <p className="hb-hint">Bars fill toward the next milestone ({SCALE})</p>
              <div className="hb-statsbody">
                <Radar stats={stats} />
                <div className="hb-statgrid">
                  {STATS.map((s) => (
                    <div key={s.key} className="hb-stat">
                      <div className="hb-sico" style={{ background: s.color }}><Icon name={s.icon} size={24} /></div>
                      <div className="hb-sbody">
                        <div className="hb-srow"><span>{s.label}</span><span style={{ color: s.color }}>{stats[s.key] ?? 0}</span></div>
                        <div className="hb-sbar"><i style={{ width: `${pctOf(stats[s.key])}%`, background: s.color }} /></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {hub && (
            <section className="hb-card hb-earned" aria-label="Badges earned">
              <div className="hb-earnhead">
                <h2 className="hb-title">Badges Earned</h2>
                <button type="button" className="hb-link" onClick={onOpenBadges}>Open Badge Case <Icon name="chevronR" size={16} /></button>
              </div>
              {hub.earnedBadges.length === 0
                ? <p className="hb-hint" style={{ marginTop: 14 }}>No badges yet. Play a game to earn your first one!</p>
                : (
                  <div className="hb-earngrid">
                    {hub.earnedBadges.map((b) => (
                      <div key={b.code} className="hb-ecard">
                        <div style={{ display: 'flex', justifyContent: 'center' }}><Medal icon={badgeIcon(b.symbol)} size={70} /></div>
                        <b>{b.name}</b>
                        <span>{formatManila(b.earnedAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
            </section>
          )}

          {hub?.nextOutfit && (
            <section className="hb-card hb-next" aria-label="Next outfit to unlock">
              <div className="hb-nprev" aria-hidden="true">
                <div style={{ position: 'absolute', left: -30, top: crop, width: 140, height: 180 }}>
                  <PaoLayered equipped={nextOutfitKey && LAYER_CATEGORIES.includes(hub.nextOutfit.category) ? { [hub.nextOutfit.category]: nextOutfitKey } : {}} fill noStyle />
                </div>
              </div>
              <div className="hb-nbody">
                <div className="hb-nlabel">NEXT OUTFIT TO UNLOCK</div>
                <div className="hb-nname">{hub.nextOutfit.name}</div>
                <div className="hb-nreq">
                  <span>{hub.nextOutfit.requirement}</span>
                  <div className="hb-prog"><i style={{ width: `${Math.round((hub.nextOutfit.have / hub.nextOutfit.need) * 100)}%` }} /></div>
                  <b>{hub.nextOutfit.have}/{hub.nextOutfit.need}</b>
                </div>
              </div>
              {hub.nextOutfit.gameName && (
                <button type="button" className="hb-btn play" style={{ flex: 'none' }} onClick={() => onPlayGame(hub.nextOutfit.gameName)}>
                  <Icon name="play" size={16} fill /> Play {hub.nextOutfit.gameName}
                </button>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

export default HubView
