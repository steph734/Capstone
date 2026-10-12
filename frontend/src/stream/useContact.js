import { useStreamCtx } from './StreamProvider'
import { startCall } from './calls'

// Thin wrapper over /api/stream/contact + /api/stream/contacts for pages
// that need to open/start a channel or place a call with someone the
// current user is allowed to reach (a patient's therapist, or a therapist's
// patient's guardian).
export default function useContact(email) {
  const { chatClient, videoClient, session } = useStreamCtx() || {}

  async function contact({ targetPatientId, targetEmployeeId }) {
    const res = await fetch('/api/stream/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, targetPatientId, targetEmployeeId }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'Could not start that conversation.')
    return data
  }

  async function listContacts() {
    const res = await fetch(`/api/stream/contacts?email=${encodeURIComponent(email)}`)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'Could not load contacts.')
    return data.contacts || []
  }

  async function openChannel(target) {
    const { channelType, channelId, otherUser } = await contact(target)
    const channel = chatClient.channel(channelType, channelId)
    await channel.watch()
    return { channel, otherUser }
  }

  async function callOtherUser(otherUserId, { video = true, channelId } = {}) {
    if (!videoClient || !session) throw new Error('Calling isn’t ready yet.')
    return startCall(videoClient, { members: [session.userId, otherUserId], video, audioOnly: !video, meta: { channelId, email } })
  }

  return { contact, listContacts, openChannel, callOtherUser }
}
