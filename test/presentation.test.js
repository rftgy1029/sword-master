import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyProgress, gameReducer, unlockedTierIds, reachableNodes } from '../src/game/engine.js';
import { CARDS } from '../src/game/catalog.js';
import { CARD_MOTIONS } from '../src/game/cardMotions.js';
import { TIERS } from '../src/vocabulary.js';
import { persistProgress, loadProgress, validProgress } from '../src/game/storage.js';
import { questionById } from '../src/game/quiz.js';

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
    if (CARDS[id].damage) assert.equal(recipe.duration, 2000);
    else assert.ok(recipe.duration >= 400 && recipe.duration <= 800);
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
