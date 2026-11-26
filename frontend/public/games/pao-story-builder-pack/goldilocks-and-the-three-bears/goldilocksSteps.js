// Goldilocks and the Three Bears: 7 steps written from the story text you gave. Questions and options are samples.
// Keep what the game already stores; use this to map step names (stepper labels) and to seed or check content.
export const GOLDILOCKS_STEPS = [
 {
  "key": "Bears",
  "pick": 1,
  "question": "Why did the three bears go for a walk?",
  "narration": "Father Bear, Mother Bear and Baby Bear live in a cozy house in the forest. Their porridge is too hot to eat, so they go for a walk while it cools.",
  "options": [
   {
    "label": "The porridge was too hot",
    "correct": true
   },
   {
    "label": "They were lost",
    "correct": false,
    "reason": "They knew the way home."
   },
   {
    "label": "They were looking for Goldilocks",
    "correct": false,
    "reason": "They had not met her yet."
   }
  ]
 },
 {
  "key": "House",
  "pick": 1,
  "question": "What did Goldilocks do when she found the bears' house?",
  "narration": "A curious girl with golden curls wanders into the forest and finds the house. She knocks, nobody answers, and she pushes the door open.",
  "options": [
   {
    "label": "She knocked, then went inside",
    "correct": true
   },
   {
    "label": "She waited outside",
    "correct": false,
    "reason": "She went in."
   },
   {
    "label": "She called the bears",
    "correct": false,
    "reason": "Nobody was home."
   }
  ]
 },
 {
  "key": "Porridge",
  "pick": 1,
  "question": "Which bowl of porridge was just right?",
  "narration": "On the table are three bowls: a big one, a middle one and a small one. One is too hot, one is too cold, and one is just right.",
  "options": [
   {
    "label": "Baby Bear's small bowl",
    "correct": true
   },
   {
    "label": "Father Bear's big bowl",
    "correct": false,
    "reason": "Too hot."
   },
   {
    "label": "Mother Bear's middle bowl",
    "correct": false,
    "reason": "Too cold."
   }
  ]
 },
 {
  "key": "Chairs",
  "pick": 1,
  "question": "Which chair did Goldilocks break?",
  "narration": "Goldilocks tries three chairs. One is too big and hard, one is too big and soft, and the small one feels just right until it breaks.",
  "options": [
   {
    "label": "Baby Bear's chair",
    "correct": true
   },
   {
    "label": "Father Bear's chair",
    "correct": false,
    "reason": "Too big and hard, but not broken."
   },
   {
    "label": "Mother Bear's chair",
    "correct": false,
    "reason": "Too big and soft, but not broken."
   }
  ]
 },
 {
  "key": "Beds",
  "pick": 1,
  "question": "Which bed was just right for Goldilocks?",
  "narration": "Feeling sleepy, Goldilocks goes upstairs and tries three beds. One is too hard, one is too soft, and one is just right. She falls fast asleep.",
  "options": [
   {
    "label": "Baby Bear's bed",
    "correct": true
   },
   {
    "label": "Father Bear's bed",
    "correct": false,
    "reason": "Too hard."
   },
   {
    "label": "Mother Bear's bed",
    "correct": false,
    "reason": "Too soft."
   }
  ]
 },
 {
  "key": "Return",
  "pick": 3,
  "question": "The bears come home. What do they notice? Pick 3 things.",
  "narration": "The bears find that someone ate the porridge, sat in the chairs and lay in the beds. Baby Bear shouts, \"Someone has been lying in my bed, and here she is!\"",
  "options": [
   {
    "label": "Someone ate the porridge",
    "correct": true
   },
   {
    "label": "Someone sat in the chairs",
    "correct": true
   },
   {
    "label": "Someone is in the bed",
    "correct": true
   },
   {
    "label": "The door was painted",
    "correct": false,
    "reason": "Nothing was painted."
   },
   {
    "label": "The roof was missing",
    "correct": false,
    "reason": "The roof was fine."
   }
  ]
 },
 {
  "key": "Run",
  "pick": 1,
  "question": "What did Goldilocks learn?",
  "narration": "Goldilocks wakes up in fright, jumps out of bed and runs back into the forest. She never goes into a stranger's home uninvited again.",
  "options": [
   {
    "label": "Do not go into a home uninvited",
    "correct": true
   },
   {
    "label": "Porridge is always too hot",
    "correct": false,
    "reason": "That is not the lesson."
   },
   {
    "label": "Bears are always asleep",
    "correct": false,
    "reason": "They were out for a walk."
   }
  ]
 }
];
