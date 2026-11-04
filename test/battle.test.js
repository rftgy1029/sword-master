import test from 'node:test';
import assert from 'node:assert/strict';
import { BRONZE_WORDS, createEncounter, emptyLearning, ENCOUNTERS, getMistakes, LEARNING_KEY, learningSummary, makeQuestion, readLearning, recordAnswer, saveLearning } from '../src/battle.js';
import { dialogueDelay, firstStoryProgress, normalizeStoryProgress, STORIES } from '../src/story.js';

test('seven encounters cover all 64 source words, followed by six distinct review words', () => {
  const sessions = ENCOUNTERS.map(({ id }) => createEncounter(id));
  assert.equal(sessions.reduce((sum, item) => sum + item.wordIds.length, 0), 70);
  assert.deepEqual(new Set(sessions.flatMap(({ wordIds }) => wordIds)), new Set(BRONZE_WORDS.map(({ id }) => id)));
  assert.equal(new Set(sessions.at(-1).wordIds).size, 10);
  assert.deepEqual(sessions.at(-1).wordIds.slice(0, 4), BRONZE_WORDS.slice(60).map(({ id }) => id));
  assert.equal(sessions.at(-1).wordIds.slice(4).every((id) => BRONZE_WORDS.slice(0, 60).some((word) => word.id === id)), true);
});

test('every question uses four distinct source-backed options and excludes relative words from antonym questions', () => {
  const types = new Set();
  for (const encounter of ENCOUNTERS) {
    createEncounter(encounter.id).wordIds.forEach((id, index) => {
      const question = makeQuestion(encounter.id, id, index);
      types.add(question.type);
      assert.equal(question.options.length, 4);
      assert.equal(new Set(question.options).size, 4);
      assert.equal(question.options.filter((option) => option === question.answer).length, 1);
      assert.equal(question.options[question.answerIndex], question.answer);
      assert.equal(BRONZE_WORDS.includes(question.word), true);
      if (question.type === 'antonyms') assert.equal(question.word.antonyms.includes('[상대어]'), false);
      assert.deepEqual(makeQuestion(encounter.id, id, index), question);
    });
  }
  assert.deepEqual([...types].sort(), ['antonyms', 'meaning', 'synonyms']);
});

test('recording an answer cannot double-submit a question or count an invalid choice', () => {
  const initial = emptyLearning();
  const session = createEncounter('rescue');
  const question = makeQuestion('rescue', session.wordIds[0], 0);
  const updated = recordAnswer(initial, 'rescue', session, 0, question.answerIndex);
  assert.deepEqual(initial, emptyLearning());
  assert.equal(updated.encounters.rescue.answers.length, 1);
  assert.equal(recordAnswer(updated, 'rescue', updated.encounters.rescue, 0, question.answerIndex), updated);
  assert.equal(recordAnswer(updated, 'rescue', updated.encounters.rescue, 1, 4), updated);
  assert.equal(learningSummary(updated).answered, 1);
});

test('boss review prioritizes earlier mistakes, and a later correct answer clears the same word/type mistake', () => {
  let learning = emptyLearning();
  const session = createEncounter('rescue');
  const first = makeQuestion('rescue', session.wordIds[0], 0);
  learning = recordAnswer(learning, 'rescue', session, 0, (first.answerIndex + 1) % 4);
  assert.equal(getMistakes(learning)[0].word.id, first.word.id);
  const boss = createEncounter('boss', learning);
  assert.equal(boss.wordIds[4], first.word.id);
  // A correctly answered repeated meaning question supersedes its previous error.
  boss.wordIds[6] = first.word.id;
  boss.wordIds[4] = BRONZE_WORDS[3].id;
  for (let i = 0; i <= 6; i++) {
    const q = makeQuestion('boss', boss.wordIds[i], i);
    learning = recordAnswer(learning, 'boss', i === 0 ? boss : learning.encounters.boss, i, q.answerIndex);
  }
  assert.equal(getMistakes(learning).some(({ word, type }) => word.id === first.word.id && type === 'meaning'), false);
});

test('partial battles resume with the same question order and do not touch story or settings', () => {
  const data = new Map([['sword-master.story-progress.v1', 'story'], ['sword-master.settings.v1', 'settings']]);
  const storage = { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const session = createEncounter('rescue');
  const learning = recordAnswer(emptyLearning(), 'rescue', session, 0, 1);
  assert.equal(saveLearning(learning, storage), true);
  assert.deepEqual(readLearning(storage), learning);
  assert.equal(data.get('sword-master.story-progress.v1'), 'story');
  assert.equal(data.get('sword-master.settings.v1'), 'settings');
  data.set(LEARNING_KEY, JSON.stringify({ version: 1, encounters: { rescue: { wordIds: session.wordIds, answers: [99] } } }));
  assert.deepEqual(readLearning(storage), emptyLearning());
});

test('starting a retry preserves previously learned words and chronological mistake corrections', () => {
  let learning = emptyLearning();
  const session = createEncounter('rescue');
  for (let index = 0; index < 10; index++) {
    const question = makeQuestion('rescue', session.wordIds[index], index);
    learning = recordAnswer(learning, 'rescue', index === 0 ? session : learning.encounters.rescue, index, index === 0 ? (question.answerIndex + 1) % 4 : question.answerIndex);
  }
  assert.equal(learningSummary(learning).learned, 10);
  assert.equal(getMistakes(learning).length, 1);
  const retry = createEncounter('rescue');
  learning = recordAnswer(learning, 'rescue', retry, 0, makeQuestion('rescue', retry.wordIds[0], 0).answerIndex);
  assert.equal(learning.encounters.rescue.answers.length, 1);
  assert.equal(learningSummary(learning).learned, 10);
  assert.equal(learningSummary(learning).answered, 11);
  assert.equal(getMistakes(learning).length, 0);
  const raw = JSON.stringify({ version: 1, ...learning });
  assert.deepEqual(readLearning({ getItem: () => raw }), learning);
});

test('blocked storage and corrupt data recover without creating learning credit', () => {
  const blocked = { getItem() { throw Error('blocked'); }, setItem() { throw Error('full'); } };
  assert.deepEqual(readLearning(blocked), emptyLearning());
  assert.equal(saveLearning(emptyLearning(), blocked), false);
  for (const raw of ['{bad', 'null', '[]', '{"version":99}', '{"version":1,"encounters":{"boss":{}}}']) {
    assert.deepEqual(readLearning({ getItem: () => raw }), emptyLearning());
  }
  assert.equal(learningSummary(emptyLearning()).answered, 0);
});

test('every encounter has one story trigger with setup before it and consequences after it', () => {
  const triggers = STORIES.bronze.scenes.flatMap((scene) => scene.lines.flatMap((line, index) => line.battleId ? [{ id: line.battleId, before: index, after: scene.lines.length - index - 1 }] : []));
  assert.deepEqual(triggers.map(({ id }) => id), ENCOUNTERS.map(({ id }) => id));
  assert.equal(triggers.every(({ before, after }) => before > 0 && after > 0), true);
});

test('old reading positions migrate without losing their line, and automatic timing follows text length', () => {
  const current = firstStoryProgress('bronze');
  assert.deepEqual(normalizeStoryProgress({ ...current, storyId: 'bronze-chapter-01-v1' }), current);
  assert.equal(dialogueDelay({ text: '긴'.repeat(80) }) > dialogueDelay({ text: '짧은 대사' }), true);
  assert.equal(dialogueDelay({ text: '한 줄' }, 1.5) < dialogueDelay({ text: '한 줄' }, 1), true);
});
