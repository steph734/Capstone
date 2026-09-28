import { useState, useEffect } from 'react'
import TherapistPageShell from './TherapistPageShell'
import { getTherapistMenuItems } from './therapistSidebarConfig'
import SpeechFeaturesUI from '../SpeechFeaturesUI'
import PatientPickerModal from './PatientPickerModal'

const STORAGE_KEY = 'therapypro_speech_patient'

export default function TherapistSpeechFeaturesPage({ user, onLogout, betaTier }) {
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [practiceMode, setPracticeMode] = useState(false)
  const [tool, setTool] = useState('stt')
  const [showPicker, setShowPicker] = useState(false)

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null')
      if (saved?.practice) {
        setPracticeMode(true)
        if (saved.tool) setTool(saved.tool)
        return
      }
      if (saved?.id) {
        setSelectedPatient(saved)
        return
      }
    } catch {
      // ignore corrupted storage
    }
    setShowPicker(true)
  }, [])

  const handleSelect = (patient, chosenTool, remember) => {
    setSelectedPatient(patient)
    setPracticeMode(false)
    setTool(chosenTool)
    setShowPicker(false)
    try {
      if (remember) sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ id: patient.id, name: patient.name, age: patient.age, condition: patient.condition }))
      else sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      // storage unavailable — selection still holds for this render
    }
  }

  const handlePracticeMode = (chosenTool) => {
    setSelectedPatient(null)
    setPracticeMode(true)
    setTool(chosenTool)
    setShowPicker(false)
  }

  return (
    <TherapistPageShell
      user={user}
      onLogout={onLogout}
      title="Speech Features"
      subtitle="Voice recorder and text-to-speech tools"
      icon="🎙️"
      menuItems={getTherapistMenuItems(betaTier)}
      beta={betaTier === 'silver' || betaTier === 'gold'}
    >
      <SpeechFeaturesUI
        user={user}
        patient={selectedPatient}
        practiceMode={practiceMode}
        initialTab={tool}
        onChangePatient={() => setShowPicker(true)}
      />

      {showPicker && (
        <PatientPickerModal
          therapistEmail={user?.email}
          initialTool={tool}
          onSelect={handleSelect}
          onPracticeMode={handlePracticeMode}
          onClose={() => setShowPicker(false)}
        />
      )}
    </TherapistPageShell>
  )
}
