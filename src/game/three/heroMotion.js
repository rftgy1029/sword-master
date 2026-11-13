import { CARD_MOTIONS } from '../cardMotions.js';

// 용사(Kenney 기사)의 자세를 '시간의 함수'로 만든다. three.js 장면과 무관한 순수 계산이다.
// knightRig.js가 이 자세를 실제 뼈대에 입힌다.
//
// 좌표: 용사는 +X(적 쪽)를 보고 선다. f=앞(+X), u=위(+Y), r=카메라 쪽(+Z).
// 각도는 도(°), 거리는 장면 단위다.
//
// 자세 값
//   x·y·z            몸의 위치. y는 서 있을 때보다 얼마나 떴는지(음수면 웅크림)
//   yaw·pitch·roll   몸 전체 회전. yaw+는 가슴이 카메라 쪽으로, pitch+는 앞으로 기울기
//   torso*·head*     허리와 머리의 추가 회전
//   armR*·armL*      팔. swing 0=아래, 90=앞, 180=위 / spread=몸 바깥쪽으로 벌림
//   grip             1이면 왼손이 칼자루를 함께 잡는다
//   blade·bladeTilt·bladeTurn
//                    칼날 방향(장면 기준). blade 0=앞, 90=위, 180=뒤, -90=아래.
//                    bladeTilt는 휘두르는 면을 앞뒤 축으로 기울이고(+면 위쪽이 카메라 쪽), bladeTurn은 위 축으로 돌린다.
//                    칼날은 항상 이 면 안에서 움직이므로 blade 값만 바꾸면 깨끗한 원호가 된다.
//   foot?X·Lift      디딘 발의 장면 X 위치와 높이. 같은 X를 유지하면 몸이 움직여도 발은 바닥에 붙어 있다.
//   foot?Rel·Dx      Rel=1이면 발이 몸을 따라간다(공중). Dx는 몸 중심에서의 앞뒤 거리.

export const HERO_HOME = -2.3;
export const ENEMY_HOME = 2.3;
/** 손목에서 칼끝, 어깨에서 손목, 골반에서 어깨, 바닥에서 골반까지의 길이(장면 단위) */
export const BLADE_LENGTH = .978, ARM_LENGTH = .66, TORSO_LENGTH = .274, HIP_HEIGHT = .433;
const DEFAULT_ENEMY = Object.freeze({ radius: .5, height: 1.9 });
const H = HERO_HOME, E = ENEMY_HOME;

const FIELDS = ['x', 'y', 'z', 'yaw', 'pitch', 'roll', 'torsoPitch', 'torsoYaw', 'torsoRoll', 'headPitch', 'headYaw',
  'armRSwing', 'armRSpread', 'armLSwing', 'armLSpread', 'grip', 'blade', 'bladeTilt', 'bladeTurn',
  'footLX', 'footLLift', 'footLRel', 'footLDx', 'footRX', 'footRLift', 'footRRel', 'footRDx'];
const TRAVEL = new Set(['x', 'z', 'footLX', 'footLDx', 'footLRel', 'footRX', 'footRDx', 'footRRel']);
const WEAPON = new Set(['blade', 'bladeTilt', 'bladeTurn', 'armRSwing', 'armRSpread']);

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const rad = (degrees) => degrees * Math.PI / 180;
const deg = (radians) => radians * 180 / Math.PI;
const EASE = {
  linear: (t) => t,
  in: (t) => t * t,
  in3: (t) => t * t * t,
  out: (t) => 1 - (1 - t) ** 2,
  out3: (t) => 1 - (1 - t) ** 3,
  inOut: (t) => t * t * (3 - 2 * t),
  // 살짝 지나쳤다가 돌아오는 탄력
  back: (t) => { const c = 1.9; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; },
  // 발로 차고 나가 미끄러지듯 날아간다: 처음이 가장 빠르고 끝에서 살짝 느려진다.
  dash: (t) => 1 - (1 - t) ** 1.7,
  hold: () => 0,
};

/** 대기 자세: 왼발을 앞에 두고 검을 가슴 앞에 세운 준비 자세 */
export const STANCE = Object.freeze({ x: H, y: -.035, z: 0, yaw: 20, pitch: 0, roll: 0,
  torsoPitch: 5, torsoYaw: 6, torsoRoll: 0, headPitch: -2, headYaw: 0,
  armRSwing: 42, armRSpread: 18, armLSwing: -6, armLSpread: 20, grip: 0,
  blade: 54, bladeTilt: 14, bladeTurn: -4,
  footLX: H + .2, footLLift: 0, footLRel: 0, footLDx: .2, footRX: H - .18, footRLift: 0, footRRel: 0, footRDx: -.18 });

