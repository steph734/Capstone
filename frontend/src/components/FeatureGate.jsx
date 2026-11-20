import useEntitlements from '../hooks/useEntitlements'

// Shows its children only when the clinic's plan includes `feature`; otherwise `fallback` (nothing by default).
// While the plan is still loading nothing is shown, so a locked feature never flashes.
export default function FeatureGate({ feature, fallback = null, children }) {
  const { has, loading } = useEntitlements()
  if (loading) return null
  return has(feature) ? children : fallback
}
