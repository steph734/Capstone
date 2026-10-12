// Starts an outgoing ring to `members` (Stream user ids, including the
// caller). CallManager picks up the resulting call via useCalls() and shows
// the "Ringing…" / incoming overlays — this function just creates it.
// `meta.channelId` + `meta.email` let the server mirror this call into the
// `call_logs` collection (best-effort — never blocks the call itself).
export async function startCall(videoClient, { members, video = true, audioOnly = false, meta }) {
  const id = crypto.randomUUID()
  const call = videoClient.call('default', id)
  if (!video || audioOnly) {
    await call.camera.disable()
  }
  await call.getOrCreate({
    ring: true,
    video,
    data: {
      members: members.map((user_id) => ({ user_id })),
      custom: { audioOnly: Boolean(audioOnly) },
    },
  })

  if (meta?.channelId && meta?.email) {
    fetch('/api/stream/call-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create',
        streamCallId: call.id,
        channelId: meta.channelId,
        callType: audioOnly ? 'voice' : 'video',
        email: meta.email,
      }),
    }).catch(() => {})
  }

  return call
}
