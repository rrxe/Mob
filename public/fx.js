// Small visual effects helpers. Every function is a no-op when the DOM lacks what it needs (tests / old WebViews).
const can = () => typeof document !== 'undefined' && typeof document.createElement === 'function';
export function confetti(layer, x, y, n = 30, colors = ['#c5e77d', '#edcb84', '#91c5d4', '#f08d82', '#fff3c4']) {
  if (!layer || !can() || !layer.appendChild) return;
  for (let i = 0; i < n; i++) {
    const el = document.createElement('i'); el.className = 'confetti';
    const a = Math.random() * Math.PI * 2, d = 70 + Math.random() * 150, rot = (Math.random() - .5) * 720;
    el.style.cssText = `left:${x}px;top:${y}px;background:${colors[i % colors.length]};--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d - 60}px;--rot:${rot}deg;animation-delay:${Math.random() * .12}s`;
    layer.appendChild(el); setTimeout(() => el.remove?.(), 1500);
  }
}
// emoji particles that fly from a point into a target element (e.g. the gem balance)
export function flyTo(layer, from, target, emoji, count = 6) {
  if (!layer || !can() || !layer.appendChild || !target?.getBoundingClientRect) return;
  const r = target.getBoundingClientRect(), tx = r.left + r.width / 2, ty = r.top + r.height / 2;
  for (let i = 0; i < count; i++) {
    const el = document.createElement('b'); el.className = 'fly-item'; el.textContent = emoji;
    el.style.cssText = `left:${from.x}px;top:${from.y}px`;
    layer.appendChild(el);
    if (el.animate) {
      const j = () => (Math.random() - .5) * 60;
      el.animate([{ transform: 'translate(-50%,-50%) scale(.4)', opacity: 0 }, { transform: `translate(calc(-50% + ${j()}px),calc(-50% + ${j() - 40}px)) scale(1.1)`, opacity: 1, offset: .3 }, { transform: `translate(${tx - from.x - 0}px,${ty - from.y}px) scale(.5)`, opacity: .9 }],
        { duration: 700 + i * 70, delay: i * 55, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'both' }).onfinish = () => el.remove?.();
    } else setTimeout(() => el.remove?.(), 700);
  }
}
export function countUp(el, from, to, format = v => String(Math.round(v)), ms = 650) {
  if (!el) return;
  if (typeof requestAnimationFrame !== 'function' || from === to) { el.textContent = format(to); return; }
  const t0 = performance.now(), ease = x => 1 - Math.pow(1 - x, 3);
  (function step(t) { const k = Math.min(1, (t - t0) / ms); el.textContent = format(from + (to - from) * ease(k)); if (k < 1) requestAnimationFrame(step); })(t0);
}
export function chipsBurst(layer, x, y, n = 8) {
  if (!layer || !can() || !layer.appendChild) return;
  for (let i = 0; i < n; i++) {
    const el = document.createElement('i'); el.className = 'woodchip';
    const a = -Math.PI / 2 + (Math.random() - .5) * 2.4, d = 26 + Math.random() * 46;
    el.style.cssText = `left:${x}px;top:${y}px;--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px;--rot:${(Math.random() - .5) * 540}deg`;
    layer.appendChild(el); setTimeout(() => el.remove?.(), 760);
  }
}
