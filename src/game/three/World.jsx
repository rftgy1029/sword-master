import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { modelUrl } from './quality.js';
import { impactAges } from './playback.js';
import { ENEMY_HOME, heroPose, impulse } from './heroMotion.js';
import { BATTLE_FOG, battleCameraPose } from './battleCamera.js';
import BattleCamera from './BattleCamera.jsx';
import { createKnightRig } from './knightRig.js';
import { enemyAttackPose } from '../enemyAttackTimeline.js';
import SkillEffects from './SkillEffects.jsx';
import { setActorOutlines, setHitFlash, setOutlineScale, stylizeActor } from './toon.js';
import CombatAtmosphere from './CombatAtmosphere.jsx';
import SwordTrail from './SwordTrail.jsx';
import ImpactEffects, { hitFlashAmount } from './ImpactEffects.jsx';
import RouteTower, { mapTokensUrl } from './RouteTower.jsx';
import { COMPOSITE_PIECES, KIT_SCALE, KIT_TINT, TILE, WALL_FRONT, dungeonKitUrl, dungeonLayout, groupByPiece } from './kenneyDungeon.js';

const stoneGeometry = new RoundedBoxGeometry(1, 1, 1, 1, .028);
const plainGeometry = new THREE.BoxGeometry(1,1,1);
const grainData = Uint8Array.from({ length:64*64*4 },(_,i)=>i%4===3?255:110+Math.floor((Math.sin(Math.floor(i/4)*127.1)*43758.5453%1+1)*45));
const stoneGrain = new THREE.DataTexture(grainData,64,64);
stoneGrain.wrapS=stoneGrain.wrapT=THREE.RepeatWrapping;
stoneGrain.magFilter=THREE.LinearFilter;stoneGrain.minFilter=THREE.LinearFilter;stoneGrain.needsUpdate=true;
const stoneMaterial = new THREE.MeshStandardMaterial({ roughness: .93, metalness: .06, bumpMap:stoneGrain,bumpScale:.055 });
const stoneLambertMaterial = new THREE.MeshLambertMaterial({ color: '#ffffff' });
const kitOriginalMaterials = new WeakMap();
const kitStandardMaterials = new WeakMap();
const kitLambertMaterials = new WeakMap();
const dummy = new THREE.Object3D();
const tint = new THREE.Color();
const stoneColors = ['#33443e', '#3a4941', '#3f4e45', '#35443c', '#495248'];
// 모든 장면의 조명과 배경색. UI 색(src/styles/dusk.css)도 같은 노을빛에서 뽑았다.
const DUSK = { background: '#1a1322', sky: '#c3a6e3', ground: '#4b2f2b', sun: '#ffb26b', rim: '#8f7fe0' };

function resolveKitMaterial(mesh, lightweight) {
  if (!mesh?.material) return mesh?.material;
  if (!kitOriginalMaterials.has(mesh)) {
    const current = mesh.material;
    kitOriginalMaterials.set(mesh, kitStandardMaterials.get(current) ?? current);
  }
  const original = kitOriginalMaterials.get(mesh);
  if (!original || Array.isArray(original)) return original;
  if (!lightweight) {
    original.color?.set(KIT_TINT);
    return original;
  }
  let lambert = kitLambertMaterials.get(original);
  if (!lambert) {
    lambert = new THREE.MeshLambertMaterial({
      name: `${original.name || 'kit'} lambert`,
      color: KIT_TINT,
      map: original.map ?? null,
      side: original.side,
      vertexColors: Boolean(original.vertexColors),
      transparent: Boolean(original.transparent),
      opacity: original.opacity ?? 1,
      alphaTest: original.alphaTest ?? 0,
    });
    kitLambertMaterials.set(original, lambert);
    kitStandardMaterials.set(lambert, original);
  }
  return lambert;
}

