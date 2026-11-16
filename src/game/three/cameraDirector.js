// 전투 카메라 감독: 지금 재생 중인 연출(plan·elapsed)을 보고 카메라가 어디서 무엇을 볼지 정한다.
// 연출 시간표만 읽고 게임 상태는 바꾸지 않는다. three.js 없이 계산만 하므로 자동 검사에서 그대로 확인할 수 있다.
//
// - 각 장면(shot)은 기본 구도에서 잠깐 옮겨 가는 목표 구도다. 연출이 시작되면 부드럽게 다가가고,
//   연출 시간표가 끝나는 순간 정확히 기본 구도로 돌아와 있도록 시간표 안에서 들어가고 나온다.
// - 용사의 카드는 cardMotions.js의 camera 키를 따라 카드마다 다른 순서로 움직인다(카드 트랙).
//   키가 없는 카드만 역할(근접·원거리·자기 강화·약화)에 맞는 장면 하나를 쓴다.
// - 퀴즈를 푸는 동안·움직임 줄이기/끄기에서는 장면 전환과 미세한 흔들림 없이 기본 구도를 지킨다.
import { BATTLE_VIEWS, DEFAULT_BATTLE_VIEW, battleFov, cameraPosition, fitView } from './battleCamera.js';

const area = (x0, x1, y1 = 3) => Object.freeze({ x: [x0, x1], y: [0, y1] });

/**
 * 상황별 장면. yaw·pitch는 기본 구도와 같은 뜻(도), focus는 화면 가운데, box는 화면 안에 담을 영역이다.
 * 영역만 정하고 거리는 화면 비율에 맞춰 계산하므로 PC 가로 띠와 휴대폰에서 모두 잘리지 않는다.
 * box는 캐릭터 몸 폭(기사는 중심에서 양옆 약 0.8)까지 담도록 잡는다.
 * 위의 다섯(melee~curse)은 카메라 키가 없는 카드를 위한 예비 장면이고, 나머지는 적의 차례·처치·쓰러짐에 쓴다.
 */
export const CAMERA_SHOTS = Object.freeze({
  // 용사가 달려가 베기: 옆으로 돌아 들어가며 접촉 지점을 당겨 본다.
  melee: { yaw: -12, pitch: 9, focus: [.6, 1.3, 0], margin: .9, box: area(-3.3, 3.2, 2.7) },
  // 강공격(균열 베기): 조금 더 높이 올라가 내려찍는 방향이 보이게 한다.
  slam: { yaw: -18, pitch: 17, focus: [.6, 1.2, 0], margin: .9, box: area(-3.3, 3.2, 2.7) },
  // 원거리 기술: 용사 어깨 너머로 돌아 투사체가 날아가는 깊이를 보여 준다.
  ranged: { yaw: -34, pitch: 9, focus: [.4, 1.3, 0], margin: .9, box: area(-3.1, 3.1) },
  // 회복·방어·집중 같은 자기 강화: 정면에 가까운 안정된 구도로 용사를 담는다.
  self: { yaw: -10, pitch: 9, focus: [-.9, 1.2, 0], margin: .9, box: area(-3.5, 3.1, 2.9) },
  // 적에게 거는 약화: 적 쪽으로 시선을 옮긴다.
  curse: { yaw: -18, pitch: 10, focus: [.6, 1.35, 0], margin: .92, box: area(-3.3, 3.5, 2.9) },
  // 적의 공격: 낮게 내려와 조금 당겨, 달려드는 적이 커 보이게 한다.
  assault: { yaw: -8, pitch: 3, focus: [.2, 1.35, 0], margin: .94, box: area(-3.5, 3.2, 2.7) },
  // 적의 강타 준비: 적 발치에서 올려다보아 다음 공격의 위압감을 쌓는다.
  windup: { yaw: -12, pitch: -3, focus: [.5, 1.8, 0], margin: .95, box: area(-3.4, 3.5, 2.9) },
  // 적의 방어·강화: 적 쪽으로 가볍게 시선을 옮긴다.
  stance: { yaw: -16, pitch: 10, focus: [.6, 1.35, 0], margin: .92, box: area(-3.3, 3.5, 2.9) },
  // 처치: 옆으로 크게 돌아 무너지는 적을 가까이 본다.
  finish: { yaw: -40, pitch: 7, focus: [1, 1.3, 0], margin: .92, box: area(-3.2, 3.7, 2.9) },
  // 용사가 쓰러짐: 용사를 내려다본다.
  fallen: { yaw: -20, pitch: 15, focus: [-2.1, 1, 0], margin: .9, box: area(-3.7, -.6, 2.4) },
});

