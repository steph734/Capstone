// All Emergency Ready content as data: the 6 emergencies, their 4 intro cards, 4 safety steps and go-bag items.
// Illustrations are scene specs (see illustrations/Scene.jsx): a child or teen doing one action. Pao is never in a scene.
import { PEOPLE } from './illustrations/Scene'

const h = (who, x, y, pose = 'stand', extra = {}) => ({ ...PEOPLE[who], x, y, pose, ...extra })
const kid = (x, pose, who = 'boy', extra) => h(who, x, 118, pose, extra)
const grown = (x, pose, who = 'adult', extra) => h(who, x, 98, pose, extra)
const scene = (bg, people, props, caption) => ({ bg, people, props, caption })

const CLUES = {
  see: { id: 'see', label: 'See' },
  hear: { id: 'hear', label: 'Hear' },
  feel: { id: 'feel', label: 'Feel' },
  smell: { id: 'smell', label: 'Smell' },
}
const clue = (type, text) => ({ ...CLUES[type], text })

export const ITEM_LABELS = {
  water: 'Water', flashlight: 'Flashlight', firstaid: 'First aid kit', canned: 'Canned food', whistle: 'Whistle', radio: 'Radio', clothes: 'Extra clothes',
  phone: 'Phone and power bank', medicine: 'Medicine (with a grown-up)', idcard: 'ID and contact card',
  videogame: 'Video game', teddy: 'Big teddy bear', toys: 'Toys', candy: 'Candy bag',
}

