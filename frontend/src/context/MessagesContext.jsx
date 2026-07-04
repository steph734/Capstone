import { createContext, useContext, useState, useEffect } from 'react'

const STORAGE_KEY = 'tp_shared_thread'

// Seed the initial conversation between therapist (Dr. Sarah Reyes) and patient (Alvrin)
const INITIAL_THREAD = [
  { id: 1, from: 'therapist', text: 'Hi Alvrin! How are you feeling today?', time: '9:00 AM' },
  { id: 2, from: 'patient',   text: "I'm feeling much better, thank you! The exercises really helped.", time: '9:01 AM' },
  { id: 3, from: 'therapist', text: "That's wonderful to hear! Did you complete the breathing exercises I assigned this week?", time: '9:02 AM' },
  { id: 4, from: 'patient',   text: 'Yes! I did them every morning. It really made a difference.', time: '9:03 AM' },
  { id: 5, from: 'therapist', text: 'Excellent progress! Keep it up. See you at 2PM tomorrow! 🎉', time: '9:04 AM' },
]

function loadThread() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return JSON.parse(saved)
  } catch {}
  // Seed localStorage on first load so other tabs can read it
  localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_THREAD))
  return INITIAL_THREAD
}

const MessagesCtx = createContext(null)

export function MessagesProvider({ children }) {
  const [thread, setThread] = useState(loadThread)

  // Receive messages sent from another browser tab
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          setThread(JSON.parse(e.newValue))
        } catch {}
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  // Persist new thread to localStorage so other tabs pick it up via the storage event
  const persist = (next) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    return next
  }

  const sendAsTherapist = (text) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    setThread(prev => persist([...prev, { id: Date.now(), from: 'therapist', text, time }]))
  }

  const sendAsPatient = (text) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    setThread(prev => persist([...prev, { id: Date.now(), from: 'patient', text, time }]))
  }

  return (
    <MessagesCtx.Provider value={{ thread, sendAsTherapist, sendAsPatient }}>
      {children}
    </MessagesCtx.Provider>
  )
}

export const useSharedMessages = () => useContext(MessagesCtx)
