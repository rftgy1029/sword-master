import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { modelUrl } from './quality.js';
import { CombatPlayback, combatPose } from './playback.js';
import { CARD_MOTIONS } from '../cardMotions.js';
import { setOutlineScale, stylizeActor } from './toon.js';
import { COMPOSITE_PIECES, KIT_SCALE, KIT_TINT, TILE, WALL_FRONT, dungeonKitUrl, dungeonLayout, groupByPiece } from './kenneyDungeon.js';

const stoneGeometry = new RoundedBoxGeometry(1, 1, 1, 1, .028);
const plainGeometry = new THREE.BoxGeometry(1,1,1);
const grainData = Uint8Array.from({ length:64*64*4 },(_,i)=>i%4===3?255:110+Math.floor((Math.sin(Math.floor(i/4)*127.1)*43758.5453%1+1)*45));
const stoneGrain = new THREE.DataTexture(grainData,64,64);
stoneGrain.wrapS=stoneGrain.wrapT=THREE.RepeatWrapping;
stoneGrain.magFilter=THREE.LinearFilter;stoneGrain.minFilter=THREE.LinearFilter;stoneGrain.needsUpdate=true;
const stoneMaterial = new THREE.MeshStandardMaterial({ roughness: .93, metalness: .06, bumpMap:stoneGrain,bumpScale:.055 });
const dummy = new THREE.Object3D();
const tint = new THREE.Color();
const stoneColors = ['#33443e', '#3a4941', '#3f4e45', '#35443c', '#495248'];

function Stones({ blocks, geometry=stoneGeometry }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    blocks.forEach((block, i) => {
      dummy.position.set(...block.position); dummy.scale.set(...block.scale); dummy.rotation.set(0, block.rotate ?? 0, 0); dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix); ref.current.setColorAt(i, tint.set(block.color ?? stoneColors[i % stoneColors.length]));
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, [blocks]);
  return <instancedMesh ref={ref} args={[geometry, stoneMaterial, blocks.length]} castShadow receiveShadow />;
}

function EnvironmentLight({ quality }) {
  const { gl, scene } = useThree();
  useEffect(() => {
    const generator = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const environment = generator.fromScene(room, .04);
    scene.environment = environment.texture;
    scene.environmentIntensity = .4;
    room.dispose(); generator.dispose();
    return () => { scene.environment = null; environment.dispose(); };
  }, [gl, scene]);
  return <>
    <hemisphereLight args={['#b5d5c8', '#3f342b', 1.1]} />
    <directionalLight position={[-3, 7, 5]} color="#ffe2b5" intensity={2.5} castShadow={quality.shadows}
      shadow-mapSize={[quality.shadowSize, quality.shadowSize]} shadow-bias={-.001} shadow-normalBias={.025}
      shadow-camera-left={-7} shadow-camera-right={7} shadow-camera-top={6} shadow-camera-bottom={-4} />
    <directionalLight position={[4, 4, -3]} color="#90c7cc" intensity={1.6} />
  </>;
}

function CameraFit({ mode }) {
  const { camera, size } = useThree();
  useLayoutEffect(() => {
    const aspect = size.width / Math.max(1, size.height);
    const vertical = Math.max(4.25, 7.8 / aspect);
    const distance = vertical / (2 * Math.tan(THREE.MathUtils.degToRad(37 / 2)));
    camera.fov = 37;
    if (mode === 'map') {
      const horizontal=aspect>1.5, halfX=horizontal?6.1:4, halfZ=horizontal?4:6.1;
      const target=new THREE.Vector3(0,.3,0),direction=new THREE.Vector3(.12,.82,.70).normalize();
      const right=new THREE.Vector3().crossVectors(camera.up,direction).normalize();
      const up=new THREE.Vector3().crossVectors(direction,right);
      const tanV=Math.tan(THREE.MathUtils.degToRad(camera.fov/2)),tanH=tanV*aspect;
      let fitted=0;
      // Fit every corner of the room bounds, including the nearer row's perspective.
      for(const x of [-halfX,halfX])for(const y of [-.4,1.4])for(const z of [-halfZ,halfZ]){
        const point=new THREE.Vector3(x,y,z).sub(target);
        fitted=Math.max(fitted,point.dot(direction)+Math.max(Math.abs(point.dot(right))/tanH,Math.abs(point.dot(up))/tanV)/.88);
      }
      camera.position.copy(target).addScaledVector(direction,fitted);
      camera.lookAt(target);
    } else {
      camera.position.set(distance * .12, distance * .32 + 1.3, distance * .95);
      camera.lookAt(0,1.1,0);
    }
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height, mode]);
  return null;
}