const plant = (x) => ({ X: x, Lift: 0, Rel: 0 });
const air = (dx, lift) => ({ Dx: dx, Lift: lift, Rel: 1 });

// 짧게 쓴 키(torso:[pitch,yaw,roll] 등)를 자세 값으로 푼다.
function expand(short) {
  const out = {};
  for (const [name, value] of Object.entries(short)) {
    if (name === 'torso') [out.torsoPitch, out.torsoYaw, out.torsoRoll = 0] = value;
    else if (name === 'head') [out.headPitch, out.headYaw = 0] = value;
    else if (name === 'armR') [out.armRSwing, out.armRSpread] = value;
    else if (name === 'armL') [out.armLSwing, out.armLSpread] = value;
    else if (name === 'sword') [out.blade, out.bladeTilt = 0, out.bladeTurn = 0] = value;
    else if (name === 'footL' || name === 'footR') for (const [part, amount] of Object.entries(value)) out[name + part] = amount;
    else out[name] = value;
  }
  return out;
}

/** 키 목록을 완성된 자세의 목록으로 만든다. 키에 적지 않은 값은 직전 키의 값을 그대로 잇는다. */
function track(keys, base = STANCE) {
  let pose = { ...base };
  return keys.map(([t, ease, short = {}, options = {}]) => {
    pose = { ...pose, ...expand(short) };
    // 공중에 있는 발은 디딘 자리 값도 몸을 따라 옮겨 둔다. 그래야 다시 디딜 때 엉뚱한 곳에서 끌려오지 않는다.
    for (const foot of ['footL', 'footR']) if (pose[foot + 'Rel'] === 1) pose[foot + 'X'] = pose.x + pose[foot + 'Dx'];
      else pose[foot + 'Dx'] = pose[foot + 'X'] - pose.x;
    return { t, ease, pose, hop: options.hop ?? 0, eTravel: options.travel, eWeapon: options.weapon };
  });
}

function sample(keys, time, out) {
  if (time <= keys[0].t) return Object.assign(out, keys[0].pose);
  const lastKey = keys[keys.length - 1];
  if (time >= lastKey.t) return Object.assign(out, lastKey.pose);
  let index = 1;
  while (keys[index].t < time) index += 1;
  const a = keys[index - 1], b = keys[index];
  const s = (time - a.t) / (b.t - a.t);
  const body = EASE[b.ease](s), travel = b.eTravel ? EASE[b.eTravel](s) : body, weapon = b.eWeapon ? EASE[b.eWeapon](s) : body;
  for (const field of FIELDS) {
    const e = TRAVEL.has(field) ? travel : WEAPON.has(field) ? weapon : body;
    out[field] = a.pose[field] + (b.pose[field] - a.pose[field]) * e;
  }
  // 뛰는 구간: 포물선으로 떠오른다.
  if (b.hop) out.y += b.hop * 4 * s * (1 - s);
  return out;
}

/**
 * 타격 순간의 팔·몸 자세에서, 칼끝이 원하는 높이에 닿는 칼날 각도와 칼끝까지의 앞쪽 거리를 구한다.
 * @returns {{angle: number, reach: number}} angle(°), reach(몸 중심에서 칼끝까지의 X 거리)
 */
export function contactReach({ y, torsoPitch, armSwing, height }) {
  const shoulderX = TORSO_LENGTH * Math.sin(rad(torsoPitch)), shoulderY = HIP_HEIGHT + y + TORSO_LENGTH * Math.cos(rad(torsoPitch));
  const handX = shoulderX + ARM_LENGTH * Math.sin(rad(armSwing)), handY = shoulderY - ARM_LENGTH * Math.cos(rad(armSwing));
  const angle = deg(Math.asin(clamp((height - handY) / BLADE_LENGTH, -.55, .85)));
  return { angle, reach: handX + BLADE_LENGTH * Math.cos(rad(angle)) };
}

const enemyOf = (context) => ({ ...DEFAULT_ENEMY, ...(context?.enemy ?? {}) });
/** 칼이 닿아야 하는 높이: 적의 몸통 가운데 */
const chestHeight = (enemy) => clamp(enemy.height * .56, .42, 1.3);

// ───────────────────────── 카드별 동작 ─────────────────────────
// 근접 공격의 공통 흐름: 힘 모으기 → 발로 차고 돌진 → 발을 디디며 베기 → 따라가기 → 자세 회수 → 백스텝 → 대기

