import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyProgress, gameReducer, intentFor, reachableNodes } from '../src/game/engine.js';
import { CARDS, cardDetails } from '../src/game/catalog.js';
import { questionById } from '../src/game/quiz.js';
import { validProgress } from '../src/game/storage.js';

function start(seed = 42, tier = 'bronze') {
  const p = gameReducer(emptyProgress(), { type: 'START', tier, seed });
  return gameReducer(p, { type: 'SELECT_NODE', id: reachableNodes(p.run)[0].id });
}
function select(p, type) {
  const card = p.run.deck.find((c) => c.type === type);
  // Arrange a known hand while preserving the full deck partition.
  const b = p.run.battle;
  for (const pile of ['hand', 'draw', 'discard', 'exhaust']) b[pile] = b[pile].filter((uid) => uid !== card.uid);
  b.hand.push(card.uid);
  return gameReducer(p, { type: 'SELECT_CARD', uid: card.uid });
}
function answer(p, correct = true) {
  const question = p.run.battle.pending.question;
  const template = questionById(question.id);
  const choice = question.options.find((s) => template.answers.includes(s) === correct);
  return gameReducer(p, { type: 'ANSWER', id: question.id, answer: choice });
}

test('card selection spends energy once, locks turn and persists an unanswered quiz', () => {
  const p = select(start(), 'strike');
  assert.equal(p.run.battle.energy, 2);
  assert.ok(p.run.battle.pending);
  assert.ok(validProgress(p));
  assert.strictEqual(gameReducer(p, { type: 'END_TURN' }), p);
  assert.strictEqual(gameReducer(p, { type: 'SELECT_CARD', uid: p.run.battle.hand[0] }), p);
  assert.deepEqual(JSON.parse(JSON.stringify(p)), p);
});

test('correct answer deals damage once, wrong answer consumes card and records weakness', () => {
  const selected = select(start(), 'strike');
  const enemyHp = selected.run.battle.enemy.hp;
  const p = answer(selected);
  assert.equal(p.run.battle.enemy.hp, enemyHp - 8);
  assert.equal(p.learning.attempts, 1);
  assert.ok(validProgress(p));
  const f = p.run.battle.feedback;
  assert.strictEqual(gameReducer(p, { type: 'ANSWER', id: f.question.id, answer: f.answer }), p);
  const wrong = answer(select(start(), 'strike'), false);
  assert.equal(wrong.run.battle.enemy.hp, enemyHp);
  assert.equal(wrong.run.battle.energy, 2);
  assert.equal(wrong.run.battle.discard.length, 1);
  assert.equal(wrong.learning.entries[wrong.run.battle.feedback.question.id].active, true);
});

test('insufficient energy and invalid answer cannot consume cards or advance the quiz', () => {
  const p = start();
  p.run.battle.energy = 0;
  const card = p.run.deck.find((c) => p.run.battle.hand.includes(c.uid) && CARDS[c.type].cost > 0);
  assert.strictEqual(gameReducer(p, { type: 'SELECT_CARD', uid: card.uid }), p);
  const selected = select(start(), 'guard');
  assert.strictEqual(gameReducer(selected, { type: 'ANSWER', id: selected.run.battle.pending.question.id, answer: 'invalid' }), selected);
});

test('enemy intent matches attack resolution, block expires and energy/draw reset', () => {
  let p = start();
  p.run.battle.enemy = { type: 'crawler', hp: 36, maxHp: 36, block: 0, strength: 2, weak: 1, step: 0 };
  p.run.battle.block = 3;
  const value = intentFor(p.run.battle.enemy).value;
  assert.equal(value, 6);
  p = gameReducer(p, { type: 'END_TURN' });
  assert.equal(p.run.hp, 69);
  assert.equal(p.run.battle.block, 0);
  assert.equal(p.run.battle.enemy.weak, 0);
  assert.equal(p.run.battle.energy, 3);
  assert.equal(p.run.battle.hand.length, 5);
  assert.ok(validProgress(p));
});

test('all monster behaviors have deterministic, advertised effects', () => {
  for (const [type, step, kind] of [['sentinel', 0, 'block'], ['ember', 0, 'buff'], ['ravager', 0, 'charge']]) {
    const p = start();
    Object.assign(p.run.battle.enemy, { type, step, strength: 0 });
    const intent = intentFor(p.run.battle.enemy);
    assert.equal(intent.kind, kind);
    const after = gameReducer(p, { type: 'END_TURN' });
    assert.equal(after.run.hp, p.run.hp);
    if (kind === 'block') assert.equal(after.run.battle.enemy.block, intent.value);
    if (kind === 'buff') assert.equal(after.run.battle.enemy.strength, intent.value);
  }
});

test('multi-hit, first attack and focus synergies apply once with persistent strength', () => {
  let p = start();
  p.run.relics.push({ id: 'echo', level: 1 }, { id: 'whetstone', level: 1 });
  p.run.battle.enemy.hp = p.run.battle.enemy.maxHp = 200;
  p.run.battle.strength = 2;
  p.run.battle.focus = 3;
  p = answer(select(p, 'twin'));
  assert.equal(p.run.battle.enemy.hp, 200 - (5 + 2 + 3 + 4) * 2 - 3);
  assert.equal(p.run.battle.focus, 0);
  assert.equal(p.run.battle.firstAttack, false);
});

