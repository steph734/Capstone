// Three Little Pigs: 7 steps written from the story text you gave. Questions and options are samples.
// Keep what the game already stores; use this to map step names (stepper labels) and to seed or check content.
export const PIGS_STEPS = [
 {
  "key": "Mother",
  "pick": 1,
  "question": "What did Mother tell the three little pigs before they left?",
  "narration": "Three little pigs leave home to build houses of their own. Mother reminds them to work hard and do their best.",
  "options": [
   {
    "label": "Work hard and do your best",
    "correct": true
   },
   {
    "label": "Play all day",
    "correct": false,
    "reason": "Mother wants them to work."
   },
   {
    "label": "Never build a house",
    "correct": false,
    "reason": "They need a safe home."
   }
  ]
 },
 {
  "key": "Build",
  "pick": 3,
  "question": "What did the pigs build their houses from? Pick 3 things.",
  "narration": "The first pig wants to play, so he builds quickly with straw. The second builds fast with sticks. The third takes his time and builds with bricks.",
  "options": [
   {
    "label": "Straw",
    "correct": true
   },
   {
    "label": "Sticks",
    "correct": true
   },
   {
    "label": "Bricks",
    "correct": true
   },
   {
    "label": "Ice",
    "correct": false,
    "reason": "Ice would melt."
   },
   {
    "label": "Paper",
    "correct": false,
    "reason": "Paper is too weak."
   }
  ]
 },
 {
  "key": "Straw",
  "pick": 1,
  "question": "The wolf knocks on the straw house. What happens?",
  "narration": "The hungry wolf says, \"Let me come in!\" The pig says no. The wolf huffs and puffs and blows the straw house down. The pig runs to his brother's stick house.",
  "options": [
   {
    "label": "The wolf blows it down",
    "correct": true
   },
   {
    "label": "The house stays strong",
    "correct": false,
    "reason": "Straw is too weak."
   },
   {
    "label": "The pig lets the wolf in",
    "correct": false,
    "reason": "The pig said no."
   }
  ]
 },
 {
  "key": "Sticks",
  "pick": 1,
  "question": "The stick house falls too. Where do the two pigs run?",
  "narration": "The wolf knocks again and the pigs say no. He huffs and puffs and the stick house falls. Both pigs run to the third pig's brick house.",
  "options": [
   {
    "label": "To the brick house",
    "correct": true
   },
   {
    "label": "Into the woods alone",
    "correct": false,
    "reason": "They run to their brother."
   },
   {
    "label": "Back to the straw house",
    "correct": false,
    "reason": "It is already gone."
   }
  ]
 },
 {
  "key": "Bricks",
  "pick": 1,
  "question": "Why did the brick house stay standing?",
  "narration": "The wolf huffs and puffs again and again, but the brick house does not budge.",
  "options": [
   {
    "label": "It was built strong and slowly",
    "correct": true
   },
   {
    "label": "The wolf was too sleepy",
    "correct": false,
    "reason": "He was angry and trying hard."
   },
   {
    "label": "The wind helped",
    "correct": false,
    "reason": "Hard work made it strong."
   }
  ]
 },
 {
  "key": "Chimney",
  "pick": 1,
  "question": "The wolf climbs on the roof. What is waiting down the chimney?",
  "narration": "The angry wolf tries to sneak down the chimney. The third pig has a big pot of water boiling over the fire. The wolf slides in, yelps, jumps out and runs away.",
  "options": [
   {
    "label": "A pot of hot water",
    "correct": true
   },
   {
    "label": "A soft bed",
    "correct": false,
    "reason": "The pig was ready for the wolf."
   },
   {
    "label": "A plate of cookies",
    "correct": false,
    "reason": "It was hot water."
   }
  ]
 },
 {
  "key": "Safe",
  "pick": 1,
  "question": "How does the story end?",
  "narration": "The wolf never bothers the pigs again. The three little pigs live safely together in the strong brick house.",
  "options": [
   {
    "label": "The pigs live safely in the brick house",
    "correct": true
   },
   {
    "label": "The wolf moves in",
    "correct": false,
    "reason": "He ran away for good."
   },
   {
    "label": "The pigs build another straw house",
    "correct": false,
    "reason": "They learned from the brick house."
   }
  ]
 }
];
