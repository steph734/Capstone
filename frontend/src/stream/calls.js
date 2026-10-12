// Starts an outgoing ring to `members` (Stream user ids, including the
// caller). CallManager picks up the resulting call via useCalls() and shows
// the "Ringing…" / incoming overlays — this function just creates it.
export async function startCall(videoClient, { members, video = true, audioOnly = false }) {
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
  return call
}
