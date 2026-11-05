// Web Audio API 기반 레트로 신디사이저 사운드 엔진
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTone(freq, type = 'sine', duration = 0.15, gain = 0.1) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const amp = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      amp.gain.setValueAtTime(gain, this.ctx.currentTime);
      amp.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      osc.connect(amp);
      amp.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch {
      // AudioContext unavailable or restricted
    }
  }

  // 타격 성공 (슬래시)
  playSlash() {
    this.playTone(320, 'sawtooth', 0.12, 0.12);
    setTimeout(() => this.playTone(580, 'triangle', 0.1, 0.1), 40);
  }

  // 방어 성공
  playShield() {
    this.playTone(180, 'square', 0.1, 0.08);
    setTimeout(() => this.playTone(220, 'sine', 0.15, 0.08), 50);
  }

  // 해독검 필살기 크리티컬 컷인
  playCritical() {
    this.playTone(440, 'sawtooth', 0.1, 0.15);
    setTimeout(() => this.playTone(660, 'sawtooth', 0.12, 0.15), 60);
    setTimeout(() => this.playTone(880, 'square', 0.25, 0.2), 120);
  }

  // 오답 / 피격
  playHurt() {
    this.playTone(140, 'sawtooth', 0.2, 0.15);
    setTimeout(() => this.playTone(90, 'triangle', 0.25, 0.12), 80);
  }

  // 골드 획득
  playCoin() {
    this.playTone(987, 'sine', 0.08, 0.08);
    setTimeout(() => this.playTone(1318, 'sine', 0.15, 0.08), 70);
  }

  // 포션 사용
  playPotion() {
    this.playTone(440, 'sine', 0.1, 0.08);
    setTimeout(() => this.playTone(550, 'sine', 0.12, 0.08), 60);
    setTimeout(() => this.playTone(660, 'sine', 0.15, 0.08), 120);
  }

  // 승리 팡파레
  playVictory() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((freq, idx) => {
      setTimeout(() => this.playTone(freq, 'triangle', 0.2, 0.12), idx * 90);
    });
  }

  // 게임 오버
  playGameOver() {
    const notes = [330, 311, 293, 261];
    notes.forEach((freq, idx) => {
      setTimeout(() => this.playTone(freq, 'sawtooth', 0.25, 0.1), idx * 140);
    });
  }
}

export const sound = new SoundEngine();
