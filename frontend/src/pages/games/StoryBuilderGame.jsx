import PandaMascot from './PandaMascot'

// ─── Story catalog ─────────────────────────────────────────────────────────────
// Only Little Red Riding Hood is playable today; the rest are shown locked so
// the picker already reads as a growing library rather than a one-off game.

export const STORIES = [
  { id: 'red-riding-hood', title: 'Little Red Riding Hood', emoji: '🧺', color: '#ef4444', desc: 'Help Red make good choices in the woods!', available: true },
  { id: 'three-pigs',      title: 'The Three Little Pigs',  emoji: '🐷', color: '#f59e0b', desc: 'Build houses that keep the wolf away!',   available: false },
  { id: 'goldilocks',      title: 'Goldilocks & the Bears', emoji: '🐻', color: '#92400e', desc: 'Find what feels just right!',              available: false },
]

export default function StoryBuilderGame({ onSelect, onExit }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'radial-gradient(ellipse at 50% 35%,#1a1430 0%,#0a0a0f 100%)', color: '#fff', fontFamily: "'Segoe UI',system-ui,sans-serif", display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <style>{`
        @keyframes sbFloat   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes sbSlideIn { from{opacity:0;transform:translateY(16px) scale(.94)} to{opacity:1;transform:translateY(0) scale(1)} }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', flexShrink: 0 }}>
        <button onClick={onExit} style={{ background: 'rgba(255,255,255,.07)', border: '1.5px solid rgba(255,255,255,.15)', color: '#fff', borderRadius: 10, padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          ← All Games
        </button>
        <div style={{ fontSize: 12, fontWeight: 700, background: 'rgba(139,92,246,.15)', border: '1px solid rgba(139,92,246,.35)', borderRadius: 20, padding: '5px 13px' }}>
          📖 Story Builder
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: '0 20px 30px' }}>
        <div style={{ animation: 'sbFloat 2.8s ease-in-out infinite' }}>
          <PandaMascot entered={true} mouthOpen={false} pandaState="happy" pxWidth={110}/>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, textAlign: 'center' }}>Choose a Story!</h1>

        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 780 }}>
          {STORIES.map((story, i) => (
            <button
              key={story.id}
              onClick={() => story.available && onSelect(story.id)}
              disabled={!story.available}
              style={{
                position: 'relative', width: 220, textAlign: 'left', cursor: story.available ? 'pointer' : 'not-allowed',
                background: story.available ? `${story.color}1f` : 'rgba(255,255,255,.03)',
                border: `2px solid ${story.available ? story.color + '60' : 'rgba(255,255,255,.08)'}`,
                borderRadius: 18, padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 8,
                opacity: story.available ? 1 : 0.5,
                animation: `sbSlideIn .4s ease ${i * .08}s both`,
              }}
            >
              {!story.available && (
                <div style={{ position: 'absolute', top: 12, right: 12, fontSize: 10, fontWeight: 700, background: 'rgba(0,0,0,.4)', borderRadius: 10, padding: '3px 9px', letterSpacing: .4, textTransform: 'uppercase' }}>
                  Coming Soon
                </div>
              )}
              <span style={{ fontSize: 34, filter: story.available ? 'none' : 'grayscale(.6)' }}>{story.emoji}</span>
              <div style={{ fontWeight: 800, fontSize: 15 }}>{story.title}</div>
              <div style={{ fontSize: 12.5, opacity: .65, lineHeight: 1.4 }}>{story.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
