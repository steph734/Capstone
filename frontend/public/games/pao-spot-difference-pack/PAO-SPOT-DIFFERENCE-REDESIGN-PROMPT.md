# TherapyPro: Redesign Spot the Difference and give Pao game-specific reactions

Attached: `pao-spot-difference-pack.zip` with 6 reference images in `reference/` (272 to 277) and three ready-to-use source files in `src/games/spotDifference/`:
- `spotCostume.jsx`: Pao's **Pajama Detective** costume (look keys), the moon-pillow overlay and the Magnifier prop.
- `paoReactions.js`: game moment to Pao pose, expression, prop and lines.
- `BedroomScene.jsx`: the Pao's bedroom picture pair (A and B) with found rings, hint spotlight and wrong-tap ring.

The game lives at `/owner/gamified-activities/preview/spot-difference` (preview) and the patient play route. Change presentation and Pao's reactions only. Do NOT change scene data, the number or position of differences, difficulty levels, hit-testing rules, scoring, the star rule or API contracts. Pao's outfit in this game is the Pajama Detective costume (bunny nightcap, green tee, star pajama pants, slippers, moon pillow). It is a temporary in-game override: never saved, never changes Customize Pao, ignores item ownership. The hub, Customize Pao and the Badge Case keep the equipped outfit.

Before coding: read the current Spot the Difference component (header, the two pictures, hit-testing, the Help me button), how it stores found differences, and how Pao is rendered in other games. Keep repo rules: consolidated `frontend/api` handler with `?action=`, cached MongoClient, omit empty strings, UTC storage and Asia/Manila display.

## What is wrong today (fix all)
1. The "Preview mode: scores aren't saved" toast floats over the title and hides the game name and difficulty. Make it a normal pill under the title bar.
2. Pao sits at the bottom edge, cut off by the page fold. After scrolling, the page leaves a large empty area. Fit the whole game in one 1440x900 screen: pictures, progress and Pao visible without scrolling.
3. The title bar is crowded and the difficulty ("Hard") is plain text. The headline repeats it in tiny type.
4. Two pictures are large but unlabeled in a useful way, there is no clear feedback on a found difference (ring on both pictures, check, star) and none on a wrong tap.
5. "Found 0 of 4" and the "Help me" button are small and the dashed button looks disabled.
6. No hint state, no results screen, Pao has no reactions.

## Global look (images 272 to 275)
- Sky theme shared with the hub and Picture Word: blue sky gradient, smiling sun top-left, clouds that never sit behind text, green hills at the bottom. White cards, radius 30 to 34px, soft shadow with a darker bottom edge. Buttons have a 4 to 6px darker bottom edge.
- Colors: indigo `#5B3FD0` / `#1B2B6B` for text, green `#22C55E` / `#15803D` for found, amber `#F59E0B` / `#FFF3C9` for hints and preview, soft orange `#FB923C` for a wrong tap (never red, no buzzer).
- Fonts: Poppins (headings, buttons, numbers), Inter (body). No emojis; icons are inline SVG. Tap targets at least 44px. Respect `prefers-reduced-motion`.

## Layout at 1440x900 (nothing scrolls)
1. Top bar (y 18 to 76): "Games" back pill left; centre pill with **Spot the Differences**, the scene name ("Pao's bedroom") and a **Hard** chip with 3 dots (Easy 1, Medium 2, Hard 3); star pill right (stars earned this game).
2. Preview pill directly under the centre pill (only in preview mode), never overlapping anything.
3. Headline (y 122): "Find all {total} differences". It changes with state: "You found the {thing}!" (green, with a star), "Not quite. Try another spot", "Clue: look at the {area}".
4. Two picture cards, each 620x388 inside a white frame, at x 80 and x 740, y 206. A pill above each: "A Picture A" and "B Picture B".
5. Bottom row (y 618), centred: a pill "Found {n} of {total}" with one dot per difference (grey ring, then green check), and a **Help me** button (amber, magnifier icon). After use it becomes grey "Hint used" (keep the game's existing hint limit; if it allows several hints, show "Help me" until they are used up).
6. Pao bottom-left (300px tall) with a white speech bubble to her right (max 440px). Pao and the bubble never overlap the bottom row or the pictures.

## Play states
- **Play (image 272):** fresh board, 0 of 4, Pao `ready`.
- **Found (image 273):** a correct tap draws a green ring with a check badge on the same spot in BOTH pictures, bursts 8 small stars around it for about 600 ms, updates the dot row and the star pill, and Pao shows `found`. When exactly one is left, use `oneToGo`.
- **Not quite (image 274):** a tap on a matching spot draws a soft orange dashed ring at the tap point and a small tip "Those two match", for about 1200 ms. No red, no shake, no sound penalty. Taps are ignored while the ring is showing. Wrong taps do not reduce stars unless the game already does that.
- **Hint (image 275):** dim both pictures slightly and highlight the next unfound difference with an amber dashed ring (`hint` prop on `BedroomScene`). The headline names the area (shelf, lamp, floor, picture frame). Pao shows `hint` with the magnifier.
- **Results (image 276):** modal over the dimmed game: "You spotted all {total} differences!", Pao `finished` in a rounded tile, 1 to 3 stars, four stats (Found, Time, Hints used, Retries), a "What you found" row of 4 crops (one per difference, from the picture where the difference is visible, with its label), and three buttons: Play again, Next picture, All games.

## Pictures
`BedroomScene.jsx` draws Pao's bedroom in 640x400 and exports `BEDROOM_DIFFS` (centre, ring radius, label). The four differences in the mock-ups are: blue sock (only in A), lamp shade colour (orange in A, red in B), extra purple book (only in B), sun in the picture frame (only in A). **Confirm these against the game's real data** and use the real hit areas; the mock-up's fourth difference was read from a screenshot and may differ. If the game already has an equivalent scene, keep it and only restyle the frame and markers. Hit-testing must keep working through the rounded frame and at any card size (scale taps by the card's rendered width / 640).

