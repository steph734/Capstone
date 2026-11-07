import { useCallback, useEffect, useState } from 'react'
import { authFetch } from '../../../../utils/session'

// The Home practice overview (GET /api/therapist/home-sets), shared by the tab badge, the banner on the Therapy tab and the Home practice tab.
export default function useHomeSets() {
  const [state, setState] = useState({ data: null, error: '', loading: true })
  const load = useCallback(async () => {
    try { setState({ data: await authFetch('/api/therapist/home-sets'), error: '', loading: false }) }
    catch (e) { setState((s) => ({ ...s, error: e.message || 'Could not load home practice.', loading: false })) }
  }, [])
  useEffect(() => { load() }, [load])
  return { ...state, reload: load }
}
