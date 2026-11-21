import { publicAsset } from '../../publicAsset.js';
export const MODEL_TYPES = Object.freeze(['hero', 'crawler', 'sentinel', 'ember', 'bat', 'slime', 'mushroom', 'scarab', 'wisp', 'hound', 'ravager', 'watcher', 'boss']);
export const modelUrl = (type) => publicAsset(`models/${MODEL_TYPES.includes(type) ? type : 'sentinel'}.glb`);

export const QUALITY_ORDER = Object.freeze(['lowest', 'low', 'balanced', 'high']);
export const QUALITY_LABELS = Object.freeze({
  lowest: '매우 낮음',
  low: '낮음',
  balanced: '보통',
  high: '높음',
});

const SOFTWARE_OR_ULTRALOW_GPU = /(swiftshader|llvmpipe|softpipe|lavapipe|software|microsoft basic render|mesa.*offscreen|apple software|mali-4\d\d|adreno \(tm\) [234]\d\d|powervr sgx|intel\(r\) (hd graphics [234]\d\d\d|hd graphics$|uhd graphics 600|uhd graphics 605|gma|atom))/i;
const INTEGRATED_OR_BUDGET_GPU = /(intel\(r\) (hd|uhd) graphics|mali-t|mali-g3|mali-g5|adreno \(tm\) 5\d\d|adreno \(tm\) 61\d|videocore|vivante)/i;

let cachedRendererInfo;

function qualityIndex(level) {
  const index = QUALITY_ORDER.indexOf(level);
  return index === -1 ? 2 : index;
}

export function minQuality(a, b) {
  if (!a) return b;
  if (!b) return a;
  return qualityIndex(a) <= qualityIndex(b) ? a : b;
}

export function stepDownQuality(level) {
  const index = qualityIndex(level);
  return QUALITY_ORDER[Math.max(0, index - 1)];
}

/** Probe WebGL renderer string once and release the temporary probe context immediately. */
export function probeGpuRenderer() {
  if (cachedRendererInfo !== undefined) return cachedRendererInfo;
  cachedRendererInfo = '';
  if (typeof document === 'undefined') return cachedRendererInfo;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2', { powerPreference: 'low-power', failIfMajorPerformanceCaveat: false })
      || canvas.getContext('webgl', { powerPreference: 'low-power', failIfMajorPerformanceCaveat: false });
    if (!gl) return cachedRendererInfo;
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    const unmasked = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : '';
    const basic = gl.getParameter(gl.RENDERER) ?? '';
    cachedRendererInfo = `${unmasked || ''} ${basic || ''}`.trim();
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    cachedRendererInfo = '';
  }
  return cachedRendererInfo;
}

/**
 * Estimate a safe initial 3D quality tier before the first Canvas mounts
 * so low-spec laptops, Chromebooks, software WebGL, and budget phones start smooth immediately.
 */
export function detectDeviceQuality(env) {
  const useGlobals = !env;
  const nav = env?.navigator ?? globalThis.navigator;
  const renderer = env?.gpuRenderer ?? (useGlobals ? probeGpuRenderer() : '');
  const compact = env?.compact ?? (typeof globalThis.matchMedia === 'function' ? globalThis.matchMedia('(max-width: 760px)').matches : false);
  const coarse = env?.coarsePointer ?? (typeof globalThis.matchMedia === 'function' ? globalThis.matchMedia('(pointer: coarse)').matches : false);
  const cores = Number(env?.hardwareConcurrency ?? nav?.hardwareConcurrency ?? 0);
  const memory = Number(env?.deviceMemory ?? nav?.deviceMemory ?? 0);
  const saveData = Boolean(env?.saveData ?? nav?.connection?.saveData);

  let tier = compact || coarse ? 'low' : 'balanced';

  if (renderer && SOFTWARE_OR_ULTRALOW_GPU.test(renderer)) return 'lowest';
  if (saveData || (memory > 0 && memory <= 2) || (cores > 0 && cores <= 2)) return 'lowest';

  if (renderer && INTEGRATED_OR_BUDGET_GPU.test(renderer)) tier = minQuality(tier, 'low');
  if ((memory > 0 && memory <= 4) || (cores > 0 && cores <= 4)) tier = minQuality(tier, 'low');
  if (compact && ((memory > 0 && memory <= 3) || (cores > 0 && cores <= 4))) tier = 'lowest';

  return tier;
}

