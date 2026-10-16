import { useCallback, useEffect, useRef, useState } from 'react'
import {
  SECTION_KEYS, SECTION_LABELS, MAX_SECTION_CHARS, parseCommand, appendDictation, applyPunctuation,
} from '../utils/voiceCommands'

// Voice dictation for the SOAP note editor (Web Speech API; Chrome and Edge).
// Audio is never recorded or uploaded: the browser turns speech into text and
// only that text (plus the command that was used) is kept in the voice log.
const SpeechRecognitionCtor = typeof window === 'undefined' ? null : (window.SpeechRecognition || window.webkitSpeechRecognition || null)
const newSessionKey = () => `vs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

export default function useVoiceNotes({ enabled, getText, setText, onSaveDraft, onRequestClear, onStopped }) {
  const supported = Boolean(SpeechRecognitionCtor)
  const [isListening, setIsListening] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [language, setLanguageState] = useState('en-US')
  const [activeSection, setActiveSectionState] = useState('subjective')
  const [interimText, setInterimText] = useState('')
  const [log, setLog] = useState([])
  const [pendingCount, setPendingCount] = useState(0)
  const [warning, setWarning] = useState('')

  const recRef = useRef(null)
  const listeningRef = useRef(false)
  const pausedRef = useRef(false)
  const activeRef = useRef('subjective')
  const langRef = useRef('en-US')
  const sessionKeyRef = useRef(newSessionKey())
  const pendingRef = useRef([])
  const undoRef = useRef({}) // one undo stack per section: [{ before, after }]
  const cb = useRef({})
  cb.current = { getText, setText, onSaveDraft, onRequestClear, onStopped }

  const setActive = useCallback((s) => {
    if (!SECTION_KEYS.includes(s)) return
    activeRef.current = s
    setActiveSectionState(s)
  }, [])

  const record = useCallback((entry) => {
    const full = { language: langRef.current, session_key: sessionKeyRef.current, spoken_at: new Date().toISOString(), ...entry }
    pendingRef.current.push(full)
    setPendingCount(pendingRef.current.length)
    setLog((l) => [...l, full])
  }, [])

  const pushUndo = (section, before, after) => {
    const st = undoRef.current[section] || (undoRef.current[section] = [])
    st.push({ before, after })
  }

  // Undoes the last dictated chunk of one section; text typed after it is kept.
  const doUndo = useCallback((section) => {
    const st = undoRef.current[section] || []
    const last = st.pop()
    if (!last) return 'nothing to undo'
    const cur = cb.current.getText(section)
    if (cur === last.after) cb.current.setText(section, last.before)
    else if (cur.startsWith(last.after)) cb.current.setText(section, last.before + cur.slice(last.after.length))
    else return 'could not undo (the text was edited)'
    return 'removed last phrase'
  }, [])

  const stop = useCallback(() => {
    const was = listeningRef.current
    listeningRef.current = false
    pausedRef.current = false
    try { recRef.current?.stop() } catch { /* not running */ }
    try { window.speechSynthesis?.cancel() } catch { /* ignore */ }
    setIsListening(false); setIsPaused(false); setInterimText('')
    if (was) cb.current.onStopped?.()
  }, [])

  const pause = useCallback(() => {
    if (!listeningRef.current) return
    pausedRef.current = true
    try { recRef.current?.stop() } catch { /* not running */ }
    setIsPaused(true); setInterimText('')
  }, [])

  const runCommand = useCallback((cmd, spoken, confidence) => {
    const section = activeRef.current
    const idx = SECTION_KEYS.indexOf(section)
    let result = ''
    let entrySection = section
    switch (cmd.name) {
      case 'next_section':
        if (idx < SECTION_KEYS.length - 1) { setActive(SECTION_KEYS[idx + 1]); result = `moved to ${SECTION_LABELS[SECTION_KEYS[idx + 1]]}` } else result = 'already at the last section'
        break
      case 'previous_section':
        if (idx > 0) { setActive(SECTION_KEYS[idx - 1]); result = `moved to ${SECTION_LABELS[SECTION_KEYS[idx - 1]]}` } else result = 'already at the first section'
        break
      case 'go_to_section':
        setActive(cmd.section); result = `moved to ${SECTION_LABELS[cmd.section]}`
        break
      case 'new_line': {
        const cur = cb.current.getText(section)
        if (cur.length < MAX_SECTION_CHARS) { const next = `${cur}\n`; pushUndo(section, cur, next); cb.current.setText(section, next); result = 'inserted a new line' } else result = 'section is full'
        break
      }
      case 'punctuation': {
        const cur = cb.current.getText(section)
        const next = applyPunctuation(cur, cmd.char)
        if (next !== cur) { pushUndo(section, cur, next); cb.current.setText(section, next); result = `added "${cmd.char.trim()}"` } else result = 'section is full'
        break
      }
      case 'undo': result = doUndo(section); break
      case 'clear_section': cb.current.onRequestClear?.(section); result = 'asked to confirm'; break
      case 'read_back': {
        const t = cb.current.getText(section)
        if (!t.trim()) { result = 'section is empty'; break }
        try {
          window.speechSynthesis.cancel()
          const u = new SpeechSynthesisUtterance(t)
          u.lang = langRef.current
          window.speechSynthesis.speak(u)
          result = `read back ${SECTION_LABELS[section]}`
        } catch { result = 'read back is not supported in this browser' }
        break
      }
      case 'save_draft': cb.current.onSaveDraft?.(); result = 'saving draft'; break
      case 'pause': result = 'paused'; break
      case 'stop_listening': result = 'stopped listening'; break
      case 'sign_blocked': result = 'Signing must be done by hand'; break
      default: return
    }
    record({ type: 'command', command_name: cmd.name, section: entrySection, text: spoken.trim(), result, confidence })
    if (cmd.name === 'pause') pause()
    if (cmd.name === 'stop_listening') stop()
  }, [doUndo, pause, record, setActive, stop])

  const runDictation = useCallback((spoken, confidence) => {
    const section = activeRef.current
    const cur = cb.current.getText(section)
    const { text, chunk, truncated } = appendDictation(cur, spoken)
    if (truncated) setWarning(`The ${SECTION_LABELS[section]} section reached the ${MAX_SECTION_CHARS}-character limit.`)
    if (!chunk) return
    pushUndo(section, cur, text)
    cb.current.setText(section, text)
    record({ type: 'dictation', command_name: null, section, text: chunk.trim(), result: null, confidence })
  }, [record])

  const handleResult = useCallback((e) => {
    let interim = ''
    for (let i = e.resultIndex; i < e.results.length; i += 1) {
      const r = e.results[i]
      const transcript = r[0]?.transcript || ''
      if (!r.isFinal) { interim += transcript; continue }
      const conf = Number.isFinite(r[0]?.confidence) && r[0].confidence > 0 ? Math.min(1, r[0].confidence) : null
      const cmd = parseCommand(transcript)
      if (cmd) runCommand(cmd, transcript, conf)
      else if (transcript.trim()) runDictation(transcript, conf)
    }
    setInterimText(interim.trim())
  }, [runCommand, runDictation])

  const startRecognition = useCallback(() => {
    if (!SpeechRecognitionCtor) return
    const rec = new SpeechRecognitionCtor()
    rec.lang = langRef.current
    rec.continuous = true
    rec.interimResults = true
    rec.onresult = handleResult
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setWarning('Microphone access was blocked. Allow the microphone for this site and try again.')
        stop()
      }
    }
    // Chrome ends sessions on its own (silence, time limits); keep going while the mic is on.
    rec.onend = () => {
      if (!listeningRef.current || pausedRef.current) return
      setTimeout(() => { if (listeningRef.current && !pausedRef.current) { try { startRecognition() } catch { /* already running */ } } }, 250)
    }
    recRef.current = rec
    rec.start()
  }, [handleResult, stop])

  const start = useCallback((section) => {
    if (!supported || !enabled) return
    if (section) setActive(section)
    if (!listeningRef.current) sessionKeyRef.current = newSessionKey()
    listeningRef.current = true
    pausedRef.current = false
    setIsListening(true); setIsPaused(false); setWarning('')
    try { startRecognition() } catch { /* already running */ }
  }, [enabled, setActive, startRecognition, supported])

  const resume = useCallback(() => {
    if (!listeningRef.current) return
    pausedRef.current = false
    setIsPaused(false)
    try { startRecognition() } catch { /* already running */ }
  }, [startRecognition])

  const setLanguage = useCallback((l) => {
    langRef.current = l
    setLanguageState(l)
    if (listeningRef.current && !pausedRef.current) { try { recRef.current?.stop() } catch { /* restarts via onend */ } }
  }, [])

  // The Undo button logs itself like the spoken command.
  const undoActive = useCallback(() => {
    const section = activeRef.current
    const result = doUndo(section)
    record({ type: 'command', command_name: 'undo', section, text: 'undo (button)', result, confidence: null })
  }, [doUndo, record])

  const clearUndo = useCallback((section) => { undoRef.current[section] = [] }, [])
  const getPending = useCallback(() => [...pendingRef.current], [])
  const markSent = useCallback((n) => { pendingRef.current.splice(0, n); setPendingCount(pendingRef.current.length) }, [])
  const dropPending = useCallback(() => { pendingRef.current = []; setPendingCount(0) }, [])

  // Turn the mic off when voice becomes unavailable (note locked or signed) and on unmount.
  useEffect(() => { if (!enabled && listeningRef.current) stop() }, [enabled, stop])
  useEffect(() => () => {
    listeningRef.current = false
    try { recRef.current?.stop() } catch { /* ignore */ }
    try { window.speechSynthesis?.cancel() } catch { /* ignore */ }
  }, [])

  return {
    supported, isListening, isPaused, language, activeSection, interimText, log, pendingCount, warning,
    start, stop, pause, resume, setLanguage, setActive, undoActive, clearUndo, getPending, markSent, dropPending,
  }
}
