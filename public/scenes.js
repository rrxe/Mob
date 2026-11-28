// Inline SVG art for the Lumberjack forest (no image files). All colours come from CSS variables so the scene follows the time of day.
const PAL = {
  oak:     { trunk: '#7a4a2a', a: '#3c8c43', b: '#5aad54', c: '#2f7336' },
  pine:    { trunk: '#6b4429', a: '#2b6a42', b: '#3f8c58', c: '#225538' },
  birch:   { trunk: '#ebe6d6', a: '#8cc454', b: '#b3dc69', c: '#6faa43' },
  maple:   { trunk: '#7d4a2c', a: '#d9622b', b: '#f0933f', c: '#b84a24' },
  redwood: { trunk: '#8b4a2a', a: '#2a6a3b', b: '#3d8a50', c: '#1f5530' },
};
// A tree whose trunk base sits at (0,0) and grows upwards. Shading is done with translucent overlays so one palette works in every time of day.
const blob = (cx, cy, r, c, hi = true) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c}"/>${hi ? `<circle cx="${cx - r * .28}" cy="${cy - r * .3}" r="${r * .62}" fill="#fff" opacity=".13"/><circle cx="${cx + r * .25}" cy="${cy + r * .38}" r="${r * .55}" fill="#06210f" opacity=".14"/>` : ''}`;
const trunk = (w, h, c, flare = true) => `<path d="M${-w / 2} 0 L${-w / 2 + 2} ${-h} L${w / 2 - 2} ${-h} L${w / 2} 0 ${flare ? `q${w * .35} 2 ${w * .55} 0 L${-w / 2 - w * .55} 0 q${w * .2} 2 ${w * .55} 0` : ''}Z" fill="${c}"/><rect x="${w * .12}" y="${-h}" width="${w * .38}" height="${h}" fill="#000" opacity=".2"/><g stroke="#000" stroke-width="1" opacity=".18" stroke-linecap="round"><path d="M${-w * .2} ${-h * .1} v${-h * .22}M${w * .05} ${-h * .4} v${-h * .3}M${-w * .25} ${-h * .62} v${-h * .2}"/></g>`;
export function treeSvg(kind = 'oak') {
  const c = PAL[kind] || PAL.oak;
  if (kind === 'pine') return `${trunk(14, 46, c.trunk)}<polygon points="0,-146 -34,-86 34,-86" fill="${c.a}"/><polygon points="0,-120 -46,-56 46,-56" fill="${c.b}"/><polygon points="0,-88 -58,-20 58,-20" fill="${c.a}"/><polygon points="0,-146 -34,-86 0,-86" fill="#fff" opacity=".1"/><polygon points="0,-120 -46,-56 0,-56" fill="#fff" opacity=".1"/><polygon points="0,-88 -58,-20 0,-20" fill="#fff" opacity=".1"/><polygon points="0,-88 58,-20 20,-20" fill="#000" opacity=".12"/><path d="M-30 -80 q30 12 60 0M-40 -50 q40 14 80 0" stroke="#fff" stroke-width="2" opacity=".18" fill="none"/>`;
  if (kind === 'birch') return `${trunk(14, 86, c.trunk)}<g fill="#3d3d36"><rect x="-7" y="-64" width="8" height="3" rx="1"/><rect x="0" y="-44" width="7" height="3" rx="1"/><rect x="-7" y="-24" width="6" height="3" rx="1"/><rect x="1" y="-76" width="6" height="3" rx="1"/></g>${blob(0, -108, 36, c.a)}${blob(-22, -96, 24, c.b)}${blob(22, -118, 22, c.c)}${blob(0, -138, 20, c.b)}`;
  if (kind === 'redwood') return `${trunk(28, 126, c.trunk)}<ellipse cx="0" cy="-158" rx="28" ry="56" fill="${c.a}"/><ellipse cx="0" cy="-116" rx="40" ry="44" fill="${c.b}"/><ellipse cx="-14" cy="-140" rx="14" ry="32" fill="#fff" opacity=".12"/><ellipse cx="14" cy="-100" rx="22" ry="26" fill="#000" opacity=".12"/>`;
  return `${trunk(22, 70, c.trunk)}${blob(0, -102, 40, c.a)}${blob(-30, -80, 28, c.b)}${blob(31, -83, 28, c.c)}${blob(3, -128, 28, c.b)}${blob(-24, -112, 20, c.c, false)}<g fill="${kind === 'maple' ? '#ffd27a' : '#bff08a'}" opacity=".55"><circle cx="-20" cy="-118" r="2"/><circle cx="14" cy="-96" r="2"/><circle cx="28" cy="-120" r="1.6"/><circle cx="-34" cy="-90" r="1.6"/></g>`;
}
const backPines = [-6, 28, 62, 104, 140, 262, 298, 334, 366].map((x, i) => `<g transform="translate(${x},${216 - (i % 3) * 5}) scale(${(.34 + (i % 3) * .06).toFixed(2)})" opacity="${.62 + (i % 3) * .12}">${treeSvg(i % 2 ? 'pine' : 'oak')}</g>`).join('');
const stars = [[30, 26], [70, 48], [120, 18], [180, 40], [230, 24], [330, 34], [260, 62], [95, 76], [150, 70], [318, 74]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 3 ? 1 : 1.7}" class="star s${i % 3}"/>`).join('');
const flies = [[60, 250, 0], [120, 232, 1.4], [210, 244, 2.2], [300, 236, .7], [170, 258, 3]].map(([x, y, d]) => `<circle class="fly" cx="${x}" cy="${y}" r="2" style="animation-delay:-${d}s"/>`).join('');
const flowers = [[22, 284, '#ffd1e0'], [96, 290, '#fff1a8'], [150, 288, '#ffb9a8'], [284, 292, '#d9c3ff'], [338, 286, '#fff1a8']].map(([x, y, c]) => `<g transform="translate(${x},${y})"><path d="M0 0 v-9" stroke="#2f7a3a" stroke-width="1.6"/><circle cx="0" cy="-11" r="3.2" fill="${c}"/><circle cx="0" cy="-11" r="1.2" fill="#e9a23b"/></g>`).join('');
const fern = (x, y, f = 1) => `<g transform="translate(${x},${y}) scale(${f})" fill="#2e8a43"><path d="M0 0 q-16 -6 -24 -22 q14 4 24 22z"/><path d="M0 0 q16 -6 24 -22 q-14 4 -24 22z"/><path d="M0 0 q-3 -14 0 -30 q4 16 0 30z"/></g>`;
const mush = (x, y) => `<g transform="translate(${x},${y})"><rect x="-2" y="-6" width="4" height="7" rx="2" fill="#f1e3c8"/><path d="M-8 -5 q8 -12 16 0z" fill="#e0533d"/><circle cx="-3" cy="-8" r="1.3" fill="#fff"/><circle cx="3" cy="-7" r="1" fill="#fff"/></g>`;

