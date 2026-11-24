import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PERF_CONFIG, createPerfMonitor } from '../src/game/three/perfMonitor.js';

test('perfMonitor ignores frames before ready and during the warmup grace window', () => {
  assert.deepEqual(DEFAULT_PERF_CONFIG, {
    graceMs: 2500,
    dprDropMs: 26,
    suggestFps: 28,
    minSamples: 18,
    suggestStreak: 3,
  });

  const monitor = createPerfMonitor({ minSamples: 4, graceMs: 2500 });

  // Before markReady
  for (let i = 0; i < 6; i++) {
    assert.deepEqual(
      monitor.recordFrame(50, { now: 1000 + i * 50, active: true, targetFps: 60, hidden: false, canDropDpr: true }),
      { action: 'none', medianMs: null },
    );
  }

  // Inside grace window [1000, 3500)
  monitor.markReady(1000);
  for (let i = 0; i < 6; i++) {
    assert.deepEqual(
      monitor.recordFrame(50, { now: 1200 + i * 200, active: true, targetFps: 60, hidden: false, canDropDpr: true }),
      { action: 'none', medianMs: null },
    );
  }

  // After grace window completes, minSamples (4) triggers drop-dpr
  let last;
  for (let i = 0; i < 4; i++) {
    last = monitor.recordFrame(42, { now: 3500 + i * 42, active: true, targetFps: 60, hidden: false, canDropDpr: true });
  }
  assert.deepEqual(last, { action: 'drop-dpr', medianMs: 42 });
});

test('perfMonitor ignores hidden, idle/quiz, low-targetFps, and outlier delta frames', () => {
  const monitor = createPerfMonitor({ minSamples: 4, graceMs: 100 });
  monitor.markReady(0);

  const ignoredCases = [
    { deltaMs: 50, now: 500, active: true, targetFps: 60, hidden: true, canDropDpr: true },
    { deltaMs: 50, now: 550, active: false, targetFps: 60, hidden: false, canDropDpr: true },
    { deltaMs: 50, now: 600, active: true, targetFps: 30, hidden: false, canDropDpr: true },
    { deltaMs: 50, now: 650, active: true, targetFps: 0, hidden: false, canDropDpr: true },
    { deltaMs: 0, now: 700, active: true, targetFps: 60, hidden: false, canDropDpr: true },
    { deltaMs: -12, now: 750, active: true, targetFps: 60, hidden: false, canDropDpr: true },
    { deltaMs: 250, now: 1000, active: true, targetFps: 60, hidden: false, canDropDpr: true },
    { deltaMs: 900, now: 1900, active: true, targetFps: 60, hidden: false, canDropDpr: true },
  ];

  for (const frame of ignoredCases) {
    assert.deepEqual(
      monitor.recordFrame(frame.deltaMs, frame),
      { action: 'none', medianMs: null },
    );
  }

  // Still needs full minSamples (4) valid frames after all ignored frames
  for (let i = 0; i < 3; i++) {
    assert.deepEqual(
      monitor.recordFrame(40, { now: 2000 + i * 40, active: true, targetFps: 60, hidden: false, canDropDpr: true }),
      { action: 'none', medianMs: null },
    );
  }
  assert.deepEqual(
    monitor.recordFrame(40, { now: 2120, active: true, targetFps: 60, hidden: false, canDropDpr: true }),
    { action: 'drop-dpr', medianMs: 40 },
  );
});

test('perfMonitor triggers drop-dpr before suggest-lower and fires suggest-lower at most once per cycle', () => {
  const monitor = createPerfMonitor({ minSamples: 4, graceMs: 0, suggestStreak: 3 });
  monitor.markReady(0);

  let now = 100;
  const feedBurst = (deltas, canDropDpr) => {
    let res;
    for (const d of deltas) {
      now += d;
      res = monitor.recordFrame(d, { now, active: true, targetFps: 60, hidden: false, canDropDpr });
    }
    return res;
  };

  // While DPR can still drop, slow bursts yield 'drop-dpr' and never advance slowStreak
  assert.deepEqual(feedBurst([38, 40, 42, 44], true), { action: 'drop-dpr', medianMs: 41 });
  assert.deepEqual(feedBurst([38, 40, 42, 44], true), { action: 'drop-dpr', medianMs: 41 });

  // Once DPR hits floor (canDropDpr=false), 2 slow bursts are not enough, and a fast burst resets streak
  assert.deepEqual(feedBurst([40, 40, 40, 40], false), { action: 'none', medianMs: 40 });
  assert.deepEqual(feedBurst([40, 40, 40, 40], false), { action: 'none', medianMs: 40 });
  assert.deepEqual(feedBurst([16, 17, 16, 17], false), { action: 'none', medianMs: 16.5 });

  // 3 consecutive slow bursts below suggestFps (28fps => >= 35.71ms) fire 'suggest-lower'
  assert.deepEqual(feedBurst([36, 38, 40, 42], false), { action: 'none', medianMs: 39 });
  assert.deepEqual(feedBurst([36, 38, 40, 42], false), { action: 'none', medianMs: 39 });
  assert.deepEqual(feedBurst([36, 38, 40, 42], false), { action: 'suggest-lower', medianMs: 39 });

  // Further sustained slow bursts do not fire 'suggest-lower' a second time
  for (let burst = 0; burst < 4; burst++) {
    assert.deepEqual(feedBurst([45, 45, 45, 45], false), { action: 'none', medianMs: 45 });
  }

  // reset() restarts grace requirement and allows a new suggestion after quality change
  monitor.reset();
  assert.deepEqual(feedBurst([45, 45, 45, 45], false), { action: 'none', medianMs: null });
  monitor.markReady(now);
  assert.deepEqual(feedBurst([45, 45, 45, 45], false), { action: 'none', medianMs: 45 });
  assert.deepEqual(feedBurst([45, 45, 45, 45], false), { action: 'none', medianMs: 45 });
  assert.deepEqual(feedBurst([45, 45, 45, 45], false), { action: 'suggest-lower', medianMs: 45 });
});