/**
 * 카드 트랙에서 쓰는 장면. 뜻은 CAMERA_SHOTS와 같고, lens는 기본 렌즈(화면 비율에 맞춘 시야각)에 곱하는 배율이다.
 * 1보다 작으면 좁은 렌즈로 멀리서 당겨 찍어 배경이 눌려 보이고, 크면 가까이서 넓게 보인다.
 * 넓은 렌즈도 가로 시야각 상한(MAX_HORIZONTAL_FOV)은 넘지 않는다.
 * 어느 장면이든 그 시점에 두 캐릭터가 서 있는 자리가 화면 안에 들어오도록 box를 잡는다.
 */
export const CARD_SHOTS = Object.freeze({
  // 근접 공통: 달려 나가는 용사를 따라 앞으로 시선을 옮긴다.
  lunge: { yaw: -16, pitch: 8, focus: [.3, 1.2, 0], margin: .9, box: area(-3, 3.2, 2.7) },
  // 기본 베기: 칼이 닿는 순간 옆으로 돌아 접촉 지점을 당겨 본다.
  contact: { yaw: -8, pitch: 6, focus: [1.2, 1.2, 0], margin: .93, box: area(-.9, 3.4, 2.6) },
  // 균열 베기: 검을 치켜들고 웅크리는 용사를 낮은 곳에서 올려다본다 → 도약을 따라 올라간다 → 바닥을 내려찍는 순간 위에서 본다.
  gather: { yaw: -18, pitch: 1, focus: [-.3, 1.5, 0], margin: .9, box: area(-3, 3.2, 3.1) },
  leap: { yaw: -16, pitch: 13, focus: [.5, 1.7, 0], margin: .9, box: area(-2.6, 3.2, 3.5) },
  quake: { yaw: -14, pitch: 23, focus: [1.1, .9, 0], margin: .92, box: area(-.9, 3.4, 2.4) },
  // 쌍월: 올려 베기는 낮은 앞쪽에서, 내려 베기는 높은 뒤쪽에서 본다. 두 타격 사이에 카메라가 칼을 따라 넘어간다.
  rise: { yaw: -4, pitch: 3, focus: [1.2, 1.35, 0], margin: .93, box: area(-.9, 3.4, 2.8) },
  fall: { yaw: -24, pitch: 16, focus: [1.2, 1.1, 0], margin: .93, box: area(-.9, 3.4, 2.6) },
  // 잿빛 파동: 용사 어깨 너머로 겨눴다가, 날아가는 검기를 따라 적 쪽으로 돈다.
  aim: { yaw: -36, pitch: 8, focus: [-.5, 1.35, 0], margin: .9, box: area(-3.1, 3.2, 2.8) },
  wave: { yaw: -18, pitch: 7, focus: [.8, 1.3, 0], margin: .92, box: area(-3.2, 3.4, 2.8) },
  // 새벽의 낙인: 하늘로 든 검을 앞쪽 아래에서 올려다보고 → 정적의 순간 좁은 렌즈로 당겨 멈췄다가 → 터진 뒤 넓은 렌즈로 높이 물러난다.
  call: { yaw: -6, pitch: -2, focus: [-.6, 1.8, 0], margin: .9, box: area(-3, 3.1, 3.3) },
  hush: { yaw: 0, pitch: 2, focus: [-.4, 1.7, 0], margin: .9, box: area(-2.9, 3, 3.1), lens: .78 },
  radiance: { yaw: -18, pitch: 18, focus: [.7, 1.4, 0], margin: .9, box: area(-3.3, 3.6, 3.6), lens: 1.15 },
  // 돌의 자세: 낮은 정면에서 버티는 용사를 성벽처럼 담는다.
  bulwark: { yaw: -8, pitch: 3, focus: [-.7, 1.2, 0], margin: .9, box: area(-3.3, 3, 2.8) },
  // 이슬의 숨: 땅에 검을 댄 용사를 가까이 보다가, 고개를 드는 순간 함께 올라간다.
  bloom: { yaw: -12, pitch: 7, focus: [-.9, 1, 0], margin: .9, box: area(-3.4, 2.9, 2.6) },
  uplift: { yaw: -14, pitch: 18, focus: [-.8, 1.6, 0], margin: .9, box: area(-3.4, 2.9, 3.2) },
  // 불씨 벼리기: 웅크린 용사에게 낮게 다가갔다가, 몸을 펴는 순간 위로 물러난다.
  coil: { yaw: -12, pitch: 2, focus: [-1, 1.1, 0], margin: .94, box: area(-3.3, 2.9, 2.6) },
  surge: { yaw: -18, pitch: 10, focus: [-.6, 1.6, 0], margin: .9, box: area(-3.3, 3.1, 3.3) },
  // 녹슨 봉인: 뻗은 손 너머로 적을 겨눴다가, 봉인이 잠기는 순간 적 쪽으로 다가간다.
  cast: { yaw: -34, pitch: 9, focus: [.2, 1.3, 0], margin: .9, box: area(-3.1, 3.3, 2.8) },
  bind: { yaw: -14, pitch: 12, focus: [.8, 1.3, 0], margin: .92, box: area(-3.2, 3.5, 2.9) },
  // 고요한 응시: 기본 구도와 같은 영역을 좁은 렌즈로 멀리서 담는다. 용사 크기는 그대로인 채 배경만 다가온다(돌리 줌).
  still: { yaw: -18, pitch: 10, focus: [.5, 1.3, 0], margin: .9, box: area(-3.1, 3.1, 3.3), lens: .72 },
  // 바람의 손: 한 바퀴 도는 용사를 따라 앞쪽으로 돈다.
  whirl: { yaw: -4, pitch: 14, focus: [-.8, 1.2, 0], margin: .9, box: area(-3.3, 3, 2.7) },
  // 불멸의 서약: 무릎 꿇은 용사를 위에서 내려다보다가, 일어나 검을 드는 순간 아래에서 왕관까지 올려다본다.
  kneel: { yaw: -14, pitch: 20, focus: [-1, 1, 0], margin: .9, box: area(-3.3, 3, 2.6) },
  crown: { yaw: -10, pitch: 0, focus: [-.9, 1.9, 0], margin: .9, box: area(-3.3, 3, 3.4) },
});

