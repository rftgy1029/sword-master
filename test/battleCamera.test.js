import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BATTLE_FOV, BATTLE_STAGE, BATTLE_VIEWS, DEFAULT_BATTLE_VIEW, MAX_HORIZONTAL_FOV, battleCameraPose, battleFov,
} from '../src/game/three/battleCamera.js';
import { ENEMY_HOME, HERO_HOME } from '../src/game/three/heroMotion.js';
import { TILE, WALL_FRONT, dungeonLayout } from '../src/game/three/kenneyDungeon.js';

// 실제 화면에서 쓰는 전투 영역 비율: PC 가로 띠(약 1400×300), 태블릿, 휴대폰(약 375×345), 세로로 더 긴 화면
const ASPECTS = [4.6, 16 / 9, 1.1, .7];
const rad = degrees => degrees * Math.PI / 180;
const sub = (a, b) => a.map((value, i) => value - b[i]);
const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = a => { const length = Math.hypot(...a); return a.map(value => value / length); };

/** three.js의 lookAt과 같은 기준으로 카메라 축을 만들고, 점을 화면 좌표(-1~1)로 옮긴다. */
function camera(pose, aspect) {
  const forward = unit(sub(pose.target, pose.position));
  const right = unit(cross(forward, [0, 1, 0]));
  const up = cross(right, forward);
  const tanV = Math.tan(rad(pose.fov / 2)), tanH = tanV * aspect;
  return {
    forward, right, up, tanV, tanH,
    project(point) {
      const offset = sub(point, pose.position), depth = dot(offset, forward);
      return { depth, x: dot(offset, right) / (depth * tanH), y: dot(offset, up) / (depth * tanV) };
    },
  };
}

const stageCorners = () => BATTLE_STAGE.x.flatMap(x => BATTLE_STAGE.y.flatMap(y => BATTLE_STAGE.z.map(z => [x, y, z])));

test('every battle view keeps both fighters and their overhead space on screen at every arena shape', () => {
  for (const [id, view] of Object.entries(BATTLE_VIEWS)) {
    for (const aspect of ASPECTS) {
      const view3d = camera(battleCameraPose(aspect, id), aspect);
      for (const corner of stageCorners()) {
        const { depth, x, y } = view3d.project(corner);
        assert.ok(depth > 0, `${id} ${aspect}: stage corner is in front of the camera`);
        assert.ok(Math.abs(x) <= view.margin + 1e-6 && Math.abs(y) <= view.margin + 1e-6,
          `${id} ${aspect}: ${corner} stays inside the frame (${x.toFixed(3)}, ${y.toFixed(3)})`);
      }
      // 무대 상자에 꼭 맞춘다: 적어도 한 모서리는 여유선에 닿아 화면을 낭비하지 않는다.
      const widest = Math.max(...stageCorners().map(corner => { const p = view3d.project(corner); return Math.max(Math.abs(p.x), Math.abs(p.y)); }));
      assert.ok(widest > view.margin - .01, `${id} ${aspect}: the stage fills the frame`);
    }
  }
});

test('the default battle view is a three-quarter view from behind the hero, not a flat side view', () => {
  const pose = battleCameraPose(16 / 9);
  const distance = x => Math.hypot(...sub(pose.position, [x, 1, 0]));
  assert.ok(pose.position[0] < -2, 'The camera swings round to the hero side');
  assert.ok(distance(HERO_HOME) < distance(ENEMY_HOME) - 1, 'The hero is nearer the camera so the enemy faces it');
  const view = BATTLE_VIEWS[DEFAULT_BATTLE_VIEW];
  assert.ok(Math.abs(view.yaw) >= 15 && view.pitch > 0, 'The angle is clearly oblique and looks slightly down');
  assert.deepEqual(battleCameraPose(16 / 9, 'missing'), pose, 'An unknown view falls back to the default');
  assert.deepEqual(battleCameraPose(16 / 9), pose, 'The same arena gives the same base pose, so shake returns exactly');
});

