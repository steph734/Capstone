import { useState } from 'react'
import PandaMascot from '../games/PandaMascot'
import { OutfitThumbnail } from '../games/PaoOutfits'
import {
  DesignedOutfitThumbnail, DESIGN_STYLES, DESIGN_PATTERNS, DESIGN_COLOURS,
  DESIGN_DECALS, DEFAULT_DESIGNS,
} from '../games/PaoDesignedOutfit'
import { PAO_ITEM_CATEGORIES } from '../../data/paoItems'
import { ShirtIcon, ShuffleIcon } from './gamifiedIcons'

const CATEGORY_ICONS = { Hair: '🎩', Clothes: '👕', Pants: '👖', Shoes: '👟' }

const COLOUR_NAMES = {
  '#ef4444': 'red', '#f97316': 'orange', '#fbbf24': 'yellow', '#84cc16': 'lime',
  '#22c55e': 'green', '#14b8a6': 'teal', '#38bdf8': 'sky blue', '#3b82f6': 'blue',
  '#6366f1': 'indigo', '#8b5cf6': 'purple', '#ec4899': 'pink', '#f9a8d4': 'light pink',
  '#a16207': 'brown', '#1f2937': 'black', '#9ca3af': 'grey', '#ffffff': 'white',
}

const catKey = (category) => String(category || 'Hair').toLowerCase()

// A plain-language line for the wardrobe list when the admin leaves the
// description blank, e.g. "Blue beanie with a stars pattern and a 🚀 sticker".
export function describeDesign(category, design) {
  const style = DESIGN_STYLES[catKey(category)]?.find((s) => s.id === design.style)
  const colour = COLOUR_NAMES[String(design.main).toLowerCase()] || 'custom-colour'
  const pattern = design.pattern && design.pattern !== 'solid'
    ? ` with a ${DESIGN_PATTERNS.find((p) => p.id === design.pattern)?.label.toLowerCase()} pattern`
    : ''
  const decal = design.decal ? `${pattern ? ' and' : ' with'} a ${design.decal} sticker` : ''
  const text = `${colour} ${(style?.label || 'item').toLowerCase()}${pattern}${decal}`
  return text.charAt(0).toUpperCase() + text.slice(1)
}

// Close-up of any wardrobe item — the hand-drawn art for built-in pieces,
// or the designer render for admin-made ones.
export function WardrobeItemThumb({ item, width = 72 }) {
  const cat = catKey(item.category)
  if (item.design) return <DesignedOutfitThumbnail category={cat} design={item.design} width={width} />
  const art = <OutfitThumbnail category={cat} itemId={item.id} width={width} />
  return art || <span style={{ fontSize: width * 0.45 }}>{item.emoji}</span>
}

function ColourRow({ label, value, onChange }) {
  const isCustom = !DESIGN_COLOURS.includes(String(value).toLowerCase())
  return (
    <div className="badge-swatch-field">
      <div className="badge-swatch-head">
        <span>{label}</span>
        <span className="badge-swatch-selected">{COLOUR_NAMES[String(value).toLowerCase()] || value}</span>
      </div>
      <div className="badge-swatch-row">
        {DESIGN_COLOURS.map((hex) => (
          <button
            key={hex}
            type="button"
            className={`badge-swatch${String(value).toLowerCase() === hex ? ' selected' : ''}`}
            onClick={() => onChange(hex)}
            title={COLOUR_NAMES[hex]}
            aria-label={COLOUR_NAMES[hex]}
          >
            <span className="badge-swatch-colour pao-colour-dot" style={{ background: hex }} />
          </button>
        ))}
        <label className={`badge-swatch pao-custom-colour${isCustom ? ' selected' : ''}`} title="Pick any colour">
          <input type="color" value={value} onChange={(event) => onChange(event.target.value)} aria-label={`Custom ${label.toLowerCase()}`} />
          <span className="badge-swatch-colour" style={{ background: isCustom ? value : 'conic-gradient(#ef4444, #fbbf24, #22c55e, #3b82f6, #8b5cf6, #ef4444)' }} />
        </label>
      </div>
    </div>
  )
}

function Step({ number, title, children }) {
  return (
    <section className="pao-designer-step">
      <h4><span>{number}</span>{title}</h4>
      {children}
    </section>
  )
}

