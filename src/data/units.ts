import type { UnitDefinition } from '../types.ts';

export const types: UnitDefinition[] = [
  { name: "돌격", cost: 60, hp: 110, damage: 18, speed: 48, range: 27, rate: .85, cd: 2.4, r: 17 },
  { name: "방패", cost: 100, hp: 340, damage: 10, speed: 27, range: 28, rate: 1.2, cd: 5, r: 23 },
  { name: "마법", cost: 140, hp: 85, damage: 40, speed: 34, range: 155, rate: 1.65, cd: 6, r: 18 }
];
