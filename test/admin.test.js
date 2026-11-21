import test from 'node:test';
import assert from 'node:assert/strict';
import { CARDS } from '../src/game/catalog.js';
import { emptyProgress, gameReducer, intentFor, reachableNodes } from '../src/game/engine.js';
import { isCorrectAnswer, makeQuestion, questionPool } from '../src/game/quiz.js';
import { PROGRESS_KEY, clearProgress, loadProgress, persistProgress, validProgress } from '../src/game/storage.js';
import { createAdminReducer, pickQuizAnswer } from '../src/admin/adminEngine.js';
import {
  ADMIN_CHEATS_KEY,
  ADMIN_PROGRESS_KEY,
  DEFAULT_ADMIN_CHEATS,
  countActiveCheats,
  readAdminCheats,
  saveAdminCheats,
} from '../src/admin/adminState.js';

function memory(entries = []) {
  const data = new Map(entries);
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
}

function startBattle(reducer = gameReducer, tier = 'bronze', seed = 42) {
  let p = reducer(emptyProgress(), { type: 'START', tier, seed });
  p = reducer(p, { type: 'SELECT_NODE', id: reachableNodes(p.run)[0].id });
  return p;
}

function putInHand(progress, cardType) {
  const next = structuredClone(progress);
  const card = next.run.deck.find((c) => c.type === cardType);
  assert.ok(card, `missing card ${cardType}`);
  const b = next.run.battle;
  for (const pile of ['hand', 'draw', 'discard', 'exhaust']) {
    b[pile] = b[pile].filter((uid) => uid !== card.uid);
  }
  b.hand.push(card.uid);
  return { progress: next, card };
}

test('admin cheat state defaults off, persists cleanly, and isolates storage key', () => {
  assert.notEqual(ADMIN_PROGRESS_KEY, PROGRESS_KEY);
  const storage = memory();
  assert.deepEqual(readAdminCheats(storage), DEFAULT_ADMIN_CHEATS);
  assert.equal(countActiveCheats(DEFAULT_ADMIN_CHEATS), 0);

  const updated = { ...DEFAULT_ADMIN_CHEATS, invincible: true, showAnswer: true };
  assert.equal(saveAdminCheats(updated, storage), true);
  assert.deepEqual(readAdminCheats(storage), updated);
  assert.equal(countActiveCheats(updated), 2);

  storage.setItem(ADMIN_CHEATS_KEY, '{broken');
  assert.deepEqual(readAdminCheats(storage), DEFAULT_ADMIN_CHEATS);

  const normalProgress = startBattle();
  const savedNormal = persistProgress(normalProgress, null, storage, PROGRESS_KEY);
  assert.equal(savedNormal.ok, true);

  const adminProgress = startBattle(createAdminReducer(() => ({ unlockAllTiers: true })), 'master', 99);
  const savedAdmin = persistProgress(adminProgress, null, storage, ADMIN_PROGRESS_KEY);
  assert.equal(savedAdmin.ok, true);
  assert.equal(loadProgress(storage, PROGRESS_KEY).progress.run.tier, 'bronze');
  assert.equal(loadProgress(storage, ADMIN_PROGRESS_KEY).progress.run.tier, 'master');

  assert.equal(clearProgress(storage, ADMIN_PROGRESS_KEY), true);
  assert.equal(loadProgress(storage, ADMIN_PROGRESS_KEY).progress.run, null);
  assert.equal(loadProgress(storage, PROGRESS_KEY).progress.run.tier, 'bronze');
});

test('unlockAllTiers starts higher tiers without writing fake clear records', () => {
  const reducer = createAdminReducer(() => ({ unlockAllTiers: true }));
  const started = reducer(emptyProgress(), { type: 'START', tier: 'master', seed: 123 });
  assert.equal(started.run.tier, 'master');
  assert.deepEqual(started.learning.clears, {});
  assert.equal(validProgress(started), true);
});

test('invincible neutralizes lethal enemy attacks while keeping valid progress', () => {
  const reducer = createAdminReducer(() => ({ invincible: true }));
  const p = startBattle(reducer);
  p.run.hp = 1;
  p.run.battle.block = 0;
  // Advance enemy step to an attack intent if needed.
  while (intentFor(p.run.battle.enemy).kind !== 'attack') {
    p.run.battle.enemy.step++;
  }
  const after = reducer(p, { type: 'END_TURN' });
  assert.equal(after.run.phase, 'battle');
  assert.equal(after.run.hp, 1);
  assert.equal(after.run.battle.effect.kind, 'hurt');
  assert.equal(after.run.battle.effect.amount, 0);
  assert.equal(validProgress(after), true);
});

test('infiniteEnergy allows playing cards at 0 energy and preserves energy', () => {
  const reducer = createAdminReducer(() => ({ infiniteEnergy: true }));
  const { progress: p, card } = putInHand(startBattle(reducer), 'heavy');
  p.run.battle.energy = 0;
  const selected = reducer(p, { type: 'SELECT_CARD', uid: card.uid });
  assert.ok(selected.run.battle.pending);
  assert.equal(selected.run.battle.energy, 3);
  assert.equal(validProgress(selected), true);
});

test('oneHitKill defeats enemy on any correct attack answer', () => {
  const reducer = createAdminReducer(() => ({ oneHitKill: true }));
  const { progress: p, card } = putInHand(startBattle(reducer), 'strike');
  p.run.battle.enemy.block = 15;
  const selected = reducer(p, { type: 'SELECT_CARD', uid: card.uid });
  const q = selected.run.battle.pending.question;
  const answer = pickQuizAnswer(q, [], true);
  const resolved = reducer(selected, { type: 'ANSWER', id: q.id, answer });
  assert.equal(resolved.run.battle.enemy.hp, 0);
  assert.equal(resolved.run.battle.enemy.block, 0);
  assert.equal(resolved.run.battle.effect.kind, 'attack');
  assert.equal(validProgress(resolved), true);
});