test('wide arenas narrow the field of view instead of bending the dungeon at the edges', () => {
  for (const aspect of ASPECTS) {
    const fov = battleFov(aspect);
    const horizontal = 2 * Math.atan(Math.tan(rad(fov / 2)) * aspect) * 180 / Math.PI;
    assert.ok(fov <= BATTLE_FOV + 1e-9);
    assert.ok(horizontal <= MAX_HORIZONTAL_FOV + 1e-6, `${aspect}: horizontal FOV ${horizontal.toFixed(1)}° is capped`);
    assert.equal(battleCameraPose(aspect).fov, fov);
  }
  assert.equal(battleFov(1.1), BATTLE_FOV, 'Phone-shaped arenas keep the usual 37° lens');
});

test('fog moves back with the camera so the fighters stay clear on wide screens', () => {
  for (const [id, view] of Object.entries(BATTLE_VIEWS)) {
    for (const aspect of ASPECTS) {
      const pose = battleCameraPose(aspect, id);
      const nearest = Math.max(...[HERO_HOME, ENEMY_HOME].map(x => Math.hypot(...sub(pose.position, [x, 1, 0]))));
      assert.ok(pose.fog[0] >= 12 && pose.fog[0] > nearest, `${id} ${aspect}: both fighters are closer than the fog`);
      assert.ok(Math.abs(pose.fog[1] - pose.fog[0] - 18) < 1e-9, 'The fog keeps the same depth');
    }
  }
});

test('the back wall runs past both edges of the widest battle frame, or ends inside the fog', () => {
  const walls = dungeonLayout('hall', 'battle').filter(item => item.piece.startsWith('wall'));
  const left = Math.min(...walls.map(item => item.position[0])) - TILE / 2;
  const right = Math.max(...walls.map(item => item.position[0])) + TILE / 2;
  const titleWalls = dungeonLayout('hall', 'title').filter(item => item.piece.startsWith('wall'));
  assert.equal(titleWalls.length, 11, 'Other scenes keep their original wall');
  for (const [id, view] of Object.entries(BATTLE_VIEWS)) {
    const pose = battleCameraPose(4.6, id), view3d = camera(pose, 4.6);
    for (const edge of [-1, 1]) for (const height of [-.2, 0, .3]) {
      const ray = view3d.forward.map((value, i) => value + edge * view3d.tanH * view3d.right[i] + height * view3d.tanV * view3d.up[i]);
      const t = (WALL_FRONT - pose.position[2]) / ray[2];
      const x = pose.position[0] + ray[0] * t, far = Math.hypot(...ray) * t > pose.fog[1];
      assert.ok(t > 0 && (x > left && x < right || far), `${id}: frame edge ${edge} meets the wall at x=${x.toFixed(2)} (wall ${left}~${right})`);
    }
  }
});

// ── 상황별 카메라 감독 ─────────────────────────────────────────────
import {
  CAMERA_SHOTS, CARD_SHOTS, IDLE_SWAY, approachPose, cameraCues, cameraKeyTime, createCameraPose, directCamera, fitShot,
} from '../src/game/three/cameraDirector.js';
import { fitView, cameraPosition } from '../src/game/three/battleCamera.js';
import { presentationPlan } from '../src/game/three/playback.js';
import { heroPose } from '../src/game/three/heroMotion.js';
import { CARD_MOTIONS } from '../src/game/cardMotions.js';
import { CARDS } from '../src/game/catalog.js';

const cardPlan = (cardType, extra = {}, context = {}, mode = 'full') => {
  const card = CARDS[cardType];
  const kind = card.damage ? 'attack' : card.heal ? 'heal' : 'block';
  return presentationPlan({ id: 1, kind, cardType, amount: 8, impacts: card.damage ? [8, 8] : undefined, ...extra }, context, mode);
};
const hurtPlan = (cue = {}, context = {}) => presentationPlan({ id: 2, kind: 'hurt', amount: 8, impacts: cue.heavy ? [12] : [4] }, { monsterType: 'sentinel', cue, ...context });
const enemyPlan = action => presentationPlan({ id: 3, kind: 'enemy', amount: 0, enemyAction: action }, { monsterType: 'sentinel' });
const at = (plan, elapsed, extra = {}) => directCamera({ aspect: 16 / 9, plan, elapsed, time: 0, ...extra }, createCameraPose());
const idle = (extra = {}) => at(undefined, 0, extra);
const shotsOf = plan => cameraCues(plan).map(item => item.shot);

