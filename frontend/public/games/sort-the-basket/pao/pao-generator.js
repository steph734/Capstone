// Pao the Panda — parametric SVG (soft brown/golden style)
let __paoId = 0;
function pao(o) {
  o = Object.assign({ eyes: 'open', mouth: 'smile', arms: 'down', hat: false, extra: '', look: [0, 0], brows: '' }, o);
  const id = 'p' + (++__paoId);
  const K = '#3A2522', K2 = '#5A3A33', W = '#FFFFFF', P = '#F7A6BC', PI = '#F28DAE', T = '#D9A15B';
  let s = `<defs>
    <radialGradient id="${id}f" cx="45%" cy="38%" r="70%"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".75" stop-color="#F6F3FA"/><stop offset="1" stop-color="#DCD6E6"/></radialGradient>
    <radialGradient id="${id}b" cx="45%" cy="35%" r="75%"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".7" stop-color="#F3F0F8"/><stop offset="1" stop-color="#D6D0E2"/></radialGradient>
    <radialGradient id="${id}k" cx="40%" cy="30%" r="80%"><stop offset="0" stop-color="#6A463D"/><stop offset="1" stop-color="${K}"/></radialGradient>
    <radialGradient id="${id}t" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#F6D08F"/><stop offset=".6" stop-color="${T}"/><stop offset="1" stop-color="#B07A3A"/></radialGradient>
    <radialGradient id="${id}e" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#C98A4E"/><stop offset="1" stop-color="#7A4421"/></radialGradient>
  </defs>`;
  const KF = `url(#${id}k)`, TF = `url(#${id}t)`;
  // shadow
  s += `<ellipse cx="150" cy="352" rx="78" ry="10" fill="rgba(60,40,80,.16)"/>`;
  // feet
  s += `<ellipse cx="118" cy="338" rx="30" ry="16" fill="${KF}"/><ellipse cx="182" cy="338" rx="30" ry="16" fill="${KF}"/>`;
  s += `<ellipse cx="118" cy="343" rx="18" ry="8" fill="${TF}"/><ellipse cx="182" cy="343" rx="18" ry="8" fill="${TF}"/>`;
  // body
  s += `<ellipse cx="150" cy="268" rx="60" ry="76" fill="url(#${id}b)" stroke="${K}" stroke-width="4"/>`;
  // arms
  const arm = (x1, y1, x2, y2) => `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="${KF}" stroke-width="30" stroke-linecap="round"/><path d="M${x1} ${y1} L${x2} ${y2}" stroke="${K}" stroke-width="30" stroke-linecap="round" opacity=".85"/>`;
  const paw = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r || 20}" fill="${TF}" stroke="#A8743A" stroke-width="2"/><ellipse cx="${x - 6}" cy="${y - 7}" rx="6" ry="4" fill="#FBE3B8" opacity=".9"/>`;
  const A = {
    down: [[100, 230, 82, 300], [200, 230, 218, 300]],
    up: [[102, 226, 56, 150], [198, 226, 244, 150]],
    wave: [[100, 230, 82, 300], [198, 226, 250, 146]],
    point: [[100, 230, 82, 300], [200, 232, 284, 214]],
    chin: [[100, 230, 82, 300], [200, 234, 186, 206]],
    book: [[100, 232, 116, 278], [200, 232, 184, 278]],
    ear: [[100, 230, 82, 300], [198, 226, 246, 140]],
    heart: [[100, 232, 128, 266], [200, 232, 172, 266]],
    cheer: [[102, 226, 54, 156], [200, 232, 222, 296]],
  }[o.arms] || [[100, 230, 82, 300], [200, 230, 218, 300]];
  A.forEach(a => s += arm(...a));
  if (o.arms === 'book') {
    s += `<g transform="rotate(-6 150 285)"><rect x="98" y="258" width="104" height="58" rx="6" fill="#7C5CE6" stroke="${K}" stroke-width="3"/><path d="M150 258v58" stroke="${K}" stroke-width="3"/><rect x="105" y="264" width="40" height="46" rx="3" fill="#FFF8E7"/><rect x="155" y="264" width="40" height="46" rx="3" fill="#FFF8E7"/><path d="M111 276h28M111 286h24M161 276h28M161 286h22" stroke="#B9A9E8" stroke-width="3" stroke-linecap="round"/></g>`;
  }
  if (o.arms === 'heart') {
    s += `<path d="M150 304 C110 280 112 248 134 246 C144 245 150 254 150 258 C150 254 156 245 166 246 C188 248 190 280 150 304Z" fill="#FF5C8A" stroke="${K}" stroke-width="3"/>`;
  }
  A.forEach(a => s += paw(a[2], a[3]));
  // ears
  s += `<circle cx="78" cy="56" r="32" fill="${KF}"/><circle cx="222" cy="56" r="32" fill="${KF}"/>`;
  s += `<ellipse cx="81" cy="60" rx="15" ry="14" fill="${PI}"/><ellipse cx="219" cy="60" rx="15" ry="14" fill="${PI}"/>`;
  // head
  s += `<ellipse cx="150" cy="130" rx="100" ry="90" fill="url(#${id}f)" stroke="${K}" stroke-width="4"/>`;
  // eye patches
  s += `<ellipse cx="112" cy="132" rx="30" ry="34" fill="${KF}" transform="rotate(18 112 132)"/>`;
  s += `<ellipse cx="188" cy="132" rx="30" ry="34" fill="${KF}" transform="rotate(-18 188 132)"/>`;
  // eyes
  const [lx, ly] = o.look;
  const eye = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${W}"/><circle cx="${cx + lx}" cy="${cy + ly}" r="${r * 0.72}" fill="url(#${id}e)"/><circle cx="${cx + lx}" cy="${cy + ly}" r="${r * 0.38}" fill="#2A1612"/><circle cx="${cx + lx - r * 0.28}" cy="${cy + ly - r * 0.3}" r="${r * 0.24}" fill="${W}"/><circle cx="${cx + lx + r * 0.3}" cy="${cy + ly + r * 0.3}" r="${r * 0.1}" fill="${W}"/>`;
  const arc = (cx, cy, up) => `<path d="M${cx - 14} ${cy + (up ? 5 : -3)} Q${cx} ${cy + (up ? -13 : 11)} ${cx + 14} ${cy + (up ? 5 : -3)}" stroke="${W}" stroke-width="6" fill="none" stroke-linecap="round"/>`;
  const E = {
    open: eye(113, 134, 19) + eye(187, 134, 19),
    wide: eye(113, 132, 22) + eye(187, 132, 22),
    happy: arc(113, 136, true) + arc(187, 136, true),
    closed: arc(113, 136, false) + arc(187, 136, false),
    wink: eye(113, 134, 19) + arc(187, 136, true),
    star: [113, 187].map(cx => `<path d="M${cx} 116 l6 12 13 2 -9 9 2 13 -12 -6 -12 6 2 -13 -9 -9 13 -2z" fill="#FFD23F" stroke="${W}" stroke-width="2"/>`).join(''),
  };
  s += E[o.eyes] || E.open;
  if (o.brows === 'worry') s += `<path d="M96 92 L126 102M204 92 L174 102" stroke="${K}" stroke-width="5" stroke-linecap="round"/>`;
  if (o.brows === 'think') s += `<path d="M98 96 Q113 86 128 94M174 88 Q190 80 204 90" stroke="${K}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  // cheeks
  s += `<ellipse cx="84" cy="168" rx="15" ry="9" fill="${P}" opacity=".85"/><ellipse cx="216" cy="168" rx="15" ry="9" fill="${P}" opacity=".85"/>`;
  // nose
  s += `<path d="M140 162 Q150 156 160 162 Q156 172 150 173 Q144 172 140 162Z" fill="${K}"/><ellipse cx="146" cy="162" rx="3" ry="2" fill="#8C6A62"/>`;
  // mouth
  const M = {
    smile: `<path d="M134 180 Q142 190 150 180 Q158 190 166 180" stroke="${K}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
    big: `<path d="M130 178 Q150 216 170 178 Q150 184 130 178Z" fill="${K2}" stroke="${K}" stroke-width="3" stroke-linejoin="round"/><path d="M139 196 Q150 212 161 196 Q150 190 139 196Z" fill="#F0607E"/>`,
    o: `<ellipse cx="150" cy="190" rx="10" ry="12" fill="${K2}" stroke="${K}" stroke-width="3"/><ellipse cx="150" cy="195" rx="6" ry="5" fill="#F0607E"/>`,
    flat: `<path d="M138 186 Q150 190 162 186" stroke="${K}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
    soft: `<path d="M137 190 Q150 181 163 190" stroke="${K}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
    tongue: `<path d="M134 180 Q142 190 150 180 Q158 190 166 180" stroke="${K}" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M144 186 Q150 202 156 186Z" fill="#F0607E"/>`,
  };
  s += M[o.mouth] || M.smile;
  if (o.hat) {
    s += `<g transform="rotate(-10 150 40)"><path d="M94 46 L168 -60 L210 44 Z" fill="#5B3FD6" stroke="${K}" stroke-width="4" stroke-linejoin="round"/><ellipse cx="152" cy="46" rx="64" ry="13" fill="#FFC93C" stroke="${K}" stroke-width="4"/><path d="M150 -4 l4 8 9 1 -7 6 2 9 -8 -5 -8 5 2 -9 -7 -6 9 -1z" fill="#FFD23F"/><circle cx="168" cy="-60" r="9" fill="#FFC93C" stroke="${K}" stroke-width="3"/></g>`;
  }
  const star = (x, y, r, c) => `<path d="M${x} ${y - r} L${x + r * .29} ${y - r * .4} ${x + r * .95} ${y - r * .31} ${x + r * .47} ${y + r * .15} ${x + r * .59} ${y + r * .81} ${x} ${y + r * .5} ${x - r * .59} ${y + r * .81} ${x - r * .47} ${y + r * .15} ${x - r * .95} ${y - r * .31} ${x - r * .29} ${y - r * .4}Z" fill="${c}" stroke="#C99A1E" stroke-width="1.5" stroke-linejoin="round"/>`;
  const X = {
    sparkle: star(36, 110, 16, '#FFD23F') + star(268, 92, 12, '#7FDCEB') + star(262, 232, 10, '#FF8FA8'),
    confetti: `<rect x="20" y="40" width="12" height="20" rx="3" fill="#FF6F91" transform="rotate(20 26 50)"/><rect x="268" y="60" width="12" height="20" rx="3" fill="#4FC3F7" transform="rotate(-25 274 70)"/><circle cx="40" cy="220" r="7" fill="#FFD23F"/><circle cx="276" cy="200" r="7" fill="#7CD992"/>` + star(40, -20, 14, '#FFD23F') + star(262, -10, 14, '#FFD23F'),
    question: `<text x="252" y="64" font-size="66" font-weight="900" fill="#FFD23F" font-family="Nunito,sans-serif" stroke="${K}" stroke-width="3">?</text>`,
    bang: `<text x="258" y="64" font-size="66" font-weight="900" fill="#FFD23F" font-family="Nunito,sans-serif" stroke="${K}" stroke-width="3">!</text>`,
    zzz: `<text x="236" y="34" font-size="40" font-weight="900" fill="#9B86E8" font-family="Nunito,sans-serif">z</text><text x="262" y="4" font-size="30" font-weight="900" fill="#9B86E8" font-family="Nunito,sans-serif">z</text><text x="282" y="-20" font-size="22" font-weight="900" fill="#9B86E8" font-family="Nunito,sans-serif">z</text>`,
    drop: `<path d="M244 84 Q234 104 244 110 Q254 104 244 84Z" fill="#7FD3FF" stroke="${K}" stroke-width="2.5"/>`,
    waves: `<path d="M278 120 q12 16 0 32M292 110 q20 26 0 52" stroke="#7C5CE6" stroke-width="6" fill="none" stroke-linecap="round"/>`,
    motion: `<path d="M278 124 q10 -6 14 -18M282 152 q12 -2 20 -12" stroke="#FFC93C" stroke-width="6" fill="none" stroke-linecap="round"/>`,
    bulb: `<g transform="translate(236 -26)"><circle cx="24" cy="24" r="22" fill="#FFE27A" stroke="${K}" stroke-width="3"/><rect x="14" y="44" width="20" height="14" rx="3" fill="#B9A9E8" stroke="${K}" stroke-width="3"/><path d="M24 12v10M16 24h16" stroke="${K}" stroke-width="3" stroke-linecap="round"/></g>`,
  };
  (o.extra || '').split(' ').forEach(k => { if (X[k]) s += X[k]; });
  return `<svg viewBox="-20 -60 340 420" xmlns="http://www.w3.org/2000/svg">${s}</svg>`;
}
