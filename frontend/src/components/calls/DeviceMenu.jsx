import { useEffect, useRef } from 'react'

function Row({ label, devices, selected, onSelect }) {
  if (!devices?.length) return null
  return (
    <label className="cl-dev-row"><span>{label}</span>
      <select value={selected || ''} onChange={(e) => onSelect(e.target.value)}>
        {devices.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Default'}</option>)}
      </select>
    </label>
  )
}

// Small popover to choose microphone, camera and speaker.
export default function DeviceMenu({ media, onClose, only }) {
  const ref = useRef(null)
  useEffect(() => {
    const down = (e) => { if (ref.current && !ref.current.contains(e.target) && !e.target.closest('.cl-ctrl')) onClose() }
    document.addEventListener('mousedown', down)
    return () => document.removeEventListener('mousedown', down)
  }, [onClose])
  return (
    <div className="cl-dev-menu" ref={ref} role="dialog" aria-label="Device settings">
      {(!only || only === 'mic') && <Row label="Microphone" devices={media.micDevices} selected={media.micSelected} onSelect={(id) => media.microphone.select(id)} />}
      {(!only || only === 'camera') && <Row label="Camera" devices={media.camDevices} selected={media.camSelected} onSelect={(id) => media.camera.select(id)} />}
      {(!only || only === 'speaker') && media.speakerSupported && <Row label="Speaker" devices={media.speakerDevices} selected={media.speakerSelected} onSelect={(id) => media.speaker.select(id)} />}
    </div>
  )
}
