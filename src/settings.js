export const SETTINGS_KEY = 'sword-master.settings.v1';

export const DEFAULT_SETTINGS = Object.freeze({
  textSize: 'normal',
  backgroundMotion: 'normal',
  selectionEffect: 'breathe',
  renderer: 'auto',
  graphicsQuality: 'auto',
  combatSound: 'on',
  combatVolume: 60,
});

const OPTIONS = {
  textSize: ['normal', 'large', 'larger'],
  backgroundMotion: ['normal', 'reduced', 'off'],
  selectionEffect: ['breathe', 'static'],
  renderer: ['auto', '3d', '2d'],
  graphicsQuality: ['auto', 'low', 'balanced', 'high'],
  combatSound: ['on', 'off'],
};

export function normalizeSettings(value) {
  const normalized = Object.fromEntries(Object.entries(OPTIONS).map(([key, options]) => [
    key, options.includes(value?.[key]) ? value[key] : DEFAULT_SETTINGS[key],
  ]));
  const volume = value?.combatVolume;
  normalized.combatVolume = Number.isFinite(volume) ? Math.min(100, Math.max(0, Math.round(volume))) : DEFAULT_SETTINGS.combatVolume;
  return normalized;
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
