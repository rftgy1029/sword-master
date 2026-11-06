import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MONSTERS } from '../src/game/catalog.js';
import { battleMapForMonster, battleMaps, titleMap } from '../src/game/mapAssets.js';

function readMap(asset) {
  return JSON.parse(readFileSync(new URL(asset.mapUrl), 'utf8'));
}

test('every monster selects a known map and all three battle backgrounds are used', () => {
  const selected = new Set(Object.keys(MONSTERS).map((type) => battleMapForMonster(type)));
  assert.deepEqual(selected, new Set(Object.values(battleMaps)));
  assert.equal(battleMapForMonster('unknown'), battleMaps.hall);
});

test('Tiled maps contain the tileset and layers used by Phaser', () => {
  for (const [asset, layers, width, height] of [
    [titleMap, ['Walls and floor', 'Entrance and torches'], 24, 18],
    ...Object.values(battleMaps).map((asset) => [asset, ['Masonry and floor', 'Architecture and lights'], 24, 14]),
  ]) {
    const map = readMap(asset);
    assert.equal(map.tilesets[0].name, asset.name);
    assert.equal(map.width, width);
    assert.equal(map.height, height);
    assert.deepEqual(map.layers.filter((layer) => layer.type === 'tilelayer').map((layer) => layer.name), layers);
    assert.ok(readFileSync(new URL(asset.imageUrl)).length > 0);
    for (const layer of map.layers.filter((item) => item.type === 'tilelayer')) {
      assert.equal(layer.data.length, width * height);
      assert.ok(layer.data.every((id) => Number.isInteger(id) && id >= 0 && id <= map.tilesets[0].tilecount));
    }
  }
});
