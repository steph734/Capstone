// Every line Pao speaks, in English / Tagalog / Cebuano (Bisaya) — the three
// choices offered by the language picker shown when a session enters the
// Gamified Activities games screen (see PaoLanguageModal in GamifiedFullPage).
//
// A "line" is either a plain { en, tl, ceb } object, or a function that
// returns one (for lines that need to interpolate a value, e.g. a score).
// `pickLine` resolves either shape down to the string for the current
// language, falling back to English if a translation is ever missing.
//
// Note: exercise *content* that a child is meant to hear and echo back
// (e.g. the practice words in Slow-Motion Echo, or picture/word choices)
// intentionally stays in English regardless of the selected language — only
// Pao's own narration, coaching, and cheer lines change language.

export function pickLine(line, lang, ...args) {
  const resolved = typeof line === 'function' ? line(...args) : line
  return resolved[lang] || resolved.en
}

export function pickRandomLine(lines, lang, ...args) {
  const line = lines[Math.floor(Math.random() * lines.length)]
  return pickLine(line, lang, ...args)
}

// ─── GamifiedFullPage — intro, games list, category picker ───────────────────

export const FULL_PAGE_LINES = {
  introHello: {
    en: `Hehe! Teehee! Oh wow, hello there, my brand new friend! I am Pao, your very own panda buddy! Yay! Welcome to Gamified Activities, the most super duper fun place in the whole wide world! I am so so excited to learn and play with you!`,
    tl: `Hehe! Teehee! Naku, kumusta ka, aking bagong kaibigan! Ako si Pao, ang sarili mong panda buddy! Yehey! Maligayang pagdating sa Gamified Activities, ang pinaka-masayang lugar sa buong mundo! Sobrang saya at excited ako na matuto at maglaro kasama ka!`,
    ceb: `Hehe! Teehee! Uy, kumusta ka, akong bag-ong higala! Ako si Pao, imong kaugalingong panda buddy! Yehey! Welcome sa Gamified Activities, ang pinaka-lingaw nga dapit sa tibuok kalibutan! Sobra kong excited nga makat-on ug magdula uban nimo!`,
  },
  introMechanics: {
    en: `Here is how it works! You can play six super fun learning games right here! Each game helps you speak and learn better every single day! Finish games to earn experience points! The more you play, the stronger and smarter your character becomes!`,
    tl: `Ganito ang paglalaro! Puwede kang maglaro ng anim na super saya na learning games dito! Ang bawat laro ay tumutulong sa iyo na magsalita at matuto nang mas mahusay araw-araw! Tapusin ang mga laro para makakuha ng experience points! Habang mas marami kang nilalaro, mas lumalakas at lumalalim ang iyong kaalaman!`,
    ceb: `Mao ni ang paagi! Makadula ka og unom ka super lingaw nga learning games diri! Ang matag dula makatabang nimo nga mosulti ug makat-on og mas maayo matag adlaw! Human-a ang mga dula aron makadawat og experience points! Kin subra imong gidula, mas kusgan ug mas maalamon imong karakter!`,
  },
  introLevels: {
    en: `As you play games, your character will LEVEL UP! Whoosh! And every time you level up, your special stats get stronger! You have Intelligence for smart thinking, Focus for paying attention, Resistance for never giving up, Creativity for big ideas, Speed for quick answers, and Memory for remembering things! Some games need a higher level to unlock, so keep playing!`,
    tl: `Habang naglalaro ka, ang iyong karakter ay LELEVEL UP! Whoosh! At tuwing lumelevel up ka, lumalakas ang iyong mga espesyal na stats! Meron kang Intelligence para sa matalinong pag-iisip, Focus para sa pagbibigay pansin, Resistance para hindi sumuko, Creativity para sa malalaking ideya, Speed para sa mabilis na sagot, at Memory para sa pag-alala ng mga bagay! Ang ibang laro ay kailangan ng mas mataas na level para ma-unlock, kaya patuloy na maglaro!`,
    ceb: `Samtang nagdula ka, ang imong karakter mo-LEVEL UP! Whoosh! Ug matag level up nimo, mas mokusog ang imong espesyal nga stats! Naa kay Intelligence para sa maalamon nga panghunahuna, Focus para sa pagtagad, Resistance para dili mosurender, Creativity para sa dagkong mga ideya, Speed para sa paspas nga tubag, ug Memory para sa paghinumdom sa mga butang! Ang pipila ka dula nagkinahanglan og mas taas nga level aron ma-unlock, so padayon lang og dula!`,
  },
  introBadges: {
    en: `And here is the most exciting part! When you finish games, you will earn special BADGES! Yay! You can use those badges to dress me up with brand new shoes, cool clothes, awesome pants, and fun hairstyles! Heehee! I cannot wait to see what you choose for me! Let us go!`,
    tl: `At ito na ang pinaka-kaaya-ayang bahagi! Kapag natapos mo ang mga laro, makakakuha ka ng mga espesyal na BADGES! Yehey! Magagamit mo ang mga badge na iyon para bihisan ako ng bagong sapatos, magagandang damit, astig na pantalon, at masayang hairstyle! Heehee! Hindi ako makapaghintay makita kung ano ang pipiliin mo para sa akin! Tara na!`,
    ceb: `Ug ang pinaka-lingaw nga bahin ani! Kung mahuman nimo ang mga dula, makadawat ka og espesyal nga mga BADGES! Yehey! Magamit nimo kanang mga badge para sul-oban ko og bag-ong sapatos, tarong nga sinina, cool nga pantalon, ug lingaw nga hairstyle! Heehee! Dili ko mahulat nga makita kung unsa imong pilion para nako! Dali na!`,
  },
  gamesScript: {
    en: `Hehe! Ta da! Look at all these amazing games! All just for you! The Picture Word Matching game is unlocked and ready! Click it to start! I know you are going to be amazing!`,
    tl: `Hehe! Ta da! Tignan mo ang lahat ng mga kahanga-hangang larong ito! Lahat para sa iyo! Ang Picture Word Matching game ay bukas na at handa na! I-click ito para magsimula! Alam kong magiging kahanga-hanga ka!`,
    ceb: `Hehe! Ta da! Tan-awa kining tanan nga nindot nga mga dula! Tanan para nimo! Ang Picture Word Matching game bukas na ug andam na! I-click para magsugod! Sigurado ko nga mangindot ang imong buhaton!`,
  },
  customizeReady: {
    en: `Hehe! Let us play some games now!`,
    tl: `Hehe! Maglaro na tayo ngayon!`,
    ceb: `Hehe! Dula na ta karon!`,
  },
  categoryPrompt: {
    en: `Which category would you like to practice today? Pick one and let us go!`,
    tl: `Aling kategorya ang gusto mong pag-practice-han ngayon? Pumili ng isa at tara na!`,
    ceb: `Unsa nga kategorya ang gusto nimong praktisan karon? Pagpili og usa ug dali na!`,
  },
}

