// Green Valley sound engine — everything is synthesized with the Web Audio API (no audio files).
// One shared AudioContext, unlocked by the first tap. SFX default ON, music default OFF (both saved on the device).
const AC = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
export const audio = { sfx: store.get('gv_sound') !== '0', music: store.get('gv_music') !== '0', scene: 'farm' };
let ctx = null, master = null, musicBus = null, noiseBuf = null, musicTimer = null, step = 0;

function boot() {
  if (!AC) return null;
  if (!ctx) {
    try {
      ctx = new AC(); master = ctx.createGain(); master.gain.value = .9; master.connect(ctx.destination);
      musicBus = ctx.createGain(); musicBus.gain.value = .0001; musicBus.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * .6, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch { ctx = null; return null; }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}
export function unlock() { boot(); if (audio.music) startMusic(); }

// ---- primitives ----
function tone({ f = 440, f2 = 0, t = 0, d = .18, type = 'sine', v = .07, a = .008, bus = null }) {
  const c = boot(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain(), t0 = c.currentTime + t;
  o.type = type; o.frequency.setValueAtTime(f, t0);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + d);
  g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + a); g.gain.exponentialRampToValueAtTime(.0001, t0 + d);
  o.connect(g); g.connect(bus || master); o.start(t0); o.stop(t0 + d + .03);
}
function noise({ t = 0, d = .12, v = .08, lp = 3000, hp = 0, q = 1 }) {
  const c = boot(); if (!c) return;
  const s = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter(), t0 = c.currentTime + t;
  s.buffer = noiseBuf; f.type = hp ? 'highpass' : 'lowpass'; f.frequency.value = hp || lp; f.Q.value = q;
  g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(.0001, t0 + d);
  s.connect(f); f.connect(g); g.connect(master); s.start(t0); s.stop(t0 + d + .02);
}
const N = n => 440 * Math.pow(2, (n - 69) / 12); // MIDI -> Hz

// ---- effects ----
const FX = {
  tap:     () => tone({ f: 520, f2: 640, d: .07, type: 'triangle', v: .035 }),
  tab:     () => { tone({ f: 380, f2: 500, d: .09, type: 'triangle', v: .04 }); },
  plant:   () => { noise({ d: .09, v: .05, lp: 900 }); tone({ f: 200, f2: 330, d: .14, type: 'sine', v: .07 }); tone({ f: 520, t: .09, d: .12, v: .04 }); },
  water:   () => { for (let i = 0; i < 5; i++) noise({ t: i * .045, d: .07, v: .035, hp: 2400 + i * 300 }); tone({ f: 700, f2: 420, d: .22, v: .03, t: .05 }); },
  fert:    () => { noise({ d: .16, v: .05, lp: 1400 }); tone({ f: 300, f2: 600, d: .2, type: 'triangle', v: .05 }); },
  harvest: () => { noise({ d: .07, v: .06, hp: 1800 }); for (let i = 0; i < 4; i++) noise({ t: i * .03, d: .07, v: .02, hp: 4000 }); tone({ f: N(72), d: .12, type: 'triangle', v: .08, t: .02 }); tone({ f: N(79), d: .2, type: 'triangle', v: .07, t: .1 }); },
  sell:    () => { [0, .07, .14].forEach((t, i) => tone({ f: N(84 + i * 3), d: .13, type: 'square', v: .028, t })); noise({ t: .2, d: .1, v: .03, hp: 5000 }); },
  coin:    () => { tone({ f: N(88), d: .09, type: 'square', v: .03 }); tone({ f: N(95), d: .22, type: 'square', v: .03, t: .07 }); },
  reward:  () => { [72, 76, 79, 84].forEach((n, i) => tone({ f: N(n), d: .24, type: 'sine', v: .07, t: i * .08 })); noise({ t: .3, d: .25, v: .02, hp: 6000 }); },
  gem:     () => { [86, 91, 95].forEach((n, i) => tone({ f: N(n), d: .3, type: 'sine', v: .06, t: i * .07 })); tone({ f: N(98), d: .5, type: 'triangle', v: .035, t: .22 }); },
  level:   () => { [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => { tone({ f: N(n), d: .34, type: 'triangle', v: .07, t: i * .09 }); tone({ f: N(n - 12), d: .4, type: 'sine', v: .05, t: i * .09 }); }); },
  upgrade: () => { tone({ f: 140, f2: 90, d: .25, type: 'sawtooth', v: .05 }); [67, 72, 76].forEach((n, i) => tone({ f: N(n), d: .2, type: 'triangle', v: .06, t: .1 + i * .08 })); },
  chop:    () => { noise({ d: .045, v: .22, hp: 1500, q: 2 }); tone({ f: 190, f2: 62, d: .16, type: 'sine', v: .26 }); tone({ f: 420, f2: 210, d: .09, type: 'triangle', v: .09 }); noise({ t: .03, d: .22, v: .06, lp: 520 }); tone({ f: 1100, f2: 600, d: .03, type: 'square', v: .012 }); },
  rustle:  () => { for (let i = 0; i < 5; i++) noise({ t: i * .035, d: .08, v: .028, hp: 3600 + i * 400 }); },
  woodpecker: () => { for (let i = 0; i < 7; i++) { noise({ t: i * .055, d: .03, v: .05, hp: 1900, q: 3 }); tone({ f: 900, f2: 700, t: i * .055, d: .025, type: 'square', v: .008 }); } },
  cricket: () => { for (let i = 0; i < 3; i++) { tone({ f: 4300, t: i * .09, d: .05, type: 'sine', v: .012 }); tone({ f: 4500, t: i * .09 + .045, d: .04, type: 'sine', v: .01 }); } },
  songbird: () => { const b = 2000 + Math.random() * 1200, seq = [1, 1.18, 1.05, 1.32, 1.12, .96]; seq.forEach((m, i) => tone({ f: b * m, f2: b * m * (i % 2 ? .9 : 1.15), t: i * .09, d: .08, v: .014 })); },
  chopSoft:() => { noise({ d: .05, v: .07, lp: 2200 }); tone({ f: 150, f2: 65, d: .12, type: 'sine', v: .09 }); },
  fall:    () => { tone({ f: 190, f2: 60, d: .75, type: 'sawtooth', v: .04 }); for (let i = 0; i < 6; i++) noise({ t: .05 + i * .09, d: .1, v: .03, lp: 1800 }); noise({ t: .78, d: .35, v: .2, lp: 500 }); tone({ f: 80, f2: 38, t: .78, d: .4, v: .22 }); },
  start:   () => { tone({ f: N(60), d: .16, type: 'triangle', v: .06 }); tone({ f: N(67), d: .2, type: 'triangle', v: .06, t: .1 }); noise({ t: .2, d: .08, v: .08, lp: 2400 }); },
  error:   () => { tone({ f: 190, f2: 130, d: .2, type: 'square', v: .04 }); tone({ f: 150, f2: 100, d: .22, type: 'square', v: .04, t: .1 }); },
  bird:    () => { const b = 2400 + Math.random() * 900; tone({ f: b, f2: b * 1.25, d: .09, v: .015 }); tone({ f: b * 1.1, f2: b * .9, d: .1, v: .015, t: .11 }); },
  ad:      () => { tone({ f: N(79), d: .12, v: .05, type: 'triangle' }); tone({ f: N(86), d: .2, v: .05, type: 'triangle', t: .1 }); },
};
export function play(kind = 'tap') {
  if (!audio.sfx) return;
  try { (FX[kind] || FX.tap)(); } catch {}
}

// ---- ambient music: a slow pentatonic loop with soft plucks, low pad and the occasional bird ----
const SCALE = [0, 2, 4, 7, 9]; // C major pentatonic
const PROG = [48, 53, 45, 55];   // C F A G roots (low pad)
function tick() {
  if (!audio.music || !ctx) return;
  const bar = Math.floor(step / 8) % PROG.length, i = step % 8;
  if (i === 0) { const r = PROG[bar]; [0, 7, 12].forEach(iv => tone({ f: N(r + iv), d: 3.2, type: 'sine', v: .05, a: .5, bus: musicBus })); }
  if (Math.random() < .62) { const n = 72 + SCALE[Math.floor(Math.random() * 5)] + (Math.random() < .25 ? 12 : 0); tone({ f: N(n), d: 1.1, type: 'triangle', v: .035, a: .01, bus: musicBus }); }
  const forest = audio.scene === 'forest', dark = night();
  if (!dark && Math.random() < (forest ? .16 : .06)) (Math.random() < .5 ? FX.songbird : FX.bird)();
  if (dark && Math.random() < (forest ? .22 : .12)) FX.cricket();
  if (forest && !dark && Math.random() < .035) FX.woodpecker();
  step++;
}
// ---- forest / farm ambience: looping wind + birds, crickets after dark, woodpecker in the forest ----
let wind = null;
function startWind() {
  const c = boot(); if (!c || wind) return;
  const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
  src.buffer = noiseBuf; src.loop = true; f.type = 'bandpass'; f.frequency.value = 520; f.Q.value = .5;
  g.gain.value = .0001; lfo.frequency.value = .13; lg.gain.value = .02; lfo.connect(lg); lg.connect(g.gain);
  src.connect(f); f.connect(g); g.connect(musicBus); src.start(); lfo.start();
  wind = { src, g, lfo };
  setScene(audio.scene);
}
function stopWind() { try { wind?.src.stop(); wind?.lfo.stop(); } catch {} wind = null; }
export function setScene(name) {
  audio.scene = name === 'forest' ? 'forest' : 'farm';
  if (wind && ctx) wind.g.gain.linearRampToValueAtTime(audio.scene === 'forest' ? .075 : .04, ctx.currentTime + 1.2);
}
const night = () => { const h = new Date().getHours(); return h < 5 || h >= 20; };
export function startMusic() {
  if (!boot()) return;
  audio.music = true; store.set('gv_music', '1');
  musicBus.gain.cancelScheduledValues(ctx.currentTime); musicBus.gain.linearRampToValueAtTime(.55, ctx.currentTime + 1.4);
  if (!musicTimer) musicTimer = setInterval(tick, 520);
  startWind();
}
export function stopMusic() {
  audio.music = false; store.set('gv_music', '0');
  if (ctx && musicBus) { musicBus.gain.cancelScheduledValues(ctx.currentTime); musicBus.gain.linearRampToValueAtTime(.0001, ctx.currentTime + .5); }
  if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  setTimeout(stopWind, 600);
}
export function setSfx(on) { audio.sfx = !!on; store.set('gv_sound', on ? '1' : '0'); if (on) play('reward'); }
// pause the loop while the Mini App is hidden
if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('visibilitychange', () => { if (!ctx) return; if (document.visibilityState === 'hidden') ctx.suspend?.().catch?.(() => {}); else if (audio.sfx || audio.music) ctx.resume?.().catch?.(() => {}); });
}
