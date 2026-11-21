export const ADMIN_PROGRESS_KEY = 'sword-master.admin.adventure.v1';
export const ADMIN_CHEATS_KEY = 'sword-master.admin.cheats.v1';

export const DEFAULT_ADMIN_CHEATS = Object.freeze({
  invincible: false,
  infiniteEnergy: false,
  oneHitKill: false,
  showAnswer: false,
  skipQuiz: false,
  unlockAllTiers: false,
});

const CHEAT_KEYS = Object.keys(DEFAULT_ADMIN_CHEATS);

export function normalizeAdminCheats(value) {
  return Object.fromEntries(
    CHEAT_KEYS.map((key) => [key, value?.[key] === true]),
  );
}

export function countActiveCheats(cheats) {
  return CHEAT_KEYS.reduce((total, key) => total + (cheats?.[key] === true ? 1 : 0), 0);
}

export function readAdminCheats(storage) {
  try {
    const raw = (storage ?? globalThis.localStorage).getItem(ADMIN_CHEATS_KEY);
    if (!raw) return { ...DEFAULT_ADMIN_CHEATS };
    const saved = JSON.parse(raw);
    if (saved?.version !== 1) return { ...DEFAULT_ADMIN_CHEATS };
    return normalizeAdminCheats(saved.cheats);
  } catch {
    return { ...DEFAULT_ADMIN_CHEATS };
  }
}

export function saveAdminCheats(cheats, storage) {
  try {
    (storage ?? globalThis.localStorage).setItem(ADMIN_CHEATS_KEY, JSON.stringify({
      version: 1,
      cheats: normalizeAdminCheats(cheats),
    }));
    return true;
  } catch {
    return false;
  }
}
