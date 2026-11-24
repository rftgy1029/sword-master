export const SETTINGS_KEY = 'sword-master.settings.v1';

export const DEFAULT_SETTINGS = Object.freeze({
  textSize: 'normal',
  backgroundMotion: 'normal',
  selectionEffect: 'breathe',
  renderer: 'auto',
  graphicsQuality: 'balanced',
  combatSound: 'on',
  combatVolume: 60,
  shortcutConfirm: 'single',
});

const OPTIONS = {
  textSize: ['normal', 'large', 'larger'],
  backgroundMotion: ['normal', 'reduced', 'off'],
  selectionEffect: ['breathe', 'static'],
  renderer: ['auto', '3d', '2d'],
  graphicsQuality: ['lowest', 'low', 'balanced', 'high'],
  combatSound: ['on', 'off'],
  shortcutConfirm: ['single', 'double'],
};

export function normalizeSettings(value) {
  const normalized = Object.fromEntries(Object.entries(OPTIONS).map(([key, options]) => [
    key, options.includes(value?.[key]) ? value[key] : DEFAULT_SETTINGS[key],
  ]));
  const volume = value?.combatVolume;
  normalized.combatVolume = Number.isFinite(volume) ? Math.min(100, Math.max(0, Math.round(volume))) : DEFAULT_SETTINGS.combatVolume;
  return normalized;
}

/**
 * Returns true only when storage already records an explicit graphics quality choice
 * (new visits and legacy 'auto' saves return false so the first-launch picker appears once).
 */
export function hasChosenGraphicsQuality(storage) {
  try {
    const saved = JSON.parse((storage ?? globalThis.localStorage).getItem(SETTINGS_KEY));
    return saved?.version === 1 && OPTIONS.graphicsQuality.includes(saved.settings?.graphicsQuality);
  } catch {
    return false;
  }
}

export function readSettings(storage) {
  try {
    const saved = JSON.parse((storage ?? globalThis.localStorage).getItem(SETTINGS_KEY));
    return normalizeSettings(saved?.version === 1 ? saved.settings : null);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings, storage) {
  try {
    (storage ?? globalThis.localStorage).setItem(SETTINGS_KEY, JSON.stringify({
      version: 1,
      settings: normalizeSettings(settings),
    }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve starting settings on app boot: preserve explicit user choices, or auto-initialize
 * and persist `recommendedQuality` on first visit / legacy 'auto' saves.
 */
export function resolveInitialSettings(recommendedQuality, storage) {
  if (hasChosenGraphicsQuality(storage)) {
    return { settings: readSettings(storage), autoInitialized: false };
  }
  const existing = readSettings(storage);
  const settings = normalizeSettings({ ...existing, graphicsQuality: recommendedQuality });
  saveSettings(settings, storage);
  return { settings, autoInitialized: true };
}