export const CLICK_REACT_LINES = [
  { pitch: 1.7,  en: `Hehe! Heehee! That was fun! Teehee! Hehe!`, tl: `Hehe! Heehee! Nakakatuwa yun! Teehee! Hehe!`, ceb: `Hehe! Heehee! Lingaw kaayo na! Teehee! Hehe!` },
  { pitch: 1.68, en: `Yay! You found me! I am so happy you are here with me today!`, tl: `Yehey! Nahanap mo ako! Ang saya-saya ko na kasama kita ngayon!`, ceb: `Yehey! Nakit-an nimo ko! Sobra kong lipay nga naa ka uban nako karon!` },
  { pitch: 1.65, en: `Oh, hi there! You are doing such a great job!`, tl: `O, hi! Ang galing-galing mo talaga!`, ceb: `Oy, hi diha! Nindot kaayo ang imong gibuhat!` },
  { pitch: 1.72, en: `Teehee! I like it when you visit me! Let us keep playing!`, tl: `Teehee! Gustung-gusto ko kapag binibisita mo ako! Magpatuloy tayong maglaro!`, ceb: `Teehee! Ganahan ko kung mobisita ka nako! Padayon ta sa pagdula!` },
  { pitch: 1.66, en: `Hello hello! High five! We are best friends, you and me!`, tl: `Hello hello! High five! Magkaibigan tayong dalawa!`, ceb: `Hello hello! High five! Managhigala ta, ikaw ug ako!` },
  { pitch: 1.7,  en: `Hehe! I am here with you! You can do it!`, tl: `Hehe! Nandito ako kasama mo! Kaya mo yan!`, ceb: `Hehe! Ania ko uban nimo! Kaya nimo na!` },
]

// ─── PictureWordGame ───────────────────────────────────────────────────────

