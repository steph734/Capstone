import { Play, RotateCcw, Volume2, VolumeX, LogOut } from 'lucide-react'

export default function PauseMenu({ sound, onResume, onRestart, onToggleSound, onExit }) {
  return (
    <div className="ab-overlay" role="dialog" aria-modal="true" aria-label="Game paused">
      <div className="ab-card ab-pause">
        <h2>Paused</h2>
        <button type="button" className="ab-big primary" onClick={onResume} autoFocus><Play size={24} aria-hidden="true" /> Resume</button>
        <button type="button" className="ab-big" onClick={onRestart}><RotateCcw size={24} aria-hidden="true" /> Restart</button>
        <button type="button" className="ab-big" onClick={onToggleSound}>{sound ? <Volume2 size={24} aria-hidden="true" /> : <VolumeX size={24} aria-hidden="true" />} Sound {sound ? 'on' : 'off'}</button>
        <button type="button" className="ab-big ghost" onClick={onExit}><LogOut size={24} aria-hidden="true" /> Exit</button>
      </div>
    </div>
  )
}
