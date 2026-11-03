export type Difficulty = 'basic' | 'intermediate';
export type Word = [english: string, meaning: string, hint: string];
export type GameMode = 'intro' | 'running' | 'paused' | 'won' | 'lost' | 'complete';

export interface Stage {
  name: string;
  hp: number;
  interval: number;
  power: number;
  sky: string;
}

export interface CombatStats {
  hp: number;
  damage: number;
  speed: number;
  range: number;
  rate: number;
  r: number;
}

export interface UnitDefinition extends CombatStats {
  name: string;
  cost: number;
  cd: number;
}

export interface Fighter extends CombatStats {
  side: 1 | -1;
  type: number;
  x: number;
  maxHP: number;
  attack: number;
  hit: number;
  phase: number;
}

interface EffectBase {
  x: number;
  y: number;
  life: number;
  max: number;
}

export type Effect =
  | (EffectBase & { beam?: false; text: string; color: string })
  | (EffectBase & { beam: true; tx: number });

export interface BattleState {
  mode: GameMode;
  energy: number;
  ownHP: number;
  enemyHP: number;
  units: Fighter[];
  fx: Effect[];
  cooldowns: number[];
  time: number;
  spawn: number;
}

export interface Mistake {
  meaning: string;
  count: number;
  recovered: boolean;
}