test('ADMIN_SKIP_PLAY_CARD activates card immediately without polluting learning stats', () => {
  const cheats = { skipQuiz: true, infiniteEnergy: true, oneHitKill: false };
  const reducer = createAdminReducer(() => cheats);
  const { progress: p, card } = putInHand(startBattle(reducer), 'strike');
  const enemyHpBefore = p.run.battle.enemy.hp;

  const after = reducer(p, { type: 'ADMIN_SKIP_PLAY_CARD', uid: card.uid });
  assert.equal(after.run.battle.pending, null);
  assert.equal(after.run.battle.feedback, null);
  assert.equal(after.run.battle.enemy.hp, enemyHpBefore - CARDS.strike.damage);
  assert.equal(after.run.battle.effect.kind, 'attack');
  assert.equal(after.run.battle.effect.cardType, 'strike');
  assert.equal(after.learning.attempts, 0);
  assert.equal(after.learning.correct, 0);
  assert.deepEqual(after.learning.entries, {});
  assert.equal(after.run.answers, 0);
  assert.equal(after.run.correct, 0);
  assert.deepEqual(after.run.battle.used, []);
  assert.equal(validProgress(after), true);

  // With oneHitKill enabled, skip play drops enemy to 0 and ADMIN_FINISH_VICTORY opens reward.
  cheats.oneHitKill = true;
  const { progress: p2, card: card2 } = putInHand(after, 'heavy');
  const killed = reducer(p2, { type: 'ADMIN_SKIP_PLAY_CARD', uid: card2.uid });
  assert.equal(killed.run.battle.enemy.hp, 0);
  assert.equal(validProgress(killed), true);

  const rewarded = reducer(killed, { type: 'ADMIN_FINISH_VICTORY' });
  assert.equal(rewarded.run.phase, 'reward');
  assert.equal(rewarded.run.fights, 1);
  assert.equal(validProgress(rewarded), true);
});

test('ADMIN_KILL_ENEMY resolves combat even while a quiz is pending', () => {
  const reducer = createAdminReducer(() => DEFAULT_ADMIN_CHEATS);
  const { progress: p, card } = putInHand(startBattle(reducer), 'strike');
  const pending = reducer(p, { type: 'SELECT_CARD', uid: card.uid });
  assert.ok(pending.run.battle.pending);

  const rewarded = reducer(pending, { type: 'ADMIN_KILL_ENEMY' });
  assert.equal(rewarded.run.phase, 'reward');
  assert.equal(rewarded.run.battle, null);
  assert.equal(rewarded.run.fights, 1);
  assert.equal(validProgress(rewarded), true);
});

test('ADMIN_DRAW_CARDS and ADMIN_MODIFY_STATS clamp values and keep progress valid', () => {
  const reducer = createAdminReducer(() => DEFAULT_ADMIN_CHEATS);
  const p = startBattle(reducer);
  const drawn = reducer(p, { type: 'ADMIN_DRAW_CARDS', count: 2 });
  assert.equal(drawn.run.battle.hand.length, p.run.battle.hand.length + 2);
  assert.equal(validProgress(drawn), true);

  const modified = reducer(drawn, {
    type: 'ADMIN_MODIFY_STATS',
    patch: {
      maxHp: 50,
      hp: 999,
      gold: 500,
      energy: 99,
      block: 25,
      strength: 10,
      focus: 15,
      enemyHp: 1,
      enemyBlock: 12,
      enemyStrength: 4,
      enemyWeak: 3,
    },
  });
  assert.equal(modified.run.maxHp, 50);
  assert.equal(modified.run.hp, 50);
  assert.equal(modified.run.gold, 500);
  assert.equal(modified.run.battle.energy, 9);
  assert.equal(modified.run.battle.block, 25);
  assert.equal(modified.run.battle.strength, 10);
  assert.equal(modified.run.battle.focus, 15);
  assert.equal(modified.run.battle.enemy.hp, 1);
  assert.equal(modified.run.battle.enemy.block, 12);
  assert.equal(modified.run.battle.enemy.strength, 4);
  assert.equal(modified.run.battle.enemy.weak, 3);
  assert.equal(validProgress(modified), true);
});

test('pickQuizAnswer supports multiple-choice and custom typing questions', () => {
  const schoolQ = makeQuestion(questionPool('bronze')[0], () => 0.25);
  const schoolRight = pickQuizAnswer(schoolQ, [], true);
  const schoolWrong = pickQuizAnswer(schoolQ, [], false);
  assert.equal(isCorrectAnswer(schoolQ, schoolRight, []), true);
  assert.equal(isCorrectAnswer(schoolQ, schoolWrong, []), false);

  const book = {
    id: 'book-00000000-0000-4000-8000-000000000001',
    name: '단일 단어장',
    words: [{ term: 'abandon', meaning: '버리다' }],
  };
  const typingQ = makeQuestion(questionPool(book.id, [book])[0], () => 0.25);
  assert.equal(typingQ.mode, 'typing');
  const typingRight = pickQuizAnswer(typingQ, [book], true);
  const typingWrong = pickQuizAnswer(typingQ, [book], false);
  assert.equal(isCorrectAnswer(typingQ, typingRight, [book]), true);
  assert.equal(isCorrectAnswer(typingQ, typingWrong, [book]), false);
});