function Torch({ position }) {
  const flame = useRef(null);
  useFrame(({ clock }) => { if (flame.current) flame.current.scale.setScalar(.95 + Math.sin(clock.elapsedTime * 8 + position[0]) * .07); });
  return <group position={position}>
    <mesh position={[0, -.18, 0]}><cylinderGeometry args={[.045, .045, .5, 8]} /><meshStandardMaterial color="#392a21" roughness={.9} /></mesh>
    <mesh position={[0, .04, 0]}><cylinderGeometry args={[.13, .07, .14, 8]} /><meshStandardMaterial color="#ad8954" metalness={.7} roughness={.35} /></mesh>
    <mesh ref={flame} position={[0, .22, 0]}><sphereGeometry args={[.12, 10, 8]} /><meshStandardMaterial color="#ffb451" emissive="#ff9837" emissiveIntensity={3} /></mesh>
    <pointLight position={[0, .3, .25]} color="#ffc176" intensity={3.6} distance={5.5} decay={2} />
  </group>;
}

function KitInstances({ source, items }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    items.forEach((item, i) => {
      dummy.position.set(...item.position); dummy.rotation.set(0, item.rotate, 0); dummy.scale.setScalar(KIT_SCALE * item.scale); dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [items]);
  return <instancedMesh ref={ref} name={`kit-${source.name}`} args={[source.geometry, source.material, items.length]} castShadow receiveShadow />;
}

function KitClone({ source, item }) {
  const object = useMemo(() => {
    const copy = source.clone(true);
    copy.traverse(node => { if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; } });
    const door = copy.getObjectByName('door');
    if (door) door.position.y = 0; // 창살 문은 내려서 닫힌 모습으로 둔다
    return copy;
  }, [source]);
  return <primitive object={object} position={item.position} rotation={[0, item.rotate, 0]} scale={KIT_SCALE * item.scale} />;
}

// 바닥·벽·기둥·소품은 Kenney Mini Dungeon(CC0) 부품이고, 횃불·책장·화로·바닥 문양은 이 게임의 장식이다.
function Dungeon({ variant = 'hall', mode = 'battle' }) {
  const kit = useLoader(GLTFLoader, dungeonKitUrl());
  useLayoutEffect(() => { kit.scene.traverse(node => { if (node.isMesh) node.material.color.set(KIT_TINT); }); }, [kit]);
  const groups = useMemo(() => [...groupByPiece(dungeonLayout(variant, mode))], [variant, mode]);
  const books=useMemo(()=>[-5,5].flatMap(x=>[
    {position:[x,1.25,-2.15],scale:[1.4,2.5,.35],color:'#342d24'},
    ...[.45,1.05,1.65,2.25].flatMap((y,row)=>[
      {position:[x,y-.25,-2.05],scale:[1.45,.07,.5],color:'#76604a'},
      ...Array.from({length:8},(_,i)=>({position:[x-.56+i*.16,y,-1.92],scale:[.12,.35+i%3*.05,.23],color:['#6f6545','#495f51','#805549','#627679'][(i+row)%4]})),
    ]),
  ]),[]);
  return <group name="dungeon">
    {groups.map(([piece, items]) => {
      const source = kit.scene.getObjectByName(piece);
      if (!source) return null;
      return COMPOSITE_PIECES.includes(piece)
        ? items.map((item, i) => <KitClone key={`${piece}-${i}`} source={source} item={item} />)
        : <KitInstances key={piece} source={source} items={items} />;
    })}
    <mesh position={[0, -.3, 2]} receiveShadow><boxGeometry args={[30, .3, 14]} /><meshStandardMaterial color="#111e19" roughness={1} /></mesh>
    <mesh position={[0, 1.3, WALL_FRONT - TILE - .02]}><planeGeometry args={[2.6, 2.8]} /><meshBasicMaterial color="#070f0d" /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .012, 0]}><ringGeometry args={[1.55, 1.57, 64]} /><meshStandardMaterial color="#a78e53" metalness={.5} roughness={.5} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, Math.PI / 4]} position={[0, .016, 0]}><ringGeometry args={[1.03, 1.045, 4]} /><meshStandardMaterial color="#8e8152" metalness={.5} roughness={.5} /></mesh>
    <Torch position={[-2.6, 1.8, WALL_FRONT + .45]} /><Torch position={[2.6, 1.8, WALL_FRONT + .45]} />
    {variant==='library'&&<Stones blocks={books} geometry={plainGeometry}/>}
    {variant === 'forge' && <group position={[0, 0, WALL_FRONT + .1]}>
      <mesh position={[0, .9, 0]}><boxGeometry args={[1.65, 1.8, .3]} /><meshStandardMaterial color="#211d19" /></mesh>
      {[-.6,-.3,0,.3,.6].map(x => <mesh key={x} position={[x, .9, .19]}><boxGeometry args={[.055, 1.7, .08]} /><meshStandardMaterial color="#625542" metalness={.8} roughness={.45} /></mesh>)}
      <pointLight position={[0, .6, .5]} color="#ff8436" intensity={4} distance={6} />
      <mesh position={[0, .3, .03]}><planeGeometry args={[1.6, .6]} /><meshStandardMaterial color="#e47725" emissive="#fa7019" emissiveIntensity={2} /></mesh>
    </group>}
  </group>;
}