function strikeKeys(recipe, enemy) {
  const m = recipe.marks, hit = recipe.hits[0];
  const at = contactReach({ y: -.1, torsoPitch: 20, armSwing: 100, height: chestHeight(enemy) });
  const C = E - enemy.radius * .35 - at.reach; // 타격 때 몸이 설 자리
  return track([
    [0, 'linear'],
    // 준비: 몸을 낮추고 검을 오른쪽 어깨 뒤로 당긴다
    [m.windup, 'out', { x: H - .14, y: -.15, yaw: 36, torso: [6, 30], armR: [-24, 34], armL: [58, 8], sword: [168, 34],
      footL: plant(H + .26), footR: plant(H - .32) }],
    // 박차기: 뒷발이 바닥을 밀고 앞발이 뜬다
    [m.windup + 36, 'in', { x: H + .3, y: -.08, torso: [24, 30], footL: air(.4, .13) }],
    // 돌진: 낮게 날아간다. 검은 어깨 위로 들어 올린다
    [m.plant - 12, 'out', { x: C - .16, y: -.02, torso: [26, 30], armR: [136, 26], armL: [20, 30], sword: [150, 34],
      footL: air(.36, .1), footR: air(-.44, .17) }, { travel: 'dash', hop: .07 }],
    // 접지: 앞발을 디디며 무게를 싣는다
    [m.plant + 8, 'out', { x: C, y: -.17, torso: [22, 26], footL: plant(C + .32), footR: plant(C - .38) }],
    // 타격: 사선으로 내려 벤다. 가속하며 접촉한다
    [hit, 'out', { x: C + .07, y: -.1, yaw: 12, torso: [20, -20], armR: [100, 8], armL: [-30, 34], sword: [at.angle, 34] }, { weapon: 'in' }],
    // 따라가기: 검이 몸을 지나 아래로 빠진다
    [m.follow, 'out3', { x: C + .12, y: -.2, yaw: 4, torso: [28, -36], armR: [34, -8], armL: [-44, 40], sword: [-64, 34] }],
    // 자세 회수: 적을 보며 검을 다시 세운다
    [m.guard, 'inOut', { x: C + .04, y: -.1, yaw: 18, torso: [8, 4], armR: [44, 18], armL: [0, 22], sword: [50, 16, -4] }],
    [m.leap, 'in', { y: -.2, torso: [12, 4] }],
    // 백스텝: 적을 본 채 뒤로 뛴다
    [m.land - 20, 'out', { x: H + .12, y: 0, torso: [-4, 6], footL: air(.24, .16), footR: air(-.2, .1) }, { travel: 'linear', hop: .2 }],
    [m.land + 10, 'out', { x: H - .03, y: -.16, torso: [10, 6], footL: plant(H + .2), footR: plant(H - .18) }],
    [recipe.duration, 'inOut', { ...STANCE }],
  ]);
}

function heavyKeys(recipe, enemy) {
  const m = recipe.marks, hit = recipe.hits[0];
  // 내려찍기: 칼끝이 적의 발밑 바닥에 박힌다
  const at = contactReach({ y: -.2, torsoPitch: 30, armSwing: 76, height: .05 });
  const C = E - .12 - at.reach;
  return track([
    [0, 'linear'],
    // 검을 머리 위로 치켜든다(두 손)
    [m.raise, 'out3', { x: H - .06, y: -.08, yaw: 30, torso: [-6, 18], head: [-10], armR: [176, 12], armL: [150, 0], grip: 1, sword: [112, 4],
      footL: plant(H + .3), footR: plant(H - .34) }],
    // 깊게 웅크리며 힘을 모은다
    [m.windup, 'inOut', { x: H - .12, y: -.27, torso: [16, 22], head: [-4], sword: [124, 6] }],
    [m.windup + 40, 'in', { x: H + .16, y: -.1, torso: [22, 20], footL: air(.3, .2) }],
    // 도약: 크게 뛰어오르며 몸을 뒤로 젖힌다
    [m.apex, 'out', { x: C - .95, y: .86, yaw: 18, torso: [-18, 12], head: [-14], armR: [188, 10], sword: [152, 0],
      footL: air(.22, .34), footR: air(-.3, .2) }, { travel: 'linear' }],
    // 낙하: 검이 머리 위를 넘어온다
    [hit - 48, 'in', { x: C - .12, y: .34, torso: [14, 4], armR: [150, 6], sword: [96, 0], footL: air(.3, .12), footR: air(-.3, .26) }, { travel: 'linear' }],
    // 착지와 동시에 내려찍는다
    [hit, 'in', { x: C, y: -.2, yaw: 10, torso: [30, -6], head: [8], armR: [76, 2], sword: [at.angle, 0],
      footL: plant(C + .34), footR: plant(C - .32) }, { travel: 'linear', weapon: 'in' }],
    // 무게가 실린 채 잠시 버틴다
    [hit + 70, 'out', { y: -.26, torso: [34, -8] }],
    [m.follow, 'inOut', { y: -.22, torso: [31, -6] }],
    // 검을 뽑아 들며 일어선다
    [m.guard, 'inOut', { x: C - .04, y: -.1, yaw: 18, torso: [8, 4], head: [-2], armR: [44, 18], armL: [0, 22], grip: 0, sword: [50, 16, -4] }],
    [m.leap, 'in', { y: -.2 }],
    [m.land - 20, 'out', { x: H + .12, y: 0, torso: [-4, 6], footL: air(.24, .16), footR: air(-.2, .1) }, { travel: 'linear', hop: .26 }],
    [m.land + 10, 'out', { x: H - .03, y: -.18, torso: [12, 6], footL: plant(H + .2), footR: plant(H - .18) }],
    [recipe.duration, 'inOut', { ...STANCE }],
  ]);
}