const ALL_SHOTS = Object.freeze({ ...CAMERA_SHOTS, ...CARD_SHOTS });

/** 용사 체력이 이 비율 이하이면 기본 구도를 조금 낮고 가깝게 잡아 위기감을 준다. */
export const LOW_HEALTH = .3;

/** 장면으로 들어가는 시간·돌아오는 시간(ms). 시간표가 짧으면 둘을 같은 비율로 줄인다. */
export const SHOT_EASE = Object.freeze({ in: 280, out: 420 });
/** 대기 중 아주 느린 흔들림(도). 퀴즈 중과 움직임 줄이기에서는 쓰지 않는다. */
export const IDLE_SWAY = Object.freeze({ yaw: 1.1, pitch: .45, yawPeriod: 11, pitchPeriod: 7.3 });

const clamp01 = value => Math.max(0, Math.min(1, value));
const smooth = value => { const t = clamp01(value); return t * t * (3 - 2 * t); };

function cue(shot, strength, start, end, extra = {}) {
  let rampIn = extra.in ?? SHOT_EASE.in, rampOut = extra.out ?? SHOT_EASE.out;
  const span = Math.max(1, end - start);
  if (rampIn + rampOut > span) { const scale = span / (rampIn + rampOut); rampIn *= scale; rampOut *= scale; }
  return { shot, strength, start, end, in: rampIn, out: rampOut, override: !!extra.override };
}

