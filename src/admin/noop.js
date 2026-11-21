import { PROGRESS_KEY } from '../game/storage.js';

export const ADMIN_MODE = false;
export const ACTIVE_PROGRESS_KEY = PROGRESS_KEY;

export const NOOP_CHEATS = Object.freeze({
  invincible: false,
  infiniteEnergy: false,
  oneHitKill: false,
  showAnswer: false,
  skipQuiz: false,
  unlockAllTiers: false,
});

const NOOP_ADMIN = Object.freeze({
  enabled: false,
  open: false,
  setOpen: () => {},
  toggleOpen: () => {},
  cheats: NOOP_CHEATS,
  activeCheatCount: 0,
  setCheat: () => {},
  resetCheats: () => {},
  registerBattleActions: () => () => {},
  createReducer: (base) => base,
});

export function AdminProvider({ children }) {
  return children;
}

export function useAdmin() {
  return NOOP_ADMIN;
}

export function AdminOverlay() {
  return null;
}
