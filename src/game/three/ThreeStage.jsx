import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import World from './World.jsx';
import BattleBloom from './BattleBloom.jsx';
import { createPerfMonitor } from './perfMonitor.js';
import { effectiveFrameRate, probeGpuRenderer, qualityProfile } from './quality.js';

/** Seed Three.js FileLoader cache without blocking the main thread with eager GLTF parsing. */
export function seedModelCache(entries) {
  THREE.Cache.enabled = true;
  for (const [url, buffer] of entries) {
    const key = `file:${THREE.DefaultLoadingManager.resolveURL(url)}`;
    if (buffer && !THREE.Cache.get(key)) THREE.Cache.add(key, buffer);
  }
}

/** Seed Three.js FileLoader cache and warm R3F GLTFLoader entries before 3D scenes mount. */
export function primeModelCache(entries) {
  seedModelCache(entries);
  for (const [url] of entries) useLoader.preload(GLTFLoader, url);
}

/** Decode downloaded PNG buffers into Image elements and seed Three.js ImageLoader cache. */
export async function seedTextureCache(entries) {
  THREE.Cache.enabled = true;
  if (typeof Image === 'undefined' || typeof Blob === 'undefined' || typeof URL?.createObjectURL !== 'function') return;
  await Promise.all(entries.map(([url, buffer]) => {
    const key = `image:${THREE.DefaultLoadingManager.resolveURL(url)}`;
    if (!buffer || THREE.Cache.get(key)?.complete) return Promise.resolve();
    return new Promise((resolve) => {
      const blobUrl = URL.createObjectURL(new Blob([buffer], { type: 'image/png' }));
      const image = new Image();
      const finish = (ok) => {
        URL.revokeObjectURL(blobUrl);
        if (ok && image.complete && image.naturalWidth > 0) THREE.Cache.add(key, image);
        resolve();
      };
      image.onload = () => {
        if (typeof image.decode === 'function') image.decode().then(() => finish(true), () => finish(true));
        else finish(true);
      };
      image.onerror = () => finish(false);
      image.src = blobUrl;
    });
  }));
}

/** Warm Three.js texture cache and R3F TextureLoader entries for combat effects. */
export function primeTextureCache(urls) {
  THREE.Cache.enabled = true;
  for (const url of urls) useLoader.preload(THREE.TextureLoader, url);
}

