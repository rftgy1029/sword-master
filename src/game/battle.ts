import { stages } from '../data/stages.ts';
import { types } from '../data/units.ts';
import type { BattleState, CombatStats, GameMode, Fighter } from '../types.ts';
import { rules } from './rules.ts';

const enemies: CombatStats[] = [
  { hp: 95, damage: 12, speed: 29, range: 25, rate: 1.2, r: 18 },
  { hp: 65, damage: 10, speed: 53, range: 24, rate: .8, r: 14 },
  { hp: 220, damage: 22, speed: 21, range: 30, rate: 1.5, r: 25 },
];

/** Browser-independent battle simulation. Rendering never mutates this state. */
export class Battle {
  state!: BattleState;
  stageIndex = 0;
  private random: () => number;

  constructor(random = Math.random) {
    this.random = random;
    this.setupStage(0, 'intro');
  }

  get stage() { return stages[this.stageIndex]; }

  setupStage(index: number, mode: GameMode = 'running') {
    if (!Number.isInteger(index) || !stages[index]) throw new RangeError('Invalid stage');
    this.stageIndex = index;
    this.state = {
      mode,
      energy: rules.initialEnergy,
      ownHP: rules.ownBaseHP,
      enemyHP: this.stage.hp,
      units: [], fx: [], cooldowns: types.map(() => 0), time: 0, spawn: 4,
    };
  }

  addEnergy(amount: number) {
    if (Number.isFinite(amount) && amount > 0) {
      this.state.energy = Math.min(rules.maxEnergy, this.state.energy + amount);
    }
  }

  summonStatus(index: number) {
    const t = types[index];
    const g = this.state;
    if (!t) return '존재하지 않는 유닛';
    if (g.mode !== 'running') return '전투 중에 소환 가능';
    if (g.units.filter(u => u.side === 1).length >= rules.maxAllies) return '아군 최대 수 도달';
    if (g.cooldowns[index] > 0) return `${g.cooldowns[index].toFixed(1)}초 후 소환 가능`;
    if (g.energy < t.cost) return '에너지 부족';
    return '소환 가능';
  }

  summon(index: number) {
    if (this.summonStatus(index) !== '소환 가능') return false;
    const t = types[index];
    const g = this.state;
    g.energy -= t.cost;
    g.cooldowns[index] = t.cd;
    g.units.push({
      ...t, side: 1, type: index, x: rules.allySpawnX, maxHP: t.hp,
      attack: 0, hit: 0, phase: this.random() * 6,
    });
    return true;
  }

  togglePause() {
    if (this.state.mode === 'running') this.state.mode = 'paused';
    else if (this.state.mode === 'paused') this.state.mode = 'running';
  }

  private spawnEnemy() {
    const g = this.state;
    if (g.units.filter(u => u.side === -1).length >= rules.maxEnemies) return;
    const power = this.stage.power * (1 + Math.min(g.time / 240, .6));
    const roll = this.random();
    const kind = roll < .18 ? 2 : roll < .5 ? 1 : 0;
    const e = enemies[kind];
    g.units.push({
      ...e, hp: e.hp * power, damage: e.damage * power, maxHP: e.hp * power,
      side: -1, type: kind, x: rules.enemySpawnX, attack: .4, hit: 0,
      phase: this.random() * 6,
    });
  }

  private effect(x: number, y: number, label: string, color: string) {
    if (this.state.fx.length < 80) {
      this.state.fx.push({ x, y, text: label, color, life: .65, max: .65 });
    }
  }

  update(dt: number) {
    const g = this.state;
    if (g.mode !== 'running' || !Number.isFinite(dt) || dt <= 0) return;
    g.time += dt;
    this.addEnergy(rules.energyPerSecond * dt);
    g.cooldowns = g.cooldowns.map(c => Math.max(0, c - dt));
    g.spawn -= dt;
    if (g.spawn <= 0) {
      this.spawnEnemy();
      g.spawn = Math.max(2.3, this.stage.interval - g.time / 130);
    }

    for (const u of g.units) {
      if (u.hp <= 0) continue;
      u.attack = Math.max(0, u.attack - dt);
      u.hit = Math.max(0, u.hit - dt);

      const targets = g.units.filter(v => v.side !== u.side && v.hp > 0);
      targets.sort((a, b) => Math.abs(a.x - u.x) - Math.abs(b.x - u.x));
      const target: Fighter | { x: number; r: number; base: true } = targets[0] ?? {
        x: u.side === 1 ? rules.enemyBaseX : rules.ownBaseX,
        r: rules.baseRadius, base: true,
      };
      const distance = Math.abs(target.x - u.x);

      if (distance <= u.range + target.r + .01) {
        if (u.attack <= 0) {
          u.attack = u.rate;
          const color = u.side === 1 ? '#477e56' : '#bc6659';
          if ('base' in target) {
            if (u.side === 1) g.enemyHP = Math.max(0, g.enemyHP - u.damage);
            else g.ownHP = Math.max(0, g.ownHP - u.damage);
            this.effect(target.x, 205, '−' + Math.round(u.damage), color);
          } else {
            target.hp -= u.damage;
            target.hit = .16;
            this.effect(target.x, 248 - target.r, '−' + Math.round(u.damage), color);
            if (target.hp <= 0 && u.side === 1) this.addEnergy(rules.killReward);
          }
          if (u.type === 2 && u.side === 1 && g.fx.length < 80) {
            g.fx.push({ x: u.x, y: 250, tx: target.x, life: .16, max: .16, beam: true });
          }
        }
      } else {
        const step = Math.min(u.speed * dt, Math.max(0, distance - u.range - target.r));
        u.x += Math.sign(target.x - u.x) * step;
      }
    }

    g.units = g.units.filter(u => u.hp > 0);
    g.fx.forEach(f => f.life -= dt);
    g.fx = g.fx.filter(f => f.life > 0);
    if (g.ownHP <= 0) g.mode = 'lost';
    else if (g.enemyHP <= 0) g.mode = this.stageIndex === stages.length - 1 ? 'complete' : 'won';
  }
}
