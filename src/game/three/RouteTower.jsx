import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { publicAsset } from '../../publicAsset.js';

// 던전 경로를 "탑 단면"으로 보여 주는 3D 장면. 맨 아래 입구에서 보스가 있는 꼭대기까지 층이 쌓이고,
// 카메라는 지금 층과 바로 위층(고를 곳)을 크게 비춘다. 지금 방에서 이어진 방으로만 계단·사다리가 밝게 놓인다.
// 방·계단·기둥·횃대 미니어처는 Blender로 만든 public/models/map-tokens.glb(scripts/create_map_tokens.py).
// 선택·키보드·스크린리더는 DOM(RouteMap)이 맡고, 여기서는 각 방의 화면 위치를 onAnchors로 알려 준다.

export const mapTokensUrl = () => publicAsset('models/map-tokens.glb');

export const LANE_X = 2.3;
export const FLOOR_H = 1.7;
const HALF_W = 3.6;
const WALL_Z = -1.2;
const STAIR_Z = .55;
const STEPS = 7;
export const CLIMB_MS = 640;
const FOV = 32;

const STAIR_TONES = { next: '#ffcf8a', focused: '#fff1cc', muted: '#7a6450', traveled: '#a8875a' };
const LADDER_OFFSET = .78;
const DIM = new THREE.Color('#3a3346');
const INLAY = { battle: '#6a2a2c', elite: '#46336b', treasure: '#6b5420', rest: '#245241', forge: '#2f4058', boss: '#6e1f2a' };
const dimCache = new WeakMap();
const inlayCache = new Map();

/** 지나온·닫힌·멀리 있는 방은 같은 재질을 어둡게 한 복사본을 함께 쓴다(방마다 새로 만들지 않음). */
function dimmed(material) {
  let copy = dimCache.get(material);
  if (!copy) {
    copy = material.clone();
    copy.color?.lerp(DIM, .62);
    if (copy.emissive) copy.emissiveIntensity = (copy.emissiveIntensity ?? 1) * .15;
    dimCache.set(material, copy);
  }
  return copy;
}

/** 멀리서도 방 종류가 읽히도록 받침 타일 안쪽을 방 색으로 물들인다(경로 범례와 같은 색 계열). */
function inlayMaterial(type, base) {
  let material = inlayCache.get(type);
  if (!material) {
    material = base.clone();
    material.color.set(INLAY[type] ?? '#2a2233');
    material.emissive?.set(INLAY[type] ?? '#000000');
    material.emissiveIntensity = .35;
    inlayCache.set(type, material);
  }
  return material;
}

/** 층 바닥 높이. 입구(-1층)가 0, 보스(7층)가 맨 위. */
export const floorY = (floor) => (floor + 1) * FLOOR_H;

/** 방의 3D 위치(타일 중심, 바닥 높이). */
export function towerPosition(node, target = new THREE.Vector3()) {
  return target.set((node.lane - 1) * LANE_X, floorY(node.floor), 0);
}

function useClone(source) {
  return useMemo(() => source.clone(true), [source]);
}

function Tile({ source, type, dim }) {
  const object = useClone(source);
  useLayoutEffect(() => {
    object.traverse((node) => {
      if (!node.isMesh) return;
      if (!node.userData.material) node.userData.material = node.material;
      const base = node.userData.material.name === 'stone-dark' ? inlayMaterial(type, node.userData.material) : node.userData.material;
      node.material = dim ? dimmed(base) : base;
    });
  }, [object, dim, type]);
  return <primitive object={object} />;
}

function Token({ source, dim, reachable, focused, boss }) {
  const group = useRef(null);
  const object = useClone(source);
  useLayoutEffect(() => {
    object.traverse((node) => {
      if (!node.isMesh) return;
      if (!node.userData.material) node.userData.material = node.material;
      node.material = dim ? dimmed(node.userData.material) : node.userData.material;
    });
  }, [object, dim]);
  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.elapsedTime;
    group.current.position.y = .15 + (reachable ? .1 + Math.sin(t * 3.2 + object.id) * .05 : 0);
    const target = (boss ? 1.6 : 1.3) * (focused ? 1.18 : 1);
    group.current.scale.setScalar(THREE.MathUtils.lerp(group.current.scale.x || target, target, .25));
    group.current.rotation.y = reachable ? Math.sin(t * 1.6 + object.id) * .2 : 0;
  });
  return <group ref={group} position={[0, .15, 0]}><primitive object={object} /></group>;
}

