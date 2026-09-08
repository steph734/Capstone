import { useMemo, useState } from 'react'
import OwnerPageShell from './OwnerPageShell'
import { getOwnerMenuItems } from './ownerSidebarConfig'
import './OwnerGamifiedSubpages.css'

const ACTIVITIES = [
  { id: 1, emoji: '🖼️', name: 'Picture-Word Matching', focus: 'Speech & language', ages: '4–8', status: 'live', desc: 'Match spoken words to pictures to build early vocabulary and listening.' },
  { id: 2, emoji: '🎵', name: 'Rhyme Time', focus: 'Speech & language', ages: '5–9', status: 'live', desc: 'Tap the picture that rhymes to strengthen phonological awareness.' },
  { id: 3, emoji: '🔤', name: 'Alphabet Blast', focus: 'Cognitive', ages: '4–7', status: 'live', desc: 'Pop letters in order for letter recognition and sequencing.' },
  { id: 4, emoji: '👂', name: 'Sound Hunt', focus: 'Attention / SEL', ages: '6–10', status: 'live', desc: 'Find the source of a sound to train auditory attention and focus.' },
  { id: 5, emoji: '🧩', name: 'Shape Sorter Sprint', focus: 'Fine motor', ages: '5–8', status: 'beta', desc: 'Drag shapes into slots against the clock for visual-motor control.' },
  { id: 6, emoji: '📖', name: 'Story Builder', focus: 'Cognitive', ages: '8–13', status: 'live', desc: 'Arrange story cards in order to practise narrative and comprehension.' },
  { id: 7, emoji: '🙂', name: 'Emoji Emotion Match', focus: 'Social skills', ages: '7–11', status: 'soon', desc: 'Match faces to feelings to grow emotional vocabulary and empathy.' },
  { id: 8, emoji: '🤸', name: 'Balance Bridge Builder', focus: 'Gross motor', ages: '9–13', status: 'soon', desc: 'Guided balance and crossing-midline movements with a camera prompt.' },
  { id: 9, emoji: '💨', name: 'Breath Balloon', focus: 'Sensory processing', ages: '5–12', status: 'beta', desc: 'Paced breathing game for self-regulation and calm-down routines.' },
]

const FOCUS_FILTERS = ['All', ...Array.from(new Set(ACTIVITIES.map((a) => a.focus)))]

const STATUS_LABEL = { live: 'Live', beta: 'Beta', soon: 'Coming soon' }

export default function OwnerActivityLibraryPage({ user, onLogout, betaTier }) {
  const [search, setSearch] = useState('')
  const [focus, setFocus] = useState('All')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return ACTIVITIES.filter((a) => {
      const matchesSearch =
        !q || a.name.toLowerCase().includes(q) || a.desc.toLowerCase().includes(q)
      const matchesFocus = focus === 'All' || a.focus === focus
      return matchesSearch && matchesFocus
    })
  }, [search, focus])

  return (
    <OwnerPageShell
      user={user}
      onLogout={onLogout}
      title="Gamified Activities"
      subtitle="Track patient engagement with gamified exercises across all branches"
      menuItems={getOwnerMenuItems(betaTier)}
      beta
    >
      <div className="ogs-head">
        <div>
          <h2>Activity Library</h2>
          <p>Every gamified activity available to therapists across your clinic.</p>
        </div>
      </div>

      <div className="ogs-lib-toolbar">
        <input
          className="ogs-lib-search"
          placeholder="Search activities…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="ogs-lib-filter" value={focus} onChange={(e) => setFocus(e.target.value)}>
          {FOCUS_FILTERS.map((f) => (
            <option key={f} value={f}>{f === 'All' ? 'All skill areas' : f}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="ogs-card">No activities match your search.</div>
      ) : (
        <div className="ogs-lib-grid">
          {filtered.map((a) => (
            <article key={a.id} className="ogs-lib-card">
              <span className="ogs-lib-emoji">{a.emoji}</span>
              <span className="ogs-lib-name">{a.name}</span>
              <p className="ogs-lib-desc">{a.desc}</p>
              <div className="ogs-lib-tags">
                <span className="ogs-lib-tag">{a.focus}</span>
                <span className="ogs-lib-tag">Ages {a.ages}</span>
                <span className={`ogs-lib-tag status-${a.status}`}>{STATUS_LABEL[a.status]}</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </OwnerPageShell>
  )
}
