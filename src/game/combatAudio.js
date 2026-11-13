import { crossed } from './three/playback.js';

const NOTES = {
  strike: [330, 140], heavy: [125, 49], twin: [466, 196], flare: [560, 190], nova: [210, 48],
  guard: [264, 330, 396], heal: [392, 523, 659], empower: [165, 247, 370],
  weaken: [294, 196, 130], focus: [440, 659, 880], flow: [349, 523, 784], oath: [196, 294, 392, 587],
};
const MAX_VOICES = 16;

export function createCombatAudio() {
  let context, master, noise;
  let enabled = false;
  const voices = new Set();

  function configure(sound, volume) {
    enabled = sound && volume > 0;
    if (!master || context.state === 'closed') return;
    master.gain.setTargetAtTime(enabled ? volume * .01 * .54 : 0, context.currentTime, .018);
  }

  function unlock() {
    if (!enabled) return;
    const Audio = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!Audio) return;
    try {
      if (!context || context.state === 'closed') {
        context = new Audio();
        master = context.createGain();
        const limiter = context.createDynamicsCompressor();
        master.gain.value = 0;
        master.connect(limiter);
        limiter.connect(context.destination);
        noise = context.createBuffer(1, Math.ceil(context.sampleRate * .7), context.sampleRate);
        const samples = noise.getChannelData(0);
        for (let index = 0; index < samples.length; index++) samples[index] = Math.random() * 2 - 1;
      }
      if (context.state !== 'running') context.resume().catch(() => {});
    } catch {
      // Unsupported or restricted audio must never hold up combat.
    }
  }

  function play({ frequency, end = frequency, length, level, waveform = 'sine', delay = 0, texture }) {
    if (!enabled || context?.state !== 'running' || voices.size >= MAX_VOICES) return;
    const start = context.currentTime + delay;
    const gain = context.createGain();
    const source = texture ? context.createBufferSource() : context.createOscillator();
    let filter;
    if (texture) {
      source.buffer = noise;
      filter = context.createBiquadFilter();
      filter.type = texture;
      filter.frequency.setValueAtTime(frequency, start);
      filter.frequency.exponentialRampToValueAtTime(end, start + length);
      source.connect(filter);
      filter.connect(gain);
    } else {
      source.type = waveform;
      source.frequency.setValueAtTime(frequency, start);
      source.frequency.exponentialRampToValueAtTime(end, start + length);
      source.connect(gain);
    }
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(level, start + .014);
    gain.gain.exponentialRampToValueAtTime(.0001, start + length);
    gain.connect(master);
    voices.add(source);
    source.onended = () => {
      source.disconnect();
      filter?.disconnect();
      gain.disconnect();
      voices.delete(source);
    };
    source.start(start);
    source.stop(start + length);
  }

  return {
    configure,
    unlock,
    start({ plan, mode }) {
      if (mode !== 'full') return;
      const root = NOTES[plan.cardType]?.[0] ?? (plan.heavy ? 104 : 168);
      if (plan.kind === 'miss') play({ frequency: 480, end: 180, length: .22, level: .13, texture: 'bandpass' });
      else play({ frequency: root * .6, end: root, length: plan.heavy || plan.cardType === 'nova' ? .46 : .21, level: .11, waveform: 'triangle' });
    },
    frame(current) {
      if (current.mode !== 'full') return;
      const { plan } = current;
      const launch = plan.recipe?.marks.launch;
      if (launch !== undefined && crossed(current, launch)) {
        play({ frequency: plan.cardType === 'nova' ? 140 : 1500, end: plan.cardType === 'nova' ? 520 : 630,
          length: .24, level: .18, texture: 'bandpass' });
      }
      for (const [start, , index] of plan.recipe?.swings ?? []) {
        if (crossed(current, start)) play({ frequency: 2100 + index * 900, end: 480, length: .17, level: .23, texture: 'bandpass' });
      }
    },
    impact(hit, current) {
      if (current.mode === 'instant') return;
      const base = hit.blocked ? 530 : (NOTES[current.plan.cardType]?.[1] ?? 135);
      play({ frequency: base * (1 + hit.index * .15), end: base * .47, length: hit.heavy ? .32 : .17, level: hit.heavy ? .32 : .23,
        waveform: hit.blocked ? 'triangle' : 'sine' });
      play({ frequency: hit.blocked ? 2700 : 1200, end: hit.blocked ? 960 : 260, length: hit.heavy ? .21 : .11,
        level: .22, texture: 'bandpass' });
      if (hit.lethal) play({ frequency: 78, end: 34, length: .55, level: .24, delay: .05 });
    },
    moment({ plan, mode }) {
      if (mode === 'instant') return;
      const notes = NOTES[plan.cardType] ?? ({ block: NOTES.guard, buff: NOTES.empower, charge: [104, 208], wait: [150] })[plan.action];
      notes?.forEach((frequency, index) => play({
        frequency, length: .34, level: .18, delay: index * .065,
        waveform: ['guard', 'empower', 'oath'].includes(plan.cardType) ? 'triangle' : 'sine',
      }));
    },
    dispose() {
      for (const source of voices) {
        try { source.stop(); } catch { /* The voice may have ended this frame. */ }
      }
      voices.clear();
      context?.close().catch(() => {});
      context = master = noise = undefined;
    },
  };
}