export function Actor({ type = 'hero', position = [0, 0, 0], rotation = 0, scale = 1, action = 'idle', control, still = false }) {
  const source = useLoader(GLTFLoader, modelUrl(type));
  const root = useRef(null);
  const actor = useMemo(() => {
    const object = clone(source.scene);
    object.traverse(node => { if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; } });
    const outline = stylizeActor(object);
    const mixer = new THREE.AnimationMixer(object);
    const actions = Object.fromEntries(source.animations.map(clip => [clip.name, mixer.clipAction(clip)]));
    return { object, mixer, actions, outline, name: null, action: null };
  }, [source]);
  useEffect(() => () => { actor.mixer.stopAllAction(); actor.outline.dispose(); actor.name=null; actor.action=null; }, [actor]);
  useFrame((_, delta) => {
    if (!root.current) return;
    const state = control?.() ?? {};
    const next = state.action ?? action;
    const key = actor.actions[next] ? next : 'idle';
    if (actor.name !== key) {
      actor.action?.fadeOut(.12);
      actor.action = actor.actions[key];
      actor.name = key;
      actor.action?.reset().setLoop(['idle','walk'].includes(key) ? THREE.LoopRepeat : THREE.LoopOnce, ['idle','walk'].includes(key) ? Infinity : 1).fadeIn(.12).play();
      if (actor.action) actor.action.clampWhenFinished = true;
    }
    if (state.animationTime !== undefined && actor.action) {
      actor.action.paused = true;
      actor.action.time = Math.min(.999, state.animationTime) * actor.action.getClip().duration;
      actor.mixer.update(still ? 0 : Math.min(delta,.1));
    } else {
      if (actor.action) {
        actor.action.paused = still;
        if(still&&!['idle','walk'].includes(key)){
          actor.action.stopFading().setEffectiveWeight(1);
          actor.action.time=actor.action.getClip().duration*(key==='death' ? .98 : .5);
        }
      }
      actor.mixer.update(still ? 0 : Math.min(delta, .1));
    }
    root.current.position.set(...(state.position ?? position));
    root.current.rotation.set(0, rotation, state.lean ?? 0);
    root.current.scale.setScalar(scale * (state.scale ?? 1));
    setOutlineScale(actor.outline, scale * (state.scale ?? 1));
    root.current.visible = state.visible !== false;
    if(import.meta.env.DEV)Object.assign(root.current.userData,{action:key,actionTime:actor.action?.time,mixerTime:actor.mixer.time,weight:actor.action?.getEffectiveWeight(),requestedTime:state.animationTime});
  }, -1);
  return <group ref={root} name={`actor-${type}`} position={position} rotation={[0, rotation, 0]} scale={scale} dispose={null}>
    <primitive object={actor.object} />
    <mesh rotation={[-Math.PI / 2,0,0]} position={[0,.005,0]}><circleGeometry args={[.48,32]} /><meshBasicMaterial color="#06100b" transparent opacity={.3} depthWrite={false} /></mesh>
  </group>;
}

