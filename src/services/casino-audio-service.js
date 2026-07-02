const AudioContextClass = window.AudioContext || window.webkitAudioContext;
const STORAGE_VOLUME = "rip.casino.volume";
const STORAGE_SFX = "rip.casino.sfx";
const MUSIC_TEMPO = 112;
const MUSIC_STEP_SECONDS = 60 / MUSIC_TEMPO / 4;

class CasinoAudio {
  constructor() {
    this.context = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.compressor = null;
    this.noiseBuffer = null;
    this.musicTimer = null;
    this.musicEnabled = false;
    this.sfxEnabled = window.localStorage.getItem(STORAGE_SFX) !== "off";
    this.volume = this.readVolume();
    this.musicStep = 0;
    this.nextMusicTime = 0;
  }

  readVolume() {
    const rawValue = window.localStorage.getItem(STORAGE_VOLUME);
    if (rawValue === null) return 0.78;
    const stored = Number(rawValue);
    return Number.isFinite(stored) && stored >= 0 && stored <= 1 ? stored : 0.78;
  }

  buildMixer() {
    this.masterGain = this.context.createGain();
    this.sfxGain = this.context.createGain();
    this.musicGain = this.context.createGain();
    this.compressor = this.context.createDynamicsCompressor();

    this.masterGain.gain.value = this.volume;
    this.sfxGain.gain.value = 0.95;
    this.musicGain.gain.value = 0.38;
    this.compressor.threshold.value = -20;
    this.compressor.knee.value = 18;
    this.compressor.ratio.value = 7;
    this.compressor.attack.value = 0.004;
    this.compressor.release.value = 0.22;

    this.sfxGain.connect(this.compressor);
    this.musicGain.connect(this.compressor);
    this.compressor.connect(this.masterGain);
    this.masterGain.connect(this.context.destination);
  }

  buildNoiseBuffer() {
    const frameCount = this.context.sampleRate;
    this.noiseBuffer = this.context.createBuffer(1, frameCount, this.context.sampleRate);
    const channel = this.noiseBuffer.getChannelData(0);
    for (let index = 0; index < frameCount; index += 1) {
      channel[index] = Math.random() * 2 - 1;
    }
  }

  async ready() {
    if (!AudioContextClass) return false;
    if (!this.context) {
      this.context = new AudioContextClass();
      this.buildMixer();
      this.buildNoiseBuffer();
    }
    if (this.context.state === "suspended") await this.context.resume();
    return true;
  }

  bus(name) {
    return name === "music" ? this.musicGain : this.sfxGain;
  }