function Stones({ blocks, geometry=stoneGeometry, shadows=true, lightweight=false }) {
  const [mesh, setMesh] = useState(null);
  const material = lightweight ? stoneLambertMaterial : stoneMaterial;
  useLayoutEffect(() => {
    if (!mesh) return;
    blocks.forEach((block, i) => {
      dummy.position.set(...block.position); dummy.scale.set(...block.scale); dummy.rotation.set(0, block.rotate ?? 0, 0); dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix); mesh.setColorAt(i, tint.set(block.color ?? stoneColors[i % stoneColors.length]));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [mesh, blocks]);
  return <instancedMesh ref={setMesh} args={[geometry, stoneMaterial, blocks.length]} material={material} castShadow={shadows} receiveShadow={shadows} />;
}

function EnvironmentLight({ quality }) {
  const { gl, scene } = useThree();
  const useEnvironment = quality.environment !== false;
  useEffect(() => {
    if (!useEnvironment) {
      scene.environment = null;
      return undefined;
    }
    const generator = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const environment = generator.fromScene(room, .04);
    scene.environment = environment.texture;
    scene.environmentIntensity = .4;
    room.dispose(); generator.dispose();
    return () => { scene.environment = null; environment.dispose(); };
  }, [gl, scene, useEnvironment]);
  const hemiIntensity = useEnvironment ? 1.05 : quality.rimLight !== false ? 1.42 : 1.58;
  const sunIntensity = useEnvironment ? 2.7 : 2.95;
  return <>
    {/* 황혼: 왼쪽에서 낮게 드는 주황 노을빛과 뒤쪽의 보랏빛 하늘 */}
    <hemisphereLight args={[DUSK.sky, DUSK.ground, hemiIntensity]} />
    <directionalLight position={[-6, 5, 5]} color={DUSK.sun} intensity={sunIntensity} castShadow={quality.shadows}
      shadow-mapSize={[quality.shadowSize, quality.shadowSize]} shadow-bias={-.001} shadow-normalBias={.025}
      shadow-camera-left={-7} shadow-camera-right={7} shadow-camera-top={6} shadow-camera-bottom={-4} />
    {quality.rimLight !== false && <directionalLight position={[4, 4, -3]} color={DUSK.rim} intensity={1.7} />}
  </>;
}

function CameraFit({ mode, view, sceneInstanceId = 0 }) {
  const { camera, size, scene } = useThree();
  const lastSceneId = useRef(sceneInstanceId);
  useLayoutEffect(() => {
    if (lastSceneId.current !== sceneInstanceId) {
      camera.userData.free = false;
      lastSceneId.current = sceneInstanceId;
    }
    const aspect = size.width / Math.max(1, size.height);
    const vertical = Math.max(4.25, 7.8 / aspect);
    const distance = vertical / (2 * Math.tan(THREE.MathUtils.degToRad(37 / 2)));
    camera.fov = 37;
    if (mode === 'map') {
      return; // 경로 탑은 RouteTower가 지금 층에 맞춰 카메라를 움직인다.
    } else if (mode === 'title') {
      // 타이틀은 화면 전체를 채우는 배경이다. 넓은 화면은 왼쪽 메뉴를 피해 장면을 오른쪽으로,
      // 세로 화면은 아래쪽 메뉴를 피해 장면을 위로 보낸다.
      const wide = aspect >= 1.1;
      const span = wide ? 5.9 : 9.6;
      const reach = span / (2 * Math.tan(THREE.MathUtils.degToRad(37 / 2)));
      const target = wide ? new THREE.Vector3(-1.2, 1.15, 0) : new THREE.Vector3(.75, -1.75, 0);
      camera.position.set(target.x + reach * .1, target.y + reach * .3 + .3, reach * .95);
      camera.lookAt(target);
    } else if (mode === 'battle' || mode === 'warmup') {
      // 전투는 비스듬한 사선 구도. 화면 비율에 맞춰 두 캐릭터가 잘리지 않는 거리를 계산한다.
      const pose = battleCameraPose(aspect, view);
      camera.fov = pose.fov;
      camera.position.set(...pose.position);
      camera.lookAt(...pose.target);
      if (scene.fog) [scene.fog.near, scene.fog.far] = pose.fog;
    } else {
      camera.position.set(distance * .12, distance * .32 + 1.3, distance * .95);
      camera.lookAt(0,1.1,0);
    }
    if (mode !== 'battle' && mode !== 'warmup' && scene.fog) [scene.fog.near, scene.fog.far] = BATTLE_FOG;
    camera.updateProjectionMatrix();
    // 타격 연출의 카메라 흔들림은 이 위치를 기준으로 잠깐 움직였다가 돌아온다.
    camera.userData.base = camera.position.clone();
    camera.userData.baseFov = camera.fov;
  }, [camera, scene, size.width, size.height, mode, view, sceneInstanceId]);
  return null;
}

function Torch({ position, light = true }) {
  const flame = useRef(null);
  useFrame(({ clock }) => { if (flame.current) flame.current.scale.setScalar(.95 + Math.sin(clock.elapsedTime * 8 + position[0]) * .07); });
  return <group position={position}>
    <mesh position={[0, -.18, 0]}><cylinderGeometry args={[.045, .045, .5, 8]} /><meshStandardMaterial color="#392a21" roughness={.9} /></mesh>
    <mesh position={[0, .04, 0]}><cylinderGeometry args={[.13, .07, .14, 8]} /><meshStandardMaterial color="#ad8954" metalness={.7} roughness={.35} /></mesh>
    <mesh ref={flame} position={[0, .22, 0]}><sphereGeometry args={[.12, 8, 6]} /><meshStandardMaterial color="#ffb451" emissive="#ff9837" emissiveIntensity={3} /></mesh>
    {light && <pointLight position={[0, .3, .25]} color="#ffc176" intensity={3.6} distance={5.5} decay={2} />}
  </group>;
}

function KitInstances({ source, items, shadows = true, lightweight = false }) {
  // R3F가 instancedMesh를 다시 만들면(개수·지오메트리 변경 등) 새 객체에 배치를 다시 써야 한다.
  // 객체 자체를 상태로 받아 effect 의존성에 넣고, 재질은 args가 아닌 prop으로만 넘긴다.
  // (Dungeon이 품질 변경 때 원본 재질을 바꿔 끼우므로 args에 넣으면 메시가 재생성되며 모든 타일이 원점에 겹친다.)
  const [mesh, setMesh] = useState(null);
  const material = useMemo(() => resolveKitMaterial(source, lightweight), [source, lightweight]);
  useLayoutEffect(() => {
    if (!mesh) return;
    items.forEach((item, i) => {
      dummy.position.set(...item.position); dummy.rotation.set(0, item.rotate, 0); dummy.scale.setScalar(KIT_SCALE * item.scale); dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [mesh, items]);
  return <instancedMesh ref={setMesh} name={`kit-${source.name}`} args={[source.geometry, undefined, items.length]} material={material} castShadow={shadows} receiveShadow={shadows} />;
}

function KitClone({ source, item, shadows = true, lightweight = false }) {
  const object = useMemo(() => {
    const copy = source.clone(true);
    const door = copy.getObjectByName('door');
    if (door) door.position.y = 0; // 창살 문은 내려서 닫힌 모습으로 둔다
    return copy;
  }, [source]);
  useLayoutEffect(() => {
    object.traverse(node => {
      if (node.isMesh) {
        node.material = resolveKitMaterial(node, lightweight);
        node.castShadow = shadows;
        node.receiveShadow = shadows;
      }
    });
  }, [object, shadows, lightweight]);
  return <primitive object={object} position={item.position} rotation={[0, item.rotate, 0]} scale={KIT_SCALE * item.scale} />;
}

// 바닥·벽·기둥·소품은 Kenney Mini Dungeon(CC0) 부품이고, 횃불·책장·화로·바닥 문양은 이 게임의 장식이다.
function Dungeon({ variant = 'hall', mode = 'battle', quality }) {
  const kit = useLoader(GLTFLoader, dungeonKitUrl());
  const lightweight = Boolean(quality?.lightweightDungeon);
  const shadows = Boolean(quality?.shadows);
  useLayoutEffect(() => {
    kit.scene.traverse(node => {
      if (node.isMesh) node.material = resolveKitMaterial(node, lightweight);
    });
  }, [kit, lightweight]);
  const groups = useMemo(() => [...groupByPiece(dungeonLayout(variant, mode))], [variant, mode]);
  const books=useMemo(()=>[-5,5].flatMap(x=>[
    {position:[x,1.25,-2.15],scale:[1.4,2.5,.35],color:'#342d24'},
    ...[.45,1.05,1.65,2.25].flatMap((y,row)=>[
      {position:[x,y-.25,-2.05],scale:[1.45,.07,.5],color:'#76604a'},
      ...Array.from({length:8},(_,i)=>({position:[x-.56+i*.16,y,-1.92],scale:[.12,.35+i%3*.05,.23],color:['#6f6545','#495f51','#805549','#627679'][(i+row)%4]})),
    ]),
  ]),[]);
  const usePointLights = quality?.pointLights !== false;
  return <group name="dungeon">
    {groups.map(([piece, items]) => {
      const source = kit.scene.getObjectByName(piece);
      if (!source) return null;
      return COMPOSITE_PIECES.includes(piece)
        ? items.map((item, i) => <KitClone key={`${piece}-${i}`} source={source} item={item} shadows={shadows} lightweight={lightweight} />)
        : <KitInstances key={piece} source={source} items={items} shadows={shadows} lightweight={lightweight} />;
    })}
    <mesh position={[0, -.3, 9]} receiveShadow={shadows}><boxGeometry args={[60, .3, 28]} /><meshStandardMaterial color="#111e19" roughness={1} /></mesh>
    <mesh position={[0, 1.15, WALL_FRONT - TILE - .02]}><planeGeometry args={[2.6, 2.3]} /><meshBasicMaterial color="#070f0d" /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .012, 0]}><ringGeometry args={[1.55, 1.57, quality?.level === 'lowest' ? 24 : 48]} /><meshStandardMaterial color="#a78e53" metalness={.5} roughness={.5} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, Math.PI / 4]} position={[0, .016, 0]}><ringGeometry args={[1.03, 1.045, 4]} /><meshStandardMaterial color="#8e8152" metalness={.5} roughness={.5} /></mesh>
    <Torch position={[-2.6, 1.8, WALL_FRONT + .45]} light={usePointLights} /><Torch position={[2.6, 1.8, WALL_FRONT + .45]} light={usePointLights} />
    {variant==='library'&&<Stones blocks={books} geometry={plainGeometry} shadows={shadows} lightweight={lightweight} />}
    {variant === 'forge' && <group position={[0, 0, WALL_FRONT + .1]}>
      <mesh position={[0, .9, 0]}><boxGeometry args={[1.65, 1.8, .3]} /><meshStandardMaterial color="#211d19" /></mesh>
      {[-.6,-.3,0,.3,.6].map(x => <mesh key={x} position={[x, .9, .19]}><boxGeometry args={[.055, 1.7, .08]} /><meshStandardMaterial color="#625542" metalness={.8} roughness={.45} /></mesh>)}
      {usePointLights && <pointLight position={[0, .6, .5]} color="#ff8436" intensity={4} distance={6} />}
      <mesh position={[0, .3, .03]}><planeGeometry args={[1.6, .6]} /><meshStandardMaterial color="#e47725" emissive="#fa7019" emissiveIntensity={2} /></mesh>
    </group>}
  </group>;
}

export function Actor({ type = 'hero', position = [0, 0, 0], rotation = 0, scale = 1, action = 'idle', control, still = false, procedural = false, outlines = true, shadows = true, weaponRef, anchorRef }) {
  const source = useLoader(GLTFLoader, modelUrl(type));
  const root = useRef(null);
  const initialOutlines = useRef(outlines);
  initialOutlines.current = outlines;
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
    const outline = stylizeActor(object, {
      outlines: initialOutlines.current,
      animations: source.animations,
      batch: type !== 'hero',
    });
    const mixer = new THREE.AnimationMixer(object);
    const actions = Object.fromEntries(source.animations.map(clip => [clip.name, mixer.clipAction(clip)]));
    const rig = procedural ? createKnightRig(object) : null;
    return { object, mixer, actions, outline, rig, head, headPoint, name: null, action: null };
  }, [source, procedural, type]);
  useLayoutEffect(() => {
    actor.object.traverse(node => {
      if (!node.isMesh) return;
      if (node.userData.outline) {
        node.castShadow = false;
        node.receiveShadow = false;
      } else {
        node.castShadow = shadows;
        node.receiveShadow = shadows;
      }
    });
  }, [actor, shadows, outlines]);
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
  useEffect(() => {
    setActorOutlines(actor.object, actor.outline, outlines);
  }, [actor, outlines]);
  useEffect(() => () => { actor.mixer.stopAllAction(); actor.outline.dispose(); actor.name = null; actor.action = null; }, [actor]);
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
    <mesh rotation={[-Math.PI / 2,0,0]} position={[0,.005,0]}><circleGeometry args={[.48,16]} /><meshBasicMaterial color="#06100b" transparent opacity={.3} depthWrite={false} /></mesh>
  </group>;
}

