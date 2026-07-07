import { useState, useRef } from 'react'
import OwnerPageShell from './OwnerPageShell'
import { getOwnerMenuItems } from './ownerSidebarConfig'

export default function OwnerSpeechToTextPage({ user, onLogout, betaTier }) {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState('')
  const recognitionRef = useRef(null)

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setError('Speech recognition is not supported in this browser.')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onresult = (e) => {
      const result = Array.from(e.results)
        .map(r => r[0].transcript)
        .join('')
      setTranscript(result)
    }

    recognition.onerror = (e) => {
      setError(`Error: ${e.error}`)
      setIsListening(false)
    }

    recognition.onend = () => setIsListening(false)

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
    setError('')
  }

  const stopListening = () => {
    recognitionRef.current?.stop()
    setIsListening(false)
  }

  const clearTranscript = () => setTranscript('')

  return (
    <OwnerPageShell
      user={user}
      onLogout={onLogout}
      title="Speech to Text"
      subtitle="Convert voice input into text using your microphone"
      icon="🎙️"
      menuItems={getOwnerMenuItems(betaTier)}
    >
      <div className="stt-container">
        <div className="stt-card">
          <div className="stt-status">
            <span className={`stt-indicator ${isListening ? 'listening' : ''}`} />
            <span className="stt-status-text">
              {isListening ? 'Listening...' : 'Ready'}
            </span>
          </div>

          <textarea
            className="stt-transcript"
            value={transcript}
            onChange={e => setTranscript(e.target.value)}
            placeholder="Your speech will appear here..."
            rows={8}
          />

          {error && <p className="stt-error">{error}</p>}

          <div className="stt-actions">
            {!isListening ? (
              <button className="stt-btn stt-btn-start" onClick={startListening}>
                🎤 Start Recording
              </button>
            ) : (
              <button className="stt-btn stt-btn-stop" onClick={stopListening}>
                ⏹ Stop Recording
              </button>
            )}
            <button className="stt-btn stt-btn-clear" onClick={clearTranscript} disabled={!transcript}>
              Clear
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .stt-container { padding: 8px 0; }
        .stt-card { background: #fff; border-radius: 12px; padding: 28px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
        .stt-status { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
        .stt-indicator { width: 12px; height: 12px; border-radius: 50%; background: #ccc; }
        .stt-indicator.listening { background: #e53935; animation: pulse 1s infinite; }
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }
        .stt-status-text { font-size: 14px; color: #6b7c75; font-weight: 500; }
        .stt-transcript { width: 100%; box-sizing: border-box; border: 1px solid #e0e0e0; border-radius: 8px; padding: 14px; font-size: 15px; resize: vertical; line-height: 1.6; color: #2c4a3e; outline: none; }
        .stt-transcript:focus { border-color: #4a6b5d; }
        .stt-error { color: #e53935; font-size: 13px; margin: 8px 0; }
        .stt-actions { display: flex; gap: 12px; margin-top: 16px; }
        .stt-btn { padding: 10px 24px; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background 0.2s; }
        .stt-btn-start { background: #4a6b5d; color: #fff; }
        .stt-btn-start:hover { background: #3d5a50; }
        .stt-btn-stop { background: #e53935; color: #fff; }
        .stt-btn-stop:hover { background: #c62828; }
        .stt-btn-clear { background: #f5f5f5; color: #555; }
        .stt-btn-clear:hover:not(:disabled) { background: #e0e0e0; }
        .stt-btn-clear:disabled { opacity: 0.4; cursor: not-allowed; }
      `}</style>
    </OwnerPageShell>
  )
}
