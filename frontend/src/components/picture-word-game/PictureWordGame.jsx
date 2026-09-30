import { useMemo, useRef, useState } from 'react'
import './game.css'
import { CATEGORIES, buildQuestions } from './data'
import { StartModal, CategoryModal, ResultsModal } from './Modals'
import { ModalShell, PressableButton } from './ui'
import GameScreen from './GameScreen'
import { useAnalytics } from '../../context/AnalyticsContext'
import { createSessionId, createEventLogger } from '../../utils/gameplayLogger'
import { reportGameCompletion, fetchGameBadge } from '../../utils/gameProgress'

// ─── Optional therapist settings panel (hidden by default; only reachable
// via the gear icon on the start card) ─────────────────────────────────────

function SettingsPanel({ settings, onChange, onClose }) {
  const set = (patch) => onChange({ ...settings, ...patch })
  return (
    <ModalShell onClose={onClose} maxWidth="max-w-[440px]" label="Therapist settings">
      <h2 className="text-[22px] font-extrabold text-[#2B2A4C]" style={{ fontFamily: "'Baloo 2', system-ui, sans-serif" }}>Therapist settings</h2>
      <p className="mt-1 text-[13px] text-[#5A5670]">These only affect this play session.</p>

      <div className="mt-5 flex flex-col gap-5">
        <SettingRow label="Word choices">
          {[2, 3].map((n) => (
            <SettingChip key={n} active={settings.choices === n} onClick={() => set({ choices: n })}>{n}</SettingChip>
          ))}
        </SettingRow>
        <SettingRow label="Questions per round">
          {[4, 6, 8].map((n) => (
            <SettingChip key={n} active={settings.questionsPerRound === n} onClick={() => set({ questionsPerRound: n })}>{n}</SettingChip>
          ))}
        </SettingRow>
        <SettingRow label="Read aloud">
          <SettingChip active={settings.readAloud} onClick={() => set({ readAloud: true })}>On</SettingChip>
          <SettingChip active={!settings.readAloud} onClick={() => set({ readAloud: false })}>Off</SettingChip>
        </SettingRow>
        <SettingRow label="Auto-hint after">
          {[1, 2, 'off'].map((n) => (
            <SettingChip key={n} active={settings.autoHintAfter === n} onClick={() => set({ autoHintAfter: n })}>{n === 'off' ? 'Off' : `${n} try${n > 1 ? 'ies' : ''}`}</SettingChip>
          ))}
        </SettingRow>
      </div>

      <PressableButton onClick={onClose} className="mt-7 h-14 w-full text-[15px]">Done</PressableButton>
    </ModalShell>
  )
}

function SettingRow({ label, children }) {
  return (
    <div>
      <div className="mb-2 text-[13px] font-extrabold uppercase tracking-wide text-[#5A5670]">{label}</div>
      <div className="flex gap-2">{children}</div>
    </div>
  )
}

function SettingChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-11 flex-1 rounded-2xl border-2 text-[14px] font-extrabold transition-colors focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6] ${
        active ? 'border-[#F59E0B] bg-[#FFF0CC] text-[#C97A00]' : 'border-[#E4DFCE] bg-white text-[#5A5670]'
      }`}
    >
      {children}
    </button>
  )
}

// ─── Main switcher ──────────────────────────────────────────────────────────

export default function PictureWordGame({
  Mascot, readAloud = true, questionCount = 6, onExit, onComplete,
  patientId = 'alvrin', patientEmail = null, exerciseId = 'picture-word', domain = 'Cognitive',
}) {
  const [phase, setPhase] = useState('start') // start | settings | category | game | results
  const [categoryId, setCategoryId] = useState(null)
  const [questions, setQuestions] = useState([])
  const [stars, setStars] = useState(0)
  const [realBadge, setRealBadge] = useState(null)
  const [settings, setSettings] = useState({ choices: 3, questionsPerRound: questionCount, readAloud, autoHintAfter: 2 })

  const { submitEventBatch } = useAnalytics()
  const sessionIdRef = useRef(createSessionId())
  const loggerRef = useRef(createEventLogger({ patientId, exerciseId, sessionId: sessionIdRef.current, domain, onFlush: submitEventBatch }))

  const category = useMemo(() => CATEGORIES.find((c) => c.id === categoryId) || null, [categoryId])

  const startCategory = (id) => {
    setCategoryId(id)
    setQuestions(buildQuestions(id, settings.questionsPerRound, settings.choices))
    setStars(0)
    setRealBadge(null)
    sessionIdRef.current = createSessionId()
    loggerRef.current = createEventLogger({ patientId, exerciseId, sessionId: sessionIdRef.current, domain, onFlush: submitEventBatch })
    setPhase('game')
  }

  const handleFinish = async (finalStars) => {
    setStars(finalStars)
    loggerRef.current.log('exit', {})
    setPhase('results')

    try {
      const earned = JSON.parse(localStorage.getItem('pao_badges') || '[]')
      if (!earned.includes('Word Wizard')) {
        localStorage.setItem('pao_badges', JSON.stringify([...earned, 'Word Wizard']))
      }
    } catch { /* no-op */ }

    reportGameCompletion({ patientEmail, gameName: 'Picture-Word Matching', score: finalStars, maxScore: questions.length })
    fetchGameBadge('Picture-Word Matching').then(setRealBadge)

    await onComplete?.({ categoryId, stars: finalStars, total: questions.length, xp: 100, badge: 'Word Wizard' })
  }

  const handleReplay = () => startCategory(categoryId)
  const handleNewGroup = () => setPhase('category')
  const handleExit = () => { loggerRef.current.log('exit', {}); onExit?.() }

  return (
    <>
      {phase === 'start' && (
        <StartModal onStart={() => setPhase('category')} onCancel={handleExit} onOpenSettings={() => setPhase('settings')}/>
      )}
      {phase === 'settings' && (
        <SettingsPanel settings={settings} onChange={setSettings} onClose={() => setPhase('start')}/>
      )}
      {phase === 'category' && (
        <CategoryModal onSelect={startCategory} onClose={handleExit}/>
      )}
      {phase === 'game' && questions.length > 0 && (
        <GameScreen
          questions={questions}
          categoryLabel={category?.label}
          Mascot={Mascot}
          readAloud={settings.readAloud}
          autoHintAfter={settings.autoHintAfter === 'off' ? Infinity : settings.autoHintAfter}
          onBack={() => setPhase('category')}
          onFinish={handleFinish}
          logger={loggerRef.current}
        />
      )}
      {phase === 'results' && (
        <ResultsModal
          categoryLabel={category?.label}
          stars={stars}
          badgeLabel={realBadge ? realBadge.name : 'Word Picture badge'}
          xp={100}
          onReplay={handleReplay}
          onNewGroup={handleNewGroup}
        />
      )}
    </>
  )
}