export const EMERGENCIES = [
  {
    id: 'earthquake', name: 'Earthquake', rule: 'Drop, Cover, Hold On', tint: '#fff3d6',
    intro: [
      { title: 'What is an earthquake?', text: 'An earthquake is when the ground shakes. It stops after a short time.', scene: scene('room', [kid(170, 'both')], [['shake'], ['lamp', { x: 320, y: 30 }]], 'The ground shakes.') },
      { title: 'How do you know there is an earthquake?', text: 'You may notice it with your body and your ears.', clues: [clue('feel', 'The floor moves'), clue('hear', 'A low rumbling'), clue('see', 'Things shake')], scene: scene('room', [kid(170, 'both', 'girl')], [['table', { x: 280, y: 160, s: 0.8 }], ['shake']], 'You feel the floor move.') },
      { title: 'Why can it be dangerous?', text: 'Things can fall when the ground shakes. That is why we know what to do.', scene: scene('room', [kid(130, 'stand', 'boy2', { mouth: 'flat' })], [['shelf', { x: 290, y: 60 }], ['shake']], 'Things may fall.') },
      { title: 'Who helps us?', text: 'Grown-ups and rescuers help us stay safe. In a real emergency, call 911.', scene: scene('outdoor', [kid(120, 'stand', 'girl2'), grown(200, 'point', 'rescuer')], [['badge911']], 'Grown-ups and rescuers help.') },
    ],
    steps: [
      { title: 'Drop to the floor', reason: 'Dropping keeps you steady so you do not fall.', scene: scene('room', [kid(200, 'crouch')], [['shake']], 'Drop to the floor.') },
      { title: 'Cover your head under a strong table', reason: 'The table protects your head from falling things.', scene: scene('room', [kid(200, 'crouch', 'girl')], [['table', { x: 200, y: 112, s: 1.15 }]], 'Cover your head under a table.') },
      { title: 'Hold on until the shaking stops', reason: 'Holding the table keeps it over you.', scene: scene('room', [kid(200, 'hold', 'boy2', { y: 124 })], [['table', { x: 200, y: 112, s: 1.15 }], ['shake']], 'Hold on until it stops.') },
      { title: 'Go outside carefully with a grown-up', reason: 'Walk away from buildings to an open place.', scene: scene('outdoor', [grown(150, 'point'), kid(210, 'stand', 'girl2')], [['house', { x: 330, y: 70 }]], 'Go outside with a grown-up.') },
    ],
    goBag: { needed: ['water', 'flashlight', 'firstaid', 'whistle', 'canned', 'phone'], notNeeded: ['videogame', 'teddy'] },
  },
  {
    id: 'fire', name: 'Fire', rule: 'Get out, stay low', tint: '#ffe3e3',
    intro: [
      { title: 'What is a fire?', text: 'A fire is very hot and makes smoke. Stay far away from it.', scene: scene('kitchen', [kid(110, 'stand', 'girl2')], [['stove', { x: 300, y: 112 }], ['smoke', { x: 300, y: 36 }]], 'Fire is hot. It makes smoke.') },
      { title: 'How do you know there is a fire?', text: 'A fire can start in the kitchen, from wires, or from candles. You may notice it with your eyes, ears and nose.', clues: [clue('see', 'Smoke or flames'), clue('hear', 'The smoke alarm beeping'), clue('smell', 'Something burning')], scene: scene('room', [kid(150, 'point', 'boy')], [['alarm', { x: 260, y: 46 }]], 'That beeping is the smoke alarm.') },
      { title: 'Why is a fire dangerous?', text: 'Smoke makes it hard to breathe. Clean air is low, near the floor.', scene: scene('room', [kid(180, 'up', 'boy2', { mouth: 'flat' })], [['smoke', { x: 200, y: 30, big: true }]], 'Smoke goes up. Clean air is low.') },
      { title: 'Who helps us?', text: 'Grown-ups and firefighters help us. Call 911 or tell a grown-up right away.', scene: scene('outdoor', [kid(130, 'stand', 'girl'), grown(215, 'point', 'firefighter')], [['badge911']], 'Firefighters help us.') },
    ],
    steps: [
      { title: 'Shout "Fire!" and tell a grown-up', reason: 'A grown-up can call for help.', scene: scene('room', [kid(130, 'wave', 'boy', { mouth: 'open' }), grown(250, 'stand', 'dad')], [['alarm', { x: 330, y: 40 }]], 'Shout "Fire!" and tell a grown-up.') },
      { title: 'Get low and crawl under the smoke', reason: 'Smoke goes up, so we stay low.', scene: scene('room', [kid(210, 'crawl', 'girl2', { y: 168 })], [['smoke', { x: 200, y: 34, big: true }]], 'Smoke goes up. We stay low.') },
      { title: 'Touch the door. If it is hot, use another way', reason: 'A hot door means fire may be on the other side.', scene: scene('room', [kid(150, 'point', 'boy2')], [['door', { x: 290, y: 66, hot: true }]], 'If the door is hot, use another way.') },
      { title: 'Get out, stay out, go to the meeting place', reason: 'Outside is safe. Wait for help there.', scene: scene('outdoor', [kid(120, 'point', 'girl'), grown(200, 'point')], [['exit', { x: 330, y: 34 }], ['flag', { x: 330, y: 130 }]], 'Get out and stay out.') },
    ],
    goBag: { needed: ['water', 'firstaid', 'idcard', 'phone', 'clothes', 'whistle'], notNeeded: ['toys', 'candy'] },
  },
  {
    id: 'typhoon', name: 'Typhoon', rule: 'Stay inside, stay away from windows', tint: '#e4eefb',
    intro: [
      { title: 'What is a typhoon?', text: 'A typhoon (bagyo) brings very strong wind and heavy rain.', scene: scene('storm', [], [['tree', { x: 90, y: 90, bent: true }], ['wind', { x: 260, y: 70 }], ['house', { x: 300, y: 90 }]], 'Strong wind and heavy rain.') },
      { title: 'How do you know a typhoon is coming?', text: 'We hear about it on the news or the radio before it comes.', clues: [clue('see', 'Dark clouds'), clue('hear', 'Wind and radio news'), clue('feel', 'Rain starting')], scene: scene('room', [kid(150, 'hold', 'girl')], [['radio', { x: 220, y: 150 }]], 'Listen to the radio news.') },
      { title: 'Why can it be dangerous?', text: 'Strong wind can break trees and roofs, so we stay inside.', scene: scene('storm', [], [['tree', { x: 120, y: 90, bent: true }], ['wind', { x: 280, y: 80 }], ['house', { x: 300, y: 100 }]], 'Wind can break trees and roofs.') },
      { title: 'Who helps us?', text: 'PAGASA tells us the weather. The barangay and rescuers help us stay safe. Call 911 if needed.', scene: scene('outdoor', [kid(120, 'stand', 'boy2'), grown(210, 'point', 'rescuer')], [['badge911']], 'PAGASA, the barangay and rescuers help.') },
    ],
    steps: [
      { title: 'Stay inside', reason: 'Inside the house we are safest from the wind.', scene: scene('room', [kid(180, 'stand', 'boy')], [['window', { x: 320, y: 36, rainy: true }]], 'Stay inside.') },
      { title: 'Stay away from windows', reason: 'Windows can break in strong wind.', scene: scene('room', [kid(100, 'point', 'girl2')], [['window', { x: 300, y: 36, rainy: true }]], 'Stay away from windows.') },
      { title: 'Listen to the radio with a grown-up', reason: 'The radio tells us what to do next.', scene: scene('room', [grown(130, 'sit'), kid(230, 'hold', 'girl')], [['radio', { x: 310, y: 160 }]], 'Listen to the radio with a grown-up.') },
      { title: 'Go to the evacuation center if told', reason: 'It is a strong, safe building for everyone.', scene: scene('outdoor', [grown(130, 'point'), kid(200, 'stand', 'boy2')], [['sign', { x: 320, y: 90 }]], 'Go to the evacuation center.') },
    ],
    goBag: { needed: ['water', 'flashlight', 'radio', 'canned', 'firstaid', 'clothes'], notNeeded: ['videogame', 'candy'] },
  },
  {
    id: 'flood', name: 'Flood', rule: 'Go to high ground', tint: '#ddf0fb',
    intro: [
      { title: 'What is a flood?', text: 'A flood is when water covers the streets and the ground.', scene: scene('flood', [kid(110, 'stand', 'girl2', { y: 100 })], [['house', { x: 300, y: 70 }]], 'Water covers the street.') },
      { title: 'How do you know there is a flood?', text: 'Water gets higher outside after heavy rain.', clues: [clue('see', 'Water rising'), clue('hear', 'Heavy rain'), clue('feel', 'Wet ground')], scene: scene('room', [kid(130, 'point', 'boy')], [['window', { x: 300, y: 30, rainy: true }]], 'The water is rising outside.') },
      { title: 'Why can it be dangerous?', text: 'Flood water can rise fast and carry things away. It can be dirty too.', scene: scene('flood', [], [['house', { x: 200, y: 70 }], ['wind', { x: 90, y: 70 }]], 'Water can rise fast.') },
      { title: 'Who helps us?', text: 'Grown-ups and rescuers help us. Call 911 if you need help.', scene: scene('outdoor', [kid(130, 'stand', 'boy2'), grown(210, 'wave', 'rescuer')], [['badge911']], 'Rescuers help us.') },
    ],
    steps: [
      { title: 'Go to high ground with a grown-up', reason: 'Higher places stay dry.', scene: scene('outdoor', [grown(130, 'point'), kid(190, 'stand', 'girl')], [['hill', { x: 300, y: 90 }]], 'Go to high ground.') },
      { title: 'Never walk or play in flood water', reason: 'The water can be deep, fast and dirty.', scene: scene('flood', [kid(110, 'point', 'boy2', { y: 100 })], [['stop', { x: 280, y: 70 }]], 'Never walk or play in flood water.') },
      { title: 'Stay away from electric wires', reason: 'Water and electricity are a dangerous mix.', scene: scene('outdoor', [kid(120, 'point', 'girl2')], [['pole', { x: 310, y: 30 }], ['stop', { x: 220, y: 70 }]], 'Stay away from electric wires.') },
      { title: 'Wait for help and listen to grown-ups', reason: 'Rescuers know the safest way.', scene: scene('room', [grown(130, 'sit'), kid(240, 'sit', 'boy')], [['window', { x: 320, y: 36 }]], 'Wait with a grown-up for help.') },
    ],
    goBag: { needed: ['water', 'whistle', 'firstaid', 'idcard', 'phone', 'clothes'], notNeeded: ['teddy', 'toys'] },
  },
  {
    id: 'lost', name: 'Getting lost', rule: 'Stay put, find a helper', tint: '#e2f6ea',
    intro: [
      { title: 'What does "lost" mean?', text: 'You cannot find your family. It is okay to feel a little scared.', scene: scene('street', [kid(180, 'stand', 'girl2', { mouth: 'flat' })], [], 'You cannot find your family.') },
      { title: 'How do you know you are lost?', text: 'You look around and you do not see your family.', clues: [clue('see', 'No family near you'), clue('hear', 'Busy, loud places'), clue('feel', 'A little worried')], scene: scene('street', [kid(150, 'point', 'boy')], [], 'Look around. Stay calm.') },
      { title: 'Why does staying put help?', text: 'If you stay in one place, your family can find you faster.', scene: scene('street', [kid(180, 'sit', 'girl')], [['bench', { x: 180, y: 160 }]], 'Staying put helps people find you.') },
      { title: 'Who are safe helpers?', text: 'Police, guards, store staff and moms with children are safe helpers.', scene: scene('street', [h('police', 110, 98, 'stand'), h('staff', 190, 98, 'stand'), h('adult', 270, 98, 'stand'), kid(330, 'stand', 'boy2', { s: 0.8 })], [], 'Police, guards, store staff and moms help.') },
    ],
    steps: [
      { title: 'Stop and stay where you are', reason: 'Staying put lets your family find you.', scene: scene('street', [kid(200, 'stand', 'boy2')], [['stop', { x: 300, y: 60 }]], 'Stop and stay where you are.') },
      { title: 'Find a safe helper', reason: 'Safe helpers know how to help.', scene: scene('street', [kid(130, 'point', 'girl2'), h('police', 280, 98, 'stand')], [], 'Find a safe helper.') },
      { title: 'Say your name and your parent\'s phone number', reason: 'Then the helper can call your family.', scene: scene('street', [kid(130, 'stand', 'girl', { mouth: 'open' }), h('staff', 270, 98, 'stand')], [['speech', { x: 130, y: 36, text: 'My name is…' }]], 'Say your name and phone number.') },
      { title: 'Wait with the helper', reason: 'Your family is coming for you.', scene: scene('street', [kid(150, 'sit', 'boy'), h('police', 270, 98, 'stand')], [['bench', { x: 150, y: 160 }]], 'Wait with the helper.') },
    ],
    goBag: { needed: ['idcard', 'phone', 'water', 'whistle', 'canned', 'clothes'], notNeeded: ['videogame', 'candy'] },
  },
  {
    id: 'outage', name: 'Power outage', rule: 'Use a flashlight, not candles', tint: '#eceafd',
    intro: [
      { title: 'What is a power outage?', text: 'The lights and fans turn off because there is no electricity.', scene: scene('night', [kid(190, 'stand', 'girl')], [['dark']], 'The lights turn off.') },
      { title: 'How do you know there is a power outage?', text: 'Everything electric stops working.', clues: [clue('see', 'It gets dark'), clue('hear', 'The fan stops'), clue('feel', 'It gets warm')], scene: scene('night', [kid(170, 'point', 'boy2')], [['dark']], 'It gets dark and quiet.') },
      { title: 'Why do we need to be careful?', text: 'Candles can start fires. A flashlight is much safer.', scene: scene('night', [kid(130, 'stand', 'girl2')], [['candle', { x: 270, y: 150, off: true }]], 'Candles can start fires.') },
      { title: 'Who helps us?', text: 'Grown-ups know what to do. Call 911 if you need help.', scene: scene('night', [kid(130, 'stand', 'boy'), grown(220, 'hold', 'dad')], [['flashlight', { x: 250, y: 120 }], ['badge911', { x: 330, y: 34 }]], 'Grown-ups help us.') },
    ],
    steps: [
      { title: 'Stay calm and stay still', reason: 'Moving in the dark can make you bump into things.', scene: scene('night', [kid(190, 'sit', 'girl')], [], 'Stay calm and stay still.') },
      { title: 'Use a flashlight, not candles', reason: 'A flashlight can not start a fire.', scene: scene('night', [kid(130, 'hold', 'boy2')], [['flashlight', { x: 160, y: 130 }]], 'Use a flashlight.') },
      { title: 'Stay away from wires and outlets', reason: 'Wires can be dangerous when you can not see.', scene: scene('night', [kid(120, 'point', 'girl2')], [['outlet', { x: 300, y: 110, off: true }]], 'Stay away from wires and outlets.') },
      { title: 'Wait with a grown-up', reason: 'Together we wait until the lights come back.', scene: scene('night', [grown(130, 'sit', 'dad'), kid(240, 'sit', 'boy')], [['flashlight', { x: 190, y: 140, beam: false }]], 'Wait with a grown-up.') },
    ],
    goBag: { needed: ['flashlight', 'radio', 'water', 'canned', 'firstaid', 'phone'], notNeeded: ['toys', 'teddy'] },
  },
]

export const findEmergency = (id) => EMERGENCIES.find((e) => e.id === id)

export const DEFAULT_SETTINGS = { shown: EMERGENCIES.map((e) => e.id), readAloud: true, practice: true, hotline: '911', sound: true }

const KEY = 'emergencyReady:settings:'
export function loadSettings(who) {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(KEY + who) || '{}') } } catch { return { ...DEFAULT_SETTINGS } }
}
export function saveSettings(who, s) {
  try { localStorage.setItem(KEY + who, JSON.stringify(s)) } catch { /* private mode */ }
}

const LEARNED = 'emergencyReady:learned:'
export function loadLearned(who) {
  try { return new Set(JSON.parse(localStorage.getItem(LEARNED + who) || '[]')) } catch { return new Set() }
}
export function saveLearned(who, set) {
  try { localStorage.setItem(LEARNED + who, JSON.stringify([...set])) } catch { /* private mode */ }
}

export const shuffle = (a) => { const r = [...a]; for (let i = r.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]] } return r }
