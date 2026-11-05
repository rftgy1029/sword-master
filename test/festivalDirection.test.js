import test from 'node:test';
import assert from 'node:assert/strict';
import { FESTIVAL_CUTS, FESTIVAL_PLACES, festivalVisual } from '../src/festivalDirection.js';
import { STORIES, normalizeStoryProgress, firstStoryProgress } from '../src/story.js';

test('every festival dialogue has a directed shot, location and cast without changing saved story positions', () => {
  const ids = new Set();
  for (const scene of STORIES.bronze.scenes.filter(({ id }) => FESTIVAL_CUTS[id])) {
    const cuts = FESTIVAL_CUTS[scene.id];
    assert.equal(cuts[0].from, 0);
    cuts.forEach((cut, index) => {
      assert.ok(cut.from < scene.lines.length);
      assert.ok(index === 0 || cut.from > cuts[index - 1].from);
      assert.ok(FESTIVAL_PLACES[cut.place]);
      assert.equal(ids.has(cut.id), false);
      ids.add(cut.id);
    });
    scene.lines.forEach((line, lineIndex) => {
      const visual = festivalVisual(scene.id, lineIndex, line.speaker);
      assert.ok(visual.title && visual.focus && visual.location);
      assert.ok(visual.cast.includes('용사'));
      const progress = { ...firstStoryProgress('bronze'), sceneId: scene.id, lineIndex };
      assert.deepEqual(normalizeStoryProgress(progress), progress);
    });
  }
  assert.ok(ids.size >= 70);
  assert.equal(festivalVisual('S01C', 0, '용사'), null);
});

test('the welcome sequence shows the bakery, camera, banner and mask rules at their matching dialogue', () => {
  assert.equal(festivalVisual('S02', 9, '내레이션').focus, 'camera');
  assert.equal(festivalVisual('S02', 16, '용사').focus, 'banner');
  assert.equal(festivalVisual('S02', 19, '내레이션').place, 'market');
  assert.equal(festivalVisual('S02', 33, '내레이션').focus, 'board');
  assert.equal(festivalVisual('S02', 3, '용사').focus, '용사');
  assert.equal(festivalVisual('S02', 4, '니아').focus, '니아');
});

test('companions appear and leave with the narrative rather than appearing in every frame', () => {
  for (let i = 0; i < 40; i++) assert.equal(festivalVisual('S02', i, '용사').cast.includes('모모'), false);
  assert.equal(festivalVisual('S04', 38, '모모').cast.includes('니아'), false);
  assert.equal(festivalVisual('S05', 27, '내레이션').cast.includes('니아'), false);
  assert.equal(festivalVisual('S05', 28, '내레이션').cast.includes('니아'), true);
  assert.equal(festivalVisual('S08', 15, '용사').cast.includes('니아'), false);
  assert.equal(festivalVisual('S08', 16, '내레이션').cast.includes('니아'), true);
});

test('the script clues, original recording, student reveal and school destination stay in story order', () => {
  for (const [index, focus] of [[5, 'letter'], [11, 'date'], [12, 'performer'], [16, 'stamp']]) {
    assert.equal(festivalVisual('S05', index, '내레이션').focus, focus);
  }
  assert.equal(festivalVisual('S08', 24, '용사').state, 'original');
  assert.equal(festivalVisual('S08', 25, '내레이션').state, 'altered');
  assert.equal(festivalVisual('S08', 30, '내레이션').state, 'copies');
  assert.equal(festivalVisual('S08', 34, '내레이션').focus, 'mask');
  assert.equal(festivalVisual('S08', 37, '내레이션').focus, 'stamp');
  assert.equal(festivalVisual('S08', 52, '내레이션').place, 'school');
});

test('combat and restoration take place where their objects belong', () => {
  const places = { rescue: 'balloons', signs: 'crossroads', alley: 'alley', backdoor: 'door', props: 'props', ads: 'stage', boss: 'stage' };
  for (const scene of STORIES.bronze.scenes) {
    for (const [index, line] of scene.lines.entries()) {
      if (!places[line.battleId]) continue;
      assert.equal(festivalVisual(scene.id, index, line.speaker).place, places[line.battleId]);
    }
  }
  assert.equal(festivalVisual('S06', 3, '모모').state, 'assembling');
  assert.equal(festivalVisual('S06', 36, '내레이션').state, 'shattered');
  assert.equal(festivalVisual('S06', 41, '내레이션').state, 'paper');
});
