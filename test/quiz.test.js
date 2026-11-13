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

test('every word in the teacher list is quizzed in its own tier and every tier above it', async () => {
  const { default: words } = await import('../src/data/vocabulary.json', { with: { type: 'json' } });
  const ids = new Set(QUESTION_BANK.map((q) => q.wordId));
  assert.equal(words.length, 1000);
  for (const word of words) assert.ok(ids.has(word.id), `${word.term} has no question`);
  for (let index = 0; index < TIERS.length; index++) {
    const pool = new Set(questionPool(TIERS[index].id).map((q) => q.wordId));
    const expected = words.filter((w) => TIERS.findIndex((t) => t.id === w.tier) <= index);
    assert.equal(pool.size, expected.length, `${TIERS[index].label}: ${pool.size}/${expected.length}`);
  }
});

test('automatic meaning choices are stable, distinct, and never another reading of the answer', async () => {
  const { default: words } = await import('../src/data/vocabulary.json', { with: { type: 'json' } });
  const meanings = new Map(words.map((w) => [w.meaning, w]));
  const before = JSON.stringify(QUESTION_BANK.map((q) => q.distractors));
  for (const q of QUESTION_BANK.filter((q) => q.type === 'meaning')) {
    assert.ok(q.distractors.length >= 3, q.word.term);
    assert.equal(new Set(q.distractors).size, q.distractors.length);
    assert.ok(!q.distractors.includes(q.word.meaning), q.word.term);
    for (const d of q.distractors) {
      const other = meanings.get(d);
      if (!other || other.term === q.word.term) continue;
      const related = `${q.word.synonyms},${q.word.antonyms}`.toLowerCase();
      assert.ok(!related.split(/[,①-⑨()]/).map((s) => s.trim()).includes(other.term.toLowerCase()),
        `${q.word.term}: ${other.term} is listed as its synonym/antonym`);
    }
    const multi = /[①-⑨]/.test(q.word.meaning);
    assert.ok(q.distractors.every((d) => /[①-⑨]/.test(d) === multi), `${q.word.term}: numbered senses never stand out among the choices`);
  }
  const fresh = await import(`../src/game/quiz.js?again=${Date.now()}`);
  assert.equal(JSON.stringify(fresh.QUESTION_BANK.map((q) => q.distractors)), before, 'Choices are rebuilt identically, so saved quizzes stay valid');
});
