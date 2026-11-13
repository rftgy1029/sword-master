import { ATTACK_DURATION, ATTACK_HITS, attackPose } from '../attackTimeline.js';
import { CARD_MOTIONS } from '../cardMotions.js';
import { enemyAttackPlan, enemyAttackPose } from '../enemyAttackTimeline.js';

// 타격 순간 화면을 잠깐 멈춰(히트스톱) 칼이 '박히는' 느낌을 준다. 몬스터 공격은 멈추지 않는다.
export const HIT_STOP = Object.freeze({ strike: 90, heavy: 150, twin: 65, flare: 70, nova: 120 });
// 타격 효과(카메라 흔들림, 번쩍임, 불꽃)의 세기. 1이 기본 베기.
export const IMPACT_POWER = Object.freeze({ strike: 1, heavy: 1.7, twin: .75, flare: .9, nova: 1.4 });
const clamp01 = value => Math.max(0, Math.min(1, value));

// Presentation only: the reducer remains the owner of all game state.
export class CombatPlayback {
  constructor({ initialEffectId = 0, onBusy = () => {}, onImpact = () => {} } = {}) {
    this.lastId = initialEffectId;
    this.onBusy = onBusy;
    this.onImpact = onImpact;
    this.active = null;
    this.disposed = false;
  }
  start(effect, monsterType, reduced = false) {
    if (this.disposed || !effect || effect.id === this.lastId) return false;
    this.finish();
    this.lastId = effect.id;
    const enemy = effect.kind === 'hurt';
    const plan = enemy || effect.kind==='enemy' ? enemyAttackPlan(monsterType, effect) : null;
    const hits = enemy ? plan.hits : effect.kind === 'attack' ? ATTACK_HITS[effect.cardType] ?? [] : [];
    this.active = { effect, plan, enemy, elapsed: 0, delivered: 0, hits, clock: 0, stop: 0, impactAt: [],
      duration: enemy ? plan.duration : effect.kind === 'attack' ? ATTACK_DURATION : effect.kind === 'miss' ? 450 : CARD_MOTIONS[effect.cardType]?.duration ?? 650 };
    this.onBusy(true);
    if (reduced) this.finish();
    return true;
  }
  advance(delta) {
    const current = this.active;
    if (!current || this.disposed) return null;
    let left = Math.max(0, delta);
    current.clock += left;
    // 다음 타격 시점에서 한 번 멈춰 히트스톱을 쌓고, 남은 시간은 그 정지 시간부터 소비한다.
    for (;;) {
      this.deliver(current);
      if (left <= 0 || current.elapsed >= current.duration) break;
      if (current.stop > 0) { const used = Math.min(current.stop, left); current.stop -= used; left -= used; continue; }
      const next = current.hits[current.delivered] ?? Infinity;
      const step = Math.min(left, next - current.elapsed, current.duration - current.elapsed);
      current.elapsed += step; left -= step;
    }
    if (current.elapsed >= current.duration) this.finish();
    return current;
  }
  deliver(current) {
    while (current.delivered < current.hits.length && current.hits[current.delivered] <= current.elapsed) {
      current.impactAt[current.delivered] = current.clock;
      if (!current.enemy && !current.manual) current.stop += (HIT_STOP[current.effect.cardType] ?? 0) + (current.effect.upgraded ? 30 : 0);
      this.onImpact(current.delivered++, current.enemy ? 'player' : undefined);
    }
  }
  finish() {
    if (!this.active || this.disposed) return;
    const current = this.active;
    current.elapsed = current.duration;
    this.deliver(current);
    this.active = null;
    this.onBusy(false);
  }
  dispose() { this.disposed = true; this.active = null; }
}

export function combatPose(current) {
  if (!current) return { heroX: -2.3, enemyX: 2.3, heroY: 0, enemyY: 0, heroLean: 0, enemyLean: 0, progress: 0 };
  const { effect, elapsed, duration, enemy, plan } = current;
  const progress = Math.min(1, elapsed / duration);
  if (enemy) {
    const pose = enemyAttackPose(plan, elapsed);
    return { heroX: -2.3 - pose.recoil * .15, enemyX: 2.3 - 4.6 * pose.advance, heroY: 0, enemyY: -pose.lift / 90,
      heroLean: pose.recoil * .08, enemyLean: -pose.lean / 100, progress };
  }
  const pose = effect.kind === 'attack' ? attackPose(effect.cardType, elapsed) : null;
  const ranged=['flare','nova'].includes(effect.cardType);
  // 뒤로 살짝 물러섰다가(예비 동작) 튀어 나가 타격 직전에 멈춘다(ease-out 돌진).
  const first=current.hits[0]??800;
  const windup=Math.sin(Math.PI*clamp01((elapsed-200)/300))*.28;
  const drive=clamp01((elapsed-480)/Math.max(1,first-40-480));
  const meleeAdvance=(2.95*(1-(1-drive)**3)-windup*(1-drive))*(1-(pose?.recovery??0));
  // 맞은 쪽은 순식간에 밀려났다가 천천히 제자리로 돌아온다.
  const power=IMPACT_POWER[effect.cardType]??1;
  const recoil = current.hits.reduce((sum, hit) => {
    const t=(elapsed-hit)/420;
    if(t<0||t>1)return sum;
    return sum+(t<.12?t/.12:(1-(t-.12)/.88)**2)*.3*Math.min(1.5,power);
  }, 0);
  return { heroX: -2.3 + (pose ? ranged ? pose.advance*9 : meleeAdvance : 0), enemyX: 2.3 + recoil, heroY: -(pose?.lift ?? 0) / 80, enemyY: 0,
    heroLean: -(pose?.lean ?? 0) / 120, enemyLean: -recoil * .5, progress };
}

/**
 * 각 타격 이후 흐른 실제 시간(ms). 히트스톱 동안에도 효과는 계속 움직여야 하므로 연출 시계(clock)를 쓴다.
 * 검증 페이지가 특정 시점을 고정해 보는 수동 모드에서는 연출 시간표 기준으로 계산한다.
 */
export function impactAges(current) {
  if (!current) return [];
  return current.hits.map((hit, index) => {
    if (current.manual) return current.elapsed >= hit ? current.elapsed - hit : -1;
    return index < current.delivered ? current.clock - (current.impactAt[index] ?? current.clock) : -1;
  });
}