function twinKeys(recipe, enemy) {
  const m = recipe.marks, [first, second] = recipe.hits;
  const height = chestHeight(enemy);
  // 첫 타격은 올려 베기(가슴 위), 두 번째는 내려 베기(가슴 아래)
  const up = contactReach({ y: -.08, torsoPitch: 14, armSwing: 98, height: height + .12 });
  const down = contactReach({ y: -.2, torsoPitch: 24, armSwing: 86, height: Math.max(.36, height - .16) });
  const C = E - enemy.radius * .35 - up.reach;
  const C2 = E - enemy.radius * .35 - down.reach; // 두 번째 타격은 한 발 더 들어간다
  return track([
    [0, 'linear'],
    // 준비: 검을 왼쪽 허리로 당겨 낮게 숨긴다(발도 자세)
    [m.windup, 'out', { x: H - .1, y: -.17, yaw: 6, torso: [16, -32], armR: [34, -40], armL: [-20, 30], sword: [204, -30],
      footL: plant(H + .24), footR: plant(H - .3) }],
    [m.windup + 34, 'in', { x: H + .3, y: -.1, torso: [26, -32], footL: air(.4, .12) }],
    [m.plant - 12, 'out', { x: C - .16, y: -.04, torso: [28, -30], sword: [212, -30], footL: air(.36, .1), footR: air(-.44, .16) }, { travel: 'dash', hop: .06 }],
    [m.plant + 8, 'out', { x: C, y: -.18, torso: [24, -26], footL: plant(C + .32), footR: plant(C - .38) }],
    // 첫 타격: 아래에서 위로 올려 벤다(청색)
    [first, 'out', { x: C + .05, y: -.08, yaw: 18, torso: [14, 12], armR: [98, 10], armL: [-36, 36], sword: [360 + up.angle, -30] }, { weapon: 'in' }],
    // 검이 머리 위까지 올라간다
    [m.turn, 'out', { y: -.02, yaw: 30, torso: [2, 34], armR: [162, 22], armL: [40, 20], sword: [470, -30] }],
    // 손목을 돌려 반대 방향의 면으로 바꾸고, 한 발 더 들어간다
    [m.turn + 60, 'inOut', { x: C2 - .04, y: -.06, torso: [6, 38], sword: [482, 32], footL: plant(C2 + .34) }],
    // 두 번째 타격: 위에서 아래로 내려 벤다(보라색). 더 깊고 무겁게
    [second, 'out', { x: C2 + .08, y: -.2, yaw: 8, torso: [24, -22], armR: [86, 2], armL: [-40, 38], sword: [360 + down.angle, 32] }, { weapon: 'in' }],
    [m.follow, 'out3', { x: C2 + .12, y: -.24, yaw: 0, torso: [30, -38], armR: [30, -10], sword: [298, 32] }],
    // 잔심: 벤 자세로 잠깐 멈춘다
    [m.guard - 40, 'inOut', { y: -.22, torso: [28, -36] }],
    [m.guard, 'inOut', { x: C2 + .02, y: -.1, yaw: 18, torso: [8, 4], armR: [44, 18], armL: [0, 22], sword: [414, 16, -4] }],
    [m.leap, 'in', { y: -.2 }],
    [m.land - 20, 'out', { x: H + .12, y: 0, torso: [-4, 6], footL: air(.24, .16), footR: air(-.2, .1) }, { travel: 'linear', hop: .24 }],
    [m.land + 10, 'out', { x: H - .03, y: -.16, torso: [10, 6], footL: plant(H + .2), footR: plant(H - .18) }],
    [recipe.duration, 'inOut', { ...STANCE, blade: STANCE.blade + 360 }],
  ]);
}

