import { useRef, useState } from 'react'
import PandaMascot from '../games/PandaMascot'
import { OutfitThumbnail } from '../games/PaoOutfits'
import {
  DesignedOutfitThumbnail, DESIGN_STYLES, DESIGN_PATTERNS, DESIGN_COLOURS,
  DESIGN_DECALS, DEFAULT_DESIGNS, HAIR_COLOURS,
} from '../games/PaoDesignedOutfit'
import { PAO_ITEM_CATEGORIES } from '../../data/paoItems'
import { PAO_THEMES, themeById } from '../../data/paoThemes'
import { SCHEMA_STYLES, SCHEMA_PATTERNS } from './paoSchemaLimits'
import { ShirtIcon, ShuffleIcon } from './gamifiedIcons'

const CATEGORY_ICONS = { Hair: '💇', Hats: '🎩', Clothes: '👕', Pants: '👖', Shoes: '👟' }

const COLOUR_NAMES = {
  '#ef4444': 'red', '#f97316': 'orange', '#fbbf24': 'yellow', '#84cc16': 'lime',
  '#22c55e': 'green', '#14b8a6': 'teal', '#38bdf8': 'sky blue', '#3b82f6': 'blue',
  '#6366f1': 'indigo', '#8b5cf6': 'purple', '#ec4899': 'pink', '#f9a8d4': 'light pink',
  '#a16207': 'brown', '#1f2937': 'black', '#9ca3af': 'grey', '#ffffff': 'white',
  '#2a1d13': 'black', '#5b3a1e': 'dark brown', '#8b5a2b': 'brown', '#c68642': 'caramel',
  '#f5d17a': 'blonde', '#d9772b': 'ginger', '#e5e7eb': 'silver',
  '#dc2626': 'red', '#16a34a': 'green', '#14532d': 'pine', '#7c3aed': 'violet', '#fef3c7': 'cream',
  '#be123c': 'rose', '#fde68a': 'butter', '#a7f3d0': 'mint', '#c4b5fd': 'lilac', '#bae6fd': 'baby blue',
  '#22d3ee': 'aqua', '#b91c1c': 'dark red',
}

// Theme colours/stickers go first, then everything else.
const themeFirst = (themeList, list) => (themeList ? [...themeList, ...list.filter((x) => !themeList.includes(x))] : list)

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
  const art = <OutfitThumbnail category={cat === 'hats' ? 'hair' : cat} itemId={item.code} width={width} />
  return art || <span style={{ fontSize: width * 0.45 }}>{item.emoji}</span>
}