function Motes({ count, still }) {
  const points = useRef(null);
  const values = useMemo(() => Float32Array.from(Array.from({ length: count * 3 }, (_, i) => i % 3 === 0 ? Math.sin(i * 13.17) * 6 : i % 3 === 1 ? (i * .17) % 4 : Math.cos(i * 2.42) * 3)), [count]);
  useFrame(({ clock }) => { if (points.current && !still) points.current.rotation.y = Math.sin(clock.elapsedTime / 12) * .09; });
  return <points ref={points}><bufferGeometry><bufferAttribute attach="attributes-position" args={[values,3]} /></bufferGeometry><pointsMaterial color="#e6d39b" size={.025} transparent opacity={.5} sizeAttenuation depthWrite={false} /></points>;
}

const FIRST_PLAYBACK_STEP_MS = 16;
const MAX_PLAYBACK_STEP_MS = 100;

function BattleActors({ state, director, quality, reduced, onAnchors }) {
  const pose = useRef({});
  const sword = useRef(null);
  const ages = useRef([]);
  const foe = useRef({ position: [ENEMY_HOME, 0, 0] });
  const impact = useRef({ heroX: -2.3, enemyX: ENEMY_HOME });
  const heroAnchor = useRef(null), enemyAnchor = useRef(null);
  const projected = useRef(new THREE.Vector3());
  const footProjected = useRef(new THREE.Vector3());
  const anchors = useRef({ renderer: '3d', player: {}, enemy: {} });
  const lastActive = useRef(null);
  useFrame(({ clock }, delta) => {
    const active = director.active;
    if (!active) {
      lastActive.current = null;
    } else if (!document.hidden && !active.manual) {
      const firstFrame = lastActive.current !== active;
      lastActive.current = active;
      const stepMs = Math.min(Math.max(0, delta) * 1000, firstFrame ? FIRST_PLAYBACK_STEP_MS : MAX_PLAYBACK_STEP_MS);
      director.advance(stepMs);
    }
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
      anchor.root.updateWorldMatrix(true, false);
      const foot = footProjected.current.setFromMatrixPosition(anchor.root.matrixWorld);
      foot.y = 0;
      foot.project(camera);
      Object.assign(anchors.current[side], {
        x: (point.x + 1) / 2,
        y: (1 - point.y) / 2,
        footX: (foot.x + 1) / 2,
        footY: (1 - foot.y) / 2,
        visible: anchor.root.visible,
      });
    }
    onAnchors(anchors.current);
  });

  const shadows = Boolean(quality?.shadows);
  return <>
    <Actor type="hero" rotation={Math.PI / 2} procedural outlines={quality.outlines !== false} shadows={shadows} weaponRef={sword} anchorRef={heroAnchor} still={reduced} control={() => ({
      pose: pose.current, flash: reduced ? 0 : hitFlashAmount(director.active, 'hero'), flashColor: '#ffd2c4',
    })} />
    <Actor type={state.enemy.type} rotation={-Math.PI / 2} outlines={quality.outlines !== false} shadows={shadows} anchorRef={enemyAnchor} still={reduced} control={() => foe.current} />
    <CombatAtmosphere director={director} quality={quality} pose={pose} sword={sword} />
    <SwordTrail director={director} quality={quality} sword={sword} />
    <SkillEffects director={director} quality={quality} sword={sword} />
    <ImpactEffects director={director} pose={() => impact.current} quality={quality} reduced={reduced} />
  </>;
}

