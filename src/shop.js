export const CAPES = [
  { id: 'traveler', name: '여행자의 망토', price: 0, color: '#8e5e49', shade: '#624535', light: '#b07c54' },
  { id: 'forest', name: '숲지기의 망토', price: 80, color: '#4b8066', shade: '#305443', light: '#80b489' },
  { id: 'starlight', name: '별빛 망토', price: 100, color: '#596fa7', shade: '#3a486f', light: '#9cafe0' },
  { id: 'festival', name: '축제의 망토', price: 120, color: '#a15f86', shade: '#683d5d', light: '#d9a0b5' },
];
export const LENS_PRICE = 40;
export const MAX_LENSES = 99;
const MAX_COINS = 1_000_000_000;

export function emptyEconomy() {
  return { coins: 0, lenses: 0, owned: ['traveler'], equipped: 'traveler', cleared: [], storyComplete: false };
}

export function normalizeEconomy(value, encounterIds) {
  const result = emptyEconomy();
  if (!value || typeof value !== 'object') return result;
  for (const [key, max] of [['coins', MAX_COINS], ['lenses', MAX_LENSES]]) {
    if (Number.isSafeInteger(value[key]) && value[key] >= 0 && value[key] <= max) result[key] = value[key];
  }
  result.owned = CAPES.filter(({ id }) => id === 'traveler' || (Array.isArray(value.owned) && value.owned.includes(id))).map(({ id }) => id);
  if (result.owned.includes(value.equipped)) result.equipped = value.equipped;
  result.cleared = encounterIds.filter((id) => Array.isArray(value.cleared) && value.cleared.includes(id));
  result.storyComplete = value.storyComplete === true;
  return result;
}

export function equippedCape(economy) {
  return CAPES.find(({ id }) => id === economy.equipped) ?? CAPES[0];
}

export function addCoins(economy, amount) {
  return { ...economy, coins: Math.min(MAX_COINS, economy.coins + amount) };
}