/** 카드 키의 시점 이름을 ms로 바꾼다. */
export function cameraKeyTime(recipe, at) {
  if (typeof at === 'number') return at;
  if (at === 'hit') return recipe.hits?.[0];
  if (at === 'hit2') return recipe.hits?.[1];
  if (at === 'moment') return recipe.moment;
  return recipe.marks?.[at];
}

/**
 * 카드의 camera 키를 시간표 위의 트랙으로 만든다. 0ms와 카드 길이에 기본 구도(shot: null)를 넣는다.
 * hold를 주면(처치한 타격) 트랙은 그 시점의 구도에 멈추고, 처치 장면이 들어오는 만큼 비켜 준다.
 */
function cardTrack(recipe, hold) {
  const keys = [{ at: 0, shot: null, strength: 0 }];
  for (const [at, shot, strength = 1] of recipe.camera) keys.push({ at: cameraKeyTime(recipe, at), shot, strength });
  keys.push({ at: recipe.duration, shot: null, strength: 0 });
  return { shot: 'track', track: true, keys, start: 0, end: recipe.duration, hold, strength: Math.max(...keys.map(key => key.strength)), override: false };
}

const strengthOf = (plan) => Math.min(1, .25 + .4 * Math.max(1, ...(plan.powers ?? [])));

const cueCache = new WeakMap();
/**
 * 한 연출에 쓸 장면 목록. 같은 plan에는 같은 목록을 돌려준다.
 * 일반 장면은 {shot, strength, start, end, in, out, override}, 카드 트랙은 {track: true, keys: [{at, shot, strength}], ...}이다.
 */
export function cameraCues(plan) {
  if (!plan || plan.calm) return [];
  if (cueCache.has(plan)) return cueCache.get(plan);
  const cues = [], end = plan.duration;
  if (plan.side === 'hero') {
    if (plan.kind === 'miss') { /* 틀린 답의 헛손질은 카메라를 움직이지 않는다 */ }
    else if (plan.recipe?.camera) cues.push(cardTrack(plan.recipe, plan.lethal ? plan.killAt : undefined));
    else if (plan.role === 'melee' && plan.hits.length) cues.push(cue(plan.style === 'fracture' ? 'slam' : 'melee', strengthOf(plan), 0, end));
    else if (plan.role === 'ranged' && plan.hits.length) cues.push(cue('ranged', strengthOf(plan), 0, end));
    else if (plan.role === 'curse') cues.push(cue('curse', .5, 0, end));
    else cues.push(cue('self', .55, 0, end));
    // 처치 장면: 카드 트랙이 멈춘 구도에서 크게 돌아 들어가므로 조금 길게 들어간다.
    if (plan.lethal) cues.push(cue('finish', 1, Math.max(0, plan.killAt - 60), end, { in: 460, out: 420, override: true }));
  } else if (plan.kind === 'hurt') {
    cues.push(cue('assault', plan.heavy || plan.fatal ? 1 : .55, 0, end));
    if (plan.fatal) cues.push(cue('fallen', .9, plan.downAt, end, { in: 360, out: 420, override: true }));
  } else {
    const charge = plan.action === 'charge';
    cues.push(cue(charge ? 'windup' : 'stance', charge ? 1 : .35, 0, end));
  }
  cueCache.set(plan, cues);
  return cues;
}

/** 시간표의 elapsed 시점에서 장면의 세기(0~1). 시작과 끝에서 0이다. 카드 트랙은 trackSpan을 쓴다. */
export function cueWeight(item, elapsed) {
  if (elapsed <= item.start || elapsed >= item.end) return 0;
  return item.strength * smooth((elapsed - item.start) / item.in) * smooth((item.end - elapsed) / item.out);
}

/** 장면이 들어온 정도(0~1). 나가는 구간을 빼고 계산하므로, 한 번 다 들어오면 끝까지 1이다. */
const arrival = (item, elapsed) => elapsed <= item.start ? 0 : smooth((elapsed - item.start) / item.in);