function RenderLoop({
  fps, animate, active, parked, warmupMode, sceneInstanceId, dynamicDpr,
  monitor, onDropDpr, onPerfSuggest, onFailure, directorRef, onController, quality, bloom,
}) {
  const { gl, invalidate, scene, camera, clock } = useThree();
  const failures = useRef(onFailure); failures.current = onFailure;
  const controllerCallback = useRef(onController); controllerCallback.current = onController;
  const dropDprRef = useRef(onDropDpr); dropDprRef.current = onDropDpr;
  const perfSuggestRef = useRef(onPerfSuggest); perfSuggestRef.current = onPerfSuggest;
  const dynamicDprRef = useRef(dynamicDpr); dynamicDprRef.current = dynamicDpr;
  const controllerInstanceRef = useRef(null);
  const sampleTime = useRef(null);
  const sample = (milliseconds) => {
    const director = directorRef.current, current = director?.active;
    if (!current) { sampleTime.current = milliseconds; return; }
    const elapsed = Math.max(0, Math.min(current.duration, milliseconds));
    current.prev = current.elapsed;
    current.elapsed = elapsed;
    current.clock = elapsed;
    current.manual = true;
    director.deliver(current);
    sampleTime.current = null;
  };
  useFrame((_, delta) => {
    if (sampleTime.current !== null && directorRef.current?.active) sample(sampleTime.current);
    if (!monitor || parked || warmupMode) return;
    const minDpr = quality.minDpr ?? quality.dpr;
    const canDropDpr = dynamicDprRef.current > minDpr + 0.001;
    const result = monitor.recordFrame(delta * 1000, {
      now: performance.now(),
      active: active && !directorRef.current?.active?.manual,
      targetFps: animate ? fps : 0,
      hidden: document.hidden,
      canDropDpr,
    });
    if (result.action === 'drop-dpr') dropDprRef.current?.();
    else if (result.action === 'suggest-lower') perfSuggestRef.current?.(quality.level);
  }, -3);
  useEffect(() => {
    gl.setPixelRatio(dynamicDpr);
    invalidate();
  }, [gl, invalidate, dynamicDpr]);
  useEffect(() => {
    gl.shadowMap.enabled = quality.shadows;
    if (quality.shadows) gl.shadowMap.needsUpdate = true;
    invalidate();
  }, [gl, invalidate, quality.shadows, quality.level]);
  useEffect(() => {
    if (controllerInstanceRef.current && !parked && !warmupMode) {
      controllerCallback.current?.(controllerInstanceRef.current);
    }
  }, [sceneInstanceId, parked, warmupMode]);
  useEffect(() => {
    const lost = event => { event.preventDefault(); failures.current?.(); };
    gl.domElement.addEventListener('webglcontextlost', lost);
    const tick = () => { if (!document.hidden) invalidate(); };
    clock.getDelta();
    tick();
    let rafId = 0;
    let lastTick = 0;
    const unthrottled = fps >= 60;
    const minStep = fps > 0 && !unthrottled ? Math.max(0, (1000 / fps) - 2) : 0;
    const loop = (now) => {
      rafId = 0;
      if (!document.hidden && (unthrottled || lastTick === 0 || now - lastTick >= minStep)) {
        lastTick = now;
        invalidate();
      }
      rafId = requestAnimationFrame(loop);
    };
    if (animate && fps > 0) rafId = requestAnimationFrame(loop);
    const visible = () => {
      if (!document.hidden) { clock.getDelta(); lastTick = 0; tick(); }
    };
    document.addEventListener('visibilitychange', visible);
    const controller = {
      inspect: () => ({
        renderer: 'three', calls: gl.info.render.calls, triangles: gl.info.render.triangles,
        geometries: gl.info.memory.geometries, textures: gl.info.memory.textures, canvas: [gl.domElement.width, gl.domElement.height],
        active: !!directorRef.current?.active, effect: directorRef.current?.active?.effect.id, hidden: document.hidden,
        card: directorRef.current?.active?.effect.cardType, upgraded: directorRef.current?.active?.effect.upgraded, elapsed: directorRef.current?.active?.elapsed, manual: directorRef.current?.active?.manual, lastEffectId: directorRef.current?.lastId,
        shadows: gl.shadowMap.enabled, pixelRatio: gl.getPixelRatio(), dynamicDpr: dynamicDprRef.current, bloom,
        quality: quality.level, gpu: probeGpuRenderer(),
        fps: animate ? fps : 0, outlines: quality.outlines, environment: quality.environment, pointLights: quality.pointLights,
        sharedCanvas: true, lightweightDungeon: Boolean(quality.lightweightDungeon),
      }),
      advance: milliseconds => { sampleTime.current = null; directorRef.current?.advance(milliseconds); invalidate(); },
      sample: milliseconds => { sample(milliseconds); invalidate(); },
      rotate: angle => { camera.userData.free = true; camera.position.set(Math.sin(angle) * 8, 4, Math.cos(angle) * 8); camera.lookAt(0, 1, 0); invalidate(); },
      project: point => { const p = new THREE.Vector3(...point).project(camera), rect = gl.domElement.getBoundingClientRect(); return { x: rect.left + (p.x + 1) * rect.width / 2, y: rect.top + (1 - p.y) * rect.height / 2 }; },
      // 머리 위 표시용: 이름 붙은 액터의 경계 상자 맨 위 가운데를 화면 좌표로 돌려준다.
      top: name => {
        const object = scene.getObjectByName(name); if (!object?.visible) return null; const box = new THREE.Box3().setFromObject(object); if (box.isEmpty()) return null;
        const p = new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y, (box.min.z + box.max.z) / 2).project(camera), rect = gl.domElement.getBoundingClientRect();
        return { x: rect.left + (p.x + 1) * rect.width / 2, y: rect.top + (1 - p.y) * rect.height / 2 };
      },
      settle: () => { sampleTime.current = null; directorRef.current?.finish(); invalidate(); },
      scene,
    };
    controllerInstanceRef.current = controller;
    gl.domElement.__sword3d = controller;
    controllerCallback.current?.(controller);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      controllerInstanceRef.current = null;
      gl.domElement.removeEventListener('webglcontextlost', lost);
      document.removeEventListener('visibilitychange', visible);
      delete gl.domElement.__sword3d;
    };
  }, [gl, invalidate, fps, animate, directorRef, camera, scene, clock, bloom, quality]);
  return null;
}

