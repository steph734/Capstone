import { useEffect, useState } from 'react'
import GamePlayer from './admin/builder/Player'
import { useGameSession } from '../hooks/useGameSession'

// Plays a game made in the Game Builder: loads its document by name and runs
// it with the same player the Super Admin's Test play uses. The result goes
// through useGameSession, which only records anything when a real player is
// attached (a patient, or a therapist's chosen patient) — practice mode and
// previews record nothing.
export default function BuilderGamePage({ gameName, lang = 'en', onExit }) {
  const [game, setGame] = useState(null)
  const [error, setError] = useState('')
  const session = useGameSession({ gameName })

  useEffect(() => {
    let cancelled = false
    fetch(`/api/games/by-name?name=${encodeURIComponent(gameName)}`)
      .then((r) => r.json().then((b) => ({ ok: r.ok, b })))
      .then(({ ok, b }) => {
        if (cancelled) return
        if (!ok) setError(b.error || 'Could not load this game.')
        else if (!b.game?.builder?.doc?.levels?.length) setError('This game is not ready to play yet.')
        else setGame(b.game)
      })
      .catch(() => { if (!cancelled) setError('Could not load this game.') })
    return () => { cancelled = true }
  }, [gameName])

  const shell = { position: 'fixed', inset: 0, zIndex: 9999, background: 'linear-gradient(180deg,#56b8ee 0%,#7dd0f5 55%,#bdeafd 100%)', fontFamily: "'Atkinson Hyperlegible','Segoe UI',system-ui,sans-serif" }
  if (error || !game) {
    return (
      <div style={{ ...shell, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, textAlign: 'center' }}>
        <p style={{ fontSize: 20, fontWeight: 800, color: '#2B2A4C' }}>{error || 'Loading…'}</p>
        {error && <button type="button" onClick={onExit} style={{ minHeight: 56, border: 'none', borderRadius: 16, background: '#F59E0B', color: '#2B2A4C', fontWeight: 800, fontSize: 18, padding: '0 28px', cursor: 'pointer' }}>Back to games</button>}
      </div>
    )
  }
  return (
    <div style={shell}>
      <button type="button" onClick={onExit} aria-label="Back to games" style={{ position: 'absolute', top: 12, left: 12, zIndex: 20, minHeight: 48, border: 'none', borderRadius: 14, background: 'rgba(255,255,255,.9)', color: '#2B2A4C', fontWeight: 800, fontSize: 16, padding: '0 18px', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,.2)' }}>← Back</button>
      <GamePlayer doc={game.builder.doc} language={lang} device="fill" onFinish={(result) => { session.finish(result) }} onExit={onExit} finishLabel="Back to games" />
    </div>
  )
}