function Camp({ forge = false, light = true, shadows = true }) {
  return <group position={[1,0,.3]}>
    {forge ? <>
      <mesh position={[0,.35,0]} castShadow={shadows}><cylinderGeometry args={[.25,.33,.7,8]} /><meshStandardMaterial color="#4b3d2e" roughness={.8} /></mesh>
      <mesh position={[0,.85,0]} castShadow={shadows}><boxGeometry args={[1,.24,.43]} /><meshStandardMaterial color="#8e9690" metalness={.8} roughness={.35} /></mesh>
      <mesh position={[.53,.87,0]} rotation={[0,0,Math.PI/2]}><coneGeometry args={[.19,.45,8]} /><meshStandardMaterial color="#8e9690" metalness={.8} roughness={.35} /></mesh>
    </> : <>
      {[0,1,2].map(i => <mesh key={i} position={[0,.12,0]} rotation={[Math.PI/2,i*Math.PI/3,0]}><cylinderGeometry args={[.075,.09,.9,8]} /><meshStandardMaterial color="#5d422d" roughness={.95} /></mesh>)}
      {[0,1,2].map(i => <mesh key={i} position={[(i-1)*.15,.4,0]}><coneGeometry args={[.14,.7-i*.1,8]} /><meshStandardMaterial color="#ffbf6e" emissive="#ff8a37" emissiveIntensity={2.5} /></mesh>)}
      {light && <pointLight position={[0,.7,0]} color="#ffb469" intensity={5} distance={5} />}
    </>}
  </group>;
}


