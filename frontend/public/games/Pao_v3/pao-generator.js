// Pao the Panda — built on the Rhyme Time Pao (viewBox 0 0 240 300, same anatomy, gradients and colors)
// arms: { l: [angleDeg, length, front?], r: [angleDeg, length, front?] }  (0 = straight down; left arm +, right arm −)
function paoR(o) {
  o = Object.assign({ l: [12, 62], r: [-12, 62], eyes: 'open', mouth: 'smile', brows: '', tilt: 0, look: [0, 0], lift: 0, extra: [], prop: '' }, o);
  const D = '#2b1f1a';
  const defs = '<defs><radialGradient id="pw" cx=".35" cy=".3"><stop offset="0" stop-color="#f6d3a3"/><stop offset="1" stop-color="#d9a062"/></radialGradient><radialGradient id="wb" cx=".4" cy=".3"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e3eaf4"/></radialGradient><radialGradient id="dk" cx=".35" cy=".3"><stop offset="0" stop-color="#5a3f35"/><stop offset="1" stop-color="#2f201b"/></radialGradient></defs>';
  const arm = (x, a, len) => `<g transform="translate(${x} 182) rotate(${a})"><rect x="-15" y="-10" width="30" height="${len}" rx="15" fill="url(#dk)" stroke="${D}" stroke-width="2"/><circle cx="0" cy="${len - 6}" r="19" fill="url(#pw)" stroke="#b88446" stroke-width="2.5"/><ellipse cx="-5" cy="${len - 12}" rx="7" ry="5" fill="#fff" opacity=".45"/></g>`;
  const star = (x, y, sc, c) => `<path transform="translate(${x} ${y}) scale(${sc})" d="M0 -12 3.5 -3.7 12 -3.7 5.2 1.6 7.5 10 0 5 -7.5 10 -5.2 1.6 -12 -3.7 -3.5 -3.7z" fill="${c}" stroke="#e0a100" stroke-width="1.2"/>`;
  const [lx, ly] = o.look;
  const eye = (cx, r) => { const ir = r * .72, pr = r * .36; return `<circle cx="${cx}" cy="98" r="${r}" fill="#fff"/><circle cx="${cx + lx}" cy="${98 + ly}" r="${ir}" fill="#9a5f33" stroke="#6b3d1e" stroke-width="1.5"/><circle cx="${cx + lx}" cy="${99 + ly}" r="${pr}" fill="#1b120e"/><circle cx="${cx + lx + 3}" cy="${94 + ly}" r="${r * .22}" fill="#fff"/><circle cx="${cx + lx - 3}" cy="${102 + ly}" r="1.6" fill="#fff"/>`; };
  const happy = cx => `<path d="M${cx - 11} 102 Q${cx} 88 ${cx + 11} 102" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  const closed = cx => `<path d="M${cx - 11} 96 Q${cx} 108 ${cx + 11} 96" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  const starEye = cx => star(cx, 99, 1.25, '#ffd166');
  const EYES = {
    open: eye(91, 15.5) + eye(149, 15.5),
    soft: eye(91, 14) + eye(149, 14),
    wide: eye(91, 17) + eye(149, 17),
    happy: happy(91) + happy(149),
    closed: closed(91) + closed(149),
    wink: eye(91, 15.5) + happy(149),
    star: starEye(91) + starEye(149),
  };
  const MOUTH = {
    big: '<path d="M100 134 Q120 134 140 134 Q138 166 120 168 Q102 166 100 134Z" fill="#7a2e2e" stroke="#2b1f1a" stroke-width="2.5" stroke-linejoin="round"/><path d="M107 156 Q120 145 133 156 Q128 167 120 167 Q112 167 107 156Z" fill="#f2849c"/>',
    talk: '<path d="M104 136 Q120 136 136 136 Q134 158 120 160 Q106 158 104 136Z" fill="#7a2e2e" stroke="#2b1f1a" stroke-width="2.5" stroke-linejoin="round"/><path d="M110 152 Q120 145 130 152 Q126 159 120 159 Q114 159 110 152Z" fill="#f2849c"/>',
    o: '<ellipse cx="120" cy="147" rx="10" ry="12" fill="#7a2e2e" stroke="#2b1f1a" stroke-width="2.5"/><ellipse cx="120" cy="153" rx="6" ry="4.5" fill="#f2849c"/>',
    small_o: '<ellipse cx="120" cy="146" rx="6" ry="7" fill="#7a2e2e" stroke="#2b1f1a" stroke-width="2.5"/>',
    smile: '<path d="M108 140 Q120 152 132 140" stroke="#2b1f1a" stroke-width="3.5" fill="none" stroke-linecap="round"/>',
    w: '<path d="M120 132 v6 M106 140 Q113 149 120 140 Q127 149 134 140" stroke="#2b1f1a" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    wavy: '<path d="M106 145 q7 -6 14 0 t14 0" stroke="#2b1f1a" stroke-width="3.5" fill="none" stroke-linecap="round"/>',
    flat: '<path d="M110 145 Q120 148 130 145" stroke="#2b1f1a" stroke-width="3.5" fill="none" stroke-linecap="round"/>',
    tongue: '<path d="M106 140 Q120 154 134 140" stroke="#2b1f1a" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M114 146 Q120 160 126 146Z" fill="#f2849c" stroke="#2b1f1a" stroke-width="2"/>',
  };
  const BROWS = {
    raised: '<path d="M83 67 Q91 62 99 67" stroke="#2b1f1a" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M141 67 Q149 62 157 67" stroke="#2b1f1a" stroke-width="3" fill="none" stroke-linecap="round"/>',
    worry: '<path d="M82 66 L100 72" stroke="#2b1f1a" stroke-width="3" stroke-linecap="round"/><path d="M158 66 L140 72" stroke="#2b1f1a" stroke-width="3" stroke-linecap="round"/>',
    one: '<path d="M141 64 Q149 58 157 64" stroke="#2b1f1a" stroke-width="3" fill="none" stroke-linecap="round"/>',
  };
  const HAT = `<g transform="rotate(-8 120 40)"><path d="M72 46 L124 8 L164 44 Z" fill="#7b5cff" stroke="${D}" stroke-width="3" stroke-linejoin="round"/><ellipse cx="118" cy="46" rx="54" ry="10" fill="#ffd166" stroke="${D}" stroke-width="3"/>${star(120, 30, .7, '#ffd166')}<circle cx="124" cy="9" r="7" fill="#ffd166" stroke="${D}" stroke-width="2"/></g>`;
  const head = `<g transform="rotate(${o.tilt} 120 110)"><circle cx="58" cy="50" r="25" fill="url(#dk)" stroke="${D}" stroke-width="2"/><circle cx="182" cy="50" r="25" fill="url(#dk)" stroke="${D}" stroke-width="2"/><ellipse cx="64" cy="56" rx="12" ry="11" fill="#f08aa6"/><ellipse cx="176" cy="56" rx="12" ry="11" fill="#f08aa6"/><ellipse cx="120" cy="106" rx="72" ry="66" fill="url(#wb)" stroke="${D}" stroke-width="3"/><ellipse cx="91" cy="98" rx="21" ry="25" transform="rotate(20 91 98)" fill="url(#dk)"/><ellipse cx="149" cy="98" rx="21" ry="25" transform="rotate(-20 149 98)" fill="url(#dk)"/>${EYES[o.eyes] || EYES.open}${BROWS[o.brows] || ''}<ellipse cx="72" cy="127" rx="13" ry="7" fill="#f7a8bb" opacity=".75"/><ellipse cx="168" cy="127" rx="13" ry="7" fill="#f7a8bb" opacity=".75"/><path d="M110 120 Q120 116 130 120 Q128 130 120 132 Q112 130 110 120Z" fill="${D}"/><ellipse cx="116" cy="121" rx="3" ry="1.8" fill="#fff" opacity=".6"/>${MOUTH[o.mouth] || MOUTH.smile}${o.hat ? HAT : ''}</g>`;

  const PROPS = {
    box: `<g><rect x="66" y="196" width="108" height="64" rx="8" fill="#e9b678" stroke="#a4692e" stroke-width="3"/><path d="M66 212h108" stroke="#a4692e" stroke-width="3"/><text x="120" y="248" text-anchor="middle" font-size="22" font-weight="900" fill="#7a4a1c" font-family="Arial, sans-serif">GAME</text>${star(92, 194, .9, '#ffd166')}<circle cx="120" cy="190" r="8" fill="#7bdff2" stroke="#2e8cb0" stroke-width="2"/>${star(148, 194, .8, '#ff8fab')}</g>`,
    book: `<g transform="rotate(-4 120 225)"><rect x="70" y="196" width="100" height="58" rx="6" fill="#7b5cff" stroke="${D}" stroke-width="3"/><path d="M120 196v58" stroke="${D}" stroke-width="3"/><rect x="77" y="202" width="38" height="46" rx="3" fill="#fff8e7"/><rect x="125" y="202" width="38" height="46" rx="3" fill="#fff8e7"/><path d="M82 214h28M82 224h22M130 214h28M130 224h20" stroke="#c3b5ff" stroke-width="3" stroke-linecap="round"/></g>`,
    heart: `<path transform="translate(120 206) scale(2.2)" d="M0 6C-6 -2 -16 2 -12 10L0 22 12 10C16 2 6 -2 0 6z" fill="#ff8fab" stroke="${D}" stroke-width="1.2"/>`,
  };
  const EXTRA = {
    waves: '<path d="M214 104 q10 14 0 28M226 96 q18 22 0 44" stroke="#7b5cff" stroke-width="5" fill="none" stroke-linecap="round"/>',
    motion: '<path d="M222 118 q8 -6 10 -16M226 142 q10 -2 14 -12" stroke="#ffd166" stroke-width="5" fill="none" stroke-linecap="round"/>',
    stretch: '<path d="M16 60 l14 8M12 86 l16 -2M224 60 l-14 8M228 86 l-16 -2" stroke="#ffd166" stroke-width="4.5" stroke-linecap="round"/>',
    stararc: '<path d="M30 46 Q120 -30 210 46" stroke="#c3b5ff" stroke-width="3" fill="none" stroke-dasharray="2 8" stroke-linecap="round"/>' + star(34, 40, 1.2, '#ffd166') + star(120, 10, 1.1, '#ff8fab') + star(206, 40, 1.2, '#7bdff2'),
    stars: star(26, 40, 1.4, '#ffd166') + star(214, 46, 1.2, '#ffd166') + star(30, 170, .9, '#7bdff2') + star(210, 170, .9, '#ff8fab'),
    sparkle: star(28, 60, 1.1, '#ffd166') + star(214, 70, .9, '#7bdff2') + star(212, 180, .8, '#ff8fab'),
    stopwatch: `<g transform="translate(204 112)"><rect x="-5" y="-38" width="10" height="9" rx="3" fill="#7b5cff"/><circle cx="0" cy="-8" r="25" fill="#fff" stroke="#7b5cff" stroke-width="6"/><path d="M0 -24 V-8 L11 2" stroke="${D}" stroke-width="4.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>`,
    question: `<g transform="translate(190 4)"><rect width="44" height="40" rx="14" fill="#7b5cff"/><path d="M10 38 4 50 20 38z" fill="#7b5cff"/><text x="22" y="30" text-anchor="middle" font-size="28" font-weight="900" fill="#fff" font-family="Arial, sans-serif">?</text></g>`,
    bang: `<g transform="translate(192 4)"><rect width="40" height="40" rx="14" fill="#ffd166"/><path d="M10 38 4 50 20 38z" fill="#ffd166"/><text x="20" y="31" text-anchor="middle" font-size="30" font-weight="900" fill="#7a4a1c" font-family="Arial, sans-serif">!</text></g>`,
    thought: '<circle cx="198" cy="40" r="5" fill="#c3b5ff"/><circle cx="210" cy="24" r="7" fill="#c3b5ff"/><circle cx="226" cy="8" r="9" fill="#c3b5ff"/>',
    bulb: '<g transform="translate(36 38)"><path d="M-22 -18l-6 -6M22 -18l6 -6M0 -30v-8M-26 0h-8M26 0h8" stroke="#ffd166" stroke-width="3" stroke-linecap="round"/><circle cx="0" cy="-4" r="17" fill="#ffd166"/><rect x="-8" y="12" width="16" height="9" rx="3" fill="#b7a8e6"/></g>',
    heart: '<path transform="translate(212 28) scale(1.3)" d="M0 6C-6 -2 -16 2 -12 10L0 22 12 10C16 2 6 -2 0 6z" fill="#ff8fab"/>',
    zzz: '<text x="182" y="40" font-size="30" font-weight="900" fill="#9b86e8" font-family="Arial, sans-serif">z</text><text x="202" y="20" font-size="22" font-weight="900" fill="#9b86e8" font-family="Arial, sans-serif">z</text><text x="218" y="6" font-size="16" font-weight="900" fill="#9b86e8" font-family="Arial, sans-serif">z</text>',
    confetti: '<rect x="18" y="30" width="9" height="16" rx="3" fill="#ff8fab" transform="rotate(20 22 38)"/><rect x="214" y="40" width="9" height="16" rx="3" fill="#7bdff2" transform="rotate(-25 218 48)"/><circle cx="26" cy="150" r="6" fill="#ffd166"/><circle cx="216" cy="140" r="6" fill="#7cd992"/><rect x="40" y="6" width="8" height="14" rx="3" fill="#7cd992" transform="rotate(-30 44 13)"/><rect x="196" y="4" width="8" height="14" rx="3" fill="#ffd166" transform="rotate(30 200 11)"/>' ,
    drop: `<path d="M190 58 Q182 74 190 79 Q198 74 190 58Z" fill="#7fd3ff" stroke="${D}" stroke-width="2"/>`,
  };
  const L = arm(80, o.l[0], o.l[1]), R = arm(160, o.r[0], o.r[1]);
  let body = `<ellipse cx="96" cy="272" rx="24" ry="15" fill="url(#dk)" stroke="${D}" stroke-width="2"/><ellipse cx="144" cy="272" rx="24" ry="15" fill="url(#dk)" stroke="${D}" stroke-width="2"/><ellipse cx="96" cy="270" rx="14" ry="8" fill="url(#pw)"/><ellipse cx="144" cy="270" rx="14" ry="8" fill="url(#pw)"/><ellipse cx="120" cy="218" rx="50" ry="56" fill="url(#wb)" stroke="${D}" stroke-width="3"/>`;
  const holding = o.prop === 'box' || o.prop === 'book' || o.prop === 'heart';
  if (holding) body += head + PROPS[o.prop] + L + R;
  else body += (o.l[2] ? '' : L) + (o.r[2] ? '' : R) + head + (o.l[2] ? L : '') + (o.r[2] ? R : '');
  const ex = (o.extra || []).map(k => EXTRA[k] || '').join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 300">${defs}<ellipse cx="120" cy="290" rx="${o.lift ? 52 : 64}" ry="7" fill="#000" opacity=".12"/><g transform="translate(0 ${-o.lift})">${body}${ex}</g></svg>`;
}

