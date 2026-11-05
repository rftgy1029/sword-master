// No audio context is created until an answer/watch button is pressed.
export function createBattleAudio() {
  let context;
  const voices = new Set();
  function stop() {
    for (const source of voices) { try { source.stop(); } catch { /* Already ended. */ } }
    voices.clear();
  }
  return {
    unlock(enabled) {
      if (!enabled) return;
      try {
        const AudioContext = globalThis.AudioContext ?? globalThis.webkitAudioContext;
        if (!AudioContext) return;
        context ??= new AudioContext();
        if (context.state === 'suspended') context.resume().catch(() => {});
      } catch { /* Sound is optional; learning must keep working. */ }
    },
    play(kind, enabled) {
      if (!enabled || context?.state !== 'running') return;
      try {
        const time = context.currentTime;
        const gain = context.createGain();
        const duration = kind === 'finish' ? .3 : kind === 'swing' ? .13 : .18;
        gain.gain.setValueAtTime(.001, time);
        gain.gain.exponentialRampToValueAtTime(kind === 'finish' ? .13 : .075, time + .008);
        gain.gain.exponentialRampToValueAtTime(.001, time + duration);
        gain.connect(context.destination);
        let source;
        if (kind === 'swing') {
          const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
          const samples = buffer.getChannelData(0);
          for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
          source = context.createBufferSource();
          source.buffer = buffer;
          const filter = context.createBiquadFilter();
          filter.type = 'bandpass'; filter.frequency.value = 1800; filter.Q.value = .7;
          source.connect(filter); filter.connect(gain);
          source.onended = () => { voices.delete(source); source.disconnect(); filter.disconnect(); gain.disconnect(); };
        } else {
          source = context.createOscillator();
          source.type = kind === 'guard' ? 'triangle' : 'sine';
          source.frequency.setValueAtTime(kind === 'guard' ? 850 : kind === 'finish' ? 125 : 180, time);
          source.frequency.exponentialRampToValueAtTime(kind === 'guard' ? 260 : 48, time + duration);
          source.connect(gain);
          source.onended = () => { voices.delete(source); source.disconnect(); gain.disconnect(); };
        }
        voices.add(source); source.start(time); source.stop(time + duration + .01);
      } catch { /* Unsupported/blocked audio never blocks playback. */ }
    },
    stop,
    dispose() { stop(); if (context && context.state !== 'closed') context.close().catch(() => {}); context = undefined; },
  };
}
