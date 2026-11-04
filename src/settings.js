export const SETTINGS_KEY = 'sword-master.settings.v1';

export const DEFAULT_SETTINGS = Object.freeze({
  textSize: 'normal',
  backgroundMotion: 'normal',
  selectionEffect: 'breathe',
  soundEffects: 'on',
});

const OPTIONS = {
  textSize: ['normal', 'large', 'larger'],
  backgroundMotion: ['normal', 'reduced', 'off'],
  selectionEffect: ['breathe', 'static'],
  soundEffects: ['on', 'off'],
};

export function normalizeSettings(value) {
  return Object.fromEntries(Object.entries(DEFAULT_SETTINGS).map(([key, fallback]) => [
    key, OPTIONS[key].includes(value?.[key]) ? value[key] : fallback,
  ]));
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
