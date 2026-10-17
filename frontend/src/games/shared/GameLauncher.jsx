import { useEffect, useMemo } from 'react'
import { entryForCard } from './gameRegistry'
import GameLoadingModal from './loading/GameLoadingModal'
import useGameAssets, { isGameLoaded } from './loading/useGameAssets'

// Every game goes through here: start modal -> loading modal -> game.
// `card` is the game card the player picked. onLaunch(card) runs once everything is loaded (or was already loaded
// this session); onCancel() goes back to the games page.
export default function GameLauncher({ card, playerName, speak = true, onLaunch, onCancel }) {
  const entry = useMemo(() => entryForCard(card), [card])
  // Decided once per launch: a game that finishes loading while the modal is open must still show its "Let's go!" step.
  const cached = useMemo(() => Boolean(entry) && isGameLoaded(entry.slug), [entry])
  const assets = useGameAssets(entry, Boolean(card) && !cached)

  // Already loaded this session: no modal, straight into the game.
  useEffect(() => { if (card && cached) onLaunch(card) }, [card, cached]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!card || cached || !entry) return null
  return <GameLoadingModal game={entry} assets={assets} playerName={playerName} speak={speak} onStart={() => onLaunch(card)} onBack={onCancel} />
}
