import { CARD_MOTIONS, MISS_DURATION, UPGRADE_STOP } from '../cardMotions.js';
import { enemyActionPlan, enemyAttackPlan } from '../enemyAttackTimeline.js';

/** 처치하는 타격에 더하는 타격 정지(ms). 마무리 순간에만 길게 멈춘다. */
export const KILL_STOP = 120;
/** 처치 타격 뒤 적이 무너지고 사라지는 데 쓰는 시간(ms) */
export const KILL_TAIL = 980;
/** 마지막 타격 뒤 용사가 쓰러지는 데 쓰는 시간(ms) */
export const FALL_TAIL = 1200;
/**
 * '움직임 줄이기'의 짧은 결과 표시. 달려가거나 흔들지 않고, 타격·방어·회복 결과만 차례로 보여 준다.
 * first: 첫 결과까지, gap: 연속 타격 간격, tail: 마지막 결과 뒤 여운(ms)
 */
export const CALM_BEAT = Object.freeze({ first: 150, gap: 130, tail: 330, moment: 150, duration: 480 });

/**
 * 한 번의 전투 효과(effect)를 어떻게 보여 줄지 정한 계획. 게임 상태는 읽기만 한다.
 * @param {object} effect reducer가 만든 효과({id, kind, cardType, impacts, ...})
 * @param {{monsterType?: string, lethal?: boolean, playerDead?: boolean, cue?: {heavy?: boolean, raw?: number}}} context
 *   lethal: 이 효과로 적이 쓰러졌는지, playerDead: 이 공격으로 용사가 쓰러지는지, cue: 화면이 알려 주는 적 공격의 성격
 * @param {'full'|'calm'|'instant'} mode 기본·움직임 줄이기·움직임 끄기
 */
export function presentationPlan(effect, context = {}, mode = 'full') {
  const upgraded = !!effect.upgraded;
  let plan;
  if (effect.kind === 'hurt') {
    const attack = enemyAttackPlan(context.monsterType, effect, context.cue);
    plan = { side: 'enemy', kind: 'hurt', style: attack.style, color: attack.color, attack, heavy: attack.heavy, ranged: attack.ranged,
      duration: attack.duration, hits: [...attack.hits], stops: [...attack.stops], powers: attack.hits.map(() => attack.power) };
    if (context.playerDead) {
      plan.fatal = true;
      plan.downAt = plan.hits.at(-1);
      plan.duration = Math.max(plan.duration, plan.downAt + FALL_TAIL);
    }
  } else if (effect.kind === 'enemy') {
    const action = enemyActionPlan(context.monsterType, effect.enemyAction);
    plan = { side: 'enemy', kind: 'enemy', style: action.style, color: action.color, action: effect.enemyAction,
      duration: action.duration, moment: action.moment, hits: [], stops: [], powers: [] };
  } else {
    const recipe = CARD_MOTIONS[effect.cardType];
    const base = { side: 'hero', kind: effect.kind, cardType: effect.cardType, recipe, upgraded,
      role: recipe?.role ?? 'self', color: recipe?.color ?? 0xd6ddb1 };
    if (effect.kind === 'miss') plan = { ...base, style: 'miss', duration: MISS_DURATION, hits: [], stops: [], powers: [] };
    else if (effect.kind === 'attack' && recipe?.hits) {
      plan = { ...base, style: recipe.style, duration: recipe.duration, hits: [...recipe.hits],
        stops: recipe.hitStop.map((stop) => stop + (upgraded ? UPGRADE_STOP : 0)), powers: recipe.power.map((power) => power * (upgraded ? 1.15 : 1)) };
    } else plan = { ...base, style: recipe?.style ?? 'plain', duration: recipe?.duration ?? 650, moment: recipe?.moment ?? 300, hits: [], stops: [], powers: [] };
    if (context.lethal && effect.kind !== 'miss') {
      plan.lethal = true;
      // Reducer impacts are capped by remaining HP. Ignore any zeroes after the killing blow.
      const lastDamage = effect.impacts?.findLastIndex((amount) => amount > 0) ?? -1;
      plan.killIndex = lastDamage >= 0 && lastDamage < plan.hits.length ? lastDamage : plan.hits.length - 1;
      plan.killAt = plan.hits[plan.killIndex] ?? plan.moment;
      if (plan.killIndex >= 0) plan.stops[plan.killIndex] += KILL_STOP;
      plan.duration = Math.max(plan.duration, plan.killAt + KILL_TAIL);
    }
  }
  if (mode === 'calm') {
    const count = plan.hits.length;
    plan.calm = true;
    plan.hits = plan.hits.map((_, index) => CALM_BEAT.first + index * CALM_BEAT.gap);
    plan.stops = plan.stops.map(() => 0);
    if (plan.moment !== undefined) plan.moment = CALM_BEAT.moment;
    plan.duration = count ? plan.hits.at(-1) + CALM_BEAT.tail : CALM_BEAT.duration;
    if (plan.lethal) plan.killAt = count ? plan.hits[plan.killIndex] : plan.moment;
    if (plan.fatal) plan.downAt = plan.hits.at(-1);
  }
  const count = plan.hits.length;
  plan.hitInfo = plan.hits.map((at, index) => {
    const amount = effect.impacts?.[index] ?? (count ? Math.round((effect.amount ?? 0) / count) : 0);
    const last = index === count - 1;
    const lethal = plan.lethal ? index === plan.killIndex : !!(plan.fatal && last);
    return { effectId: effect.id, index, at, amount, last, power: plan.powers[index] ?? 1, target: plan.side === 'enemy' ? 'player' : 'enemy',
      // 방어가 피해를 모두 막은 타격. 처치 타격은 막힌 것으로 치지 않는다.
      blocked: amount === 0 && !(plan.lethal && index > plan.killIndex), partial: !!plan.attack?.partial[index],
      lethal, heavy: !!plan.heavy || (plan.powers[index] ?? 1) >= 1.6 };
  });
  return plan;
}