export const PICTURE_WORD_LINES = {
  prompt: {
    en: `Look at the picture! Which word matches?`,
    tl: `Tingnan mo ang larawan! Aling salita ang tugma?`,
    ceb: `Tan-awa ang hulagway! Unsa nga pulong ang tugma?`,
  },
  cheersCorrect: [
    { en: `Yay! That is right!`, tl: `Yehey! Tama iyan!`, ceb: `Yehey! Sakto na!` },
    { en: `Amazing! You got it!`, tl: `Ang galing! Nakuha mo!`, ceb: `Nindot kaayo! Nakuha nimo!` },
    { en: `Brilliant! Well done!`, tl: `Astig! Magaling!`, ceb: `Brilyante! Maayo kaayo!` },
    { en: `Super! You are so smart!`, tl: `Super! Ang galing mo!`, ceb: `Super! Kaayo ka kaalam!` },
    { en: `Wow! Perfect match!`, tl: `Wow! Perpektong tugma!`, ceb: `Wow! Perpekto nga tugma!` },
    { en: `Awesome job!`, tl: `Astig na trabaho!`, ceb: `Nindot kaayo nga buhat!` },
  ],
  cheersWrong: [
    { en: `Good try! Let us keep going!`, tl: `Magandang subok! Magpatuloy tayo!`, ceb: `Maayong sulay! Padayon ta!` },
    { en: `Almost there! Next one!`, tl: `Malapit na! Susunod naman!`, ceb: `Duol na! Sunod na!` },
    { en: `Keep going, you are doing great!`, tl: `Ituloy mo, ang galing mo!`, ceb: `Padayon, nindot kaayo imong ginabuhat!` },
    { en: `That is okay! Try the next one!`, tl: `Ayos lang iyan! Subukan ang susunod!`, ceb: `Okay ra na! Sulayi ang sunod!` },
  ],
  finishStars3: {
    en: `Perfect score! You are absolutely amazing!`,
    tl: `Perpektong iskor! Talagang kahanga-hanga ka!`,
    ceb: `Perpekto nga score! Sobra ka nindot!`,
  },
  finishStars2: {
    en: `Great job! You are getting really good at this!`,
    tl: `Magaling! Talagang gumagaling ka dito!`,
    ceb: `Maayo kaayo! Kusog gyud ka ana!`,
  },
  finishStars1: {
    en: `Good effort! Practice makes perfect, keep going!`,
    tl: `Magandang pagsisikap! Ang pagsasanay ay nagpapaganda, ituloy mo lang!`,
    ceb: `Maayong paningkamot! Ang praktis maoy makahingpit, padayon lang!`,
  },
  scoreLine: (score, total) => ({
    en: `You got ${score} out of ${total}!`,
    tl: `Nakuha mo ang ${score} sa ${total}!`,
    ceb: `Nakuha nimo ang ${score} sa ${total}!`,
  }),
  badgeScript: {
    en: `Heehee! Congratulations! You just earned the WORD WIZARD badge! Yay! That wizard hat is all yours now! And guess what? This badge unlocks brand new items you can use to customize ME! Go to the Customize page and try them on! I cannot wait to wear something cool! Teehee!`,
    tl: `Heehee! Congratulations! Nakuha mo ang WORD WIZARD badge! Yehey! Ang wizard hat na iyan ay iyo na ngayon! At alam mo ba? Ang badge na ito ay nag-a-unlock ng mga bagong item na magagamit mo para i-customize ako! Pumunta sa Customize page at subukan mo sila! Hindi ako makapaghintay magsuot ng cool na bagay! Teehee!`,
    ceb: `Heehee! Congratulations! Nakuha nimo ang WORD WIZARD badge! Yehey! Kanang wizard hat imo na karon! Ug guess what? Kining badge nag-unlock og bag-ong mga item nga imong magamit para i-customize ko! Adto sa Customize page ug sulayi sila! Dili ko mahulat nga magsul-ob og cool nga butang! Teehee!`,
  },
}

// ─── SlowMotionEchoGame — coaching lines only; practice words stay English ──