export default function ThreeStage({
  mode = 'battle', state, playback, playbackBusy = false, callbacks = {},
  graphicsQuality = 'balanced', motionPreference = 'normal', studying = false,
  parked = false, sceneInstanceId = 0, onWarmupReady, onPerfSuggest, warmupMode = false,
  onFailure, onLoaded, onController, ...worldProps
}) {
  const directorRef = useRef(playback);
  directorRef.current = playback;
  const [systemReduced, setSystemReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [compact, setCompact] = useState(() => matchMedia('(max-width: 760px)').matches);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const size = matchMedia('(max-width: 760px)');
    const motion = () => setSystemReduced(media.matches), resize = () => setCompact(size.matches);
    media.addEventListener('change', motion); size.addEventListener('change', resize);
    return () => { media.removeEventListener('change', motion); size.removeEventListener('change', resize); };
  }, []);
  const quality = useMemo(() => qualityProfile(graphicsQuality, {
    compact,
    pixelRatio: globalThis.devicePixelRatio ?? 1,
  }), [graphicsQuality, compact]);
  const [dynamicDpr, setDynamicDpr] = useState(() => quality.dpr);
  useEffect(() => {
    setDynamicDpr(quality.dpr);
  }, [quality.level, quality.dpr]);

  const monitor = useMemo(() => createPerfMonitor(), []);
  useEffect(() => {
    monitor.reset();
  }, [monitor, sceneInstanceId, quality.level, parked, warmupMode]);

  const handleDropDpr = useCallback(() => {
    const minDpr = quality.minDpr ?? quality.dpr;
    setDynamicDpr((prev) => Math.max(minDpr, Number((prev - 0.15).toFixed(2))));
  }, [quality.minDpr, quality.dpr]);

  const reduced = systemReduced || motionPreference !== 'normal';
  const active = !parked && !warmupMode && (playbackBusy || mode === 'entry' || worldProps.heroAction === 'attack');
  const targetFps = parked || warmupMode ? 0 : effectiveFrameRate(quality, { active, studying, reduced });
  const animate = !parked && !warmupMode && targetFps > 0;
  const bloom = !parked && !warmupMode && mode === 'battle' && quality.bloom && !reduced;
  const latest = useRef({ callbacks, onLoaded, onWarmupReady, parked, warmupMode, sceneInstanceId, monitor });
  latest.current = { callbacks, onLoaded, onWarmupReady, parked, warmupMode, sceneInstanceId, monitor };
  const bridge = useMemo(() => ({
    onReady: (readySceneId) => {
      if (latest.current.warmupMode) {
        latest.current.onWarmupReady?.();
        return;
      }
      if (latest.current.parked) return;
      if (readySceneId !== latest.current.sceneInstanceId) return;
      latest.current.monitor.markReady(performance.now());
      latest.current.onLoaded?.(readySceneId);
      latest.current.callbacks.onReady?.();
    },
  }), []);
  return <Canvas key={quality.antialias ? 'aa' : 'noaa'} className="three-canvas" shadows={quality.shadows ? THREE.PCFSoftShadowMap : false} dpr={dynamicDpr} frameloop="demand"
    camera={{ fov: 37, near: .1, far: 60, position: [1, 4, 9] }}
    gl={{ antialias: quality.antialias, alpha: false, powerPreference: quality.powerPreference, preserveDrawingBuffer: import.meta.env.DEV }}
    onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = .95; gl.domElement.dataset.renderer = 'three'; }}>
    <RenderLoop fps={targetFps} animate={animate} active={active} parked={parked} warmupMode={warmupMode}
      sceneInstanceId={sceneInstanceId} dynamicDpr={dynamicDpr} monitor={monitor}
      onDropDpr={handleDropDpr} onPerfSuggest={onPerfSuggest} onFailure={onFailure}
      directorRef={directorRef} onController={onController} bloom={bloom} quality={quality} />
    {bloom && <BattleBloom />}
    <Suspense fallback={null}>
      {parked ? <group visible={false} />
        : warmupMode ? <World mode="warmup" sceneInstanceId={0} quality={quality} reduced={reduced} onSceneReady={bridge.onReady} />
          : <World {...worldProps} mode={mode} sceneInstanceId={sceneInstanceId} state={state} playback={playback} quality={quality} reduced={reduced} studying={studying} onSceneReady={bridge.onReady} />}
    </Suspense>
  </Canvas>;
}