function ColourRow({ label, value, onChange, options = DESIGN_COLOURS }) {
  const isCustom = !options.includes(String(value).toLowerCase())
  return (
    <div className="badge-swatch-field">
      <div className="badge-swatch-head">
        <span>{label}</span>
        <span className="badge-swatch-selected">{COLOUR_NAMES[String(value).toLowerCase()] || value}</span>
      </div>
      <div className="badge-swatch-row">
        {options.map((hex) => (
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

  const [themeId, setThemeId] = useState(item?.theme || null)
  const theme = themeById(themeId)
  // The name/description a theme filled in, so picking another theme can
  // replace them — but never text the admin typed themselves.
  const autoText = useRef({ name: '', description: '' })

  const cat = catKey(category)
  // Only offer what pao_items/pao_hair can actually save — see
  // paoSchemaLimits.js for why hats/clothes/pants/shoes are more limited
  // than Hair.
  const styles = category === 'Hair' ? DESIGN_STYLES[cat] : DESIGN_STYLES[cat].filter((s) => SCHEMA_STYLES[category]?.includes(s.id))
  const patternOptions = category === 'Hair' ? DESIGN_PATTERNS : DESIGN_PATTERNS.filter((p) => SCHEMA_PATTERNS.includes(p.id))
  const isBuiltIn = !design
  const setField = (field, value) => setDesign((d) => ({ ...d, [field]: value }))

  const applyLook = (nextTheme, nextCategory) => {
    const look = nextTheme?.looks?.[nextCategory]
    if (!look) return false
    setDesign({ ...look.design })
    if (!name.trim() || name === autoText.current.name) setName(look.name)
    if (!description.trim() || description === autoText.current.description) setDescription(look.description)
    autoText.current = { name: look.name, description: look.description }
    return true
  }

  const chooseTheme = (id) => {
    setThemeId(id)
    // Built-in pieces keep their art; the theme just tags them.
    if (!isBuiltIn) applyLook(themeById(id), category)
  }

  const changeCategory = (next) => {
    if (next === category) return
    setCategory(next)
    if (applyLook(theme, next)) return
    // Keep the colours/pattern/sticker the admin picked; only the base
    // template has to change, since each category has its own.
    setDesign((d) => ({ ...(d || DEFAULT_DESIGNS[catKey(next)]), style: DESIGN_STYLES[catKey(next)][0].id }))
  }

  const shuffle = () => {
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
    const colourPool = theme ? theme.colours : DESIGN_COLOURS
    const decalPool = theme ? theme.decals : DESIGN_DECALS
    const main = cat === 'hair' && Math.random() < 0.7 ? pick(HAIR_COLOURS) : pick(colourPool)
    const trimPool = colourPool.filter((c) => c !== main)
    setDesign({
      style: pick(styles).id,
      main,
      trim: pick(trimPool.length ? trimPool : DESIGN_COLOURS),
      pattern: pick(patternOptions).id,
      patternColor: pick(['#ffffff', '#fbbf24', '#1f2937', '#ec4899']),
      decal: Math.random() < 0.6 ? pick(decalPool) : '',
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
      emoji: design ? (design.decal || theme?.icon || CATEGORY_ICONS[category]) : item?.emoji,
      theme: themeId,
      ...(design ? { design } : {}),
    })
  }

  const accessories = { [cat]: design ? { design } : item?.code }

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

            <Step number={2} title="Theme">
              <div className="pao-theme-row" role="radiogroup" aria-label="Theme">
                <button type="button" role="radio" aria-checked={!themeId} className={!themeId ? 'active' : ''} onClick={() => chooseTheme(null)}>
                  Everyday
                </button>
                {PAO_THEMES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="radio"
                    aria-checked={themeId === t.id}
                    className={themeId === t.id ? 'active' : ''}
                    onClick={() => chooseTheme(t.id)}
                  >
                    <span aria-hidden="true">{t.icon}</span>{t.label}
                  </button>
                ))}
              </div>
              {theme && !isBuiltIn && (
                <p className="pao-theme-hint">
                  Started you off with the {theme.label} {category.toLowerCase()} look. Its colours and stickers are listed first below.
                </p>
              )}
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
                <Step number={3} title="Style">
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

                <Step number={4} title="Colours">
                  <ColourRow
                    label={cat === 'hair' ? 'Hair colour' : 'Main colour'}
                    value={design.main}
                    onChange={(v) => setField('main', v)}
                    options={themeFirst(theme?.colours, cat === 'hair' ? [...HAIR_COLOURS, ...DESIGN_COLOURS.filter((c) => !HAIR_COLOURS.includes(c))] : DESIGN_COLOURS)}
                  />
                  <ColourRow
                    label={cat === 'hair' ? 'Hair tie & clip colour' : 'Trim colour'}
                    value={design.trim}
                    onChange={(v) => setField('trim', v)}
                    options={themeFirst(theme?.colours, DESIGN_COLOURS)}
                  />
                </Step>

                <Step number={5} title="Pattern">
                  <div className="pao-tile-grid">
                    {patternOptions.map((p) => (
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
                    <ColourRow
                      label="Pattern colour"
                      value={design.patternColor}
                      onChange={(v) => setField('patternColor', v)}
                      options={themeFirst(theme?.colours, DESIGN_COLOURS)}
                    />
                  )}
                </Step>

                <Step number={6} title={cat === 'hair' ? 'Hair clip' : 'Sticker'}>
                  <div className="badge-swatch-row">
                    <button
                      type="button"
                      className={`badge-swatch pao-sticker-none${!design.decal ? ' selected' : ''}`}
                      onClick={() => setField('decal', '')}
                    >
                      None
                    </button>
                    {themeFirst(theme?.decals, DESIGN_DECALS).map((glyph) => (
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

            <Step number={isBuiltIn ? 3 : 7} title="Description">
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
