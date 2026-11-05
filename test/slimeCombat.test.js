import test from 'node:test';
import assert from 'node:assert/strict';
import { activateSlimeSkill, createEncounter, emptyLearning, encounterHealth, encounterQuestion, learningSummary, readLearning, recordAnswer, saveLearning, slimeCombat } from '../src/battle.js';

function answer(learning, correct = true) {
  const session = learning.encounters.slime ?? createEncounter('slime');
  const question = encounterQuestion('slime', session);
  return recordAnswer(learning, 'slime', session, session.answers.length, correct ? question.answerIndex : (question.answerIndex + 1) % 4);
}

function roundTrip(learning) {
  let raw;
  assert.equal(saveLearning(learning, { setItem: (_, value) => { raw = value; } }), true);
  return readLearning({ getItem: () => raw });
}

test('three consecutive answers charge one manual cast; casting deals 40 and credits only answered words', () => {
  let learning = emptyLearning();
  assert.equal(activateSlimeSkill(learning, createEncounter('slime')), learning);
  for (let i = 0; i < 3; i++) learning = answer(learning);
  const session = learning.encounters.slime;
  assert.deepEqual(slimeCombat(session), { hp: 40, streak: 3, charged: true });
  const cast = activateSlimeSkill(learning, session);
  assert.deepEqual(slimeCombat(cast.encounters.slime), { hp: 0, streak: 0, charged: false });
  assert.equal(learningSummary(cast).answered, 3);
  assert.equal(learningSummary(cast).learned, 3);
  assert.deepEqual(roundTrip(cast), cast);
  assert.equal(activateSlimeSkill(cast, cast.encounters.slime), cast);
  assert.equal(activateSlimeSkill(cast, session), cast);
  assert.equal(answer(cast), cast);
});

test('wrong answers reset an unfinished streak but preserve a charged cast without stacking', () => {
  let learning = answer(answer(emptyLearning()));
  learning = answer(learning, false);
  assert.deepEqual(slimeCombat(learning.encounters.slime), { hp: 40, streak: 0, charged: false });
  assert.equal(activateSlimeSkill(learning, learning.encounters.slime), learning);
  learning = answer(answer(answer(emptyLearning())));
  learning = answer(learning, false);
  assert.deepEqual(slimeCombat(learning.encounters.slime), { hp: 20, streak: 3, charged: true });
  assert.deepEqual(roundTrip(learning), learning);
  const cast = activateSlimeSkill(learning, learning.encounters.slime);
  assert.deepEqual(slimeCombat(cast.encounters.slime), { hp: 0, streak: 0, charged: false });
  const retry = createEncounter('slime', cast);
  assert.deepEqual(slimeCombat(retry), { hp: 100, streak: 0, charged: false });
  const retried = recordAnswer(cast, 'slime', retry, 0, encounterQuestion('slime', retry).answerIndex);
  assert.equal(learningSummary(retried).answered, 5);
  assert.equal(slimeCombat(retried.encounters.slime).streak, 1);
});

test('without casting, all answer patterns finish after five answers and cycle the four source words', () => {
  for (let pattern = 0; pattern < 32; pattern++) {
    let learning = emptyLearning();
    const first = encounterQuestion('slime', createEncounter('slime')).word.id;
    for (let i = 0; i < 5; i++) {
      const session = learning.encounters.slime ?? createEncounter('slime');
      if (i === 4) assert.equal(encounterQuestion('slime', session).word.id, first);
      learning = answer(learning, Boolean(pattern & (1 << i)));
      assert.equal(encounterHealth('slime', learning.encounters.slime), 100 - (i + 1) * 20);
    }
    assert.equal(learningSummary(learning).answered, 5);
    assert.equal(learningSummary(learning).learned, 4);
    assert.equal(answer(learning), learning);
    assert.deepEqual(roundTrip(learning), learning);
  }
});

test('old partial saves derive health and charge; old four-answer victories stay complete', () => {
  let learning = answer(answer(answer(emptyLearning())));
  const old = { ...learning.encounters.slime };
  delete old.combat;
  const restore = (session) => readLearning({ getItem: () => JSON.stringify({ version: 1, encounters: { slime: session } }) });
  const partial = restore(old);
  assert.deepEqual(slimeCombat(partial.encounters.slime), { hp: 40, streak: 3, charged: true });
  assert.equal(learningSummary(partial).answered, 3);
  learning = answer(learning);
  const completed = { ...learning.encounters.slime };
  delete completed.combat;
  const restored = restore(completed);
  assert.equal(slimeCombat(restored.encounters.slime).hp, 0);
  assert.equal(learningSummary(restored).answered, 4);
  assert.deepEqual(roundTrip(restored), restored);
});

test('corrupt casts cannot create charges or resume impossible combat histories', () => {
  const learning = answer(answer(answer(emptyLearning())));
  const session = learning.encounters.slime;
  for (const skillUses of [[1], [3, 3], [3, 4], [0], [-1], [6], [1.5], '3']) {
    const raw = { version: 1, encounters: { slime: { ...session, combat: { skillUses } } } };
    assert.deepEqual(readLearning({ getItem: () => JSON.stringify(raw) }), emptyLearning());
  }
  const fourth = answer(learning).encounters.slime;
  assert.equal(slimeCombat({ ...fourth, combat: { skillUses: [3] } }), null);
});

test('other encounters keep their existing progression with integer remaining-health percentages', () => {
  let learning = emptyLearning();
  let session = createEncounter('rescue');
  assert.equal(encounterHealth('rescue', session), 100);
  for (let i = 0; i < 6; i++) {
    learning = recordAnswer(learning, 'rescue', session, i, 0);
    session = learning.encounters.rescue;
    assert.equal(encounterHealth('rescue', session), [84, 67, 50, 34, 17, 0][i]);
    assert.equal(session.combat, undefined);
  }
  assert.equal(createEncounter('signs').wordIds.length, 10);
});