  tone(frequency, duration = 0.12, options = {}) {
    if (!this.context) return;
    const {
      type = "square",
      volume = 0.13,
      delay = 0,
      bus = "sfx",
      endFrequency = frequency,
      detune = 0
    } = options;
    const start = this.context.currentTime + Math.max(0, delay);
    const end = start + Math.max(0.025, duration);
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(20, frequency), start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), end);
    oscillator.detune.value = detune;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + 0.008);
    gain.gain.setValueAtTime(Math.max(0.0002, volume * 0.72), Math.max(start + 0.01, end - 0.035));
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    oscillator.connect(gain).connect(this.bus(bus));
    oscillator.start(start);
    oscillator.stop(end + 0.02);
  }

  noise(duration = 0.08, options = {}) {
    if (!this.context || !this.noiseBuffer) return;
    const { volume = 0.1, delay = 0, frequency = 2800, bus = "sfx" } = options;
    const start = this.context.currentTime + Math.max(0, delay);
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = this.noiseBuffer;
    filter.type = "highpass";
    filter.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter).connect(gain).connect(this.bus(bus));
    source.start(start);
    source.stop(start + duration + 0.01);
  }

  kick(delay = 0, bus = "music", volume = 0.24) {
    this.tone(130, 0.16, { type: "sine", volume, delay, bus, endFrequency: 44 });
  }

  playPattern(notes) {
    notes.forEach(([frequency, delay, duration = 0.1, type = "square", volume = 0.13, endFrequency = frequency]) => {
      this.tone(frequency, duration, { delay, type, volume, endFrequency });
    });
  }

  async play(name) {
    if (!this.sfxEnabled || !(await this.ready())) return;

    if (name === "click" || name === "bet") {
      this.playPattern([[420, 0, 0.055, "square", 0.12], [720, 0.045, 0.045, "square", 0.08]]);
      this.noise(0.025, { volume: 0.06, frequency: 4200 });
      return;
    }
    if (name === "card" || name === "poker") {
      this.noise(0.12, { volume: 0.18, frequency: 1800 });
      this.playPattern([[240, 0, 0.08, "triangle", 0.1, 145], [390, 0.07, 0.06, "square", 0.07]]);
      return;
    }
    if (name === "roulette" || name === "wheel" || name === "spin") {
      this.tone(130, 0.58, { type: "sawtooth", volume: 0.12, endFrequency: 680 });
      for (let index = 0; index < 7; index += 1) {
        this.tone(520 + index * 34, 0.035, { type: "square", volume: 0.075, delay: index * 0.075 });
      }
      return;
    }
    if (name === "slots") {
      [0, 0.12, 0.24, 0.36, 0.5, 0.66, 0.84].forEach((delay, index) => {
        this.noise(0.055, { delay, volume: 0.1, frequency: 3600 });
        this.tone(230 + (index % 3) * 95, 0.09, { delay, type: "square", volume: 0.13 });
      });
      return;
    }
    if (name === "dice") {
      for (let index = 0; index < 5; index += 1) {
        this.noise(0.045, { delay: index * 0.055, volume: 0.13, frequency: 900 + index * 300 });
        this.tone(120 + index * 28, 0.04, { delay: index * 0.055, type: "triangle", volume: 0.08 });
      }
      return;
    }
    if (name === "coin") {
      this.tone(260, 0.52, { type: "triangle", volume: 0.13, endFrequency: 1050 });
      this.tone(1040, 0.18, { delay: 0.42, type: "sine", volume: 0.12, endFrequency: 620 });
      return;
    }
    if (name === "mines") {
      this.playPattern([[165, 0, 0.1, "square", 0.13], [220, 0.11, 0.1, "square", 0.13], [330, 0.22, 0.16, "triangle", 0.14]]);
      return;
    }
    if (name === "baccarat") {
      this.noise(0.09, { volume: 0.12, frequency: 2200 });
      this.playPattern([[294, 0, 0.09, "triangle", 0.12], [440, 0.09, 0.12, "triangle", 0.13]]);
      return;
    }
    if (name === "boost") {
      this.playPattern([[330, 0, 0.09, "square", 0.15], [494, 0.08, 0.1, "square", 0.15], [740, 0.17, 0.24, "triangle", 0.18]]);
      this.noise(0.16, { delay: 0.16, volume: 0.09, frequency: 5000 });
      return;
    }
    if (name === "win") {
      this.playPattern([[392, 0, 0.13, "square", 0.16], [523, 0.1, 0.14, "square", 0.17], [659, 0.2, 0.16, "square", 0.18], [784, 0.31, 0.32, "triangle", 0.2]]);
      this.noise(0.22, { delay: 0.3, volume: 0.12, frequency: 5200 });
      return;
    }
    if (name === "lose") {
      this.playPattern([[246, 0, 0.17, "sawtooth", 0.13, 205], [185, 0.15, 0.28, "sawtooth", 0.14, 110]]);
      return;
    }

    this.playPattern([[420, 0, 0.06, "square", 0.11]]);
  }

  setSfx(enabled) {
    this.sfxEnabled = Boolean(enabled);
    window.localStorage.setItem(STORAGE_SFX, this.sfxEnabled ? "on" : "off");
    return this.sfxEnabled;
  }

  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, Number(value) || 0));
    window.localStorage.setItem(STORAGE_VOLUME, String(this.volume));
    if (this.masterGain && this.context) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.context.currentTime, 0.025);
    }
    return this.volume;
  }

  scheduleMusicStep(step, time) {
    const bass = [55, 55, 65.41, 55, 73.42, 65.41, 49, 55];
    const lead = [440, 523.25, 659.25, 523.25, 392, 493.88, 587.33, 493.88, 440, 523.25, 698.46, 659.25, 392, 493.88, 587.33, 784];
    const beat = step % 32;
    const relative = Math.max(0, time - this.context.currentTime);

    if (beat % 4 === 0) {
      const bassNote = bass[Math.floor(beat / 4) % bass.length];
      this.tone(bassNote, MUSIC_STEP_SECONDS * 3.3, { delay: relative, type: "triangle", volume: 0.2, bus: "music" });
    }
    if (beat % 2 === 0) {
      const leadNote = lead[Math.floor(beat / 2) % lead.length];
      this.tone(leadNote, MUSIC_STEP_SECONDS * 1.35, { delay: relative, type: beat % 8 === 6 ? "triangle" : "square", volume: 0.075, bus: "music" });
    }
    if ([0, 8, 16, 24].includes(beat)) this.kick(relative);
    if ([8, 24].includes(beat)) this.noise(0.11, { delay: relative, volume: 0.12, frequency: 1400, bus: "music" });
    if (beat % 2 === 0) this.noise(0.025, { delay: relative, volume: 0.045, frequency: 6200, bus: "music" });
  }

  runMusicScheduler() {
    while (this.nextMusicTime < this.context.currentTime + 0.12) {
      this.scheduleMusicStep(this.musicStep, this.nextMusicTime);
      this.nextMusicTime += MUSIC_STEP_SECONDS;
      this.musicStep = (this.musicStep + 1) % 32;
    }
  }

  async setMusic(enabled) {
    const requested = Boolean(enabled);
    if (!requested) {
      this.musicEnabled = false;
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
      if (this.musicGain && this.context) {
        this.musicGain.gain.setTargetAtTime(0.0001, this.context.currentTime, 0.04);
      }
      return false;
    }
    if (!(await this.ready())) return false;
    this.musicEnabled = true;
    this.musicStep = 0;
    this.nextMusicTime = this.context.currentTime + 0.04;
    this.musicGain.gain.cancelScheduledValues(this.context.currentTime);
    this.musicGain.gain.setValueAtTime(0.0001, this.context.currentTime);
    this.musicGain.gain.exponentialRampToValueAtTime(0.38, this.context.currentTime + 0.35);
    this.runMusicScheduler();
    window.clearInterval(this.musicTimer);
    this.musicTimer = window.setInterval(() => this.runMusicScheduler(), 30);
    return true;
  }
}

export const casinoAudio = new CasinoAudio();
