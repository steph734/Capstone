# TherapyPro: Redesign Slow-Motion Echo and give Pao game-specific reactions

Attached: `pao-echo-pack.zip` with 7 reference images in `reference/` (264 to 270) and three ready-to-use source files in `src/games/echo/`:
- `echoCostume.jsx`: Pao's Pond Explorer costume (look keys) and the turtle backpack overlay.
- `paoReactions.js`: game moment to Pao pose, expression, prop and lines.
- `PaoProps.jsx`: Headphones, Echo rings, Syllable beats and a Turtle friend drawn on top of Pao.

The game lives at `/owner/gamified-activities/preview/echo` (preview) and the patient play route. Change presentation and Pao's reactions only. Do NOT change word lists, syllable splitting, levels, pacing values, audio playback, scoring or API contracts. Pao's outfit in this game is the **Pond Explorer** costume from `echoCostume.jsx` (yellow raincoat, shorts, rain boots, lotus hair clip, turtle backpack), not the child's equipped outfit. The costume is in-game only: never save it, never change the outfit stored in Customize Pao, never unlock or lock items, and ignore item ownership. The hub and Customize Pao keep showing the child's own outfit. Render order inside one `position: relative` wrapper: Pao with `ECHO_COSTUME.look`, then `TurtleBackpack`, then the reaction prop.

Before coding: read the current Echo component (setup screen, play screen), how it speaks syllables and words, and how Pao is rendered in other games. Keep repo rules: consolidated `frontend/api` handler with `?action=`, cached MongoClient, omit empty strings, UTC storage and Asia/Manila display.

## What is wrong today (fix all)
1. Dark, flat screens with small low-contrast text; the preview toast floats over the layout.
2. The "Echo one syllable at a time" switch has no visible toggle, so it looks like plain text.
3. Level cards, pacing chips and the Let us go button have no clear selected state or hierarchy; an emoji turtle is used.
4. The word picture is a small emoji. The syllable chips are small and do not show progress.
5. Pao is a flat, cropped picture at the bottom with a caption strip that repeats the syllable.
6. No "your turn" state, no feedback for a good or a missed echo, no results screen.

## Global look
- Calm pond theme: pale teal sky to turquoise water, soft lily pads, cattails, ripples, smiling sun top-left, a few clouds that never sit behind text. White cards, radius 30px, soft shadow, buttons with a 4 to 6px darker bottom edge.
- Colors: teal `#14B8A6` / `#0D9488`, dark text `#0F4F4F`, muted `#4B7B7B`, green action `#16A34A`, amber `#F59E0B`, soft orange `#FB923C` for "try again" (never red).
- Fonts: Poppins (headings, syllables, buttons), Inter (body). No emojis; the turtle is an inline SVG (see the images). Tap targets at least 44px. Respect `prefers-reduced-motion`.

## Setup screen (image 264)
- Top-left "All Games" pill. Small cream pill "Preview mode: scores are not saved" at the top center (preview only).
- White card 780px wide: turtle illustration, title "Slow-Motion Echo" (44px), one-sentence description, "CHOOSE A LEVEL" with a 2x2 grid of level cards. Each card (96px high): number tile, level name, description, a teal example (pen·cil, but·ter·fly, spl·ash, big red ball) and 4 difficulty dots. Selected card: teal border, light teal fill, check badge at the top-right corner. Examples come from the existing word data; hide the example line if none exists.
- "PACING" with three equal cards: Slow, Slower, Turtle-speed, each with a small turtle icon and 1 to 3 speed bars. Selected: teal gradient with white text.
- Toggle row (80px): speaker icon tile, "Echo one syllable at a time", helper "Turn off when your child is ready to echo the whole word.", and a real switch (68x38, teal when on, knob visible). Keep the existing default.
- Green "Let us go!" button (64px). Pao (Pond Explorer, `ready` reaction) bottom-left with a short bubble above him.

## Play screens (images 265 to 268), 1440x900
- **Top bar:** "All Games" pill; centered pill with the word "WORD" and 5 progress circles (done = green check, current = orange with number and soft ring, pending = pale teal); the preview pill sits under it. Top-right: white pill with a turtle icon and "Level 1 · Slow".
- **Stage card (760px, center):** small caps "WORD 1 OF 5", a 190px circle with the word picture (about 134px), then the syllable chips. Chips are large (104px high, Poppins 56px) with a dot between them. States:
  - idle: white, pale teal border. active: warm yellow with a gold border and soft glow, slightly bigger. done: light green with a check. retry: soft orange. 
  - Under the chips a status pill. Listening: "Now hearing" with a teal waveform and the current syllable. Your turn: "Your turn! Say cil" with a mic icon. Try again: turtle icon and "Let us try that again, even slower".
  - Buttons (60px high): Listen state: Replay (white) and Slower (white, turtle icon). Your turn: Hear it again (white) and "I said it!" (green). Great echo: Hear it again and "Next word" (green). Try again: "Hear it slower" (amber) and "Skip word" (white).