function flareKeys(recipe) {
  const m = recipe.marks;
  return track([
    [0, 'linear'],
    // 제자리에서 다리를 벌리고 검을 오른쪽 뒤로 수평하게 당긴다. 왼손은 적을 겨눈다
    [m.windup, 'out', { x: H - .08, y: -.19, yaw: 42, torso: [8, 44], armR: [24, 58], armL: [84, -6], sword: [188, 86],
      footL: plant(H + .32), footR: plant(H - .34) }],
    // 발사: 수평으로 크게 휘둘러 검기를 날린다
    [m.launch, 'out', { x: H + .12, y: -.14, yaw: 16, torso: [16, -26], armR: [88, 4], armL: [-20, 40], sword: [8, 86] }, { weapon: 'in' }],
    [m.follow, 'out3', { x: H + .16, torso: [18, -40], armR: [70, -20], sword: [-44, 86] }],
    // 반동으로 몸이 뒤로 실린다(발은 그대로)
    [m.follow + 90, 'out', { x: H - .02, y: -.17, torso: [10, -30] }],
    [m.guard, 'inOut', { x: H + .02, y: -.16, torso: [12, -32] }],
    [recipe.duration, 'inOut', { ...STANCE }],
  ]);
}

function novaKeys(recipe) {
  const m = recipe.marks, hit = recipe.hits[0];
  return track([
    [0, 'linear'],
    // 검을 하늘로 치켜들고 빛을 부른다
    [m.raise, 'out3', { x: H, y: -.03, yaw: 12, torso: [-8, 4], head: [-20], armR: [178, 8], armL: [160, 0], grip: 1, sword: [90, 0],
      footL: plant(H + .22), footR: plant(H - .22) }],
    [m.windup, 'inOut', { y: .03, torso: [-12, 4], head: [-26] }],
    // 정적: 검을 살짝 뒤로 젖힌 채 멈춘다
    [m.launch, 'inOut', { y: .01, torso: [-16, 6], sword: [106, 0] }],
    // 내리치며 낙인을 떨어뜨린다
    [hit, 'in3', { x: H + .14, y: -.16, yaw: 14, torso: [24, -8], head: [0], armR: [84, 4], armL: [70, -8], sword: [10, 0] }],
    [hit + 90, 'out', { y: -.2, torso: [27, -9] }],
    [m.linger, 'inOut', { y: -.17, torso: [24, -8] }],
    [recipe.duration, 'inOut', { ...STANCE }],
  ]);
}

function guardKeys(recipe) {
  const m = recipe.marks;
  return track([
    [0, 'linear'],
    // 발을 벌려 버티고 검을 몸 앞에 수직으로 세운다
    [m.brace, 'out3', { y: -.18, yaw: 26, torso: [10, 8], armR: [64, -16], armL: [72, -22], sword: [93, -6],
      footL: plant(H + .26), footR: plant(H - .26) }],
    [m.join, 'inOut', { y: -.22, torso: [12, 8] }],
    [recipe.moment - 60, 'in', { y: -.24, footR: { X: H - .26, Lift: .09, Rel: 0 } }],
    // 완성: 발을 구르며 자세를 굳힌다
    [recipe.moment, 'out', { y: -.12, torso: [2, 8], sword: [97, -6], footR: plant(H - .26) }],
    [recipe.moment + 110, 'inOut', { y: -.15, torso: [6, 8] }],
    [recipe.duration, 'inOut', { ...STANCE }],
  ]);
}

function healKeys(recipe) {
  const m = recipe.marks;
  return track([
    [0, 'linear'],
    // 검을 내려 땅에 대고 고개를 숙인다
    [m.bloom, 'out', { y: -.12, yaw: 14, torso: [12, 2], head: [18], armR: [50, -14], armL: [34, -28], sword: [-84, 0],
      footL: plant(H + .14), footR: plant(H - .14) }],
    [m.gather, 'inOut', { y: -.07, torso: [10, 2], head: [14] }],
    // 흡수: 가슴을 펴고 고개를 든다
    [recipe.moment, 'out', { y: .02, torso: [-10, 2], head: [-22], armL: [18, 54] }],
    [recipe.moment + 140, 'inOut', { y: -.02, torso: [-6, 2], head: [-14] }],
    [recipe.duration, 'inOut', { ...STANCE }],
  ]);
}

