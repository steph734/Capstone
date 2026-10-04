import { useEffect, useState } from 'react'
import DailyRoutines from '../../components/daily-routines/DailyRoutines'
import { DailyRoutinesStartModal } from '../../components/daily-routines/DailyRoutinesModals'
import { useGameSession } from '../../hooks/useGameSession'

// Shown straight away while the database record loads, so there is no blank wait.
const PREVIEW = {
  name: 'Daily Routines',
  description: 'Put the pictures of everyday routines in the right order.',
  pointsPerPlay: 100,
  color: '#16a34a',
  type_settings: { step_by_step: { tasks: [] } },
}

// Daily Routines: loads the game from the database, shows its start screen,
// lets the player pick a task, and reports each finished task to Pao.
export default function DailyRoutinesPage({ lang = 'en', patientAge = null, onExit }) {
  const [game, setGame] = useState(null)
  const [error, setError] = useState('')
  const [started, setStarted] = useState(false)
  const gameSession = useGameSession({ gameName: 'Daily Routines' })

  useEffect(() => {
    let cancelled = false
    fetch('/api/games/by-name?name=' + encodeURIComponent('Daily Routines'))
      .then((r) => r.json().then((b) => ({ ok: r.ok, b })))
      .then(({ ok, b }) => { if (!cancelled) (ok ? setGame(b.game) : setError(b.error || 'Could not load Daily Routines.')) })
      .catch(() => { if (!cancelled) setError('Could not load Daily Routines.') })
    return () => { cancelled = true }
  }, [])

  if (error) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-4 bg-[#87ceeb] p-6 text-center" style={{ fontFamily: "'Atkinson Hyperlegible', system-ui, sans-serif" }}>
        <p className="text-[18px] font-bold text-[#2B2A4C]">{error}</p>
        <button type="button" onClick={onExit} className="h-14 rounded-2xl bg-[#F59E0B] px-8 text-[18px] font-extrabold text-[#2B2A4C] focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6]">Back to games</button>
      </div>
    )
  }

  if (!started) {
    return (
      <DailyRoutinesStartModal
        game={game || PREVIEW}
        ready={!!game}
        onStart={() => setStarted(true)}
        onCancel={onExit}
      />
    )
  }

  if (!game) return null

  return (
    <DailyRoutines
      game={game}
      lang={lang}
      patientAge={patientAge}
      onExit={onExit}
      onTaskComplete={(result) => { gameSession.finish(result) }}
    />
  )
}
