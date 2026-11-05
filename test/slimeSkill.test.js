import test from 'node:test';
import assert from 'node:assert/strict';
import { playSlimeSkill } from '../src/slimeSkill.js';
import { createBattleAudio } from '../src/battleAudio.js';

function playback(options = {}) {
  let time = 0, nextId = 0, completions = 0;
  const frames = new Map(), sounds = [];
  const label = { textContent: '' };
  const root = { dataset: {}, querySelector: () => label, querySelectorAll: () => [] };
  const player = playSlimeSkill(root, {
    type: 'decode', soundEnabled: true, audio: { play: (kind) => sounds.push(kind), stop() {} },
    now: () => time, requestFrame: (fn) => { frames.set(++nextId, fn); return nextId; }, cancelFrame: (id) => frames.delete(id),
    onComplete: () => completions++, ...options,
  });
  return { player, sounds, label, get completions() { return completions; }, advance(ms) {
    time += ms; const pending = [...frames.values()]; frames.clear(); pending.forEach((fn) => fn());
  } };
}

test('paused skills preserve elapsed time and do not emit hit sounds while hidden', () => {
  const run = playback();
  run.advance(300);
  assert.deepEqual(run.sounds, ['swing']);
  run.player.pause(); run.advance(5000);
  assert.equal(run.completions, 0);
  assert.deepEqual(run.sounds, ['swing']);
  run.player.resume(); run.advance(200);
  assert.deepEqual(run.sounds, ['swing', 'hit']);
  run.advance(700); run.advance(5000);
  assert.equal(run.completions, 1);
});

test('skipping cancels all future sounds and completion callbacks', () => {
  const run = playback({ type: 'finish' });
  run.advance(200); run.player.cancel(); run.advance(5000);
  assert.deepEqual(run.sounds, []);
  assert.equal(run.completions, 0);
});

test('limited motion finishes without the long cinematic wait', () => {
  const run = playback({ type: 'finish', limited: true });
  run.advance(160);
  assert.equal(run.completions, 1);
  assert.equal(run.label.textContent, '뜻 해독 완료');
  assert.deepEqual(run.sounds, ['finish']);
});

test('active decode lasts 2000ms and syncs impact and sound after its 800ms cut-in', () => {
  let impacts = 0;
  const run = playback({ type: 'finish', onImpact: () => impacts++ });
  run.advance(1099);
  assert.deepEqual(run.sounds, []);
  run.advance(1);
  assert.deepEqual(run.sounds, ['swing']);
  run.advance(199);
  assert.equal(impacts, 0);
  run.advance(1);
  assert.equal(impacts, 1);
  assert.deepEqual(run.sounds, ['swing', 'finish']);
  run.advance(699);
  assert.equal(run.completions, 0);
  run.advance(1);
  assert.equal(run.completions, 1);
  run.advance(5000);
  assert.equal(impacts, 1);
  assert.equal(run.completions, 1);
});

test('active cut-in and strike animations fill the same two-second clock', () => {
  const timing = new Map();
  const root = { dataset: {}, querySelector: () => null, querySelectorAll: (selector) => [{
    animate: (_, options) => { timing.set(selector, options); return { pause() {}, cancel() {} }; },
  }] };
  const player = playSlimeSkill(root, { type: 'finish', now: () => 0, requestFrame: () => 1, cancelFrame() {}, onComplete() {} });
  assert.equal(timing.get('.skill-cutin').duration, 800);
  assert.equal(timing.get('.skill-mover').delay, 800);
  assert.equal(timing.get('.skill-mover').duration, 1200);
  player.cancel();
});

test('pausing and skipping the active cut-in cannot emit a late impact', () => {
  let impacts = 0;
  const run = playback({ type: 'finish', onImpact: () => impacts++ });
  run.advance(700); run.player.pause(); run.advance(5000);
  assert.equal(impacts, 0);
  assert.equal(run.completions, 0);
  run.player.resume(); run.advance(100);
  assert.equal(run.label.textContent, '검에 뜻을 새긴다');
  run.player.cancel(); run.advance(5000);
  assert.equal(impacts, 0);
  assert.equal(run.completions, 0);
});

test('audio remains optional when unsupported, blocked or muted', () => {
  const original = globalThis.AudioContext;
  try {
    globalThis.AudioContext = undefined;
    const unsupported = createBattleAudio();
    assert.doesNotThrow(() => { unsupported.unlock(true); unsupported.play('hit', true); unsupported.dispose(); });
    let created = 0;
    globalThis.AudioContext = class { constructor() { created++; throw Error('blocked'); } };
    const muted = createBattleAudio();
    muted.unlock(false); muted.play('hit', false);
    assert.equal(created, 0);
    assert.doesNotThrow(() => { muted.unlock(true); muted.play('finish', true); muted.dispose(); });
  } finally { globalThis.AudioContext = original; }
});
