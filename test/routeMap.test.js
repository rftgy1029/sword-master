import test from 'node:test';
import assert from 'node:assert/strict';
import { gameReducer, emptyProgress, reachableNodes } from '../src/game/engine.js';
import { ENTRANCE_ID, ROUTE_LOOK, routeMapState, routePoint } from '../src/game/routeMap.js';
import { NODE_TYPES } from '../src/game/catalog.js';

const start = (seed = 42) => gameReducer(emptyProgress(), { type: 'START', tier: 'bronze', seed }).run;
const byStatus = (map, status) => map.nodes.filter((node) => node.status === status).map((node) => node.id).sort();

test('every place type has a distinct map look', () => {
  assert.deepEqual(Object.keys(ROUTE_LOOK).sort(), Object.keys(NODE_TYPES).sort());
  const icons = Object.values(ROUTE_LOOK).map((look) => look.icon);
  assert.equal(new Set(icons).size, icons.length, 'each place type uses its own icon');
});

test('a fresh run starts at the entrance and only the engine-reachable rooms glow', () => {
  const run = start();
  const map = routeMapState(run);
  assert.equal(map.here.id, ENTRANCE_ID);
  assert.equal(map.entrance.status, 'current');
  assert.deepEqual(byStatus(map, 'reachable'), reachableNodes(run).map((node) => node.id).sort());
  assert.equal(byStatus(map, 'visited').length, 0);
  assert.ok(map.edges.filter((edge) => edge.status === 'next').every((edge) => edge.from.id === ENTRANCE_ID));
});

test('after moving, traveled paths, missed rooms and closed routes are marked from the real position', () => {
  const run = structuredClone(start());
  // 1층 → 2층 왼쪽 길로 이동한 상태를 직접 만든다. (지도 상태는 저장 값만 읽는다.)
  run.floor = 1; run.lane = 0; run.visited = [run.map[0][0].id, run.map[1].find((n) => n.lane === 0).id];
  const map = routeMapState(run);
  const here = run.map[1].find((n) => n.lane === 0);
  assert.equal(map.here.id, here.id);
  assert.equal(map.nodes.find((n) => n.id === here.id).status, 'current');
  assert.deepEqual(byStatus(map, 'reachable'), reachableNodes(run).map((node) => node.id).sort());
  // 같은 층의 다른 방은 지나친 곳, 왼쪽 끝에서 바로 오른쪽 끝(3층 lane 2)은 갈 수 없다.
  assert.deepEqual(byStatus(map, 'missed'), run.map[1].filter((n) => n.lane !== 0).map((n) => n.id).sort());
  assert.ok(reachableNodes(run).every((n) => n.lane <= 1));
  const traveled = map.edges.filter((edge) => edge.status === 'traveled').map((edge) => edge.id);
  assert.deepEqual(traveled.sort(), [`${ENTRANCE_ID}>${run.map[0][0].id}`, `${run.map[0][0].id}>${here.id}`].sort());
  assert.ok(map.edges.filter((edge) => edge.status === 'next').every((edge) => edge.from.id === here.id));
  assert.ok(map.edges.filter((edge) => edge.from.status === 'missed').every((edge) => edge.status === 'closed'));
  // 보스는 언제나 앞으로 갈 수 있다.
  assert.equal(map.nodes.find((n) => n.type === 'boss').status, 'ahead');
});

test('inspecting during a fight shows the position without selectable rooms', () => {
  const run = start();
  const fighting = gameReducer({ ...emptyProgress(), run }, { type: 'SELECT_NODE', id: reachableNodes(run)[0].id }).run;
  const map = routeMapState(fighting, { inspecting: true });
  assert.equal(byStatus(map, 'reachable').length, 0);
  assert.equal(map.nodes.find((n) => n.id === fighting.visited[0]).status, 'current');
});

test('map points rise from the entrance to the boss in both layouts', () => {
  for (const horizontal of [false, true]) {
    const entrance = routePoint({ floor: -1, lane: 1 }, 8, horizontal);
    const boss = routePoint({ floor: 7, lane: 1 }, 8, horizontal);
    if (horizontal) assert.ok(entrance.x < boss.x); else assert.ok(entrance.y > boss.y);
    for (let floor = -1; floor < 8; floor++) for (let lane = 0; lane < 3; lane++) {
      const p = routePoint({ floor, lane }, 8, horizontal);
      assert.ok(p.x > 0 && p.x < 100 && p.y > 0 && p.y < 100);
    }
  }
});
