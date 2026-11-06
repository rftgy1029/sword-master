export const MONSTER_ROWS = ['crawler', 'sentinel', 'ember', 'bat', 'slime', 'mushroom', 'scarab', 'wisp', 'hound', 'ravager', 'watcher', 'boss'];
export const monsterSheet = new URL('../../assets/sprites/monsters.png', import.meta.url).href;
export const heroImage = new URL('../../assets/sprites/hero-young.png', import.meta.url).href;
export const statusSheet = new URL('../../assets/sprites/status-icons.png', import.meta.url).href;
export const monsterFrame = (type, pose = 0) => Math.max(0, MONSTER_ROWS.indexOf(type)) * 6 + pose;
