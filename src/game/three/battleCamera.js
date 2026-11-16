// 전투 장면의 기본 카메라 구도. three.js 없이 계산만 하므로 자동 검사에서 그대로 확인할 수 있다.
// 상황별 연출(cameraDirector.js)과 타격 흔들림·펀치 줌(ImpactEffects)은 이 구도를 기준으로 잠깐 움직였다가 돌아온다.

export const BATTLE_FOV = 37;
// 가로로 아주 긴 PC 전투 띠(약 4.6:1)에서 시야각이 120°까지 벌어져 벽이 휘어 보이지 않도록 가로 시야각을 묶는다.
// 시야각을 줄이면 카메라가 그만큼 물러나므로 캐릭터 크기는 그대로이고 원근 왜곡만 줄어든다.
export const MAX_HORIZONTAL_FOV = 74;

// 두 캐릭터가 서는 무대 상자. 용사는 x≈-2.3, 적은 x≈2.3에 서고 가장 큰 몬스터(보스)의 키가 약 2.9다.
// 위쪽에는 머리 위 표시(의도·상태)가 들어갈 여유를 더한다.
export const BATTLE_STAGE = Object.freeze({ x: [-3.1, 3.1], y: [0, 3.3], z: [-.7, .7] });

/**
 * 기본 구도. yaw는 위에서 본 카메라 방향(도, 음수면 용사 쪽·양수면 적 쪽으로 돈다),
 * pitch는 내려다보는 각도(도), focus는 화면 가운데에 둘 지점, margin은 화면 가장자리 여유(1이면 꽉 채움).
 */
export const BATTLE_VIEWS = Object.freeze({
  hero: { label: '용사 쪽 사선', yaw: -22, pitch: 12, focus: [.5, 1.3, 0], margin: .9 },
  high: { label: '높은 사선', yaw: -16, pitch: 26, focus: [.3, 1.1, 0], margin: .9 },
});

export const DEFAULT_BATTLE_VIEW = 'hero';

const rad = degrees => degrees * Math.PI / 180;

// 장면 안개(가까운 끝·먼 끝). 카메라가 멀리 물러나는 넓은 화면에서도 캐릭터 주변은 안개 없이 선명하게,
// 멀리 있는 벽 끝은 안개 속으로 사라지게 카메라 거리만큼 뒤로 민다.
export const BATTLE_FOG = Object.freeze([12, 30]);
export const fogNear = distance => Math.max(BATTLE_FOG[0], distance + 3);
export function fogFor(distance) {
  const near = fogNear(distance);
  return [near, near + BATTLE_FOG[1] - BATTLE_FOG[0]];
}

/** 카메라가 바라보는 방향의 기준 축들. dir은 목표점에서 카메라 쪽을 향한다. */
export function viewAxes(yaw, pitch) {
  const y = rad(yaw), p = rad(pitch);
  const dir = [Math.sin(y) * Math.cos(p), Math.sin(p), Math.cos(y) * Math.cos(p)];
  const length = Math.hypot(dir[2], dir[0]);
  const right = [dir[2] / length, 0, -dir[0] / length];
  const up = [dir[1] * right[2] - dir[2] * right[1], dir[2] * right[0] - dir[0] * right[2], dir[0] * right[1] - dir[1] * right[0]];
  return { dir, right, up };
}

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** 화면 비율에 맞춘 세로 시야각. 가로 시야각이 MAX_HORIZONTAL_FOV를 넘지 않게 줄인다. */
export function battleFov(aspect, fov = BATTLE_FOV) {
  const capped = 2 * Math.atan(Math.tan(rad(MAX_HORIZONTAL_FOV / 2)) / aspect) * 180 / Math.PI;
  return Math.min(fov, capped);
}

/**
 * 주어진 방향(yaw·pitch)에서 상자(box) 전체가 화면 안에 들어오는 카메라 거리를 구한다.
 * 세로로 긴 휴대폰 화면에서는 자동으로 뒤로 물러나 잘리지 않는다.
 * @param {{yaw:number, pitch:number, focus:number[], margin:number}} view
 * @returns {{yaw:number, pitch:number, distance:number, target:number[], fov:number}}
 */
export function fitView(view, aspect, box = BATTLE_STAGE, baseFov = BATTLE_FOV) {
  const ratio = Math.max(.2, aspect || 1);
  const fov = battleFov(ratio, baseFov);
  const { dir, right, up } = viewAxes(view.yaw, view.pitch);
  const target = view.focus;
  const tanV = Math.tan(rad(fov / 2)) * view.margin, tanH = tanV * ratio;
  const zs = box.z ?? BATTLE_STAGE.z;
  let distance = 0;
  for (const x of box.x) for (const y of box.y) for (const z of zs) {
    const point = [x - target[0], y - target[1], z - target[2]];
    // 카메라에서 이 점까지의 깊이가 (거리 - 점의 dir 성분)이므로, 시야각 안에 들도록 필요한 거리를 구한다.
    distance = Math.max(distance, dot(point, dir) + Math.max(Math.abs(dot(point, right)) / tanH, Math.abs(dot(point, up)) / tanV));
  }
  return { yaw: view.yaw, pitch: view.pitch, distance, target: [...target], fov };
}

/** yaw·pitch·거리·목표점으로 카메라 위치를 구한다. out을 넘기면 그 배열에 쓴다. */
export function cameraPosition(pose, out = [0, 0, 0]) {
  const y = rad(pose.yaw), p = rad(pose.pitch);
  out[0] = pose.target[0] + Math.sin(y) * Math.cos(p) * pose.distance;
  out[1] = pose.target[1] + Math.sin(p) * pose.distance;
  out[2] = pose.target[2] + Math.cos(y) * Math.cos(p) * pose.distance;
  return out;
}

/**
 * 화면 비율(가로/세로)에 맞춘 기본 전투 구도.
 * @returns {{yaw:number, pitch:number, distance:number, position:number[], target:number[], fov:number, fog:number[]}}
 */
export function battleCameraPose(aspect, viewId = DEFAULT_BATTLE_VIEW, baseFov = BATTLE_FOV) {
  const view = BATTLE_VIEWS[viewId] ?? BATTLE_VIEWS[DEFAULT_BATTLE_VIEW];
  const pose = fitView(view, aspect, BATTLE_STAGE, baseFov);
  return { ...pose, position: cameraPosition(pose), fog: fogFor(pose.distance) };
}
