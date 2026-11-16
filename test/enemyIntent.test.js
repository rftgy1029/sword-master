import test from 'node:test';
import assert from 'node:assert/strict';
import { describeEnemyIntent } from '../src/game/enemyIntent.js';
import { intentFor } from '../src/game/engine.js';
import { MONSTERS } from '../src/game/catalog.js';

test('공격 의도는 내 방어와 체력에 따라 위협·방어됨·치명과 예상 피해를 정확히 계산한다', () => {
  const multiHit = { kind: 'attack', value: 3, hits: 3, label: '공격 3 × 3회' };

  const raw = describeEnemyIntent(multiHit, { playerBlock: 0, playerHp: 20 });
  assert.equal(raw.stance, '위협');
  assert.equal(raw.tone, 'threat');
  assert.equal(raw.title, '공격 3 × 3');
  assert.equal(raw.summary, 'HP -9 예상');
  assert.deepEqual(raw.damage, { total: 9, blocked: 0, hpLoss: 9, blockedAll: false, fatal: false });

  const partial = describeEnemyIntent(multiHit, { playerBlock: 6, playerHp: 20 });
  assert.equal(partial.stance, '위협');
  assert.equal(partial.summary, '방어 후 HP -3');
  assert.deepEqual(partial.damage, { total: 9, blocked: 6, hpLoss: 3, blockedAll: false, fatal: false });

  const guarded = describeEnemyIntent(multiHit, { playerBlock: 9, playerHp: 20 });
  assert.equal(guarded.stance, '방어됨');
  assert.equal(guarded.tone, 'guarded');
  assert.equal(guarded.summary, '모두 막음 · 피해 0');
  assert.deepEqual(guarded.damage, { total: 9, blocked: 9, hpLoss: 0, blockedAll: true, fatal: false });

  const fatal = describeEnemyIntent(multiHit, { playerBlock: 4, playerHp: 5 });
  assert.equal(fatal.stance, '치명');
  assert.equal(fatal.tone, 'fatal');
  assert.equal(fatal.summary, 'HP -5 치명');
  assert.equal(fatal.damage.fatal, true);
});

test('비공격 의도는 이번 턴 피해 0 여부와 기회/경고/주의 성격을 분명히 구분한다', () => {
  const wait = describeEnemyIntent({ kind: 'wait', value: 0, label: '숨 고르기' });
  assert.equal(wait.stance, '기회');
  assert.equal(wait.tone, 'opportunity');
  assert.equal(wait.summary, '피해 0 · 공격 찬스');
  assert.match(wait.tooltip.verdict, /유리한 기회/);

  const charge = describeEnemyIntent({ kind: 'charge', value: 18, label: '강타 준비' });
  assert.equal(charge.stance, '경고');
  assert.equal(charge.tone, 'warning');
  assert.equal(charge.summary, '피해 0 · 다음 강타 18');
  assert.match(charge.tooltip.tip, /내 방어는 턴이 끝나면 사라/);

  const buff = describeEnemyIntent({ kind: 'buff', value: 3, label: '힘 +3' });
  assert.equal(buff.stance, '주의');
  assert.equal(buff.tone, 'warning');
  assert.equal(buff.summary, '피해 0 · 적 공격 +3');

  const block = describeEnemyIntent({ kind: 'block', value: 10, label: '방어 10 획득' });
  assert.equal(block.stance, '주의');
  assert.equal(block.tone, 'warning');
  assert.equal(block.title, '적 방어 +10');
  assert.equal(block.summary, '피해 0 · 다음 턴 방어막');
});

test('진행 중 상태와 null 입력 및 모든 몬스터 패턴을 안전하게 처리한다', () => {
  assert.equal(describeEnemyIntent(null), null);
  const acting = describeEnemyIntent({ kind: 'wait', value: 0 }, { acting: true });
  assert.equal(acting.timing, '진행 중');

  const weakenedZero = describeEnemyIntent({ kind: 'attack', value: 0 }, { playerBlock: 0, playerHp: 10 });
  assert.equal(weakenedZero.damage.blockedAll, true);
  assert.match(weakenedZero.tooltip.verdict, /피해가 0/);

  for (const [type, monster] of Object.entries(MONSTERS)) {
    monster.pattern.forEach((_, step) => {
      const intent = intentFor({ type, step, strength: 2, weak: 1 });
      const view = describeEnemyIntent(intent, { playerBlock: 6, playerHp: 30 });
      assert.ok(view.stance && view.title && view.summary, `${type} step ${step}`);
      assert.ok(view.tooltip.title && view.tooltip.verdict && view.tooltip.tip, `${type} tooltip ${step}`);
    });
  }
});