const PAO_POSES = {
  // loading modal
  'pao-hello':      { l: [14, 62], r: [-140, 62], eyes: 'open', mouth: 'big', extra: ['waves'] },
  'pao-stretch':    { l: [160, 74, true], r: [-160, 74, true], eyes: 'happy', mouth: 'o', extra: ['stretch'], lift: 4 },
  'pao-juggle':     { l: [118, 64], r: [-118, 64], eyes: 'open', look: [0, -4], mouth: 'big', extra: ['stararc'] },
  'pao-carry':      { l: [34, 54], r: [-34, 54], eyes: 'open', mouth: 'big', prop: 'box' },
  'pao-ready':      { l: [140, 74], r: [-140, 74], eyes: 'happy', mouth: 'big', extra: ['stars'], lift: 12 },
  'pao-slow':       { l: [12, 62], r: [-150, 50, true], eyes: 'soft', look: [2, -1], brows: 'raised', mouth: 'smile', extra: ['stopwatch'] },
  // game moments
  'pao-wave-happy': { l: [14, 62], r: [-140, 62], eyes: 'happy', mouth: 'big', extra: ['motion'] },
  'pao-idle':       { l: [12, 62], r: [-12, 62], eyes: 'open', mouth: 'w' },
  'pao-idle-happy': { l: [12, 62], r: [-12, 62], eyes: 'open', mouth: 'big' },
  'pao-asking':     { l: [62, 62], r: [-62, 62], eyes: 'open', mouth: 'o', extra: ['question'] },
  'pao-listen':     { l: [12, 62], r: [-160, 54, true], eyes: 'open', look: [3, -1], mouth: 'small_o', tilt: 6, extra: ['waves'] },
  'pao-point':      { l: [14, 62], r: [-96, 66], eyes: 'open', look: [4, 0], mouth: 'smile' },
  'pao-point-talk': { l: [14, 62], r: [-96, 66], eyes: 'open', look: [4, 0], mouth: 'talk' },
  'pao-thinking':   { l: [14, 62], r: [160, 52, true], eyes: 'soft', look: [1, -4], mouth: 'wavy', tilt: 6, extra: ['thought'] },
  'pao-idea':       { l: [14, 62], r: [-96, 66], eyes: 'wide', mouth: 'big', extra: ['bulb'] },
  'pao-reading':    { l: [28, 50], r: [-28, 50], eyes: 'happy', mouth: 'w', prop: 'book' },
  'pao-correct':    { l: [140, 74], r: [-140, 74], eyes: 'happy', mouth: 'big', extra: ['stars'], lift: 12 },
  'pao-proud':      { l: [140, 74], r: [-14, 62], eyes: 'wink', mouth: 'tongue', extra: ['sparkle'] },
  'pao-try-again':  { l: [12, 62], r: [-30, 62], eyes: 'soft', look: [0, 2], brows: 'raised', mouth: 'smile', tilt: -10, extra: ['heart'] },
  'pao-encourage':  { l: [30, 54], r: [-30, 54], eyes: 'soft', brows: 'raised', mouth: 'smile', prop: 'heart' },
  'pao-surprised':  { l: [128, 64], r: [-128, 64], eyes: 'wide', mouth: 'o', extra: ['bang'] },
  'pao-celebrate':  { l: [145, 74], r: [-145, 74], eyes: 'star', mouth: 'big', extra: ['confetti'], lift: 12 },
  'pao-sleepy':     { l: [8, 62], r: [-8, 62], eyes: 'closed', mouth: 'small_o', tilt: -8, extra: ['zzz'] },
  'pao-wizard':     { l: [28, 50], r: [-28, 50], eyes: 'happy', mouth: 'w', prop: 'book', hat: true },
};
if (typeof module !== 'undefined') module.exports = { paoR, PAO_POSES };