/**
 * 카드 트랙에서 elapsed가 속한 두 키와 둘 사이의 진행(0~1, 부드럽게). out을 다시 쓴다.
 * 이웃한 두 키의 장면을 (1-u)·u 비율로 섞으므로 키 사이에서 기본 구도로 되돌아가지 않고 곧장 넘어간다.
 */
export function trackSpan(item, elapsed, out = { from: null, to: null, u: 0 }) {
  const keys = item.keys;
  let index = 1;
  while (index < keys.length - 1 && keys[index].at <= elapsed) index++;
  const from = keys[index - 1], to = keys[index];
  out.from = from; out.to = to;
  out.u = elapsed <= from.at ? 0 : elapsed >= to.at ? 1 : smooth((elapsed - from.at) / (to.at - from.at));
  return out;
}
const span = { from: null, to: null, u: 0 };

export const createCameraPose = () => ({ yaw: 0, pitch: 0, distance: 0, target: [0, 0, 0], fov: 0 });

function copyPose(into, from) {
  into.yaw = from.yaw; into.pitch = from.pitch; into.distance = from.distance; into.fov = from.fov;
  into.target[0] = from.target[0]; into.target[1] = from.target[1]; into.target[2] = from.target[2];
  return into;
}

/**
 * 카메라가 물러날 수 있는 한계(장면 z). 전투 바닥은 z=20까지 깔려 있어, 그보다 앞으로 나가면 화면 아래에 빈 곳이 보인다.
 * 세로로 긴 휴대폰 화면은 기본 구도부터 멀리 있으므로, 좁은 렌즈 장면은 이 한계 안에서 렌즈를 덜 좁힌다.
 */
export const MAX_CAMERA_Z = 18;

/** 장면을 화면 비율에 맞춘 구도. lens가 있는 장면은 그 렌즈로 거리를 다시 맞춘다. */
export function fitShot(shot, aspect) {
  const base = battleFov(aspect), at = lens => fitView(shot, aspect, shot.box, base * lens);
  const fit = at(shot.lens ?? 1);
  if (!(shot.lens < 1) || cameraPosition(fit)[2] <= MAX_CAMERA_Z) return fit;
  // 한계 안에 드는 가장 좁은 렌즈를 찾는다.
  let narrow = shot.lens, wide = 1;
  for (let step = 0; step < 16; step++) {
    const lens = (narrow + wide) / 2;
    if (cameraPosition(at(lens))[2] > MAX_CAMERA_Z) narrow = lens; else wide = lens;
  }
  return at(wide);
}

// 화면 비율이 바뀔 때만 다시 맞추는 구도 저장소. 프레임마다 새 객체를 만들지 않는다.
const fits = { aspect: 0, view: null, rest: null, danger: null, shots: {} };
function fitted(aspect, viewId) {
  if (fits.aspect !== aspect || fits.view !== viewId) {
    const view = BATTLE_VIEWS[viewId] ?? BATTLE_VIEWS[DEFAULT_BATTLE_VIEW];
    fits.aspect = aspect; fits.view = viewId;
    fits.rest = fitView(view, aspect);
    // 체력이 낮을 때: 조금 낮고 가깝게 잡아 위기감을 준다.
    fits.danger = fitView({ ...view, pitch: view.pitch - 4, margin: Math.min(.98, view.margin + .06), focus: [view.focus[0], view.focus[1] - .1, view.focus[2]] }, aspect);
    fits.shots = Object.fromEntries(Object.entries(ALL_SHOTS).map(([id, shot]) => [id, fitShot(shot, aspect)]));
  }
  return fits;
}

/**
 * 이번 프레임의 목표 구도를 out에 쓴다.
 * @param {{aspect:number, view?:string, plan?:object, elapsed?:number, studying?:boolean, reduced?:boolean, danger?:boolean, time?:number}} input
 *   studying: 퀴즈를 푸는 중, reduced: 움직임 줄이기·끄기·시스템 모션 감소, danger: 용사 체력이 낮음, time: 장면 시계(초)
 */
