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

export const QUALITY_PRESETS = Object.freeze([
  {
    id: 'lowest',
    label: '매우 낮음',
    tag: '초경량 3D',
    devices: '학교 노트북 · 크롬북 · 저사양 폰',
    summary: '외곽선·그림자·광원을 끄고 퀴즈 중 배경을 멈춰 랙을 최소화해요.',
  },
  {
    id: 'low',
    label: '낮음',
    tag: '가벼운 3D',
    devices: '일반 스마트폰 · 내장 그래픽 노트북',
    summary: '캐릭터 외곽선을 유지하면서 그림자·광원을 줄여 30fps로 부드럽게 돌려요.',
  },
  {
    id: 'balanced',
    label: '보통',
    tag: '균형 3D',
    devices: '일반 데스크톱 · 최신 노트북',
    summary: '실시간 그림자와 황혼 환경광, 60fps 기본 화질로 즐겨요.',
  },
  {
    id: 'high',
    label: '높음',
    tag: '최고 화질',
    devices: '외장 GPU PC · Apple Silicon 맥',
    summary: '블룸 발광 효과, 고해상도 그림자, 선명한 2배 해상도로 표현해요.',
  },
]);

const SOFTWARE_OR_ULTRALOW_GPU = /(swiftshader|llvmpipe|softpipe|lavapipe|software renderer|apple software|microsoft basic render|mesa.*offscreen|\bwarp\b|mali-4\d\d|adreno \(tm\) [23]\d\d|powervr sgx|intel\(r\) (hd graphics [234]\d\d\d|hd graphics$|uhd graphics 600|uhd graphics 605|gma|atom))/i;
const HIGH_END_DESKTOP_GPU = /(nvidia|geforce|rtx|gtx|quadro|radeon\s?(rx|pro|vii|vega)|rx\s?\d|apple\s?(m[1-9]|gpu)|intel\(r\)\s?arc)/i;
const MID_GPU = /(iris(\(r\))?\s?xe|radeon|adreno\s?\(tm\)\s?(6[4-9]\d|7\d\d|8\d\d)|mali-g(7[7-9]|8\d|9\d)|immortalis|xclipse)/i;
const INTEGRATED_OR_BUDGET_GPU = /(intel\(r\) (hd|uhd) graphics|mali-t|mali-g3|mali-g5|adreno \(tm\) (4\d\d|5\d\d|6[0-3]\d)|videocore|vivante)/i;

let cachedGpuInfo;

/**
 * Probe WebGL renderer string and majorPerformanceCaveat once using high-performance preference,
 * and release temporary contexts immediately.
 */
export function probeGpuInfo() {
  if (cachedGpuInfo !== undefined) return cachedGpuInfo;
  cachedGpuInfo = { renderer: '', majorPerformanceCaveat: false };
  if (typeof document === 'undefined') return cachedGpuInfo;
  try {
    const tryContext = (type, failIfMajorPerformanceCaveat) => document.createElement('canvas')
      .getContext(type, { powerPreference: 'high-performance', failIfMajorPerformanceCaveat });
    let gl = tryContext('webgl2', true) || tryContext('webgl', true);
    let majorPerformanceCaveat = false;
    if (!gl) {
      gl = tryContext('webgl2', false) || tryContext('webgl', false);
      majorPerformanceCaveat = Boolean(gl);
    }
    if (!gl) return cachedGpuInfo;
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    const unmasked = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : '';
    const basic = gl.getParameter(gl.RENDERER) ?? '';
    cachedGpuInfo = {
      renderer: `${unmasked || ''} ${basic || ''}`.trim(),
      majorPerformanceCaveat,
    };
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    cachedGpuInfo = { renderer: '', majorPerformanceCaveat: false };
  }
  return cachedGpuInfo;
}

export function probeGpuRenderer() {
  return probeGpuInfo().renderer;
}

/**
 * Suggest a starting graphics preset badge for the first-launch picker without ever forcing
 * or silently downgrading the user's chosen quality.
 */
export function recommendGraphicsQuality(env) {
  const useGlobals = !env;
  const nav = env?.navigator ?? globalThis.navigator;
  const gpuInfo = useGlobals ? probeGpuInfo() : { renderer: '', majorPerformanceCaveat: false };
  const renderer = env?.gpuRenderer ?? gpuInfo.renderer;
  const majorCaveat = env?.majorPerformanceCaveat ?? gpuInfo.majorPerformanceCaveat;
  const compact = env?.compact ?? (typeof globalThis.matchMedia === 'function' ? globalThis.matchMedia('(max-width: 760px)').matches : false);
  const coarse = env?.coarsePointer ?? (typeof globalThis.matchMedia === 'function' ? globalThis.matchMedia('(pointer: coarse)').matches : false);
  const cores = Number(env?.hardwareConcurrency ?? nav?.hardwareConcurrency ?? 0);
  const memory = Number(env?.deviceMemory ?? nav?.deviceMemory ?? 0);
  const saveData = Boolean(env?.saveData ?? nav?.connection?.saveData);
  const mobile = compact || coarse;

  if (majorCaveat || (renderer && SOFTWARE_OR_ULTRALOW_GPU.test(renderer))) return 'lowest';
  if (saveData) return 'lowest';

  if (renderer && HIGH_END_DESKTOP_GPU.test(renderer)) return mobile ? 'low' : 'high';
  if (renderer && MID_GPU.test(renderer)) return mobile ? 'low' : 'balanced';

  if (memory > 0 && memory <= 2) return 'lowest';
  if (renderer && INTEGRATED_OR_BUDGET_GPU.test(renderer)) return 'low';
  if (mobile) return 'low';
  if ((memory > 0 && memory <= 4) || (cores > 0 && cores <= 2)) return 'low';

  return 'balanced';
}

export function qualityProfile(choice = 'balanced', { compact = false, pixelRatio = 1 } = {}) {
  const level = choice === 'auto' ? (compact ? 'low' : 'balanced') : choice;
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
      idleFps: 10,
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
      idleFps: 60,
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