function Motes({ count, still }) {
  const points = useRef(null);
  const values = useMemo(() => Float32Array.from(Array.from({ length: count * 3 }, (_, i) => i % 3 === 0 ? Math.sin(i * 13.17) * 6 : i % 3 === 1 ? (i * .17) % 4 : Math.cos(i * 2.42) * 3)), [count]);
  useFrame(({ clock }) => { if (points.current && !still) points.current.rotation.y = Math.sin(clock.elapsedTime / 12) * .09; });
  return <points ref={points}><bufferGeometry><bufferAttribute attach="attributes-position" args={[values,3]} /></bufferGeometry><pointsMaterial color="#e6d39b" size={.025} transparent opacity={.5} sizeAttenuation depthWrite={false} /></points>;
}

function SkillEffects({ director, quality }) {
  const root = useRef(null), ring = useRef(null), slash = useRef(null), beam = useRef(null), particles = useRef(null);
  const stones=useRef(null), shield=useRef(null), moons=useRef(null), seal=useRef(null), focus=useRef(null), wind=useRef(null), crown=useRef(null), fire=useRef(null);
  const upgraded=useRef(null);
  const geometry = useMemo(() => new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(quality.particles * 3), 3)), [quality.particles]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(() => {
    const current = director.active;
    if (!root.current) return;
    root.current.visible = !!current && current.effect.kind !== 'miss';
    if (!current) return;
    const { effect, enemy, elapsed, duration, plan } = current;
    const progress = elapsed / duration;
    const enemyAction=effect.kind==='enemy';
    const type = effect.cardType ?? (enemyAction?{block:'guard',buff:'empower',charge:'focus',wait:'flow'}[effect.enemyAction]:undefined);
    const color = new THREE.Color(enemy || enemyAction ? plan.color : CARD_MOTIONS[type]?.color ?? 0xd6ddb1);
    const damage = effect.kind === 'attack' || enemy;
    const x = enemyAction ? 2.3 : enemy ? -2.3 : type==='flare' ? -2.3+4.6*Math.min(1,elapsed/1000) : damage || type === 'weaken' ? 2.3 : -2.3;
    root.current.position.set(x, .025, 0);
    const pulse = Math.sin(Math.PI * progress);
    const phase = current.hits.length ? Math.max(...current.hits.map(at => Math.max(0, 1 - Math.abs(elapsed - at) / 400))) : pulse;
    ring.current.material.color.copy(color); ring.current.material.opacity = pulse * .7;
    ring.current.scale.setScalar(.45 + progress * (type === 'nova' ? 2.1 : 1.2));
    ring.current.rotation.z = progress * Math.PI;
    slash.current.visible = damage && phase > .02;
    slash.current.material.color.copy(color); slash.current.material.opacity = phase;
    slash.current.rotation.z = type === 'heavy' ? progress * 2 : progress * 5 - 1.7;
    slash.current.scale.setScalar((effect.upgraded ? 1.4 : 1.1) + phase * .3);
    beam.current.visible = type === 'nova' || type === 'oath' || type === 'heal' || type === 'empower';
    beam.current.scale.set(.5 + pulse * .6, 1, .5 + pulse * .6);
    beam.current.material.color.copy(color); beam.current.material.opacity = pulse * .17;
    stones.current.visible=type==='heavy'||type==='guard';
    stones.current.children.forEach((stone,i)=>{
      const angle=i*Math.PI/4;
      const radius=type==='guard' ? .75 : progress*1.5;
      stone.position.set(Math.cos(angle)*radius,type==='guard'?pulse*(.4+Math.sin(angle)*.2):phase*(.2+i%3*.22),Math.sin(angle)*radius);
      stone.rotation.set(progress+i,angle,progress*.6);
      stone.scale.setScalar((type==='guard'?pulse:phase)*.9);
    });
    shield.current.visible=type==='guard';shield.current.scale.setScalar(.4+pulse*.8);shield.current.material.opacity=pulse*.25;
    moons.current.visible=type==='twin';moons.current.rotation.z=progress*7;moons.current.scale.setScalar(.7+phase*.65);
    seal.current.visible=type==='weaken';seal.current.rotation.z=progress*3;seal.current.scale.setScalar(.65+pulse*.3);
    focus.current.visible=type==='focus';focus.current.rotation.y=progress*4;focus.current.scale.setScalar(.8+pulse*.2);
    wind.current.visible=type==='flow'||type==='flare';wind.current.rotation.x=progress*8;wind.current.position.y=.6+pulse*.5;
    wind.current.scale.setScalar(type==='flare' ? .7+progress*.8 : 1);
    crown.current.visible=type==='oath';crown.current.rotation.y=progress*2;crown.current.scale.setScalar(.4+pulse*.7);
    fire.current.visible=type==='empower';fire.current.children.forEach((flame,i)=>{flame.scale.setScalar(pulse*(.7+Math.sin(i+progress*14)*.3));});
    upgraded.current.visible=!!effect.upgraded;
    upgraded.current.scale.setScalar(.8+pulse*.6);
    upgraded.current.rotation.z=progress*3;
    upgraded.current.material.opacity=pulse*.7;
    if(import.meta.env.DEV)Object.assign(root.current.userData,{effectId:effect.id,upgraded:!!effect.upgraded});
    const positions = geometry.attributes.position.array;
    for (let i = 0; i < quality.particles; i++) {
      const a = i * 2.39996 + progress * 2;
      const radius = damage ? (.2 + phase * 1.5) * (i % 7 + 2) / 8 : .45 + Math.sin(i) * .25;
      positions[i * 3] = Math.cos(a) * radius;
      positions[i * 3 + 1] = damage ? .8 + Math.sin(a) * radius : ((i / quality.particles + progress) % 1) * 2.7;
      positions[i * 3 + 2] = Math.sin(a * 1.3) * radius * .5;
    }
    geometry.attributes.position.needsUpdate = true;
    particles.current.material.color.copy(color); particles.current.material.opacity = pulse;
  });
  return <group ref={root} name="skill-effects" visible={false}>
    <mesh ref={ring} rotation={[-Math.PI / 2,0,0]}><ringGeometry args={[.80,.84,64]} /><meshBasicMaterial transparent depthWrite={false} side={THREE.DoubleSide} /></mesh>
    <mesh ref={slash} position={[0,1.1,.25]}><torusGeometry args={[.8,.035,6,40,Math.PI * 1.35]} /><meshBasicMaterial transparent depthWrite={false} /></mesh>
    <mesh ref={beam} position={[0,1.5,0]}><cylinderGeometry args={[.45,.65,3.0,24,1,true]} /><meshBasicMaterial transparent depthWrite={false} side={THREE.DoubleSide} /></mesh>
    <points ref={particles} geometry={geometry}><pointsMaterial size={.065} sizeAttenuation transparent depthWrite={false} /></points>
    <mesh ref={upgraded} name="upgraded-halo" rotation={[-Math.PI/2,0,0]} position={[0,.12,0]} visible={false}><torusGeometry args={[1.05,.018,5,48]}/><meshBasicMaterial color="#fff3d0" transparent opacity={.6} depthWrite={false}/></mesh>
    <group ref={stones}>{Array.from({length:8},(_,i)=><mesh key={i}><dodecahedronGeometry args={[.18,0]}/><meshStandardMaterial color="#a5b589" roughness={.8}/></mesh>)}</group>
    <mesh ref={shield} position={[0,1.1,0]}><sphereGeometry args={[1,20,12]}/><meshBasicMaterial color="#b4dbb5" transparent opacity={.2} wireframe depthWrite={false}/></mesh>
    <group ref={moons} position={[0,1.2,.2]}>{[-1,1].map(side=><mesh key={side} rotation={[0,0,side*Math.PI/2]}><torusGeometry args={[.9,.035,6,32,Math.PI*1.3]}/><meshBasicMaterial color={side<0?'#bbe1ff':'#ddc3ff'}/></mesh>)}</group>
    <mesh ref={seal} position={[0,1.3,.3]}><ringGeometry args={[.65,.72,6]}/><meshBasicMaterial color="#cdbd86" side={THREE.DoubleSide}/></mesh>
    <group ref={focus} position={[0,1.4,0]}>{[0,1,2].map(i=><mesh key={i} rotation={[i*Math.PI/3,i*Math.PI/4,0]}><torusGeometry args={[.55,.015,5,32]}/><meshBasicMaterial color="#c0e5ff"/></mesh>)}</group>
    <group ref={wind}>{[0,1,2].map(i=><mesh key={i} position={[0,i*.2,0]} rotation={[Math.PI/2,.15*i,0]}><torusGeometry args={[.6+i*.12,.018,5,32,Math.PI*1.6]}/><meshBasicMaterial color="#b8eee0"/></mesh>)}</group>
    <group ref={crown} position={[0,2.3,0]}>{Array.from({length:7},(_,i)=><mesh key={i} position={[Math.cos(i*Math.PI*2/7)*.4,.07,Math.sin(i*Math.PI*2/7)*.4]}><octahedronGeometry args={[.12]}/><meshStandardMaterial color="#ffe2a4" metalness={.7} roughness={.2} emissive="#c4a04c" emissiveIntensity={.7}/></mesh>)}</group>
    <group ref={fire}>{Array.from({length:7},(_,i)=><mesh key={i} position={[Math.cos(i)*.45,.5,Math.sin(i)*.45]}><coneGeometry args={[.1,.75,7]}/><meshBasicMaterial color="#ffb26e" transparent opacity={.75}/></mesh>)}</group>
  </group>;
}

