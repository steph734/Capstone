# PROMPT: Pao reacts with a new expression + pose every time an outfit is equipped

Paste everything below the line into your coding assistant. Requires the layered wardrobe from PROMPT-wardrobe.md (`<PaoLayered>`).

---

## New assets
Copy into `public/pao/layers/`:
```
poses/pose-<name>.svg   14 poses: idle happy wow wave hips flex love wink giggle shy proud cheer dance sleepy
fx/fx-<name>.svg        floating extras (hearts, stars, "!", notes, Zzz, confetti). Exists for every pose except idle
poses.json              pose list + per-item reaction map + random pool
```
Also copy `pao-reactions/` to `public/pao/reactions/` (ready-made full images of each item with its reaction, usable as thumbnails/share images).

## How it plugs into <PaoLayered>
- A pose file REPLACES `base-top.svg` (z=4) and contains the arms and the face. The head and body never move, so every hat, clothes, pants and shoes layer stays perfectly aligned. Do not rotate, tilt or translate Pao for these poses.
- If `fx/fx-<pose>.svg` exists, render it on top at z=7.
- Add a `pose` prop: `<PaoLayered equipped={...} pose="idle" />`. Default `idle`. Crossfade between poses (120 ms) to avoid flicker.

## Behaviour: on every equip
When the patient equips any item in Hair, Hats, Clothes, Pants or Shoes:
1. Look up `poses.json -> item_reaction[category][item_key]`. If found, play that pose. If not found (for example any Hair item) pick one at random from `random_pool_for_any_equip`, never the same pose twice in a row.
2. Hold the pose 1.8 s, then return to `idle` (or `blink` frames as in PaoBuddy).
3. Show a speech bubble that matches the pose (max 12 words, spoken if `read_aloud`):

| Pose | Bubble examples |
|---|---|
| wink | "Looking good!" |
| cheer | "Yay! I love it!" |
| love | "It's so pretty!" |
| wow | "Wow, look at me!" |
| hips | "Ta-da! How do I look?" |
| giggle | "Hee hee hee!" |
| proud | "I feel so proud!" |
| wave | "Hi friend! Do you like it?" |
| flex | "I feel super strong!" |
| shy | "Aww, so cozy!" |
| dance | "Let's dance!" |
| sleepy | "Ready for bedtime stories." |
| happy | "Yippee!" |

4. Play a soft pop sound and the tiny sparkle burst already described in the wardrobe prompt.
5. Equipping "Natural" (removing an item) plays `happy` with "Back to my natural look!".
6. Tapping Pao in the preview panel cycles through `wave -> giggle -> cheer -> love -> wow` (respecting the outfit; never changes the equipped items).
7. Idle for 25 s: play `hips` once, bubble "Want to try something else on?".

## Mapping used (already in poses.json)
Hats: orange-bowtie wink, party-hat cheer, flower-crown love, wizard-hat wow, backwards-cap hips, bunny-ears giggle, thinking-cap proud.
Clothes: rainbow-tee wave, astronaut-suit wow, superhero-cape flex, cozy-hoodie shy, star-overalls hips, echo-scarf happy, patchwork-vest proud.
Pants: polka-dot-leggings dance, cargo-shorts hips, pajama-pants sleepy, denim-overalls flex.
Shoes: rocket-sneakers cheer, rain-boots giggle, ballet-flats dance, high-top-stars wink.

## Accessibility and therapy rules
- `calm_visuals` / `prefers-reduced-motion`: show the pose without any bounce or sparkle, and replace `cheer`, `dance`, `flex` and `wow` with `happy`; hide the fx layer for them.
- Never show a negative expression (no sad, angry or scared). Every equip is a celebration.
- Locked items: Pao shows `wave` with the line "Win <badge name> to wear this!" and the item is not equipped.
- The same pose system should also be used by the games-list header Pao: after the patient closes the modal, Pao shows the last pose for 1.5 s then returns to idle.
- No timers, no flashing. Each pose change is a single crossfade.

## Acceptance checklist
- [ ] Equipping any item changes Pao's face and arm pose, then returns to idle
- [ ] Hats, clothes, pants and shoes stay aligned in all 14 poses (no tilt, no offset)
- [ ] Arms never cover Pao's face in the pose list except `shy` where the paws are hidden behind the cheeks
- [ ] Hair items trigger a random pose with no repeats
- [ ] Reduced motion / calm mode switches to `happy` without fx
- [ ] Locked items never show an error, only the "win this badge" line
