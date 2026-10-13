import { useEffect, useState } from 'react'
import { ELEMENT_CATALOG, TEMPLATES } from './model'
import { listAssets } from './builderApi'

// Left side: the tool rail (Build, Media, Audio, Rewards, Rules, History) and
// the panel of the selected tool. Elements can be dragged onto the canvas or
// clicked to add at the centre (keyboard friendly).
const GREEN = '#234C40'
const TOOLS = [['build', '🧩', 'Build'], ['media', '🖼', 'Media'], ['audio', '🔊', 'Audio'], ['rewards', '🏆', 'Rewards'], ['rules', '📐', 'Rules'], ['history', '🕘', 'History']]
const when = (d) => new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
const KIND = { create: 'Created', autosave: 'Autosave checkpoint', draft: 'Saved draft', publish: 'Published', restore: 'Restored' }
const tile = { minHeight: 64, borderRadius: 14, border: '1px solid #e3e8e4', background: '#fff', padding: '8px 6px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, color: '#1f3d36' }
const heading = { fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6b7c75', margin: '14px 0 8px' }

function ElementTile({ c, onAdd }) {
  return (
    <button type="button" draggable onDragStart={(e) => { e.dataTransfer.setData('application/x-gb-type', c.type); e.dataTransfer.effectAllowed = 'copy' }} onClick={() => onAdd(c.type)} style={tile} aria-label={`Add ${c.label}`}>
      <span style={{ fontSize: 22 }} aria-hidden="true">{c.icon}</span>{c.label}
    </button>
  )
}

export default function LeftRail({ tool, onTool, doc, settings, onTemplate, onAdd, onAddImage, onSettings, versions, onRestore, canRestore, disabled }) {
  const [q, setQ] = useState('')
  const [assets, setAssets] = useState(null)
  useEffect(() => { if (tool === 'media' && !assets) listAssets().then(setAssets).catch(() => setAssets([])) }, [tool, assets])
  const needle = q.trim().toLowerCase()
  const templates = TEMPLATES.filter((t) => !needle || t.label.toLowerCase().includes(needle))
  const elements = ELEMENT_CATALOG.filter((c) => !needle || c.label.toLowerCase().includes(needle))
  const only = (types) => ELEMENT_CATALOG.filter((c) => types.includes(c.type))

  return (
    <div style={{ display: 'flex', flexShrink: 0, borderRight: '1px solid #e3e8e4', background: '#fff', minHeight: 0, opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto' }} aria-label="Tools">
      <nav aria-label="Tool rail" style={{ width: 72, borderRight: '1px solid #eef2f0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '10px 0' }}>
        {TOOLS.map(([id, icon, name]) => (
          <button key={id} type="button" aria-pressed={tool === id} onClick={() => onTool(id)}
            style={{ width: 58, minHeight: 56, borderRadius: 14, border: 'none', background: tool === id ? '#e4f2ec' : 'transparent', color: tool === id ? GREEN : '#5d7770', fontWeight: 800, fontSize: 11.5, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, fontFamily: 'inherit' }}>
            <span style={{ fontSize: 20 }} aria-hidden="true">{icon}</span>{name}
          </button>
        ))}
      </nav>
      <div style={{ width: 290, overflowY: 'auto', padding: '14px 14px 24px' }}>
        {tool === 'build' && (
          <>
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search elements…" aria-label="Search elements" style={{ width: '100%', boxSizing: 'border-box', minHeight: 42, borderRadius: 12, border: '1px solid #dbe3df', background: '#f8faf9', padding: '0 12px', fontFamily: 'inherit', fontSize: 14 }} />
            {templates.length > 0 && <p style={heading}>Game template</p>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {templates.map((t) => (
                <button key={t.id} type="button" onClick={() => onTemplate(t.id)} aria-pressed={doc.meta.template === t.id}
                  style={{ ...tile, border: `2px solid ${doc.meta.template === t.id ? '#1FA58A' : '#e3e8e4'}`, background: doc.meta.template === t.id ? '#ecfaf5' : '#fff' }}>
                  <span style={{ fontSize: 24 }} aria-hidden="true">{t.icon}</span>{t.label}
                </button>
              ))}
            </div>
            {elements.length > 0 && <p style={heading}>Elements · drag onto the screen</p>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>{elements.map((c) => <ElementTile key={c.type} c={c} onAdd={onAdd} />)}</div>
            {!templates.length && !elements.length && <p style={{ fontSize: 13, color: '#5d7770' }}>Nothing matches “{q}”.</p>}
          </>
        )}

        {tool === 'media' && (
          <>
            <p style={heading}>Images</p>
            <p style={{ fontSize: 12.5, color: '#5d7770', margin: '0 0 10px' }}>Click an image to add it as a card. Upload new ones from an image card’s inspector.</p>
            {!assets ? <p style={{ fontSize: 13 }}>Loading…</p> : assets.length === 0 ? <p style={{ fontSize: 13, color: '#5d7770' }}>No images uploaded yet.</p> : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {assets.map((a) => (
                  <button key={a.id} type="button" onClick={() => onAddImage(a)} aria-label={`Add ${a.name} as a card`} style={{ ...tile, minHeight: 90 }}>
                    <img src={a.url} alt="" style={{ maxWidth: '100%', maxHeight: 56, objectFit: 'contain' }} /><span style={{ fontSize: 11, fontWeight: 600, color: '#5d7770', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {tool === 'audio' && (
          <>
            <p style={heading}>Voice &amp; sound</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>{only(['voice_prompt', 'speak_answer', 'sound_effect']).map((c) => <ElementTile key={c.type} c={c} onAdd={onAdd} />)}</div>
            <p style={{ fontSize: 12.5, color: '#5d7770', lineHeight: 1.5, marginTop: 14 }}>Each card, voice prompt and level can speak text aloud in English, Filipino or Bisaya. Bisaya has no voice of its own in most browsers, so it uses a Filipino voice.</p>
          </>
        )}

        {tool === 'rewards' && (
          <>
            <p style={heading}>Rewards &amp; helpers</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>{only(['star_reward', 'animation', 'pao_helper', 'hint']).map((c) => <ElementTile key={c.type} c={c} onAdd={onAdd} />)}</div>
            <p style={{ fontSize: 12.5, color: '#5d7770', lineHeight: 1.5, marginTop: 14 }}>Stars come from how many wrong tries a level took (set in the Level tab). Points per play and the badge are set in the Game tab.</p>
          </>
        )}

        {tool === 'rules' && (
          <>
            <p style={heading}>How a level is judged</p>
            <ul style={{ fontSize: 13, color: '#3a4a45', lineHeight: 1.6, paddingLeft: 18, margin: 0 }}>
              <li><strong>Drop slots</strong> on the screen → drag each card to its correct slot.</li>
              <li><strong>A speak answer</strong> → the child says the expected word.</li>
              <li><strong>Neither</strong> → tap the card marked “correct answer”.</li>
            </ul>
            <p style={heading}>Canvas</p>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 40, fontSize: 13.5, fontWeight: 700 }}>Snap to grid<input type="checkbox" checked={settings.snap} onChange={(e) => onSettings({ snap: e.target.checked })} style={{ width: 22, height: 22, accentColor: GREEN }} /></label>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 40, fontSize: 13.5, fontWeight: 700 }}>Grid size<select value={settings.grid} onChange={(e) => onSettings({ grid: Number(e.target.value) })} style={{ minHeight: 36, borderRadius: 8, border: '1px solid #dbe3df' }}>{[4, 8, 16, 32].map((g) => <option key={g} value={g}>{g}px</option>)}</select></label>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 40, fontSize: 13.5, fontWeight: 700 }}>Read levels aloud<input type="checkbox" checked={settings.readAloud} onChange={(e) => onSettings({ readAloud: e.target.checked })} style={{ width: 22, height: 22, accentColor: GREEN }} /></label>
            <p style={{ fontSize: 12, color: '#6b7c75' }}>Hold Alt while dragging to ignore the grid. Arrow keys nudge; Delete removes; Ctrl+D duplicates.</p>
          </>
        )}

        {tool === 'history' && (
          <>
            <p style={heading}>Versions</p>
            {versions.length === 0 ? <p style={{ fontSize: 13, color: '#5d7770' }}>Versions appear here once the game is saved.</p> : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {versions.map((v, i) => (
                  <li key={`${v.version}-${v.kind}`} style={{ padding: '10px 0', borderTop: i ? '1px solid #eef2f0' : 'none' }}>
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: '#1f3d36' }}>v{v.version} · {KIND[v.kind] || v.kind}</div>
                    <div style={{ fontSize: 12, color: '#6b7c75' }}>{when(v.savedAt)} · {v.by}{v.note ? ` · ${v.note}` : ''}</div>
                    <button type="button" disabled={!canRestore} onClick={() => onRestore(v)} style={{ marginTop: 6, minHeight: 34, borderRadius: 999, border: '1px solid #dbe3df', background: '#fff', fontWeight: 700, fontSize: 12.5, padding: '0 14px', cursor: 'pointer', fontFamily: 'inherit' }}>Restore this version</button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  )
}
