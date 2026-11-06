import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyProgress, gameReducer, reachableNodes } from '../src/game/engine.js';
import { PROGRESS_KEY, loadProgress, persistProgress, validProgress } from '../src/game/storage.js';
import { questionById } from '../src/game/quiz.js';
import { SETTINGS_KEY } from '../src/settings.js';

function memory(entries = []) {
  const data = new Map(entries);
  return { data, getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}
function pendingQuiz() {
  const initial = emptyProgress();
  initial.learning.clears.bronze = 1;
  let p = gameReducer(initial, { type: 'START', seed: 8, tier: 'silver' });
  p = gameReducer(p, { type: 'SELECT_NODE', id: reachableNodes(p.run)[0].id });
  return gameReducer(p, { type: 'SELECT_CARD', uid: p.run.battle.hand[0] });
}

test('save round-trips an unresolved card/quiz with RNG, without changing old keys', () => {
  const storage = memory([[SETTINGS_KEY, 'old settings'], ['legacy.learning', 'old learning']]);
  const p = pendingQuiz();
  const saved = persistProgress(p, null, storage);
  assert.equal(saved.ok, true);
  assert.deepEqual(loadProgress(storage).progress, p);
  assert.equal(storage.data.get(SETTINGS_KEY), 'old settings');
  assert.equal(storage.data.get('legacy.learning'), 'old learning');
  const q = p.run.battle.pending.question;
  const answer = q.options.find((s) => questionById(q.id).answers.includes(s));
  const resolved = gameReducer(loadProgress(storage).progress, { type: 'ANSWER', id: q.id, answer });
  assert.equal(resolved.run.battle.energy, p.run.battle.energy);
  assert.equal(resolved.learning.attempts, 1);
  assert.equal(persistProgress(resolved, saved.raw, storage).ok, true);
  assert.ok(loadProgress(storage).progress.run.battle.feedback);
});

test('malformed, unsupported and structurally invalid records remain untouched', () => {
  for (const raw of ['{broken', JSON.stringify({ version: 10, progress: emptyProgress() }), JSON.stringify({ version: 1, progress: { version: 1, run: { phase: 'battle' } } })]) {
    const storage = memory([[PROGRESS_KEY, raw]]);
    const loaded = loadProgress(storage);
    assert.equal(loaded.blocked, true);
    assert.ok(loaded.error);
    assert.equal(storage.getItem(PROGRESS_KEY), raw);
  }
});

test('unavailable/denied storage, quota failure and conflicting tabs are reported safely', () => {
  const denied = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); } };
  assert.equal(loadProgress(denied).blocked, true);
  assert.equal(persistProgress(emptyProgress(), null, denied).ok, false);
  const storage = memory();
  const first = persistProgress(emptyProgress(), null, storage);
  assert.equal(first.ok, true);
  const conflict = persistProgress(pendingQuiz(), null, storage);
  assert.equal(conflict.conflict, true);
  assert.equal(storage.getItem(PROGRESS_KEY), first.raw);
});

test('save validator rejects invalid deck partitions, HP, intents, quiz options and paths', () => {
  const initial = pendingQuiz();
  const mutations = [
    (p) => { p.run.battle.hand.push(p.run.battle.draw[0]); },
    (p) => { p.run.hp = -1; },
    (p) => { p.run.battle.enemy.type = 'unknown'; },
    (p) => { p.run.battle.pending.question.options = ['bad', 'bad', 'bad', 'bad']; },
    (p) => { p.run.visited[0] = 'node-7-1'; },
    (p) => { p.run.deck[0].type = 'unknown'; },
    (p) => { p.learning.attempts = 100; },
  ];
  for (const mutate of mutations) { const p = structuredClone(initial); mutate(p); assert.equal(validProgress(p), false); }
});

test('wrong questions remain through defeat/new run, need two consecutive correct reviews, and cannot double-submit', () => {
  let p = pendingQuiz();
  const q = p.run.battle.pending.question;
  const source = questionById(q.id);
  p = gameReducer(p, { type: 'ANSWER', id: q.id, answer: q.options.find((s) => !source.answers.includes(s)) });
  p = gameReducer(p, { type: 'START', tier: 'silver', seed: 18 });
  const answerReview = () => {
    p = gameReducer(p, { type: 'REVIEW_START', id: q.id, seed: 12 });
    const action = { type: 'REVIEW_ANSWER', id: q.id, answer: p.review.question.options.find((s) => source.answers.includes(s)) };
    p = gameReducer(p, action);
    assert.strictEqual(gameReducer(p, action), p);
    assert.ok(validProgress(p));
  };
  answerReview();
  assert.equal(p.learning.entries[q.id].active, true);
  assert.equal(p.learning.entries[q.id].consecutive, 1);
  answerReview();
  assert.equal(p.learning.entries[q.id].active, false);
  assert.equal(p.learning.entries[q.id].attempts, 3);
  assert.equal(p.learning.entries[q.id].wrong, 1);
});
