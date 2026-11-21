import { publicAsset } from '../publicAsset.js';
import { dungeonKitUrl } from './three/kenneyDungeon.js';
import { MODEL_TYPES, modelUrl } from './three/quality.js';

export const STAGE_ESTIMATED_BYTES = 1_058_627;

export const TITLE_MODEL_SPECS = Object.freeze([
  { key: 'dungeon-kit', kind: 'title-model', label: '던전 석조', bytes: 306_112, url: dungeonKitUrl },
  { key: 'hero', kind: 'title-model', label: '기사 모델', bytes: 152_036, url: () => modelUrl('hero') },
]);

export const COMBAT_MONSTER_TYPES = Object.freeze(MODEL_TYPES.filter((type) => type !== 'hero'));

const MONSTER_MODEL_BYTES = Object.freeze({
  crawler: 540_144,
  sentinel: 243_072,
  ember: 110_392,
  bat: 169_156,
  slime: 104_256,
  mushroom: 219_816,
  scarab: 160_044,
  wisp: 108_356,
  hound: 226_696,
  ravager: 292_236,
  watcher: 102_532,
  boss: 310_904,
});

export const MONSTER_MODEL_SPECS = Object.freeze(
  COMBAT_MONSTER_TYPES.map((type) => ({
    key: `monster-${type}`,
    monsterType: type,
    kind: 'monster-model',
    label: '몬스터 3D 모델',
    bytes: MONSTER_MODEL_BYTES[type] ?? 200_000,
    url: () => modelUrl(type),
  })),
);

export const COMBAT_EFFECT_PATHS = Object.freeze(['effects/impact-flipbook.png', 'effects/sword-light.png']);

export const COMBAT_EFFECT_SPECS = Object.freeze([
  { key: 'effect-impact', kind: 'effect-texture', label: '전투 이펙트', bytes: 34_982, url: () => publicAsset(COMBAT_EFFECT_PATHS[0]) },
  { key: 'effect-sword', kind: 'effect-texture', label: '전투 이펙트', bytes: 1_996, url: () => publicAsset(COMBAT_EFFECT_PATHS[1]) },
]);

/** All 3D binary assets downloaded up front during the first-visit loading window. */
export const INITIAL_ASSET_SPECS = Object.freeze([
  ...TITLE_MODEL_SPECS,
  ...COMBAT_EFFECT_SPECS,
  ...MONSTER_MODEL_SPECS,
]);

const defaultLoadStage = () => import('./three/ThreeStage.jsx');

const downloadedBuffers = new Map();
const inflightBuffers = new Map();
const seededModels = new Set();
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
  seededModels.clear();
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

async function runPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  let firstError = null;
  const limit = Math.max(1, Math.min(concurrency, items.length));

  const next = async () => {
    while (cursor < items.length) {
      if (firstError) return;
      const index = cursor++;
      try {
        results[index] = await worker(items[index], index);
      } catch (error) {
        if (!firstError) firstError = error;
        return;
      }
    }
  };

  await Promise.all(Array.from({ length: limit }, next));
  if (firstError) throw firstError;
  return results;
}

/**
 * Preload the 3D stage module, title GLBs, combat effect textures, and all 12 monster GLBs
 * together before mounting SceneView so first-time players never stall or fall back to 2D.
 * Accepts subscriber callbacks so StrictMode unmount/remount or duplicate callers share one task.
 */
