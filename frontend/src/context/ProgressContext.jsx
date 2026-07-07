import { createContext, useContext, useState, useEffect } from 'react'

// Bumped to v2 so browsers with old cached progress (pre level/stats reset)
// automatically pick up the fresh baseline instead of keeping stale data.
const STORAGE_KEY = 'tp_shared_progress_v2'

const STAT_KEYS = ['intelligence', 'focus', 'resistance', 'creativity', 'speed', 'memory']
const DOMAIN_PRIMARY_STATS = {
  Cognitive: ['intelligence', 'memory', 'focus'],
  Physical: ['resistance', 'speed'],
  Occupational: ['focus', 'creativity'],
  Speech: ['creativity', 'memory'],
}

// Demo progress data for the shared demo patient (Alvrin) — mirrors the
// single-thread simplification used by MessagesContext.
const INITIAL_PROGRESS = {
  patientName: 'Alvrin',
  level: 1,
  xp: 0,
  xpNeeded: 100,
  characterStats: { intelligence: 5, focus: 5, resistance: 5, creativity: 5, speed: 5, memory: 5 },
  badges: [
    { id: 'b1', label: 'Focus Master',  icon: '🎯', dateEarned: 'Jul 5, 2026', isNew: true },
    { id: 'b2', label: 'Word Wizard',   icon: '📚', dateEarned: 'Jun 29, 2026', isNew: false },
    { id: 'b3', label: '5-Day Streak',  icon: '🔥', dateEarned: 'Jun 20, 2026', isNew: false },
    { id: 'b4', label: 'Balance Buddy', icon: '🤸', dateEarned: 'Jun 10, 2026', isNew: false },
  ],
  domainEngagement: { cognitive: 72, physical: 45, occupational: 58, speech: 66 },
  weekly: {
    sessionsCompleted: 3, minutesPlayed: 95, gamesCompleted: 12, gamesCompletedPrev: 9,
    domainsPracticed: ['Cognitive', 'Speech'],
  },
  monthly: {
    sessionsCompleted: 11, minutesPlayed: 410, gamesCompleted: 46, gamesCompletedPrev: 38,
    domainsPracticed: ['Cognitive', 'Physical', 'Speech'],
  },
  personalBest: { label: 'Games completed in a week', best: 9, current: 12 },
  streak: { current: 5, longest: 8, last7Days: [true, true, false, true, true, true, true] },
  goals: [
    { id: 'g1', text: 'Practicing balance and coordination this month', domain: 'Physical' },
    { id: 'g2', text: 'Building bigger sentences during story time', domain: 'Speech' },
    { id: 'g3', text: 'Trying puzzles that need extra focus', domain: 'Cognitive' },
  ],
  sharedNotes: [
    { id: 'sn-n0a', date: 'Jun 30, 2026', domain: 'Physical', summary: 'Getting stronger every session — Alvrin is showing great improvement with balance and coordination!' },
  ],
  exercises: [
    { id: 'e1', title: 'Memory Match', domain: 'Cognitive', instructions: 'Play 3 rounds together, about 5 minutes each.', due: 'Today', status: 'Assigned' },
  ],
}

function loadProgress() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return JSON.parse(saved)
  } catch {}
  localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_PROGRESS))
  return INITIAL_PROGRESS
}

const ProgressCtx = createContext(null)

export function ProgressProvider({ children }) {
  const [progress, setProgress] = useState(loadProgress)

  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try { setProgress(JSON.parse(e.newValue)) } catch {}
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const persist = (next) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    return next
  }

  const update = (fn) => setProgress((prev) => persist(fn(prev)))

  const dismissNewBadge = (id) => update((prev) => ({
    ...prev,
    badges: prev.badges.map((b) => (b.id === id ? { ...b, isNew: false } : b)),
  }))

  const shareNote = (note) => update((prev) => ({
    ...prev,
    sharedNotes: [{ id: note.id || `sn${Date.now()}`, ...note }, ...prev.sharedNotes],
  }))

  const unshareNote = (id) => update((prev) => ({
    ...prev,
    sharedNotes: prev.sharedNotes.filter((n) => n.id !== id),
  }))

  const addExercise = (exercise) => update((prev) => ({
    ...prev,
    exercises: [{ id: `e${Date.now()}`, status: 'Assigned', ...exercise }, ...prev.exercises],
  }))

  const markExerciseDone = (id) => update((prev) => ({
    ...prev,
    exercises: prev.exercises.map((ex) => (ex.id === id ? { ...ex, status: 'Done' } : ex)),
  }))

  const removeExercise = (id) => update((prev) => ({
    ...prev,
    exercises: prev.exercises.filter((ex) => ex.id !== id),
  }))

  // Called by AnalyticsContext once a played session has been aggregated,
  // so real gameplay actually moves the parent-facing snapshot numbers.
  const recordGameSession = ({ domain, accuracy, durationMinutes = 0 }) => update((prev) => {
    const domainKey = domain.toLowerCase()
    const bumpPeriod = (period) => ({
      ...period,
      gamesCompleted: period.gamesCompleted + 1,
      minutesPlayed: period.minutesPlayed + durationMinutes,
      domainsPracticed: period.domainsPracticed.includes(domain)
        ? period.domainsPracticed
        : [...period.domainsPracticed, domain],
    })

    // Flat +100 XP per game finished; level up (possibly more than once) when
    // XP crosses the threshold for the current level.
    let xp = prev.xp + 100
    let level = prev.level
    let xpNeeded = prev.xpNeeded
    while (xp >= xpNeeded) {
      xp -= xpNeeded
      level += 1
      xpNeeded = level * 100
    }

    // Character stats grow with performance: the stats most relevant to this
    // domain get the full performance-scaled gain, the rest a smaller passive
    // gain for just showing up. Capped at 100.
    const primaryStats = DOMAIN_PRIMARY_STATS[domain] || []
    const primaryGain = Math.max(1, Math.round(accuracy / 20))
    const passiveGain = Math.max(1, Math.round(primaryGain / 2))
    const characterStats = { ...prev.characterStats }
    STAT_KEYS.forEach((key) => {
      const gain = primaryStats.includes(key) ? primaryGain : passiveGain
      characterStats[key] = Math.min(100, characterStats[key] + gain)
    })

    return {
      ...prev,
      level,
      xp,
      xpNeeded,
      characterStats,
      domainEngagement: { ...prev.domainEngagement, [domainKey]: Math.round(accuracy) },
      weekly: bumpPeriod(prev.weekly),
      monthly: bumpPeriod(prev.monthly),
    }
  })

  return (
    <ProgressCtx.Provider value={{
      progress,
      dismissNewBadge,
      shareNote,
      unshareNote,
      addExercise,
      markExerciseDone,
      removeExercise,
      recordGameSession,
    }}>
      {children}
    </ProgressCtx.Provider>
  )
}

export const useSharedProgress = () => useContext(ProgressCtx)
