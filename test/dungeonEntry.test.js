import test from 'node:test';
import assert from 'node:assert/strict';
import { dungeonEntryPose, ENTRY_DURATION, LIMITED_ENTRY_DURATION, playDungeonEntry } from '../src/dungeonEntry.js';

function playback(options = {}) {
  let time = 0, nextId = 0, completed = 0;
  const frames = new Map(), elements = new Map(), phases = [];
  const pageDocument = new EventTarget();
  pageDocument.hidden = false;
  const root = { querySelector(selector) {
    if (!elements.has(selector)) elements.set(selector, { attributes: {}, style: {}, setAttribute(name, value) { this.attributes[name] = value; } });
    return elements.get(selector);
  } };
  const controller = new AbortController();
  playDungeonEntry(root, { signal: controller.signal, document: pageDocument, now: () => time,
    requestFrame: (callback) => { frames.set(++nextId, callback); return nextId; }, cancelFrame: (id) => frames.delete(id),
    onPhase: (phase) => phases.push(phase), onComplete: () => completed++, ...options });
  return { frames, elements, phases, controller, document: pageDocument, get completed() { return completed; },
    advance(ms) {
      while (ms > 0) { const step = Math.min(20, ms); time += step; ms -= step; const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback()); }
    },
  };
}

test('the hero walks through an open doorway before either door starts closing', () => {
  assert.equal(dungeonEntryPose(0).openness, 0);
  assert.equal(dungeonEntryPose(500).openness, 1);
  assert.equal(dungeonEntryPose(500).phase, 'walking');
  assert.ok(dungeonEntryPose(1200).offset > 0);
  assert.equal(dungeonEntryPose(1900).phase, 'entering');
  assert.equal(dungeonEntryPose(2349).visible, true);
  assert.equal(dungeonEntryPose(2349).openness, 1);
  assert.equal(dungeonEntryPose(2350).visible, false);
  assert.equal(dungeonEntryPose(2350).phase, 'closing');
  assert.ok(dungeonEntryPose(2700).openness < 1);
  assert.equal(dungeonEntryPose(3050).openness, 0);
  assert.equal(dungeonEntryPose(ENTRY_DURATION).phase, 'closed');
});

test('entry completes once after the doors are closed and releases its animation frame', () => {
  const run = playback();
  run.advance(ENTRY_DURATION - 1);
  assert.equal(run.completed, 0);
  assert.equal(run.elements.get('.entry-hero').attributes.opacity, '0');
  assert.equal(run.elements.get('.entry-door-left').attributes.transform, 'translate(0 0)');
  run.advance(1);
  assert.equal(run.completed, 1);
  assert.deepEqual(run.phases, ['opening', 'walking', 'entering', 'closing', 'closed']);
  assert.equal(run.frames.size, 0);
  run.advance(5000);
  assert.equal(run.completed, 1);
});

test('hidden tabs cannot advance the entry or start the story early', () => {
  const run = playback();
  run.advance(1000);
  const position = run.elements.get('.entry-hero').attributes.transform;
  run.document.hidden = true; run.document.dispatchEvent(new Event('visibilitychange'));
  run.advance(5000);
  assert.equal(run.completed, 0);
  assert.equal(run.elements.get('.entry-hero').attributes.transform, position);
  run.document.hidden = false; run.document.dispatchEvent(new Event('visibilitychange'));
  run.advance(ENTRY_DURATION - 1001);
  assert.equal(run.completed, 0);
  run.advance(1);
  assert.equal(run.completed, 1);
});

test('skipping or unmounting cancels every future phase and completion callback', () => {
  const run = playback();
  run.advance(900);
  run.controller.abort();
  const count = run.phases.length;
  run.advance(10000);
  run.document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(run.completed, 0);
  assert.equal(run.phases.length, count);
  assert.equal(run.frames.size, 0);
  const aborted = new AbortController(); aborted.abort();
  const neverStarted = playback({ signal: aborted.signal });
  assert.deepEqual(neverStarted.phases, []);
  assert.equal(neverStarted.frames.size, 0);
});

test('limited motion shows the final closed doors and proceeds without walking or a long wait', () => {
  const run = playback({ limited: true });
  assert.deepEqual(run.phases, ['closed']);
  assert.equal(run.elements.get('.entry-hero').attributes.opacity, '0');
  run.advance(LIMITED_ENTRY_DURATION - 1);
  assert.equal(run.completed, 0);
  run.advance(1);
  assert.equal(run.completed, 1);
});
