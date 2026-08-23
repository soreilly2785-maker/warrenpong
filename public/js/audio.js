// Procedural Web Audio API Synthesizer (No external assets required)
class SoundManager {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
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

  playNoise(duration = 0.15, gainVal = 0.3) {
    if (this.muted || !this.ctx) return;
    this.resume();

    try {
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, this.ctx.currentTime);
      filter.frequency.linearRampToValueAtTime(50, this.ctx.currentTime + duration);

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

  playPaddleHit(isSmash = false, combo = 1) {
    if (isSmash) {
      this.playTone(320 + Math.min(combo * 15, 200), 'sawtooth', 0.22, 0.35, 200);
      this.playNoise(0.2, 0.4);
    } else {
      const baseFreq = 220 + Math.min(combo * 20, 300);
      this.playTone(baseFreq, 'triangle', 0.12, 0.25, 60);
    }
  }

  playWallBounce() {
    this.playTone(180, 'sine', 0.08, 0.15, -40);
  }

  playBrickHit(destroyed = false, isCore = false, combo = 1) {
    if (isCore) {
      this.playTone(550 + combo * 20, 'square', 0.25, 0.3, 100);
      this.playNoise(0.2, 0.3);
    } else if (destroyed) {
      const freq = 400 + Math.min(combo * 25, 450);
      this.playTone(freq, 'sawtooth', 0.14, 0.22, -150);
    } else {
      this.playTone(280, 'square', 0.08, 0.15, 50);
    }
  }

  playPowerupCollect() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, 'sine', 0.15, 0.2, 30);
      }, idx * 60);
    });
  }

  playLaserShoot() {
    this.playTone(900, 'sawtooth', 0.1, 0.15, -600);
  }

  playBombExplode() {
    this.playNoise(0.5, 0.6);
    this.playTone(120, 'sine', 0.4, 0.4, -80);
  }

  playGoalScore() {
    this.playNoise(0.4, 0.4);
    this.playTone(200, 'sawtooth', 0.35, 0.3, 300);
  }

  playCountdown(count) {
    if (count > 0) {
      this.playTone(440, 'square', 0.12, 0.2, 0);
    } else {
      this.playTone(880, 'square', 0.35, 0.3, 150);
    }
  }

  playVictory() {
    if (this.muted || !this.ctx) return;
    const notes = [
      { f: 523.25, d: 150 },
      { f: 659.25, d: 150 },
      { f: 783.99, d: 150 },
      { f: 1046.50, d: 400 }
    ];
    let offset = 0;
    notes.forEach((n) => {
      setTimeout(() => {
        this.playTone(n.f, 'triangle', n.d / 1000, 0.3, 20);
      }, offset);
      offset += n.d;
    });
  }

  playDefeat() {
    if (this.muted || !this.ctx) return;
    const notes = [
      { f: 392.00, d: 200 },
      { f: 349.23, d: 200 },
      { f: 311.13, d: 200 },
      { f: 261.63, d: 500 }
    ];
    let offset = 0;
    notes.forEach((n) => {
      setTimeout(() => {
        this.playTone(n.f, 'sawtooth', n.d / 1000, 0.25, -40);
      }, offset);
      offset += n.d;
    });
  }
}

window.soundManager = new SoundManager();
