export const MODEL_TYPES = Object.freeze(['hero', 'crawler', 'sentinel', 'ember', 'bat', 'slime', 'mushroom', 'scarab', 'wisp', 'hound', 'ravager', 'watcher', 'boss']);
export const modelUrl = (type) => `${import.meta.env?.BASE_URL ?? '/'}models/${MODEL_TYPES.includes(type) ? type : 'sentinel'}.glb`;

export function qualityProfile(choice = 'auto', { compact = false, pixelRatio = 1 } = {}) {
  const level = choice === 'auto' ? compact ? 'low' : 'balanced' : choice;
  const profiles = {
    low: { level: 'low', dpr: Math.min(pixelRatio, 1), shadows: false, shadowSize: 512, fps: 30, particles: 16, trail: 8, debris: 4, bloom: false },
    balanced: { level: 'balanced', dpr: Math.min(pixelRatio, 1.5), shadows: true, shadowSize: 1024, fps: 60, particles: 36, trail: 15, debris: 12, bloom: false },
    high: { level: 'high', dpr: Math.min(pixelRatio, 2), shadows: true, shadowSize: 1536, fps: 60, particles: 72, trail: 24, debris: 24, bloom: true },
  };
  return profiles[level] ?? profiles.balanced;
}
