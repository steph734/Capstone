import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { StreamChat } from 'stream-chat'
import { Chat } from 'stream-chat-react'
import { StreamVideoClient, StreamVideo } from '@stream-io/video-react-sdk'
import CallManager from './CallManager'
import 'stream-chat-react/dist/css/index.css'
import '@stream-io/video-react-sdk/dist/css/styles.css'
import './stream-theme.css'

const StreamCtx = createContext(null)
export const useStreamCtx = () => useContext(StreamCtx)

// Mints/refreshes a Stream user token for the given email by calling our own
// serverless endpoint — never trusts a token the browser might fabricate.
async function fetchStreamSession(email) {
  const res = await fetch('/api/stream/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Could not start a messaging session.')
  return data
}

// Wraps every logged-in route so incoming calls can ring from any page, not
// just /messages. Renders children immediately (no blocking) and connects
// chat + video in the background; `error` is exposed so pages can show a
// small "messaging unavailable" notice instead of crashing.
export default function StreamProvider({ user, children }) {
  const [chatClient, setChatClient] = useState(null)
  const [videoClient, setVideoClient] = useState(null)
  const [session, setSession] = useState(null)
  const [error, setError] = useState('')
  const clientsRef = useRef({ chat: null, video: null })

  const email = user?.email || null
  const apiKeyFallback = import.meta.env.VITE_STREAM_API_KEY || ''

  useEffect(() => {
    if (!email) {
      // Logged out: tear down any previous session.
      clientsRef.current.chat?.disconnectUser().catch(() => {})
      clientsRef.current.video?.disconnectUser().catch(() => {})
      clientsRef.current = { chat: null, video: null }
      setChatClient(null)
      setVideoClient(null)
      setSession(null)
      return undefined
    }

    let cancelled = false
    setError('')

    fetchStreamSession(email)
      .then(async (data) => {
        if (cancelled) return
        const apiKey = data.apiKey || apiKeyFallback
        if (!apiKey) throw new Error('Messaging isn’t configured yet (missing Stream API key).')

        const chat = StreamChat.getInstance(apiKey)
        await chat.connectUser({ id: data.userId, name: data.name, image: data.image || undefined }, data.token)
        if (cancelled) { chat.disconnectUser().catch(() => {}); return }

        const video = new StreamVideoClient({
          apiKey,
          user: { id: data.userId, name: data.name, image: data.image || undefined },
          token: data.token,
        })

        clientsRef.current = { chat, video }
        setChatClient(chat)
        setVideoClient(video)
        setSession(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not connect to messaging.')
      })

    return () => {
      cancelled = true
    }
  }, [email])

  // Disconnect on unmount (e.g. logout navigating away entirely).
  useEffect(() => () => {
    clientsRef.current.chat?.disconnectUser().catch(() => {})
    clientsRef.current.video?.disconnectUser().catch(() => {})
  }, [])

  const ctxValue = useMemo(() => ({
    chatClient, videoClient, session, error, ready: Boolean(chatClient && videoClient),
  }), [chatClient, videoClient, session, error])

  if (!email) return children

  return (
    <StreamCtx.Provider value={ctxValue}>
      {videoClient ? (
        <StreamVideo client={videoClient}>
          {chatClient ? <Chat client={chatClient} theme="str-chat__theme-light">{children}</Chat> : children}
          <CallManager />
        </StreamVideo>
      ) : (
        chatClient ? <Chat client={chatClient} theme="str-chat__theme-light">{children}</Chat> : children
      )}
    </StreamCtx.Provider>
  )
}
