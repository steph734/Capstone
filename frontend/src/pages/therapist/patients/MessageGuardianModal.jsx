import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExternalLink, Phone, Video } from 'lucide-react'
import { Channel, Window, MessageList, MessageComposer, WithComponents } from 'stream-chat-react'
import { useStreamCtx } from '../../../stream/StreamProvider'
import useContact from '../../../stream/useContact'
import { TherapistRecommendationAttachment } from '../../../components/SessionRecommendationCard'
import { Dialog } from './ui'

// The real 1-on-1 Stream chat between this therapist and the patient's guardian (created on open if needed).
export default function MessageGuardianModal({ patient, therapistEmail, onClose }) {
  const [channel, setChannel] = useState(null)
  const [loadError, setLoadError] = useState('')
  const navigate = useNavigate()
  const { chatClient } = useStreamCtx() || {}
  const contact = useContact(therapistEmail)

  useEffect(() => {
    let cancelled = false
    setChannel(null); setLoadError('')
    if (!chatClient || !patient?.id) return undefined
    contact.openChannel({ targetPatientId: patient.id })
      .then(({ channel: ch }) => { if (!cancelled) setChannel(ch) })
      .catch((err) => { if (!cancelled) setLoadError(err.message) })
    return () => { cancelled = true }
  }, [chatClient, patient?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const call = (video) => {
    const other = channel && Object.values(channel.state.members || {}).find((m) => m.user?.id !== chatClient.userID)?.user
    if (other?.id) contact.callOtherUser(other.id, { video, channelId: channel.id }).catch((err) => setLoadError(err.message))
  }

  return (
    <Dialog wide title={`Message ${patient.guardianName || 'guardian'}`} subtitle={`About ${patient.name}`} onClose={onClose} labelId="pm-msg-title"
      footer={(
        <>
          <button type="button" className="pm-btn light" onClick={() => call(true)} disabled={!channel}><Video size={16} aria-hidden="true" /> Video call</button>
          <button type="button" className="pm-btn light" onClick={() => call(false)} disabled={!channel}><Phone size={16} aria-hidden="true" /> Voice call</button>
          <button type="button" className="pm-btn light" onClick={() => channel && navigate(`/messages?cid=${channel.type}:${channel.id}`)} disabled={!channel}><ExternalLink size={16} aria-hidden="true" /> Open in Messages</button>
        </>
      )}
    >
      {loadError && <p className="pm-form-error" role="alert">{loadError}</p>}
      {!channel && !loadError && <p className="pm-muted">Connecting…</p>}
      {channel && (
        <div className="pm-chat">
          <WithComponents overrides={{ Attachment: TherapistRecommendationAttachment }}>
            <Channel channel={channel}><Window><MessageList /><MessageComposer /></Window></Channel>
          </WithComponents>
        </div>
      )}
    </Dialog>
  )
}
