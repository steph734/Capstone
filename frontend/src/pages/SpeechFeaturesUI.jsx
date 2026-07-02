import { useState, useRef, useEffect } from 'react'

// ─── Icons ────────────────────────────────────────────────────────────────────

function MicIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="white">
      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
    </svg>
  )
}

function SpeakerIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="white">
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77 0-4.28-2.99-7.86-7-8.77z"/>
    </svg>
  )
}

function StopIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="white">
      <rect x="6" y="6" width="12" height="12" rx="2"/>
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z"/>
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1zM18 7H6v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7z"/>
    </svg>
  )
}

function FolderIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
    </svg>
  )
}

// ─── Waveform ─────────────────────────────────────────────────────────────────

const BAR_COLORS = [
  '#a78bfa','#818cf8','#60a5fa','#34d399','#fbbf24',
  '#f87171','#c084fc','#38bdf8','#4ade80','#fb923c',
  '#a78bfa','#818cf8','#60a5fa','#34d399','#fbbf24',
  '#f87171','#c084fc','#38bdf8','#4ade80','#fb923c',
  '#a78bfa','#818cf8','#60a5fa','#34d399','#fbbf24',
  '#f87171','#c084fc','#38bdf8',
]

function Waveform({ active }) {
  return (
    <div className="csf-waveform">
      {Array.from({ length: 28 }).map((_, i) => (
        <div
          key={i}
          className={`csf-bar ${active ? 'csf-bar-active' : ''}`}
          style={{ '--bar-color': BAR_COLORS[i], animationDelay: `${(i % 7) * 0.11}s` }}
        />
      ))}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(s) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

function formatDateTime(date) {
  return (
    date.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
    + ' · '
    + date.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true })
  )
}

// ─── Recordings Modal ─────────────────────────────────────────────────────────

