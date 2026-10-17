import { Attachment } from 'stream-chat-react'
import { useState } from 'react'
import RecommendationBookingModal from './RecommendationBookingModal'
import './SessionRecommendationCard.css'

// The "Another therapy session recommended" card shown in chat. Posted by the
// server as a message attachment of type 'session_recommendation'; the parent
// taps the button to pick a date and time.
function RecommendationCard({ attachment, canBook }) {
  // The button opens the booking popup right here in the chat.
  const [open, setOpen] = useState(false)
  const expired = attachment.expires_at && new Date(attachment.expires_at) < new Date()
  const fee = Number(attachment.session_fee)
  const by = attachment.expires_at
    ? new Date(attachment.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null
  return (
    <div className="src-card">
      <div className="src-head">
        <span className="src-icon" aria-hidden="true">⟳</span>
        <div>
          <div className="src-title">{attachment.title || 'Another therapy session recommended'}</div>
          {attachment.from && <div className="src-from">From {attachment.from}</div>}
        </div>
      </div>
      <dl className="src-rows">
        <div><dt>Type</dt><dd>{[attachment.session_type, attachment.session_mode, attachment.duration_minutes && `${attachment.duration_minutes} min`].filter(Boolean).join(' · ')}</dd></div>
        {Number.isFinite(fee) && fee > 0 && <div><dt>Rate</dt><dd>₱{fee.toLocaleString('en-PH')} / session</dd></div>}
      </dl>
      {canBook ? (
        <button type="button" className="src-btn" disabled={expired} onClick={() => setOpen(true)}>
          {expired ? 'Recommendation expired' : 'Set next therapy session'}
        </button>
      ) : (
        <p className="src-note">Sent to the parent{expired ? ' · expired' : ''}</p>
      )}
      {by && !expired && canBook && <p className="src-note">Pick a date by {by}</p>}
      {open && <RecommendationBookingModal recommendationId={attachment.recommendation_id} onClose={() => setOpen(false)} />}
    </div>
  )
}

// Drop-in replacement for <Channel Attachment={...}>: renders recommendation
// cards itself and hands every other attachment to Stream's default renderer.
// Only the guardian (a Patient account) gets the booking button.
export function makeRecommendationAttachment(canBook) {
  return function RecommendationAttachment(props) {
    const all = props.attachments || []
    const cards = all.filter((a) => a.type === 'session_recommendation')
    const rest = all.filter((a) => a.type !== 'session_recommendation')
    return (
      <>
        {cards.map((a, i) => <RecommendationCard key={a.recommendation_id || i} attachment={a} canBook={canBook} />)}
        {rest.length > 0 && <Attachment {...props} attachments={rest} />}
      </>
    )
  }
}

export const GuardianRecommendationAttachment = makeRecommendationAttachment(true)
export const TherapistRecommendationAttachment = makeRecommendationAttachment(false)