## Pao reactions (image 277)
Use `src/games/spotDifference/paoReactions.js` as the only mapping from game moment to Pao. It uses ONLY existing poses and expressions, so no database change is needed:

| Moment | Pose | Expression | Prop |
|---|---|---|---|
| Picture appears | hello | happy | none |
| Correct tap | cheer | excited | none |
| Exactly one left | lean | excited | none |
| 3 finds in a row with no wrong tap | jump | laugh | none |
| Tap on a matching spot | shy | silly | none |
| Help me is tapped | think | wink | magnifier |
| 3 wrong taps in a row | hug | love | none |
| All differences found | tada | proud | none |

Rules:
- These are temporary in-game overrides. Restore the child's chosen pose and expression style after each reaction (`REACTION_MS` = 2200 ms). The newest reaction wins; do not queue.
- Render order inside one `position: relative` wrapper: Pao (costume look), `MoonPillow`, then the `Magnifier` when the reaction asks for it. All use the same width, height and viewBox (default `-30 -66 250 322`). Add `SPOT_PROP_CSS` to the game stylesheet.
- Pose and expression are mutually exclusive in Customize Pao (server 409 `STYLE_CONFLICT`). These reactions are client-side overrides and must never call the style endpoint.
- Lines come from `lines`; replace `{total}`, `{thing}`, `{left}`, `{area}`, `{name}`.

## Accessibility
- Each picture is a `role="img"` with an `aria-label`; the tap surface is a real `button` or has `role="button"` with keyboard support: arrow keys move a focus ring over a grid of 40px cells, Enter or Space taps. Announce results in an `aria-live="polite"` region: "Found the lamp. 2 of 4", "Not a difference", "Hint: look at the bookshelf".
- Do not rely on color alone: found = ring plus check; wrong tap = dashed ring plus text.
- Esc opens pause or exit. Keep focus inside modals.
- Responsive: under 900px wide, stack Picture A above Picture B (each full width), move the progress row under both, shrink Pao to 150px and put the bubble above her.

## Data and logic
- No new endpoints. Count found, hints used, wrong taps (Retries) and time in the component; add them to the existing result post only as optional fields and omit empty ones.
- Star rule: if one exists, keep it. If not, use 3 stars for no hints and 2 or fewer retries, 2 stars for one hint or up to 4 retries, otherwise 1.
- Preview mode (owner and therapist) never saves scores.
- The numbers in the images (time 1:42, 1 hint, 2 retries, stars) are samples.

## Acceptance checklist
- [ ] All screens match images 272 to 276 at 1440x900; the preview pill never overlaps the title and nothing scrolls.
- [ ] Found rings appear on both pictures; wrong taps are soft orange and never red or punishing.
- [ ] Help me dims the pictures and rings the next unfound difference; the state changes to "Hint used" as the game's limit requires.
- [ ] Pao reacts using only existing poses and expressions, wears the Pajama Detective costume, and restores the child's chosen style after each reaction.
- [ ] The magnifier lines up with Pao in the game and in the 8 cards of image 277; the costume hat is not hidden (there are no headphones in this game).
- [ ] Scene data, difference positions, hit-testing, scoring and API contracts are unchanged.
- [ ] No emojis, no console errors, reduced-motion respected, `npm run build` passes.
