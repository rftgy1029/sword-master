import test from 'node:test';
import assert from 'node:assert/strict';
import { firstStoryProgress, moveStory, normalizeStoryProgress, readStoryProgress, saveStoryProgress, STORIES, STORY_PROGRESS_KEY } from '../src/story.js';

test('the full chapter is reachable in source order, including its ending', () => {
  const story = STORIES.bronze;
  assert.deepEqual(story.scenes.map(({ id }) => id), ['S01', 'S02', 'S03', 'S04', 'S05', 'S06', 'S07', 'S08']);
  const expected = story.scenes.flatMap((scene) => scene.lines.map((line, lineIndex) => ({ sceneId: scene.id, lineIndex, text: line.text })));
  let progress = firstStoryProgress('bronze');
  const visited = [];
  while (!progress.completed && visited.length <= expected.length) {
    const scene = story.scenes.find(({ id }) => id === progress.sceneId);
    visited.push({ sceneId: scene.id, lineIndex: progress.lineIndex, text: scene.lines[progress.lineIndex].text });
    progress = moveStory(progress, 1);
  }
  assert.deepEqual(visited, expected);
  assert.equal(progress.completed, true);
  assert.match(expected.at(-1).text, /팔레트 마법학교/);
  assert.equal(expected.some(({ text }) => /문서 상태|장면 목표|세트 7|개발 메모|스토리 데이터 구조/.test(text)), false);
});

test('previous and next cross scene boundaries without losing or repeating a line', () => {
  const story = STORIES.bronze;
  const first = firstStoryProgress('bronze');
  assert.deepEqual(moveStory(first, -1), first);
  for (let index = 1; index < story.scenes.length; index++) {
    const start = { ...first, sceneId: story.scenes[index].id };
    const previous = moveStory(start, -1);
    assert.equal(previous.sceneId, story.scenes[index - 1].id);
    assert.equal(previous.lineIndex, story.scenes[index - 1].lines.length - 1);
    assert.deepEqual(moveStory(previous, 1), start);
  }
  const last = { ...first, sceneId: story.scenes.at(-1).id, lineIndex: story.scenes.at(-1).lines.length - 1 };
  assert.deepEqual(moveStory(moveStory(last, 1), -1), last);
});

test('reading position round-trips separately from settings and learning records', () => {
  const data = new Map([['sword-master.settings.v1', 'keep settings'], ['sword-master.progress', 'keep learning']]);
  const storage = { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const progress = { ...firstStoryProgress('bronze'), sceneId: 'S06', lineIndex: 12 };
  assert.equal(saveStoryProgress(progress, storage), true);
  assert.deepEqual(readStoryProgress(storage), progress);
  assert.equal(data.get('sword-master.settings.v1'), 'keep settings');
  assert.equal(data.get('sword-master.progress'), 'keep learning');
  assert.equal(JSON.parse(data.get(STORY_PROGRESS_KEY)).version, 1);
});

test('corrupt, obsolete, unknown-tier and out-of-range positions safely recover', () => {
  const first = firstStoryProgress('bronze');
  for (const value of [null, {}, { ...first, tier: 'silver' }, { ...first, tier: 'toString', storyId: undefined },
    { ...first, storyId: 'obsolete' }, { ...first, sceneId: 'S99' }, { ...first, lineIndex: -1 },
    { ...first, lineIndex: .5 }, { ...first, lineIndex: 999 }, { ...first, lineIndex: '1' }]) {
    assert.equal(normalizeStoryProgress(value), null);
  }
  for (const raw of [null, '{broken', 'null', '[]', JSON.stringify({ version: 2, progress: first })]) {
    assert.equal(readStoryProgress({ getItem: () => raw }), null);
  }
  assert.equal(normalizeStoryProgress({ ...first, completed: true }).completed, false);
  assert.equal(firstStoryProgress('silver'), null);
  assert.equal(firstStoryProgress('toString'), null);
});

test('blocked storage does not stop story navigation or report a successful save', () => {
  const storage = { getItem() { throw Error('blocked'); }, setItem() { throw Error('full'); } };
  assert.equal(readStoryProgress(storage), null);
  const progress = moveStory(firstStoryProgress('bronze'), 1);
  assert.equal(saveStoryProgress(progress, storage), false);
  assert.equal(moveStory(progress, 1).lineIndex, 2);
});