const CARD_TYPES = Object.keys(CARD_MOTIONS);
const withoutTrack = plan => ({ ...plan, recipe: { ...plan.recipe, camera: undefined } });

test('each card plays its own camera track, and other moments get their own shot', () => {
  for (const type of CARD_TYPES) {
    const cues = cameraCues(cardPlan(type));
    assert.ok(cues.length === 1 && cues[0].track, `${type}: plays its card track`);
  }
  const sequences = new Set(CARD_TYPES.map(type => cameraCues(cardPlan(type))[0].keys.map(key => key.shot).join()));
  assert.equal(sequences.size, CARD_TYPES.length, 'No two cards move the camera the same way');
  assert.deepEqual(shotsOf(hurtPlan()), ['assault']);
  assert.deepEqual(shotsOf(enemyPlan('charge')), ['windup'], 'The enemy winding up a heavy attack is framed from below');
  assert.deepEqual(shotsOf(enemyPlan('block')), ['stance']);
  assert.deepEqual(shotsOf(cardPlan('strike', {}, { lethal: true })), ['track', 'finish']);
  assert.deepEqual(shotsOf(hurtPlan({}, { playerDead: true })), ['assault', 'fallen']);
  assert.deepEqual(shotsOf(cardPlan('strike', { kind: 'miss' })), [], 'A wrong answer does not move the camera');
  assert.deepEqual(shotsOf(cardPlan('heavy', {}, {}, 'calm')), [], 'Reduced motion plays no camera shots');
  // 카메라 키가 없는 카드는 역할에 맞는 장면 하나를 쓴다.
  assert.deepEqual(shotsOf(withoutTrack(cardPlan('strike'))), ['melee']);
  assert.deepEqual(shotsOf(withoutTrack(cardPlan('heavy'))), ['slam'], 'The heavy blow looks down along the slam');
  assert.deepEqual(shotsOf(withoutTrack(cardPlan('flare'))), ['ranged']);
  assert.deepEqual(shotsOf(withoutTrack(cardPlan('heal'))), ['self']);
  assert.deepEqual(shotsOf(withoutTrack(cardPlan('weaken'))), ['curse']);
  const strength = plan => cameraCues(plan)[0].strength;
  assert.ok(strength(withoutTrack(cardPlan('heavy'))) > strength(withoutTrack(cardPlan('strike'))), 'Heavier blows move the camera more');
  assert.ok(strength(hurtPlan({ heavy: true })) > strength(hurtPlan()), 'A heavy enemy attack moves the camera more');
});

test('card camera keys follow the card timeline and name real shots', () => {
  for (const [type, recipe] of Object.entries(CARD_MOTIONS)) {
    assert.ok(Array.isArray(recipe.camera) && recipe.camera.length >= 2, `${type}: has camera keys`);
    let previous = 0;
    for (const [at, shot, strength = 1] of recipe.camera) {
      const time = cameraKeyTime(recipe, at);
      assert.ok(Number.isFinite(time), `${type}: key ${at} resolves to a time`);
      assert.ok(time > previous && time < recipe.duration, `${type}: key ${at} (${time}ms) comes after the last key and before the end`);
      assert.ok(CARD_SHOTS[shot], `${type}: shot ${shot} exists`);
      assert.ok(strength > 0 && strength <= 1, `${type}: key ${at} strength ${strength}`);
      previous = time;
    }
    // 끝으로 돌아오는 시간이 너무 짧으면 카메라가 튄다.
    assert.ok(recipe.duration - previous >= 190, `${type}: leaves ${recipe.duration - previous}ms to return to rest`);
  }
  // 키 시점에는 정확히 그 장면에 도착해 있다(타격 정지 동안 그 구도에 머문다).
  const strike = cardPlan('strike'), contact = fitShot(CARD_SHOTS.contact, 16 / 9);
  const hit = at(strike, strike.hits[0]);
  assert.ok(Math.abs(hit.yaw - contact.yaw) < 1e-9 && Math.abs(hit.distance - contact.distance) < 1e-9, 'At the blow the camera is exactly on the contact shot');
});

