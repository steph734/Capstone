import './plan/plan.css'
import { useEffect, useMemo, useState } from 'react'
import { Lock } from 'lucide-react'
import { entryForCard } from './gameRegistry'
import GameLoadingModal from './loading/GameLoadingModal'
import useGameAssets, { isGameLoaded } from './loading/useGameAssets'

const LOCK_TEXT = {
  not_assigned: 'This game is not in today\'s plan. Ask your therapist to add it.',
  not_started: 'Play time has not started yet.',
  paused: 'Play time is paused. Your therapist will start it again.',
  time_over: 'Play time is over. Great playing today!',
  no_plan: 'No games today yet. Your therapist will pick them during your session.',
}

// Every game goes through here: access check -> loading modal -> game.
// `card` is the game card the player picked. `check(card)` (optional) asks the server whether the game is open
// right now and throws an error with `.data.reason` when it is locked. onLaunch(card) runs once everything is
// loaded (or was already loaded this session); onCancel() goes back to the games page.
export default function GameLauncher({ card, playerName, speak = true, check, onLaunch, onCancel }) {
  const entry = useMemo(() => entryForCard(card), [card])
  // Decided once per launch: a game that finishes loading while the modal is open must still show its "Let's go!" step.
  const cached = useMemo(() => Boolean(entry) && isGameLoaded(entry.slug), [entry])
  const [access, setAccess] = useState(check ? 'checking' : 'ok') // checking | ok | locked
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (!card || !check) return undefined
    let alive = true
    setAccess('checking')
    check(card).then(() => { if (alive) setAccess('ok') }).catch((e) => {
      if (!alive) return
      if (e?.data?.code === 'GAME_LOCKED') { setReason(e.data.reason); setAccess('locked') } else setAccess('ok') // a network blip must not lock the child out; the server still guards the session start
    })
    return () => { alive = false }
  }, [card, check])

  const ready = access === 'ok'
  const assets = useGameAssets(entry, Boolean(card) && ready && !cached)

  // Already loaded this session: no modal, straight into the game.
  useEffect(() => { if (card && cached && ready) onLaunch(card) }, [card, cached, ready]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!card || !entry) return null
  if (access === 'locked') {
    return (
      <div className="pl-over" role="alertdialog" aria-modal="true" aria-label="Game locked">
        <div>
          <Lock size={44} color="#51647a" aria-hidden="true" />
          <h2>{entry.name} is locked</h2>
          <p>{LOCK_TEXT[reason] || LOCK_TEXT.not_assigned}</p>
          <button type="button" onClick={onCancel} autoFocus>Back to games</button>
        </div>
      </div>
    )
  }
  if (!ready || cached) return null
  return <GameLoadingModal game={entry} assets={assets} playerName={playerName} speak={speak} onStart={() => onLaunch(card)} onBack={onCancel} />
}
