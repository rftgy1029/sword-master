import { publicAsset } from '../publicAsset.js';
import { dungeonKitUrl } from './three/kenneyDungeon.js';
import { MODEL_TYPES, modelUrl } from './three/quality.js';

export const STAGE_ESTIMATED_BYTES = 1_061_042;
export const TITLE_MODEL_SPECS = Object.freeze([
  { key: 'dungeon-kit', label: '던전 석조', bytes: 306_112, url: dungeonKitUrl },
  { key: 'hero', label: '기사 모델', bytes: 152_036, url: () => modelUrl('hero') },
]);
export const COMBAT_MONSTER_TYPES = Object.freeze(MODEL_TYPES.filter((type) => type !== 'hero'));
export const COMBAT_EFFECT_PATHS = Object.freeze(['effects/impact-flipbook.png', 'effects/sword-light.png']);

const defaultLoadStage = () => import('./three/ThreeStage.jsx');

const downloadedBuffers = new Map();
const inflightBuffers = new Map();
const primedModels = new Set();

let titleReady = false;
let titleTask = null;
let cachedStageModule = null;
let texturesPrimed = false;
let combatQueuePromise = null;
let queuedPriorityType = null;

export function isEmbeddedAssetBundle() {
  return Boolean(globalThis.__SWORD_MASTER_ASSETS__);
}

export function isTitlePreloadReady() {
  return isEmbeddedAssetBundle() || titleReady;
}

export function resetAssetPreloadForTest() {
  downloadedBuffers.clear();
  inflightBuffers.clear();
  primedModels.clear();
  titleReady = false;
  titleTask = null;
  cachedStageModule = null;
  texturesPrimed = false;
  combatQueuePromise = null;
  queuedPriorityType = null;
}

/**
 * Download a binary asset once into memory while emitting byte progress to any active listeners.
 * Deduplicates concurrent requests and leaves no cache entry if a download fails.
 */
export function fetchBufferWithProgress(url, { fetchImpl = globalThis.fetch, onBytes } = {}) {
  const existing = downloadedBuffers.get(url);
  if (existing) {
    onBytes?.(existing.byteLength, existing.byteLength);
    return Promise.resolve(existing);
  }
  const active = inflightBuffers.get(url);
  if (active) {
    if (onBytes) active.listeners.add(onBytes);
    return active.promise;
  }

  const listeners = new Set();
  if (onBytes) listeners.add(onBytes);
  const emit = (loaded, total) => {
    for (const listener of listeners) listener(loaded, total);
  };

  const promise = (async () => {
    const response = await fetchImpl(url);
    if (!response?.ok) throw new Error(`자산을 불러오지 못했습니다 (${response?.status ?? 'network'}): ${url}`);

    const headerTotal = Number(response.headers?.get?.('content-length')) || 0;
    if (!response.body?.getReader) {
      const buffer = await response.arrayBuffer();
      emit(buffer.byteLength, buffer.byteLength);
      downloadedBuffers.set(url, buffer);
      return buffer;
    }

    const reader = response.body.getReader();
    const chunks = [];
    let loaded = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value?.byteLength) {
        chunks.push(value);
        loaded += value.byteLength;
        emit(loaded, headerTotal || loaded);
      }
    }
    const merged = new Uint8Array(loaded);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const buffer = merged.buffer;
    emit(buffer.byteLength, headerTotal || buffer.byteLength);
    downloadedBuffers.set(url, buffer);
    return buffer;
  })().finally(() => {
    inflightBuffers.delete(url);
    listeners.clear();
  });

  inflightBuffers.set(url, { promise, listeners });
  return promise;
}

/**
 * Preload the 3D stage module and title-screen GLBs in parallel before mounting SceneView.
 * Accepts subscriber callbacks so StrictMode unmount/remount or duplicate callers share one task.
 */
