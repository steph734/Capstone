import { useRef } from 'react'

// A real radiogroup (role="radiogroup" / role="radio", roving tabindex, arrow keys) drawn by hand, because the app's global
// reset hides native radio buttons. variant "list" = the reason lists; "cards" = the big "what should happen next" cards.
//   options: [{ value, label, desc?, disabled? }]
export default function RadioGroup({ labelledBy, describedBy, value, onChange, options, variant = 'list', tone = 'green', invalid = false }) {
  const refs = useRef([])
  const enabled = options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0)
  const tabbable = options.findIndex((o) => o.value === value && !o.disabled) >= 0 ? options.findIndex((o) => o.value === value) : enabled[0]

  const move = (from, dir) => {
    const at = enabled.indexOf(from)
    const next = enabled[(at + dir + enabled.length) % enabled.length]
    onChange(options[next].value)
    refs.current[next]?.focus()
  }
  const onKeyDown = (e, i) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); move(i, 1) }
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); move(i, -1) }
  }

  const accent = tone === 'red' ? { ring: 'border-[#DC2626]', fill: 'bg-[#DC2626]', row: 'border-[#F7B7B7] bg-[#FFF1F1]' } : { ring: 'border-[#16A34A]', fill: 'bg-[#16A34A]', row: 'border-[#BFE6CD] bg-[#F1FAF4]' }

  return (
    <div
      role="radiogroup" aria-labelledby={labelledBy} aria-describedby={describedBy} aria-invalid={invalid || undefined}
      className={variant === 'cards' ? 'grid grid-cols-1 gap-3 sm:grid-cols-2' : `flex flex-col gap-0.5 rounded-2xl ${invalid ? 'border border-[#F2A5A5] bg-[#FFF5F5] p-1' : 'p-0'}`}
    >
      {options.map((o, i) => {
        const on = o.value === value
        return (
          <button
            key={o.value} ref={(el) => { refs.current[i] = el }} type="button" role="radio" aria-checked={on} disabled={o.disabled}
            tabIndex={i === tabbable ? 0 : -1} onClick={() => onChange(o.value)} onKeyDown={(e) => onKeyDown(e, i)}
            className={variant === 'cards'
              ? `rounded-2xl border-2 p-3.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A]/50 disabled:cursor-not-allowed disabled:opacity-50 ${on ? 'border-[#16A34A] bg-[#F1FAF4]' : 'border-[#E3EDE8] bg-white hover:border-[#C9DAD2]'}`
              : `flex min-h-[44px] w-full items-center gap-3 rounded-xl border px-3 text-left text-[15px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A]/50 ${on ? accent.row : 'border-transparent bg-transparent hover:bg-[#F6FAF8]'}`}
          >
            {variant === 'cards' ? (
              <>
                <span className="block text-[15px] font-extrabold">{o.label}</span>
                {o.desc && <span className="mt-1 block text-[13px] leading-snug text-[#5B7469]">{o.desc}</span>}
              </>
            ) : (
              <>
                <span className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 ${on ? accent.ring : 'border-[#B9C9C1]'}`} aria-hidden="true">{on && <span className={`h-2.5 w-2.5 rounded-full ${accent.fill}`} />}</span>
                <span className="font-medium">{o.label}</span>
              </>
            )}
          </button>
        )
      })}
    </div>
  )
}
