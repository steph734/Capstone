import { useId, useState } from 'react'

// A collapsible section. The header is YOURS (renderHeader gets the props for the toggle button), the body animates its height.
//   - the toggle is a real <button> with aria-expanded and aria-controls, so Enter / Space work
//   - the body is `inert` while closed: nothing inside can be focused or read by a screen reader
//   - the height transition is switched off for prefers-reduced-motion
//   - open state lives here (or is controlled with `open` + `onOpenChange`); nothing is stored in localStorage
//
//   <Collapsible defaultOpen={false} renderHeader={({ toggleProps, open }) => <button {...toggleProps}>…</button>}>…</Collapsible>
export default function Collapsible({ defaultOpen = false, open: controlled, onOpenChange, renderHeader, children, className = '', bodyClassName = '' }) {
  const [inner, setInner] = useState(defaultOpen)
  const open = controlled ?? inner
  const id = useId()
  const set = (v) => { if (controlled === undefined) setInner(v); onOpenChange?.(v) }
  const toggleProps = { type: 'button', 'aria-expanded': open, 'aria-controls': id, onClick: () => set(!open) }
  return (
    <div className={className}>
      {renderHeader({ toggleProps, open, toggle: () => set(!open) })}
      <div
        id={id}
        role="region"
        inert={!open}
        aria-hidden={!open}
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
      >
        <div className={`min-h-0 overflow-hidden ${bodyClassName}`}>{children}</div>
      </div>
    </div>
  )
}
