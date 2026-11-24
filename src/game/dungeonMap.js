// @ts-check
// 던전 경로 지도 생성. 방마다 다음 층으로 이어지는 길(next)을 1~2개만 저장해 "고른 길이 앞날을 정하는" 구조를 만들고,
// 방 배치는 층별 등장 비율로 뽑은 뒤 모든 경로가 학습(전투) 최소량과 위험-보상 규칙을 지키는지 검사한다.
import { shuffle } from './random.js';

/** @typedef {'battle'|'elite'|'treasure'|'rest'|'forge'|'boss'} RoomType */
/** @typedef {{ id: string, floor: number, lane: number, type: RoomType, next?: number[] }} MapNode */
/** @typedef {{ floor: number, lane: number, next?: number[] }} RoutePoint */

export const FLOORS = 8;
const MIDDLE = 1;
const COMBAT = new Set(['battle', 'elite', 'boss']);
const CAMP = new Set(['rest', 'forge']);

/** 입구에서 보스까지 어느 길로 가도 지켜야 하는 최소 전투 수(1층 전투·보스 포함). */
export const MIN_PATH_BATTLES = 5;
/** 한 경로에서 만날 수 있는 보물방 최대 수. */
export const MAX_PATH_TREASURES = 1;
/** 2~6층에 놓을 수 있는 강적 최대 수. */
export const MAX_ELITES = 3;
const MAX_ATTEMPTS = 60;
const FILL_BUDGET = 500;

// 2~6층(인덱스 1~5) 방 등장 비율. 7층(인덱스 6)은 보스 전 쉼터, 1층·8층은 고정.
/** @type {Record<number, Partial<Record<RoomType, number>>>} */
const FLOOR_WEIGHTS = {
  1: { battle: 3, treasure: 1 },
  2: { battle: 3, elite: 1.2, treasure: 1 },
  3: { battle: 2, elite: 1, treasure: 1, rest: 1.2, forge: .6 },
  4: { battle: 2, elite: 1.2, treasure: 1, rest: 1, forge: .6 },
  5: { battle: 2.5, elite: 1.2, treasure: 1 },
};

// 3칸 층 사이에 놓을 수 있는 길(옆 칸까지만). 교차하지 않고, 모든 방이 1~2개로 나가며 모든 방에 길이 들어오는 조합만 쓴다.
const LINKS = [[0, 0], [0, 1], [1, 0], [1, 1], [1, 2], [2, 1], [2, 2]];
const EDGE_WEIGHT = { 3: 1, 4: 3, 5: 2 };
/** @type {{ edges: number[][], weight: number }[]} */
const LINK_SETS = (() => {
  const sets = [];
  for (let mask = 1; mask < 1 << LINKS.length; mask++) {
    const edges = LINKS.filter((_, i) => mask & (1 << i));
    const out = [0, 1, 2].map((lane) => edges.filter(([from]) => from === lane).length);
    const into = [0, 1, 2].map((lane) => edges.filter(([, to]) => to === lane).length);
    const has = (a, b) => edges.some(([from, to]) => from === a && to === b);
    const crossing = (has(0, 1) && has(1, 0)) || (has(1, 2) && has(2, 1));
    const weight = EDGE_WEIGHT[edges.length];
    if (!weight || crossing || out.some((n) => n < 1 || n > 2) || into.some((n) => n < 1)) continue;
    sets.push({ edges, weight });
  }
  return sets;
})();

/**
 * @template T
 * @param {{ value: T, weight: number }[]} entries
 * @param {() => number} next
 * @returns {T}
 */
function weighted(entries, next) {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = next() * total;
  for (const entry of entries) {
    roll -= entry.weight;
    if (roll < 0) return entry.value;
  }
  return entries[entries.length - 1].value;
}

/** @param {number} floor @param {number} lane @param {RoomType} type @returns {MapNode} */
const node = (floor, lane, type) => ({ id: `node-${floor}-${lane}`, floor, lane, type, next: [] });

/**
 * 두 방이 길로 이어져 있는가. 길 정보(next)가 없는 이전 저장은 옛 규칙(옆 칸까지 자유 이동)을 따른다.
 * @param {RoutePoint} from @param {RoutePoint} to
 */
