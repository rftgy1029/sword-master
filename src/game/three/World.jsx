import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { modelUrl } from './quality.js';
import { impactAges } from './playback.js';
import { ENEMY_HOME, heroPose, impulse } from './heroMotion.js';
import { createKnightRig } from './knightRig.js';
import { enemyAttackPose } from '../enemyAttackTimeline.js';
import SkillEffects from './SkillEffects.jsx';
import { setHitFlash, setOutlineScale, stylizeActor } from './toon.js';
import CombatAtmosphere from './CombatAtmosphere.jsx';
import SwordTrail from './SwordTrail.jsx';
import ImpactEffects, { hitFlashAmount } from './ImpactEffects.jsx';
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
// 모든 장면의 조명과 배경색. UI 색(src/styles/dusk.css)도 같은 노을빛에서 뽑았다.
const DUSK = { background: '#1a1322', sky: '#c3a6e3', ground: '#4b2f2b', sun: '#ffb26b', rim: '#8f7fe0' };

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
    {/* 황혼: 왼쪽에서 낮게 드는 주황 노을빛과 뒤쪽의 보랏빛 하늘 */}
    <hemisphereLight args={[DUSK.sky, DUSK.ground, 1.05]} />
    <directionalLight position={[-6, 5, 5]} color={DUSK.sun} intensity={2.7} castShadow={quality.shadows}
      shadow-mapSize={[quality.shadowSize, quality.shadowSize]} shadow-bias={-.001} shadow-normalBias={.025}
      shadow-camera-left={-7} shadow-camera-right={7} shadow-camera-top={6} shadow-camera-bottom={-4} />
    <directionalLight position={[4, 4, -3]} color={DUSK.rim} intensity={1.7} />
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
    } else if (mode === 'title') {
      // 타이틀은 화면 전체를 채우는 배경이다. 넓은 화면은 왼쪽 메뉴를 피해 장면을 오른쪽으로,
      // 세로 화면은 아래쪽 메뉴를 피해 장면을 위로 보낸다.
      const wide = aspect >= 1.1;
      const span = wide ? 5.9 : 9.6;
      const reach = span / (2 * Math.tan(THREE.MathUtils.degToRad(37 / 2)));
      const target = wide ? new THREE.Vector3(-1.2, 1.15, 0) : new THREE.Vector3(.75, -1.75, 0);
      camera.position.set(target.x + reach * .1, target.y + reach * .3 + .3, reach * .95);
      camera.lookAt(target);
    } else {
      camera.position.set(distance * .12, distance * .32 + 1.3, distance * .95);
      camera.lookAt(0,1.1,0);
    }
    camera.updateProjectionMatrix();
    // 타격 연출의 카메라 흔들림은 이 위치를 기준으로 잠깐 움직였다가 돌아온다.
    camera.userData.base = camera.position.clone();
    camera.userData.baseFov = camera.fov;
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
    <mesh position={[0, 1.15, WALL_FRONT - TILE - .02]}><planeGeometry args={[2.6, 2.3]} /><meshBasicMaterial color="#070f0d" /></mesh>
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