function Ring({ focused }) {
  const ref = useRef(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.material.opacity = (focused ? .9 : .55) + Math.sin(clock.elapsedTime * 4) * .12;
    ref.current.scale.setScalar(focused ? 1.12 : 1);
  });
  return <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, .012, 0]} renderOrder={2}>
    <ringGeometry args={[.56, .68, 32]} />
    <meshBasicMaterial color="#ffb25e" transparent opacity={.6} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
  </mesh>;
}

/**
 * 층을 잇는 길: 옆 칸으로 가는 길은 계단, 바로 위로 가는 길은 사다리.
 * 헷갈리지 않도록 "지금 고를 수 있는 길"과 "지나온 길"만 놓는다(그 앞의 길은 오른쪽 전체 경로 미니맵이 보여 준다).
 * 한 길에 마우스·초점을 두면 그 길만 밝아지고, 방을 고르면 고른 길만 남는다.
 */
function Passages({ stairParts, edges, focus, destination }) {
  const [stone, setStone] = useState(null);
  const [trim, setTrim] = useState(null);
  const plan = useMemo(() => {
    const steps = [], rails = [], a = new THREE.Vector3(), b = new THREE.Vector3();
    const chosen = destination?.id ?? null;
    const focused = chosen ?? focus;
    for (const edge of edges) {
      const option = edge.status === 'next' && (!chosen || edge.to.id === chosen);
      if (edge.status !== 'traveled' && !option) continue;
      const tone = edge.status === 'traveled' ? 'traveled'
        : edge.to.id === focused ? 'focused'
          : focused && edges.some((other) => other.status === 'next' && other.to.id === focused) ? 'muted' : 'next';
      const color = STAIR_TONES[tone];
      towerPosition(edge.from, a);
      towerPosition(edge.to, b);
      if (Math.abs(b.x - a.x) < .1) {
        // 사다리: 방 오른쪽에 세운다(기사는 방 왼쪽에 서 있어 겹치지 않는다).
        rails.push({ x: a.x + LADDER_OFFSET, y0: a.y, color });
        continue;
      }
      const dir = Math.sign(b.x - a.x);
      const x0 = a.x + dir * .55, x1 = b.x - dir * .55;
      for (let i = 0; i < STEPS; i++) {
        const t = (i + .5) / STEPS;
        steps.push({ x: x0 + (x1 - x0) * t, y: a.y + (b.y - a.y) * t - .1, color });
      }
    }
    return { steps, rails };
  }, [edges, focus, destination]);
  useLayoutEffect(() => {
    const dummy = new THREE.Object3D(), color = new THREE.Color();
    for (const mesh of [stone, trim]) {
      if (!mesh) continue;
      plan.steps.forEach((step, i) => {
        dummy.position.set(step.x, step.y, STAIR_Z);
        dummy.rotation.set(0, Math.PI / 2, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        if (mesh === stone) mesh.setColorAt(i, color.set(step.color));
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [stone, trim, plan]);
  const count = plan.steps.length;
  return <group name="route-passages">
    {count > 0 && <>
      <instancedMesh key={`s${count}`} ref={setStone} args={[stairParts.stone, undefined, count]}>
        <meshStandardMaterial roughness={.85} />
      </instancedMesh>
      <instancedMesh key={`t${count}`} ref={setTrim} args={[stairParts.trim, stairParts.trimMaterial, count]} />
    </>}
    {plan.rails.map((rail, i) => <group key={i} position={[rail.x, rail.y0, STAIR_Z - .1]}>
      {[-.22, .22].map((dx) => <mesh key={dx} position={[dx, FLOOR_H / 2, 0]}><boxGeometry args={[.07, FLOOR_H, .07]} /><meshStandardMaterial color={rail.color} roughness={.7} /></mesh>)}
      {Array.from({ length: 6 }, (_, r) => <mesh key={r} position={[0, .2 + r * .27, 0]}><boxGeometry args={[.44, .05, .06]} /><meshStandardMaterial color={rail.color} roughness={.7} /></mesh>)}
    </group>)}
  </group>;
}

/** 한 층의 껍데기: 바닥판·뒷벽·바깥 기둥·문(방 뒤)·횃대. 가까운 층만 불을 밝힌다. */
function Floor({ floor, lanes, parts, lit, far, usePointLights, boss }) {
  const y = floorY(floor);
  const wallColor = boss ? '#3b1f2a' : far ? '#1f1926' : floor % 2 ? '#342a3f' : '#2f2639';
  const doors = useMemo(() => lanes.map(() => parts.door.clone(true)), [lanes, parts]);
  const pillars = useMemo(() => [parts.pillar.clone(true), parts.pillar.clone(true)], [parts]);
  const sconces = useMemo(() => [parts.sconce.clone(true), parts.sconce.clone(true)], [parts]);
  return <group name={`tower-floor-${floor}`}>
    <mesh position={[0, y - .12, -.15]} receiveShadow><boxGeometry args={[HALF_W * 2 + .3, .24, 2.15]} /><meshStandardMaterial color={far ? '#1b1520' : '#2a2231'} roughness={.95} /></mesh>
    <mesh position={[0, y - .06, .94]}><boxGeometry args={[HALF_W * 2 + .3, .1, .06]} /><meshStandardMaterial color="#8a6a3c" metalness={.6} roughness={.45} /></mesh>
    <mesh position={[0, y + FLOOR_H / 2, WALL_Z]}><boxGeometry args={[HALF_W * 2, FLOOR_H, .2]} /><meshStandardMaterial color={wallColor} roughness={.95} /></mesh>
    {lanes.map((lane, i) => <group key={lane} position={[(lane - 1) * LANE_X, y, WALL_Z + .2]} scale={1.15}>
      <primitive object={doors[i]} />
    </group>)}
    {[-1, 1].map((side, i) => <group key={side} position={[side * HALF_W, y, -.75]} scale={[1, FLOOR_H / 1.6, 1]}>
      <primitive object={pillars[i]} />
    </group>)}
    {lit && [-1, 1].map((side, i) => <group key={side} position={[side * LANE_X / 2, y + 1.15, WALL_Z + .12]}>
      <primitive object={sconces[i]} />
      {usePointLights && <pointLight position={[0, .3, .35]} color="#ffb06a" intensity={2.6} distance={4.2} decay={2} />}
    </group>)}
  </group>;
}

export default function RouteTower({ routeMap, focus, destination, onAnchors, quality, children }) {
  const gltf = useLoader(GLTFLoader, mapTokensUrl());
  const { camera, size, scene, invalidate } = useThree();
  const parts = useMemo(() => {
    const get = (name) => gltf.scene.getObjectByName(name);
    const stair = get('map-stair');
    const meshes = [];
    stair?.traverse((node) => { if (node.isMesh) meshes.push(node); });
    const stoneMesh = meshes.find((m) => m.material?.name !== 'brass') ?? meshes[0];
    const trimMesh = meshes.find((m) => m.material?.name === 'brass') ?? meshes[0];
    return {
      tile: get('map-tile'), door: get('map-entrance'), pillar: get('map-pillar'), sconce: get('map-sconce'),
      stair: { stone: stoneMesh.geometry, trim: trimMesh.geometry, trimMaterial: trimMesh.material },
      tokens: Object.fromEntries(['battle', 'elite', 'treasure', 'rest', 'forge', 'boss'].map((type) => [type, get(`token-${type}`)])),
    };
  }, [gltf]);
  const gate = useClone(parts.door);
  const nodes = routeMap.nodes;
  const here = routeMap.here;
  const current = here.floor;
  const focusFloor = destination ? destination.floor : current;
  const floors = useMemo(() => {
    const byFloor = new Map();
    for (const node of nodes) byFloor.set(node.floor, [...(byFloor.get(node.floor) ?? []), node.lane]);
    return [...byFloor.entries()].sort((a, b) => a[0] - b[0]);
  }, [nodes]);
  const topFloor = floors.length ? floors[floors.length - 1][0] : 7;

  // 카메라: 지금 층과 바로 위층(고를 곳)을 크게 비춘다. 방을 고르면 한 층 위로 부드럽게 따라 올라간다.
  const view = useRef({ target: new THREE.Vector3(), position: new THREE.Vector3(), ready: false });
  const aim = useMemo(() => {
    const aspect = size.width / Math.max(1, size.height);
    const tanV = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    // 세 방 열(좌우 끝 방 + 여유)만 가로로 맞추고, 세로는 지금 층과 다음 층 두 칸이 꽉 차게 한다.
    const halfV = FLOOR_H * 1.2, halfH = LANE_X + .85;
    const distance = Math.max(halfV / tanV, halfH / (tanV * aspect)) + .6;
    const target = new THREE.Vector3(0, floorY(focusFloor) + FLOOR_H * .78, 0);
    return { target, position: target.clone().add(new THREE.Vector3(0, distance * .2, distance)), distance };
  }, [size.width, size.height, focusFloor]);
  useLayoutEffect(() => {
    camera.fov = FOV;
    camera.updateProjectionMatrix();
    if (!view.current.ready) {
      view.current.target.copy(aim.target);
      view.current.position.copy(aim.position);
      view.current.ready = true;
    }
    if (scene.fog) { scene.fog.near = aim.distance * 1.05; scene.fog.far = aim.distance * 2.6; }
    invalidate();
  }, [aim, camera, scene, invalidate]);

  // 기사: 지금 방에 서 있다가, 방을 고르면 계단(옆 칸)이나 사다리(바로 위)로 올라간다.
  const hero = useRef(null);
  const climb = useRef({ from: new THREE.Vector3(), to: new THREE.Vector3(), start: 0, active: false, ladder: false, ladderX: 0 });
  useLayoutEffect(() => {
    // 기사는 방 왼쪽에 선다(사다리는 오른쪽).
    const spot = towerPosition(here).add(new THREE.Vector3(-.52, .16, .38));
    if (!destination) {
      climb.current.active = false;
      hero.current?.position.copy(spot);
      return;
    }
    const to = towerPosition(destination).add(new THREE.Vector3(0, .16, .38));
    climb.current.from.copy(hero.current?.position ?? spot);
    climb.current.to.copy(to);
    climb.current.ladder = Math.abs(to.x - towerPosition(here).x) < .1;
    climb.current.ladderX = towerPosition(here).x + LADDER_OFFSET;
    climb.current.start = performance.now();
    climb.current.active = true;
    invalidate();
  }, [here, destination, invalidate]);

  const anchors = useRef(null);
  const scratch = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), p: new THREE.Vector3() }), []);
  useFrame(({ camera: cam }) => {
    // 카메라 따라가기(지수 감쇠)
    const v = view.current;
    v.target.lerp(aim.target, .12);
    v.position.lerp(aim.position, .12);
    cam.position.copy(v.position);
    cam.lookAt(v.target);
    if (v.target.distanceToSquared(aim.target) > 1e-4) invalidate();

    const c = climb.current;
    if (c.active && hero.current) {
      const t = Math.min(1, (performance.now() - c.start) / CLIMB_MS);
      const eased = t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      if (c.ladder) {
        // 사다리: 옆으로 붙고(0~25%) → 곧게 오르고(25~85%) → 방 가운데로 들어간다(85~100%).
        const ladderX = c.ladderX;
        const p = hero.current.position;
        if (t < .25) p.set(THREE.MathUtils.lerp(c.from.x, ladderX, t / .25), c.from.y, c.from.z);
        else if (t < .85) p.set(ladderX, THREE.MathUtils.lerp(c.from.y, c.to.y, (t - .25) / .6), c.from.z);
        else p.set(THREE.MathUtils.lerp(ladderX, c.to.x, (t - .85) / .15), c.to.y, c.from.z);
      } else {
        hero.current.position.lerpVectors(c.from, c.to, eased);
        hero.current.position.y += Math.abs(Math.sin(eased * Math.PI * STEPS)) * .06;
      }
      hero.current.position.z = c.from.z;
      if (t >= 1) c.active = false;
      invalidate();
    }

    if (!onAnchors) return;
    const project = (point, radius = .55) => {
      scratch.a.copy(point).project(cam);
      scratch.b.copy(point);
      scratch.b.x += radius;
      scratch.b.project(cam);
      return { x: (scratch.a.x + 1) / 2, y: (1 - scratch.a.y) / 2, r: Math.abs(scratch.b.x - scratch.a.x) / 2 };
    };
    const point = scratch.p;
    const next = {
      nodes: {}, floors: [], horizontal: false,
      entrance: project(point.set(0, floorY(-1) + .9, 0)),
    };
    for (const node of nodes) next.nodes[node.id] = project(towerPosition(node, point).setY(point.y + .35));
    for (let floor = 0; floor < routeMap.floors; floor++) next.floors.push(project(point.set(-LANE_X - .55, floorY(floor) + .32, .5), 0));
    const prev = anchors.current;
    const differs = (a, b) => !a || !b || Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.r - b.r) > .0015;
    const moved = !prev || differs(prev.entrance, next.entrance) || nodes.some((node) => differs(prev.nodes[node.id], next.nodes[node.id]))
      || next.floors.some((floor, i) => differs(prev.floors[i], floor));
    if (moved) { anchors.current = next; onAnchors(next); }
  });

  const usePointLights = quality?.pointLights !== false;
  const reachable = new Set(nodes.filter((node) => node.status === 'reachable').map((node) => node.id));
  const boss = nodes.find((node) => node.type === 'boss');
  return <group name="route-tower">
    {/* 바깥 땅과 탑 외벽 */}
    <mesh position={[0, -.5, 0]}><boxGeometry args={[60, .8, 30]} /><meshStandardMaterial color="#120d17" roughness={1} /></mesh>
    {[-1, 1].map((side) => <mesh key={side} position={[side * (HALF_W + .32), floorY(topFloor + 1) / 2 - .1, -.3]}>
      <boxGeometry args={[.38, floorY(topFloor + 1) + .2, 2.2]} /><meshStandardMaterial color="#3d3347" roughness={.9} />
    </mesh>)}
    <mesh position={[0, floorY(topFloor + 1) + .1, -.3]}><boxGeometry args={[HALF_W * 2 + 1.1, .3, 2.4]} /><meshStandardMaterial color="#4a3e55" roughness={.9} /></mesh>
    {Array.from({ length: 7 }, (_, i) => <mesh key={i} position={[-HALF_W + i * (HALF_W / 3), floorY(topFloor + 1) + .45, .55]}>
      <boxGeometry args={[.45, .4, .4]} /><meshStandardMaterial color="#4a3e55" roughness={.9} />
    </mesh>)}
    {/* 입구 층 */}
    <mesh position={[0, -.06, -.15]}><boxGeometry args={[HALF_W * 2 + .3, .12, 2.15]} /><meshStandardMaterial color="#2a2231" roughness={.95} /></mesh>
    <mesh position={[0, FLOOR_H / 2, WALL_Z]}><boxGeometry args={[HALF_W * 2, FLOOR_H, .2]} /><meshStandardMaterial color="#2f2639" roughness={.95} /></mesh>
    <group position={[0, 0, WALL_Z + .25]} scale={1.7}><primitive object={gate} /></group>
    {floors.map(([floor, lanes]) => <Floor key={floor} floor={floor} lanes={lanes} parts={parts} usePointLights={usePointLights}
      lit={floor >= current && floor <= current + 1} far={floor > Math.max(current, focusFloor) + 2} boss={floor === topFloor} />)}
    <Passages stairParts={parts.stair} edges={routeMap.edges} focus={focus} destination={destination} />
    {nodes.map((node) => {
      const canPick = reachable.has(node.id) && !destination;
      const chosen = destination?.id === node.id;
      const far = node.floor > Math.max(current, focusFloor) + 2 && node.type !== 'boss';
      const dim = far || ['visited', 'missed', 'closed', 'current'].includes(node.status);
      return <group key={node.id} position={towerPosition(node).toArray()}>
        <Tile source={parts.tile} type={node.type} dim={dim && !canPick} />
        {(canPick || chosen) && <Ring focused={focus === node.id} />}
        <Token source={parts.tokens[node.type]} dim={dim && !canPick && !chosen} reachable={canPick} focused={focus === node.id && (canPick || chosen)} boss={node.type === 'boss'} />
      </group>;
    })}
    {usePointLights && boss && <pointLight position={towerPosition(boss).add(new THREE.Vector3(0, 1.1, .8)).toArray()} color="#ff5a5a" intensity={2.4} distance={4} decay={2} />}
    <group ref={hero} scale={.36}>{children}</group>
  </group>;
}