function EntranceActor({ reduced, onComplete, outlines = true, shadows = true }) {
  const elapsed = useRef(0), finished = useRef(false), started = useRef(false);
  useFrame((_, delta) => {
    if (document.hidden || finished.current) return;
    if (!started.current) { started.current = true; return; }
    elapsed.current += Math.min(Math.max(0, delta), 0.1);
    if (elapsed.current > (reduced ? .3 : 3.2)) { finished.current = true; onComplete?.(); }
  });
  return <Actor rotation={Math.PI} action={reduced ? 'idle' : 'walk'} still={reduced} outlines={outlines} shadows={shadows} control={() => ({ position: [0, 0, 1 - Math.min(1, elapsed.current / 3) * 3], scale: Math.max(.4, 1 - Math.max(0, elapsed.current - 2) * .35) })} />;
}

const WARMUP_DIRECTOR = Object.freeze({ active: null });

function WarmupVfx({ quality, reduced }) {
  const pose = useRef({ heroX: -2.3, enemyX: ENEMY_HOME });
  const sword = useRef(null);
  return <group visible={false}>
    <CombatAtmosphere director={WARMUP_DIRECTOR} quality={quality} sword={sword} />
    <SwordTrail director={WARMUP_DIRECTOR} quality={quality} sword={sword} />
    <SkillEffects director={WARMUP_DIRECTOR} quality={quality} sword={sword} />
    <ImpactEffects director={WARMUP_DIRECTOR} pose={() => pose.current} quality={quality} reduced={reduced} />
  </group>;
}