export const ECHO_GAME_LINES = {
  cheersFull: [
    { en: `Wow! You said it perfectly! Yay!`, tl: `Wow! Perpekto ang pagkasabi mo! Yehey!`, ceb: `Wow! Perpekto imong pagsulti! Yehey!` },
    { en: `Amazing! That was just right!`, tl: `Ang galing! Tama na tama iyan!`, ceb: `Nindot kaayo! Sakto gyud na!` },
    { en: `Super! You got every sound!`, tl: `Super! Nakuha mo ang bawat tunog!`, ceb: `Super! Nakuha nimo ang matag tingog!` },
    { en: `Fantastic job, speech star!`, tl: `Astig na trabaho, speech star!`, ceb: `Nindot kaayo, speech star!` },
  ],
  cheersClose: [
    { en: `Nice try! Let us hear it once more!`, tl: `Magandang subok! Marinig natin ulit!`, ceb: `Maayong sulay! Paminawon nato pag-usab!` },
    { en: `So close! Listen again and try!`, tl: `Ang lapit na! Makinig ulit at subukan!`, ceb: `Duol na kaayo! Paminaw pag-usab ug sulayi!` },
    { en: `Good effort! One more time!`, tl: `Magandang pagsisikap! Isa pang beses!`, ceb: `Maayong paningkamot! Kausa pa!` },
  ],
  cheersNone: [
    { en: `That is okay! Let us try again together!`, tl: `Ayos lang iyan! Subukan natin ulit sama-sama!`, ceb: `Okay ra na! Sulayan nato pag-usab og duyog!` },
    { en: `No worries! Listen closely and try!`, tl: `Wag kang mag-alala! Makinig nang mabuti at subukan!`, ceb: `Ayaw kabalaka! Paminaw pag-ayo ug sulayi!` },
    { en: `Let us give it another go!`, tl: `Subukan natin ulit!`, ceb: `Sulayan nato pag-usab!` },
  ],
  finishStars3: {
    en: `Amazing echoing! Your sounds are getting so clear!`,
    tl: `Ang galing ng echo mo! Lumilinaw na nang lumilinaw ang mga tunog mo!`,
    ceb: `Nindot kaayo nga echo! Klaro na kaayo ang imong mga tingog!`,
  },
  finishStars2: {
    en: `Great practice! You are getting stronger every time!`,
    tl: `Magandang practice! Lumalakas ka nang lumalakas!`,
    ceb: `Maayong praktis! Kusog ka og kusog matag higayon!`,
  },
  finishStars1: {
    en: `Good try today! Slow and steady practice really helps!`,
    tl: `Magandang subok ngayon! Ang dahan-dahan ngunit tuluy-tuloy na practice ay talagang nakakatulong!`,
    ceb: `Maayong sulay karon! Ang hinay pero padayon nga praktis dako gyud og tabang!`,
  },
  badgeScript: {
    en: `Wow! You just earned the ECHO MASTER badge! Every single syllable, nice and clear, across every level! That Echo Scarf is all yours now! Go to the Customize page and try it on! Teehee!`,
    tl: `Wow! Nakuha mo ang ECHO MASTER badge! Bawat pantig, malinaw at maayos, sa lahat ng level! Ang Echo Scarf na iyan ay iyo na ngayon! Pumunta sa Customize page at subukan mo ito! Teehee!`,
    ceb: `Wow! Nakuha nimo ang ECHO MASTER badge! Matag silaba, klaro ug maayo, sa tanang level! Kanang Echo Scarf imo na karon! Adto sa Customize page ug sulayi kini! Teehee!`,
  },
}

// ─── PuzzlePiecesGame ────────────────────────────────────────────────────────

export const PUZZLE_COLOR_NAMES = {
  'Orange':            { en: 'Orange',            tl: 'Kahel',            ceb: 'Kahel' },
  'Black and White':   { en: 'Black and White',   tl: 'Itim at Puti',     ceb: 'Itom ug Puti' },
  'Blue':              { en: 'Blue',              tl: 'Asul',             ceb: 'Asul' },
  'Yellow':            { en: 'Yellow',            tl: 'Dilaw',            ceb: 'Dalag' },
  'Brown':             { en: 'Brown',              tl: 'Kayumanggi',      ceb: 'Kolor-Kape' },
}

export const PUZZLE_ANIMAL_NAMES = {
  'Lion':     { en: 'Lion',     tl: 'Leon',     ceb: 'Leon' },
  'Zebra':    { en: 'Zebra',    tl: 'Sebra',    ceb: 'Sebra' },
  'Elephant': { en: 'Elephant', tl: 'Elepante', ceb: 'Elepante' },
  'Giraffe':  { en: 'Giraffe',  tl: 'Giraffe',  ceb: 'Giraffe' },
  'Bear':     { en: 'Bear',     tl: 'Oso',      ceb: 'Oso' },
}

