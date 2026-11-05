import test from 'node:test';
import assert from 'node:assert/strict';
import { QUESTION_BANK, isCorrectAnswer, makeQuestion, nextQuestion, questionPool } from '../src/game/quiz.js';
import { random } from '../src/game/random.js';
import { TIERS } from '../src/vocabulary.js';

test('reviewed quiz bank has one correct option, unique choices and safe source relations', () => {
  const state = { rng: 1234 };
  for (const template of QUESTION_BANK) {
    for (let n = 0; n < 8; n++) {
      const q = makeQuestion(template, () => random(state));
      assert.equal(new Set(q.options).size, 4);
      assert.equal(q.options.filter((s) => isCorrectAnswer(q, s)).length, 1);
    }
    if (template.type === 'antonym') assert.ok(!template.word.antonyms.includes('[상대어]'));
    if (template.type !== 'meaning') assert.ok(!/[①-⑨]/.test(template.word.synonyms + template.word.antonyms));
    for (const answer of template.answers) assert.ok(isCorrectAnswer({ id: template.id }, `  ${answer.toUpperCase()}  `));
  }
});

test('every tier supports all three types and excludes words above its cumulative range', () => {
  for (let index = 0; index < TIERS.length; index++) {
    const pool = questionPool(TIERS[index].id);
    assert.deepEqual([...new Set(pool.map((q) => q.type))].sort(), ['antonym', 'meaning', 'synonym']);
    assert.ok(pool.every((q) => TIERS.findIndex((t) => t.id === q.word.tier) <= index));
  }
  assert.equal(questionPool('invalid').length, 0);
});

test('a battle uses every validated word/type before recycling and handles no valid data safely', () => {
  const used = [];
  const state = { rng: 77 };
  for (let n = 0; n < questionPool('bronze').length; n++) {
    const q = nextQuestion('bronze', used, () => random(state));
    assert.equal(q.recycled, false);
    assert.ok(!used.includes(q.id));
    used.push(q.id);
  }
  assert.equal(nextQuestion('bronze', used, () => random(state)).recycled, true);
  assert.equal(nextQuestion('invalid', [], () => random(state)), null);
});
