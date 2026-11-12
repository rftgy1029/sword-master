import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import World from './World.jsx';
import { qualityProfile } from './quality.js';

function RenderLoop({ fps, animate, onFailure, directorRef, onController, onSlow }) {
  const { gl, invalidate, scene, camera, clock } = useThree();
  const failures = useRef(onFailure); failures.current = onFailure;
  const controllerCallback=useRef(onController);controllerCallback.current=onController;
  const slow = useRef({ frames: 0, duration: 0 });
  const sampleTime=useRef(null);
  const sample=(milliseconds)=>{
    const director=directorRef.current,current=director?.active;
    if(!current){sampleTime.current=milliseconds;return;}
    current.elapsed=Math.max(0,Math.min(current.duration,milliseconds));current.manual=true;director.deliver(current);sampleTime.current=null;
  };
  useFrame(()=>{if(sampleTime.current!==null&&directorRef.current?.active)sample(sampleTime.current);},-3);
  useEffect(() => {
    const lost = event => { event.preventDefault(); failures.current?.(); };
    gl.domElement.addEventListener('webglcontextlost', lost);
    const tick = () => { if (!document.hidden) invalidate(); };
    tick();
    const interval = animate ? setInterval(tick, 1000 / fps) : null;
    const visible = () => { if (!document.hidden) { clock.getDelta(); tick(); } };
    document.addEventListener('visibilitychange', visible);
    const controller = {
      inspect: () => ({ renderer: 'three', calls: gl.info.render.calls, triangles: gl.info.render.triangles,
        geometries: gl.info.memory.geometries, textures: gl.info.memory.textures, canvas: [gl.domElement.width, gl.domElement.height],
        active: !!directorRef.current?.active, effect: directorRef.current?.active?.effect.id, hidden: document.hidden,
        card:directorRef.current?.active?.effect.cardType,upgraded:directorRef.current?.active?.effect.upgraded,elapsed:directorRef.current?.active?.elapsed,manual:directorRef.current?.active?.manual,lastEffectId:directorRef.current?.lastId,
        shadows:gl.shadowMap.enabled,pixelRatio:gl.getPixelRatio() }),
      advance: milliseconds => { sampleTime.current=null;directorRef.current?.advance(milliseconds); invalidate(); },
      sample: milliseconds=>{sample(milliseconds);invalidate();},
      rotate: angle => { camera.position.set(Math.sin(angle) * 8, 4, Math.cos(angle) * 8); camera.lookAt(0,1,0); invalidate(); },
      project: point => { const p=new THREE.Vector3(...point).project(camera),rect=gl.domElement.getBoundingClientRect();return {x:rect.left+(p.x+1)*rect.width/2,y:rect.top+(1-p.y)*rect.height/2}; },
      settle: () => { sampleTime.current=null;directorRef.current?.finish(); invalidate(); },
      scene,
    };
    gl.domElement.__sword3d = controller;
    controllerCallback.current?.(controller);
    return () => {
      if (interval) clearInterval(interval);
      gl.domElement.removeEventListener('webglcontextlost', lost);
      document.removeEventListener('visibilitychange', visible);
      delete gl.domElement.__sword3d;
    };
  }, [gl, invalidate, fps, animate, directorRef, camera, scene, clock]);
  useFrame((_, delta) => {
    if (delta > 0 && delta < 1.5 && animate && !document.hidden) {
      slow.current.duration += delta; slow.current.frames++;
      if (slow.current.frames === 120) {
        if (slow.current.duration / 120 > .065) { gl.setPixelRatio(Math.min(1, gl.getPixelRatio())); onSlow(); }
        slow.current = { frames: 0, duration: 0 };
      }
    }
  });
  return null;
}

export default function ThreeStage({ mode='battle', state, initialEffectId, callbacks={}, graphicsQuality='auto', motionPreference='normal', onFailure, onLoaded, onController, ...worldProps }) {
  const directorRef = useRef(null);
  const firstEffectId=useRef(initialEffectId??state?.effect.id??0).current;
  const [busy, setBusy] = useState(false);
  const [autoLow,setAutoLow]=useState(false);
  const [systemReduced, setSystemReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [compact, setCompact] = useState(() => matchMedia('(max-width: 760px)').matches);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const size = matchMedia('(max-width: 760px)');
    const motion = () => setSystemReduced(media.matches), resize = () => setCompact(size.matches);
    media.addEventListener('change', motion); size.addEventListener('change', resize);
    return () => { media.removeEventListener('change', motion); size.removeEventListener('change', resize); };
  }, []);
  const quality = useMemo(() => qualityProfile(graphicsQuality==='auto'&&autoLow?'low':graphicsQuality, { compact, pixelRatio: globalThis.devicePixelRatio ?? 1 }), [graphicsQuality,compact,autoLow]);
  const reduced = systemReduced || motionPreference !== 'normal';
  const latest = useRef({ callbacks, onLoaded }); latest.current = { callbacks,onLoaded };
  const bridge = useMemo(() => ({
    onBusy: value => { setBusy(value); latest.current.callbacks.onBusy?.(value); },
    onImpact: (index,target) => latest.current.callbacks.onImpact?.(index,target),
    onReady: () => { latest.current.onLoaded?.(); latest.current.callbacks.onReady?.(); },
  }), []);
  return <Canvas className="three-canvas" shadows={quality.shadows ? THREE.PCFSoftShadowMap : false} dpr={quality.dpr} frameloop="demand"
    camera={{ fov:37, near:.1, far:60, position:[1,4,9] }}
    gl={{ antialias:quality.level!=='low', alpha:false, powerPreference:quality.level==='low'?'low-power':'high-performance', preserveDrawingBuffer:import.meta.env.DEV }}
    onCreated={({gl}) => { gl.toneMapping=THREE.ACESFilmicToneMapping; gl.toneMappingExposure=.95; gl.domElement.dataset.renderer='three'; }}>
    <RenderLoop fps={quality.fps} animate={!reduced || busy || mode==='entry'} onFailure={onFailure} directorRef={directorRef} onController={onController} onSlow={()=>setAutoLow(true)} />
    <Suspense fallback={null}>
      <World {...worldProps} mode={mode} state={state} initialEffectId={firstEffectId} callbacks={bridge} quality={quality} reduced={reduced} directorRef={directorRef} onSceneReady={bridge.onReady} />
    </Suspense>
  </Canvas>;
}
