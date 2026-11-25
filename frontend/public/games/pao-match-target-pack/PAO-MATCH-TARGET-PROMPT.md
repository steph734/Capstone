# Prompt: Make the live Customize Pao look exactly like the target design

Reference images: 245 (live app vs target, with 7 numbered differences), 246 (layout and sizes), 242 and 243 (the target screens). **Reference files (the source of truth):** `target/customize-pao-target-hats-equipped.html`, `target/customize-pao-target-locked-item.html`, `target/customize-pao-target-pose-and-outfit.html`.

## Read this first
The last attempt added the speech bubble inside the old scrolling panel and kept the old cards and the flat Pao picture, so the screen still looks like the old design. Do **not** patch the existing components. **Rebuild the modal body from the target HTML files** and port them to React one for one.

Open each target HTML file in the browser (double-click it, no server needed). That page is exactly what the live modal must look like: same layout, sizes, colours, text, icons and states. The inline styles in those files are the spec. Copy the numbers; do not "improve" them. Compare the live modal side by side with the file at 1440px browser width until they match.

## What to build (matches the 7 differences in image 245)
1. **Speech bubble fixed in the preview box.** The right panel never scrolls. The preview box (268px tall with a bubble, 236px without) is a flex column: bubble on top (`flex:none`), Pao below. The bubble must never scroll away.
2. **Pao is the layered character**, not a flat picture: shadow, legs, pants, torso, shoes, top, arms, head, face, hair, hat. Every equipped item must show (Witch Hat, hoodie, jeans, sneakers, pink bow in the target). Build `PaoAvatar` from `pao_rig.py`, `pao_hats_extra.py`, `pao_rig_animated.py`, `pao_rig_animated_poses.py` (in `docs/pao-poses-expressions/`). The inline SVG inside the target HTML is the exact output to reproduce.
3. **"Wearing now" tiles:** 2 columns, 46px tall, one line of text with ellipsis, 22px pale-red remove button.
4. **Cards:** one flex column per card, 3 per row, thumb 112px, name one line, description 2 lines (29px), fixed 40px state row: Wear (blue), Equipped (green, check), or lock + badge name + progress bar. Nothing is positioned outside the card.
5. **Real item pictures:** each card's thumbnail is `PaoAvatar` showing only that item (Witch Hat is a witch hat, Natural is a plain Pao face, no emoji).
6. **Buttons pinned** at the bottom of the right panel, 42px, side by side: "Take outfit off" and "Let's Play!".
7. **Only the item list scrolls**, with a thin light scrollbar (`scrollbar-width:thin; scrollbar-color:#9DB4DA #E3EBF8`). No dark scrollbars.

## Structure to follow (sizes in image 246)
```
Modal 1240 wide (scale with the viewport), header 76px, body 640px
  Left nav 236px: Hair, Hats, Clothes, Pants, Shoes, "STYLE (ONE AT A TIME)", Poses, Expressions
  Center flex:1: info banner 38px + scrolling 3-column list
  Right 350px (no scroll): header 28px, preview box, WEARING NOW label, tiles, spacer (flex 1), footer buttons
```
If the screen is shorter than the modal body, shrink the preview box first (minimum 180px). Never let the panel scroll and never hide the footer.

## Behaviour (see also PAO-OUTFIT-FIX-PROMPT.md and PAO-SPEECH-BUBBLE-PROMPT.md)
- Wear updates the preview at once and the bubble says the line from `paoLines.js`.
- Locked card tap: yellow bubble with the badge and progress, blue ring on the card, outfit unchanged (file `customize-pao-target-locked-item.html`).
- Pose or expression chosen: it replaces the other, and the outfit stays on Pao (file `customize-pao-target-pose-and-outfit.html`).
- Data comes from MongoDB through the existing consolidated handler (`?action=`); save the equipped keys as before; reload must show the same look.

## Acceptance (compare against the HTML files)
1. At 1440px width, a screenshot of the live modal and a screenshot of the target HTML (same tab, same state) look the same: same layout, spacing, colours, fonts and icons.
2. Witch Hat equipped: the hat is visible on Pao in the preview, in all 12 poses and 12 expressions.
3. The bubble stays visible while scrolling the item list or the page.
4. No text, pill, button or tile crosses the border of its container at 1280, 1440 and 390px widths.
5. Footer buttons are visible without scrolling.
6. Cards show real item pictures, and locked cards show lock, badge name and progress.
7. Reload keeps the outfit, pose or expression.
8. If something in the live app cannot match the target, report which part and why; do not silently keep the old design.
