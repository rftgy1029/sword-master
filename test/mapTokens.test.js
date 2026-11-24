import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NODE_TYPES } from '../src/game/catalog.js';

// GLB의 JSON 청크에서 노드 이름을 읽는다(Three.js 없이 확인).
function glbNodeNames(path) {
  const buffer = readFileSync(path);
  assert.equal(buffer.toString('ascii', 0, 4), 'glTF');
  const length = buffer.readUInt32LE(12);
  const json = JSON.parse(buffer.toString('utf8', 20, 20 + length));
  return new Set(json.nodes.map((node) => node.name));
}

test('route map miniatures include tower pieces (tile, stair, pillar, sconce, gate) and one token per room type', () => {
  const names = glbNodeNames(new URL('../public/models/map-tokens.glb', import.meta.url));
  for (const name of ['map-tile', 'map-step', 'map-entrance', 'map-stair', 'map-pillar', 'map-sconce']) assert.ok(names.has(name), `${name} missing`);
  for (const type of Object.keys(NODE_TYPES)) assert.ok(names.has(`token-${type}`), `token-${type} missing — regenerate with npm run assets:map`);
});