export function preloadTitleAssets({
  onProgress,
  loadStage = defaultLoadStage,
  fetchImpl = globalThis.fetch,
  embedded = isEmbeddedAssetBundle(),
} = {}) {
  const specs = TITLE_MODEL_SPECS.map((spec) => ({ ...spec, resolvedUrl: spec.url() }));
  const defaultTotal = STAGE_ESTIMATED_BYTES + specs.reduce((sum, spec) => sum + spec.bytes, 0);

  if (embedded) {
    onProgress?.({ percent: 100, loadedBytes: 0, totalBytes: 0, label: '3D 무대 준비 완료', phase: 'ready' });
    return { promise: Promise.resolve({ immediate: true, module: null }), unsubscribe: () => {} };
  }
  if (titleReady) {
    onProgress?.({ percent: 100, loadedBytes: defaultTotal, totalBytes: defaultTotal, label: '3D 무대 준비 완료', phase: 'ready' });
    return { promise: Promise.resolve({ immediate: true, module: cachedStageModule }), unsubscribe: () => {} };
  }

  if (!titleTask) {
    const subscribers = new Set();
    const state = {
      stageLoaded: 0,
      stageDone: false,
      modelLoaded: new Map(specs.map((spec) => [spec.key, 0])),
      modelTotal: new Map(specs.map((spec) => [spec.key, spec.bytes])),
      percent: 0,
      snapshot: { percent: 0, loadedBytes: 0, totalBytes: defaultTotal, label: '3D 무대 모듈 내려받는 중…', phase: 'downloading' },
    };

    const emitSnapshot = () => {
      const loadedModels = specs.reduce((sum, spec) => sum + (state.modelLoaded.get(spec.key) ?? 0), 0);
      const totalModels = specs.reduce((sum, spec) => sum + (state.modelTotal.get(spec.key) ?? spec.bytes), 0);
      const totalBytes = STAGE_ESTIMATED_BYTES + totalModels;
      const loadedBytes = Math.min(totalBytes, state.stageLoaded + loadedModels);
      const computed = totalBytes > 0 ? Math.round((loadedBytes / totalBytes) * 100) : 0;
      const percent = state.stageDone && loadedModels >= totalModels ? 99 : Math.min(99, Math.max(state.percent, computed));
      state.percent = percent;
      const label = !state.stageDone
        ? '3D 무대 모듈 내려받는 중…'
        : specs.find((spec) => (state.modelLoaded.get(spec.key) ?? 0) < (state.modelTotal.get(spec.key) ?? spec.bytes))?.label.concat(' 내려받는 중…')
          ?? '3D 무대 준비 중…';
      state.snapshot = { percent, loadedBytes, totalBytes, label, phase: 'downloading' };
      for (const subscriber of subscribers) subscriber(state.snapshot);
    };

    const startedAt = Date.now();
    const ticker = setInterval(() => {
      if (state.stageDone) return;
      const ratio = Math.min(0.9, (Date.now() - startedAt) / 8000);
      state.stageLoaded = Math.round(STAGE_ESTIMATED_BYTES * ratio);
      emitSnapshot();
    }, 250);

    const stagePromise = loadStage().then((mod) => {
      state.stageDone = true;
      state.stageLoaded = STAGE_ESTIMATED_BYTES;
      emitSnapshot();
      return mod;
    });

    const modelPromises = specs.map((spec) =>
      fetchBufferWithProgress(spec.resolvedUrl, {
        fetchImpl,
        onBytes: (loaded, total) => {
          state.modelLoaded.set(spec.key, loaded);
          if (total > 0) state.modelTotal.set(spec.key, Math.max(total, loaded));
          emitSnapshot();
        },
      }).then((buffer) => {
        state.modelLoaded.set(spec.key, buffer.byteLength);
        state.modelTotal.set(spec.key, buffer.byteLength);
        emitSnapshot();
        return [spec.resolvedUrl, buffer];
      }),
    );

    const promise = Promise.all([stagePromise, ...modelPromises])
      .then(([threeModule, ...entries]) => {
        clearInterval(ticker);
        cachedStageModule = threeModule;
        threeModule?.primeModelCache?.(entries);
        for (const [url] of entries) primedModels.add(url);
        titleReady = true;
        const totalModels = specs.reduce((sum, spec) => sum + (state.modelTotal.get(spec.key) ?? spec.bytes), 0);
        const totalBytes = STAGE_ESTIMATED_BYTES + totalModels;
        state.snapshot = { percent: 100, loadedBytes: totalBytes, totalBytes, label: '3D 무대 준비 완료', phase: 'ready' };
        for (const subscriber of subscribers) subscriber(state.snapshot);
        return { immediate: false, module: threeModule };
      })
      .catch((error) => {
        clearInterval(ticker);
        titleTask = null;
        throw error;
      });

    titleTask = { promise, subscribers, getSnapshot: () => state.snapshot };
  }

  if (onProgress) {
    titleTask.subscribers.add(onProgress);
    onProgress(titleTask.getSnapshot());
  }
  return {
    promise: titleTask.promise,
    unsubscribe: () => {
      if (onProgress) titleTask?.subscribers.delete(onProgress);
    },
  };
}

/**
 * Quietly preload combat effects and all 12 monster GLBs in the background after title readiness.
 * Calling again with a specific `priorityType` moves that monster to the front of the queue.
 */
export function preloadCombatAssets({
  priorityType,
  loadStage = defaultLoadStage,
  fetchImpl = globalThis.fetch,
  embedded = isEmbeddedAssetBundle(),
  yieldMs = 40,
} = {}) {
  if (embedded) return Promise.resolve();
  if (priorityType && COMBAT_MONSTER_TYPES.includes(priorityType)) queuedPriorityType = priorityType;
  if (combatQueuePromise) return combatQueuePromise;

  combatQueuePromise = (async () => {
    try {
      const threeModule = cachedStageModule ?? await loadStage();
      cachedStageModule = threeModule;
      if (!texturesPrimed) {
        texturesPrimed = true;
        threeModule?.primeTextureCache?.(COMBAT_EFFECT_PATHS.map((path) => publicAsset(path)));
      }
      const pending = new Set(COMBAT_MONSTER_TYPES);
      while (pending.size > 0) {
        const prioritized = queuedPriorityType && pending.has(queuedPriorityType);
        const nextType = prioritized ? queuedPriorityType : pending.values().next().value;
        if (prioritized) queuedPriorityType = null;
        pending.delete(nextType);
        const url = modelUrl(nextType);
        if (primedModels.has(url) && !prioritized) continue;
        try {
          const buffer = await fetchBufferWithProgress(url, { fetchImpl });
          if (prioritized) threeModule?.primeModelCache?.([[url, buffer]]);
          else (threeModule?.seedModelCache ?? threeModule?.primeModelCache)?.([[url, buffer]]);
          primedModels.add(url);
        } catch {
          // Background preload failure is non-fatal; CombatScene still attempts live loading if needed.
        }
        if (yieldMs > 0 && pending.size > 0) await new Promise((resolve) => setTimeout(resolve, yieldMs));
      }
    } catch {
      // Ignore background stage-load errors; foreground callers handle explicit retries.
    } finally {
      combatQueuePromise = null;
    }
  })();

  return combatQueuePromise;
}
