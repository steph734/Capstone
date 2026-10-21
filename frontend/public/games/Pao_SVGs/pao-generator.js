// Pao the Panda — parametric SVG (loading-modal style)
let __paoId = 0;
function pao(o) {
  o = Object.assign({ eyes: 'open', mouth: 'big', arms: 'down', hat: false, extra: '', look: [0, 0], brows: '' }, o);
  const id = 'p' + (++__paoId);
  const K = '#3B2421', W = '#FFFFFF', P = '#F7A6BC', PI = '#F28DAE';
  let s = `<defs>
    <radialGradient id="${id}f" cx="42%" cy="35%" r="72%"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".7" stop-color="#F2F3F9"/><stop offset="1" stop-color="#D3D7E6"/></radialGradient>
    <radialGradient id="${id}b" cx="42%" cy="32%" r="78%"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".7" stop-color="#F1F2F8"/><stop offset="1" stop-color="#CDD2E2"/></radialGradient>
    <radialGradient id="${id}k" cx="38%" cy="28%" r="80%"><stop offset="0" stop-color="#6E4A40"/><stop offset="1" stop-color="${K}"/></radialGradient>
    <linearGradient id="${id}a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5E3D35"/><stop offset="1" stop-color="${K}"/></linearGradient>
    <radialGradient id="${id}t" cx="35%" cy="30%" r="72%"><stop offset="0" stop-color="#F8D9A2"/><stop offset=".55" stop-color="#DDA866"/><stop offset="1" stop-color="#B07A3E"/></radialGradient>
    <radialGradient id="${id}e" cx="45%" cy="40%" r="65%"><stop offset="0" stop-color="#C8874A"/><stop offset="1" stop-color="#7C4523"/></radialGradient>
  </defs>`;
  const KF = `url(#${id}k)`, TF = `url(#${id}t)`, AF = `url(#${id}a)`;

  s += `<ellipse cx="150" cy="352" rx="70" ry="9" fill="rgba(70,60,110,.16)"/>`;
  // feet
  s += `<ellipse cx="120" cy="334" rx="30" ry="18" fill="${KF}"/><ellipse cx="180" cy="334" rx="30" ry="18" fill="${KF}"/>`;
  s += `<ellipse cx="120" cy="337" rx="19" ry="10" fill="${TF}"/><ellipse cx="180" cy="337" rx="19" ry="10" fill="${TF}"/>`;
  // body (egg)
  s += `<path d="M150 188 C194 188 214 246 212 284 C210 324 184 340 150 340 C116 340 90 324 88 284 C86 246 106 188 150 188Z" fill="url(#${id}b)" stroke="${K}" stroke-width="4"/>`;

  const arm = (x1, y1, x2, y2, bend) => {
    const b = bend == null ? (x2 < 150 ? -14 : 14) : bend;
    const mx = (x1 + x2) / 2 + b, my = (y1 + y2) / 2;
    return `<path d="M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}" stroke="${AF}" stroke-width="34" fill="none" stroke-linecap="round"/>`;
  };
  const paw = (x, y, r) => { r = r || 24; return `<circle cx="${x}" cy="${y}" r="${r}" fill="${TF}" stroke="#A9733A" stroke-width="2"/><ellipse cx="${x - r * .3}" cy="${y - r * .35}" rx="${r * .32}" ry="${r * .22}" fill="#FFF1D6" opacity=".9"/>`; };
  const ARMS = {
    down: [[104, 218, 92, 300], [196, 218, 208, 300]],
    wave: [[104, 218, 88, 296], [196, 214, 232, 150]],
    up: [[104, 214, 50, 160], [196, 214, 250, 160]],
    stretch: [[106, 212, 58, 118, 10], [194, 212, 242, 118, -10]],
    juggle: [[104, 214, 44, 186, -6], [196, 214, 256, 186, 6]],
    point: [[104, 218, 92, 300], [196, 220, 282, 206]],
    chin: [[104, 218, 92, 300], [196, 222, 188, 196]],
    ear: [[104, 218, 92, 300], [196, 214, 244, 140]],
    book: [[104, 220, 118, 276], [196, 220, 182, 276]],
    heart: [[104, 220, 128, 264], [196, 220, 172, 264]],
    carry: [[104, 222, 96, 286, -10], [196, 222, 204, 286, 10]],
    clock: [[104, 218, 92, 300], [196, 216, 246, 200]],
    cheer: [[104, 214, 54, 146], [196, 218, 208, 300]],
  };
  const A = ARMS[o.arms] || ARMS.down;
  A.forEach(a => s += arm(...a));

  if (o.arms === 'book') s += `<g transform="rotate(-6 150 285)"><rect x="98" y="256" width="104" height="58" rx="6" fill="#7C5CE6" stroke="${K}" stroke-width="3"/><path d="M150 256v58" stroke="${K}" stroke-width="3"/><rect x="105" y="262" width="40" height="46" rx="3" fill="#FFF8E7"/><rect x="155" y="262" width="40" height="46" rx="3" fill="#FFF8E7"/><path d="M111 274h28M111 284h24M161 274h28M161 284h22" stroke="#B9A9E8" stroke-width="3" stroke-linecap="round"/></g>`;
  if (o.arms === 'heart') s += `<path d="M150 302 C110 278 112 246 134 244 C144 243 150 252 150 256 C150 252 156 243 166 244 C188 246 190 278 150 302Z" fill="#FF5C8A" stroke="${K}" stroke-width="3"/>`;
  if (o.arms === 'carry') {
    s += `<g><rect x="82" y="248" width="136" height="76" rx="8" fill="#E9B678" stroke="#A4692E" stroke-width="4"/><path d="M82 266h136" stroke="#A4692E" stroke-width="4"/><text x="150" y="306" text-anchor="middle" font-size="26" font-weight="800" fill="#7A4A1C" font-family="Nunito,Inter,Arial,sans-serif">GAME</text>`;
    s += star(116, 246, 12, '#FFD23F') + `<circle cx="150" cy="240" r="10" fill="#6FD0F0" stroke="#2E8CB0" stroke-width="2"/>` + star(182, 244, 11, '#FF8FA8') + `</g>`;
  }
  const paws = { carry: [[82, 290], [218, 290]] }[o.arms] || A.map(a => [a[2], a[3]]);

  // ears
  s += `<circle cx="76" cy="56" r="34" fill="${KF}"/><circle cx="224" cy="56" r="34" fill="${KF}"/>`;
  s += `<ellipse cx="80" cy="61" rx="16" ry="15" fill="${PI}"/><ellipse cx="220" cy="61" rx="16" ry="15" fill="${PI}"/>`;
  // head
  s += `<ellipse cx="150" cy="128" rx="100" ry="92" fill="url(#${id}f)" stroke="${K}" stroke-width="4"/>`;
  // eye patches (round, tilted)
  s += `<ellipse cx="114" cy="128" rx="30" ry="35" fill="${KF}" transform="rotate(28 114 128)"/>`;
  s += `<ellipse cx="186" cy="128" rx="30" ry="35" fill="${KF}" transform="rotate(-28 186 128)"/>`;
  const [lx, ly] = o.look;
  const eye = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${W}"/><circle cx="${cx + lx}" cy="${cy + ly}" r="${r * .74}" fill="url(#${id}e)"/><circle cx="${cx + lx}" cy="${cy + ly}" r="${r * .42}" fill="#24130F"/><circle cx="${cx + lx - r * .26}" cy="${cy + ly - r * .3}" r="${r * .24}" fill="${W}"/><circle cx="${cx + lx + r * .28}" cy="${cy + ly + r * .28}" r="${r * .11}" fill="${W}"/>`;
  const arc = (cx, cy, up) => `<path d="M${cx - 15} ${cy + (up ? 6 : -3)} Q${cx} ${cy + (up ? -13 : 12)} ${cx + 15} ${cy + (up ? 6 : -3)}" stroke="${W}" stroke-width="6.5" fill="none" stroke-linecap="round"/>`;
  const E = {
    open: eye(116, 130, 21) + eye(184, 130, 21),
    wide: eye(116, 128, 24) + eye(184, 128, 24),
    happy: arc(116, 132, true) + arc(184, 132, true),
    closed: arc(116, 132, false) + arc(184, 132, false),
    wink: eye(116, 130, 21) + arc(184, 132, true),
    star: [116, 184].map(cx => star(cx, 131, 17, '#FFD23F')).join(''),
  };
  s += E[o.eyes] || E.open;
  if (o.brows === 'worry') s += `<path d="M96 86 L128 96M204 86 L172 96" stroke="${K}" stroke-width="5" stroke-linecap="round"/>`;
  if (o.brows === 'think') s += `<path d="M98 92 Q114 82 130 90M170 84 Q188 76 204 86" stroke="${K}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  // cheeks
  s += `<ellipse cx="80" cy="166" rx="15" ry="9" fill="${P}" opacity=".85"/><ellipse cx="220" cy="166" rx="15" ry="9" fill="${P}" opacity=".85"/>`;
  // nose
  s += `<path d="M139 156 Q150 149 161 156 Q157 167 150 168 Q143 167 139 156Z" fill="${K}"/><ellipse cx="146" cy="156" rx="3.5" ry="2" fill="#8C6A62"/>`;
  const M = {
    big: `<path d="M126 174 Q150 218 174 174 Q150 180 126 174Z" fill="#5A2E28" stroke="${K}" stroke-width="3" stroke-linejoin="round"/><path d="M137 195 Q150 214 163 195 Q150 188 137 195Z" fill="#F0607E"/><path d="M134 177 h32" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" opacity=".9"/>`,
    smile: `<path d="M150 168v6M136 174 Q143 184 150 174 Q157 184 164 174" stroke="${K}" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
    gentle: `<path d="M136 180 Q150 192 164 180" stroke="${K}" stroke-width="4.5" fill="none" stroke-linecap="round"/>`,
    o: `<ellipse cx="150" cy="186" rx="10" ry="13" fill="#5A2E28" stroke="${K}" stroke-width="3"/><ellipse cx="150" cy="192" rx="6" ry="5" fill="#F0607E"/>`,
    flat: `<path d="M138 182 Q150 186 162 182" stroke="${K}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
    soft: `<path d="M137 186 Q150 177 163 186" stroke="${K}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
    tongue: `<path d="M136 174 Q143 184 150 174 Q157 184 164 174" stroke="${K}" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M144 180 Q150 196 156 180Z" fill="#F0607E"/>`,
  };
  s += M[o.mouth] || M.big;
  paws.forEach(p => s += paw(p[0], p[1]));
  if (o.hat) s += `<g transform="rotate(-10 150 40)"><path d="M94 44 L168 -62 L210 42 Z" fill="#5B3FD6" stroke="${K}" stroke-width="4" stroke-linejoin="round"/><ellipse cx="152" cy="44" rx="64" ry="13" fill="#FFC93C" stroke="${K}" stroke-width="4"/>${star(150, 0, 9, '#FFD23F')}<circle cx="168" cy="-62" r="9" fill="#FFC93C" stroke="${K}" stroke-width="3"/></g>`;

  const X = {
    waves: `<path d="M278 104 q12 16 0 32M294 94 q20 26 0 52" stroke="#7C5CE6" stroke-width="6" fill="none" stroke-linecap="round"/>`,
    motion: `<path d="M268 116 q10 -6 14 -18M274 144 q12 -2 20 -12" stroke="#FFC93C" stroke-width="6" fill="none" stroke-linecap="round"/>`,
    stretchlines: `<path d="M36 52 l18 10M30 82 l20 -2M264 52 l-18 10M270 82 l-20 -2" stroke="#FFC93C" stroke-width="5" stroke-linecap="round"/>`,
    stararc: `<path d="M56 46 Q150 -70 244 46" stroke="#B9A9E8" stroke-width="3" fill="none" stroke-dasharray="3 9" stroke-linecap="round"/>` + star(64, 18, 18, '#FFD23F') + star(150, -30, 16, '#FF8FA8') + star(236, 18, 18, '#7FDCEB'),
    stars2: star(26, 30, 18, '#FFD23F') + star(276, 6, 16, '#FFD23F') + star(56, 220, 10, '#7FDCEB') + star(246, 216, 10, '#FF8FA8'),
    stopwatch: `<g transform="translate(246 128)"><rect x="-6" y="-46" width="12" height="10" rx="3" fill="#7C5CE6"/><circle cx="0" cy="-8" r="34" fill="#FFFFFF" stroke="#7C5CE6" stroke-width="7"/><path d="M0 -28 V-8 L14 4" stroke="#3B2421" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>`,
    sparkle: star(32, 104, 16, '#FFD23F') + star(270, 86, 12, '#7FDCEB') + star(262, 228, 10, '#FF8FA8'),
    confetti: `<rect x="20" y="40" width="12" height="20" rx="3" fill="#FF6F91" transform="rotate(20 26 50)"/><rect x="268" y="60" width="12" height="20" rx="3" fill="#4FC3F7" transform="rotate(-25 274 70)"/><circle cx="40" cy="220" r="7" fill="#FFD23F"/><circle cx="276" cy="200" r="7" fill="#7CD992"/>` + star(40, -20, 14, '#FFD23F') + star(262, -10, 14, '#FFD23F'),
    question: `<text x="252" y="60" font-size="66" font-weight="900" fill="#FFD23F" font-family="Nunito,Arial,sans-serif" stroke="${K}" stroke-width="3">?</text>`,
    bang: `<text x="258" y="60" font-size="66" font-weight="900" fill="#FFD23F" font-family="Nunito,Arial,sans-serif" stroke="${K}" stroke-width="3">!</text>`,
    zzz: `<text x="236" y="30" font-size="40" font-weight="900" fill="#9B86E8" font-family="Nunito,Arial,sans-serif">z</text><text x="262" y="0" font-size="30" font-weight="900" fill="#9B86E8" font-family="Nunito,Arial,sans-serif">z</text><text x="282" y="-24" font-size="22" font-weight="900" fill="#9B86E8" font-family="Nunito,Arial,sans-serif">z</text>`,
    drop: `<path d="M246 76 Q236 96 246 102 Q256 96 246 76Z" fill="#7FD3FF" stroke="${K}" stroke-width="2.5"/>`,
    bulb: `<g transform="translate(236 -30)"><circle cx="24" cy="24" r="22" fill="#FFE27A" stroke="${K}" stroke-width="3"/><rect x="14" y="44" width="20" height="14" rx="3" fill="#B9A9E8" stroke="${K}" stroke-width="3"/><path d="M24 12v10M16 24h16" stroke="${K}" stroke-width="3" stroke-linecap="round"/></g>`,
  };
  (o.extra || '').split(' ').forEach(k => { if (X[k]) s += X[k]; });
  return `<svg viewBox="-20 -80 340 445" xmlns="http://www.w3.org/2000/svg">${s}</svg>`;

  function star(x, y, r, c) {
    return `<path d="M${x} ${y - r} L${x + r * .29} ${y - r * .4} ${x + r * .95} ${y - r * .31} ${x + r * .47} ${y + r * .15} ${x + r * .59} ${y + r * .81} ${x} ${y + r * .5} ${x - r * .59} ${y + r * .81} ${x - r * .47} ${y + r * .15} ${x - r * .95} ${y - r * .31} ${x - r * .29} ${y - r * .4}Z" fill="${c}" stroke="#C99A1E" stroke-width="1.5" stroke-linejoin="round"/>`;
  }
}