export function routeLinked(from, to) {
  if (to.floor !== from.floor + 1) return false;
  if (Array.isArray(from.next)) return from.next.includes(to.lane);
  return Math.abs(to.lane - from.lane) <= 1;
}

/** 지도에 저장된 길이 있는가(새 지도). @param {MapNode[][]} map */
export const hasStoredRoutes = (map) => map.every((row) => row.every((n) => Array.isArray(n.next)));

/** 1층부터 보스까지 가능한 모든 경로. @param {MapNode[][]} map @returns {MapNode[][]} */
export function mapPaths(map) {
  /** @type {MapNode[][]} */
  const paths = [];
  /** @param {MapNode} current @param {MapNode[]} trail */
  const walk = (current, trail) => {
    const following = map[current.floor + 1]?.filter((n) => routeLinked(current, n)) ?? [];
    if (!following.length) { paths.push(trail); return; }
    for (const n of following) walk(n, [...trail, n]);
  };
  for (const start of map[0] ?? []) walk(start, [start]);
  return paths;
}

/**
 * 규칙을 어긴 항목 목록(빈 배열이면 통과). 테스트와 생성기가 같은 기준을 쓴다.
 * @param {MapNode[][]} map
 */
export function mapRuleProblems(map) {
  const problems = [];
  const middle = map.slice(1, 6).flat();
  const count = (type) => middle.filter((n) => n.type === type).length;
  if (count('treasure') < 2) problems.push('treasure<2');
  if (count('elite') < 2) problems.push('elite<2');
  if (count('elite') > MAX_ELITES) problems.push(`elite>${MAX_ELITES}`);
  if (count('forge') > 1) problems.push('forge>1');
  if (count('rest') > 2) problems.push('rest>2');
  map.slice(1, 6).forEach((row, i) => { if (new Set(row.map((n) => n.type)).size < 2) problems.push(`floor${i + 2}:same`); });
  for (let f = 1; f < map.length; f++) {
    for (const n of map[f]) if (!map[f - 1].some((from) => routeLinked(from, n))) problems.push(`${n.id}:unreachable`);
  }
  for (const path of mapPaths(map)) {
    const label = path.map((n) => n.lane).join('');
    if (path.length !== map.length) { problems.push(`path${label}:short`); continue; }
    const battles = path.filter((n) => COMBAT.has(n.type)).length;
    const treasures = path.filter((n) => n.type === 'treasure').length;
    if (battles < MIN_PATH_BATTLES) problems.push(`path${label}:battles${battles}`);
    if (treasures > MAX_PATH_TREASURES) problems.push(`path${label}:treasures${treasures}`);
    // 보물로 가는 길은 강적이라는 대가를 치르게 한다.
    if (treasures && !path.some((n) => n.type === 'elite')) problems.push(`path${label}:free-treasure`);
    // 휴식·대장간은 연달아 나오지 않는다(보스 전 쉼터 직전 포함).
    if (path.some((n, i) => i > 0 && CAMP.has(n.type) && CAMP.has(path[i - 1].type))) problems.push(`path${label}:camp-chain`);
  }
  return problems;
}

/**
 * 비율에 따라 순서를 섞은 후보(가중 비복원 추출).
 * @param {Partial<Record<RoomType, number>>} weights @param {() => number} next @returns {RoomType[]}
 */
function weightedOrder(weights, next) {
  const pool = Object.entries(weights).map(([value, weight]) => ({ value: /** @type {RoomType} */ (value), weight: Number(weight) }));
  const order = [];
  while (pool.length) {
    const value = weighted(pool, next);
    order.push(value);
    pool.splice(pool.findIndex((entry) => entry.value === value), 1);
  }
  return order;
}

/** 이미 정해진 층을 따라 n까지 오는 모든 경로. @param {MapNode[][]} map @param {MapNode} n @returns {MapNode[][]} */
function pathsTo(map, n) {
  if (n.floor === 0) return [[n]];
  return map[n.floor - 1].filter((from) => routeLinked(from, n)).flatMap((from) => pathsTo(map, from).map((path) => [...path, n]));
}

/**
 * 막 정한 방까지의 부분 경로가 규칙을 어길 가능성이 이미 확정됐는가.
 * @param {MapNode[][]} map @param {MapNode} n
 */