test('every effect starts and ends exactly on the resting view and moves smoothly in between', () => {
  const plans = [...CARD_TYPES.map(type => cardPlan(type)), ...CARD_TYPES.map(type => cardPlan(type, { upgraded: true })),
    ...['strike', 'heavy', 'twin', 'flare', 'nova'].map(type => cardPlan(type, {}, { lethal: true })),
    cardPlan('twin', { impacts: [8, 0] }, { lethal: true }), withoutTrack(cardPlan('heavy')),
    hurtPlan(), hurtPlan({ heavy: true }), hurtPlan({ heavy: true }, { playerDead: true }), enemyPlan('charge'), enemyPlan('buff')];
  const rest = idle();
  for (const plan of plans) {
    const name = `${plan.cardType ?? plan.kind}${plan.lethal ? ' lethal' : ''}${plan.fatal ? ' fatal' : ''}`;
    assert.deepEqual(at(plan, 0), rest, `${name}: starts on the resting view`);
    assert.deepEqual(at(plan, plan.duration), rest, `${name}: is back on the resting view when the timeline ends`);
    let previous = at(plan, 0), moved = 0;
    for (let elapsed = 16; elapsed <= plan.duration; elapsed += 16) {
      const pose = at(plan, elapsed);
      moved = Math.max(moved, Math.abs(pose.yaw - rest.yaw) + Math.abs(pose.pitch - rest.pitch));
      assert.ok(Math.abs(pose.yaw - previous.yaw) < 2.6 && Math.abs(pose.pitch - previous.pitch) < 2.2 &&
        Math.abs(pose.distance - previous.distance) < .8 && Math.abs(pose.fov - previous.fov) < 1.5, `${name}: no jump at ${elapsed}ms`);
      previous = pose;
    }
    assert.ok(moved > 2, `${name}: the camera visibly changes angle (${moved.toFixed(1)}°)`);
  }
});

test('the quiz and reduced motion keep the camera perfectly still on the resting view', () => {
  const plan = cardPlan('heavy'), rest = idle({ studying: true });
  for (const elapsed of [0, 300, 700, 1100]) for (const time of [0, 2.5, 7]) {
    assert.deepEqual(at(plan, elapsed, { studying: true, time }), rest, 'Studying: no shot and no idle sway');
    assert.deepEqual(at(plan, elapsed, { reduced: true, time }), rest, 'Reduced motion: no shot and no idle sway');
  }
  const swaying = [0, 2, 4, 6, 8].map(time => idle({ time }));
  assert.ok(swaying.some(pose => Math.abs(pose.yaw - rest.yaw) > .3), 'While waiting, the camera breathes slightly');
  assert.ok(swaying.every(pose => Math.abs(pose.yaw - rest.yaw) <= IDLE_SWAY.yaw + 1e-9 && Math.abs(pose.pitch - rest.pitch) <= IDLE_SWAY.pitch + 1e-9));
});

test('every shot keeps its subject on screen and the camera above the floor at every arena shape', () => {
  const floorFront = Math.max(...dungeonLayout('hall', 'battle').filter(item => item.piece.startsWith('floor')).map(item => item.position[2])) + TILE / 2;
  for (const [id, shot] of Object.entries({ ...CAMERA_SHOTS, ...CARD_SHOTS })) for (const aspect of ASPECTS) {
    const fit = fitShot(shot, aspect), pose = { ...fit, position: cameraPosition(fit) };
    assert.ok(pose.position[1] > .4, `${id} ${aspect}: camera stays above the floor (${pose.position[1].toFixed(2)})`);
    assert.ok(pose.position[2] < floorFront - 1, `${id} ${aspect}: camera stays over the floor, so no gap shows at the bottom (z ${pose.position[2].toFixed(1)})`);
    const view3d = camera(pose, aspect);
    for (const x of shot.box.x) for (const y of shot.box.y) for (const z of BATTLE_STAGE.z) {
      const p = view3d.project([x, y, z]);
      assert.ok(p.depth > 0 && Math.abs(p.x) <= shot.margin + 1e-6 && Math.abs(p.y) <= shot.margin + 1e-6, `${id} ${aspect}: ${[x, y, z]} in frame`);
    }
  }
});

