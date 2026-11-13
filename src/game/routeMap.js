import { reachableNodes } from './engine.js';

// 던전 경로 지도의 표시 상태. 실제 이동 규칙은 engine.js의 reachableNodes가 정하고,
// 여기서는 그 결과를 처음 하는 사람도 읽을 수 있는 상태(지나옴·지금 선택·앞으로 갈 수 있음·닫힘)로 나눈다.
export const ROUTE_LOOK = {
  battle: { icon: 'swords', tone: 'battle', word: 'battle' },
  elite: { icon: 'horns', tone: 'elite', word: 'elite' },
  treasure: { icon: 'chest', tone: 'treasure', word: 'treasure' },
  rest: { icon: 'campfire', tone: 'rest', word: 'rest' },
  forge: { icon: 'anvil', tone: 'forge', word: 'forge' },
  boss: { icon: 'oath', tone: 'boss', word: 'boss' },
};

export const ENTRANCE_ID = 'entrance';
const linked = (a, b) => Math.abs(a.lane - b.lane) <= 1;

export function routeMapState(run, { inspecting = false } = {}) {
  const visited = new Set(run.visited);
  const reachable = new Set(inspecting ? [] : reachableNodes(run).map((node) => node.id));
  const here = run.floor < 0
    ? { id: ENTRANCE_ID, floor: -1, lane: run.lane }
    : run.map[run.floor].find((node) => node.lane === run.lane);
  // 현재 위치에서 앞으로 실제로 도달할 수 있는 곳만 "앞으로 갈 수 있음"으로 둔다.
  const open = new Set([here.id]);
  let frontier = [here];
  for (let floor = run.floor + 1; floor < run.map.length; floor++) {
    frontier = run.map[floor].filter((node) => frontier.some((from) => linked(from, node)));
    frontier.forEach((node) => open.add(node.id));
  }
  const status = (node) => node.id === here.id ? 'current'
    : visited.has(node.id) ? 'visited'
      : reachable.has(node.id) ? 'reachable'
        : node.floor <= run.floor ? 'missed'
          : open.has(node.id) ? 'ahead' : 'closed';
  const nodes = run.map.flat().map((node) => ({ ...node, status: status(node) }));
  const entrance = { id: ENTRANCE_ID, floor: -1, lane: 1, status: run.floor < 0 ? 'current' : 'visited' };
  const edgeStatus = (from, to) => {
    const fromDone = from.id === ENTRANCE_ID || visited.has(from.id);
    if (fromDone && visited.has(to.id)) return 'traveled';
    if (from.id === here.id && reachable.has(to.id)) return 'next';
    if (open.has(from.id) && open.has(to.id)) return 'ahead';
    return 'closed';
  };
  const edges = [];
  for (const to of run.map[0] ?? []) if (linked(entrance, to)) edges.push({ id: `${ENTRANCE_ID}>${to.id}`, from: entrance, to, status: edgeStatus(entrance, to) });
  run.map.slice(0, -1).forEach((row, floor) => row.forEach((from) => run.map[floor + 1].filter((to) => linked(from, to))
    .forEach((to) => edges.push({ id: `${from.id}>${to.id}`, from, to, status: edgeStatus(from, to) }))));
  return { here, entrance, nodes, edges, floors: run.map.length };
}

// 지도 위 좌표(%)를 돌려준다. 세로 지도는 아래(입구)에서 위(보스)로, 가로 지도는 왼쪽에서 오른쪽으로 오른다.
export function routePoint(node, floors, horizontal) {
  const step = node.floor + 1;
  const along = step / floors;
  if (horizontal) return { x: 6 + along * 88, y: 20 + node.lane * 30 };
  return { x: 17 + node.lane * 28, y: 89 - along * 81 };
}
