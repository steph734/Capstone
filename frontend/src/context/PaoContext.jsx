import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getPaoProfile, equipPao, equipPaoTheme, hasIdent } from '../utils/paoApi'
import RewardSequence from '../components/RewardSequence'

// Pao's real profile (level, XP, stats, equipped outfit) from the server,
// plus the reward sequence shown after a finished game. `ident` says whose
// Pao this is: { activitySessionId } for a therapist-run session, or
// { patientEmail } for a patient on their own device.
const PaoContext = createContext(null)

export function PaoProvider({ ident, children }) {
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState('')
  const [pendingReward, setPendingReward] = useState(null)
  const enabled = hasIdent(ident)
  const identKey = ident?.activitySessionId || ident?.patientEmail || ''

  const refresh = useCallback(async () => {
    if (!hasIdent(ident)) return null
    try {
      const body = await getPaoProfile(ident)
      setProfile(body.profile)
      setError('')
      return body.profile
    } catch (err) {
      setError(err.message)
      return null
    }
  }, [identKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (enabled) refresh()
    else setProfile(null)
  }, [enabled, refresh])

  // A finished game's reward already carries the new profile, so apply it
  // straight away and the header never lags behind the reward screen.
  const applyServerProfile = useCallback((next) => {
    if (next) setProfile((prev) => ({ ...(prev || {}), ...next }))
  }, [])

  const equip = useCallback(async (slot, code) => {
    await equipPao(ident, slot, code)
    return refresh()
  }, [identKey, refresh]) // eslint-disable-line react-hooks/exhaustive-deps

  const equipTheme = useCallback(async (themeCode) => {
    const res = await equipPaoTheme(ident, themeCode)
    await refresh()
    return res.locked || []
  }, [identKey, refresh]) // eslint-disable-line react-hooks/exhaustive-deps

  const value = useMemo(() => ({
    profile, error, refresh, applyServerProfile, equip, equipTheme,
    showReward: setPendingReward, ident,
  }), [profile, error, refresh, applyServerProfile, equip, equipTheme, identKey]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <PaoContext.Provider value={value}>
      {children}
      {pendingReward && (
        <RewardSequence
          reward={pendingReward}
          ident={ident}
          onEquip={equip}
          onDone={() => setPendingReward(null)}
        />
      )}
    </PaoContext.Provider>
  )
}

export function usePao() {
  const ctx = useContext(PaoContext)
  if (!ctx) throw new Error('usePao must be used inside PaoProvider')
  return ctx
}

// Safe variant for components that may render outside a provider.
export function useOptionalPao() {
  return useContext(PaoContext)
}