test('both fighters stay on screen in every shot except the hero falling, even on a phone', () => {
  for (const [id, shot] of Object.entries(CAMERA_SHOTS)) {
    if (id === 'fallen') continue;
    for (const aspect of ASPECTS) {
      const fit = fitView(shot, aspect, shot.box), view3d = camera({ ...fit, position: cameraPosition(fit) }, aspect);
      // 몸 폭까지 본다(기사 ±0.8, 적 ±0.6). 용사는 적에게 맞아 0.26만큼 밀려날 수 있다.
      const hero = HERO_HOME - .26, points = [];
      for (const z of [-.4, .4]) for (const side of [-1, 1]) points.push(
        ['hero feet', [hero + side * .8, .05, z]], ['hero head', [hero + side * .8, 1.6, z]],
        ['enemy feet', [ENEMY_HOME + side * .6, .05, z]], ['enemy head', [ENEMY_HOME + side * .6, 2, z]]);
      for (const [who, point] of points) {
        const p = view3d.project(point);
        assert.ok(p.depth > 0 && Math.abs(p.x) < .97 && Math.abs(p.y) < .97, `${id} ${aspect}: ${who} at home stays in frame (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`);
      }
    }
  }
});

test('enemy threats are framed from lower down, finishing blows from the side, and low health draws the camera in', () => {
  const rest = idle();
  const peak = (plan, from = 0, to = plan.duration) => {
    let best = null;
    for (let elapsed = from; elapsed <= to; elapsed += 10) { const pose = at(plan, elapsed); if (!best || Math.abs(pose.yaw - rest.yaw) + Math.abs(pose.pitch - rest.pitch) > Math.abs(best.yaw - rest.yaw) + Math.abs(best.pitch - rest.pitch)) best = pose; }
    return best;
  };
  assert.ok(peak(enemyPlan('charge')).pitch < 0, 'The wind-up is seen from below the enemy');
  assert.ok(peak(hurtPlan({ heavy: true })).pitch < rest.pitch - 5, 'A heavy enemy attack drops the camera low');
  const lethal = cardPlan('strike', {}, { lethal: true });
  const finish = peak(lethal, lethal.killAt, lethal.duration);
  assert.ok(finish.yaw < CAMERA_SHOTS.finish.yaw + 3 && finish.target[0] > rest.target[0] + .4, 'After the killing blow the camera swings round to the falling enemy');
  const danger = idle({ danger: true });
  assert.ok(danger.pitch < rest.pitch && danger.distance < rest.distance, 'Low health frames the fight lower and closer');
});

const floorFront = () => Math.max(...dungeonLayout('hall', 'battle').filter(item => item.piece.startsWith('floor')).map(item => item.position[2])) + TILE / 2;

test('every card track keeps both fighters on screen where they actually stand, on every arena shape', () => {
  const front = floorFront();
  const plans = [...CARD_TYPES.map(type => cardPlan(type)), ...['strike', 'heavy', 'twin'].map(type => cardPlan(type, {}, { lethal: true }))];
  const pose = {};
  for (const plan of plans) for (const aspect of ASPECTS) {
    const name = `${plan.cardType}${plan.lethal ? ' lethal' : ''} ${aspect}`;
    for (let elapsed = 0; elapsed <= plan.duration; elapsed += 20) {
      const shot = directCamera({ aspect, plan, elapsed, time: 0 }, createCameraPose());
      const view = { ...shot, position: cameraPosition(shot) }, view3d = camera(view, aspect);
      assert.ok(view.position[1] > .4 && view.position[2] < front - 1, `${name} ${elapsed}ms: camera stays above and over the floor`);
      heroPose({ plan, elapsed }, pose, {});
      // 몸 양옆과 발·머리까지 화면 안에 있어야 잘려 보이지 않는다. 기사 모델은 머리·어깨가 커서 중심에서 양옆으로 약 0.8이다
      // (미리보기 캡처에서 잰 값). 적은 기본 몬스터 기준으로 0.6이다.
      const head = 1.6 + Math.max(0, pose.y), points = [];
      for (const z of [-.4, .4]) for (const side of [-1, 1]) {
        points.push(['hero feet', [pose.x + side * .8, .05, z]], ['hero head', [pose.x + side * .8, head, z]],
          ['enemy feet', [ENEMY_HOME + side * .6, .05, z]], ['enemy head', [ENEMY_HOME + side * .6, 2, z]]);
      }
      for (const [who, point] of points) {
        const p = view3d.project(point);
        assert.ok(p.depth > 0 && Math.abs(p.x) < .96 && Math.abs(p.y) < .96, `${name} ${elapsed}ms: ${who} in frame (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`);
      }
    }
  }
});

