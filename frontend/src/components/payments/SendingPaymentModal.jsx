import { AlertTriangle, Check, Timer } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import useDialogA11y from './useDialogA11y'
import { useElapsedTimer } from './usePaymentSubmit'
import { formatElapsed } from './submitController'
import { SLOW_AFTER_SECONDS } from './sendingConfig'

const PAO = { normal: '/pao/pao-game-poses/pao-game-read.png', slow: '/pao/png/pao-calm.png' } // reading / calm
const RING = 112
const STROKE = 10
const R = (RING - STROKE) / 2
const C = 2 * Math.PI * R

// Only these small pieces re-render every second.
function ElapsedChip({ startedAt, frozen, slow }) {
  const ms = useElapsedTimer(startedAt, !frozen)
  return (
    <p className={`m-0 mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${slow ? 'bg-amber-100 text-amber-900' : 'bg-blue-100 text-blue-800'}`}>
      <Timer size={13} aria-hidden="true" />
      <span>Elapsed <span className="font-mono tabular-nums">{formatElapsed(ms)}</span></span>
      <span aria-hidden="true">·</span>
      <span>{slow ? 'taking longer than usual' : `usually under ${SLOW_AFTER_SECONDS} sec`}</span>
    </p>
  )
}
function StepTime({ step, startedAt, frozen }) {
  const running = useElapsedTimer(startedAt, !frozen && step.status === 'active')
  let text = '—'
  if (step.status === 'done') text = formatElapsed(step.durationMs || 0)
  else if (step.status === 'active') text = formatElapsed(running - (step.startOffsetMs || 0))
  const color = step.status === 'done' ? 'text-green-700' : step.status === 'active' ? (step.amber ? 'text-amber-700' : 'text-slate-600') : 'text-slate-400'
  return <span className={`shrink-0 pt-0.5 font-mono text-xs font-bold tabular-nums ${color}`}>{text}</span>
}