function empowerKeys(recipe) {
  const m = recipe.marks;
  return track([
    [0, 'linear'],
    // 몸을 웅크려 힘을 모은다
    [recipe.moment - 110, 'out', { y: -.23, yaw: 22, torso: [20, 10], head: [12], armR: [28, 30], armL: [22, 34], sword: [26, 22],
      footL: plant(H + .26), footR: plant(H - .26) }],
    // 폭발하듯 몸을 펴고 검을 치켜든다
    [recipe.moment, 'back', { y: .07, yaw: 26, torso: [-14, 10], head: [-18], armR: [152, 40], armL: [-34, 52], sword: [76, 22] }],
    // 발을 구른다
    [m.land, 'in', { y: -.14, torso: [-6, 10] }],
    [m.land + 150, 'inOut', { y: -.06, torso: [-10, 10] }],
    [recipe.duration, 'inOut', { ...STANCE }],
  ]);
}

function weakenKeys(recipe) {
  const m = recipe.marks;
  return track([
    [0, 'linear'],
    // 왼손을 적에게 뻗어 봉인을 건다. 검은 뒤로 내린다
    [m.cast, 'out3', { x: H + .1, y: -.12, yaw: -4, torso: [10, -24], armL: [88, -6], armR: [-16, 26], sword: [200, 20],
      footL: plant(H + .28), footR: plant(H - .2) }],
    [recipe.moment - 40, 'inOut', { x: H + .13, torso: [13, -26], armL: [82, -6] }],
    // 잠금: 움켜쥐듯 손을 당긴다
    [recipe.moment + 40, 'out3', { x: H - .03, y: -.08, torso: [4, 4], armL: [28, 22] }],
    [recipe.duration, 'inOut', { ...STANCE }],
  ]);
}

function focusKeys(recipe) {
  const m = recipe.marks;
  return track([
    [0, 'linear'],
    // 똑바로 서서 검을 얼굴 앞에 세운다
    [m.still, 'out3', { y: 0, yaw: 10, torso: [0, 0], head: [5], armR: [76, -24], armL: [68, -28], grip: 1, sword: [90, -4],
      footL: plant(H + .1), footR: plant(H - .1) }],
    [recipe.moment - 30, 'linear', {}],
    // 눈을 뜬다
    [recipe.moment + 40, 'out', { head: [-5], sword: [87, -4] }],
    [recipe.duration - 140, 'inOut', {}],
    [recipe.duration, 'inOut', { ...STANCE }],
  ]);
}

function flowKeys(recipe) {
  const m = recipe.marks;
  return track([
    [0, 'linear'],
    [m.spin, 'out', { y: -.13, torso: [8, 20], armR: [40, 66], armL: [36, 62], sword: [16, 82, 0] }],
    // 가볍게 뛰어 한 바퀴 돈다. 검이 수평으로 원을 그린다
    [m.spin + 110, 'in', { y: -.02, yaw: 70, sword: [16, 82, 50], footL: air(.12, .1), footR: air(-.12, .12) }],
    [m.land - 60, 'linear', { yaw: 330, torso: [-4, 14], sword: [16, 82, 310], footL: air(.12, .14), footR: air(-.12, .1) }, { hop: .16 }],
    [m.land, 'out', { y: -.14, yaw: 380, torso: [8, 6], sword: [22, 60, 356], footL: plant(H + .2), footR: plant(H - .18) }],
    [recipe.duration, 'inOut', { ...STANCE, yaw: STANCE.yaw + 360, bladeTurn: STANCE.bladeTurn + 360 }],
  ]);
}

function oathKeys(recipe) {
  const m = recipe.marks;
  return track([
    [0, 'linear'],
    // 한쪽 무릎을 낮추고 검을 땅에 세워 서약한다
    [m.crest, 'out', { y: -.27, yaw: 8, torso: [16, 0], head: [20], armR: [58, -18], armL: [52, -20], grip: 1, sword: [-87, 0],
      footL: plant(H + .24), footR: plant(H - .42) }],
    [m.descend, 'inOut', { y: -.25, head: [16] }],
    // 일어서며 검을 높이 든다
    [recipe.moment, 'out3', { y: .01, torso: [-8, 4], head: [-16], armR: [172, 12], armL: [20, 30], grip: 0, sword: [86, 0],
      footR: plant(H - .2) }],
    [m.hold, 'inOut', { y: -.01 }],
    [recipe.duration, 'inOut', { ...STANCE }],
  ]);
}

/** 오답: 검을 들다가 힘이 흩어져 어깨가 처진다 */
function missKeys(duration) {
  return track([
    [0, 'linear'],
    [150, 'out', { y: -.08, armR: [70, 20], sword: [96, 10] }],
    [300, 'inOut', { y: -.12, torso: [16, 6], head: [22, 0], armR: [22, 16], sword: [-20, 10] }],
    [380, 'inOut', { head: [20, 12] }],
    [440, 'inOut', { head: [18, -10] }],
    [duration, 'inOut', { ...STANCE }],
  ]);
}

