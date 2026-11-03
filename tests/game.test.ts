import test from 'node:test';
import assert from 'node:assert/strict';
import { Battle } from '../src/game/battle.ts';
import { Quiz } from '../src/game/quiz.ts';
import { types } from '../src/data/units.ts';
import { stages } from '../src/data/stages.ts';
import { rules } from '../src/game/rules.ts';

const correctIndex = (quiz: Quiz) => quiz.choices.findIndex(w => w[0] === quiz.question[0]);

test('correct answers fund summons exactly once; costs and cooldowns gate summoning', () => {
  const battle = new Battle(() => .7);
  const quiz = new Quiz(() => .7);
  assert.equal(battle.summon(0), false);
  battle.setupStage(0);
  const reward = quiz.answer(correctIndex(quiz));
  assert.equal(reward, 55);
  battle.addEnergy(reward!);
  assert.equal(quiz.answer(correctIndex(quiz)), null);
  assert.equal(battle.state.energy, 175);
  assert.equal(battle.summon(2), true);
  assert.equal(battle.state.energy, 35);
  assert.equal(battle.summon(2), false);
  assert.equal(battle.state.units.length, 1);
  assert.equal(battle.summon(-1), false);
  assert.equal(battle.summon(99), false);
  battle.state.energy = 999;
  battle.update(types[2].cd);
  assert.equal(battle.summon(2), true);
});

test('wrong answers give no energy and are scheduled for review after two attempts', () => {
  const quiz = new Quiz(() => .7);
  const wrongWord = quiz.question[0];
  const wrongIndex = quiz.choices.findIndex(w => w[0] !== wrongWord);
  assert.equal(quiz.answer(wrongIndex), 0);
  assert.equal(quiz.mistakes.get(wrongWord)?.count, 1);
  quiz.update(3);
  assert.notEqual(quiz.question[0], wrongWord);
  for (let i = 0; i < 2; i++) {
    quiz.answer(correctIndex(quiz));
    quiz.update(2);
  }
  assert.equal(quiz.question[0], wrongWord);
  quiz.answer(correctIndex(quiz));
  assert.equal(quiz.mistakes.get(wrongWord)?.recovered, true);
});

test('three correct answers award the combo bonus; hints remove rewards and combo', () => {
  const quiz = new Quiz(() => .4);
  for (const expected of [55, 55, 90]) {
    assert.equal(quiz.answer(correctIndex(quiz)), expected);
    quiz.update(2);
  }
  quiz.showHint();
  assert.equal(quiz.combo, 0);
  assert.equal(quiz.answer(correctIndex(quiz)), 0);
  assert.equal(quiz.correct, 4);
  quiz.reset();
  assert.equal(quiz.attempts, 0);
  assert.equal(quiz.mistakes.size, 0);
  assert.equal(quiz.locked, false);
});

test('pause freezes combat, energy production, damage, cooldowns, and spawns', () => {
  const battle = new Battle();
  battle.setupStage(0);
  battle.summon(0);
  battle.togglePause();
  const before = structuredClone(battle.state);
  battle.update(10);
  assert.deepEqual(battle.state, before);
  assert.equal(battle.summon(1), false);
  battle.togglePause();
  battle.update(.05);
  assert.ok(battle.state.time > 0);
  assert.ok(battle.state.units[0].x > rules.allySpawnX);
});

test('battle ends on either base destruction; final stage has a campaign completion state', () => {
  for (let index = 0; index < stages.length; index++) {
    const battle = new Battle();
    battle.setupStage(index);
    battle.summon(0);
    const ally = battle.state.units[0];
    ally.x = rules.enemyBaseX - ally.range - rules.baseRadius;
    battle.state.enemyHP = 1;
    battle.update(.05);
    assert.equal(battle.state.enemyHP, 0);
    assert.equal(battle.state.mode, index === stages.length - 1 ? 'complete' : 'won');
  }
  const battle = new Battle(() => .7);
  battle.setupStage(0);
  battle.update(4);
  const enemy = battle.state.units.find(u => u.side === -1)!;
  enemy.x = rules.ownBaseX + enemy.range + rules.baseRadius;
  enemy.attack = 0;
  battle.state.ownHP = 1;
  battle.update(.05);
  assert.equal(battle.state.mode, 'lost');
  battle.setupStage(0);
  assert.equal(battle.state.ownHP, 900);
  assert.equal(battle.state.units.length, 0);
});

test('melee units stop at an opposing unit and attack without walking through it', () => {
  const battle = new Battle(() => .7);
  battle.setupStage(0);
  battle.summon(0);
  battle.update(4);
  const ally = battle.state.units.find(u => u.side === 1)!;
  const enemy = battle.state.units.find(u => u.side === -1)!;
  ally.x = 400;
  enemy.x = 450;
  ally.hp = enemy.hp = 10000;
  const previousHP = enemy.hp;
  for (let i = 0; i < 30; i++) battle.update(.05);
  assert.ok(ally.x < enemy.x);
  assert.ok(enemy.hp < previousHP);
});

test('difficulty, unique choices, recent-word rotation, and energy limits survive modularization', () => {
  const quiz = new Quiz(() => .6);
  const seen = new Set<string>();
  for (let i = 0; i < 6; i++) {
    assert.ok(!seen.has(quiz.question[0]));
    seen.add(quiz.question[0]);
    assert.equal(new Set(quiz.choices.map(w => w[1])).size, 4);
    quiz.next();
  }
  quiz.setDifficulty('intermediate');
  assert.equal(quiz.difficulty, 'intermediate');
  assert.equal(quiz.choices.length, 4);
  const battle = new Battle();
  battle.addEnergy(10000);
  assert.equal(battle.state.energy, 999);
  battle.addEnergy(NaN);
  assert.equal(battle.state.energy, 999);
  assert.throws(() => battle.setupStage(999), RangeError);
});
