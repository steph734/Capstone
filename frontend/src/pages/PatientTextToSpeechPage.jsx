import { useState } from 'react'
import PatientSidebar from '../components/PatientSidebar'
import './PageWithSidebar.css'

export default function PatientTextToSpeechPage({ user, onLogout, betaTier }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [text, setText] = useState('')
  const [rate, setRate] = useState(1)
  const [pitch, setPitch] = useState(1)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [error, setError] = useState('')

  const handleSpeak = () => {
    if (!text.trim()) return
    if (!window.speechSynthesis) { setError('Text-to-speech is not supported in this browser.'); return }
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
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#2c4a3e', marginBottom: 6 }}>Text to Speech</h1>
          <p style={{ color: '#6b7c75', marginBottom: 24 }}>Convert written text into spoken audio</p>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', maxWidth: 700 }}>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Type or paste text here to convert to speech..."
              rows={7}
              style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #e0e0e0', borderRadius: 8, padding: 14, fontSize: 15, resize: 'vertical', lineHeight: 1.6, color: '#2c4a3e', outline: 'none' }}
            />
            <div style={{ display: 'flex', gap: 32, marginTop: 20, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#4a6b5d' }}>Speed: {rate.toFixed(1)}x</label>
                <input type="range" min="0.5" max="2" step="0.1" value={rate} onChange={e => setRate(parseFloat(e.target.value))} style={{ accentColor: '#4a6b5d' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#4a6b5d' }}>Pitch: {pitch.toFixed(1)}</label>
                <input type="range" min="0" max="2" step="0.1" value={pitch} onChange={e => setPitch(parseFloat(e.target.value))} style={{ accentColor: '#4a6b5d' }} />
              </div>
            </div>
            {error && <p style={{ color: '#e53935', fontSize: 13, margin: '8px 0' }}>{error}</p>}
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              {!isSpeaking ? (
                <button onClick={handleSpeak} disabled={!text.trim()} style={{ padding: '10px 24px', background: '#4a6b5d', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', opacity: text.trim() ? 1 : 0.4 }}>🔊 Speak</button>
              ) : (
                <button onClick={() => { window.speechSynthesis?.cancel(); setIsSpeaking(false) }} style={{ padding: '10px 24px', background: '#e53935', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>⏹ Stop</button>
              )}
              <button onClick={() => setText('')} disabled={!text} style={{ padding: '10px 24px', background: '#f5f5f5', color: '#555', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', opacity: text ? 1 : 0.4 }}>Clear</button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