const BUILDERS = { strike: strikeKeys, heavy: heavyKeys, twin: twinKeys, flare: flareKeys, nova: novaKeys, guard: guardKeys,
  heal: healKeys, empower: empowerKeys, weaken: weakenKeys, focus: focusKeys, flow: flowKeys, oath: oathKeys };

/** 승리 자세: 검을 높이 든다 */
const VICTORY = Object.freeze({ ...STANCE, y: 0, yaw: 28, torsoPitch: -8, torsoYaw: 10, headPitch: -14,
  armRSwing: 166, armRSpread: 26, armLSwing: -20, armLSpread: 34, blade: 82, bladeTilt: 10 });
/** 쓰러진 자세: 뒤로 넘어져 눕는다 */
const FALLEN = Object.freeze({ ...STANCE, x: H - .75, y: .13, yaw: 14, pitch: -88, torsoPitch: -6, torsoYaw: 0, headPitch: -12,
  armRSwing: 30, armRSpread: 70, armLSwing: 20, armLSpread: 64, blade: 172, bladeTilt: 80,
  footLRel: 1, footRRel: 1, footLDx: .3, footRDx: .12, footLLift: .12, footRLift: .12 });

const cache = new WeakMap();
/** 계획에 맞는 용사의 키 목록. 같은 계획에는 한 번만 만든다. */
export function heroKeys(plan, context) {
  if (cache.has(plan)) return cache.get(plan);
  let keys = null;
  if (plan.side === 'hero' && !plan.calm) {
    if (plan.kind === 'miss') keys = missKeys(plan.duration);
    else if (BUILDERS[plan.cardType] && plan.recipe) keys = BUILDERS[plan.cardType](plan.recipe, enemyOf(context));
  }
  cache.set(plan, keys);
  return keys;
}

const scratch = {};
const smoothStep = (t) => { const s = clamp(t); return s * s * (3 - 2 * s); };
/** 빠르게 치솟았다가 천천히 가라앉는 충격의 크기(0~1). age는 타격 뒤 흐른 시간(ms) */
export const impulse = (age, rise = 45, fall = 330) => age < 0 ? 0 : age < rise ? age / rise : Math.max(0, 1 - (age - rise) / fall) ** 2;

/**
 * 현재 연출에서 용사의 자세.
 * @param {object|null} current CombatPlayback.active
 * @param {object} out 결과를 채울 객체(매 프레임 재사용)
 * @param {{time?: number, ages?: number[], enemy?: object, block?: number, victory?: boolean, dead?: boolean, still?: boolean}} context
 *   time: 대기 동작용 시계(초), ages: 타격별 경과 시간(ms), block: 용사의 방어 수치
 */
export function heroPose(current, out = {}, context = {}) {
  const { time = 0, still = false } = context;
  if (!current) {
    Object.assign(out, context.dead ? FALLEN : context.victory ? VICTORY : STANCE);
    if (!still && !context.dead) breathe(out, time, 1);
    return out;
  }
  const { plan, elapsed } = current;
  const keys = heroKeys(plan, context);
  if (keys) {
    sample(keys, elapsed, out);
    if (plan.lethal && elapsed > keys[keys.length - 1].t) {
      // 처치한 뒤에는 승리 자세로 넘어간다.
      const w = smoothStep((elapsed - Math.max(keys[keys.length - 1].t, plan.killAt + 420)) / 320);
      for (const field of FIELDS) out[field] += (VICTORY[field] - out[field]) * w;
    }
    // 힘을 모으는 동안 몸이 떨린다.
    if (plan.cardType === 'heavy' || plan.cardType === 'empower' || plan.cardType === 'nova') {
      const until = plan.cardType === 'empower' ? plan.recipe.moment - 60 : plan.recipe.marks.windup;
      const amount = smoothStep(elapsed / until) * (elapsed < until + 30 ? 1 : 0);
      out.x += Math.sin(elapsed * .21) * .012 * amount; out.z += Math.cos(elapsed * .27) * .01 * amount;
      out.blade += Math.sin(elapsed * .33) * 1.6 * amount;
    }
    // 타격의 반동: 벤 순간 몸이 살짝 밀린다.
    if (plan.hits.length && context.ages) for (let index = 0; index < plan.hits.length; index += 1) {
      const kick = impulse(context.ages[index] ?? -1, 30, 150) * (plan.role === 'melee' ? .05 : .03) * (plan.powers[index] ?? 1);
      out.x -= kick; out.torsoPitch -= kick * 40;
    }
    const edge = Math.min(elapsed, plan.duration - elapsed);
    if (!still && edge < 140) breathe(out, time, 1 - edge / 140);
    return out;
  }
  // 적의 차례: 대기 자세를 바탕으로 막거나 맞는 반응을 더한다.
  Object.assign(out, STANCE);
  if (plan.calm) return out;
  if (!still) breathe(out, time, .6);
  if (plan.kind === 'hurt') hurtReaction(current, out, context);
  else if (plan.kind === 'enemy' && plan.action === 'charge') {
    // 강타를 준비하는 적을 보며 자세를 낮춘다.
    const wary = Math.sin(Math.PI * clamp(elapsed / plan.duration));
    out.y -= .05 * wary; out.torsoPitch += 4 * wary; out.x -= .06 * wary; out.footLX -= .03 * wary;
  }
  return out;
}

