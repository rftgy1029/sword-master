import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMBAT_EFFECT_PATHS,
  COMBAT_MONSTER_TYPES,
  INITIAL_ASSET_SPECS,
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

test('preloadTitleAssets downloads stage, title GLBs, combat effects, and all 12 monsters in one pass', async () => {
  resetAssetPreloadForTest();
  const fetched = [];
  const primedModels = [];
  const seededModels = [];
  const seededTextures = [];
  const primedTextures = [];
  const updates = [];
  const stageModule = {
    primeModelCache: (entries) => primedModels.push(...entries),
    seedModelCache: (entries) => seededModels.push(...entries),
    seedTextureCache: async (entries) => { seededTextures.push(...entries); },
    primeTextureCache: (urls) => primedTextures.push(...urls),
  };

  const first = preloadTitleAssets({
    embedded: false,
    onProgress: (p) => updates.push(p),
    loadStage: async () => stageModule,
    fetchImpl: async (url) => {
      fetched.push(url);
      const size = url.includes('hero') ? 152_036 : url.includes('dungeon-kit') ? 306_112 : url.endsWith('.png') ? 8_192 : 120_000;
      return streamResponse(size, { chunkSize: 50_000 });
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
  assert.equal(fetched.length, INITIAL_ASSET_SPECS.length);
  assert.equal(fetched.length, 2 + COMBAT_EFFECT_PATHS.length + COMBAT_MONSTER_TYPES.length);
  assert.equal(primedModels.length, 2);
  assert.equal(seededModels.length, COMBAT_MONSTER_TYPES.length);
  assert.equal(seededTextures.length, COMBAT_EFFECT_PATHS.length);
  assert.equal(primedTextures.length, COMBAT_EFFECT_PATHS.length);
  assert.equal(primedModels[0][1].byteLength, 306_112);
  assert.equal(primedModels[1][1].byteLength, 152_036);
  for (const monster of COMBAT_MONSTER_TYPES) {
    assert.ok(seededModels.some(([url]) => url.includes(`/${monster}.glb`)), `seeded ${monster}.glb`);
  }
  for (let i = 1; i < updates.length; i++) {
    assert.ok(updates[i].percent >= updates[i - 1].percent, 'progress percent never goes backward');
  }
  assert.equal(updates.at(-1).percent, 100);

  // Subsequent title preload is immediate with zero fetches.
  const third = await preloadTitleAssets({
    embedded: false,
    loadStage: async () => { throw new Error('should not reload stage'); },
    fetchImpl: async () => { throw new Error('should not refetch models'); },
  }).promise;
  assert.equal(third.immediate, true);

  // Combat preload after full initial preload performs zero extra fetches and still primes prioritized boss.
  await preloadCombatAssets({
    embedded: false,
    priorityType: 'boss',
    yieldMs: 0,
    loadStage: async () => { throw new Error('should reuse cached stage module'); },
    fetchImpl: async () => { throw new Error('should not refetch already-downloaded monsters'); },
  });
  assert.equal(primedModels.length, 3);
  assert.ok(primedModels[2][0].includes('boss.glb'));
});

test('failed initial download rejects without poisoning cache and retry only refetches missing assets', async () => {
  resetAssetPreloadForTest();
  let failBoss = true;
  const fetchCounts = new Map();
  const stageModule = {
    primeModelCache: () => {},
    seedModelCache: () => {},
    seedTextureCache: async () => {},
    primeTextureCache: () => {},
  };
  const fetchImpl = async (url) => {
    fetchCounts.set(url, (fetchCounts.get(url) ?? 0) + 1);
    if (url.includes('boss.glb') && failBoss) return streamResponse(0, { status: 503 });
    return streamResponse(4096);
  };

  await assert.rejects(
    preloadTitleAssets({ embedded: false, loadStage: async () => stageModule, fetchImpl, concurrency: 2 }).promise,
    /503/,
  );
  assert.equal(isTitlePreloadReady(), false);

  failBoss = false;
  const retried = await preloadTitleAssets({ embedded: false, loadStage: async () => stageModule, fetchImpl, concurrency: 2 }).promise;
  assert.equal(retried.immediate, false);
  assert.equal(isTitlePreloadReady(), true);
  assert.equal(fetchCounts.size, INITIAL_ASSET_SPECS.length);
  for (const [url, count] of fetchCounts) {
    if (url.includes('boss.glb')) assert.equal(count, 2, 'failed monster retried once');
    else assert.equal(count, 1, `already-downloaded asset ${url} was not fetched twice`);
  }
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

test('standalone preloadCombatAssets warms textures, prioritizes requested monster, and survives partial failures', async () => {
  resetAssetPreloadForTest();
  const order = [];
  const primedModels = [];
  const seededModels = [];
  const seededTextures = [];
  const primedTextures = [];
  const stageModule = {
    primeModelCache: (entries) => primedModels.push(...entries.map(([url]) => url)),
    seedModelCache: (entries) => seededModels.push(...entries.map(([url]) => url)),
    seedTextureCache: async (entries) => { seededTextures.push(...entries.map(([url]) => url)); },
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

  assert.equal(seededTextures.length, 2);
  assert.equal(primedTextures.length, 2);
  const monsterOrder = order.filter((url) => url.endsWith('.glb'));
  assert.ok(monsterOrder[0].includes('boss.glb'), `expected boss.glb first, got ${monsterOrder[0]}`);
  assert.equal(monsterOrder.length, COMBAT_MONSTER_TYPES.length);
  assert.equal(primedModels.length, 1);
  assert.equal(seededModels.length, COMBAT_MONSTER_TYPES.length - 2);
});