function partialBroken(map, n) {
  const middle = map.slice(1, 6).flat().filter((room) => room.type);
  const placed = (type) => middle.filter((room) => room.type === type).length;
  if (placed('forge') > 1 || placed('rest') > 2 || placed('elite') > MAX_ELITES) return true;
  const row = map[n.floor];
  if (n.lane === row.length - 1 && new Set(row.map((room) => room.type)).size < 2) return true;
  // 2~6층 5개 방 중 전투가 아닌 방은 경로당 최대 (5 - (최소 전투 - 1층 - 보스))개.
  const maxCalm = 5 - (MIN_PATH_BATTLES - 2);
  return pathsTo(map, n).some((path) => {
    const rooms = path.slice(1);
    const treasures = rooms.filter((room) => room.type === 'treasure').length;
    if (treasures > MAX_PATH_TREASURES) return true;
    if (rooms.filter((room) => !COMBAT.has(room.type)).length > maxCalm) return true;
    if (rooms.some((room, i) => i > 0 && CAMP.has(room.type) && CAMP.has(rooms[i - 1].type))) return true;
    if (n.floor === 5 && CAMP.has(n.type)) return true; // 7층 쉼터 바로 앞
    if (n.floor === 5 && treasures && !rooms.some((room) => room.type === 'elite')) return true;
    return false;
  });
}

/** @param {() => number} next @returns {MapNode[][] | null} */
function draftMap(next) {
  /** @type {MapNode[][]} */
  const map = [[node(0, MIDDLE, 'battle')]];
  for (let f = 1; f <= 5; f++) map.push([0, 1, 2].map((lane) => node(f, lane, /** @type {RoomType} */ (/** @type {unknown} */ (null)))));
  map.push(shuffle(/** @type {RoomType[]} */ (['rest', 'forge', 'rest']), next).map((type, lane) => node(6, lane, type)));
  map.push([node(7, MIDDLE, 'boss')]);
  map[0][0].next = [0, 1, 2];
  for (let f = 1; f <= 5; f++) {
    const { edges } = weighted(LINK_SETS.map((set) => ({ value: set, weight: set.weight })), next);
    for (const [from, to] of edges) map[f][from].next?.push(to);
  }
  for (const n of map[6]) n.next = [MIDDLE];

  // 2~6층 방을 순서대로 채우며 규칙 위반이 확정되면 되돌린다(무작위 순서의 백트래킹).
  const rooms = map.slice(1, 6).flat();
  let budget = FILL_BUDGET;
  /** @param {number} index @returns {boolean} */
  const fill = (index) => {
    if (index === rooms.length) return mapRuleProblems(map).length === 0;
    const room = rooms[index];
    for (const type of weightedOrder(FLOOR_WEIGHTS[room.floor], next)) {
      if (--budget < 0) return false;
      room.type = type;
      if (!partialBroken(map, room) && fill(index + 1)) return true;
    }
    room.type = /** @type {RoomType} */ (/** @type {unknown} */ (null));
    return false;
  };
  return fill(0) ? map : null;
}

// 무작위 생성이 계속 실패할 때만 쓰는 검증된 지도(세 갈래 고정 길).
const FALLBACK = [
  ['battle', 'battle', 'treasure'],
  ['elite', 'battle', 'battle'],
  ['treasure', 'rest', 'battle'],
  ['battle', 'battle', 'elite'],
  ['battle', 'elite', 'battle'],
];

/** @returns {MapNode[][]} */
export function fallbackMap() {
  /** @type {MapNode[][]} */
  const map = [[node(0, MIDDLE, 'battle')]];
  FALLBACK.forEach((types, i) => map.push(types.map((type, lane) => ({ ...node(i + 1, lane, /** @type {RoomType} */ (type)), next: [lane] }))));
  map.push(['rest', 'forge', 'rest'].map((type, lane) => ({ ...node(6, lane, /** @type {RoomType} */ (type)), next: [MIDDLE] })));
  map.push([node(7, MIDDLE, 'boss')]);
  map[0][0].next = [0, 1, 2];
  return map;
}

/**
 * 시드 난수로 규칙을 모두 지키는 지도를 만든다(같은 시드 → 같은 지도).
 * @param {() => number} next
 * @returns {MapNode[][]}
 */
export function buildDungeonMap(next) {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const map = draftMap(next);
    if (map) return map;
  }
  return fallbackMap();
}
