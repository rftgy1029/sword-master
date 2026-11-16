import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMBAT_MONSTER_TYPES,
  fetchBufferWithProgress,
  isTitlePreloadReady,
  preloadCombatAssets,
  preloadTitleAssets,
  resetAssetPreloadForTest,
} from '../src/game/assetPreload.js';

function streamResponse(bytes, { status = 200, chunkSize = 1024 } = {}) {
  const data = new Uint8Array(bytes);
  for (let i = 0; i < data.length; i++) data[i] = i % 251;
  let offset = 0;
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => (name.toLowerCase() === 'content-length' ? String(bytes) : null) },
    body: {
      getReader() {
        return {
          async read() {
            if (offset >= data.length) return { done: true, value: undefined };
            const next = data.subarray(offset, Math.min(data.length, offset + chunkSize));
            offset += next.length;
            return { done: false, value: next };
          },
        };
      },
    },
  };
}

test('embedded single-file bundle skips network preload and reports ready immediately', async () => {
  resetAssetPreloadForTest();
  const updates = [];
  let stageLoaded = false;
  const { promise } = preloadTitleAssets({
    embedded: true,
    loadStage: async () => { stageLoaded = true; return {}; },
    fetchImpl: async () => { throw new Error('should not fetch'); },
    onProgress: (p) => updates.push(p),
  });
  const result = await promise;
  assert.equal(result.immediate, true);
  assert.equal(stageLoaded, false);
  assert.equal(updates.at(-1).percent, 100);
});

test('preloadTitleAssets downloads stage and title GLBs in parallel, reports monotonic progress, and primes cache once', async () => {
  resetAssetPreloadForTest();
  const fetched = [];
  const primed = [];
  const updates = [];
  const stageModule = {
    primeModelCache: (entries) => primed.push(...entries),
    primeTextureCache: () => {},
  };

  const first = preloadTitleAssets({
    embedded: false,
    onProgress: (p) => updates.push(p),
    loadStage: async () => stageModule,
    fetchImpl: async (url) => {
      fetched.push(url);
      return streamResponse(url.includes('hero') ? 152_036 : 306_112, { chunkSize: 50_000 });
    },
  });
  const second = preloadTitleAssets({
    embedded: false,
    loadStage: async () => stageModule,
    fetchImpl: async () => { throw new Error('concurrent duplicate fetch'); },
  });

  const [res1, res2] = await Promise.all([first.promise, second.promise]);
  assert.equal(res1.immediate, false);
  assert.equal(res2.immediate, false);
  assert.equal(isTitlePreloadReady(), true);
  assert.equal(fetched.length, 2);
  assert.equal(primed.length, 2);
  assert.equal(primed[0][1].byteLength, 306_112);
  assert.equal(primed[1][1].byteLength, 152_036);
  for (let i = 1; i < updates.length; i++) {
    assert.ok(updates[i].percent >= updates[i - 1].percent, 'progress percent never goes backward');
  }
  assert.equal(updates.at(-1).percent, 100);

  const third = await preloadTitleAssets({
    embedded: false,
    loadStage: async () => { throw new Error('should not reload stage'); },
    fetchImpl: async () => { throw new Error('should not refetch models'); },
  }).promise;
  assert.equal(third.immediate, true);
});

test('failed title asset download rejects without poisoning cache so retry succeeds', async () => {
  resetAssetPreloadForTest();
  let failHero = true;
  const stageModule = { primeModelCache: () => {}, primeTextureCache: () => {} };
  const fetchImpl = async (url) => {
    if (url.includes('hero') && failHero) return streamResponse(0, { status: 503 });
    return streamResponse(4096);
  };

  await assert.rejects(
    preloadTitleAssets({ embedded: false, loadStage: async () => stageModule, fetchImpl }).promise,
    /503/,
  );
  assert.equal(isTitlePreloadReady(), false);

  failHero = false;
  const retried = await preloadTitleAssets({ embedded: false, loadStage: async () => stageModule, fetchImpl }).promise;
  assert.equal(retried.immediate, false);
  assert.equal(isTitlePreloadReady(), true);
});

test('fetchBufferWithProgress handles chunked streams and deduplicates concurrent callers', async () => {
  resetAssetPreloadForTest();
  let calls = 0;
  const eventsA = [];
  const eventsB = [];
  const fetchImpl = async () => {
    calls++;
    return streamResponse(10_000, { chunkSize: 3_000 });
  };

  const [bufA, bufB] = await Promise.all([
    fetchBufferWithProgress('/models/slime.glb', { fetchImpl, onBytes: (loaded, total) => eventsA.push([loaded, total]) }),
    fetchBufferWithProgress('/models/slime.glb', { fetchImpl, onBytes: (loaded, total) => eventsB.push([loaded, total]) }),
  ]);

  assert.equal(calls, 1);
  assert.equal(bufA, bufB);
  assert.equal(bufA.byteLength, 10_000);
  assert.equal(eventsA.at(-1)[0], 10_000);
  assert.equal(eventsB.at(-1)[0], 10_000);
});

test('preloadCombatAssets warms textures, prioritizes requested monster, and survives partial failures', async () => {
  resetAssetPreloadForTest();
  const order = [];
  const primedModels = [];
  const seededModels = [];
  const primedTextures = [];
  const stageModule = {
    primeModelCache: (entries) => primedModels.push(...entries.map(([url]) => url)),
    seedModelCache: (entries) => seededModels.push(...entries.map(([url]) => url)),
    primeTextureCache: (urls) => primedTextures.push(...urls),
  };

  await preloadCombatAssets({
    embedded: false,
    priorityType: 'boss',
    yieldMs: 0,
    loadStage: async () => stageModule,
    fetchImpl: async (url) => {
      order.push(url);
      if (url.includes('wisp.glb')) return streamResponse(0, { status: 500 });
      return streamResponse(2048);
    },
  });

  assert.equal(primedTextures.length, 2);
  assert.ok(order[0].includes('boss.glb'), `expected boss.glb first, got ${order[0]}`);
  assert.equal(order.length, COMBAT_MONSTER_TYPES.length);
  assert.equal(primedModels.length, 1);
  assert.equal(seededModels.length, COMBAT_MONSTER_TYPES.length - 2);
});
