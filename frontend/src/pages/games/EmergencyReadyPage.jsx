import { useEffect, useState } from 'react'
import EmergencyReady from '../../components/emergency-ready/EmergencyReady.jsx'
import { EmergencyStartModal } from '../../components/emergency-ready/EmergencyReadyModals'
import { buildEmergencies } from '../../components/emergency-ready/emergencyReady'
import { useGameSession } from '../../hooks/useGameSession'

const PREVIEW = {
  name: 'Emergency Ready',
  description: 'Learn what to do for six emergencies: earthquake, fire, typhoon, flood, tsunami and volcano.',
  pointsPerPlay: 150,
  type_settings: { step_by_step: { emergencies: [] } },
}

// Emergency Ready: loads the game from the database, shows its start screen,
// then plays the pick-an-emergency flow and reports each finished
// emergency to Pao.
export default function EmergencyReadyPage({ lang = 'en', onExit }) {
  const [game, setGame] = useState(null)
  const [error, setError] = useState('')
  const [started, setStarted] = useState(false)
  const gameSession = useGameSession({ gameName: 'Emergency Ready' })

  useEffect(() => {
    let cancelled = false
    fetch('/api/games/by-name?name=' + encodeURIComponent('Emergency Ready'))
      .then((r) => r.json().then((b) => ({ ok: r.ok, b })))
      .then(({ ok, b }) => { if (!cancelled) (ok ? setGame(b.game) : setError(b.error || 'Could not load Emergency Ready.')) })
      .catch(() => { if (!cancelled) setError('Could not load Emergency Ready.') })
    return () => { cancelled = true }
  }, [])

  if (error) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-4 bg-[#87ceeb] p-6 text-center" style={{ fontFamily: "'Atkinson Hyperlegible', system-ui, sans-serif" }}>
        <p className="text-[18px] font-bold text-[#2B2A4C]">{error}</p>
        <button type="button" onClick={onExit} className="h-14 rounded-2xl bg-[#F59E0B] px-8 text-[18px] font-extrabold text-[#2B2A4C]">Back to games</button>
      </div>
    )
  }

  if (!started) {
    const shown = game || PREVIEW
    return (
      <EmergencyStartModal
        game={shown}
        emergencies={buildEmergencies(shown)}
        ready={!!game}
        onStart={() => setStarted(true)}
        onCancel={onExit}
      />
    )
  }

  if (!game) return null

  return (
    <EmergencyReady
      game={game}
      lang={lang}
      onExit={onExit}
      onComplete={(result) => { gameSession.finish(result) }}
    />
  )
}
