// Shared rules for gameplay, UI, and rendering.
export const rules = {
  ownBaseHP: 900,
  initialEnergy: 120,
  maxEnergy: 999,
  energyPerSecond: 3,
  correctReward: 55,
  comboEvery: 3,
  comboReward: 35,
  killReward: 8,
  maxAllies: 16,
  maxEnemies: 24,
  ownBaseX: 70,
  enemyBaseX: 930,
  allySpawnX: 115,
  enemySpawnX: 885,
  baseRadius: 32,
} as const;