export function Actor({ type = 'hero', position = [0, 0, 0], rotation = 0, scale = 1, action = 'idle', control, still = false, procedural = false, weaponRef, anchorRef }) {
  const source = useLoader(GLTFLoader, modelUrl(type));
  const root = useRef(null);
  const actor = useMemo(() => {
    const object = clone(source.scene);
    const head = object.getObjectByName('head') ?? object;
    // The knight's skinned mesh includes its sword; attach to the helmet joint instead.
    const headPoint = new THREE.Vector3(0, .52, 0);
    if (type !== 'hero') {
      const headBounds = new THREE.Box3().setFromObject(head);
      head.getWorldPosition(headPoint);
      headPoint.y = headBounds.isEmpty() ? headPoint.y + .4 : headBounds.max.y + .12;
      head.worldToLocal(headPoint);
    }
    object.traverse(node => { if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; } });
    const outline = stylizeActor(object);
    const mixer = new THREE.AnimationMixer(object);
    const actions = Object.fromEntries(source.animations.map(clip => [clip.name, mixer.clipAction(clip)]));
    const rig = procedural ? createKnightRig(object) : null;
    return { object, mixer, actions, outline, rig, head, headPoint, name: null, action: null };
  }, [source, procedural]);
  useLayoutEffect(() => {
    if (!anchorRef) return;
    anchorRef.current = { root: root.current, head: actor.head, point: actor.headPoint };
    return () => { anchorRef.current = null; };
  }, [actor, anchorRef]);
  useLayoutEffect(() => {
    if (!weaponRef) return;
    const base = actor.object.getObjectByName('weapon'), tip = actor.object.getObjectByName('weapon_tip');
    weaponRef.current = base && tip ? { base, tip } : null;
    return () => { weaponRef.current = null; };
  }, [actor, weaponRef]);
  useEffect(() => () => { actor.mixer.stopAllAction(); actor.outline.dispose(); actor.name=null; actor.action=null; }, [actor]);
  useFrame((_, delta) => {
    if (!root.current) return;
    const state = control?.() ?? {};
    const next = state.action ?? action;
    const key = actor.actions[next] ? next : 'idle';
    if (!actor.rig && actor.name !== key) {
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
    if (state.pose && actor.rig) {
      const pose = state.pose;
      root.current.position.set(pose.x, pose.y, pose.z);
      root.current.rotation.set(Math.PI / 180 * pose.pitch, rotation - Math.PI / 180 * pose.yaw, Math.PI / 180 * pose.roll, 'YXZ');
      actor.rig.apply(pose);
    } else {
      root.current.position.set(...(state.position ?? position));
      root.current.rotation.set(0, rotation, state.lean ?? 0);
    }
    root.current.scale.setScalar(scale * (state.scale ?? 1));
    setOutlineScale(actor.outline, scale * (state.scale ?? 1));
    setHitFlash(actor.outline, state.flash ?? 0, state.flashColor);
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

function BattleActors({ state, director, quality, reduced, onAnchors }) {
  const pose = useRef({});
  const sword = useRef(null);
  const ages = useRef([]);
  const foe = useRef({ position: [ENEMY_HOME, 0, 0] });
  const impact = useRef({ heroX: -2.3, enemyX: ENEMY_HOME });
  const heroAnchor = useRef(null), enemyAnchor = useRef(null);
  const projected = useRef(new THREE.Vector3());
  const anchors = useRef({ renderer: '3d', player: {}, enemy: {} });
  useFrame(({ clock }, delta) => {
    if (!document.hidden && !director.active?.manual) director.advance(delta * 1000);
    const current = director.active;
    const plan = current?.plan;
    const hitAges = impactAges(current, ages.current);
    heroPose(current, pose.current, {
      time: clock.elapsedTime, ages: hitAges, still: reduced, dead: state.playerDead,
      victory: state.enemy.hp <= 0,
    });

    let hitAge = -1, knockback = 0;
    if (plan?.side === 'hero' && !plan.calm) for (let index = 0; index < hitAges.length; index++) {
      if (hitAges[index] < 0) continue;
      hitAge = hitAges[index];
      knockback += impulse(hitAge, 45, 330) * plan.hitInfo[index].power;
    }
    const enemy = foe.current;
    const attack = plan?.attack && !plan.calm ? enemyAttackPose(plan.attack, current.elapsed) : null;
    const dead = state.enemy.hp <= 0 && (!current || (plan.lethal &&
      (plan.hits.length ? current.delivered > plan.killIndex : current.momentDelivered)));
    const fall = dead && !plan?.calm ? Math.min(1, current ? Math.max(0, current.elapsed - plan.killAt) / 640 : 1) : Number(dead);
    const action = plan?.action;
    enemy.action = dead ? 'death' : attack ? 'attack' : hitAge >= 0 && hitAge < 330 ? 'hit'
      : ({ block: 'guard', buff: 'victory', charge: 'guard' })[action] ?? 'idle';
    enemy.animationTime = dead ? fall : attack?.clip ?? (enemy.action === 'hit' ? hitAge / 330 : undefined);
    enemy.position[0] = ENEMY_HOME - (attack?.advance ?? 0) * 4.6 + knockback * .18;
    enemy.position[1] = attack?.height ?? 0;
    enemy.lean = dead ? -.65 * fall : (attack?.lean ?? 0) * Math.PI / 180 - knockback * .12;
    enemy.scale = 1 - fall * .22;
    enemy.visible = fall < 1;
    enemy.flash = reduced ? 0 : hitFlashAmount(current, 'enemy');
    impact.current.heroX = pose.current.x;
    impact.current.enemyX = enemy.position[0];
  }, -2);
  useFrame(({ camera }) => {
    if (!onAnchors || !heroAnchor.current || !enemyAnchor.current) return;
    for (const [side, anchor] of [['player', heroAnchor.current], ['enemy', enemyAnchor.current]]) {
      anchor.head.updateWorldMatrix(true, false);
      const point = projected.current.copy(anchor.point).applyMatrix4(anchor.head.matrixWorld).project(camera);
      Object.assign(anchors.current[side], { x: (point.x + 1) / 2, y: (1 - point.y) / 2, visible: anchor.root.visible });
    }
    onAnchors(anchors.current);
  });

  return <>
    <Actor type="hero" rotation={Math.PI / 2} procedural weaponRef={sword} anchorRef={heroAnchor} still={reduced} control={() => ({
      pose: pose.current, flash: reduced ? 0 : hitFlashAmount(director.active, 'hero'), flashColor: '#ffd2c4',
    })} />
    <Actor type={state.enemy.type} rotation={-Math.PI / 2} anchorRef={enemyAnchor} still={reduced} control={() => foe.current} />
    <CombatAtmosphere director={director} quality={quality} pose={pose} sword={sword} />
    <SwordTrail director={director} quality={quality} sword={sword} />
    <SkillEffects director={director} quality={quality} sword={sword} />
    <ImpactEffects director={director} pose={() => impact.current} quality={quality} reduced={reduced} />
  </>;
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

function MapRooms({ run, onSelect, inspecting, onHighlight, highlightedNodeId }) {
  const horizontal=useThree(state=>state.size.width>state.size.height*1.5);
  const canvas=useThree(state=>state.gl.domElement);
  useEffect(() => () => { canvas.style.cursor = ''; }, [canvas]);
  const possible = run.map.flat().filter(node => node.floor === run.floor + 1 && Math.abs(node.lane - run.lane) <= 1);
  const blocks = useMemo(() => run.map.flat().flatMap(node => {
    const x=(node.lane-1)*3,z=-(node.floor-3.5)*1.55;
    const color=run.visited.includes(node.id)?'#9b7a52':node.type==='boss'?'#7a4636':'#4a3f5c';
    return [
      {position:[x,-.2,z],scale:[1.85,.4,1.2],color},
      {position:[x,.27,z-.53],scale:[1.8,.5,.14],color:'#6c6180'},
      {position:[x-.82,.20,z],scale:[.14,.4,1.1],color:'#6c6180'},
      {position:[x+.82,.20,z],scale:[.14,.4,1.1],color:'#6c6180'},
      {position:[x-.43,.35,z+.5],scale:[.12,.7,.16],color:'#8a5a36'},
      {position:[x+.43,.35,z+.5],scale:[.12,.7,.16],color:'#8a5a36'},
      {position:[x,.72,z+.5],scale:[.98,.12,.18],color:'#8a5a36'},
    ];
  }), [run.map,run.visited]);
  return <group name="route-map" rotation={[0,horizontal?Math.PI/2:0,0]}>
    <Stones blocks={blocks} />
    {run.map.slice(0,-1).flatMap((row, index) => row.flatMap(node => run.map[index+1].filter(next=>Math.abs(node.lane-next.lane)<=1).map(next => {
      const a=new THREE.Vector3((node.lane-1)*3,-.15,-(node.floor-3.5)*1.55);
      const b=new THREE.Vector3((next.lane-1)*3,-.15,-(next.floor-3.5)*1.55);
      const quaternion=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());
      return <mesh key={node.id+next.id} position={a.clone().add(b).multiplyScalar(.5)} quaternion={quaternion}><cylinderGeometry args={[.045,.045,a.distanceTo(b),5]} /><meshStandardMaterial color={run.visited.includes(next.id)?'#ffb25e':'#6f5f86'} /></mesh>;
    })))}
    {run.map.flat().map(node => {
      const reachable=possible.some(n=>n.id===node.id) && !inspecting;
      const highlighted=highlightedNodeId===node.id;
      return <group key={node.id} position={[(node.lane-1)*3,0,-(node.floor-3.5)*1.55]}>
        <mesh name={`map-room-hit-${node.id}`} position={[0,.4,0]}
          onClick={event=>{event.stopPropagation();if(reachable)onSelect?.(node.id);}}
          onPointerOver={event=>{event.stopPropagation();onHighlight?.(node.id);canvas.style.cursor=reachable?'pointer':'';}}
          onPointerOut={()=>{onHighlight?.(null);canvas.style.cursor='';}}>
          <boxGeometry args={[1.95,1.15,1.3]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        <mesh position={[0,.35,0]} scale={highlighted && reachable ? 1.13 : 1}>
          {node.type==='boss'||node.type==='elite'?<octahedronGeometry args={[.32,0]} />:node.type==='treasure'?<boxGeometry args={[.6,.35,.4]}/>:node.type==='rest'?<coneGeometry args={[.22,.6,7]}/>:<cylinderGeometry args={[.15,.23,.5,6]} />}
          <meshStandardMaterial color={node.type==='rest'?'#e98567':node.type==='treasure'?'#ffc477':reachable?'#f3dcc0':'#7d7090'} metalness={.45} roughness={.38} emissive={reachable?'#a05a2a':'#000000'} emissiveIntensity={highlighted ? .8 : .35} />
        </mesh>
        {reachable && <mesh position={[0,.015,0]}><boxGeometry args={[1.86,.03,1.22]}/><meshBasicMaterial color="#ffb25e" transparent opacity={highlighted ? .45 : .25}/></mesh>}
        {reachable && <mesh rotation={[-Math.PI/2,0,0]} position={[0,.012,0]}><ringGeometry args={[.5,.54,32]} /><meshBasicMaterial color="#ffb25e" /></mesh>}
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

export default function World({ mode='battle', state, playback, quality, reduced=false, run, onSelect, inspecting, onHighlight, highlightedNodeId, onComplete, won=true, onSceneReady, heroAction='idle', onAnchors }) {
  const variant=mode==='forge'||['ember','scarab','ravager','boss'].includes(state?.enemy.type)?'forge':['bat','wisp','watcher','mushroom'].includes(state?.enemy.type)?'library':'hall';
  return <>
    <color attach="background" args={[DUSK.background]} />
    <fog attach="fog" args={[DUSK.background,12,30]} />
    <CameraFit mode={mode} /><EnvironmentLight quality={quality} />
    {mode==='map'&&<MapRooms run={run} onSelect={onSelect} inspecting={inspecting} onHighlight={onHighlight} highlightedNodeId={highlightedNodeId} />}
    <Suspense fallback={null}>
      {mode!=='map'&&<Dungeon variant={variant} mode={mode} />}
      {mode==='battle'?<BattleActors state={state} director={playback} quality={quality} reduced={reduced} onAnchors={onAnchors} />
        :mode==='entry'?<EntranceActor reduced={reduced} onComplete={onComplete} />
          :mode==='map'?null:mode==='title'?<Actor position={[.9,0,.9]} rotation={-.38} action={heroAction} still={reduced} />
            :<Actor position={[-1.3,0,0]} rotation={Math.PI/3} action={mode==='result'?won?'victory':'death':'idle'} still={reduced} />}
      <SceneReady callback={onSceneReady}/>
    </Suspense>
    {['rest','forge'].includes(mode)&&<Camp forge={mode==='forge'} />}
    {mode==='reward'&&<pointLight position={[1.2,1.1,.3]} color="#ffdc8c" intensity={2} distance={3} />}
    <Motes count={quality.particles} still={reduced} />
  </>;
}