// 연출 전용: 게임 상태는 reducer가 관리한다. 이 재생기는 타격 시점을 알릴 뿐 피해를 적용하지 않는다.
export function combatMotionMode(preference, systemReduced = false) {
  return preference === 'off' ? 'instant' : preference === 'reduced' || systemReduced ? 'calm' : 'full';
}

export class CombatPlayback {
  constructor({ initialEffectId = 0, onBusy = () => {}, onImpact = () => {}, onMoment = () => {}, onStart = () => {}, onFrame = () => {} } = {}) {
    this.lastId = initialEffectId;
    this.onBusy = onBusy;
    this.onImpact = onImpact;
    this.onMoment = onMoment;
    this.onStart = onStart;
    this.onFrame = onFrame;
    this.active = null;
    this.disposed = false;
  }
  /**
   * 새 효과의 연출을 시작한다. 이미 재생한 effect ID는 다시 재생하지 않는다.
   * @param {object} effect
   * @param {object|string} context presentationPlan의 context. 몬스터 종류만 문자열로 넘겨도 된다.
   * @param {'full'|'calm'|'instant'|boolean} mode true는 'instant'(움직임 끄기)와 같다.
   */
  start(effect, context = {}, mode = 'full') {
    if (this.disposed || !effect || effect.id === this.lastId) return false;
    if (typeof context === 'string') context = { monsterType: context };
    if (mode === true) mode = 'instant';
    else if (mode !== 'calm' && mode !== 'instant') mode = 'full';
    this.finish();
    this.lastId = effect.id;
    const plan = presentationPlan(effect, context, mode);
    this.active = { effect, plan, context, mode, enemy: effect.kind === 'hurt',
      // elapsed: 연출 시간표의 위치(타격 정지 동안 멈춘다). clock: 실제로 흐른 시간. prev: 직전 프레임의 elapsed.
      elapsed: 0, prev: -1, clock: 0, stop: 0, stopIndex: -1, delivered: 0,
      hits: plan.hits, impactAt: [], duration: plan.duration };
    this.onBusy(true, effect.id);
    this.onStart(this.active);
    if (mode === 'instant') this.finish();
    return true;
  }
  advance(delta) {
    const current = this.active;
    if (!current || this.disposed || !Number.isFinite(delta)) return null;
    let left = Math.max(0, delta);
    const startClock = current.clock, total = left;
    current.prev = current.elapsed;
    // 다음 타격 시점에서 한 번 멈춰 타격 정지를 쌓고, 남은 시간은 그 정지 시간부터 소비한다.
    for (;;) {
      current.clock = startClock + (total - left);
      this.deliver(current);
      if (left <= 0 || current.elapsed >= current.duration) break;
      if (current.stop > 0) { const used = Math.min(current.stop, left); current.stop -= used; left -= used; continue; }
      const nextHit = current.hits[current.delivered] ?? Infinity;
      const nextMoment = current.momentDelivered ? Infinity : (current.plan.moment ?? Infinity);
      const next = Math.min(nextHit, nextMoment);
      const boundary = Math.min(next, current.duration);
      const remaining = boundary - current.elapsed;
      if (left >= remaining) {
        current.elapsed = boundary;
        left -= remaining;
      } else {
        current.elapsed += left;
        left = 0;
      }
    }
    current.clock = startClock + total;
    this.onFrame(current);
    if (current.elapsed >= current.duration) this.finish();
    return current;
  }
  deliver(current) {
    if (!current.momentDelivered && current.plan.moment !== undefined && current.elapsed >= current.plan.moment) {
      current.momentDelivered = true;
      this.onMoment(current);
    }
    while (current.delivered < current.hits.length && current.hits[current.delivered] <= current.elapsed) {
      const index = current.delivered++;
      current.impactAt[index] = current.clock;
      if (current.mode === 'full') { current.stop += current.plan.stops[index] ?? 0; current.stopIndex = index; }
      this.onImpact(index, current.enemy ? 'player' : undefined, current.plan.hitInfo[index], current);
    }
  }
  finish() {
    if (!this.active || this.disposed) return;
    const current = this.active;
    current.prev = current.elapsed;
    current.elapsed = current.duration;
    current.stop = 0;
    this.deliver(current);
    this.active = null;
    this.onBusy(false, current.effect.id);
  }
  dispose() { this.disposed = true; this.active = null; }
}

/** 이번 프레임에 연출 시간표가 at(ms)을 지났는가. 소리·일회성 효과를 한 번만 내는 데 쓴다. */
export function crossed(current, at) {
  return !!current && current.prev < at && at <= current.elapsed;
}

/**
 * 각 타격 이후 흐른 실제 시간(ms). 아직 맞지 않은 타격은 -1.
 * 타격 정지 동안에도 불꽃·섬광은 계속 움직여야 하므로 연출 시계(clock)를 쓴다.
 */
export function impactAges(current, out = []) {
  out.length = current?.hits.length ?? 0;
  for (let index = 0; index < out.length; index++) {
    out[index] = index < current.delivered ? current.clock - (current.impactAt[index] ?? current.clock) : -1;
  }
  return out;
}

/** 타격 정지 중이면 그 타격의 번호, 아니면 -1 */
export function hitStopIndex(current) {
  return current && current.stop > 0 ? current.stopIndex : -1;
}
