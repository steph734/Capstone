import { useEffect, useState } from 'react'
import SortPlaceStartModal from '../../components/sortplace/SortPlaceStartModal'
import SortPlaceGame from '../../components/sortplace/SortPlaceGame'
import { useGameSession } from '../../hooks/useGameSession'

// Money Match: loads the game from the database, shows its start screen, plays
// it with the generic sort_place screen, and reports the finished game to Pao.
export default function MoneyMatchPage({ lang = 'en', onExit }) {
  const [game, setGame] = useState(null)
  const [error, setError] = useState('')
  const [started, setStarted] = useState(false)
  const gameSession = useGameSession({ gameName: 'Money Match' })

  useEffect(() => {
    let cancelled = false
    fetch('/api/games/by-name?name=' + encodeURIComponent('Money Match'))
      .then((r) => r.json().then((b) => ({ ok: r.ok, b })))
      .then(({ ok, b }) => { if (!cancelled) (ok ? setGame(b.game) : setError(b.error || 'Could not load Money Match.')) })
      .catch(() => { if (!cancelled) setError('Could not load Money Match.') })
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

  if (!game) {
    return <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#87ceeb] text-[18px] font-bold text-[#2B2A4C]">Loading Money Match…</div>
  }

  if (!started) {
    return <SortPlaceStartModal game={game} onStart={() => setStarted(true)} onCancel={onExit} />
  }

  return (
    <SortPlaceGame
      game={game}
      lang={lang}
      onExit={onExit}
      onFinish={(result) => { gameSession.finish(result) }}
    />
  )
}
