import { Home, Play, RotateCcw } from 'lucide-react'

export default function PauseMenu({ onResume, onRestart, onExit }) {
  return (
    <div className="ab-overlay" role="dialog" aria-modal="true" aria-label="Game paused">
      <div className="ab-card ab-pause">
        <h2>Paused</h2>
        <button type="button" className="ab-big green" onClick={onResume} autoFocus><Play size={24} aria-hidden="true" /> Resume</button>
        <button type="button" className="ab-big" onClick={onRestart}><RotateCcw size={22} aria-hidden="true" /> Restart</button>
        <button type="button" className="ab-big light" onClick={onExit}><Home size={22} aria-hidden="true" /> Back to games</button>
      </div>
    </div>
  )
}