function BattleActors({ state, callbacks, quality, reduced, directorRef, initialEffectId }) {
  const latest = useRef(state); latest.current = state;
  const latestCallbacks = useRef(callbacks); latestCallbacks.current = callbacks;
  const director = useMemo(() => new CombatPlayback({ initialEffectId,
    onBusy: value => latestCallbacks.current.onBusy?.(value), onImpact: (index,target) => latestCallbacks.current.onImpact?.(index,target) }), []);
  useLayoutEffect(()=>{directorRef.current=director;return()=>{if(directorRef.current===director)directorRef.current=null;};},[director,directorRef]);
  const pose = useRef(combatPose(null));
  useEffect(() => {
    director.disposed = false;
    latestCallbacks.current.onReady?.();
    return () => director.dispose();
  }, [director]);
  useEffect(() => { director.start(state.effect, state.enemy.type, reduced); }, [director, state.effect.id, state.enemy.type, reduced]);
  useEffect(() => { if (reduced) director.finish(); }, [director,reduced]);
  useFrame((_,delta) => { if (!document.hidden&&!director.active?.manual) director.advance(delta * 1000); pose.current = combatPose(director.active); }, -2);
  const hero = () => {
    const current = director.active;
    const dead = latest.current.playerDead && !current;
    let action = dead ? 'death' : current ? current.enemy ? 'hit' : ['enemy','miss'].includes(current.effect.kind)?'idle':current.effect.kind === 'attack' ? 'attack' : current.effect.kind === 'block' ? 'guard' : 'victory' : 'idle';
    const animationTime = current && !current.enemy && current.effect.kind === 'attack' ? attackAnimationTime(current) : undefined;
    return { action, animationTime, position: [pose.current.heroX,pose.current.heroY,0], lean: dead ? -.8 : pose.current.heroLean };
  };
  const foe = () => {
    const current = director.active;
    const dead = latest.current.enemy.hp <= 0 && !current;
    return { action: dead ? 'death' : current ? current.enemy ? 'attack' : current.effect.kind === 'attack' ? 'hit' : current.effect.kind==='enemy'?{block:'guard',buff:'victory',charge:'guard',wait:'idle'}[current.effect.enemyAction]??'idle':'idle' : 'idle',
      position:[pose.current.enemyX,pose.current.enemyY,0], lean:dead ? -.65 : pose.current.enemyLean, scale:dead ? .8 : 1 };
  };
  return <>
    <Actor type="hero" rotation={Math.PI / 2} control={hero} still={reduced} />
    <Actor type={state.enemy.type} rotation={-Math.PI / 2} control={foe} still={reduced} />
    <SkillEffects director={director} quality={quality} />
  </>;
}

