// audio.js —— WebAudio 程序化音效（轻量、无外部素材）
// 用振荡器合成打击/受击/击杀/升级等短音效。浏览器首次点击后启动 AudioContext。

export class AudioFX {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.muted = false;   // 全局静音（M 键切换）
  }

  /** 需要在用户交互后调用一次以解锁 */
  init() {
    if (this.ctx || typeof window === 'undefined') return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { this.enabled = false; }
  }

  toggleMute() { this.muted = !this.muted; return this.muted; }

  /** 播放一个合成音 */
  play(kind) {
    if (!this.enabled || this.muted || !this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    switch (kind) {
      case 'hit':    this.tone(220, 0.07, 'square', 0.12, t); this.tone(440, 0.05, 'square', 0.06, t + 0.01); break;
      case 'crit':   this.tone(170, 0.09, 'square', 0.16, t); this.tone(940, 0.06, 'sawtooth', 0.09, t + 0.012); this.tone(1520, 0.05, 'sine', 0.06, t + 0.02); break;
      case 'kill':   this.tone(520, 0.09, 'square', 0.14, t); this.tone(760, 0.08, 'sawtooth', 0.08, t + 0.05); break;
      case 'swing':  this.tone(360, 0.05, 'triangle', 0.05, t); this.tone(210, 0.09, 'triangle', 0.06, t + 0.02); break;
      case 'telegraph': this.tone(95, 0.12, 'square', 0.07, t); this.tone(70, 0.14, 'sawtooth', 0.05, t + 0.05); break;
      case 'charge':  this.tone(60, 0.28, 'sawtooth', 0.12, t); this.tone(45, 0.3, 'square', 0.08, t + 0.06); break;
      case 'hurt':   this.tone(120, 0.15, 'sawtooth', 0.2, t); break;
      case 'levelup': this.tone(523, 0.1, 'sine', 0.16, t); this.tone(659, 0.1, 'sine', 0.16, t + 0.09); this.tone(784, 0.16, 'sine', 0.18, t + 0.18); break;
      case 'boss_phase': this.tone(146, 0.5, 'sine', 0.2, t); this.tone(220, 0.35, 'triangle', 0.12, t + 0.05); this.tone(110, 0.55, 'sawtooth', 0.08, t + 0.02); break;
      case 'boss_down': this.tone(300, 0.4, 'sawtooth', 0.22, t); this.tone(200, 0.5, 'sawtooth', 0.2, t + 0.15); break;
      default: break;
    }
  }

  tone(freq, dur, type, vol, when) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(when);
    o.stop(when + dur + 0.02);
  }
}
