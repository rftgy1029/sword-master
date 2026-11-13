import test from 'node:test';
import assert from 'node:assert/strict';
import { anchorPercent, overheadIntent, overheadStatuses, statusGains } from '../src/game/overhead.js';
import { emptyProgress, gameReducer, intentFor, reachableNodes } from '../src/game/engine.js';
import { MONSTERS } from '../src/game/catalog.js';

test('머리 위 적 의도는 intentFor의 수치와 종류를 그대로 짧게 보여 준다', () => {
  assert.deepEqual(overheadIntent({ kind: 'attack', value: 9 }), { kind: 'attack', icon: 'strike', label: '공격', tone: 'attack', value: '9', detail: '' });
  assert.equal(overheadIntent({ kind: 'attack', value: 4, hits: 2 }).value, '4×2');
  assert.equal(overheadIntent({ kind: 'block', value: 10 }).value, '+10');
  assert.equal(overheadIntent({ kind: 'buff', value: 3 }).label, '힘');
  assert.deepEqual(overheadIntent({ kind: 'charge', value: 23 }), { kind: 'charge', icon: 'heavy', label: '강타 준비', tone: 'charge', value: '', detail: '다음 피해 23' });
  assert.equal(overheadIntent({ kind: 'wait', value: 0 }).label, '숨 고르기');
  assert.equal(overheadIntent(null), null);
});

test('모든 몬스터 행동 패턴이 머리 위 표시를 가진다(약화·힘 반영 수치 포함)', () => {
  for (const [type, monster] of Object.entries(MONSTERS)) {
    monster.pattern.forEach((_, step) => {
      const intent = intentFor({ type, step, strength: 2, weak: 1 });
      const shown = overheadIntent(intent);
      assert.notEqual(shown.icon, 'spark', `${type} ${intent.kind}`);
      if (intent.kind === 'attack') assert.ok(shown.value.startsWith(String(intent.value)), `${type} attack value`);
    });
  }
});

test('지속 효과는 쪽마다 HUD와 같은 항목만, 0이면 빼고 보여 준다', () => {
  const battle = { block: 6, strength: 0, focus: 5, streak: 3, enemy: { block: 0, strength: 2, weak: 2 } };
  assert.deepEqual(overheadStatuses(battle, 'hero').map(({ id, text }) => [id, text]), [['block', '6'], ['focus', '+5']]);
  assert.deepEqual(overheadStatuses(battle, 'enemy').map(({ id, text }) => [id, text]), [['strength', '+2'], ['weak', '2턴']]);
  assert.deepEqual(overheadStatuses({ block: 0, strength: 0, focus: 0, enemy: { block: 0, strength: 0, weak: 0 } }, 'hero'), []);
});

test('새로 생기거나 늘어난 효과만 증가량으로 표시한다', () => {
  const before = overheadStatuses({ block: 6, strength: 2, focus: 0, enemy: {} }, 'hero');
  const after = overheadStatuses({ block: 4, strength: 4, focus: 5, enemy: {} }, 'hero');
  assert.deepEqual(statusGains(before, after), { strength: 2, focus: 5 });
  assert.deepEqual(statusGains(after, after), {});
});

test('실제 전투 상태에서 카드 결과가 머리 위 효과로 이어진다', () => {
  let p = gameReducer(emptyProgress(), { type: 'START', tier: 'bronze', seed: 42 });
  p = gameReducer(p, { type: 'SELECT_NODE', id: reachableNodes(p.run)[0].id });
  const b = p.run.battle;
  const shown = overheadStatuses(b, 'hero');
  assert.equal(shown.find((item) => item.id === 'block')?.value ?? 0, b.block);
  assert.deepEqual(overheadIntent(intentFor(b.enemy)).kind, intentFor(b.enemy).kind);
});

test('머리 위 위치는 상자 안 백분율로 바꾸고 가장자리와 위쪽 밖으로 나가지 않는다', () => {
  const box = { left: 100, top: 50, width: 800, height: 400 };
  assert.deepEqual(anchorPercent({ x: 300, y: 250 }, box), { left: 25, top: 50 });
  assert.deepEqual(anchorPercent({ x: 0, y: 0 }, box), { left: 8, top: 16 });
  assert.equal(anchorPercent({ x: 1000, y: 300 }, box).left, 92);
  assert.equal(anchorPercent(null, box), null);
  assert.equal(anchorPercent({ x: NaN, y: 1 }, box), null);
  assert.equal(anchorPercent({ x: 1, y: 1 }, { left: 0, top: 0, width: 0, height: 0 }), null);
});
