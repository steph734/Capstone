import { useState, useRef } from 'react'
import PatientSidebar from '../components/PatientSidebar'
import './PageWithSidebar.css'

export default function PatientSpeechToTextPage({ user, onLogout, betaTier }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState('')
  const recognitionRef = useRef(null)

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) { setError('Speech recognition is not supported in this browser.'); return }
    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.continuous = true
    recognition.interimResults = true
    recognition.onresult = (e) => {
      setTranscript(Array.from(e.results).map(r => r[0].transcript).join(''))
    }
    recognition.onerror = (e) => { setError(`Error: ${e.error}`); setIsListening(false) }
    recognition.onend = () => setIsListening(false)
    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
    setError('')
  }

  const stopListening = () => { recognitionRef.current?.stop(); setIsListening(false) }

  return (
    <div className="page-with-sidebar">
      <PatientSidebar
        user={user}
        onLogout={onLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        betaTier={betaTier}
      />
      <main className="page-content">
        <button className="mobile-menu-toggle" onClick={() => setSidebarOpen(true)} aria-label="Open menu">☰</button>
        <div style={{ padding: '32px 24px' }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#2c4a3e', marginBottom: 6 }}>Speech to Text</h1>
          <p style={{ color: '#6b7c75', marginBottom: 24 }}>Convert voice input into text using your microphone</p>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', maxWidth: 700 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: isListening ? '#e53935' : '#ccc', display: 'inline-block' }} />
              <span style={{ fontSize: 14, color: '#6b7c75', fontWeight: 500 }}>{isListening ? 'Listening...' : 'Ready'}</span>
            </div>
            <textarea
              value={transcript}
              onChange={e => setTranscript(e.target.value)}
              placeholder="Your speech will appear here..."
              rows={8}
              style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #e0e0e0', borderRadius: 8, padding: 14, fontSize: 15, resize: 'vertical', lineHeight: 1.6, color: '#2c4a3e', outline: 'none' }}
            />
            {error && <p style={{ color: '#e53935', fontSize: 13, margin: '8px 0' }}>{error}</p>}
            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
              {!isListening ? (
                <button onClick={startListening} style={{ padding: '10px 24px', background: '#4a6b5d', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>🎤 Start Recording</button>
              ) : (
                <button onClick={stopListening} style={{ padding: '10px 24px', background: '#e53935', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>⏹ Stop Recording</button>
              )}
              <button onClick={() => setTranscript('')} disabled={!transcript} style={{ padding: '10px 24px', background: '#f5f5f5', color: '#555', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', opacity: transcript ? 1 : 0.4 }}>Clear</button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
