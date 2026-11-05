export const ENTRY_DURATION = 3400;
export const LIMITED_ENTRY_DURATION = 160;
const clamp = (value) => Math.max(0, Math.min(1, value));

export function dungeonEntryPose(elapsed, limited = false) {
  if (limited) return { phase: 'closed', openness: 0, offset: 143, depth: 1, walking: false, visible: false };
  const approach = clamp((elapsed - 500) / 1400);
  const depth = clamp((elapsed - 1900) / 450);
  const phase = elapsed < 500 ? 'opening' : elapsed < 1900 ? 'walking' : elapsed < 2350 ? 'entering' : elapsed < 3050 ? 'closing' : 'closed';
  return {
    phase, openness: elapsed < 500 ? clamp(elapsed / 500) : 1 - clamp((elapsed - 2350) / 700),
    offset: approach * 137 + depth * 6, depth,
    walking: elapsed >= 500 && elapsed < 2350, visible: elapsed < 2350,
  };
}

// Only this clock advances the walk and doors. Visibility pauses the sequence
// itself, so the story cannot start while the player is away.
export function playDungeonEntry(root, { signal, limited = false, onPhase, onComplete,
  document: pageDocument = globalThis.document, now = () => performance.now(),
  requestFrame = requestAnimationFrame, cancelFrame = cancelAnimationFrame } = {}) {
  if (signal?.aborted) return;
  const duration = limited ? LIMITED_ENTRY_DURATION : ENTRY_DURATION;
  const hero = root.querySelector('.entry-hero');
  const left = root.querySelector('.entry-door-left');
  const right = root.querySelector('.entry-door-right');
  const legLeft = root.querySelector('.hero-leg-left');
  const legRight = root.querySelector('.hero-leg-right');
  const arm = root.querySelector('.hero-arm');
  let elapsed = 0, previous = now(), frame, paused = pageDocument.hidden, ended = false, phase;
  function paint() {
    const pose = dungeonEntryPose(elapsed, limited);
    const stride = pose.walking ? Math.sin(elapsed / 95) : 0;
    hero?.setAttribute('transform', `translate(${pose.offset} ${Math.abs(stride) - pose.depth * 22}) translate(147 236) scale(${1 - pose.depth * .22}) translate(-147 -236)`);
    hero?.setAttribute('opacity', pose.visible ? String(1 - pose.depth) : '0');
    left?.setAttribute('transform', `translate(${-33 * pose.openness} 0)`);
    right?.setAttribute('transform', `translate(${33 * pose.openness} 0)`);
    legLeft?.setAttribute('transform', `translate(${stride * 1.4} ${Math.max(0, stride)})`);
    legRight?.setAttribute('transform', `translate(${-stride * 1.4} ${Math.max(0, -stride)})`);
    if (arm) arm.style.transform = `rotate(${stride * 13}deg)`;
    if (phase !== pose.phase) { phase = pose.phase; onPhase?.(phase); }
  }
  function cleanup() {
    cancelFrame(frame);
    pageDocument.removeEventListener('visibilitychange', visibility);
    globalThis.removeEventListener?.('pagehide', pause);
    globalThis.removeEventListener?.('pageshow', resume);
    signal?.removeEventListener('abort', cancel);
  }
  function tick() {
    if (ended || paused) return;
    const current = now();
    elapsed = Math.min(duration, elapsed + Math.min(100, Math.max(0, current - previous)));
    previous = current;
    paint();
    if (elapsed >= duration) { ended = true; cleanup(); onComplete?.(); }
    else frame = requestFrame(tick);
  }
  function pause() { if (ended || paused) return; paused = true; cancelFrame(frame); }
  function resume() { if (ended || !paused || pageDocument.hidden) return; paused = false; previous = now(); frame = requestFrame(tick); }
  function visibility() { if (pageDocument.hidden) pause(); else resume(); }
  function cancel() { if (ended) return; ended = true; cleanup(); }
  pageDocument.addEventListener('visibilitychange', visibility);
  globalThis.addEventListener?.('pagehide', pause);
  globalThis.addEventListener?.('pageshow', resume);
  signal?.addEventListener('abort', cancel, { once: true });
  paint();
  if (!paused) frame = requestFrame(tick);
  return { cancel };
}
