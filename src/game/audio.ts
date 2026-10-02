// ---------------------------------------------------------------------------
// Tiny procedural audio engine: wind, carve hiss, chimes, thumps.
// Everything is synthesized - no assets, no loading.
// ---------------------------------------------------------------------------

const PENTA = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24];

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private windGain!: GainNode;
  private windFilter!: BiquadFilterNode;
  private hissGain!: GainNode;
  private hissFilter!: BiquadFilterNode;
  private padGain!: GainNode;
  private delay!: DelayNode;
  private boostGain!: GainNode;
  private boostOsc!: OscillatorNode;
  private noiseBuf: AudioBuffer | null = null;
  private roarGain!: GainNode;
  private roarFilter!: BiquadFilterNode;
  private babbleGain!: GainNode;

  /** waterfall proximity 0..1, river under the rider 0..1 */
  setWater(roar: number, babble: number) {
    if (!this.ready) return;
    const t = this.now();
    this.roarGain.gain.setTargetAtTime(Math.min(0.32, roar * 0.32), t, 0.25);
    this.roarFilter.frequency.setTargetAtTime(420 + roar * 900, t, 0.3);
    this.babbleGain.gain.setTargetAtTime(Math.min(0.09, babble * 0.09), t, 0.2);
  }

  /** splash when hitting the water */
  splash(strength = 1) {
    if (!this.ready || this.muted || !this.noiseBuf) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 0.9;
    f.frequency.setValueAtTime(2600, t);
    f.frequency.exponentialRampToValueAtTime(500, t + 0.35);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.22 * strength, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    g.connect(this.delay);
    src.start(t, Math.random());
    src.stop(t + 0.55);
  }
  ready = false;
  muted = false;

  init() {
    if (this.ready) return;
    try {
      const Ctor: typeof AudioContext =
        (window as unknown as { AudioContext: typeof AudioContext }).AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctor();
      this.ctx = ctx;

      this.master = ctx.createGain();
      this.master.gain.value = 0.85;
      this.master.connect(ctx.destination);

      // shimmer delay bus
      this.delay = ctx.createDelay(1);
      this.delay.delayTime.value = 0.27;
      const fb = ctx.createGain();
      fb.gain.value = 0.34;
      const wet = ctx.createGain();
      wet.gain.value = 0.5;
      this.delay.connect(fb);
      fb.connect(this.delay);
      this.delay.connect(wet);
      wet.connect(this.master);

      // noise buffer
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;

      // wind (low rumble) — LEBIUT LEMBUT: cutoff rendah + gain kecil,
      // dimodulasi LFO dua lapis (gust) supaya terasa "mengalir", bukan dengung statis
      const wind = ctx.createBufferSource();
      wind.buffer = buf;
      wind.loop = true;
      this.windFilter = ctx.createBiquadFilter();
      this.windFilter.type = 'lowpass';
      this.windFilter.frequency.value = 320;
      this.windGain = ctx.createGain();
      this.windGain.gain.value = 0;
      wind.connect(this.windFilter);
      this.windFilter.connect(this.windGain);
      this.windGain.connect(this.master);
      wind.start();
      // gust: hembusan pelan naik-turun (0.07 Hz + 0.113 Hz — tidak sinkron)
      const gust1 = ctx.createOscillator();
      gust1.type = 'sine';
      gust1.frequency.value = 0.07;
      const gust2 = ctx.createOscillator();
      gust2.type = 'sine';
      gust2.frequency.value = 0.113;
      const g1 = ctx.createGain();
      g1.gain.value = 0.011;
      const g2 = ctx.createGain();
      g2.gain.value = 0.006;
      gust1.connect(g1);
      gust2.connect(g2);
      g1.connect(this.windGain.gain);
      g2.connect(this.windGain.gain);
      gust1.start();
      gust2.start();

      // sand hiss (carve)
      const hiss = ctx.createBufferSource();
      hiss.buffer = buf;
      hiss.loop = true;
      this.hissFilter = ctx.createBiquadFilter();
      this.hissFilter.type = 'bandpass';
      this.hissFilter.frequency.value = 1600;
      this.hissFilter.Q.value = 0.8;
      this.hissGain = ctx.createGain();
      this.hissGain.gain.value = 0;
      hiss.connect(this.hissFilter);
      this.hissFilter.connect(this.hissGain);
      this.hissGain.connect(this.master);
      hiss.start();

      // dreamy pad
      this.padGain = ctx.createGain();
      this.padGain.gain.value = 0;
      const padFilter = ctx.createBiquadFilter();
      padFilter.type = 'lowpass';
      padFilter.frequency.value = 900;
      this.padGain.connect(padFilter);
      padFilter.connect(this.master);
      const freqs = [110, 164.81, 220, 329.63, 440];
      freqs.forEach((f, i) => {
        const o = ctx.createOscillator();
        o.type = i > 2 ? 'sine' : 'triangle';
        o.frequency.value = f;
        const g = ctx.createGain();
        g.gain.value = 0.12 / (i + 1);
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.05 + i * 0.021;
        const lg = ctx.createGain();
        lg.gain.value = 0.09 / (i + 1);
        lfo.connect(lg);
        lg.connect(g.gain);
        lfo.start();
        o.connect(g);
        g.connect(this.padGain);
        o.start();
      });

      // boost drone
      this.boostOsc = ctx.createOscillator();
      this.boostOsc.type = 'sawtooth';
      this.boostOsc.frequency.value = 70;
      const bf = ctx.createBiquadFilter();
      bf.type = 'lowpass';
      bf.frequency.value = 420;
      this.boostGain = ctx.createGain();
      this.boostGain.gain.value = 0;
      this.boostOsc.connect(bf);
      bf.connect(this.boostGain);
      this.boostGain.connect(this.master);
      this.boostOsc.start();

      // waterfall roar + river babble (two filtered noise layers)
      const roar = ctx.createBufferSource();
      roar.buffer = buf;
      roar.loop = true;
      roar.playbackRate.value = 0.7;
      this.roarFilter = ctx.createBiquadFilter();
      this.roarFilter.type = 'lowpass';
      this.roarFilter.frequency.value = 700;
      this.roarGain = ctx.createGain();
      this.roarGain.gain.value = 0;
      roar.connect(this.roarFilter);
      this.roarFilter.connect(this.roarGain);
      this.roarGain.connect(this.master);
      roar.start(0, 0.5);

      const bab = ctx.createBufferSource();
      bab.buffer = buf;
      bab.loop = true;
      bab.playbackRate.value = 1.3;
      const bf2 = ctx.createBiquadFilter();
      bf2.type = 'bandpass';
      bf2.frequency.value = 2400;
      bf2.Q.value = 1.6;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 5.3;
      const lg = ctx.createGain();
      lg.gain.value = 900;
      lfo.connect(lg);
      lg.connect(bf2.frequency);
      lfo.start();
      this.babbleGain = ctx.createGain();
      this.babbleGain.gain.value = 0;
      bab.connect(bf2);
      bf2.connect(this.babbleGain);
      this.babbleGain.connect(this.master);
      bab.start(0, 1.1);

      this.ready = true;
      this.setPad(true);
    } catch {
      this.ready = false;
    }
  }

  private now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }
  suspend() {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.85;
  }

  setPad(on: boolean) {
    if (!this.ready) return;
    this.padGain.gain.setTargetAtTime(on ? 0.5 : 0, this.now(), 1.6);
  }

  /** speed 0..1 */
  setSpeed(s: number, carve: number, boosting: boolean) {
    if (!this.ready) return;
    const t = this.now();
    // angin lembut: gain & cutoff diturunkan — sayup pelan, bukan deru
    this.windGain.gain.setTargetAtTime(0.02 + s * 0.15, t, 0.2);
    this.windFilter.frequency.setTargetAtTime(230 + s * 900, t, 0.25);
    this.hissGain.gain.setTargetAtTime(Math.min(0.15, carve * 0.15 + s * 0.024), t, 0.08);
    this.hissFilter.frequency.setTargetAtTime(1000 + carve * 1600 + s * 600, t, 0.12);
    this.boostGain.gain.setTargetAtTime(boosting ? 0.13 : 0, t, 0.12);
    this.boostOsc.frequency.setTargetAtTime(60 + s * 90, t, 0.2);
  }

  chime(step = 0, gain = 0.28) {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const semi = PENTA[Math.min(PENTA.length - 1, step)];
    const f = 523.25 * Math.pow(2, semi / 12);
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = f * 2.005;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    const g2 = ctx.createGain();
    g2.gain.value = 0.35;
    o.connect(g);
    o2.connect(g2);
    g2.connect(g);
    g.connect(this.master);
    g.connect(this.delay);
    o.start(t);
    o2.start(t);
    o.stop(t + 0.6);
    o2.stop(t + 0.6);
  }

  relicPass(streak = 1) {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    // Harmonious ascending major chord progression with sparkling celestial overtone
    const baseFreq = 440 * Math.pow(1.05946, Math.min(16, streak * 2));
    const chord = [baseFreq, baseFreq * 1.25, baseFreq * 1.5, baseFreq * 2.0];
    for (let i = 0; i < chord.length; i++) {
      const o = ctx.createOscillator();
      o.type = i === 3 ? 'sine' : 'triangle';
      o.frequency.setValueAtTime(chord[i], t);
      o.frequency.exponentialRampToValueAtTime(chord[i] * 1.02, t + 0.5);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.18, t + 0.01 + i * 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.65 + i * 0.05);
      o.connect(g);
      g.connect(this.delay);
      g.connect(this.master);
      o.start(t + i * 0.02);
      o.stop(t + 0.8);
    }
    this.sparkle();
  }

  relicMiss() {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    // Dissonant descending alert tone
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(110, t + 0.4);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(650, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.24, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    o.connect(f);
    f.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + 0.5);
  }

  boostIgnite() {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    this.whoosh(1.4);
    if (!this.noiseBuf) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.6;
    f.frequency.setValueAtTime(800, t);
    f.frequency.exponentialRampToValueAtTime(3200, t + 0.35);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.22, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + 0.55);
  }

  whoosh(strength = 1) {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.1;
    f.frequency.setValueAtTime(420, t);
    f.frequency.exponentialRampToValueAtTime(2600, t + 0.22);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.13 * strength, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t, Math.random());
    src.stop(t + 0.4);
  }

  thump(strength = 1) {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.22);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.4 * strength, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + 0.32);

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(1400, t);
    f.frequency.exponentialRampToValueAtTime(200, t + 0.25);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.22 * strength, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    src.connect(f);
    f.connect(ng);
    ng.connect(this.master);
    src.start(t, Math.random());
    src.stop(t + 0.35);
  }

  sparkle() {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = 880 * Math.pow(2, i * 0.26);
      const g = ctx.createGain();
      const s = t + i * 0.045;
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(0.12, s + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.4);
      o.connect(g);
      g.connect(this.delay);
      g.connect(this.master);
      o.start(s);
      o.stop(s + 0.45);
    }
  }

  /** distant, echoing whale call – slow sine glides through the delay bus */
  whaleSong() {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const base = 95 + Math.random() * 60;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.9);
    g.gain.setValueAtTime(0.09, t + 2.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 4.6);
    lp.connect(g);
    g.connect(this.master);
    g.connect(this.delay);

    const shapes: [OscillatorType, number, number][] = [
      ['sine', 1, 1],
      ['triangle', 2.01, 0.35],
    ];
    for (const [type, mulF, amp] of shapes) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(base * mulF, t);
      o.frequency.exponentialRampToValueAtTime(base * 1.9 * mulF, t + 1.4);
      o.frequency.exponentialRampToValueAtTime(base * 0.8 * mulF, t + 3.2);
      o.frequency.exponentialRampToValueAtTime(base * 1.25 * mulF, t + 4.5);
      const vib = ctx.createOscillator();
      vib.frequency.value = 4.5;
      const vg = ctx.createGain();
      vg.gain.value = base * 0.02 * mulF;
      vib.connect(vg);
      vg.connect(o.frequency);
      const og = ctx.createGain();
      og.gain.value = amp;
      o.connect(og);
      og.connect(lp);
      o.start(t);
      vib.start(t);
      o.stop(t + 4.8);
      vib.stop(t + 4.8);
    }
  }

  dispose() {
    try {
      void this.ctx?.close();
    } catch {
      /* noop */
    }
    this.ready = false;
  }
}