function attackAnimationTime(current) {
  const at = current.hits[0] ?? 800;
  const time = current.elapsed;
  return time <= at ? time / at * .5 : .5 + (time - at) / Math.max(1,current.duration - at) * .5;
}

function Camp({ forge = false }) {
  return <group position={[1,0,.3]}>
    {forge ? <>
      <mesh position={[0,.35,0]} castShadow><cylinderGeometry args={[.25,.33,.7,8]} /><meshStandardMaterial color="#4b3d2e" roughness={.8} /></mesh>
      <mesh position={[0,.85,0]} castShadow><boxGeometry args={[1,.24,.43]} /><meshStandardMaterial color="#8e9690" metalness={.8} roughness={.35} /></mesh>
      <mesh position={[.53,.87,0]} rotation={[0,0,Math.PI/2]}><coneGeometry args={[.19,.45,8]} /><meshStandardMaterial color="#8e9690" metalness={.8} roughness={.35} /></mesh>
    </> : <>
      {[0,1,2].map(i => <mesh key={i} position={[0,.12,0]} rotation={[Math.PI/2,i*Math.PI/3,0]}><cylinderGeometry args={[.075,.09,.9,8]} /><meshStandardMaterial color="#5d422d" roughness={.95} /></mesh>)}
      {[0,1,2].map(i => <mesh key={i} position={[(i-1)*.15,.4,0]}><coneGeometry args={[.14,.7-i*.1,8]} /><meshStandardMaterial color="#ffbf6e" emissive="#ff8a37" emissiveIntensity={2.5} /></mesh>)}
      <pointLight position={[0,.7,0]} color="#ffb469" intensity={5} distance={5} />
    </>}
  </group>;
}

