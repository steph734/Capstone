# Pao the Panda: SVG files and prompts

All the SVGs are in this folder. Copy them into `public/games/pao/`.

---

## 1. Base description (paste at the start of every prompt)

> Pao, a cute chibi baby panda mascot for a children's therapy app. Large round white head with soft lavender-grey shading, round dark chocolate-brown ears with pink insides, round dark-brown eye patches tilted outward, big glossy brown eyes with a dark pupil and two white shine dots, small dark-brown nose, rosy pink cheeks. Small white egg-shaped body with soft shading, thick dark-brown arms ending in big shiny golden-tan round paws, dark-brown feet with golden-tan pads. Clean vector illustration, soft cel shading, thin dark-brown outline, full body, centered, soft oval shadow under the feet, plain white background, no text.

**Negative prompt:** `text, letters, watermark, realistic fur, scary, angry, crying, tears, sharp teeth, extra limbs, extra fingers, dark background, clutter`

**Colors**

| Part | Hex |
|---|---|
| Ears, patches, arms, feet, outline | `#3B2421` |
| Ear inside | `#F28DAE` |
| Cheeks | `#F7A6BC` |
| Eyes (iris) | `#C8874A` → `#7C4523` |
| Paws, foot pads | `#F8D9A2` → `#DDA866` → `#B07A3E` |
| Face and body shading | `#FFFFFF` → `#D3D7E6` |
| Accents | purple `#7C5CE6`, yellow `#FFD23F`, pink `#FF8FA8`, sky `#7FDCEB` |

**Rules:** one clear emotion per pose, big readable face, and Pao is never sad, angry or crying. Wrong answers get a gentle pose.

---

## 2. Loading modal poses

| # | File | When | Pose prompt (add after the base description) | Pao says |
|---|---|---|---|---|
| 1 | `pao-hello.svg` | Modal opens | waving one paw up beside his head, other arm down, big open smile with pink tongue, purple sound-wave lines beside the raised paw | "Hi! Let me get your game ready." |
| 2 | `pao-stretch.svg` | 0–30% loading pictures | both arms raised beside his head stretching, eyes closed in happy arcs, small "o" yawning mouth, short yellow stretch lines near the ears | "Stretching… getting ready to play!" |
| 3 | `pao-juggle.svg` | 30–70% loading sounds | both arms raised out to the sides, looking up, big open smile, three stars (yellow, pink, sky blue) floating in a dotted arc above his head | "Catching all the stars…" |
| 4 | `pao-carry.svg` | 70–99% setting up | holding a cardboard box labeled "GAME" in front of his belly with both paws, a yellow star, a blue gem and a pink star peeking out of the box, big smile | "Bringing the game pieces!" |
| 5 | `pao-ready.svg` | 100% ready | both arms up cheering, eyes closed in happy arcs, big open smile, yellow stars around him | "All ready! Let's play!" |
| 6 | `pao-slow.svg` | After 8 seconds or offline | holding a purple stopwatch up beside his head, raised eyebrows, small gentle smile, calm and patient | "This is taking a bit longer…" |

---

## 3. In-game poses

| File | When | Pose prompt (add after the base description) | Pao says |
|---|---|---|---|
| `pao-wave-happy.svg` | Game start | waving one paw, happy arc eyes, big smile, yellow motion lines | "Hi! I'm Pao. Let's play!" |
| `pao-listen.svg` | Reading the question aloud | paw cupped beside his ear, small "o" mouth, purple sound waves | "Listen carefully…" |
| `pao-point.svg` | Showing where to tap | one arm stretched straight out to the right pointing, calm smile, eyes looking right | "Look over here!" |
| `pao-point-talk.svg` | Hint while pointing | pointing right, mouth open talking | "Try this basket!" |
| `pao-thinking.svg` | Waiting for the answer | paw on chin, raised eyebrows, eyes looking up, flat mouth, yellow question mark | "Hmm… which one could it be?" |
| `pao-idea.svg` | Hint button tapped | both arms up, wide sparkling eyes, open smile, glowing light bulb above head | "I have an idea! Let me help." |
| `pao-reading.svg` | Reading or Sentence Builder | holding an open purple storybook, happy arc eyes, gentle smile | "Let's read it together." |
| `pao-correct.svg` | Right answer | both arms up cheering, happy arc eyes, big smile, sparkles | "Yay! You got it!" |
| `pao-proud.svg` | 3 right in a row | one fist pumped up, winking, tongue out, sparkles | "Three in a row! Great job!" |
| `pao-try-again.svg` | Wrong answer | hugging a pink heart, soft encouraging smile, slightly raised brows, tiny sweat drop, kind (not sad) | "Oops! That's okay. Let's try again." |
| `pao-surprised.svg` | New badge or level | both arms up, very wide eyes, "o" mouth, yellow exclamation mark | "Whoa! You unlocked a new badge!" |
| `pao-celebrate.svg` | Game complete | both arms up, star-shaped eyes, big smile, confetti and stars | "You did it! You finished the game!" |
| `pao-sleepy.svg` | Paused or idle | arms down, eyes closed, flat mouth, purple "z z z" | "I'll wait here. Tap when you're ready!" |
| `pao-idle.svg` | Default | arms down at his sides, gentle "w" smile | (no line) |
| `pao-idle-happy.svg` | Default (happier) | arms down, big open smile | (no line) |
| `pao-wizard.svg` | Sentence Builder theme | purple wizard hat with a yellow band and star, holding a book | "Abra-ca-dabra! Let's build a sentence!" |

---

## 4. Prompts for full sheets

**Loading sheet:**
> UI design sheet titled "Pao while the game loads", six rounded cards in a 3×2 grid on a soft peach-to-lavender background. Each card has a pastel left panel (lavender, butter yellow, pink, sky blue, mint, peach) showing Pao [base description] in one pose: waving hello, stretching, juggling stars, carrying a "GAME" box, cheering ready, holding a stopwatch. The right side of each card has a purple number badge, a bold title, a purple subtitle and a speech quote in a light-purple box. Same character proportions in every card.

**Expression sheet:**
> Character expression sheet of Pao [base description], 12 poses in a 6×2 grid of white rounded cards on a light lavender background: waving, listening, pointing, thinking with question mark, idea with light bulb, reading a book, cheering, fist pump with wink, hugging a heart, surprised, celebrating with star eyes and confetti, sleeping with zzz. Consistent proportions and colors, no labels.

---

## 5. Making new poses with code

`pao-generator.js` draws Pao from options. For example:

```js
pao({ arms: 'up', eyes: 'happy', mouth: 'big', extra: 'stars2' })
```

| Option | Values |
|---|---|
| `arms` | down, wave, up, stretch, juggle, point, chin, ear, book, heart, carry, clock, cheer |
| `eyes` | open, wide, happy, closed, wink, star |
| `mouth` | big, smile, gentle, o, flat, soft, tongue |
| `brows` | think, worry |
| `extra` | waves, motion, stretchlines, stararc, stars2, stopwatch, sparkle, confetti, question, bang, zzz, drop, bulb |
| `hat` | true / false |
| `look` | `[x, y]` eye direction, e.g. `[4, -4]` |