function breathe(out, time, weight) {
  const breath = Math.sin(time * 2.2) * weight;
  out.y += breath * .012;
  out.torsoPitch += breath * 1.1;
  out.blade += Math.sin(time * 1.3 + .6) * 2.4 * weight;
  out.armLSwing += Math.sin(time * 1.7) * 3 * weight;
  out.headPitch += Math.sin(time * 1.1 + 1) * 1.2 * weight;
}

// 적의 공격을 받는 동안: 준비 동작을 보면 방어 자세를 잡고, 맞는 순간 밀려났다가 돌아온다.
function hurtReaction(current, out, context) {
  const { plan, elapsed } = current;
  const attack = plan.attack, last = plan.hits.at(-1);
  const guarding = (context.block ?? 0) > 0 || attack.blocked.some(Boolean);
  // 적이 들어오기 시작하면 자세를 잡고, 마지막 타격 뒤에 푼다.
  const brace = smoothStep((elapsed - attack.windup * .45) / 220) * (1 - smoothStep((elapsed - last - 170) / 300));
  if (guarding) {
    // 검을 몸 앞에 세워 막는다.
    mixInto(out, { y: -.16, yaw: 28, torsoPitch: 12, armRSwing: 66, armRSpread: -14, armLSwing: 74, armLSpread: -22, blade: 94, bladeTilt: -6, bladeTurn: 0 }, brace);
  } else mixInto(out, { y: -.1, torsoPitch: -4, armLSwing: 40, armLSpread: 10, blade: 70 }, brace * .7);
  const ages = context.ages ?? [];
  let fallen = 0;
  for (let index = 0; index < plan.hits.length; index += 1) {
    const age = ages[index] ?? -1;
    if (age < 0) continue;
    const info = plan.hitInfo[index];
    const weight = (info.blocked ? .32 : info.partial ? .7 : 1) * (plan.heavy ? 1.5 : 1);
    const push = impulse(age, 40, plan.heavy ? 520 : 340) * weight;
    const snap = impulse(age, 30, 200) * weight;
    // 발과 함께 밀려났다가 제자리로 돌아온다.
    out.x -= push * .26; out.footLX -= push * .26; out.footRX -= push * .26;
    out.pitch -= snap * 9; out.torsoPitch -= snap * (info.blocked ? 4 : 13); out.headPitch -= snap * (info.blocked ? 2 : 16);
    out.y -= snap * .05;
    if (info.blocked) { out.armRSwing += snap * 10; out.blade -= snap * 8; }
    if (info.lethal && plan.fatal) fallen = age;
  }
  if (plan.fatal && current.delivered === plan.hits.length) {
    // 쓰러짐: 뒤로 튕겨 올랐다가 등을 대고 눕는다.
    const fall = smoothStep(fallen / 460), settle = smoothStep((fallen - 380) / 300);
    for (const field of FIELDS) out[field] += (FALLEN[field] - out[field]) * fall;
    out.y += Math.sin(Math.PI * clamp(fallen / 430)) * .42 - Math.sin(Math.PI * clamp((fallen - 430) / 200)) * .05 * (1 - settle);
    out.x -= .1 * Math.sin(Math.PI * clamp(fallen / 500));
  }
}

function mixInto(out, target, weight) {
  for (const [field, value] of Object.entries(target)) out[field] += (value - out[field]) * weight;
}

/** 연출이 없을 때 쓰는 값: 자세 필드의 이름(검사·디버그용) */
export const POSE_FIELDS = Object.freeze([...FIELDS]);

/** 이 계획에서 검 잔상을 그리는 구간 [시작, 끝, 색 번호] */
export function swingWindows(plan) {
  return plan?.side === 'hero' && !plan.calm ? CARD_MOTIONS[plan.cardType]?.swings ?? [] : [];
}
export { scratch as _scratch };
