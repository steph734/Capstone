// Pao in the new flat-vector design (public/games/sort-the-basket/pao/pao-<pose>.svg).
// Poses: hello, listen, point, point-talk, thinking, idea, reading, correct,
// proud, try-again, surprised, celebrate, sleepy, idle.
export default function PaoPoseImage({ pose = 'idle', size = 220, onTap, className = '' }) {
  const img = (
    <img
      src={`/games/sort-the-basket/pao/pao-${pose}.svg`}
      alt="Pao the panda"
      width={size}
      height={size}
      draggable={false}
      style={{ display: 'block', width: size, height: size, objectFit: 'contain', animation: 'paoPoseBob 3s ease-in-out infinite' }}
    />
  )
  return (
    <>
      <style>{`@keyframes paoPoseBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}@media (prefers-reduced-motion:reduce){img[src*="/pao/pao-"]{animation:none !important}}`}</style>
      {onTap
        ? <button type="button" onClick={onTap} className={className} aria-label="Tap Pao" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>{img}</button>
        : <span className={className}>{img}</span>}
    </>
  )
}