function MapRooms({ run, onSelect, inspecting }) {
  const horizontal=useThree(state=>state.size.width>state.size.height*1.5);
  const possible = run.map.flat().filter(node => node.floor === run.floor + 1 && Math.abs(node.lane - run.lane) <= 1);
  const blocks = useMemo(() => run.map.flat().flatMap(node => {
    const x=(node.lane-1)*3,z=-(node.floor-3.5)*1.55;
    const color=run.visited.includes(node.id)?'#8b8057':node.type==='boss'?'#74503a':'#40564a';
    return [
      {position:[x,-.2,z],scale:[1.85,.4,1.2],color},
      {position:[x,.27,z-.53],scale:[1.8,.5,.14],color:'#647258'},
      {position:[x-.82,.20,z],scale:[.14,.4,1.1],color:'#647258'},
      {position:[x+.82,.20,z],scale:[.14,.4,1.1],color:'#647258'},
      {position:[x-.43,.35,z+.5],scale:[.12,.7,.16],color:'#7f865e'},
      {position:[x+.43,.35,z+.5],scale:[.12,.7,.16],color:'#7f865e'},
      {position:[x,.72,z+.5],scale:[.98,.12,.18],color:'#7f865e'},
    ];
  }), [run.map,run.visited]);
  return <group name="route-map" rotation={[0,horizontal?Math.PI/2:0,0]}>
    <Stones blocks={blocks} />
    {run.map.slice(0,-1).flatMap((row, index) => row.flatMap(node => run.map[index+1].filter(next=>Math.abs(node.lane-next.lane)<=1).map(next => {
      const a=new THREE.Vector3((node.lane-1)*3,-.15,-(node.floor-3.5)*1.55);
      const b=new THREE.Vector3((next.lane-1)*3,-.15,-(next.floor-3.5)*1.55);
      const quaternion=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());
      return <mesh key={node.id+next.id} position={a.clone().add(b).multiplyScalar(.5)} quaternion={quaternion}><cylinderGeometry args={[.045,.045,a.distanceTo(b),5]} /><meshStandardMaterial color={run.visited.includes(next.id)?'#c8aa6a':'#4b6250'} /></mesh>;
    })))}
    {run.map.flat().map(node => {
      const reachable=possible.some(n=>n.id===node.id) && !inspecting;
      return <group key={node.id} position={[(node.lane-1)*3,0,-(node.floor-3.5)*1.55]}>
        <mesh position={[0,.35,0]} onClick={event=>{event.stopPropagation();if(reachable)onSelect?.(node.id);}} onPointerOver={event=>{if(reachable)event.object.scale.setScalar(1.13);}} onPointerOut={event=>event.object.scale.setScalar(1)}>
          {node.type==='boss'||node.type==='elite'?<octahedronGeometry args={[.32,0]} />:node.type==='treasure'?<boxGeometry args={[.6,.35,.4]}/>:node.type==='rest'?<coneGeometry args={[.22,.6,7]}/>:<cylinderGeometry args={[.15,.23,.5,6]} />}
          <meshStandardMaterial color={node.type==='rest'?'#d89657':node.type==='treasure'?'#dbb975':reachable?'#c8dab6':'#637969'} metalness={.45} roughness={.38} emissive={reachable?'#94844d':'#000000'} emissiveIntensity={.35} />
        </mesh>
        {reachable && <mesh rotation={[-Math.PI/2,0,0]} position={[0,.012,0]}><ringGeometry args={[.5,.54,32]} /><meshBasicMaterial color="#dfc785" /></mesh>}
      </group>;
    })}
    <Actor position={[(run.lane-1)*3,.02,-(Math.max(0,run.floor)-3.5)*1.55]} scale={.32} rotation={Math.PI} />
    <Actor type="boss" position={[0,.02,-5.42]} scale={.28} rotation={0}/>
  </group>;
}

