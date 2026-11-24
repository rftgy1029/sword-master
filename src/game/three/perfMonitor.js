// @ts-check

export const DEFAULT_PERF_CONFIG = Object.freeze({
  graceMs: 2500,
  dprDropMs: 26,
  suggestFps: 28,
  minSamples: 18,
  suggestStreak: 3,
});

/**
 * Create a lightweight adaptive frame-time monitor for active 60fps 3D combat.
 * Ignores initial shader warmup grace, hidden/idle/quiz frames, and tab-switch outliers.
 * @param {Partial<typeof DEFAULT_PERF_CONFIG>} [options]
 */
export function createPerfMonitor(options = {}) {
  const config = { ...DEFAULT_PERF_CONFIG, ...options };
  const suggestMs = 1000 / config.suggestFps;

  /** @type {number | null} */
  let readyAt = null;
  /** @type {number[]} */
  let samples = [];
  let slowStreak = 0;
  let suggested = false;

  /**
   * Mark the active scene as ready to start the warmup grace window.
   * @param {number} [now]
   */
  function markReady(now = globalThis.performance?.now?.() ?? Date.now()) {
    readyAt = Number.isFinite(now) ? now : (globalThis.performance?.now?.() ?? Date.now());
  }

  function reset() {
    readyAt = null;
    samples = [];
    slowStreak = 0;
    suggested = false;
  }

  /**
   * Record one rendered frame delta in milliseconds and recommend any corrective step.
   * @param {number} deltaMs
   * @param {{ now?: number, active?: boolean, targetFps?: number, hidden?: boolean, canDropDpr?: boolean }} [state]
   * @returns {{ action: 'none' | 'drop-dpr' | 'suggest-lower', medianMs: number | null }}
   */
  function recordFrame(deltaMs, {
    now = globalThis.performance?.now?.() ?? Date.now(),
    active = false,
    targetFps = 0,
    hidden = false,
    canDropDpr = false,
  } = {}) {
    if (
      readyAt === null
      || hidden
      || !active
      || !Number.isFinite(targetFps)
      || targetFps < 45
      || !Number.isFinite(now)
      || now - readyAt < config.graceMs
      || !(deltaMs > 0 && deltaMs < 250)
    ) {
      return { action: 'none', medianMs: null };
    }

    samples.push(deltaMs);
    if (samples.length < config.minSamples) {
      return { action: 'none', medianMs: null };
    }

    const sorted = samples.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const medianMs = sorted.length % 2 === 1
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
    samples = [];

    if (canDropDpr && medianMs >= config.dprDropMs) {
      slowStreak = 0;
      return { action: 'drop-dpr', medianMs };
    }

    if (!suggested && medianMs >= suggestMs) {
      slowStreak += 1;
      if (slowStreak >= config.suggestStreak) {
        suggested = true;
        return { action: 'suggest-lower', medianMs };
      }
      return { action: 'none', medianMs };
    }

    slowStreak = 0;
    return { action: 'none', medianMs };
  }

  return { markReady, reset, recordFrame };
}
