import { useEffect, useRef, useState } from 'react'
import { ANIMATIONS, DIFFICULTIES, LANGUAGES, SOUNDS, THERAPY_TYPES, checklist } from './model'
import { cropToRatio, listAssets, uploadAsset } from './builderApi'
import { speak } from './speak'

// Right-hand inspector: Element / Level / Game tabs plus the "Ready to
// publish" checklist. Everything calls back with small patches; the page owns
// the document and its undo history.
const GREEN = '#234C40'
const input = { width: '100%', boxSizing: 'border-box', minHeight: 40, borderRadius: 10, border: '1px solid #dbe3df', background: '#f8faf9', padding: '0 10px', fontSize: 13.5, fontFamily: 'inherit', color: '#1f3d36' }
const label = { display: 'block', fontSize: 12, fontWeight: 800, color: '#3a4a45', margin: '12px 0 4px' }
const chip = (on) => ({ minHeight: 36, borderRadius: 999, padding: '0 12px', border: `1.5px solid ${on ? GREEN : '#dbe3df'}`, background: on ? '#e4f2ec' : '#fff', color: '#1f3d36', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' })
const smallBtn = { minHeight: 34, borderRadius: 999, border: '1px solid #dbe3df', background: '#fff', color: '#1f3d36', fontWeight: 700, fontSize: 12.5, padding: '0 12px', cursor: 'pointer', fontFamily: 'inherit' }

function Field({ title, children, hint }) {
  return <div><span style={label}>{title}</span>{children}{hint && <span style={{ display: 'block', fontSize: 11.5, color: '#6b7c75', marginTop: 3 }}>{hint}</span>}</div>
}
function Toggle({ on, onChange, text }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 40, fontSize: 13.5, fontWeight: 700, color: '#1f3d36', cursor: 'pointer' }}>
      {text}
      <input type="checkbox" role="switch" checked={on} onChange={(e) => onChange(e.target.checked)} style={{ width: 40, height: 22, accentColor: GREEN }} />
    </label>
  )
}
function Num({ value, onChange, min, max, ariaLabel }) {
  return <input type="number" aria-label={ariaLabel} style={input} value={value ?? ''} min={min} max={max} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} />
}

// Upload / pick from the library. Calls onPick(asset) with { url, name }.
export function ImagePicker({ onPick, onClose }) {
  const [tab, setTab] = useState('upload')
  const [assets, setAssets] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const file = useRef(null)
  useEffect(() => { if (tab === 'library' && !assets) listAssets().then(setAssets).catch((e) => setError(e.message)) }, [tab, assets])
  useEffect(() => { const k = (e) => { if (e.key === 'Escape') onClose() }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])
  const upload = async (f) => {
    if (!f) return
    setBusy(true); setError('')
    try { onPick(await uploadAsset(f)) } catch (e) { setError(e.message); setBusy(false) }
  }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(20,30,26,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-label="Choose an image" onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 18, padding: 20, width: 'min(520px, 100%)', maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button type="button" style={chip(tab === 'upload')} onClick={() => setTab('upload')}>Upload</button>
          <button type="button" style={chip(tab === 'library')} onClick={() => setTab('library')}>Library</button>
          <button type="button" style={{ ...smallBtn, marginLeft: 'auto' }} onClick={onClose}>Close</button>
        </div>
        {tab === 'upload' ? (
          <div style={{ border: '2px dashed #cfe0d8', borderRadius: 14, padding: 28, textAlign: 'center' }} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files?.[0]) }}>
            <p style={{ margin: '0 0 10px', fontSize: 14, color: '#5d7770' }}>PNG, JPG or WebP, up to 2 MB.</p>
            <button type="button" style={{ ...smallBtn, background: GREEN, color: '#fff', border: 'none', minHeight: 44, padding: '0 20px' }} disabled={busy} onClick={() => file.current?.click()}>{busy ? 'Uploading…' : 'Choose a file'}</button>
            <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={(e) => upload(e.target.files?.[0])} aria-label="Choose an image file" />
          </div>
        ) : !assets ? <p style={{ fontSize: 13 }}>Loading…</p> : assets.length === 0 ? <p style={{ fontSize: 13, color: '#5d7770' }}>No images uploaded yet.</p> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 10 }}>
            {assets.map((a) => (
              <button key={a.id} type="button" onClick={() => onPick(a)} aria-label={`Use ${a.name}`} style={{ border: '1px solid #dbe3df', borderRadius: 12, background: '#fff', padding: 6, cursor: 'pointer' }}>
                <img src={a.url} alt="" style={{ width: '100%', height: 72, objectFit: 'contain' }} /><span style={{ fontSize: 11, color: '#5d7770', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
              </button>
            ))}
          </div>
        )}
        {error && <p role="alert" style={{ color: '#b91c1c', fontSize: 13 }}>{error}</p>}
      </div>
    </div>
  )
}

