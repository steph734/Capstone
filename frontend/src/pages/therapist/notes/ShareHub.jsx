import { useEffect, useState } from 'react'
import ShareDialog from './ShareDialog'
import ShareTherapistModal, { ShareTabs } from './ShareTherapistTab'
import './cover.css'

// One modal for both kinds of sharing. BOTH panes stay mounted and the tab only shows or hides one,
// so switching is instant: nothing is closed, fetched or rebuilt, and what you typed in a pane is kept.
//   guardianNote: a signed note (or null)   session: today's session info for the therapist tab (or null)
export default function ShareHub({ patient, guardianNote, session, existing, initialTab, onGuardianShare, onTherapistDone, onClose }) {
  const [tab, setTab] = useState(initialTab)
  useEffect(() => {
    const on = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [onClose])
  return (
    <div className="cv-overlay" onClick={onClose}>
      <div className="cv-modal" role="dialog" aria-modal="true" aria-label="Share this note" onClick={(e) => e.stopPropagation()}>
        <ShareTabs tab={tab} onTab={setTab} />
        <div hidden={tab !== 'guardian'}>
          {guardianNote
            ? <ShareDialog embedded note={guardianNote} onShare={onGuardianShare} onClose={onClose} />
            : <p className="cv-help">To share with the guardian, open a signed note below and tap <b>Share…</b> on it. Guardians only ever see signed notes.</p>}
        </div>
        <div hidden={tab !== 'therapist'}>
          {session
            ? <ShareTherapistModal embedded patient={patient} session={session} existing={existing} onDone={onTherapistDone} onClose={onClose} />
            : <p className="cv-help">There is no session for {patient.name} today, so there is no note to hand to another therapist yet.</p>}
        </div>
      </div>
    </div>
  )
}
