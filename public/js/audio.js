// High-Fidelity Procedural Web Audio API Synthesizer (Zero external assets required)
class SoundManager {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.initialized = false;
    try {
      this.muted = localStorage.getItem('wp_sound_muted') === 'true';
    } catch (e) {}
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext({ latencyHint: 'interactive' });
        this.initialized = true;
      }
    } catch (e) {
      console.warn('AudioContext not supported', e);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    try {
      localStorage.setItem('wp_sound_muted', this.muted);
    } catch (e) {}
    return this.muted;
  }

  playTone(freq, type = 'sine', duration = 0.1, gainVal = 0.2, pitchDecay = 0) {
    if (this.muted || !this.ctx) return;
    this.resume();

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      if (pitchDecay !== 0) {
        osc.frequency.exponentialRampToValueAtTime(
          Math.max(10, freq + pitchDecay),
          this.ctx.currentTime + duration
        );
      }

      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {}
  }

  playNoise(duration = 0.15, gainVal = 0.3, filterFreq = 800) {
    if (this.muted || !this.ctx) return;
    this.resume();

    try {
      const bufferSize = Math.floor(this.ctx.sampleRate * duration);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(filterFreq, this.ctx.currentTime);
      filter.frequency.linearRampToValueAtTime(60, this.ctx.currentTime + duration);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      whiteNoise.start();
      whiteNoise.stop(this.ctx.currentTime + duration);
    } catch (e) {}
  }

  // Punchy acoustic/synth paddle hit with bass weight
  playPaddleHit(isSmash = false, combo = 1) {
    if (this.muted || !this.ctx) return;
    if (isSmash) {
      // Sub-bass impact + sonic snap
      this.playTone(280 + Math.min(combo * 15, 180), 'sawtooth', 0.28, 0.4, -200);
      this.playTone(90, 'sine', 0.35, 0.5, -45);
      this.playNoise(0.22, 0.45, 1400);
    } else {
      // Crisp neon thud with tactile pop
      const baseFreq = 240 + Math.min(combo * 18, 280);
      this.playTone(baseFreq, 'triangle', 0.12, 0.35, -70);
      this.playTone(baseFreq * 1.8, 'sine', 0.05, 0.15, 50);
      this.playNoise(0.04, 0.18, 2200);
    }
  }

  // Crisp high-tech neon wall bounce
  playWallBounce() {
    if (this.muted || !this.ctx) return;
    this.playTone(420, 'sine', 0.06, 0.22, -180);
    this.playTone(850, 'triangle', 0.03, 0.12, -400);
  }

  // Energy deflection shield sound
  playBarrierBounce() {
    if (this.muted || !this.ctx) return;
    this.playTone(680, 'sawtooth', 0.14, 0.3, -350);
    this.playTone(1100, 'sine', 0.09, 0.25, -200);
    this.playNoise(0.08, 0.2, 1800);
  }

  // EMP Electric shock
  playEMPShock() {
    if (this.muted || !this.ctx) return;
    this.playTone(880, 'sawtooth', 0.22, 0.35, -550);
    this.playTone(220, 'square', 0.18, 0.25, 100);
    this.playNoise(0.18, 0.3, 2400);
  }

  // Repair crystalline chime
  playRepairChime() {
    if (this.muted || !this.ctx) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      setTimeout(() => {
        this.playTone(f, 'sine', 0.14, 0.25, 15);
      }, i * 55);
    });
  }

  // Brick shatter with resonant tone
  playBrickHit(destroyed = false, isCore = false, combo = 1) {
    if (this.muted || !this.ctx) return;
    if (isCore) {
      this.playTone(600 + combo * 25, 'square', 0.3, 0.38, -150);
      this.playTone(120, 'sine', 0.35, 0.45, -50);
      this.playNoise(0.28, 0.4, 1600);
    } else if (destroyed) {
      const freq = 420 + Math.min(combo * 28, 500);
      this.playTone(freq, 'sawtooth', 0.16, 0.28, -180);
      this.playNoise(0.12, 0.22, 2000);
    } else {
      this.playTone(320, 'square', 0.08, 0.18, 40);
    }
  }

  // Powerup collection arpeggio
  playPowerupCollect() {
    if (this.muted || !this.ctx) return;
    const notes = [587.33, 739.99, 880.00, 1174.66];
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, 'sine', 0.16, 0.24, 25);
      }, idx * 55);
    });
  }

  // Spectacular goal explosion
  playGoalScore() {
    if (this.muted || !this.ctx) return;
    // Sub-bass detonation
    this.playTone(160, 'sine', 0.5, 0.55, -110);
    this.playNoise(0.45, 0.45, 1200);
    // Sparkling celebratory fanfare
    [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((f, i) => {
      setTimeout(() => {
        this.playTone(f, 'triangle', 0.18, 0.25, 10);
      }, 100 + i * 45);
    });
  }

  // 3-2-1 Countdown ticks
  playCountdown(count) {
    if (count > 0) {
      this.playTone(520, 'square', 0.12, 0.22, 0);
    } else {
      this.playTone(1040, 'square', 0.38, 0.32, 120);
      this.playNoise(0.15, 0.25, 2000);
    }
  }

  // Victory fanfare
  playVictory() {
    if (this.muted || !this.ctx) return;
    const notes = [
      { f: 523.25, d: 120 },
      { f: 659.25, d: 120 },
      { f: 783.99, d: 120 },
      { f: 1046.50, d: 350 },
      { f: 880.00, d: 150 },
      { f: 1046.50, d: 500 }
    ];
    let offset = 0;
    notes.forEach((n) => {
      setTimeout(() => {
        this.playTone(n.f, 'triangle', n.d / 1000, 0.35, 15);
      }, offset);
      offset += n.d;
    });
  }

  // Defeat jingle
  playDefeat() {
    if (this.muted || !this.ctx) return;
    const notes = [
      { f: 440.00, d: 180 },
      { f: 392.00, d: 180 },
      { f: 349.23, d: 180 },
      { f: 261.63, d: 600 }
    ];
    let offset = 0;
    notes.forEach((n) => {
      setTimeout(() => {
        this.playTone(n.f, 'sawtooth', n.d / 1000, 0.25, -50);
      }, offset);
      offset += n.d;
    });
  }
}

window.soundManager = new SoundManager();

