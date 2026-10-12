import { useEffect, useState } from 'react'
import { useStreamCtx } from './StreamProvider'

// Total unread message count across every channel, for the sidebar badge.
export default function useUnreadCount() {
  const { chatClient } = useStreamCtx() || {}
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!chatClient) { setCount(0); return undefined }

    setCount(chatClient.user?.total_unread_count || 0)

    const handler = (event) => {
      if (typeof event.total_unread_count === 'number') setCount(event.total_unread_count)
    }
    chatClient.on('notification.message_new', handler)
    chatClient.on('notification.mark_read', handler)
    chatClient.on('message.new', handler)
    return () => {
      chatClient.off('notification.message_new', handler)
      chatClient.off('notification.mark_read', handler)
      chatClient.off('message.new', handler)
    }
  }, [chatClient])

  return count
}
