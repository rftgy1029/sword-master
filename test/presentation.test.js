import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { emptyProgress, gameReducer, unlockedTierIds, reachableNodes } from '../src/game/engine.js';
import { CARDS } from '../src/game/catalog.js';
import { CARD_ART } from '../src/game/cardArt.js';
import { CARD_MOTIONS, realDuration } from '../src/game/cardMotions.js';
import { TIERS } from '../src/vocabulary.js';
import { persistProgress, loadProgress, validProgress } from '../src/game/storage.js';
import { questionById } from '../src/game/quiz.js';
import { createCombatAudio } from '../src/game/combatAudio.js';

test('new players start at bronze; every clear unlocks exactly the next tier and survives reload', () => {
  let p = emptyProgress(), raw = null;
  const storage = { getItem: () => raw, setItem: (_, value) => { raw = value; } };
  assert.deepEqual(unlockedTierIds(p), ['bronze']);
  assert.strictEqual(gameReducer(p, { type: 'START', tier: 'silver', seed: 1 }), p);
  for (let i = 0; i < TIERS.length; i++) {
    p.learning.clears[TIERS[i].id] = 1;
    assert.deepEqual(unlockedTierIds(p), TIERS.slice(0, Math.min(i + 2, 5)).map((t) => t.id));
    assert.equal(persistProgress(p, raw, storage).ok, true);
    p = loadProgress(storage).progress;
    if (i < 4) assert.equal(gameReducer(p, { type: 'START', tier: TIERS[i + 1].id, seed: i }).run.tier, TIERS[i + 1].id);
    if (i < 3) assert.strictEqual(gameReducer(p, { type: 'START', tier: TIERS[i + 2].id, seed: i }), p);
  }
});

test('non-contiguous legacy clears open lower tiers and legacy higher-tier runs still load', () => {
  const p = emptyProgress();
  p.learning.clears.gold = 2;
  assert.deepEqual(unlockedTierIds(p), ['bronze', 'silver', 'gold', 'platinum']);
  let legacy = gameReducer(p, { type: 'START', tier: 'platinum', seed: 9 });
  legacy.learning.clears = {};
  assert.equal(validProgress(legacy), true);
  assert.deepEqual(unlockedTierIds(legacy), ['bronze']);
  const node = reachableNodes(legacy.run)[0];
  legacy = gameReducer(legacy, { type: 'SELECT_NODE', id: node.id });
  assert.equal(legacy.run.phase, 'battle');
  assert.strictEqual(gameReducer(legacy, { type: 'START', tier: 'platinum', seed: 3 }), legacy);
});

test('every current and future catalog card needs a distinct registered skill within the short motion budget', () => {
  assert.deepEqual(Object.keys(CARD_MOTIONS).sort(), Object.keys(CARDS).sort(), 'Register a distinct motion when adding a card');
  assert.equal(new Set(Object.values(CARD_MOTIONS).map((m) => m.style)).size, Object.keys(CARDS).length);
  for (const [id, recipe] of Object.entries(CARD_MOTIONS)) {
    const [min, max] = ({ strike: [700, 900], heavy: [1100, 1400], twin: [1100, 1400], nova: [1500, 1800] })[id] ?? [400, 1500];
    assert.ok(realDuration(id) >= min && realDuration(id) <= max, id);
    if (CARDS[id].damage) assert.ok(recipe.hits.every((time) => time > 0 && time < recipe.duration));
    else assert.ok(recipe.moment > 0 && recipe.moment < recipe.duration);
  }
});

test('card identity for visuals survives storage while old effects remain valid and cannot resolve twice', () => {
  let p = gameReducer(emptyProgress(), { type: 'START', tier: 'bronze', seed: 5 });
  p = gameReducer(p, { type: 'SELECT_NODE', id: reachableNodes(p.run)[0].id });
  assert.equal(validProgress(p), true); // Legacy start effect: no metadata.
  const uid = p.run.battle.hand[0];
  const card = p.run.deck.find((c) => c.uid === uid);
  p = gameReducer(p, { type: 'SELECT_CARD', uid });
  const q = p.run.battle.pending.question;
  const action = { type: 'ANSWER', id: q.id, answer: q.options.find((s) => questionById(q.id).answers.includes(s)) };
  p = gameReducer(p, action);
  assert.equal(p.run.battle.effect.cardType, card.type);
  assert.equal(validProgress(p), true);
  assert.strictEqual(gameReducer(p, action), p);
  let raw = null;
  const storage = { getItem: () => raw, setItem: (_, value) => { raw = value; } };
  assert.equal(persistProgress(p, raw, storage).ok, true);
  assert.deepEqual(loadProgress(storage).progress, p);
  p.run.battle.effect.cardType = 'unknown-motion';
  assert.equal(validProgress(p), false);
});

test('reward audio respects sound toggle, preserves configured gain on lazy unlock, and disposes cleanly', () => {
  const prevAudio = globalThis.AudioContext;
  const created = [];
  class FakeAudioContext {
    constructor() {
      this.state = 'running';
      this.currentTime = 0;
      this.sampleRate = 8000;
      this.destination = {};
      this.oscillators = [];
      this.gains = [];
      this.closed = false;
      created.push(this);
    }
    createGain() {
      const node = {
        gain: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime(v) { this.value = v; } },
        connect() {}, disconnect() {},
      };
      this.gains.push(node);
      return node;
    }
    createDynamicsCompressor() { return { connect() {} }; }
    createBuffer(_ch, len) { const data = new Float32Array(len); return { getChannelData: () => data }; }
    createOscillator() {
      const osc = {
        type: 'sine',
        frequency: { setValueAtTime(v) { osc.freq = v; }, exponentialRampToValueAtTime() {} },
        connect() {}, disconnect() {},
        start() { osc.started = true; },
        stop() { osc.stopped = true; },
      };
      this.oscillators.push(osc);
      return osc;
    }
    resume() { return Promise.resolve(); }
    close() { this.state = 'closed'; this.closed = true; return Promise.resolve(); }
  }
  globalThis.AudioContext = FakeAudioContext;
  try {
    const audio = createCombatAudio();
    audio.configure(false, 60);
    audio.unlock();
    audio.reward('claim');
    assert.equal(created.length, 0, 'Muted audio never creates an AudioContext');

    audio.configure(true, 60);
    audio.unlock();
    assert.equal(created.length, 1);
    assert.ok(created[0].gains[0].gain.value > 0, 'Master gain uses configured volume right after unlock');
    audio.reward('claim');
    assert.equal(created[0].oscillators.length, 3, 'Card claim chime schedules 3 gentle notes');
    audio.reward('relic');
    assert.equal(created[0].oscillators.length, 6, 'Relic chime schedules 3 distinct notes');

    audio.configure(true, 0);
    audio.reward('claim');
    assert.equal(created[0].oscillators.length, 6, 'Zero volume suppresses further chimes');

    audio.dispose();
    assert.equal(created[0].closed, true);
  } finally {
    if (prevAudio === undefined) delete globalThis.AudioContext;
    else globalThis.AudioContext = prevAudio;
  }
});

test('every catalog card has a dedicated hand-painted WebP illustration', () => {
  assert.deepEqual(Object.keys(CARD_ART).sort(), Object.keys(CARDS).sort());
  for (const [id, url] of Object.entries(CARD_ART)) {
    assert.equal(existsSync(fileURLToPath(url)), true, `Missing card illustration for ${id}`);
  }
});