- **Flow:** Listen (syllables play one by one, chips light up in order) then Your turn (child echoes, taps "I said it!") then either Great echo or Try again slower. "Hear it slower" moves one pacing step slower for that word only (Slow to Slower to Turtle-speed) and shows the new pace in the top-right pill. If the game already uses the microphone or another way to check the echo, keep it and show the live level meter in the "Your turn" pill; otherwise keep "I said it!" as the child's confirmation. Do not add speech recognition in this task.
- **Great echo (267):** chips turn green with checks, the picture circle turns light green, a star burst appears around the card, a gold star and "Pen-cil! Great echo!" show under the chips, and the top progress marks the word done.
- **Pao (bottom-left):** Pond Explorer, full body, about 300px tall, with a white bubble to his right. Reactions follow `paoReactions.js`.

## Results modal (image 269)
- Title "You echoed all 5 words!", Pao line, Pao on a teal tile (`finished`), 3 stars, four stat tiles (First try "4 of 5", Slower tries, Replays, Pace), a row of the played word pictures with their syllable splits and a green check or an amber turtle (needed a slower try), a "Ready for Level 2?" suggestion row, and buttons: Play again (green), Try Level 2 (light teal), All games (white). Footnote "Preview mode: this score was not saved" in preview only.
- Suggest the next level when at least 4 of 5 were echoed on the first try; otherwise suggest "Play again at this level". Stars: use the existing rule if there is one; otherwise 3 stars for 4 or 5 first-try echoes, 2 for 3, else 1.

## Pictures
The mock-ups use hand-drawn flat illustrations (pencil, balloon, cookie, pizza, apple). Use the game's existing word pictures if they are good quality; otherwise draw consistent flat SVGs (100x110 viewBox, 3px darker outline, one soft highlight, no text). Never use emoji characters.

## Pao reactions (image 270)
Use `src/games/echo/paoReactions.js` as the only mapping from game moment to Pao. It uses ONLY existing poses and expressions, so no database change is needed:

| Moment | Pose | Expression | Prop |
|---|---|---|---|
| Game starts | hello | happy | none |
| Word is spoken | relax | happy | headphones |
| Your turn | relax | surprised | echo rings |
| Each syllable plays | groove | happy | beat dots (1 to 4) |
| Great echo | cheer | excited | none |
| Needs a slower try | relax | happy | turtle friend |
| 2 slower tries on the same word | hug | love | none |
| 3 first-try echoes in a row | jump | laugh | none |
| Last word finished | tada | proud | none |

Rules:
- These are temporary in-game overrides. Restore the child's chosen pose and expression style after each reaction (`REACTION_MS` = 2200 ms). The newest reaction wins; do not queue.
- Render order inside one `position: relative` wrapper: Pao (costume look), the costume accessory, then `PaoProp`. All use the same width, height and viewBox. Add `PAO_PROP_CSS` to the game stylesheet.
- For "Each syllable plays", pass the syllable count and the active index to `Beats` so the dots light up in turn.
- The Pond Explorer costume has no hat, but keep the shared rule: any costume hat is hidden while the headphones are shown.
- Lines come from `lines`; replace `{word}`, `{n}`, `{name}`, `{syllables}`.

## Accessibility
- Syllable chips are not buttons unless the game already lets the child tap a syllable to hear it. If tappable, add `aria-label="Hear {syllable}"`.
- Announce the phase with an `aria-live="polite"` region: "Listen", "Your turn", "Great echo", "Try again slower". Do not rely on color alone.
- Esc opens pause or exit. Keep focus inside modals.
- Responsive: under 900px wide, stack the level cards in one column, shrink chips to 76px high and Pao to 180px, and move the bubble above Pao.

## Data and logic
- No new endpoints are required. Count first-try echoes, slower tries and replays in the component; add them to the existing result post only as optional fields and omit empty ones.
- Preview mode (owner and therapist) never saves scores.
- The numbers in the images (4 of 5, 3 replays, mastered examples) are samples.

## Acceptance checklist
- [ ] All screens match images 264 to 269 at 1440x900; nothing overlaps the top bar.
- [ ] The switch has a visible toggle and keeps its current default and behavior.
- [ ] Listen, Your turn, Great echo and Try again slower behave as described; misses are never red or punishing.
- [ ] Pao reacts using only existing poses and expressions, wears the Pond Explorer costume, and restores the child's chosen style after each reaction.
- [ ] Headphones, echo rings, beat dots and the turtle friend line up with Pao in the game and in the 8 cards of image 270.
- [ ] Word lists, syllable splitting, pacing values, audio and API contracts are unchanged.
- [ ] No emojis, no console errors, reduced-motion respected.
