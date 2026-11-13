import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyProgress, gameReducer, reachableNodes } from '../src/game/engine.js';
import { questionById } from '../src/game/quiz.js';
import { validProgress } from '../src/game/storage.js';
import { MENU_REACTIONS, MENU_WORDS, matchTyped } from '../src/titleWords.js';
import { highestClearedTier, schoolClearCount, surveyFormUrl, surveyUnlocked } from '../src/survey.js';

const bookId = 'book-12345678-1234-4123-8123-123456789abc';
const SURVEY = MENU_WORDS.indexOf('survey');

// Play one card in the first battle, then resolve the run on the boss floor through the real reducer.
function finishRun(progress, tier, won) {
  let p = gameReducer(progress, { type: 'START', tier, seed: 11 });
  p = gameReducer(p, { type: 'SELECT_NODE', id: reachableNodes(p.run)[0].id });
  p = gameReducer(p, { type: 'SELECT_CARD', uid: p.run.battle.hand.find((uid) => p.run.deck.find((c) => c.uid === uid).type !== 'flow') });
  const q = p.run.battle.pending.question;
  const source = questionById(q.id, p.wordbooks ?? []);
  const answer = q.mode === 'typing' ? source.answers[0] : q.options.find((s) => source.answers.includes(s));
  p = gameReducer(p, { type: 'ANSWER', id: q.id, answer });
  if (won) {
    p.run.floor = 7;
    p.run.lane = 1;
    p.run.visited = p.run.map.slice(0, 8).map((row) => row.find((n) => n.lane === 1)?.id ?? row[0].id);
    p.run.battle.enemy.hp = 0;
    return gameReducer(p, { type: 'ACK' });
  }
  p = gameReducer(p, { type: 'ACK' });
  p.run.hp = 1;
  p.run.battle.block = 0;
  Object.assign(p.run.battle.enemy, { type: 'crawler', step: 0, weak: 0 });
  return gameReducer(p, { type: 'END_TURN' });
}

test('the survey stays hidden until a school tier boss is beaten, then opens for good', () => {
  let p = emptyProgress();
  assert.equal(surveyUnlocked(p), false);
  p = finishRun(p, 'bronze', false);
  assert.equal(p.run.result.won, false);
  assert.equal(surveyUnlocked(p), false, 'A defeat does not open the survey');
  p = finishRun(p, 'bronze', true);
  assert.equal(p.run.result.won, true);
  assert.equal(surveyUnlocked(p), true);
  assert.equal(schoolClearCount(p), 1, 'The result screen shows the survey notice only on the first school clear');
  assert.equal(highestClearedTier(p).id, 'bronze');
  const restored = JSON.parse(JSON.stringify(p));
  assert.ok(validProgress(restored), 'No new saved fields: older saves keep loading');
  assert.equal(surveyUnlocked(restored), true, 'The unlock survives a reload because it reads the existing clear record');
  p = finishRun(p, 'bronze', true);
  assert.equal(schoolClearCount(p), 2);
});

test('personal wordbook clears do not count as passing Bronze', () => {
  let p = gameReducer(emptyProgress(), { type: 'ADD_WORDBOOK', book: { id: bookId, name: '내 단어장', words: [{ term: 'fit', meaning: '맞다' }] } });
  p = finishRun(p, bookId, true);
  assert.equal(p.learning.bookClears[bookId], 1);
  assert.equal(surveyUnlocked(p), false);
  assert.equal(highestClearedTier(p), null);
});

test('legacy saves that only record a higher tier clear still see the survey', () => {
  const p = emptyProgress();
  p.learning.clears.gold = 1;
  assert.equal(surveyUnlocked(p), true);
  assert.equal(highestClearedTier(p).label, '골드');
  assert.equal(surveyUnlocked({}), false, 'A missing or broken record never throws');
});

test('only https Google Forms addresses become a link', () => {
  assert.equal(surveyFormUrl(''), null);
  assert.equal(surveyFormUrl('   '), null);
  assert.equal(surveyFormUrl(undefined), null);
  assert.equal(surveyFormUrl('https://forms.gle/AbCdEf123'), 'https://forms.gle/AbCdEf123');
  assert.equal(surveyFormUrl(' https://docs.google.com/forms/d/e/1FAIpQLSf/viewform?usp=sf_link '),
    'https://docs.google.com/forms/d/e/1FAIpQLSf/viewform?usp=sf_link');
  for (const bad of ['http://forms.gle/AbCdEf123', 'https://forms.gle/', 'https://docs.google.com/document/d/1/edit',
    'https://forms.gle.example.com/x', 'https://user:pw@forms.gle/x', 'javascript:alert(1)', 'forms.gle/AbCdEf123']) {
    assert.equal(surveyFormUrl(bad), null, bad);
  }
});

test('the survey menu word is typed like the others but only chosen once enabled', () => {
  assert.equal(MENU_WORDS.length, MENU_REACTIONS.length);
  const locked = MENU_WORDS.map((_, i) => i !== SURVEY);
  const open = MENU_WORDS.map(() => true);
  assert.deepEqual(matchTyped('survey', locked), { index: -1, complete: false, valid: true });
  assert.deepEqual(matchTyped('survey', open), { index: SURVEY, complete: true, valid: true });
  assert.equal(matchTyped('s', open).index, 0, 'A bare "s" still points at start');
  assert.equal(matchTyped('se', open).index, MENU_WORDS.indexOf('settings'));
  assert.equal(matchTyped('su', open).index, SURVEY);
});