export function directCamera(input, out = createCameraPose()) {
  const { rest, danger, shots } = fitted(Math.max(.2, input.aspect || 1), input.view ?? DEFAULT_BATTLE_VIEW);
  const base = input.danger ? danger : rest;
  copyPose(out, base);
  if (input.studying || input.reduced) return out;

  const cues = cameraCues(input.plan), elapsed = input.elapsed ?? 0;
  let total = 0, override = 0, takeover = 0;
  for (const item of cues) if (item.override) {
    override = Math.max(override, cueWeight(item, elapsed));
    takeover = Math.max(takeover, arrival(item, elapsed));
  }
  for (const item of cues) {
    if (item.track) {
      // 처치한 타격에서 트랙을 멈추고, 처치 장면이 들어오는 만큼 비켜 준다. 처치 장면이 다 들어온 뒤에는 돌아오지 않는다.
      const time = Math.min(elapsed, item.hold ?? Infinity), weight = 1 - takeover;
      if (time <= item.start || time >= item.end || weight <= 0) continue;
      const { from, to, u } = trackSpan(item, time, span);
      if (from.shot) total += pull(out, base, shots[from.shot], (1 - u) * from.strength * weight);
      if (to.shot) total += pull(out, base, shots[to.shot], u * to.strength * weight);
      continue;
    }
    // 처치·쓰러짐 장면이 들어오는 만큼 앞선 장면은 비켜 준다.
    total += pull(out, base, shots[item.shot], cueWeight(item, elapsed) * (item.override ? 1 : 1 - override));
  }
  if (total > 1) {
    // 장면이 겹쳐 세기 합이 1을 넘으면 기본 구도에서의 거리를 합으로 나눠, 목표 장면 사이에 머물게 한다.
    out.yaw = base.yaw + (out.yaw - base.yaw) / total; out.pitch = base.pitch + (out.pitch - base.pitch) / total;
    out.distance = base.distance + (out.distance - base.distance) / total; out.fov = base.fov + (out.fov - base.fov) / total;
    for (let i = 0; i < 3; i++) out.target[i] = base.target[i] + (out.target[i] - base.target[i]) / total;
  }
  const time = input.time ?? 0;
  out.yaw += IDLE_SWAY.yaw * Math.sin(time * 2 * Math.PI / IDLE_SWAY.yawPeriod);
  out.pitch += IDLE_SWAY.pitch * Math.sin(time * 2 * Math.PI / IDLE_SWAY.pitchPeriod + 1);
  return out;
}

/** base에서 shot 쪽으로 weight만큼 옮긴 차이를 out에 더하고, 쓴 세기를 돌려준다. */
function pull(out, base, shot, weight) {
  if (!(weight > 0)) return 0;
  out.yaw += weight * (shot.yaw - base.yaw);
  out.pitch += weight * (shot.pitch - base.pitch);
  out.distance += weight * (shot.distance - base.distance);
  out.fov += weight * (shot.fov - base.fov);
  for (let i = 0; i < 3; i++) out.target[i] += weight * (shot.target[i] - base.target[i]);
  return weight;
}

/**
 * 현재 구도(now)를 목표 구도(goal) 쪽으로 factor(0~1)만큼 옮긴다. 충분히 가까우면 정확히 맞추고 true를 돌려준다.
 * 연출이 취소되거나 퀴즈가 열려 목표가 갑자기 바뀌어도 카메라가 튀지 않게 한다.
 */
export function approachPose(now, goal, factor) {
  const t = clamp01(factor);
  now.yaw += (goal.yaw - now.yaw) * t; now.pitch += (goal.pitch - now.pitch) * t;
  now.distance += (goal.distance - now.distance) * t; now.fov += (goal.fov - now.fov) * t;
  for (let i = 0; i < 3; i++) now.target[i] += (goal.target[i] - now.target[i]) * t;
  let gap = Math.max(Math.abs(goal.yaw - now.yaw), Math.abs(goal.pitch - now.pitch), Math.abs(goal.distance - now.distance), Math.abs(goal.fov - now.fov));
  for (let i = 0; i < 3; i++) gap = Math.max(gap, Math.abs(goal.target[i] - now.target[i]));
  if (gap < 1e-3) { copyPose(now, goal); return true; }
  return false;
}

export { copyPose };
