import { Play, RotateCcw, Volume2, VolumeX, LogOut } from 'lucide-react'

export default function PauseMenu({ sound, onResume, onRestart, onToggleSound, onExit }) {
  return (
    <div className="sh-overlay" role="dialog" aria-modal="true" aria-label="Game paused">
      <div className="sh-modal sh-pausebox">
        <h2>Paused</h2>
        <button type="button" className="sh-big primary" onClick={onResume} autoFocus><Play size={22} aria-hidden="true" /> Resume</button>
        <button type="button" className="sh-big" onClick={onRestart}><RotateCcw size={22} aria-hidden="true" /> Restart</button>
        <button type="button" className="sh-big" onClick={onToggleSound}>{sound ? <Volume2 size={22} aria-hidden="true" /> : <VolumeX size={22} aria-hidden="true" />} Sound {sound ? 'on' : 'off'}</button>
        <button type="button" className="sh-big ghost" onClick={onExit}><LogOut size={22} aria-hidden="true" /> Exit</button>
      </div>
    </div>
  )
}
