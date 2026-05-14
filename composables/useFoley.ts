// Synthesizes UI sounds via the Web Audio API — no sample files needed.
// All sounds are generated procedurally so they're tiny and pitch-jitter
// freely between calls (no two clicks sound identical).

let ctx: AudioContext | null = null;
let muted = false;
let mutedHydrated = false;
const MUTE_KEY = "arena:muted";

function hydrateMuted() {
  if (mutedHydrated || typeof window === "undefined") return;
  mutedHydrated = true;
  try {
    muted = window.localStorage.getItem(MUTE_KEY) === "1";
  } catch { /* private mode etc. — leave default */ }
}

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function noiseBurst(durSec: number, decay: number) {
  const c = getCtx();
  if (!c) return null;
  const buf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * durSec)), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (c.sampleRate * decay));
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  return src;
}

export function useFoley() {
  hydrateMuted();
  /** Revolver-style wheel click. ~80ms metallic hit + a low thunk. */
  function click() {
    if (muted) return;
    const c = getCtx();
    if (!c) return;
    const now = c.currentTime;

    // metallic noise burst through bandpass
    const noise = noiseBurst(0.05, 0.012);
    if (noise) {
      const bp = c.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 2100 + Math.random() * 600;
      bp.Q.value = 5;
      const g = c.createGain();
      g.gain.setValueAtTime(0.35, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      noise.connect(bp).connect(g).connect(c.destination);
      noise.start(now);
      noise.stop(now + 0.06);
    }

    // low punch
    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(140 + Math.random() * 30, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.06);
    const og = c.createGain();
    og.gain.setValueAtTime(0.32, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(og).connect(c.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  /** Soft confirmation tone for a snap-into-place after drag ends. */
  function snap() {
    if (muted) return;
    const c = getCtx();
    if (!c) return;
    const now = c.currentTime;
    const osc = c.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(680, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.18);
    const g = c.createGain();
    g.gain.setValueAtTime(0.18, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(g).connect(c.destination);
    osc.start(now);
    osc.stop(now + 0.27);
  }

  /** Pneumatic hiss — for stage transitions, terminal lifting in. */
  function hiss(durSec = 0.55) {
    if (muted) return;
    const c = getCtx();
    if (!c) return;
    const now = c.currentTime;
    const noise = noiseBurst(durSec, durSec * 0.4);
    if (!noise) return;
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(4000, now);
    lp.frequency.exponentialRampToValueAtTime(800, now + durSec);
    const g = c.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.exponentialRampToValueAtTime(0.18, now + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, now + durSec);
    noise.connect(lp).connect(g).connect(c.destination);
    noise.start(now);
    noise.stop(now + durSec);
  }

  /** Heavy mechanical clunk — settling into place. */
  function clunk() {
    if (muted) return;
    const c = getCtx();
    if (!c) return;
    const now = c.currentTime;
    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(95, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.18);
    const g = c.createGain();
    g.gain.setValueAtTime(0.55, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(g).connect(c.destination);
    osc.start(now);
    osc.stop(now + 0.24);
    // body resonance
    const body = noiseBurst(0.06, 0.018);
    if (body) {
      const bp = c.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 320;
      bp.Q.value = 4;
      const bg = c.createGain();
      bg.gain.setValueAtTime(0.25, now);
      bg.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      body.connect(bp).connect(bg).connect(c.destination);
      body.start(now);
      body.stop(now + 0.09);
    }
  }

  /** Boot beep — interface coming online. */
  function boot() {
    if (muted) return;
    const c = getCtx();
    if (!c) return;
    const now = c.currentTime;
    const osc = c.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.linearRampToValueAtTime(880, now + 0.12);
    const g = c.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.08, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(g).connect(c.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  /** Ignite — final commit, ramp into the fight. */
  function ignite() {
    if (muted) return;
    const c = getCtx();
    if (!c) return;
    const now = c.currentTime;
    // upward sweep
    const osc = c.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.exponentialRampToValueAtTime(640, now + 0.6);
    const g = c.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.22, now + 0.1);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    osc.connect(g).connect(c.destination);
    osc.start(now);
    osc.stop(now + 0.72);
    // low rumble
    const rumble = noiseBurst(0.7, 0.28);
    if (rumble) {
      const lp = c.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 250;
      const rg = c.createGain();
      rg.gain.setValueAtTime(0.001, now);
      rg.gain.linearRampToValueAtTime(0.32, now + 0.15);
      rg.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
      rumble.connect(lp).connect(rg).connect(c.destination);
      rumble.start(now);
      rumble.stop(now + 0.72);
    }
  }

  /** Deep brass horn — opens the bout. */
  function horn() {
    if (muted) return;
    const c = getCtx();
    if (!c) return;
    const now = c.currentTime;
    // stack two slightly detuned saws for a "horn" feel
    const fundamentals = [110, 110.4];
    fundamentals.forEach((freq) => {
      const osc = c.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = freq;
      const g = c.createGain();
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.18, now + 0.18);
      g.gain.linearRampToValueAtTime(0.16, now + 0.9);
      g.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
      const lp = c.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 800;
      osc.connect(lp).connect(g).connect(c.destination);
      osc.start(now);
      osc.stop(now + 1.45);
    });
  }

  /** Single deep drum hit — for countdown beats. */
  function drum() {
    if (muted) return;
    const c = getCtx();
    if (!c) return;
    const now = c.currentTime;
    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.18);
    const g = c.createGain();
    g.gain.setValueAtTime(0.65, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    osc.connect(g).connect(c.destination);
    osc.start(now);
    osc.stop(now + 0.34);
    // crack on top
    const noise = noiseBurst(0.04, 0.01);
    if (noise) {
      const bp = c.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 1800;
      bp.Q.value = 2;
      const ng = c.createGain();
      ng.gain.setValueAtTime(0.18, now);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      noise.connect(bp).connect(ng).connect(c.destination);
      noise.start(now);
      noise.stop(now + 0.05);
    }
  }

  /** Bright metallic bell — round start. */
  function bell() {
    if (muted) return;
    const c = getCtx();
    if (!c) return;
    const now = c.currentTime;
    // partials for a bell-like inharmonic timbre
    const partials: Array<[number, number, number]> = [
      [880, 0.30, 1.6],
      [1320, 0.20, 1.2],
      [1760, 0.14, 0.9],
      [2640, 0.08, 0.6],
    ];
    partials.forEach(([freq, gain, dur]) => {
      const osc = c.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      const g = c.createGain();
      g.gain.setValueAtTime(gain, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + dur);
      osc.connect(g).connect(c.destination);
      osc.start(now);
      osc.stop(now + dur + 0.05);
    });
  }

  /** Tick during a hold-to-confirm — short and high. */
  function tick() {
    if (muted) return;
    const c = getCtx();
    if (!c) return;
    const now = c.currentTime;
    const osc = c.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(1200, now);
    const g = c.createGain();
    g.gain.setValueAtTime(0.06, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    osc.connect(g).connect(c.destination);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  function setMuted(v: boolean) {
    muted = v;
    if (typeof window !== "undefined") {
      try { window.localStorage.setItem(MUTE_KEY, v ? "1" : "0"); } catch {}
    }
  }
  function isMuted() { hydrateMuted(); return muted; }

  return { click, snap, hiss, clunk, boot, ignite, tick, horn, drum, bell, setMuted, isMuted };
}