function RecordingsModal({ recordings, playingId, onPlay, onDelete, onClearAll, onClose }) {
  // close on backdrop click
  const handleBackdrop = (e) => { if (e.target === e.currentTarget) onClose() }

  return (
    <div className="rec-modal-backdrop" onClick={handleBackdrop}>
      <div className="rec-modal">
        {/* Modal header */}
        <div className="rec-modal-header">
          <div className="rec-modal-title">
            🗂️ My Recordings
            <span className="rec-count-badge">{recordings.length}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {recordings.length > 0 && (
              <button className="rec-clear-all-btn" onClick={onClearAll}>🗑️ Clear All</button>
            )}
            <button className="rec-modal-close" onClick={onClose}><CloseIcon /></button>
          </div>
        </div>

        {/* Modal body */}
        <div className="rec-modal-body">
          {recordings.length === 0 ? (
            <div className="rec-empty">
              <span className="rec-empty-icon">🎙️</span>
              <p>No recordings yet!<br />Tap the mic to make your first recording.</p>
            </div>
          ) : (
            <div className="rec-list">
              {recordings.map((rec, idx) => {
                const isPlaying = playingId === rec.id
                return (
                  <div key={rec.id} className="rec-card">
                    <div className="rec-card-top">
                      <div className="rec-index-badge">#{recordings.length - idx}</div>
                      <div className="rec-meta">
                        <span className="rec-date">🗓️ {formatDateTime(rec.date)}</span>
                        <span className="rec-duration">⏱️ {formatTime(rec.duration)}</span>
                      </div>
                      <button className="rec-delete-btn" onClick={() => onDelete(rec.id)} title="Delete">
                        <TrashIcon />
                      </button>
                    </div>

                    {rec.transcript ? (
                      <div className="rec-transcript">
                        <span className="rec-transcript-label">📝 Transcript</span>
                        <p className="rec-transcript-text">"{rec.transcript}"</p>
                      </div>
                    ) : (
                      <p className="rec-no-transcript">🤔 No speech detected</p>
                    )}

                    <div className="rec-audio-row">
                      <button
                        className={`rec-play-btn ${isPlaying ? 'rec-play-btn-active' : ''}`}
                        onClick={() => onPlay(rec)}
                      >
                        {isPlaying ? <PauseIcon /> : <PlayIcon />}
                        <span>{isPlaying ? 'Pause' : 'Play Recording'}</span>
                      </button>
                      {isPlaying && (
                        <div className="rec-playing-indicator">
                          <span className="rec-dot" /><span className="rec-dot" /><span className="rec-dot" />
                          <span style={{ marginLeft: 6, fontSize: 12, color: '#6366f1', fontWeight: 700 }}>Playing...</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

const TTS_HINTS = [
  'Write something and I\'ll say it! 🗣️',
  'Your words, out loud! 🎶',
  'Write words, hear them come alive! 🌈',
]

export default function SpeechFeaturesUI() {
  const [activeTab, setActiveTab] = useState('stt')
  const [showModal, setShowModal] = useState(false)

  // ── STT state ──
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [sttError, setSttError] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [recordings, setRecordings] = useState([])
  const [playingId, setPlayingId] = useState(null)

  const recognitionRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const streamRef = useRef(null)
  const audioChunksRef = useRef([])
  const timerRef = useRef(null)
  const transcriptRef = useRef('')
  const elapsedRef = useRef(0)
  const playingAudioRef = useRef(null)

  // ── TTS state ──
  const [ttsText, setTtsText] = useState('')
  const [rate, setRate] = useState(1)
  const [pitch, setPitch] = useState(1.2)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [ttsError, setTtsError] = useState('')

  useEffect(() => { transcriptRef.current = transcript }, [transcript])

  useEffect(() => {
    if (isListening) {
      timerRef.current = setInterval(() => {
        setElapsed(e => { const n = e + 1; elapsedRef.current = n; return n })
      }, 1000)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [isListening])

  useEffect(() => {
    return () => {
      recordings.forEach(r => URL.revokeObjectURL(r.audioUrl))
      playingAudioRef.current?.pause()
    }
  }, [])

  // ── Start recording ──
  const startListening = async () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { setSttError('❌ Use Google Chrome for speech recognition!'); return }

    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setSttError('🎤 Microphone denied! Click the 🔒 lock icon in the address bar and allow microphone.')
      return
    }
    streamRef.current = stream

    const mediaRecorder = new MediaRecorder(stream)
    audioChunksRef.current = []
    mediaRecorderRef.current = mediaRecorder

    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
    mediaRecorder.onstop = () => {
      const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
      const audioUrl = URL.createObjectURL(blob)
      setRecordings(prev => [{
        id: Date.now(),
        date: new Date(),
        transcript: transcriptRef.current,
        audioUrl,
        duration: elapsedRef.current,
      }, ...prev])
      streamRef.current?.getTracks().forEach(t => t.stop())
    }

    const recognition = new SR()
    recognition.lang = 'en-US'; recognition.continuous = true; recognition.interimResults = true
    recognition.onresult = (e) => {
      const text = Array.from(e.results).map(r => r[0].transcript).join('')
      setTranscript(text); transcriptRef.current = text
    }
    recognition.onerror = (e) => { if (e.error !== 'no-speech') setSttError(`Oops! ${e.error} 😅`); setIsListening(false) }
    recognition.onend = () => setIsListening(false)
    recognitionRef.current = recognition

    mediaRecorder.start(200); recognition.start()
    setIsListening(true); setElapsed(0); elapsedRef.current = 0
    setTranscript(''); transcriptRef.current = ''; setSttError('')
  }

  const stopListening = () => {
    recognitionRef.current?.stop()
    if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop()
    else streamRef.current?.getTracks().forEach(t => t.stop())
    setIsListening(false)
  }

  const handlePlay = (rec) => {
    if (playingAudioRef.current) { playingAudioRef.current.pause(); playingAudioRef.current = null }
    if (playingId === rec.id) { setPlayingId(null); return }
    const audio = new Audio(rec.audioUrl)
    audio.play(); audio.onended = () => setPlayingId(null); audio.onerror = () => setPlayingId(null)
    playingAudioRef.current = audio; setPlayingId(rec.id)
  }

  const handleDelete = (id) => {
    if (playingId === id) { playingAudioRef.current?.pause(); setPlayingId(null) }
    setRecordings(prev => { const r = prev.find(x => x.id === id); if (r) URL.revokeObjectURL(r.audioUrl); return prev.filter(x => x.id !== id) })
  }

  const clearAll = () => {
    playingAudioRef.current?.pause(); setPlayingId(null)
    recordings.forEach(r => URL.revokeObjectURL(r.audioUrl)); setRecordings([])
  }

  // ── TTS ──
  const handleSpeak = () => {
    if (!ttsText.trim()) return
    if (!window.speechSynthesis) { setTtsError('🔇 Not supported. Use Chrome!'); return }
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(ttsText)
    u.rate = rate; u.pitch = pitch
    u.onstart = () => setIsSpeaking(true); u.onend = () => setIsSpeaking(false)
    u.onerror = () => { setIsSpeaking(false); setTtsError('Something went wrong! 😅') }
    window.speechSynthesis.speak(u); setTtsError('')
  }

  const stopSpeaking = () => { window.speechSynthesis?.cancel(); setIsSpeaking(false) }

  return (
    <div className="csf-root">

      {/* Tabs */}
      <div className="csf-tabs">
        <button className={`csf-tab ${activeTab === 'stt' ? 'csf-tab-active csf-tab-mic' : ''}`} onClick={() => setActiveTab('stt')}>
          <span className="csf-tab-icon">🎤</span><span>Speech to Text</span>
        </button>
        <button className={`csf-tab ${activeTab === 'tts' ? 'csf-tab-active csf-tab-speaker' : ''}`} onClick={() => setActiveTab('tts')}>
          <span className="csf-tab-icon">🔊</span><span>Text to Speech</span>
        </button>
      </div>

      {/* ══════════ SPEECH TO TEXT ══════════ */}
      {activeTab === 'stt' && (
        <div className="csf-card" style={{ position: 'relative' }}>

          {/* Recordings button — top right */}
          <button className="rec-trigger-btn" onClick={() => setShowModal(true)}>
            <FolderIcon />
            <span>Recordings</span>
            {recordings.length > 0 && (
              <span className="rec-trigger-badge">{recordings.length}</span>
            )}
          </button>

          {/* Hero */}
          <div className="csf-hero csf-hero-mic">
            <div className="csf-hero-stars">
              <span className="csf-star s1">⭐</span><span className="csf-star s2">✨</span>
              <span className="csf-star s3">🌟</span><span className="csf-star s4">⭐</span>
              <span className="csf-star s5">✨</span>
            </div>
            <h2 className="csf-hero-title">🎙️ Voice Recorder</h2>
            <p className="csf-hero-sub">Tap the mic — your voice will be recorded and converted to text!</p>
          </div>

          {/* Waveform */}
          <div className="csf-wave-area"><Waveform active={isListening} /></div>

          {/* Mic button */}
          <div className="csf-btn-area">
            {isListening && (
              <><span className="csf-ring csf-ring1"/><span className="csf-ring csf-ring2"/><span className="csf-ring csf-ring3"/></>
            )}
            <button
              className={`csf-main-btn ${isListening ? 'csf-btn-recording' : 'csf-btn-idle-mic'}`}
              onClick={isListening ? stopListening : startListening}
            >
              {isListening ? <StopIcon /> : <MicIcon />}
            </button>
          </div>

          <div className={`csf-timer ${isListening ? 'csf-timer-live' : ''}`}>{formatTime(elapsed)}</div>
          <p className="csf-status-text">
            {isListening ? '🔴 Recording... tap to stop!' : '👇 Tap the mic to start!'}
          </p>

          {sttError && <div className="csf-error-box">{sttError}</div>}

          {/* Live transcript */}
          {isListening && transcript && (
            <div className="csf-live-preview">
              <span className="csf-live-dot" />
              <span className="csf-live-label">Live transcript</span>
              <p className="csf-live-text">{transcript}</p>
            </div>
          )}
        </div>
      )}

      {/* ══════════ TEXT TO SPEECH ══════════ */}
      {activeTab === 'tts' && (
        <div className="csf-card">
          <div className="csf-hero csf-hero-speaker">
            <div className="csf-hero-stars">
              <span className="csf-star s1">🎵</span><span className="csf-star s2">🎶</span>
              <span className="csf-star s3">🎵</span><span className="csf-star s4">🎶</span>
              <span className="csf-star s5">🎵</span>
            </div>
            <h2 className="csf-hero-title">🔊 Voice Magic</h2>
            <p className="csf-hero-sub">{TTS_HINTS[0]}</p>
          </div>

          <div className="csf-input-area">
            <textarea className="csf-textarea" value={ttsText} onChange={e => setTtsText(e.target.value)}
              placeholder="✏️  Write something here and I will read it out loud for you!" rows={4} />
          </div>

          <div className="csf-wave-area"><Waveform active={isSpeaking} /></div>

          <div className="csf-btn-area">
            {isSpeaking && (
              <><span className="csf-ring csf-ring1 csf-ring-green"/><span className="csf-ring csf-ring2 csf-ring-green"/><span className="csf-ring csf-ring3 csf-ring-green"/></>
            )}
            <button
              className={`csf-main-btn ${isSpeaking ? 'csf-btn-speaking' : 'csf-btn-idle-speaker'}`}
              onClick={isSpeaking ? stopSpeaking : handleSpeak}
              disabled={!ttsText.trim() && !isSpeaking}
            >
              {isSpeaking ? <StopIcon /> : <SpeakerIcon />}
            </button>
          </div>

          <p className="csf-status-text">{isSpeaking ? '🟢 Speaking... tap to stop!' : '👇 Tap the speaker to listen!'}</p>

          <div className="csf-controls-row">
            <div className="csf-control-pill">
              <span className="csf-ctl-emoji">🐢</span>
              <input type="range" min="0.5" max="2" step="0.1" value={rate} onChange={e => setRate(parseFloat(e.target.value))} />
              <span className="csf-ctl-emoji">🐇</span>
              <span className="csf-ctl-badge">{rate.toFixed(1)}x</span>
            </div>
            <div className="csf-control-pill">
              <span className="csf-ctl-emoji">🔉</span>
              <input type="range" min="0" max="2" step="0.1" value={pitch} onChange={e => setPitch(parseFloat(e.target.value))} />
              <span className="csf-ctl-emoji">🔊</span>
              <span className="csf-ctl-badge">{pitch.toFixed(1)}</span>
            </div>
          </div>

          {ttsError && <div className="csf-error-box">{ttsError}</div>}
          {ttsText && <button className="csf-action-btn csf-btn-clear" onClick={() => setTtsText('')} style={{marginTop:12}}>🗑️ Clear</button>}
        </div>
      )}

      {/* ══════════ RECORDINGS MODAL ══════════ */}
      {showModal && (
        <RecordingsModal
          recordings={recordings}
          playingId={playingId}
          onPlay={handlePlay}
          onDelete={handleDelete}
          onClearAll={clearAll}
          onClose={() => setShowModal(false)}
        />
      )}

      <style>{`
        /* ── Root & Tabs ── */
        .csf-root { width:100%; max-width:640px; margin:0 auto; font-family:'Segoe UI',system-ui,sans-serif; }
        .csf-tabs { display:flex; gap:10px; margin-bottom:20px; }
        .csf-tab { flex:1; display:flex; align-items:center; justify-content:center; gap:8px; padding:13px 20px; border:2.5px solid #e2e8f0; border-radius:16px; background:#fff; color:#64748b; font-size:15px; font-weight:700; cursor:pointer; transition:all 0.25s; box-shadow:0 2px 8px rgba(0,0,0,0.04); }
        .csf-tab:hover { border-color:#a78bfa; color:#7c3aed; transform:translateY(-1px); }
        .csf-tab-icon { font-size:20px; }
        .csf-tab-active { transform:translateY(-2px); box-shadow:0 6px 20px rgba(0,0,0,0.12); }
        .csf-tab-mic { background:linear-gradient(135deg,#7c3aed,#6366f1); color:#fff !important; border-color:transparent; }
        .csf-tab-speaker { background:linear-gradient(135deg,#059669,#0d9488); color:#fff !important; border-color:transparent; }

        /* ── Card ── */
        .csf-card { background:#fff; border-radius:28px; overflow:hidden; box-shadow:0 8px 40px rgba(0,0,0,0.10); padding-bottom:28px; position:relative; }

        /* ── Recordings trigger button ── */
        .rec-trigger-btn {
          position:absolute; top:14px; right:14px; z-index:10;
          display:flex; align-items:center; gap:6px;
          background:rgba(255,255,255,0.22); backdrop-filter:blur(8px);
          border:1.5px solid rgba(255,255,255,0.5); border-radius:20px;
          color:#fff; font-size:13px; font-weight:700; cursor:pointer;
          padding:7px 14px; transition:all 0.2s;
        }
        .rec-trigger-btn:hover { background:rgba(255,255,255,0.35); transform:scale(1.04); }
        .rec-trigger-badge {
          background:#ef4444; color:#fff; border-radius:50%;
          width:20px; height:20px; font-size:11px; font-weight:800;
          display:flex; align-items:center; justify-content:center;
          margin-left:2px;
        }

        /* ── Hero ── */
        .csf-hero { padding:28px 24px 24px; text-align:center; position:relative; overflow:hidden; }
        .csf-hero-mic { background:linear-gradient(135deg,#7c3aed 0%,#6366f1 50%,#38bdf8 100%); }
        .csf-hero-speaker { background:linear-gradient(135deg,#059669 0%,#0d9488 50%,#38bdf8 100%); }
        .csf-hero-title { font-size:26px; font-weight:800; color:#fff; margin:0 0 6px; text-shadow:0 2px 8px rgba(0,0,0,0.15); }
        .csf-hero-sub { font-size:14px; color:rgba(255,255,255,0.9); margin:0; font-weight:500; }
        .csf-hero-stars { position:absolute; inset:0; pointer-events:none; }
        .csf-star { position:absolute; font-size:18px; animation:sfFloat 3s ease-in-out infinite; opacity:0.8; }
        .s1{top:12px;left:14px;animation-delay:0s} .s2{top:8px;right:56px;animation-delay:0.5s;font-size:14px}
        .s3{bottom:14px;left:50%;transform:translateX(-50%);animation-delay:1s} .s4{bottom:10px;left:18px;animation-delay:1.5s;font-size:13px} .s5{bottom:12px;right:16px;animation-delay:0.8s}
        @keyframes sfFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}

        /* ── Waveform ── */
        .csf-wave-area { padding:8px 24px 0; }
        .csf-waveform { display:flex; align-items:center; justify-content:center; gap:3px; height:52px; }
        .csf-bar { width:5px; height:6px; border-radius:4px; background:#e2e8f0; }
        .csf-bar.csf-bar-active { background:var(--bar-color); animation:csfWave 0.85s ease-in-out infinite; }
        @keyframes csfWave{0%,100%{height:6px;}50%{height:36px;}}

        /* ── Buttons ── */
        .csf-btn-area { position:relative; display:flex; justify-content:center; align-items:center; height:160px; margin-top:4px; }
        .csf-ring { position:absolute; border-radius:50%; border:3px solid rgba(124,58,237,0.25); animation:csfRing 2s ease-out infinite; }
        .csf-ring-green { border-color:rgba(5,150,105,0.25); }
        .csf-ring1{width:112px;height:112px;animation-delay:0s} .csf-ring2{width:148px;height:148px;animation-delay:0.5s} .csf-ring3{width:184px;height:184px;animation-delay:1s}
        @keyframes csfRing{0%{transform:scale(0.9);opacity:1;}100%{transform:scale(1.2);opacity:0;}}
        .csf-main-btn { width:100px; height:100px; border-radius:50%; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; position:relative; z-index:2; transition:transform 0.15s; }
        .csf-main-btn:hover { transform:scale(1.1); }
        .csf-main-btn:active { transform:scale(0.95); }
        .csf-main-btn:disabled { opacity:0.35; cursor:not-allowed; transform:none !important; }
        .csf-btn-idle-mic { background:linear-gradient(135deg,#7c3aed,#6366f1); box-shadow:0 8px 30px rgba(124,58,237,0.45),0 0 0 6px rgba(124,58,237,0.12); animation:csfBounce 2.5s ease-in-out infinite; }
        .csf-btn-recording { background:linear-gradient(135deg,#ef4444,#dc2626); box-shadow:0 8px 30px rgba(239,68,68,0.5),0 0 0 6px rgba(239,68,68,0.15); animation:csfPulseRed 1.2s ease-in-out infinite; }
        .csf-btn-idle-speaker { background:linear-gradient(135deg,#059669,#0d9488); box-shadow:0 8px 30px rgba(5,150,105,0.45),0 0 0 6px rgba(5,150,105,0.12); animation:csfBounce 2.5s ease-in-out infinite; }
        .csf-btn-speaking { background:linear-gradient(135deg,#f59e0b,#f97316); box-shadow:0 8px 30px rgba(245,158,11,0.5),0 0 0 6px rgba(245,158,11,0.15); animation:csfPulseOrange 1.2s ease-in-out infinite; }
        @keyframes csfBounce{0%,100%{transform:translateY(0) scale(1);}50%{transform:translateY(-6px) scale(1.03);}}
        @keyframes csfPulseRed{0%,100%{box-shadow:0 8px 30px rgba(239,68,68,0.5),0 0 0 0 rgba(239,68,68,0.4);}50%{box-shadow:0 8px 30px rgba(239,68,68,0.5),0 0 0 18px rgba(239,68,68,0);}}
        @keyframes csfPulseOrange{0%,100%{box-shadow:0 8px 30px rgba(245,158,11,0.5),0 0 0 0 rgba(245,158,11,0.4);}50%{box-shadow:0 8px 30px rgba(245,158,11,0.5),0 0 0 18px rgba(245,158,11,0);}}

        /* ── Timer & status ── */
        .csf-timer { text-align:center; font-size:38px; font-weight:900; font-family:'Courier New',monospace; color:#cbd5e1; letter-spacing:4px; margin:2px 0 0; }
        .csf-timer.csf-timer-live { color:#ef4444; }
        .csf-status-text { text-align:center; font-size:15px; color:#94a3b8; font-weight:600; margin:8px 0 0; }
        .csf-error-box { margin:12px 24px 0; padding:12px 16px; background:#fef2f2; border:1.5px solid #fca5a5; border-radius:12px; font-size:14px; color:#dc2626; font-weight:500; text-align:center; }

        /* ── Live preview ── */
        .csf-live-preview { margin:16px 20px 0; background:linear-gradient(135deg,#faf5ff,#eff6ff); border:2px dashed #a78bfa; border-radius:16px; padding:14px 16px; }
        .csf-live-dot { display:inline-block; width:8px; height:8px; background:#ef4444; border-radius:50%; animation:csfPulseRed 1s ease-in-out infinite; margin-right:6px; vertical-align:middle; }
        .csf-live-label { font-size:12px; font-weight:800; color:#7c3aed; text-transform:uppercase; letter-spacing:0.5px; }
        .csf-live-text { font-size:15px; color:#1e293b; margin:8px 0 0; line-height:1.6; font-style:italic; }

        /* ── Modal backdrop ── */
        .rec-modal-backdrop {
          position:fixed; inset:0; background:rgba(15,23,42,0.55);
          backdrop-filter:blur(4px); z-index:1000;
          display:flex; align-items:center; justify-content:center;
          padding:20px; animation:modalFadeIn 0.2s ease;
        }
        @keyframes modalFadeIn{from{opacity:0}to{opacity:1}}

        /* ── Modal ── */
        .rec-modal {
          background:#fff; border-radius:28px;
          width:100%; max-width:560px; max-height:80vh;
          display:flex; flex-direction:column;
          box-shadow:0 24px 80px rgba(0,0,0,0.25);
          animation:modalSlideUp 0.25s ease;
          overflow:hidden;
        }
        @keyframes modalSlideUp{from{transform:translateY(24px);opacity:0}to{transform:translateY(0);opacity:1}}

        .rec-modal-header {
          display:flex; align-items:center; justify-content:space-between;
          padding:20px 24px; border-bottom:1.5px solid #f1f5f9;
          background:linear-gradient(135deg,#7c3aed,#6366f1);
          flex-shrink:0;
        }
        .rec-modal-title { display:flex; align-items:center; gap:10px; font-size:18px; font-weight:800; color:#fff; }
        .rec-count-badge { background:rgba(255,255,255,0.25); color:#fff; border-radius:20px; padding:3px 12px; font-size:13px; font-weight:800; }
        .rec-modal-close { background:rgba(255,255,255,0.2); border:none; border-radius:10px; padding:7px; cursor:pointer; color:#fff; display:flex; align-items:center; justify-content:center; transition:background 0.15s; }
        .rec-modal-close:hover { background:rgba(255,255,255,0.35); }
        .rec-clear-all-btn { background:rgba(255,255,255,0.15); border:1.5px solid rgba(255,255,255,0.35); color:#fff; border-radius:10px; padding:7px 14px; font-size:13px; font-weight:700; cursor:pointer; }
        .rec-clear-all-btn:hover { background:rgba(255,255,255,0.25); }

        .rec-modal-body { overflow-y:auto; padding:20px 24px; flex:1; }

        /* ── Recording cards ── */
        .rec-list { display:flex; flex-direction:column; gap:14px; }
        .rec-card { background:#f8fafc; border-radius:18px; padding:16px 18px; border:1.5px solid #e2e8f0; }
        .rec-card-top { display:flex; align-items:center; gap:10px; margin-bottom:12px; }
        .rec-index-badge { background:linear-gradient(135deg,#7c3aed,#6366f1); color:#fff; border-radius:10px; padding:4px 12px; font-size:13px; font-weight:800; white-space:nowrap; }
        .rec-meta { flex:1; display:flex; flex-direction:column; gap:2px; }
        .rec-date { font-size:12px; font-weight:600; color:#475569; }
        .rec-duration { font-size:11px; color:#94a3b8; font-weight:500; }
        .rec-delete-btn { background:#fef2f2; border:1.5px solid #fca5a5; color:#ef4444; border-radius:10px; padding:7px; cursor:pointer; display:flex; align-items:center; justify-content:center; }
        .rec-delete-btn:hover { background:#fee2e2; }
        .rec-transcript { background:#fff; border-radius:12px; padding:12px 14px; margin-bottom:12px; border:1px solid #e0e7ff; }
        .rec-transcript-label { font-size:11px; font-weight:800; color:#6366f1; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:5px; }
        .rec-transcript-text { font-size:14px; color:#1e293b; line-height:1.6; margin:0; font-style:italic; }
        .rec-no-transcript { font-size:13px; color:#94a3b8; font-style:italic; margin:0 0 12px; text-align:center; }
        .rec-audio-row { display:flex; align-items:center; gap:10px; }
        .rec-play-btn { display:flex; align-items:center; gap:7px; padding:9px 18px; border-radius:12px; border:none; cursor:pointer; font-size:13px; font-weight:700; background:linear-gradient(135deg,#7c3aed,#6366f1); color:#fff; box-shadow:0 4px 12px rgba(124,58,237,0.25); transition:transform 0.15s; }
        .rec-play-btn:hover { transform:scale(1.04); }
        .rec-play-btn-active { background:linear-gradient(135deg,#f59e0b,#f97316); box-shadow:0 4px 12px rgba(245,158,11,0.25); }
        .rec-playing-indicator { display:flex; align-items:center; }
        .rec-dot { width:6px; height:6px; background:#f59e0b; border-radius:50%; margin-right:3px; animation:csfBounce 0.6s ease-in-out infinite; }
        .rec-dot:nth-child(2){animation-delay:0.15s} .rec-dot:nth-child(3){animation-delay:0.3s}

        /* ── Empty state ── */
        .rec-empty { text-align:center; padding:40px 20px; color:#94a3b8; }
        .rec-empty-icon { font-size:56px; display:block; margin-bottom:14px; }
        .rec-empty p { font-size:15px; font-weight:500; line-height:1.7; margin:0; }

        /* ── TTS controls ── */
        .csf-input-area { padding:20px 24px 0; }
        .csf-textarea { width:100%; box-sizing:border-box; background:linear-gradient(135deg,#f8fafc,#f1f5f9); border:2.5px solid #e2e8f0; border-radius:18px; padding:18px; font-size:16px; line-height:1.7; color:#1e293b; resize:none; outline:none; font-family:inherit; transition:border-color 0.2s,box-shadow 0.2s; }
        .csf-textarea:focus { border-color:#059669; box-shadow:0 0 0 4px rgba(5,150,105,0.1); background:#fff; }
        .csf-textarea::placeholder { color:#94a3b8; }
        .csf-controls-row { display:flex; flex-direction:column; gap:10px; padding:16px 24px 0; }
        .csf-control-pill { display:flex; align-items:center; gap:10px; background:#f8fafc; border-radius:14px; padding:12px 16px; border:1.5px solid #e2e8f0; }
        .csf-ctl-emoji { font-size:20px; }
        .csf-control-pill input[type=range] { flex:1; accent-color:#059669; height:6px; }
        .csf-ctl-badge { background:#059669; color:#fff; border-radius:8px; padding:3px 10px; font-size:12px; font-weight:800; min-width:38px; text-align:center; }
        .csf-action-btn { border:none; border-radius:12px; padding:10px 24px; font-size:14px; font-weight:700; cursor:pointer; transition:transform 0.15s; display:block; margin:0 auto; }
        .csf-action-btn:hover { transform:translateY(-2px); }
        .csf-btn-clear { background:#fef2f2; color:#ef4444; border:1.5px solid #fca5a5; }
      `}</style>
    </div>
  )
}
