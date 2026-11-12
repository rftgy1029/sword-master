import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MONSTERS } from '../src/game/catalog.js';
import { monsterAtlas, monsterSheet, monsterFrame, heroImage, heroPoses } from '../src/game/spriteAssets.js';
import { HERO_ART_SIZE, heroPose, createHeroRig, drawHeroRig } from '../src/game/illustratedHero.js';

function webpSize(url) {
  const bytes = readFileSync(new URL(url));
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
  assert.equal(bytes.toString('ascii', 8, 16), 'WEBPVP8X');
  assert.ok(bytes[20] & 0x10, 'Transparent alpha channel is present');
  return { w: bytes.readUIntLE(24, 3) + 1, h: bytes.readUIntLE(27, 3) + 1 };
}

test('every encounter has an in-bounds high resolution transparent illustration', () => {
  const atlas = JSON.parse(readFileSync(new URL(monsterAtlas)));
  const size = webpSize(monsterSheet);
  assert.deepEqual(size, atlas.meta.size);
  assert.deepEqual(Object.keys(atlas.frames).sort(), Object.keys(MONSTERS).sort());
  for (const type of Object.keys(MONSTERS)) {
    const { frame, pivot } = atlas.frames[monsterFrame(type)];
    assert.equal(frame.w, HERO_ART_SIZE);
    assert.equal(frame.h, HERO_ART_SIZE);
    assert.ok(frame.x >= 0 && frame.y >= 0 && frame.x + frame.w <= size.w && frame.y + frame.h <= size.h);
    assert.equal(pivot.x, .5);
    assert.ok(pivot.y > .5 && pivot.y <= 1, 'Each illustration has its own grounded foot / tail anchor');
  }
  assert.equal(monsterFrame('unknown'), 'crawler');
  assert.deepEqual(webpSize(heroImage), { w: HERO_ART_SIZE, h: HERO_ART_SIZE });
  assert.deepEqual(webpSize(heroPoses), { w: HERO_ART_SIZE * 4, h: HERO_ART_SIZE });
});

test('the complete hero painting changes pose without splitting the face or weapon', () => {
  const image = { width: HERO_ART_SIZE * 4, height: HERO_ART_SIZE };
  const rig = createHeroRig(image), draws = [], translations = [];
  const ctx = { save() {}, restore() {}, scale() {}, rotate() {}, translate: (...args) => translations.push(args), drawImage: (...args) => draws.push(args) };
  for (const pose of [{}, { armAngle: -1 }, { armAngle: 1 }, { walking: true }]) {
    drawHeroRig(ctx, rig, { ...pose, x: 60, y: 120, time: 999, motion: false });
    assert.equal(draws.at(-1)[1], heroPose(pose) * HERO_ART_SIZE);
    assert.equal(draws.at(-1)[3], HERO_ART_SIZE);
    assert.equal(ctx.imageSmoothingEnabled, true);
    assert.deepEqual(translations.at(-1), [60, 120], 'Reduced motion keeps the baseline still');
  }
  assert.equal(draws.length, 4, 'One intact illustration per frame');
});
