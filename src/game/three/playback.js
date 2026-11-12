import { ATTACK_DURATION, ATTACK_HITS, attackPose } from '../attackTimeline.js';
import { CARD_MOTIONS } from '../cardMotions.js';
import { enemyAttackPlan, enemyAttackPose } from '../enemyAttackTimeline.js';

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
    this.active = { effect, plan, enemy, elapsed: 0, delivered: 0, hits,
      duration: enemy ? plan.duration : effect.kind === 'attack' ? ATTACK_DURATION : effect.kind === 'miss' ? 450 : CARD_MOTIONS[effect.cardType]?.duration ?? 650 };
    this.onBusy(true);
    if (reduced) this.finish();
    return true;
  }
  advance(delta) {
    const current = this.active;
    if (!current || this.disposed) return null;
    current.elapsed = Math.min(current.duration, current.elapsed + Math.max(0, delta));
    this.deliver(current);
    if (current.elapsed >= current.duration) this.finish();
    return current;
  }
  deliver(current) {
    while (current.delivered < current.hits.length && current.hits[current.delivered] <= current.elapsed) {
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
  const drive=Math.max(0,Math.min(1,(elapsed-450)/Math.max(1,(current.hits[0]??800)-450)));
  const meleeAdvance=3.05*drive*drive*(3-2*drive)*(1-(pose?.recovery??0));
  const recoil = current.hits.reduce((sum, hit) => sum + Math.sin(Math.PI * Math.min(1, Math.max(0, (elapsed - hit) / 300))) * .13, 0);
  return { heroX: -2.3 + (pose ? ranged ? pose.advance*9 : meleeAdvance : 0), enemyX: 2.3 + recoil, heroY: -(pose?.lift ?? 0) / 80, enemyY: 0,
    heroLean: -(pose?.lean ?? 0) / 120, enemyLean: -recoil * .3, progress };
}
