import test from 'node:test';
import assert from 'node:assert/strict';
import { createPracticeBattle, shouldOpenTutorialForMenu } from '../src/game/tutorial.js';
import { gameReducer } from '../src/game/engine.js';
import { questionById } from '../src/game/quiz.js';

test('tutorial opens automatically only when starting 새 모험 for every visitor', () => {
  assert.equal(shouldOpenTutorialForMenu('새 모험'), true);
  for (const menu of ['이어하기', '단어장', '오답 복습', '설정', '설문 참여', null]) {
    assert.equal(shouldOpenTutorialForMenu(menu), false, `${menu} does not auto-open the tutorial`);
  }
});

test('practice battle is isolated, repeatable, and completable in one turn', () => {
  const first = createPracticeBattle();
  const second = createPracticeBattle();
  assert.deepEqual(first, second, 'Retrying the practice battle produces the same deterministic setup');
  assert.equal(first.run.phase, 'battle');
  assert.equal(first.run.deck.length, 1);
  assert.equal(first.run.deck[0].type, 'strike');

  const picked = gameReducer(first, { type: 'SELECT_CARD', uid: first.run.deck[0].uid });
  const q = picked.run.battle.pending.question;
  const answer = q.options.find((option) => questionById(q.id).answers.includes(option));
  const answered = gameReducer(picked, { type: 'ANSWER', id: q.id, answer });
  assert.equal(answered.run.battle.feedback.correct, true);
  assert.ok(answered.run.battle.enemy.hp < first.run.battle.enemy.hp);

  const nextTurn = gameReducer(gameReducer(answered, { type: 'ACK' }), { type: 'END_TURN' });
  assert.equal(nextTurn.run.battle.turn, 2);
});
