# PROMPT: Game-specific Pao expressions and poses (corner Pao inside each game)

Paste everything below the line into your coding assistant. Requires `PaoBuddy` / `<PaoLayered>` and the earlier expression layers (PROMPT-expressions.md).

---

## New assets (23 poses)
Copy `pao-layers/` again (it now contains the new files) to `public/pao/layers/`:
```
poses/pose-<name>.svg   arms + face (replaces base-top, z=4)
fx/fx-<name>.svg        props and effects (z=7)
poses.json              now has "poses", "fx", "item_reaction" and "game_reactions"
```
New poses: `look-left look-right look-up look-down point-up point-down point-side spot cup-ear say-ah say-ee say-oo say-mm slow rhyme build paint read idea thumbsup encourage star-eyes heart-eyes`.
Ready-made full images (no outfit) are in `pao-game-poses/pao-game-<name>.png` for places where you only need a picture.

Like the earlier poses, the head and body never move, so any equipped outfit stays aligned. The corner Pao in a game must render with the patient's equipped outfit through `<PaoLayered pose="..." />`.

## What each pose is for
| Pose | Use |
|---|---|
| look-left / look-right / look-up / look-down | Pao's eyes glance at where the patient should look next (a piece, a picture, a pattern). Only the eyes move. |
| point-up / point-down / point-side | Spatial words: ON TOP, UNDER, NEXT TO. A small arrow shows the direction. |
| spot | Magnifying glass: Spot the Difference, Sound Hunt searching |
| cup-ear | Paw at ear: "listen carefully", or Pao hears the patient speak |
| say-ah / say-ee / say-oo / say-mm | Mouth shapes for speech games. Pao models the sound, a small bubble shows the letters |
| slow | Slow-Motion Echo: "say it nice and slow" |
| rhyme | Rhyme Time: music notes and swaying arms |
| build | Holds a puzzle piece: Puzzle Pals piece picked, Sentence Builder placing a word |
| paint | Palette and brush: Copy the Colors |
| read | Holds an open book: Story Builder, Sentence Builder reading |
| idea | Light bulb: hint or story choice |
| thumbsup | Good attempt, calm praise for speech attempts |
| encourage | Fists up, "you can do it": the gentle retry reaction. Never sad |
| star-eyes | Streak of 3 correct, or a great game |
| heart-eyes | Game finished, big reward |

## Game -> event -> pose map
Use `poses.json -> game_reactions`. Add a `usePaoGameReactions(gameKey)` hook that exposes `react(eventName)`. It plays the pose, holds it 1.6 s (or until the voice line ends), then returns to `idle`.

- **Puzzle Pals** (Place each piece where it belongs): `instruction_on_top -> point-up`, `instruction_under -> point-down`, `instruction_next_to -> point-side`, `waiting -> look-down` (eyes glance toward the pieces tray), `piece_picked -> build`, `correct -> cheer`, `correct_streak -> star-eyes`, `wrong -> encourage`, `finished -> heart-eyes`.
- **Picture-Word Matching**: `question -> look-left` (the picture), `choices -> look-right` (the words), `hear_it -> say-ah`, `correct -> thumbsup`, `wrong -> encourage`, `finished -> star-eyes`.
- **Slow-Motion Echo**: `model_slowly -> slow`, then the pose for the sound being taught (`say-ah`, `say-ee`, `say-oo`, `say-mm`), `patient_speaking -> cup-ear`, `attempt -> thumbsup` (every attempt, not only correct ones), `finished -> heart-eyes`.
- **Sound Hunt**: `listen_to_sound -> cup-ear`, `searching -> spot`, `found -> cheer`, `finished -> star-eyes`.
- **Rhyme Time**: `say_rhyme -> rhyme`, `mouth_shape_ee -> say-ee`, `correct -> cheer`, `finished -> heart-eyes`.
- **Sentence Builder**: `reading -> read`, `placing_word -> build`, `idea_hint -> idea`, `correct -> thumbsup`, `finished -> star-eyes`.
- **Story Builder**: `reading_story -> read`, `choosing -> idea`, `finished -> heart-eyes`.
- **Copy the Colors**: `watch_pattern -> look-up`, `copying -> paint`, `correct -> star-eyes`, `wrong -> encourage`, `finished -> heart-eyes`.
- **Spot the Difference**: `left_picture -> look-left`, `right_picture -> look-right`, `searching -> spot`, `found -> cheer`, `finished -> star-eyes`.
- **Emergency Ready**: keep the calm set only (`idle`, `calm`, `proud`, `thumbsup`). Do not use cheer, star-eyes, rhyme or any fast-moving pose.
- **Feed Pao**: keep `eat`, `yum`, `oops` from the first pose set.

## Speech-sync rule for the say-* poses
When the game speaks a sound or syllable (speechSynthesis `onboundary`, or your recorded audio), switch to the matching `say-*` pose for the duration of that sound, then back to `idle`. For a full word, alternate `say-ah`/`say-oo`/`say-ee` per syllable only if you have the syllable timings; otherwise keep one pose.

## Placement and size
- Corner Pao stays 120-160 px, bottom-left, never covering buttons, with the speech bubble to its right (as in the Puzzle Pals and Picture-Word screens).
- On pointing poses keep the arrow inside the 300x380 box; do not clip (`overflow: visible` on the Pao wrapper).
- Preload the poses a game uses when its start modal opens.

## Therapy and accessibility rules
- Errorless learning: a wrong answer plays `encourage` (never an error pose), with the existing gentle retry.
- No timer, no flashing. One crossfade (120 ms) per pose change.
- `calm_visuals` / `prefers-reduced-motion`: drop the fx layer for `rhyme`, `star-eyes`, `heart-eyes` and `slow`, and replace `cheer` with `thumbsup`.
- Bubble text stays short (max 12 words) and is spoken only when `read_aloud` is on.
- `say-*` bubbles show letters only (ah, ee, oo, mm); do not add spelling or reading tests unless the game asks for it.

## Acceptance checklist
- [ ] Each game plays the poses above at the right moments and returns to idle
- [ ] Pointing poses match the spatial word on screen (ON TOP, UNDER, NEXT TO)
- [ ] Equipped hats, clothes, pants and shoes stay aligned in every new pose
- [ ] Wrong answers never show a sad or negative pose
- [ ] Speech games change mouth shape while Pao says the sound
- [ ] Emergency Ready only uses the calm pose set
- [ ] Reduced motion mode removes fx and fast poses
