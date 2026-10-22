# Feed Pao: redesign, poses and prompts

Copy this whole `Feed_Pao` folder to `frontend/public/games/feed-pao/` (merge it with the existing folder).

- `pao/`: 10 Pao poses for this game, built on the Rhyme Time Pao (same 240×300 canvas) with a mealtime bib.
- `foods/`: banana, milk, carrot and apple.
- `mockups/`: the redesign (asking screen, correct screen, pose sheet).

---

## 1. Claude Code prompt (paste into VS Code)

```
Redesign the Feed Pao game (/therapist/gamified-activities/games → Feed Pao) to match the mockups in public/games/feed-pao/mockups/ (Feed_Pao_Asking.png and Feed_Pao_Correct.png). Keep the game logic, levels, scoring, "Words: on" toggle and the existing sky/sun/clouds/hills background.

## Assets
- Pao poses: /games/feed-pao/pao/<pose>.svg
  pao-feed-hello, pao-feed-hungry, pao-feed-asking, pao-feed-waiting, pao-feed-hint,
  pao-feed-eating, pao-feed-yum, pao-feed-not-this, pao-feed-full, pao-feed-thanks
- Foods: /games/feed-pao/foods/<food>.svg (banana, milk, carrot, apple). Keep using any other food images the game already has.
- Remove the old flat panda drawing from this game.
- Preload all pose SVGs on mount so they switch without flicker.

## Layout (desktop; stack Pao above the cards on narrow screens)
- Top bar: "← Games" pill on the left. A centre pill with "Feed Pao", a purple "Level 1 · One step" chip and progress dots (green = done, purple ring = current). On the right, the "Words: on" pill and the star counter.
- Left: Pao, large (~380px wide), standing on the hill, with a white speech bubble above him. The bubble has a round purple speaker button that replays Pao's line, and the food name in the line is highlighted in yellow-orange (#E8A100).
- Right top: an instruction card with a small picture of the requested food in a cream tile, a small purple label "TAP OR DRAG TO PAO'S PLATE", the instruction in big bold text ("Give Pao the banana."), and a solid purple "Hear again" button.
- Right: 3 large food cards in a row (white, rounded 34px, lavender bottom shadow), each with a big picture, a big word underneath (hidden when Words is off), and a small round speaker button in the corner that says the food name.
- Bottom right: "Read foods" (reads all choices) and a yellow "Hint" button.
- Keep tap AND drag-to-plate working. While dragging, the plate in front of Pao glows.

## Pao's pose for each moment
| Moment | Pose | Pao says (TTS) |
|---|---|---|
| Game start | pao-feed-hello | "Hi! It's snack time!" |
| New round | pao-feed-hungry (1 s) → pao-feed-asking | "I'm hungry! Can I have the {food}?" |
| Child choosing (after TTS ends) | pao-feed-waiting | – |
| No answer for 6 s, or Hint tapped | pao-feed-hint | "The {food} is {color/clue}!" |
| Correct food | pao-feed-eating (1.2 s) → pao-feed-yum | "Yum, yum! Thank you for the {food}!" |
| Wrong food (1st try) | pao-feed-not-this | "Hmm, not that one. Let's try again!" |
| Wrong food (2nd try) | pao-feed-hint, and the correct card gets a soft green glow | "This one is the {food}!" |
| Level complete | pao-feed-full | "My tummy is happy!" |
| Game complete | pao-feed-thanks | "Thank you for feeding me!" |

## Feedback
- Correct: a green banner "Yes! That's the {food}!", the chosen card gets a green border with a "+1 star" chip, the other cards fade to 45% opacity, and the star counter goes up.
- Wrong: no red X and no buzzer. The card does a small shake and Pao's gentle pose plays (errorless learning).
- Respect prefers-reduced-motion (no shake or bounce).

## Save per answer (for descriptive analytics)
{ item, chosen, correct, attempts, hintUsed, timeMs }, using the game's existing save call.

When done, list the files you changed. Don't commit or push.
```

---

## 2. Image prompts (if you want painted versions)

**Base (paste first):**
> Pao, a cute chibi baby panda mascot for a children's therapy app. Big round white head with soft blue-grey shading, round dark chocolate-brown ears with pink insides, dark-brown oval eye patches tilted outward, large round eyes with a brown iris and two white shine dots, small dark-brown nose, soft pink cheeks. White egg-shaped body, thick rounded dark-brown arms with big glossy golden-tan ball paws, dark-brown feet with golden-tan pads. He wears a white baby bib with a pink trim and yellow, blue and pink dots. Clean vector style, radial-gradient shading, dark-brown outline, full body, centered, soft shadow, plain white background, no text.

**Negative:** `text, watermark, realistic fur, fingers, claws, angry, crying, tears, dark background, clutter`

| File | Pose prompt (add after the base) |
|---|---|
| `pao-feed-hello.svg` | waving one paw, happy arc eyes, big open smile, yellow motion lines |
| `pao-feed-hungry.svg` | both paws on his tummy, raised eyebrows, small "o" mouth, eyes looking up, lilac rumble lines by the tummy |
| `pao-feed-asking.svg` | holding an empty white plate in front of him with both paws, open talking mouth, purple "?" speech bubble |
| `pao-feed-waiting.svg` | holding the empty plate, small smile, eyes looking to the side at the food |
| `pao-feed-hint.svg` | one arm pointing straight out to the side, eyes looking that way, open talking mouth |
| `pao-feed-eating.svg` | holding a banana to his mouth, eyes closed in happy arcs, cheeks puffed and chewing, crumbs on the bib |
| `pao-feed-yum.svg` | both paws rubbing his tummy, happy arc eyes, tongue licking his lips, pink hearts |
| `pao-feed-not-this.svg` | arms open to the sides, head tilted, raised eyebrows, soft kind smile, lilac head-shake lines (gentle, not sad) |
| `pao-feed-full.svg` | both paws on a round full tummy, eyes closed contentedly, "w" smile, head tilted, pink heart |
| `pao-feed-thanks.svg` | jumping with both arms up, star-shaped eyes, big smile, confetti |

**Game screen prompt:**
> Children's learning game screen, flat vector UI, 16:9. Bright sky-blue background with a smiling sun, puffy clouds, rolling green hills and small pink flowers. Top: white pill buttons "← Games", a centre pill "Feed Pao" with a purple "Level 1 · One step" chip and progress dots, "Words: on" and a star counter. Left: Pao the panda wearing a bib and holding an empty plate, with a white speech bubble "I'm hungry! Can I have the banana?" (the word banana in orange) and a round purple speaker button. Right: a white instruction card with a small banana picture, the label "TAP OR DRAG TO PAO'S PLATE", the big text "Give Pao the banana." and a purple "Hear again" button. Below: three large white rounded cards with a banana, a milk bottle and a carrot, each labeled in big bold text with a small speaker button. Bottom right: "Read foods" and a yellow "Hint" button. Calm, friendly, large touch targets.