export function resolveAutoQuality({ compact = false, deviceTier = null, autoTier = null } = {}) {
  let level = deviceTier ?? (compact ? 'low' : 'balanced');
  if (compact) level = minQuality(level, 'low');
  if (autoTier) level = minQuality(level, autoTier);
  return level;
}

export function qualityProfile(choice = 'auto', { compact = false, pixelRatio = 1, deviceTier = null, autoTier = null } = {}) {
  const level = choice === 'auto' ? resolveAutoQuality({ compact, deviceTier, autoTier }) : choice;
  const profiles = {
    lowest: {
      level: 'lowest',
      dpr: Math.min(pixelRatio, 0.75),
      antialias: false,
      powerPreference: 'low-power',
      shadows: false,
      shadowSize: 512,
      environment: false,
      outlines: false,
      pointLights: false,
      rimLight: false,
      motes: 0,
      fps: 24,
      idleFps: 8,
      studyFps: 0,
      particles: 8,
      trail: 6,
      debris: 3,
      projectileParts: 3,
      bloom: false,
    },
    low: {
      level: 'low',
      dpr: Math.min(pixelRatio, 1),
      antialias: false,
      powerPreference: 'low-power',
      shadows: false,
      shadowSize: 512,
      environment: false,
      outlines: true,
      pointLights: false,
      rimLight: true,
      motes: 10,
      fps: 30,
      idleFps: 20,
      studyFps: 15,
      particles: 16,
      trail: 8,
      debris: 4,
      projectileParts: 4,
      bloom: false,
    },
    balanced: {
      level: 'balanced',
      dpr: Math.min(pixelRatio, 1.5),
      antialias: true,
      powerPreference: 'high-performance',
      shadows: true,
      shadowSize: 1024,
      environment: true,
      outlines: true,
      pointLights: true,
      rimLight: true,
      motes: 36,
      fps: 60,
      idleFps: 45,
      studyFps: 30,
      particles: 36,
      trail: 15,
      debris: 12,
      projectileParts: 7,
      bloom: false,
    },
    high: {
      level: 'high',
      dpr: Math.min(pixelRatio, 2),
      antialias: true,
      powerPreference: 'high-performance',
      shadows: true,
      shadowSize: 1536,
      environment: true,
      outlines: true,
      pointLights: true,
      rimLight: true,
      motes: 72,
      fps: 60,
      idleFps: 60,
      studyFps: 30,
      particles: 72,
      trail: 24,
      debris: 24,
      projectileParts: 7,
      bloom: true,
    },
  };
  return profiles[level] ?? profiles.balanced;
}

/** Choose target frame rate: full combat FPS during active animations, lowered/paused during quiz or idle. */
export function effectiveFrameRate(quality, { active = false, studying = false, reduced = false } = {}) {
  if (active) return quality.fps;
  if (reduced) return 0;
  if (studying) return quality.studyFps ?? quality.fps;
  return quality.idleFps ?? quality.fps;
}

/**
 * Average frame delta (seconds) above which auto quality should step down.
 * Returns null when intentionally running below 20fps (e.g., quiz/idle power saving).
 */
export function slowFrameThreshold(targetFps) {
  if (!Number.isFinite(targetFps) || targetFps < 20) return null;
  if (targetFps >= 45) return 0.048;
  return Math.max(0.062, (1 / targetFps) * 1.75);
}
