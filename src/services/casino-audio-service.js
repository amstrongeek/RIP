const AudioContextClass = window.AudioContext || window.webkitAudioContext;

class CasinoAudio {
  constructor() {
    this.context = null;
    this.musicTimer = null;
    this.musicEnabled = false;
    this.sfxEnabled = window.localStorage.getItem("rip.casino.sfx") !== "off";
    this.step = 0;
  }

  async ready() {
    if (!AudioContextClass) return false;
    if (!this.context) this.context = new AudioContextClass();
    if (this.context.state === "suspended") await this.context.resume();
    return true;
  }

  tone(frequency, duration = 0.1, type = "square", volume = 0.035, delay = 0) {
    if (!this.context) return;
    const start = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  async play(name) {
    if (!this.sfxEnabled || !(await this.ready())) return;
    const patterns = {
      click: [[220, 0.05, "square", 0.025, 0]],
      spin: [[180, 0.08, "sawtooth", 0.025, 0], [260, 0.08, "sawtooth", 0.02, 0.08], [360, 0.1, "sawtooth", 0.02, 0.16]],
      card: [[170, 0.06, "triangle", 0.03, 0], [120, 0.07, "triangle", 0.025, 0.07]],
      win: [[392, 0.12, "square", 0.035, 0], [523, 0.14, "square", 0.035, 0.12], [659, 0.24, "square", 0.04, 0.26]],
      lose: [[220, 0.13, "sawtooth", 0.025, 0], [165, 0.22, "sawtooth", 0.025, 0.13]],
      boost: [[330, 0.08, "square", 0.03, 0], [494, 0.08, "square", 0.03, 0.08], [740, 0.2, "triangle", 0.035, 0.16]]
    };
    (patterns[name] || patterns.click).forEach((args) => this.tone(...args));
  }

  setSfx(enabled) {
    this.sfxEnabled = Boolean(enabled);
    window.localStorage.setItem("rip.casino.sfx", this.sfxEnabled ? "on" : "off");
    return this.sfxEnabled;
  }

  async setMusic(enabled) {
    this.musicEnabled = Boolean(enabled);
    if (!this.musicEnabled) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
      return false;
    }
    if (!(await this.ready())) return false;
    const notes = [110, 146.83, 164.81, 220, 196, 164.81, 146.83, 123.47];
    const tick = () => {
      const root = notes[this.step % notes.length];
      this.tone(root, 0.42, "triangle", 0.012);
      if (this.step % 2 === 0) this.tone(root * 2, 0.16, "sine", 0.008, 0.08);
      this.step += 1;
    };
    tick();
    this.musicTimer = window.setInterval(tick, 520);
    return true;
  }
}

export const casinoAudio = new CasinoAudio();
