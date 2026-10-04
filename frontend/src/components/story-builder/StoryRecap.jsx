import { useRef } from 'react'
import { useModalFocus } from './useModalFocus'

// "The End!" card: the patient's own story as numbered picture panels.
export default function StoryRecap({ story, panels, game, onReadAll, onPlayAgain, onOtherStories }) {
  const ref = useRef(null)
  useModalFocus(ref, onOtherStories)
  const columns = panels.length > 6 ? 4 : 3
  const points = game?.pointsPerPlay ?? 100

  return (
    <div className="sb-overlay" role="dialog" aria-modal="true" aria-labelledby="sb-end-title" ref={ref}>
      <div className="sb-modal" style={{ width: 'min(920px, 100%)' }}>
        <h2 id="sb-end-title" className="sb-title" style={{ fontSize: 38 }}>The End! You told the whole story!</h2>
        <p style={{ fontSize: 18, margin: '6px 0 0' }}>{story.level_name}, in order</p>

        <div className="sb-actions" style={{ margin: '14px 0 0' }}>
          <span className="sb-pill">🏅 {game?.badge?.name || 'Story Builder'} badge</span>
          <span className="sb-pill">⭐ +{points} XP</span>
        </div>

        <ol className="sb-recap-grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, listStyle: 'none', padding: 0 }}>
          {panels.map((panel, i) => (
            <li key={`${panel.label}-${i}`} className="sb-panel">
              <span className="sb-panel-num">{i + 1}</span>
              {panel.image && <img src={panel.image} alt="" />}
              <span>{panel.line}</span>
            </li>
          ))}
        </ol>

        <div className="sb-actions">
          <button type="button" className="sb-btn" onClick={onReadAll}>🔊 Read my story</button>
          <button type="button" className="sb-btn sb-btn--green" onClick={onPlayAgain}>Play again</button>
          <button type="button" className="sb-btn sb-btn--ghost" onClick={onOtherStories}>Other stories</button>
        </div>
      </div>
    </div>
  )
}