export function preloadTitleAssets({
  onProgress,
  loadStage = defaultLoadStage,
  fetchImpl = globalThis.fetch,
  embedded = isEmbeddedAssetBundle(),
  concurrency = 4,
} = {}) {
  const specs = INITIAL_ASSET_SPECS.map((spec) => ({ ...spec, resolvedUrl: spec.url() }));
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
      assetLoaded: new Map(specs.map((spec) => [spec.key, 0])),
      assetTotal: new Map(specs.map((spec) => [spec.key, spec.bytes])),
      assetDone: new Set(),
      percent: 0,
      snapshot: { percent: 0, loadedBytes: 0, totalBytes: defaultTotal, label: '3D 무대 모듈 내려받는 중…', phase: 'downloading' },
    };

    const monsterTotalCount = specs.filter((spec) => spec.kind === 'monster-model').length;

    const currentLabel = () => {
      if (!state.stageDone) return '3D 무대 모듈 내려받는 중…';
      const pendingTitle = specs.find((spec) => spec.kind === 'title-model' && !state.assetDone.has(spec.key));
      if (pendingTitle) return `${pendingTitle.label} 내려받는 중…`;
      const pendingEffect = specs.find((spec) => spec.kind === 'effect-texture' && !state.assetDone.has(spec.key));
      if (pendingEffect) return `${pendingEffect.label} 내려받는 중…`;
      const monstersDone = specs.filter((spec) => spec.kind === 'monster-model' && state.assetDone.has(spec.key)).length;
      if (monstersDone < monsterTotalCount) return `몬스터 3D 모델 내려받는 중… (${monstersDone}/${monsterTotalCount})`;
      return '3D 무대 준비 중…';
    };

    const emitSnapshot = () => {
      const loadedAssets = specs.reduce((sum, spec) => sum + (state.assetLoaded.get(spec.key) ?? 0), 0);
      const totalAssets = specs.reduce((sum, spec) => sum + (state.assetTotal.get(spec.key) ?? spec.bytes), 0);
      const totalBytes = STAGE_ESTIMATED_BYTES + totalAssets;
      const loadedBytes = Math.min(totalBytes, state.stageLoaded + loadedAssets);
      const computed = totalBytes > 0 ? Math.round((loadedBytes / totalBytes) * 100) : 0;
      const allDone = state.stageDone && state.assetDone.size >= specs.length;
      const percent = allDone ? 99 : Math.min(98, Math.max(state.percent, computed));
      state.percent = percent;
      state.snapshot = { percent, loadedBytes, totalBytes, label: currentLabel(), phase: 'downloading' };
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

    const assetsPromise = runPool(specs, concurrency, async (spec) => {
      const buffer = await fetchBufferWithProgress(spec.resolvedUrl, {
        fetchImpl,
        onBytes: (loaded, total) => {
          state.assetLoaded.set(spec.key, loaded);
          if (total > 0) state.assetTotal.set(spec.key, Math.max(total, loaded));
          emitSnapshot();
        },
      });
      state.assetLoaded.set(spec.key, buffer.byteLength);
      state.assetTotal.set(spec.key, buffer.byteLength);
      state.assetDone.add(spec.key);
      emitSnapshot();
      return { spec, url: spec.resolvedUrl, buffer };
    });

    const promise = Promise.all([stagePromise, assetsPromise])
      .then(async ([threeModule, entries]) => {
        clearInterval(ticker);
        cachedStageModule = threeModule;

        const titleModelEntries = [];
        const monsterModelEntries = [];
        const effectEntries = [];
        for (const entry of entries) {
          if (entry.spec.kind === 'title-model') titleModelEntries.push([entry.url, entry.buffer]);
          else if (entry.spec.kind === 'monster-model') monsterModelEntries.push([entry.url, entry.buffer]);
          else if (entry.spec.kind === 'effect-texture') effectEntries.push([entry.url, entry.buffer]);
        }

        // Prime title models immediately and seed all 12 monster GLBs into THREE.Cache (zero later fetches).
        threeModule?.primeModelCache?.(titleModelEntries);
        for (const [url] of titleModelEntries) {
          seededModels.add(url);
          primedModels.add(url);
        }

        if (monsterModelEntries.length) {
          (threeModule?.seedModelCache ?? threeModule?.primeModelCache)?.(monsterModelEntries);
          for (const [url] of monsterModelEntries) seededModels.add(url);
        }

        if (effectEntries.length) {
          await threeModule?.seedTextureCache?.(effectEntries);
          texturesPrimed = true;
          threeModule?.primeTextureCache?.(effectEntries.map(([url]) => url));
        }

        titleReady = true;
        const totalAssets = specs.reduce((sum, spec) => sum + (state.assetTotal.get(spec.key) ?? spec.bytes), 0);
        const totalBytes = STAGE_ESTIMATED_BYTES + totalAssets;
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
 * Ensure combat effect textures and monster GLBs are warmed in Three.js/R3F caches.
 * After `preloadTitleAssets`, buffers are already in memory so this avoids extra network
 * traffic while still letting active battles prioritize GLTF parsing for the current enemy.
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
        const effectUrls = COMBAT_EFFECT_PATHS.map((path) => publicAsset(path));
        const fetchedEffects = [];
        for (const url of effectUrls) {
          try {
            const buffer = await fetchBufferWithProgress(url, { fetchImpl });
            fetchedEffects.push([url, buffer]);
          } catch {
            // Non-fatal; TextureLoader still attempts live loading if needed.
          }
        }
        if (fetchedEffects.length) await threeModule?.seedTextureCache?.(fetchedEffects);
        texturesPrimed = true;
        threeModule?.primeTextureCache?.(effectUrls);
      }
      const pending = new Set(COMBAT_MONSTER_TYPES);
      while (pending.size > 0) {
        const prioritized = queuedPriorityType && pending.has(queuedPriorityType);
        const nextType = prioritized ? queuedPriorityType : pending.values().next().value;
        if (prioritized) queuedPriorityType = null;
        pending.delete(nextType);
        const url = modelUrl(nextType);
        if (prioritized ? primedModels.has(url) : seededModels.has(url)) continue;
        try {
          const buffer = await fetchBufferWithProgress(url, { fetchImpl });
          if (prioritized) {
            threeModule?.primeModelCache?.([[url, buffer]]);
            seededModels.add(url);
            primedModels.add(url);
          } else {
            (threeModule?.seedModelCache ?? threeModule?.primeModelCache)?.([[url, buffer]]);
            seededModels.add(url);
          }
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