test('floating amount includes focus exactly as applied to block, heal, strength and weak', () => {
  // Played focus card: its own amount stays the raw focus value.
  let p = answer(select(start(), 'focus'));
  assert.equal(p.run.battle.focus, 5);
  assert.equal(p.run.battle.effect.amount, 5);
  let block = p.run.battle.block; // Starting relic block is not part of the card's amount.
  p = answer(select(gameReducer(p, { type: 'ACK' }), 'guard'));
  assert.equal(p.run.battle.block - block, 9 + 5);
  assert.equal(p.run.battle.effect.amount, 14);
  assert.equal(p.run.battle.focus, 0);

  // Reported repro: bronze seed 42, focus then heal below the cap.
  p = start();
  p.run.hp = 50;
  p = answer(select(gameReducer(answer(select(p, 'focus')), { type: 'ACK' }), 'heal'));
  assert.equal(p.run.hp, 64);
  assert.equal(p.run.battle.effect.kind, 'heal');
  assert.equal(p.run.battle.effect.amount, 14);
  assert.match(p.run.battle.log[0], /HP 회복 14$/);

  // Heal capped by max HP: the amount is the HP actually gained, like damage dealt.
  p = start();
  p.run.hp = p.run.maxHp - 3;
  p.run.battle.focus = 5;
  p = answer(select(p, 'heal'));
  assert.equal(p.run.hp, p.run.maxHp);
  assert.equal(p.run.battle.effect.amount, 3);
  assert.match(p.run.battle.log[0], /HP 회복 3$/);

  p = start();
  p.run.battle.focus = 5;
  p = answer(select(p, 'empower'));
  assert.equal(p.run.battle.strength, 2 + 5);
  assert.equal(p.run.battle.effect.amount, 7);

  p = start();
  p.run.battle.focus = 5;
  p = answer(select(p, 'weaken'));
  assert.equal(p.run.battle.enemy.weak, 2 + 5);
  assert.equal(p.run.battle.effect.amount, 7);

  // Block + strength card keeps block as the shown value; focus applies to both stats.
  p = start();
  p.run.deck.push({ uid: `card-${p.run.nextCard++}`, type: 'oath', upgraded: false });
  p.run.battle.focus = 5;
  block = p.run.battle.block;
  p = answer(select(p, 'oath'));
  assert.equal(p.run.battle.block - block, 8 + 5);
  assert.equal(p.run.battle.strength, 3 + 5);
  assert.equal(p.run.battle.effect.amount, 13);

  // No focus: unchanged raw values.
  p = answer(select(start(), 'guard'));
  assert.equal(p.run.battle.effect.amount, 9);
  assert.ok(validProgress(p));
});

test('healing/exhaust and first skill energy relic cannot be farmed', () => {
  let p = start();
  p.run.relics.push({ id: 'spring', level: 2 });
  p.run.hp = 70;
  p = answer(select(p, 'heal'));
  assert.equal(p.run.hp, 72);
  assert.equal(p.run.battle.energy, 3);
  assert.equal(p.run.battle.exhaust.length, 1);
  p = gameReducer(p, { type: 'ACK' });
  p = answer(select(p, 'guard'));
  assert.equal(p.run.battle.energy, 2);
  assert.ok(validProgress(p));
});

test('three correct answers trigger cadence; a wrong answer breaks the streak', () => {
  let p = start();
  p.run.relics.push({ id: 'cadence', level: 1 });
  p.run.battle.enemy.hp = p.run.battle.enemy.maxHp = 100;
  p.run.battle.streak = 2;
  p = answer(select(p, 'guard'));
  assert.equal(p.run.battle.enemy.hp, 94);
  p = gameReducer(p, { type: 'ACK' });
  p = answer(select(p, 'strike'), false);
  assert.equal(p.run.battle.streak, 0);
});

test('defeat resets temporary deck/relics, keeps learning and leaves clear records intact', () => {
  let p = answer(select(start(), 'guard'), false);
  p = gameReducer(p, { type: 'ACK' });
  p.run.hp = 1;
  p.run.battle.block = 0;
  Object.assign(p.run.battle.enemy, { type: 'crawler', step: 0 });
  const records = structuredClone(p.learning);
  p = gameReducer(p, { type: 'END_TURN' });
  assert.equal(p.run.phase, 'result');
  assert.equal(p.run.result.won, false);
  assert.deepEqual(p.learning, records);
  assert.deepEqual(p.run.deck, []);
  assert.deepEqual(p.run.relics, []);
  assert.ok(validProgress(p));
});

test('new adventures retain learning and preserve cumulative tier meaning', () => {
  let p = answer(select(start(), 'strike'), false);
  const records = p.learning.entries;
  p.learning.clears.platinum = 1; // Existing higher-tier clears remain honored.
  p = gameReducer(p, { type: 'START', tier: 'master', seed: 7 });
  assert.deepEqual(p.learning.entries, records);
  assert.equal(p.learning.runs, 2);
  assert.equal(p.run.deck.length, 12);
  assert.equal(cardDetails(p.run.deck[0]).damage, 8);
  assert.ok(validProgress(p));
});