function StepIcon({ step }) {
  if (step.status === 'done') return <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-white"><Check size={13} strokeWidth={4} aria-hidden="true" /></span>
  if (step.status === 'active') return <span className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${step.amber ? 'border-amber-200' : 'border-green-200'}`}><span className={`h-3 w-3 animate-spin rounded-full border-2 border-transparent motion-reduce:animate-none ${step.amber ? 'border-t-amber-500' : 'border-t-green-500'}`} aria-hidden="true" /></span>
  return <span className="flex h-6 w-6 rounded-full border-2 border-dashed border-slate-300" />
}

// The modal shown while the proof request runs. It is controlled: everything on screen comes from the real submit state.
//   state          'normal' | 'slow'
//   startedAt      when the request started (the timers are computed from it); elapsedMs overrides it for tests / static views
//   uploadPercent  0..100, or null when the browser reports no progress (then the ring is indeterminate)
//   steps          see sendingSteps.js
//   finished       the server confirmed: the ring fills, all steps tick, then the parent opens the success modal
export default function SendingPaymentModal({ state = 'normal', startedAt, elapsedMs, uploadPercent, steps, therapist, finished = false, onKeepWaiting, onCancel }) {
  const slow = state === 'slow' && !finished
  const ref = useDialogA11y({ locked: true })
  const keepRef = useRef(null)
  const [paoOk, setPaoOk] = useState(true)
  const [announce, setAnnounce] = useState('')

  const savingStep = steps.find((s) => s.id === 'saving')
  const indeterminate = uploadPercent === null || uploadPercent === undefined
  const pct = finished ? 100 : Math.min(100, Math.max(0, uploadPercent || 0))
  const ringColor = finished ? '#22c55e' : slow ? '#f59e0b' : '#22c55e'
  const t0 = startedAt || (elapsedMs !== undefined ? Date.now() - elapsedMs : null)

  // Screen-reader milestones (never the timer).
  useEffect(() => { if (finished) setAnnounce('Payment recorded') }, [finished])
  useEffect(() => { if (slow) setAnnounce('This is taking longer than usual') }, [slow])
  useEffect(() => { if (savingStep?.detail === 'Saving…') setAnnounce('Receipt uploaded') }, [savingStep?.detail])

  // In the slow state the default focus is "Keep waiting".
  useEffect(() => { if (slow) keepRef.current?.focus() }, [slow])

  const title = finished ? 'Payment recorded' : slow ? 'This is taking a bit longer…' : 'Sending your payment details…'
  const subtitle = finished ? `Delivered to ${therapist || 'your therapist'}.` : slow ? "Hang tight. We're still saving your payment." : 'This usually takes a few seconds.'

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-900/60 p-3 pt-28 sm:p-4 sm:pt-32">
      <div
        ref={ref} role="dialog" aria-modal="true" aria-labelledby="spm-title" aria-describedby="spm-sub" aria-busy={!finished} tabIndex={-1}
        className="relative w-full max-w-[480px] rounded-3xl bg-white px-5 pb-5 pt-10 text-slate-800 shadow-2xl outline-none [color-scheme:light] sm:px-8 sm:pb-7 sm:pt-12"
      >
        {paoOk && <img key={slow ? 'slow' : 'normal'} src={slow ? PAO.slow : PAO.normal} alt="" onError={() => setPaoOk(false)} className="pointer-events-none absolute -top-[84px] left-1/2 h-[110px] w-auto -translate-x-1/2 select-none sm:-top-[118px] sm:h-[150px]" />}

        <div className="flex flex-col items-center text-center">
          <h2 id="spm-title" className="m-0 text-[22px] font-extrabold leading-tight sm:text-2xl">{title}</h2>
          <p id="spm-sub" className="m-0 mt-1 text-sm text-slate-500">{subtitle}</p>

          {/* Real upload progress. Indeterminate (no number) when the browser cannot report it. */}
          <div
            className="relative mt-4" style={{ width: RING, height: RING }}
            role="progressbar" aria-label="Upload progress" aria-valuemin={0} aria-valuemax={100} {...(indeterminate && !finished ? {} : { 'aria-valuenow': pct })}
          >
            <svg width={RING} height={RING} viewBox={`0 0 ${RING} ${RING}`} className={indeterminate && !finished ? 'animate-spin motion-reduce:animate-none' : ''} aria-hidden="true">
              <circle cx={RING / 2} cy={RING / 2} r={R} fill="none" stroke="#e5e7eb" strokeWidth={STROKE} />
              <circle
                cx={RING / 2} cy={RING / 2} r={R} fill="none" stroke={ringColor} strokeWidth={STROKE} strokeLinecap="round"
                strokeDasharray={C} strokeDashoffset={indeterminate && !finished ? C * 0.72 : C * (1 - pct / 100)}
                transform={`rotate(-90 ${RING / 2} ${RING / 2})`} className="transition-[stroke-dashoffset,stroke] duration-300 motion-reduce:transition-none"
              />
            </svg>
            {(!indeterminate || finished) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[26px] font-extrabold leading-none tabular-nums">{pct}%</span>
                <span className="mt-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">{finished ? 'Done' : 'Uploaded'}</span>
              </div>
            )}
          </div>

          {t0 && <ElapsedChip startedAt={t0} frozen={finished} slow={slow} />}
        </div>

        <ol className="m-0 mt-5 list-none p-0">
          {steps.map((s, i) => (
            <li key={s.id} className="relative flex items-start gap-3 pb-4 last:pb-0">
              {i < steps.length - 1 && <span className={`absolute left-[11px] top-7 h-[calc(100%-18px)] w-px ${s.status === 'done' ? 'bg-green-400' : 'bg-slate-200'}`} aria-hidden="true" />}
              <span className="relative z-[1] mt-0.5 bg-white"><StepIcon step={s} /></span>
              <span className="min-w-0 flex-1 text-left">
                <span className={`block text-sm font-bold ${s.status === 'waiting' ? 'text-slate-400' : 'text-slate-800'}`}>{s.title}<span className="sr-only">{s.status === 'done' ? ' (done)' : s.status === 'active' ? ' (in progress)' : ' (waiting)'}</span></span>
                <span className="block text-xs text-slate-500">{s.detail}</span>
              </span>
              {t0 && <StepTime step={s} startedAt={t0} frozen={finished} />}
            </li>
          ))}
        </ol>

        {slow ? (
          <>
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs leading-relaxed text-amber-900">
              <p className="m-0 flex items-center gap-1.5 text-[13px] font-extrabold"><AlertTriangle size={14} aria-hidden="true" /> Your connection looks slow.</p>
              <p className="m-0 mt-1">Your details are safe and your time slot is still reserved. Please keep this window open. If it keeps stalling, you can cancel and try again without paying twice.</p>
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={onCancel} className="min-h-[46px] flex-1 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-pm-green/50">Cancel &amp; try again</button>
              <button type="button" ref={keepRef} data-autofocus onClick={() => { onKeepWaiting?.(); ref.current?.focus() }} className="min-h-[46px] flex-1 rounded-xl bg-pm-green text-sm font-bold text-white shadow-sm hover:bg-pm-green-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-pm-green/50">Keep waiting</button>
            </div>
          </>
        ) : (
          <p className="mt-4 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-xs font-medium text-slate-600"><AlertTriangle size={14} className="shrink-0 text-slate-400" aria-hidden="true" /> Please don&apos;t close this window, refresh, or press Back.</p>
        )}

        <span className="sr-only" role="status" aria-live="polite">{announce}</span>
      </div>
    </div>
  )
}
