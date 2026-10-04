import { useEffect, useRef } from 'react'

const HEADING = { fontFamily: "'Baloo 2', system-ui, sans-serif" }
const BODY = { fontFamily: "'Atkinson Hyperlegible', system-ui, sans-serif" }
const STAT_LABEL = { intelligence: 'Intelligence', focus: 'Focus', resistance: 'Resistance', creativity: 'Creativity', speed: 'Speed', memory: 'Memory' }

// Keeps Tab inside the dialog and closes on Escape.
function useDialogKeys(ref, onCancel) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { onCancel?.(); return }
      if (e.key !== 'Tab' || !ref.current) return
      const f = ref.current.querySelectorAll('button:not([disabled])')
      if (!f.length) return
      const first = f[0]
      const last = f[f.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [ref, onCancel])
}

// A cover picture with a missing file hides itself; the card still reads fine.
function Cover({ src, rotate = 0, offset = 0, size = 92 }) {
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      className="absolute rounded-2xl border-4 border-white object-cover shadow-lg"
      style={{ width: size, height: size, left: '50%', top: 0, transform: `translateX(calc(-50% + ${offset}px)) rotate(${rotate}deg)` }}
      onError={(e) => { e.currentTarget.style.display = 'none' }}
    />
  )
}

export function DailyRoutinesStartModal({ game, ready = true, onStart, onCancel }) {
  const ref = useRef(null)
  useDialogKeys(ref, onCancel)
  const tasks = game.type_settings?.step_by_step?.tasks || []
  const gains = Object.entries(game.statGains || {}).filter(([, v]) => v > 0)
  const color = game.color || '#16a34a'

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)', background: 'rgba(60,50,90,0.45)', ...BODY }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="dr-title" style={{ background: 'linear-gradient(145deg,#ffffff,#fdf3e3)', border: `1.5px solid ${color}40`, borderRadius: 28, padding: 28, width: 400, maxWidth: '92vw', maxHeight: '95vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(80,60,20,.25)' }}>
        <div className="relative mx-auto mb-3 h-[100px] w-[220px]" aria-hidden="true">
          {tasks.slice(0, 3).map((t, i) => (
            <Cover key={t.task_key} src={t.cover_image} rotate={[-10, 0, 10][i]} offset={[-70, 0, 70][i]} size={92} />
          ))}
        </div>
        <h2 id="dr-title" style={{ ...HEADING, color: '#3a2e6b', fontSize: 24, fontWeight: 800, margin: '0 0 8px', textAlign: 'center' }}>{game.name}</h2>
        <p style={{ color: 'rgba(58,46,107,.75)', fontSize: 14, lineHeight: 1.5, margin: '0 0 18px', textAlign: 'center' }}>{game.description}</p>

        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <Card label="Badge" value="1 per task" color={color} emoji="🏅" />
          <Card label="Points" value={`+${game.pointsPerPlay ?? 100} XP`} color={color} emoji="⭐" />
          <Card label="Pao stats" value={gains.length ? gains.map(([k, v]) => `${STAT_LABEL[k] || k} +${v}`).join(' · ') : 'Stronger Pao'} color="#7c4fe0" emoji="🐼" />
        </div>

        <div style={{ background: 'rgba(16,185,129,.08)', border: '1.5px solid rgba(16,185,129,.3)', borderRadius: 16, padding: '14px 16px', marginBottom: 22, display: 'flex', gap: 10 }}>
          <span style={{ fontSize: 20, flexShrink: 0 }} aria-hidden="true">🌱</span>
          <div>
            <div style={{ fontSize: 11, color: '#0d9488', fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 4 }}>Why this helps</div>
            <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: 'rgba(58,46,107,.85)' }}>
              {game.benefits || 'Practices the steps of everyday routines in the right order, one step at a time.'}
            </p>
          </div>
        </div>

        <button type="button" onClick={onStart} disabled={!ready} style={{ width: '100%', background: color, border: 'none', color: '#fff', borderRadius: 14, padding: 13, cursor: ready ? 'pointer' : 'wait', opacity: ready ? 1 : 0.6, fontSize: 15, fontWeight: 800, boxShadow: `0 6px 16px ${color}55`, marginBottom: 10 }}>
          Start Game 🎮
        </button>
        <button type="button" onClick={onCancel} style={{ width: '100%', background: 'rgba(124,79,224,.06)', border: '1px solid rgba(124,79,224,.15)', color: 'rgba(58,46,107,.6)', borderRadius: 12, padding: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

function Card({ label, value, color, emoji }) {
  return (
    <div style={{ flex: 1, background: `${color}1a`, border: `1.5px solid ${color}55`, borderRadius: 16, padding: '12px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 24 }} aria-hidden="true">{emoji}</span>
      <span style={{ fontSize: 11, color: 'rgba(58,46,107,.55)', fontWeight: 700 }}>{label}</span>
      <span style={{ fontSize: 12, color: '#3a2e6b', fontWeight: 800, textAlign: 'center' }}>{value}</span>
    </div>
  )
}

// "What do you want to practice?" — one big card per task.
// tasks: [{ key, name, cover_image, color, min_age, safety, steps }]
export function TaskPickerModal({ tasks, patientAge = null, onPick, onBack }) {
  const ref = useRef(null)
  useDialogKeys(ref, onBack)
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)', background: 'rgba(60,50,90,0.45)', ...BODY }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="dr-pick" style={{ background: 'linear-gradient(145deg,#ffffff,#fdf3e3)', borderRadius: 28, padding: 24, width: 520, maxWidth: '94vw', maxHeight: '94vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(80,60,20,.25)' }}>
        <h2 id="dr-pick" style={{ ...HEADING, color: '#3a2e6b', fontSize: 24, fontWeight: 800, margin: '0 0 14px', textAlign: 'center' }}>What do you want to practice?</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
          {tasks.map((t) => {
            const tooYoung = patientAge != null && patientAge < (t.min_age || 0)
            return (
              <button key={t.key} type="button" disabled={tooYoung} onClick={() => onPick(t)} aria-label={`${t.name}, ${t.steps} steps`}
                style={{ background: t.color || '#FFF4DE', border: '2px solid rgba(58,46,107,.12)', borderRadius: 20, padding: 12, textAlign: 'left', cursor: tooYoung ? 'not-allowed' : 'pointer', opacity: tooYoung ? 0.5 : 1, minHeight: 64 }}>
                {t.cover_image && <img src={t.cover_image} alt="" className="mb-2 h-[110px] w-full rounded-xl object-cover" onError={(e) => { e.currentTarget.style.display = 'none' }} />}
                <div style={{ ...HEADING, color: '#3a2e6b', fontSize: 18, fontWeight: 800 }}>{t.name}</div>
                <div style={{ color: 'rgba(58,46,107,.7)', fontSize: 13, fontWeight: 700 }}>{t.steps} steps · Ages {t.min_age}+</div>
                {t.safety && <span className="mt-1 inline-block rounded-full bg-[#FDE68A] px-2 py-0.5 text-[12px] font-extrabold text-[#92400E]">With a grown-up</span>}
              </button>
            )
          })}
        </div>
        <button type="button" onClick={onBack} style={{ marginTop: 14, width: '100%', background: 'rgba(124,79,224,.06)', border: '1px solid rgba(124,79,224,.15)', color: 'rgba(58,46,107,.6)', borderRadius: 12, padding: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          Back
        </button>
      </div>
    </div>
  )
}