function logsPile(n) {
  const k = Math.min(8, Math.floor(n / 5) + (n > 0 ? 1 : 0)); if (!k) return '';
  const pos = [[0, 0], [17, 0], [34, 0], [8, -11], [25, -11], [16, -22], [-9, 0], [42, -11]].slice(0, k);
  return `<g transform="translate(34,268)" class="log-pile"><ellipse cx="14" cy="6" rx="34" ry="5" fill="#000" opacity=".2"/>${pos.map(([x, y]) => `<g transform="translate(${x},${y})"><rect x="-11" y="-7" width="22" height="14" rx="7" fill="#9a6a3a"/><rect x="-11" y="-7" width="22" height="5" rx="3" fill="#fff" opacity=".1"/><ellipse cx="11" cy="0" rx="4" ry="7" fill="#e0b074"/><ellipse cx="11" cy="0" rx="2.6" ry="5" fill="none" stroke="#a97a45" stroke-width=".8"/><ellipse cx="11" cy="0" rx="1" ry="2" fill="#a97a45"/></g>`).join('')}</g>`;
}
function jack() {
  return `<g class="jack" transform="translate(190,268) scale(1.32)">
    <ellipse cx="0" cy="1" rx="17" ry="4" fill="#000" opacity=".22"/>
    <rect x="-9" y="-27" width="8" height="27" rx="3" fill="#3a4c78"/><rect x="1" y="-27" width="8" height="27" rx="3" fill="#2f3f65"/>
    <path d="M-11 -6 h11 v6 h-13z M0 -6 h11 l2 6 h-13z" fill="#4a3322"/><rect x="-11" y="-2" width="24" height="2" fill="#2a1d14"/>
    <g class="jack-body"><path d="M-15 -26 q0 -30 15 -30 q15 0 15 30z" fill="#c63d2c"/>
      <g stroke="#7b241c" stroke-width="1.6" opacity=".55"><path d="M-15 -46h30M-15 -36h30M-6 -56v30M6 -56v30"/></g>
      <path d="M-15 -26 q0 -30 15 -30 q15 0 15 30z" fill="#fff" opacity=".07"/><rect x="-15" y="-31" width="30" height="5" fill="#3a2a1e"/><rect x="-3.5" y="-32" width="7" height="7" rx="1.5" fill="#e8c35a"/>
      <circle cx="0" cy="-66" r="11" fill="#f2caa3"/><circle cx="-4" cy="-62" r="4" fill="#e9a58a" opacity=".5"/><path d="M-10 -63 q10 17 20 0 q-2 12 -10 13 q-8 -1 -10 -13z" fill="#7a4a2a"/>
      <circle cx="3.5" cy="-68" r="1.4" fill="#2a1d14"/><path d="M-12 -70 q12 -17 24 0z" fill="#2f7a4a"/><rect x="-12.5" y="-71.5" width="25" height="4.5" rx="2.2" fill="#256040"/><circle cx="0" cy="-84" r="3" fill="#f2f2f2"/></g>
    <g class="axe-arm"><path d="M6 -50 L25 -41" stroke="#b83829" stroke-width="9" stroke-linecap="round"/><circle cx="26" cy="-40.5" r="5" fill="#f2caa3"/>
      <path d="M26 -41 L47 -67" stroke="#8b5a2b" stroke-width="3.8" stroke-linecap="round"/><path d="M26 -41 L36 -53" stroke="#fff" stroke-width="1" opacity=".25"/>
      <path d="M43 -72 L59 -67 L52 -52 L44 -59z" fill="#b9c0c8"/><path d="M55 -68 L59 -67 L52 -52 L51 -56z" fill="#eef3f6"/><path d="M43 -72 L47 -70 L45 -62 L44 -59z" fill="#7d8791"/></g></g>`;
}
// state: { tree, active, ready, logs, felling }   (viewBox 360x300; the tree trunk sits at x=272 and is chopped by the lumberjack at x=190)
export function forestScene({ tree = 'oak', active = false, ready = false, logs = 0, felling = false, progress = 0 } = {}) {
  const cls = ['forest-svg', active ? 'is-active' : '', ready ? 'is-ready' : '', felling ? 'is-felling' : ''].filter(Boolean).join(' ');
  return `<svg class="${cls}" style="--p:${ready ? 1 : progress.toFixed(3)}" viewBox="0 0 360 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
  <defs><linearGradient id="skyG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--sky1)"/><stop offset="1" stop-color="var(--sky2)"/></linearGradient>
    <radialGradient id="sunG"><stop offset="0" stop-color="#fff6c8"/><stop offset="1" stop-color="#ffd978" stop-opacity="0"/></radialGradient>
    <linearGradient id="rayG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff7c9" stop-opacity=".55"/><stop offset="1" stop-color="#fff7c9" stop-opacity="0"/></linearGradient>
    <linearGradient id="fogG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--sky2)" stop-opacity="0"/><stop offset="1" stop-color="var(--sky2)" stop-opacity=".75"/></linearGradient></defs>
  <rect width="360" height="300" fill="url(#skyG)"/>
  <g class="stars">${stars}</g>
  <circle class="sun-glow" cx="296" cy="62" r="58" fill="url(#sunG)"/><circle class="sun" cx="296" cy="62" r="16"/>
  <g class="cloud c1"><ellipse cx="60" cy="58" rx="28" ry="9"/><ellipse cx="82" cy="51" rx="21" ry="11"/><ellipse cx="42" cy="53" rx="17" ry="8"/></g>
  <g class="cloud c2"><ellipse cx="214" cy="36" rx="22" ry="7"/><ellipse cx="230" cy="31" rx="15" ry="8"/></g>
  <path d="M0 196 Q55 140 128 184 T256 168 T360 188 V300H0Z" fill="var(--hill1)"/>
  <rect y="170" width="360" height="52" fill="url(#fogG)" class="fog"/>
  <path d="M0 214 Q80 172 164 208 T306 196 T360 208 V300H0Z" fill="var(--hill2)"/>
  <g class="back-trees">${backPines}</g>
  <g class="rays"><polygon points="250,0 282,0 190,230 120,230" fill="url(#rayG)"/><polygon points="300,0 322,0 262,230 220,230" fill="url(#rayG)"/></g>
  <path d="M0 236 Q90 222 180 234 T360 228 V300H0Z" fill="var(--ground)"/>
  <path d="M0 262 Q100 252 200 260 T360 256 V300H0Z" fill="var(--ground2)"/>
  <path d="M0 274 Q90 270 180 274 T360 272" stroke="#fff" stroke-opacity=".08" stroke-width="2" fill="none"/>
  ${logsPile(logs)}
  <g class="main-tree"><ellipse class="tree-shadow" cx="272" cy="270" rx="38" ry="6" fill="#000" opacity=".25"/>
    <g transform="translate(272,268) scale(1.28)"><g class="tree-sway">${treeSvg(tree)}</g></g>
    <g transform="translate(272,268) scale(1.28)"><path class="notch" d="M-11 -34 L-2 -30 L-11 -24z" fill="#f2d9a8"/></g></g>
  <g class="ready-halo"><circle cx="272" cy="150" r="76" fill="none" stroke="#ffe08a" stroke-width="2" stroke-dasharray="3 8"/></g>
  ${jack()}
  <g class="chips"><circle class="chip k1" cx="262" cy="210" r="2.6"/><circle class="chip k2" cx="262" cy="210" r="2"/><circle class="chip k3" cx="262" cy="210" r="2.4"/><circle class="chip k4" cx="262" cy="210" r="1.8"/></g>
  <g class="fireflies">${flies}</g>
  ${fern(16, 296, 1.1)}${fern(120, 298, .9)}${fern(332, 298, 1.2)}${mush(150, 289)}${mush(228, 293)}${flowers}
  <g class="leaf-drift"><path class="lf l1" d="M0 0 q4 -6 8 0 q-4 6 -8 0z" fill="#f0933f"/><path class="lf l2" d="M0 0 q4 -6 8 0 q-4 6 -8 0z" fill="#8cc454"/><path class="lf l3" d="M0 0 q4 -6 8 0 q-4 6 -8 0z" fill="#d9622b"/></g>
  </svg>`;
}
export const AXE_TIERS = ['rusty', 'iron', 'steel', 'gold', 'diamond'];
export const axeTier = lv => AXE_TIERS[Math.min(AXE_TIERS.length - 1, Math.floor((Math.max(1, lv) - 1) / 5))];
export const TREE_ICON = { oak: '🌳', pine: '🌲', birch: '🌿', maple: '🍁', redwood: '🌴' };
export function phase(d = new Date()) { try { const f = new URLSearchParams(location.search).get('tod'); if (f) return f; } catch {} const h = d.getHours(); return h >= 5 && h < 8 ? 'dawn' : h >= 8 && h < 17 ? 'day' : h >= 17 && h < 20 ? 'dusk' : 'night'; }
