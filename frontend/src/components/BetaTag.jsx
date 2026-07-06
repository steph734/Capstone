// Small inline "BETA" pill — matches the blue badge already used on the
// Subscription page's tier cards (.tier-beta-tag), reused wherever a
// beta-gated feature (Speech to Text/TTS, Gamified Activities) is surfaced:
// sidebar nav items and page headers, across Owner/Therapist/Patient.
export default function BetaTag({ style }) {
  return (
    <span
      style={{
        display: 'inline-block',
        background: 'linear-gradient(135deg, #4a9eff 0%, #3d8cff 100%)',
        color: '#fff',
        fontSize: '10px',
        fontWeight: 700,
        padding: '2px 8px',
        borderRadius: '10px',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        boxShadow: '0 2px 5px rgba(74, 158, 255, 0.35)',
        flexShrink: 0,
        lineHeight: 1.5,
        ...style,
      }}
    >
      Beta
    </span>
  )
}
