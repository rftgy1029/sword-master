import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { heroPart, HERO_ANCHOR } from '../src/game/heroRig.js';

test('edited head and eyes never move with weapon, cloth or legs', () => {
  for (let y = 0; y < 18; y++) for (let x = 0; x < 64; x++) {
    for (const color of [[255, 0, 0], [255, 241, 220], [0, 0, 0], [70, 40, 30]]) assert.equal(heroPart(x, y, ...color), 'body');
  }
  assert.equal(heroPart(52, 20, 240, 231, 212), 'arm', 'Sword tip follows the weapon pivot');
  assert.equal(heroPart(18, 36, 150, 50, 35), 'cape');
  assert.equal(heroPart(27, 56, 90, 65, 45), 'rearLeg');
  assert.equal(heroPart(38, 56, 90, 65, 45), 'frontLeg');
});
test('game uses a 64px transparent PNG traced to the saved Pixelorama source', () => {
  const manifest = JSON.parse(readFileSync(new URL('../assets/sprites/hero-young.json', import.meta.url)));
  const png = readFileSync(new URL('../assets/sprites/hero-young.png', import.meta.url));
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.equal(png.readUInt32BE(16), 64); assert.equal(png.readUInt32BE(20), 64);
  assert.equal(png[25], 6, 'RGBA PNG');
  assert.deepEqual(manifest.anchor, HERO_ANCHOR);
  assert.match(manifest.source, /\.pxo$/);
  assert.equal(manifest.frames, 1, 'Single-pose source is animated by a rig, not advertised as hand-drawn frames');
});
