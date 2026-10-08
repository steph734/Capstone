# PROMPT: Layered outfits in the "Customize Pao" modal (Hair / Hats / Clothes / Pants / Shoes)

Paste everything below the line into your coding assistant.

---

## Goal
Make the Customize Pao modal show Pao wearing the items the patient picks, combined (a hat + clothes + pants + shoes at the same time), using the new illustrated layers. Fix the wardrobe card icons and the layout problems seen in the screenshots. Pao must remain the same panda.

## Assets (already made)
Copy the folder `pao-layers/` to `public/pao/layers/`:

```
public/pao/layers/base-bottom.svg      shadow, feet, torso
public/pao/layers/base-top.svg         arms + head (idle face)
public/pao/layers/items/<category>-<item_key>-<layer>.svg   (transparent overlays, 15 files)
public/pao/layers/manifest.json        list of every layer file with its z-index
```
Also copy the full-Pao renders from `pao-outfits/` to `public/pao/outfits/` (used for icons and thumbnails, see section 3).

All layer files share ONE viewBox (`0 -40 300 380`). Render them as absolutely positioned `<img>` elements of identical size, stacked with `z-index`. Never scale layers individually.

## 1. Item key mapping
`item_key` = the kebab-case name below. Match it to your existing wardrobe items by name (add an `asset_key` field to each wardrobe item if there is none) and do not rely on array order.

| Category | Item name -> item_key | Layers present |
|---|---|---|
| Hats | Orange Bowtie `orange-bowtie`, Party Hat `party-hat`, Flower Crown `flower-crown`, Wizard Hat `wizard-hat`, Backwards Cap `backwards-cap`, Bunny Ears `bunny-ears`, Thinking Cap `thinking-cap` | `hat` |
| Clothes | Rainbow Tee `rainbow-tee`, Astronaut Suit `astronaut-suit`, Superhero Cape `superhero-cape`, Cozy Hoodie `cozy-hoodie`, Star Overalls `star-overalls`, Echo Scarf `echo-scarf`, Patchwork Puzzle Vest `patchwork-vest` | `back` / `body` / `fore` (see manifest) |
| Pants | Polka Dot Leggings `polka-dot-leggings`, Cargo Shorts `cargo-shorts`, Pajama Pants `pajama-pants`, Denim Overalls `denim-overalls` | `body` |
| Shoes | Rocket Sneakers `rocket-sneakers`, Rain Boots `rain-boots`, Ballet Flats `ballet-flats`, High-Top Stars `high-top-stars` | `fore` |
| Hair | not drawn yet: keep your current hair art and layer it with z = 7 until hair layers exist | |

"Natural" in any category = no layer.

## 2. Stack order (z-index)
```
0  clothes/back          (cape, hood)
1  base-bottom           (shadow, feet, torso)
2  pants/body
3  clothes/body          (tee, vest, overalls, suit, hoodie, cape badge)
4  base-top              (arms + head)
5  clothes/fore + shoes  (sleeves, scarf, shoes)
6  hats/hat
7  hair (existing)
```
Build a `<PaoLayered equipped={{hat, clothes, pants, shoes, hair}} size={260} />` component that reads `manifest.json` once, filters the layers whose `item_key` matches the equipped items, sorts by `z`, and renders them. Preload all layers when the modal opens.

Rules:
- Equipping a new item in a category replaces the old one in that category.
- Equipping Star Overalls (clothes) together with Denim Overalls (pants) is allowed; pants z=2 sits under clothes z=3, so the bib shows over the pants.
- Pose changes: layers are drawn for the standing idle pose. Keep Pao in `idle/blink/hello/talk/listen/point` while any item is equipped (the same outfit-safe rule as the earlier PROMPT-customize-modal.md). If PaoBuddy is used, render it as the base and clip layers to the idle pose only.
- Preview a locked item with a "Try on" ghost: show the layer at 60% opacity with a lock chip. Do NOT equip it, and never show an error or red.

## 3. Wardrobe card icons (fixes the grey silhouettes)
Right now locked cards show a grey silhouette and some items (Hair) show an emoji. Use the PNG renders instead:
- Card icon = `public/pao/outfits/pao-<category>-<item_key>.png` (hats/pants/shoes) or `pao-outfit-<item_key>.png` (clothes), cropped by CSS `object-fit: cover; object-position: <top|center|bottom>` to the relevant body part: hats `50% 8%`, clothes `50% 62%`, pants `50% 88%`, shoes `50% 98%`, scaled 220%.
- Locked cards: keep the real colours at 55% opacity with a small lock chip (not a grey silhouette), so children can still recognise what they are working towards.
- Natural card keeps the panda face emoji/icon.

## 4. Equip feedback (child-friendly)
- On equip: Pao hops once (translateY -10px, 220 ms), sparkle burst at the item's area, soft pop sound, bubble "Ooh, I love it!" (vary the line), spoken if `read_aloud`.
- On a locked item: friendly line "Win <badge name> to get this!" with the badge chip highlighted; no shake, no red.
- Under `calm_visuals` / `prefers-reduced-motion`: no hop or sparkle, crossfade only.
- The summary tiles (HAIR / HATS / CLOTHES / PANTS / SHOES) update immediately and wrap long names with `line-clamp-2`.

## 5. Layout fixes (visible in the screenshots)
- The right preview column is cut off at the bottom: the "Heehee! Welcome to my very own wardrobe" bubble and the Save/Done button are hidden. Make the column `sticky`, `max-height: calc(100vh - 160px)`, `overflow: hidden`, Pao at the top, tiles in the middle, speech bubble under Pao (max 2 lines), and the primary button pinned as a footer.
- Show skeleton cards while "Loading Pao's wardrobe..." instead of plain text.
- Item descriptions on locked cards: raise contrast to WCAG AA.
- The "Orange Bowtie" card description currently says "dsd": replace with "A bright orange bow for Pao's head!" in the data.

## 6. Persistence
Save the equipped item keys per patient (`equipped: { hair, hat, clothes, pants, shoes }`) using the existing equip endpoint; the games-list header Pao (`PaoAvatar` / `PaoBuddy`) must read the same keys and use `<PaoLayered>` so what the patient chose in the modal is what they see everywhere.

## Acceptance checklist
- [ ] Any combination of one hat + one clothes + one pants + one shoes renders with no gaps or misaligned layers
- [ ] Cape appears behind Pao, scarf/shoes/sleeves in front, hats on top of the head
- [ ] Locked cards show real coloured icons with a lock chip, not grey silhouettes
- [ ] No red, buzzer or "wrong" feedback anywhere in the modal
- [ ] Right column and primary button fully visible at 1366x768
- [ ] Equipped outfit shows the same in the modal and the games list header
- [ ] Reduced motion / calm_visuals disables the hop and sparkles
