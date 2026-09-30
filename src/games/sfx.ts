// Tiny synthesized sound effects for the mini-games (no audio files).
// Kept quiet so they sit under the YouTube music. Can be muted.

let ctx: AudioContext | null = null;
let muted = false;
try {
  muted = localStorage.getItem('bearden.sfx.muted') === '1';
} catch {
  /* ignore */
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.06, slide = 0) {
  if (muted) return;
  try {
    ctx ??= new AudioContext();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur);
  } catch {
    /* audio unavailable */
  }
}

const PAD_NOTES = [523.25, 659.25, 783.99, 1046.5];

export const sfx = {
  good: () => tone(880, 0.12, 'triangle', 0.05, 440),
  bad: () => tone(220, 0.25, 'square', 0.03, -120),
  zap: () => tone(1200, 0.15, 'sawtooth', 0.025, -900),
  cue: () => tone(660, 0.1, 'triangle', 0.05),
  pad: (i: number) => tone(PAD_NOTES[i % 4], 0.3, 'triangle', 0.06),
  get muted() {
    return muted;
  },
  toggle() {
    muted = !muted;
    try {
      localStorage.setItem('bearden.sfx.muted', muted ? '1' : '0');
    } catch {
      /* ignore */
    }
    return muted;
  },
};
