export const MONSTER_ROWS = ['crawler', 'sentinel', 'ember', 'bat', 'slime', 'mushroom', 'scarab', 'wisp', 'hound', 'ravager', 'watcher', 'boss'];
export const monsterSheet = new URL('../../assets/illustrations/monsters.webp', import.meta.url).href;
export const monsterAtlas = new URL('../../assets/illustrations/monsters.json', import.meta.url).href;
export const heroImage = new URL('../../assets/illustrations/hero.webp', import.meta.url).href;
export const heroPoses = new URL('../../assets/illustrations/hero-poses.webp', import.meta.url).href;
export const statusSheet = new URL('../../assets/sprites/status-icons.png', import.meta.url).href;
// Enemy motion is composed with transforms and effects around one intact painting.
export const monsterFrame = (type) => MONSTER_ROWS.includes(type) ? type : MONSTER_ROWS[0];