export const PUZZLE_POSITION_WORDS = {
  top:    { en: 'on top',  tl: 'sa ibabaw', ceb: 'sa taas' },
  under:  { en: 'under',   tl: 'sa ilalim', ceb: 'sa ubos' },
  nextTo: { en: 'next to', tl: 'sa tabi',   ceb: 'sa kilid' },
}

function localAnimal(animal, lang) {
  return {
    name: pickLine(PUZZLE_ANIMAL_NAMES[animal.name] || { en: animal.name, tl: animal.name, ceb: animal.name }, lang),
    colorName: pickLine(PUZZLE_COLOR_NAMES[animal.colorName] || { en: animal.colorName, tl: animal.colorName, ceb: animal.colorName }, lang),
  }
}

export const PUZZLE_LINES = {
  nudges: [
    { en: `Hmm, not quite! Let us look again!`, tl: `Hmm, hindi pa iyan! Tignan natin ulit!`, ceb: `Hmm, dili pa na! Tan-awon nato pag-usab!` },
    { en: `Almost! Try another piece!`, tl: `Malapit na! Subukan mo ang ibang piraso!`, ceb: `Duol na! Sulayi ang laing piraso!` },
    { en: `That is a different friend! Keep looking together!`, tl: `Ibang kaibigan iyan! Magpatuloy tayong maghanap!`, ceb: `Lahi na nga higala! Padayon ta og pangita!` },
    { en: `Good try! Let us find the right one!`, tl: `Magandang subok! Hanapin natin ang tamang piraso!`, ceb: `Maayong sulay! Pangitaon nato ang husto!` },
  ],
  finishLine: {
    en: `Wow, you finished the whole puzzle! You are such a great problem solver! High five!`,
    tl: `Wow, natapos mo ang buong puzzle! Ang galing mong problem solver! High five!`,
    ceb: `Wow, nahuman nimo ang tibuok puzzle! Kaayo ka kamaayo mo-solve og problema! High five!`,
  },
  praiseFor: (animal, stepKey) => {
    const a = { en: localAnimal(animal, 'en'), tl: localAnimal(animal, 'tl'), ceb: localAnimal(animal, 'ceb') }
    const word = { en: PUZZLE_POSITION_WORDS[stepKey].en, tl: PUZZLE_POSITION_WORDS[stepKey].tl, ceb: PUZZLE_POSITION_WORDS[stepKey].ceb }
    return {
      en: `Yay! ${a.en.colorName} ${a.en.name}! Right ${word.en}!`,
      tl: `Yehey! ${a.tl.colorName} na ${a.tl.name}! Nasa ${word.tl}!`,
      ceb: `Yehey! ${a.ceb.colorName} nga ${a.ceb.name}! Naa sa ${word.ceb}!`,
    }
  },
  promptFor: (stepKey, animal, refAnimal) => {
    const a = { en: localAnimal(animal, 'en'), tl: localAnimal(animal, 'tl'), ceb: localAnimal(animal, 'ceb') }
    const r = refAnimal ? { en: localAnimal(refAnimal, 'en'), tl: localAnimal(refAnimal, 'tl'), ceb: localAnimal(refAnimal, 'ceb') } : null
    if (stepKey === 'top') {
      return {
        en: `Let's find this one together! Look for the ${a.en.colorName} ${a.en.name} piece — it goes right ON TOP!`,
        tl: `Hanapin natin ito nang magkasama! Hanapin ang ${a.tl.colorName} na piraso ng ${a.tl.name} — ito ay nasa IBABAW!`,
        ceb: `Pangitaon nato ni og duyog! Pangitaa ang ${a.ceb.colorName} nga piraso sa ${a.ceb.name} — ni naa sa TAAS!`,
      }
    }
    if (stepKey === 'under') {
      return {
        en: `Now let's find the ${a.en.colorName} ${a.en.name}! This piece goes right UNDER the ${r.en.name}!`,
        tl: `Ngayon hanapin natin ang ${a.tl.colorName} na ${a.tl.name}! Ang pirasong ito ay nasa ILALIM ng ${r.tl.name}!`,
        ceb: `Karon pangitaon nato ang ${a.ceb.colorName} nga ${a.ceb.name}! Kining piraso naa sa UBOS sa ${r.ceb.name}!`,
      }
    }
    return {
      en: `Last piece! Find the ${a.en.colorName} ${a.en.name} — it goes right NEXT TO the ${r.en.name}!`,
      tl: `Huling piraso! Hanapin ang ${a.tl.colorName} na ${a.tl.name} — ito ay nasa TABI ng ${r.tl.name}!`,
      ceb: `Kataposang piraso! Pangitaa ang ${a.ceb.colorName} nga ${a.ceb.name} — ni naa sa KILID sa ${r.ceb.name}!`,
    }
  },
}