function SceneReady({ sceneInstanceId = 0, mode, qualityLevel, enemyType, callback }) {
  const { gl, scene, camera, clock, invalidate, size } = useThree();
  const sized = mode === 'warmup' || (size.width > 4 && size.height > 4);
  useEffect(() => {
    if (!sized) return undefined;
    let cancelled = false;
    // Compile all scene materials (including hidden combat VFX shaders) up front so the first attack never stalls.
    const ready = async () => {
      try {
        if (typeof gl.compileAsync === 'function') await gl.compileAsync(scene, camera);
        else gl.compile(scene, camera);
      } catch {
        /* Best-effort shader warmup */
      }
      if (cancelled) return;
      clock.getDelta();
      invalidate();
      callback?.(sceneInstanceId);
    };
    ready();
    return () => { cancelled = true; };
  }, [gl, scene, camera, clock, invalidate, callback, sceneInstanceId, mode, qualityLevel, enemyType, sized]);
  return null;
}

function RewardTreasureAura({ quality, reduced }) {
  const light = useRef(null);
  const points = useRef(null);
  const count = quality.level === 'lowest' ? 0 : quality.level === 'low' ? 8 : 14;
  const seeds = useMemo(() => Array.from({ length: count }, (_, i) => ({
    angle: (i / Math.max(1, count)) * Math.PI * 2 + (i % 3) * .35,
    radius: .14 + (i % 4) * .11,
    speed: .32 + (i % 5) * .06,
    phase: (i * .37) % 1,
  })), [count]);
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    seeds.forEach((s, i) => {
      arr[i * 3] = 1.2 + Math.cos(s.angle) * s.radius;
      arr[i * 3 + 1] = .25 + s.phase * 1.15;
      arr[i * 3 + 2] = Math.sin(s.angle) * s.radius;
    });
    return arr;
  }, [count, seeds]);
  useFrame(({ clock }) => {
    if (reduced || document.hidden) return;
    const t = clock.elapsedTime;
    if (light.current) light.current.intensity = 2.05 + Math.sin(t * 2.4) * .35;
    if (points.current && count > 0) {
      const attr = points.current.geometry.attributes.position;
      const arr = attr.array;
      for (let i = 0; i < count; i++) {
        const s = seeds[i];
        const p = (s.phase + t * s.speed) % 1;
        const drift = s.angle + t * .45;
        arr[i * 3] = 1.2 + Math.cos(drift) * (s.radius * (1 + p * .45));
        arr[i * 3 + 1] = .22 + p * 1.2;
        arr[i * 3 + 2] = Math.sin(drift) * (s.radius * (1 + p * .45));
      }
      attr.needsUpdate = true;
    }
  });
  return <>
    {quality.pointLights !== false && <pointLight ref={light} position={[1.2, 1.1, .3]} color="#ffdc8c" intensity={2.1} distance={3.4} />}
    {count > 0 && <points ref={points}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
      <pointsMaterial color="#ffe08f" size={.055} transparent opacity={.72} sizeAttenuation depthWrite={false} />
    </points>}
  </>;
}

