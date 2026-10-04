import { useRef } from 'react'
import { useModalFocus } from './useModalFocus'

// Each story keeps its own soft color; the database has no color field, so the
// colors cycle in story order (pink, light pink, yellow, green, ...).
const CARD_COLORS = ['#FCE7F3', '#FBCFE8', '#FEF9C3', '#DCFCE7']

export default function StoryPicker({ stories, onPick, onClose }) {
  const ref = useRef(null)
  useModalFocus(ref, onClose)

  return (
    <div className="sb-overlay" role="dialog" aria-modal="true" aria-labelledby="sb-picker-title" ref={ref}>
      <div className="sb-modal">
        <button type="button" className="sb-modal-close" onClick={onClose} aria-label="Close">×</button>
        <h2 id="sb-picker-title" className="sb-title" style={{ fontSize: 32, paddingRight: 56 }}>Pick a story</h2>

        <div className="sb-story-grid">
          {stories.map((story, i) => (
            <button
              key={story.story_key || i}
              type="button"
              className="sb-story-card"
              style={{ background: CARD_COLORS[i % CARD_COLORS.length], borderColor: '#fff' }}
              onClick={() => onPick(i)}
            >
              <img src={story.cover_image} alt="" />
              <span className="sb-story-card-title">{story.level_name}</span>
              <span style={{ fontWeight: 700 }}>{story.items?.length || 0} steps</span>
            </button>
          ))}
        </div>

        <button type="button" className="sb-btn sb-btn--ghost" onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}