// ─── LittleRedRidingHoodGame ─────────────────────────────────────────────────

export const RED_RIDING_HOOD_LINES = {
  intro: {
    en: `Let's help Little Red Riding Hood get to Grandma's house! First, let's pack her basket with the right things!`,
    tl: `Tulungan natin si Little Red Riding Hood na makarating sa bahay ni Lola! Una, ihanda natin ang tamang laman ng kanyang basket!`,
    ceb: `Tabangan nato si Little Red Riding Hood nga makaabot sa balay ni Lola! Una, andaman nato ang husto nga sulod sa iyang basket!`,
  },
  path: {
    en: `Yay! The basket is all packed! Time to head into the woods! Oh look, the path splits in two — which way should Red go?`,
    tl: `Yehey! Naihanda na ang basket! Oras na para pumunta sa kagubatan! O tignan mo, nahahati ang daan sa dalawa — saang daan dapat pumunta si Red?`,
    ceb: `Yehey! Andam na ang basket! Panahon na para moadto sa lasang! Uy tan-awa, nabahin ang dalan sa duha — asa nga dalan angay moadto si Red?`,
  },
  wolf: {
    en: `A big Wolf steps out from behind a tree! "Well hello there, Little Red! Where are you off to today?" the Wolf asks with a sly smile.`,
    tl: `Isang malaking Lobo ang lumabas mula sa likod ng puno! "Kumusta, Little Red! Saan ka pupunta ngayon?" tanong ng Lobo na may tusong ngiti.`,
    ceb: `Adunay dakong Lobo nga migawas gikan sa luyo sa kahoy! "Kumusta, Little Red! Asa ka paingon karon?" pangutana sa Lobo nga may malimbongon nga pahiyom.`,
  },
  finish: {
    en: `Wonderful! You helped Little Red Riding Hood all the way through the woods! You thought carefully about every single choice — what a great story explorer!`,
    tl: `Ang galing! Tinulungan mo si Little Red Riding Hood sa buong kagubatan! Maingat mong naisip ang bawat pagpipilian — napakahusay mong story explorer!`,
    ceb: `Nindot kaayo! Gitabangan nimo si Little Red Riding Hood sa tibuok lasang! Maampingon nimong gihunahuna ang matag pagpili — kaayo ka og story explorer!`,
  },
  fastPathObstacle: {
    en: `Red takes the fast path! But uh oh — a fallen branch is blocking the way. Tap it a few times to clear it!`,
    tl: `Kinuha ni Red ang mabilis na daan! Pero uy oh — may nahulog na sanga na humaharang sa daan. I-tap ito ng ilang beses para malinis ito!`,
    ceb: `Gikuha ni Red ang paspas nga dalan! Pero uy — naay nahulog nga sanga nga nag-ali sa dalan. I-tap kini og pipila ka beses para mahawan!`,
  },
  safePathWalk: {
    en: `Red takes the safe path. It is a longer walk, but calm and clear the whole way.`,
    tl: `Kinuha ni Red ang ligtas na daan. Mas mahaba ang lakad, pero kalmado at malinaw ang buong biyahe.`,
    ceb: `Gikuha ni Red ang luwas nga dalan. Mas taas ang lakaw, pero hilom ug hawan sa tibuok dalan.`,
  },
  obstacleCleared: {
    en: `Great job! You cleared the path — that was fast thinking!`,
    tl: `Magaling! Nalinis mo ang daan — mabilis mong naisip iyan!`,
    ceb: `Maayo kaayo! Nahawan nimo ang dalan — paspas kaayo nga panghunahuna na!`,
  },
  basketCheers: [
    { en: `Yes! That belongs in Grandma's basket!`, tl: `Oo! Iyan ay para sa basket ni Lola!`, ceb: `Oo! Kana angay sa basket ni Lola!` },
    { en: `Perfect pick!`, tl: `Perpektong pili!`, ceb: `Perpekto nga pili!` },
    { en: `Great choice for Grandma!`, tl: `Magandang pili para kay Lola!`, ceb: `Maayong pili para kang Lola!` },
  ],
  basketNudges: [
    { en: `Hmm, Grandma probably does not need that!`, tl: `Hmm, siguro hindi kailangan ni Lola iyan!`, ceb: `Hmm, tingali dili na kinahanglan ni Lola!` },
    { en: `Let's find something else for the basket!`, tl: `Maghanap tayo ng iba para sa basket!`, ceb: `Mangita ta og lain para sa basket!` },
    { en: `That one does not quite fit — try another!`, tl: `Hindi bagay iyan — subukan ang iba!`, ceb: `Wala kana mo-fit — sulayi ang lain!` },
  ],
  wolfFeedback: {
    truth: {
      en: `That was honest! But now the Wolf knows exactly where Grandma lives. Being open is kind — just remember to think about who you share plans with.`,
      tl: `Matapat iyan! Pero ngayon alam na ng Lobo kung saan mismo nakatira si Lola. Ang pagiging bukas ay mabait — tandaan lang na isipin kung kanino mo ibinabahagi ang mga plano mo.`,
      ceb: `Matinud-anon na! Pero karon nahibaw-an na sa Lobo asa gyud nagpuyo si Lola. Ang pagka-bukas maayo — hinumdomi lang nga hunahunaon kung kang kinsa nimo ipaambit ang mga plano.`,
    },
    silent: {
      en: `Smart thinking! Walking away keeps your plans private and keeps you safe around strangers.`,
      tl: `Matalinong pag-iisip! Ang paglayo ay nagpapanatili ng pagiging pribado ng iyong mga plano at pinapanatili kang ligtas sa mga estranghero.`,
      ceb: `Maalamon nga panghunahuna! Ang paglakaw palayo nagtago sa imong mga plano ug nagpaluwas nimo palibot sa mga estranghero.`,
    },
    question: {
      en: `Good instinct! Asking a question back helps you understand why someone wants to know something.`,
      tl: `Magandang instinct! Ang pagtatanong pabalik ay tumutulong sa iyo na maintindihan kung bakit gustong malaman ng isang tao ang isang bagay.`,
      ceb: `Maayong instinct! Ang pagpangutana balik makatabang nimo nga masabtan kung nganong gusto masayran sa usa ka tawo ang usa ka butang.`,
    },
  },
}