export default function PaoClothingDesigner({ item, defaultCategory = 'Hair', onSave, onClose }) {
  const [name, setName] = useState(item?.name || '')
  const [description, setDescription] = useState(item?.description || '')
  const [category, setCategory] = useState(item?.category || defaultCategory)
  // Built-in pieces keep their hand-drawn art until the admin chooses to
  // redesign them; `design` stays null for them until then.
  const [design, setDesign] = useState(
    item ? (item.design || null) : { ...DEFAULT_DESIGNS[catKey(defaultCategory)] },
  )

  const cat = catKey(category)
  const styles = DESIGN_STYLES[cat]
  const isBuiltIn = !design
  const setField = (field, value) => setDesign((d) => ({ ...d, [field]: value }))

  const changeCategory = (next) => {
    if (next === category) return
    setCategory(next)
    // Keep the colours/pattern/sticker the admin picked; only the base
    // template has to change, since each category has its own.
    setDesign((d) => ({ ...(d || DEFAULT_DESIGNS[catKey(next)]), style: DESIGN_STYLES[catKey(next)][0].id }))
  }

  const shuffle = () => {
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
    const main = pick(DESIGN_COLOURS)
    setDesign({
      style: pick(styles).id,
      main,
      trim: pick(DESIGN_COLOURS.filter((c) => c !== main)),
      pattern: pick(DESIGN_PATTERNS).id,
      patternColor: pick(['#ffffff', '#fbbf24', '#1f2937', '#ec4899']),
      decal: Math.random() < 0.6 ? pick(DESIGN_DECALS) : '',
    })
  }

  const submit = (event) => {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) return
    onSave({
      name: trimmedName,
      category,
      description: description.trim() || (design ? describeDesign(category, design) : ''),
      emoji: design ? (design.decal || CATEGORY_ICONS[category]) : item?.emoji,
      ...(design ? { design } : {}),
    })
  }

  const accessories = { [cat]: design ? { design } : item?.id }

  return (
    <div className="admin-modal-backdrop" onClick={onClose}>
      <div className="admin-modal pao-designer-modal" onClick={(event) => event.stopPropagation()}>
        <div className="admin-modal-header">
          <div className="admin-modal-title">
            <span className="admin-modal-icon"><ShirtIcon /></span>
            <div>
              <h3>{item ? `Edit ${item.name}` : 'Design a clothing item'}</h3>
              <p>Pick a style, colours and a sticker — Pao tries it on as you go.</p>
            </div>
          </div>
          <button className="admin-modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form className="admin-modal-form pao-designer-body" onSubmit={submit}>
          <aside className="pao-designer-stage">
            <div className="pao-stage-backdrop">
              <PandaMascot pxWidth={210} pandaState="happy" accessories={accessories} viewPad={{ top: 60, bottom: 0 }} />
            </div>
            <div className="pao-stage-caption">
              <div className="pao-stage-closeup">
                <WardrobeItemThumb item={{ ...item, category, design }} width={64} />
              </div>
              <div>
                <strong>{name.trim() || 'Untitled item'}</strong>
                <span>{CATEGORY_ICONS[category]} {category}</span>
              </div>
            </div>
            {!isBuiltIn && (
              <button type="button" className="badge-shuffle-btn pao-stage-shuffle" onClick={shuffle}>
                <ShuffleIcon size={13} /> Surprise me
              </button>
            )}
          </aside>

          <div className="pao-designer-controls">
            <Step number={1} title="Name & slot">
              <label className="admin-field">
                <span>Item name</span>
                <input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Starry Beanie" required />
              </label>
              <div className="pao-category-row" role="radiogroup" aria-label="Category">
                {PAO_ITEM_CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={category === c}
                    className={category === c ? 'active' : ''}
                    onClick={() => changeCategory(c)}
                    disabled={isBuiltIn && c !== category}
                  >
                    <span aria-hidden="true">{CATEGORY_ICONS[c]}</span>{c}
                  </button>
                ))}
              </div>
            </Step>

            {isBuiltIn ? (
              <div className="pao-builtin-note">
                <p>
                  <strong>{item.name}</strong> uses Pao's original hand-drawn artwork. You can rename it here,
                  or redesign it from scratch — badges that unlock it keep working either way.
                </p>
                <button type="button" className="admin-btn" onClick={() => setDesign({ ...DEFAULT_DESIGNS[cat] })}>
                  Redesign this item
                </button>
              </div>
            ) : (
              <>
                <Step number={2} title="Style">
                  <div className="pao-tile-grid">
                    {styles.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className={`pao-tile${design.style === s.id ? ' selected' : ''}`}
                        onClick={() => setField('style', s.id)}
                      >
                        <span className="pao-tile-art"><DesignedOutfitThumbnail category={cat} design={{ ...design, style: s.id }} width={62} /></span>
                        <span className="pao-tile-label">{s.label}</span>
                      </button>
                    ))}
                  </div>
                </Step>

                <Step number={3} title="Colours">
                  <ColourRow label="Main colour" value={design.main} onChange={(v) => setField('main', v)} />
                  <ColourRow label="Trim colour" value={design.trim} onChange={(v) => setField('trim', v)} />
                </Step>

                <Step number={4} title="Pattern">
                  <div className="pao-tile-grid">
                    {DESIGN_PATTERNS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className={`pao-tile${design.pattern === p.id ? ' selected' : ''}`}
                        onClick={() => setField('pattern', p.id)}
                      >
                        <span className="pao-tile-art"><DesignedOutfitThumbnail category={cat} design={{ ...design, pattern: p.id, decal: '' }} width={62} /></span>
                        <span className="pao-tile-label">{p.label}</span>
                      </button>
                    ))}
                  </div>
                  {design.pattern !== 'solid' && (
                    <ColourRow label="Pattern colour" value={design.patternColor} onChange={(v) => setField('patternColor', v)} />
                  )}
                </Step>

                <Step number={5} title="Sticker">
                  <div className="badge-swatch-row">
                    <button
                      type="button"
                      className={`badge-swatch pao-sticker-none${!design.decal ? ' selected' : ''}`}
                      onClick={() => setField('decal', '')}
                    >
                      None
                    </button>
                    {DESIGN_DECALS.map((glyph) => (
                      <button
                        key={glyph}
                        type="button"
                        className={`badge-swatch${design.decal === glyph ? ' selected' : ''}`}
                        onClick={() => setField('decal', glyph)}
                        aria-label={`Sticker ${glyph}`}
                      >
                        <span className="badge-swatch-symbol">{glyph}</span>
                      </button>
                    ))}
                  </div>
                </Step>
              </>
            )}

            <Step number={isBuiltIn ? 2 : 6} title="Description">
              <label className="admin-field">
                <span>Shown to patients (optional)</span>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder={design ? describeDesign(category, design) : ''}
                />
              </label>
            </Step>
          </div>

          <div className="admin-button-row badge-builder-actions pao-designer-actions">
            <button className="admin-btn" type="submit">{item ? 'Save changes' : 'Add to wardrobe'}</button>
            <button className="admin-btn-secondary" type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}
