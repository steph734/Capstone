import { useState } from 'react'
import OwnerPageShell from './OwnerPageShell'
import { getOwnerMenuItems } from './ownerSidebarConfig'

export default function OwnerTextToSpeechPage({ user, onLogout, betaTier }) {
  const [text, setText] = useState('')
  const [rate, setRate] = useState(1)
  const [pitch, setPitch] = useState(1)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [error, setError] = useState('')

  const handleSpeak = () => {
    if (!text.trim()) return
    if (!window.speechSynthesis) {
      setError('Text-to-speech is not supported in this browser.')
      return
    }

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = rate
    utterance.pitch = pitch
    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => { setIsSpeaking(false); setError('Speech synthesis error.') }
    window.speechSynthesis.speak(utterance)
    setError('')
  }

  const handleStop = () => {
    window.speechSynthesis?.cancel()
    setIsSpeaking(false)
  }

  return (
    <OwnerPageShell
      user={user}
      onLogout={onLogout}
      title="Text to Speech"
      subtitle="Convert written text into spoken audio"
      icon="🔊"
      menuItems={getOwnerMenuItems(betaTier)}
    >
      <div className="tts-container">
        <div className="tts-card">
          <textarea
            className="tts-input"
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Type or paste text here to convert to speech..."
            rows={7}
          />

          <div className="tts-controls">
            <div className="tts-control-group">
              <label>Speed: {rate.toFixed(1)}x</label>
              <input type="range" min="0.5" max="2" step="0.1" value={rate}
                onChange={e => setRate(parseFloat(e.target.value))} />
            </div>
            <div className="tts-control-group">
              <label>Pitch: {pitch.toFixed(1)}</label>
              <input type="range" min="0" max="2" step="0.1" value={pitch}
                onChange={e => setPitch(parseFloat(e.target.value))} />
            </div>
          </div>

          {error && <p className="tts-error">{error}</p>}

          <div className="tts-actions">
            {!isSpeaking ? (
              <button className="tts-btn tts-btn-speak" onClick={handleSpeak} disabled={!text.trim()}>
                🔊 Speak
              </button>
            ) : (
              <button className="tts-btn tts-btn-stop" onClick={handleStop}>
                ⏹ Stop
              </button>
            )}
            <button className="tts-btn tts-btn-clear" onClick={() => setText('')} disabled={!text}>
              Clear
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .tts-container { padding: 8px 0; }
        .tts-card { background: #fff; border-radius: 12px; padding: 28px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
        .tts-input { width: 100%; box-sizing: border-box; border: 1px solid #e0e0e0; border-radius: 8px; padding: 14px; font-size: 15px; resize: vertical; line-height: 1.6; color: #2c4a3e; outline: none; }
        .tts-input:focus { border-color: #4a6b5d; }
        .tts-controls { display: flex; gap: 32px; margin-top: 20px; flex-wrap: wrap; }
        .tts-control-group { display: flex; flex-direction: column; gap: 6px; min-width: 180px; }
        .tts-control-group label { font-size: 13px; font-weight: 600; color: #4a6b5d; }
        .tts-control-group input[type=range] { accent-color: #4a6b5d; }
        .tts-error { color: #e53935; font-size: 13px; margin: 8px 0; }
        .tts-actions { display: flex; gap: 12px; margin-top: 20px; }
        .tts-btn { padding: 10px 24px; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background 0.2s; }
        .tts-btn-speak { background: #4a6b5d; color: #fff; }
        .tts-btn-speak:hover:not(:disabled) { background: #3d5a50; }
        .tts-btn-speak:disabled { opacity: 0.4; cursor: not-allowed; }
        .tts-btn-stop { background: #e53935; color: #fff; }
        .tts-btn-stop:hover { background: #c62828; }
        .tts-btn-clear { background: #f5f5f5; color: #555; }
        .tts-btn-clear:hover:not(:disabled) { background: #e0e0e0; }
        .tts-btn-clear:disabled { opacity: 0.4; cursor: not-allowed; }
      `}</style>
    </OwnerPageShell>
  )
}