export default function World({ mode='battle', sceneInstanceId=0, state, playback, quality, reduced=false, routeMap, routeFocus, routeDestination, onComplete, won=true, onSceneReady, heroAction='idle', onAnchors, cameraView, studying=false, danger=false }) {
  const variant=mode==='forge'||['ember','scarab','ravager','boss'].includes(state?.enemy.type)?'forge':['bat','wisp','watcher','mushroom'].includes(state?.enemy.type)?'library':'hall';
  const motesCount = quality.motes ?? quality.particles;
  const shadows = Boolean(quality?.shadows);
  const outlines = quality.outlines !== false;
  // 첫 경로 지도에서 기다리지 않도록 3D 무대가 뜨면 방 모델을 미리 받아 둔다.
  useEffect(() => { useLoader.preload(GLTFLoader, mapTokensUrl()); }, []);
  return <>
    <color attach="background" args={[DUSK.background]} />
    <fog attach="fog" args={[DUSK.background,...BATTLE_FOG]} />
    <CameraFit mode={mode} view={cameraView} sceneInstanceId={sceneInstanceId} /><EnvironmentLight quality={quality} />
    {mode==='battle'&&<BattleCamera key={`camera-${sceneInstanceId}`} director={playback} view={cameraView} studying={studying} danger={danger} reduced={reduced} snapStudy={quality.studyFps === 0} />}
    <Suspense fallback={null}>
      {mode!=='map'&&<Dungeon variant={mode==='warmup'?'hall':variant} mode={mode==='warmup'?'battle':mode} quality={quality} />}
      {/* 경로 보드도 같은 Suspense 안에 두어, 방 모델이 다 읽힌 뒤에만 장면 준비 완료를 알린다. */}
      {mode==='map'&&routeMap&&<RouteTower routeMap={routeMap} focus={routeFocus} destination={routeDestination} onAnchors={onAnchors} quality={quality}>
        <Actor action={routeDestination?'walk':'idle'} still={reduced} outlines={outlines} shadows={shadows} />
      </RouteTower>}
      {mode==='warmup'?<>
        <Actor type="hero" position={[.9,0,.9]} rotation={-.38} procedural outlines={outlines} shadows={shadows} still />
        <WarmupVfx quality={quality} reduced={reduced} />
      </>
        :mode==='battle'?<BattleActors key={`actors-${sceneInstanceId}`} state={state} director={playback} quality={quality} reduced={reduced} onAnchors={onAnchors} />
          :mode==='entry'?<EntranceActor key={`entry-${sceneInstanceId}`} reduced={reduced} onComplete={onComplete} outlines={outlines} shadows={shadows} />
            :mode==='map'?null:mode==='title'?<Actor position={[.9,0,.9]} rotation={-.38} action={heroAction} still={reduced} outlines={outlines} shadows={shadows} />
              :<Actor position={[-1.3,0,0]} rotation={Math.PI/3} action={mode==='reward'?'victory':mode==='result'?won?'victory':'death':'idle'} still={reduced} outlines={outlines} shadows={shadows} />}
      <SceneReady key={`ready-${sceneInstanceId}`} sceneInstanceId={sceneInstanceId} mode={mode} qualityLevel={quality.level} enemyType={state?.enemy?.type} callback={onSceneReady} />
    </Suspense>
    {['rest','forge'].includes(mode)&&<Camp forge={mode==='forge'} light={quality.pointLights !== false} shadows={shadows} />}
    {mode==='reward'&&<RewardTreasureAura quality={quality} reduced={reduced} />}
    {mode!=='warmup'&&motesCount > 0 && <Motes count={motesCount} still={reduced} />}
  </>;
}
