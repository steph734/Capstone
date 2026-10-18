import { Play, Volume2, VolumeX, LogOut } from 'lucide-react'

export default function PauseMenu({ sound, onResume, onToggleSound, onExit }) {
  return (
    <div className="er-overlay" role="dialog" aria-modal="true" aria-label="Game paused">
      <div className="er-modal er-pausebox">
        <h2>Paused</h2>
        <button type="button" className="er-big primary" onClick={onResume} autoFocus><Play size={22} aria-hidden="true" /> Resume</button>
        <button type="button" className="er-big" onClick={onToggleSound}>{sound ? <Volume2 size={22} aria-hidden="true" /> : <VolumeX size={22} aria-hidden="true" />} Sound {sound ? 'on' : 'off'}</button>
        <button type="button" className="er-big ghost" onClick={onExit}><LogOut size={22} aria-hidden="true" /> Exit</button>
      </div>
    </div>
  )
}