function EntranceActor({ reduced, onComplete }) {
  const elapsed=useRef(0), finished=useRef(false);
  useFrame((_,delta)=>{
    if(document.hidden||finished.current)return;
    elapsed.current+=delta;
    if(elapsed.current>(reduced ? .3 : 3.2)){finished.current=true;onComplete?.();}
  });
  return <Actor rotation={Math.PI} action={reduced?'idle':'walk'} still={reduced} control={()=>({position:[0,0,1-Math.min(1,elapsed.current/3)*3],scale:Math.max(.4,1-Math.max(0,elapsed.current-2)*.35)})} />;
}

function SceneReady({ callback }) {
  useEffect(()=>{callback?.();},[callback]);
  return null;
}

export default function World({ mode='battle', state, initialEffectId, callbacks={}, quality, reduced=false, run, onSelect, inspecting, onComplete, won=true, directorRef, onSceneReady }) {
  const variant=mode==='forge'||['ember','scarab','ravager','boss'].includes(state?.enemy.type)?'forge':['bat','wisp','watcher','mushroom'].includes(state?.enemy.type)?'library':'hall';
  return <>
    <color attach="background" args={['#101b16']} />
    <fog attach="fog" args={['#101b16',12,30]} />
    <CameraFit mode={mode} /><EnvironmentLight quality={quality} />
    {mode==='map'&&<MapRooms run={run} onSelect={onSelect} inspecting={inspecting} />}
    <Suspense fallback={null}>
      {mode!=='map'&&<Dungeon variant={variant} mode={mode} />}
      {mode==='battle'?<BattleActors state={state} callbacks={callbacks} quality={quality} reduced={reduced} directorRef={directorRef} initialEffectId={initialEffectId} />
        :mode==='entry'?<EntranceActor reduced={reduced} onComplete={onComplete} />
          :mode==='map'?null:<Actor position={mode==='title'?[-1.6,0,.7]:[-1.3,0,0]} rotation={mode==='title' ? .65 : Math.PI/3} action={mode==='result'?won?'victory':'death':'idle'} still={reduced} />}
      {mode!=='battle'&&<SceneReady callback={onSceneReady}/>}
    </Suspense>
    {['rest','forge'].includes(mode)&&<Camp forge={mode==='forge'} />}
    {mode==='reward'&&<pointLight position={[1.2,1.1,.3]} color="#ffdc8c" intensity={2} distance={3} />}
    <Motes count={quality.particles} still={reduced} />
  </>;
}