test('each card moves the camera in its own rhythm', () => {
  const rest = idle(), plan = type => cardPlan(type), key = (type, name) => cameraKeyTime(CARD_MOTIONS[type], name);
  const heavy = plan('heavy');
  assert.ok(at(heavy, key('heavy', 'windup')).pitch < rest.pitch - 8, 'Heavy: looks up at the raised sword while gathering');
  assert.ok(at(heavy, heavy.hits[0]).pitch > rest.pitch + 8, 'Heavy: looks down on the crack as it lands');
  const twin = plan('twin'), rise = at(twin, twin.hits[0]), fall = at(twin, twin.hits[1]);
  assert.ok(rise.yaw > fall.yaw + 12 && rise.pitch < fall.pitch - 8, 'Twin: the camera crosses over between the rising and falling cut');
  const flare = plan('flare');
  assert.ok(at(flare, flare.hits[0]).target[0] > at(flare, key('flare', 'launch')).target[0] + 1.2, 'Flare: the camera follows the wave to the enemy');
  const strike = plan('strike'), contact = at(strike, strike.hits[0]);
  assert.ok(contact.target[0] > rest.target[0] + .5 && contact.distance < rest.distance, 'Strike: closes in on the contact');
  const nova = plan('nova'), hush = at(nova, nova.hits[0]), burst = at(nova, 1040);
  const width = pose => 2 * pose.distance * Math.tan(rad(pose.fov / 2));
  assert.ok(hush.fov < rest.fov - 6, 'Nova: a long lens holds the hush');
  assert.ok(burst.fov > rest.fov + 4 && width(burst) > width(hush) * 1.2 && burst.pitch > hush.pitch + 10, 'Nova: pulls up and wide after the burst');
  assert.ok(at(nova, key('nova', 'raise')).pitch < rest.pitch - 8, 'Nova: looks up at the sword calling the light');
  // 고요한 응시: 렌즈를 좁히며 물러나 용사의 화면 속 크기는 비슷하게 유지한다(돌리 줌).
  const focus = at(plan('focus'), key('focus', 'moment'));
  const heroSize = pose => { const view3d = camera({ ...pose, position: cameraPosition(pose) }, 16 / 9); return view3d.project([HERO_HOME, 1.6, 0]).y - view3d.project([HERO_HOME, 0, 0]).y; };
  assert.ok(focus.fov < rest.fov - 7 && focus.distance > rest.distance * 1.25, `Focus: narrows the lens and dollies back (${focus.fov.toFixed(1)}°, ${(focus.distance / rest.distance).toFixed(2)}×)`);
  assert.ok(Math.abs(heroSize(focus) / heroSize(rest) - 1) < .2, `Focus: the hero keeps about the same size (${(heroSize(focus) / heroSize(rest)).toFixed(2)})`);
  const oath = plan('oath');
  assert.ok(at(oath, key('oath', 'crest')).pitch > at(oath, 960).pitch + 15, 'Oath: looks down on the kneeling hero, then up at the crown');
  assert.ok(at(plan('flow'), key('flow', 'land')).yaw > rest.yaw + 12, 'Flow: swings round with the spin');
});

test('the following camera eases toward a new goal and lands on it exactly', () => {
  const now = idle(), goal = at(cardPlan('heavy'), 650);
  let settled = false, frames = 0;
  while (!settled && frames < 240) { settled = approachPose(now, goal, 1 - Math.exp(-14 / 60)); frames++; }
  assert.ok(settled && frames > 5 && frames < 120, `Settles in ${frames} frames without snapping`);
  assert.deepEqual(now, goal);
});
