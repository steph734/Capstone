import { useEffect, useRef, useState } from 'react'
import { useCalls, CallingState, StreamCall } from '@stream-io/video-react-sdk'
import CallScreen from '../components/calls/CallScreen'
import CallEndedView from '../components/calls/CallEndedView'
import { formatDuration } from '../components/calls/useCallTimer'
import { logCall } from '../components/calls/callLog'
import { useStreamCtx } from './StreamProvider'

// The app mounts this outside the router, so navigation is done through the History API.
function goTo(path) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

// What the call turned out to be, from this user's point of view.
function summarize(info) {
  const kind = info.video ? 'video' : 'voice'
  const r = info.reason
  if (info.joined) return { status: 'completed', title: 'Call ended', detail: formatDuration(info.seconds || 0), chat: `${kind === 'video' ? 'Video' : 'Voice'} call · ${formatDuration(info.seconds || 0)}` }
  if (r === 'missed') return { status: 'missed', title: 'Missed call', detail: '', chat: `Missed ${kind} call` }
  if (r === 'cancelled') return { status: 'cancelled', title: 'Call cancelled', detail: '', chat: `Cancelled ${kind} call` }
  if (info.isMine) return { status: 'declined', title: 'Call declined', detail: info.name || '', chat: `${kind === 'video' ? 'Video' : 'Voice'} call declined` }
  return r === 'declined'
    ? { status: 'declined', title: 'Call declined', detail: '', chat: '' }
    : { status: 'missed', title: 'Missed call', detail: info.name || '', chat: '' }
}

// Rendered once, inside StreamVideo. useCalls() reports every ringing/active
// call this user is part of (incoming or outgoing).
export default function CallManager() {
  const calls = useCalls()
  const ctx = useStreamCtx() || {}
  const relevant = calls.filter((c) => c.state.callingState !== CallingState.LEFT && c.state.callingState !== CallingState.IDLE)
  const current = relevant[0] || null
  const infoRef = useRef({})
  const shownId = useRef(null)
  const [ended, setEnded] = useState(null)
  const chatClientRef = useRef(null)
  chatClientRef.current = ctx.chatClient

  const report = useRef((patch) => { infoRef.current = { ...infoRef.current, ...patch } }).current

  useEffect(() => {
    const id = current?.id || null
    const prev = shownId.current
    if (prev && prev !== id) {
      const info = infoRef.current
      const s = summarize(info)
      if (info.isMine) {
        logCall('end', prev, { status: s.status })
        if (s.chat && info.channelId && chatClientRef.current) {
          chatClientRef.current.channel('messaging', info.channelId).sendMessage({ text: s.chat, call_event: true, call_status: s.status }).catch(() => {})
        }
      }
      setEnded({ title: s.title, detail: s.detail })
      infoRef.current = {}
    }
    if (id && id !== prev) { infoRef.current = {}; setEnded(null) }
    shownId.current = id
  }, [current?.id])

  useEffect(() => {
    if (!ended) return undefined
    const t = setTimeout(() => setEnded(null), 2000)
    return () => clearTimeout(t)
  }, [ended])

  if (current) {
    return (
      <StreamCall call={current}>
        <CallScreen call={current} report={report} openChat={(cid) => cid && goTo(`/messages?cid=messaging:${cid}`)} />
      </StreamCall>
    )
  }
  return ended ? <CallEndedView title={ended.title} detail={ended.detail} /> : null
}
