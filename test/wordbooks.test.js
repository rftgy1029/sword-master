import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyProgress, gameReducer, reachableNodes, unlockedTierIds } from '../src/game/engine.js';
import { groupWrongWords, learningRows, learningStats } from '../src/game/learning.js';
import { QUESTION_BANK, isCorrectAnswer, makeQuestion, questionPool } from '../src/game/quiz.js';
import { validProgress } from '../src/game/storage.js';
import { previewWordbook, readWordbookFile, wordbookColumns } from '../src/game/wordbookImport.js';

const id = 'book-12345678-1234-4123-8123-123456789abc';
const book = (...pairs) => ({ id, name: '내 단어장', words: pairs.map(([term, meaning]) => ({ term, meaning })) });
const action = (progress, type, fields = {}) => gameReducer(progress, { type, ...fields });
const saved = (progress) => {
  const restored = JSON.parse(JSON.stringify(progress));
  assert.ok(validProgress(restored));
  return restored;
};

test('CSV column mapping handles quotes, Korean, duplicates, and missing cells', async () => {
  const file = new File(['\uFEFF영단어,한국어\r\nfit,"맞다, 어울리다"\r\nFIT,"맞다, 어울리다"\r\nrun,\r\n'], 'words.csv');
  const [{ data }] = await readWordbookFile(file);
  const { columns, data: rows, term, meaning } = wordbookColumns(data);
  assert.deepEqual(columns, ['영단어', '한국어']);
  assert.equal(term, 0);
  assert.equal(meaning, -1);
  const preview = previewWordbook(rows, term, 1);
  assert.deepEqual(preview.words, [{ term: 'fit', meaning: '맞다, 어울리다' }]);
  assert.equal(preview.duplicates, 1);
  assert.equal(preview.blank, 1);
});

test('imported quizzes use distinct choices and exclude other meanings of the same word', () => {
  const words = book(['run', '달리다'], ['RUN', '운영하다'], ['fit', '맞다'], ['suit', '맞다']);
  const question = makeQuestion(questionPool(id, [words])[0], () => 0);
  assert.deepEqual(new Set(question.options), new Set(['달리다', '맞다']));
  const typingBook = book(['fit', '맞다'], ['suit', '맞다']);
  const typing = makeQuestion(questionPool(id, [typingBook])[0]);
  assert.equal(typing.mode, 'typing');
  assert.equal(isCorrectAnswer(typing, ' Suit ', [typingBook]), true);
});

test('custom adventure, typed battle answers, and review survive a saved game without school unlocks', () => {
  const initial = emptyProgress();
  const personal = book(['fit', '맞다']);
  let p = saved(action(initial, 'ADD_WORDBOOK', { book: personal }));
  assert.strictEqual(action(p, 'ADD_WORDBOOK', { book: personal }), p);
  p = action(p, 'START', { tier: id, seed: 5 });
  p = action(p, 'SELECT_NODE', { id: reachableNodes(p.run)[0].id });
  p = saved(action(p, 'SELECT_CARD', { uid: p.run.battle.hand[0] }));
  const q = p.run.battle.pending.question;
  assert.equal(q.mode, 'typing');
  p = saved(action(p, 'ANSWER', { id: q.id, answer: 'miss' }));
  for (let i = 0; i < 2; i++) {
    p = action(p, 'REVIEW_START', { id: q.id, seed: 5 });
    p = saved(action(p, 'REVIEW_ANSWER', { id: q.id, answer: 'ＦＩＴ' }));
    p = action(p, 'REVIEW_NEXT', { id: q.id, seed: 6 });
  }
  assert.equal(p.learning.entries[q.id].active, false);
  p = action(p, 'REVIEW_START', { id: q.id, seed: 5 });
  p = saved(action(p, 'REVIEW_ANSWER', { id: q.id, answer: 'miss' }));
  assert.equal(p.learning.entries[q.id].active, true);
  p.run.floor = 7;
  p.run.lane = 1;
  p.run.battle.enemy.hp = 0;
  p = action(p, 'ACK');
  assert.equal(p.learning.bookClears[id], 1);
  assert.deepEqual(p.learning.clears, {});
  assert.deepEqual(p.learning.unlocked, []);
  assert.deepEqual(unlockedTierIds(p), ['bronze']);
});

test('legacy completed mistakes enter a resumable session and report one word across quiz types', () => {
  let p = emptyProgress();
  const meaning = QUESTION_BANK.find((q) => q.word.term === 'complex' && q.type === 'meaning');
  const synonym = QUESTION_BANK.find((q) => q.wordId === meaning.wordId && q.type === 'synonym');
  p.learning.entries[meaning.id] = { attempts: 3, correct: 2, wrong: 1, consecutive: 2, active: false };
  p.learning.entries[synonym.id] = { attempts: 1, correct: 0, wrong: 1, consecutive: 0, active: true };
  p.learning.attempts = 4;
  p.learning.correct = 2;
  p = saved(p);
  const { rows } = learningRows(p, 'bronze');
  assert.deepEqual(learningStats(rows), { studied: 1, attempts: 4, correct: 2, wrong: 2, completed: 1 });
  const grouped = groupWrongWords(rows);
  assert.equal(grouped.length, 1);
  assert.deepEqual(new Set(grouped[0].problems.map(({ status }) => status)), new Set(['복습 필요', '복습 완료']));
  p = saved(action(p, 'REVIEW_START', { ids: [meaning.id, synonym.id], seed: 4 }));
  const first = p.review.question;
  p = saved(action(p, 'REVIEW_ANSWER', { id: first.id, answer: first.options.find((option) => isCorrectAnswer(first, option)) }));
  p = saved(action(p, 'REVIEW_NEXT', { id: meaning.id, seed: 4 }));
  assert.equal(p.review.question.id, synonym.id);
  assert.strictEqual(action(p, 'REVIEW_NEXT', { id: meaning.id, seed: 4 }), p);
});