// ─── PaoCustomizePage ────────────────────────────────────────────────────────

export const CUSTOMIZE_LINES = {
  intro: {
    en: `Heehee! Welcome to my very own wardrobe! This is where you can dress me up! Every time you earn a badge from finishing a game, you unlock brand new items! Right now most things are locked, but as you play more games and earn badges, you will get cool hairstyles, awesome clothes, stylish pants, and cute shoes just for me! I cannot wait to see my new look! Teehee!`,
    tl: `Heehee! Maligayang pagdating sa aking sariling wardrobe! Dito mo ako mabibihisan! Tuwing makakakuha ka ng badge mula sa pagtapos ng isang laro, makaka-unlock ka ng bagong item! Ngayon karamihan ay naka-lock pa, pero habang mas marami kang nilalaro at nakakakuha ng badge, makakakuha ka ng cool na hairstyle, astig na damit, magandang pantalon, at cute na sapatos para sa akin! Hindi ako makapaghintay makita ang bago kong itsura! Teehee!`,
    ceb: `Heehee! Welcome sa akong kaugalingong wardrobe! Diri nimo ko masul-oban! Matag makadawat ka og badge gikan sa paghuman og dula, makadawat ka og bag-ong mga item! Karon kadaghanan naka-lock pa, pero samtang mas daghan kang gidula ug badge nga nakuha, makadawat ka og cool nga hairstyle, tarong nga sinina, nindot nga pantalon, ug cute nga sapatos para nako! Dili ko mahulat nga makita akong bag-ong hitsura! Teehee!`,
  },
  backToNatural: {
    en: `Back to natural!`,
    tl: `Bumalik sa natural!`,
    ceb: `Balik sa natural!`,
  },
  loveTheItem: (itemName) => ({
    en: `Ooh I love the ${itemName}!`,
    tl: `Ooh gustong-gusto ko ang ${itemName}!`,
    ceb: `Ooh ganahan gyud ko sa ${itemName}!`,
  }),
}