function ElementTab({ el, level, onProps, onGeom }) {
  const [picker, setPicker] = useState(false)
  const [cropBusy, setCropBusy] = useState(false)
  const [cropErr, setCropErr] = useState('')
  if (!el) return <p style={{ fontSize: 13.5, color: '#5d7770', lineHeight: 1.5 }}>Select an element on the canvas to edit it. Click a template or an element on the left to add one.</p>
  const p = el.props
  const t = el.type
  const slots = level.elements.filter((e) => e.type === 'drop_slot')
  const hasSlots = slots.length > 0
  const speaks = ['image_card', 'voice_prompt', 'pao_helper', 'hint'].includes(t)

  const doCrop = async (ratio) => {
    setCropBusy(true); setCropErr('')
    try {
      const blob = await (await fetch(p.imageUrl)).blob()
      const file = await cropToRatio(new File([blob], 'image.png', { type: blob.type || 'image/png' }), ratio)
      const asset = await uploadAsset(file)
      onProps({ imageUrl: asset.url })
    } catch (e) { setCropErr(e.message || 'Could not crop that image.') } finally { setCropBusy(false) }
  }

  return (
    <div>
      {t === 'image_card' && (
        <>
          <span style={label}>Image</span>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: 12, background: '#f1f5f3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, overflow: 'hidden', flexShrink: 0 }}>
              {p.imageUrl ? <img src={p.imageUrl} alt="" style={{ maxWidth: '100%', maxHeight: '100%' }} /> : p.emoji || '🖼️'}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button type="button" style={smallBtn} onClick={() => setPicker(true)}>{p.imageUrl ? 'Replace' : 'Upload'}</button>
              <button type="button" style={smallBtn} onClick={() => setPicker(true)}>Library</button>
              {p.imageUrl && <button type="button" style={smallBtn} disabled={cropBusy} onClick={() => doCrop(1)}>{cropBusy ? 'Cropping…' : 'Crop 1:1'}</button>}
              {p.imageUrl && <button type="button" style={smallBtn} disabled={cropBusy} onClick={() => doCrop(4 / 3)}>Crop 4:3</button>}
              {p.imageUrl && <button type="button" style={{ ...smallBtn, color: '#b91c1c' }} onClick={() => onProps({ imageUrl: '' })}>Remove</button>}
            </div>
          </div>
          {cropErr && <span role="alert" style={{ color: '#b91c1c', fontSize: 12 }}>{cropErr}</span>}
          <Field title="Alt text (describes the picture for screen readers)" hint={p.imageUrl && !p.alt.trim() ? undefined : undefined}>
            <input style={{ ...input, borderColor: p.imageUrl && !p.alt.trim() ? '#dc2626' : '#dbe3df' }} value={p.alt} maxLength={200} onChange={(e) => onProps({ alt: e.target.value })} aria-invalid={Boolean(p.imageUrl && !p.alt.trim())} />
            {p.imageUrl && !p.alt.trim() && <span style={{ color: '#b91c1c', fontSize: 12 }}>Required for uploaded images.</span>}
          </Field>
          {!p.imageUrl && <Field title="Picture emoji (used when there is no image)"><input style={input} value={p.emoji} maxLength={8} onChange={(e) => onProps({ emoji: e.target.value })} /></Field>}
          {picker && <ImagePicker onClose={() => setPicker(false)} onPick={(a) => { onProps({ imageUrl: a.url, alt: p.alt || '' }); setPicker(false) }} />}
        </>
      )}

      {['image_card', 'button', 'drop_slot'].includes(t) && <Field title={t === 'drop_slot' ? 'Label (optional)' : 'Label'}><input style={input} value={p.label} maxLength={80} onChange={(e) => onProps({ label: e.target.value })} /></Field>}
      {t === 'text' && (
        <>
          <Field title="Text"><textarea style={{ ...input, padding: 10, minHeight: 70 }} rows={2} value={p.text} maxLength={300} onChange={(e) => onProps({ text: e.target.value })} /></Field>
          <Field title="Size"><Num ariaLabel="Text size" value={p.size} min={10} max={120} onChange={(v) => onProps({ size: v ?? 28 })} /></Field>
          <Field title="Colour"><input type="color" aria-label="Text colour" value={p.textColor} onChange={(e) => onProps({ textColor: e.target.value })} style={{ width: 60, height: 36 }} /></Field>
        </>
      )}
      {t === 'hint' && <Field title="Hint text"><input style={input} value={p.text} maxLength={300} onChange={(e) => onProps({ text: e.target.value })} /></Field>}
      {t === 'pao_helper' && <Field title="Pao says"><input style={input} value={p.message} maxLength={200} onChange={(e) => onProps({ message: e.target.value })} /></Field>}
      {t === 'timer' && <Field title="Seconds"><Num ariaLabel="Timer seconds" value={p.seconds} min={5} max={600} onChange={(v) => onProps({ seconds: v ?? 60 })} /></Field>}
      {t === 'button' && (
        <Field title="When tapped">
          <select style={input} value={p.action} onChange={(e) => onProps({ action: e.target.value })}>
            <option value="next">Go to next level (when done)</option><option value="hint">Show a hint</option><option value="restart">Restart the level</option><option value="check">Check answer</option>
          </select>
        </Field>
      )}

      {t === 'drop_slot' && (
        <>
          <Field title="Slot number / key" hint="Cards point at this key as their correct slot."><input style={input} value={p.slot} maxLength={30} onChange={(e) => onProps({ slot: e.target.value.trim() })} /></Field>
          <Toggle on={p.multiple} onChange={(v) => onProps({ multiple: v })} text="Holds several cards (sorting groups)" />
        </>
      )}
      {t === 'image_card' && (hasSlots ? (
        <Field title="Correct slot">
          <select style={{ ...input, borderColor: p.correctSlot && slots.some((s) => s.props.slot === p.correctSlot) ? '#dbe3df' : '#dc2626' }} value={p.correctSlot} onChange={(e) => onProps({ correctSlot: e.target.value })}>
            <option value="">— choose —</option>
            {[...new Set(slots.map((s) => s.props.slot).filter(Boolean))].map((k) => <option key={k} value={k}>{slots.find((s) => s.props.slot === k)?.props.label || k} ({k})</option>)}
          </select>
        </Field>
      ) : <Toggle on={p.isAnswer} onChange={(v) => onProps({ isAnswer: v })} text="This is the correct answer" />)}
      {t === 'speak_answer' && <Field title="Expected spoken answer"><input style={{ ...input, borderColor: p.expected.trim() ? '#dbe3df' : '#dc2626' }} value={p.expected} maxLength={80} onChange={(e) => onProps({ expected: e.target.value })} /></Field>}

      <span style={label}>Size &amp; position</span>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[['x', 'X'], ['y', 'Y'], ['w', 'Width'], ['h', 'Height']].map(([k, l]) => (
          <label key={k} style={{ fontSize: 11.5, fontWeight: 700, color: '#5d7770' }}>{l}<Num ariaLabel={l} value={Math.round(el[k])} onChange={(v) => onGeom({ [k]: v ?? 0 })} /></label>
        ))}
      </div>

      {speaks && (
        <>
          <span style={{ ...label, display: 'flex', justifyContent: 'space-between' }}>Voice (text-to-speech)
            <button type="button" style={{ ...smallBtn, minHeight: 28, padding: '0 10px' }} onClick={() => speak(p.voice || p.label || p.message || p.text, p.language)}>▶ Listen</button></span>
          <input style={input} value={p.voice} maxLength={200} placeholder={`e.g. "Brush your teeth!"`} onChange={(e) => onProps({ voice: e.target.value })} aria-label="Voice prompt" />
          <span style={label}>Language</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{LANGUAGES.map(([id, name]) => <button key={id} type="button" aria-pressed={p.language === id} style={chip(p.language === id)} onClick={() => onProps({ language: id })}>{name}</button>)}</div>
        </>
      )}
      {t === 'image_card' && (
        <>
          <Toggle on={p.readOnTap} onChange={(v) => onProps({ readOnTap: v })} text="Read label when tapped" />
          <Toggle on={p.acceptSpoken} onChange={(v) => onProps({ acceptSpoken: v })} text="Accept spoken answer 🎤" />
          <span style={label}>Feedback</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <label style={{ fontSize: 11.5, fontWeight: 700, color: '#5d7770' }}>If correct
              <select style={input} value={p.sound} onChange={(e) => onProps({ sound: e.target.value })}>{SOUNDS.map(([v, n]) => <option key={v} value={v}>{n} + {p.xp} XP</option>)}</select></label>
            <label style={{ fontSize: 11.5, fontWeight: 700, color: '#5d7770' }}>If wrong
              <select style={input} value={p.onWrong} onChange={(e) => onProps({ onWrong: e.target.value })}><option value="retry">Try again</option><option value="hint">Show a hint</option></select></label>
          </div>
          <label style={{ fontSize: 11.5, fontWeight: 700, color: '#5d7770', display: 'block', marginTop: 8 }}>XP when correct<Num ariaLabel="XP when correct" value={p.xp} min={0} max={500} onChange={(v) => onProps({ xp: v ?? 0 })} /></label>
          <label style={{ fontSize: 11.5, fontWeight: 700, color: '#5d7770', display: 'block', marginTop: 8 }}>Show hint after N wrong tries<Num ariaLabel="Hint after tries" value={p.hintAfter} min={1} max={10} onChange={(v) => onProps({ hintAfter: v ?? 2 })} /></label>
        </>
      )}
      {t === 'sound_effect' && <Field title="Sound"><select style={input} value={p.sound} onChange={(e) => onProps({ sound: e.target.value })}>{SOUNDS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></Field>}
      {['image_card', 'text', 'pao_helper', 'animation', 'star_reward', 'button', 'hint'].includes(t) && (
        <Field title="Animation"><select style={input} value={p.animation} onChange={(e) => onProps({ animation: e.target.value })}>{ANIMATIONS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></Field>
      )}
    </div>
  )
}

function LevelTab({ level, onLevel }) {
  return (
    <div>
      <Field title="Level title"><input style={input} value={level.title} maxLength={80} onChange={(e) => onLevel({ title: e.target.value })} /></Field>
      <span style={label}>Difficulty</span>
      <div style={{ display: 'flex', gap: 6 }}>{DIFFICULTIES.map((d) => <button key={d} type="button" aria-pressed={level.difficulty === d} style={chip(level.difficulty === d)} onClick={() => onLevel({ difficulty: d })}>{d[0].toUpperCase() + d.slice(1)}</button>)}</div>
      <Field title="Instructions (shown on screen)"><textarea style={{ ...input, padding: 10, minHeight: 70 }} rows={2} maxLength={300} value={level.instructions} onChange={(e) => onLevel({ instructions: e.target.value })} /></Field>
      <span style={{ ...label, display: 'flex', justifyContent: 'space-between' }}>Instructions (voice)<button type="button" style={{ ...smallBtn, minHeight: 28, padding: '0 10px' }} onClick={() => speak(level.voice || level.instructions)}>▶ Listen</button></span>
      <input style={input} value={level.voice} maxLength={300} placeholder="Read aloud when the level starts" onChange={(e) => onLevel({ voice: e.target.value })} aria-label="Instructions voice" />
      <Field title="Time limit (seconds, 0 = none)"><Num ariaLabel="Time limit" value={level.timeLimit} min={0} max={600} onChange={(v) => onLevel({ timeLimit: v ?? 0 })} /></Field>
      <span style={label}>Star thresholds (wrong tries allowed)</span>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <label style={{ fontSize: 11.5, fontWeight: 700, color: '#5d7770' }}>⭐⭐⭐ up to<Num ariaLabel="Three-star limit" value={level.stars.three} min={0} max={20} onChange={(v) => onLevel({ stars: { ...level.stars, three: v ?? 0 } })} /></label>
        <label style={{ fontSize: 11.5, fontWeight: 700, color: '#5d7770' }}>⭐⭐ up to<Num ariaLabel="Two-star limit" value={level.stars.two} min={0} max={20} onChange={(v) => onLevel({ stars: { ...level.stars, two: v ?? 2 } })} /></label>
      </div>
      <span style={label}>Background</span>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {['#FFF4DE', '#E3F0FD', '#E3F6EA', '#FDE3E8', '#E9E8FB', '#FFFFFF'].map((c) => (
          <button key={c} type="button" aria-label={`Background ${c}`} aria-pressed={level.background.toLowerCase() === c.toLowerCase()} onClick={() => onLevel({ background: c })}
            style={{ width: 36, height: 36, borderRadius: '50%', background: c, border: level.background.toLowerCase() === c.toLowerCase() ? `3px solid ${GREEN}` : '2px solid #dbe3df', cursor: 'pointer' }} />
        ))}
        <input type="color" aria-label="Custom background" value={level.background} onChange={(e) => onLevel({ background: e.target.value })} style={{ width: 40, height: 36 }} />
      </div>
    </div>
  )
}

function GameTab({ meta, onMeta, legacy }) {
  const [picker, setPicker] = useState(false)
  return (
    <div>
      {legacy && <p style={{ background: '#FFF7E0', border: '1px solid #F3D284', borderRadius: 10, padding: 10, fontSize: 12.5, color: '#7a4b06', lineHeight: 1.45 }}>This is a built-in game. You can change its details here; its gameplay is part of the app.</p>}
      <Field title="Description"><textarea style={{ ...input, padding: 10, minHeight: 80 }} rows={3} maxLength={500} value={meta.description} onChange={(e) => onMeta({ description: e.target.value })} /></Field>
      <Field title="Skill area / therapy type">
        <select style={input} value={meta.therapyType || ''} onChange={(e) => onMeta({ therapyType: e.target.value || null, skillArea: THERAPY_TYPES.find(([v]) => v === e.target.value)?.[1] || '' })}>
          <option value="">— choose —</option>{THERAPY_TYPES.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
        </select>
      </Field>
      <span style={label}>Difficulty</span>
      <div style={{ display: 'flex', gap: 6 }}>{DIFFICULTIES.map((d) => <button key={d} type="button" aria-pressed={meta.difficulty === d} style={chip(meta.difficulty === d)} onClick={() => onMeta({ difficulty: d })}>{d[0].toUpperCase() + d.slice(1)}</button>)}</div>
      <span style={label}>Age range</span>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center' }}>
        <Num ariaLabel="Age from" value={meta.ageMin} min={0} max={99} onChange={(v) => onMeta({ ageMin: v })} /><span style={{ color: '#5d7770' }}>to</span><Num ariaLabel="Age to" value={meta.ageMax} min={0} max={99} onChange={(v) => onMeta({ ageMax: v })} />
      </div>
      {meta.ageMin != null && meta.ageMax != null && meta.ageMin > meta.ageMax && <span role="alert" style={{ color: '#b91c1c', fontSize: 12 }}>The first age must not be above the second.</span>}
      <Field title="Points per play"><Num ariaLabel="Points per play" value={meta.pointsPerPlay} min={0} max={10000} onChange={(v) => onMeta({ pointsPerPlay: v })} /></Field>
      <Field title="Badge name (earned for finishing)"><input style={input} value={meta.badgeName} maxLength={80} placeholder={meta.name} onChange={(e) => onMeta({ badgeName: e.target.value })} /></Field>
      <span style={label}>Icon / thumbnail</span>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input style={{ ...input, width: 70, textAlign: 'center', fontSize: 22 }} value={meta.icon} maxLength={8} onChange={(e) => onMeta({ icon: e.target.value })} aria-label="Icon emoji" />
        {meta.thumbnailUrl && <img src={meta.thumbnailUrl} alt="Game thumbnail" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />}
        <button type="button" style={smallBtn} onClick={() => setPicker(true)}>{meta.thumbnailUrl ? 'Change image' : 'Upload image'}</button>
        <input type="color" aria-label="Card colour" value={meta.color} onChange={(e) => onMeta({ color: e.target.value })} style={{ width: 40, height: 36 }} />
      </div>
      {picker && <ImagePicker onClose={() => setPicker(false)} onPick={(a) => { onMeta({ thumbnailUrl: a.url }); setPicker(false) }} />}
      <Field title="Note for therapists"><textarea style={{ ...input, padding: 10, minHeight: 80 }} rows={3} maxLength={1000} value={meta.therapistNote} onChange={(e) => onMeta({ therapistNote: e.target.value })} /></Field>
    </div>
  )
}

export function Checklist({ doc, testPlayed }) {
  const c = checklist(doc, { testPlayed })
  return (
    <div style={{ background: '#f4f8f6', borderRadius: 14, padding: 14, marginTop: 16 }} aria-label="Ready to publish">
      <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: '#1f3d36' }}>Ready to publish · {c.done} of {c.total}</p>
      <div style={{ height: 6, borderRadius: 4, background: '#dfe8e4', margin: '8px 0 10px' }}><div style={{ height: '100%', borderRadius: 4, width: `${(c.done / c.total) * 100}%`, background: GREEN }} /></div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, fontSize: 12.5 }}>
        {c.items.map((i) => (
          <li key={i.id} style={{ padding: '3px 0', color: i.ok ? '#1f3d36' : '#9a3412' }}>
            <span aria-hidden="true">{i.ok ? '✓' : '✕'}</span> <span className="sr-only">{i.ok ? 'Done: ' : 'To do: '}</span>{i.label}
            {!i.ok && <span style={{ display: 'block', marginLeft: 16, color: '#6b7c75' }}>{i.hint}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function Inspector({ tab, onTab, doc, level, selected, legacy, testPlayed, onElementProps, onElementGeom, onLevel, onMeta }) {
  return (
    <aside aria-label="Inspector" style={{ width: 330, flexShrink: 0, borderLeft: '1px solid #e3e8e4', background: '#fff', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div role="tablist" style={{ display: 'flex', borderBottom: '1px solid #e3e8e4' }}>
        {[['element', 'Element'], ['level', 'Level'], ['game', 'Game']].map(([id, name]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => onTab(id)}
            style={{ flex: 1, minHeight: 46, border: 'none', borderBottom: `3px solid ${tab === id ? GREEN : 'transparent'}`, background: 'transparent', fontWeight: 800, fontSize: 14, color: tab === id ? GREEN : '#5d7770', cursor: 'pointer', fontFamily: 'inherit' }}>{name}</button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 20px' }}>
        {tab === 'element' && !legacy && <ElementTab el={selected} level={level} onProps={(p) => selected && onElementProps(selected.id, p)} onGeom={(g) => selected && onElementGeom(selected.id, g)} />}
        {tab === 'element' && legacy && <p style={{ fontSize: 13.5, color: '#5d7770' }}>Built-in games have no editable elements.</p>}
        {tab === 'level' && !legacy && <LevelTab level={level} onLevel={onLevel} />}
        {tab === 'level' && legacy && <p style={{ fontSize: 13.5, color: '#5d7770' }}>Built-in games have no levels to edit here.</p>}
        {tab === 'game' && <GameTab meta={doc.meta} onMeta={onMeta} legacy={legacy} />}
        {!legacy && <Checklist doc={doc} testPlayed={testPlayed} />}
      </div>
    </aside>
  )
}
