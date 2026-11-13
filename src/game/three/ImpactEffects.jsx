import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { CARD_MOTIONS } from '../cardMotions.js';
import { IMPACT_POWER, impactAges } from './playback.js';

// 타격감 연출: 초승달 모양 베기 궤적, 별빛 번쩍임, 충격파 고리, 튀는 불꽃, 바닥 먼지, 카메라 흔들림.
// 모두 가산 혼합(additive)이라 어두운 던전 위에서 빛처럼 보인다. 게임 상태는 바꾸지 않는다.

const MELEE = ['strike', 'heavy', 'twin'];
const SLOTS = 2; // 쌍월처럼 타격이 겹칠 때를 위한 연출 칸
const additive = { transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, toneMapped: false };
const clamp01 = value => Math.max(0, Math.min(1, value));
const easeOut = t => 1 - (1 - clamp01(t)) ** 3;

// 호를 따라 along(0~1), 안쪽→바깥쪽으로 across(0~1)를 갖는 띠. 셰이더가 초승달 모양으로 깎는다.
function crescentGeometry(inner = .62, outer = 1.12, arc = Math.PI * .95, segments = 48) {
  const positions = [], uvs = [], index = [];
  for (let i = 0; i <= segments; i++) {
    const along = i / segments, angle = arc / 2 - along * arc;
    for (const [across, radius] of [[0, inner], [1, outer]]) {
      positions.push(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
      uvs.push(along, across);
    }
    if (i < segments) { const a = i * 2; index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  return new THREE.BufferGeometry().setIndex(index)
    .setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    .setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
}

const vertexShader = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const slashMaterial = () => new THREE.ShaderMaterial({ ...additive, side: THREE.DoubleSide,
  uniforms: { color: { value: new THREE.Color() }, sweep: { value: 0 }, fade: { value: 0 } },
  vertexShader,
  fragmentShader: `
    uniform vec3 color; uniform float sweep; uniform float fade; varying vec2 vUv;
    void main(){
      float along = vUv.x, across = vUv.y;
      if (along > sweep) discard;
      float width = .12 + .88 * pow(sin(3.14159 * along), .8);
      float body = smoothstep(1.0 - width, 1.0 - width + .4 * width, across) * (1.0 - smoothstep(.9, 1.0, across));
      float edge = smoothstep(.72, .94, across) * (1.0 - smoothstep(.94, 1.0, across));
      float tail = smoothstep(sweep - 1.1, sweep, along);
      vec3 tone = mix(color, vec3(1.0), edge * .85);
      gl_FragColor = vec4(tone * (body * .75 + edge * 1.2), 1.0) * tail * fade;
    }`,
});

const flashMaterial = () => new THREE.ShaderMaterial({ ...additive,
  uniforms: { color: { value: new THREE.Color() }, fade: { value: 0 } },
  vertexShader,
  fragmentShader: `
    uniform vec3 color; uniform float fade; varying vec2 vUv;
    void main(){
      vec2 p = (vUv - .5) * 2.0; float r = length(p);
      float glow = exp(-r * r * 5.0) * .7;
      float star = max(exp(-abs(p.x) * 28.0) * exp(-abs(p.y) * 2.6), exp(-abs(p.y) * 28.0) * exp(-abs(p.x) * 2.6));
      float core = exp(-r * r * 60.0);
      vec3 tone = mix(color, vec3(1.0), clamp(core + star * .6, 0.0, 1.0));
      gl_FragColor = vec4(tone * (glow + star + core), 1.0) * fade;
    }`,
});

const ringMaterial = () => new THREE.ShaderMaterial({ ...additive, side: THREE.DoubleSide,
  uniforms: { color: { value: new THREE.Color() }, fade: { value: 0 }, thickness: { value: .12 } },
  vertexShader,
  fragmentShader: `
    uniform vec3 color; uniform float fade; uniform float thickness; varying vec2 vUv;
    void main(){
      float r = length((vUv - .5) * 2.0);
      float band = smoothstep(1.0 - thickness, 1.0 - thickness * .4, r) * (1.0 - smoothstep(.97, 1.0, r));
      gl_FragColor = vec4(mix(color, vec3(1.0), band * .4) * band, 1.0) * fade;
    }`,
});

const sparkMaterial = () => new THREE.ShaderMaterial({ ...additive,
  uniforms: { color: { value: new THREE.Color() }, fade: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform vec3 color; uniform float fade; varying vec2 vUv;
    void main(){
      float head = smoothstep(0.0, 1.0, vUv.x);
      float thin = 1.0 - abs(vUv.y - .5) * 2.0;
      gl_FragColor = vec4(mix(color, vec3(1.0), head * .8) * head * thin * 1.6, 1.0) * fade;
    }`,
});

const dummy = new THREE.Object3D();
const shakeOffset = new THREE.Vector3();
const random = seed => { const x = Math.sin(seed * 127.1) * 43758.5453; return x - Math.floor(x); };

function ImpactSlot({ slotRef, sparks }) {
  const crescent = useMemo(() => crescentGeometry(), []);
  const plane = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const materials = useMemo(() => ({ slash: slashMaterial(), flash: flashMaterial(), ring: ringMaterial(), dust: ringMaterial(), spark: sparkMaterial() }), []);
  useEffect(() => () => { crescent.dispose(); plane.dispose(); Object.values(materials).forEach(material => material.dispose()); }, [crescent, plane, materials]);
  return <group ref={slotRef} visible={false}>
    <group name="facing">
      <mesh name="slash" geometry={crescent} material={materials.slash} renderOrder={20} />
      <mesh name="ring" geometry={plane} material={materials.ring} renderOrder={21} />
      <instancedMesh name="sparks" args={[plane, materials.spark, sparks]} renderOrder={22} frustumCulled={false} />
      <mesh name="flash" geometry={plane} material={materials.flash} renderOrder={23} />
    </group>
    <mesh name="dust" geometry={plane} material={materials.dust} rotation={[-Math.PI / 2, 0, 0]} renderOrder={19} />
  </group>;
}

export default function ImpactEffects({ director, pose, quality, reduced }) {
  const { camera, invalidate } = useThree();
  const first = useRef(null), second = useRef(null);
  const slots = [first, second]; // SLOTS개
  const sparks = Math.max(12, Math.round(quality.particles * .9));
  const shaken = useRef(false);
  const color = useMemo(() => new THREE.Color(), []);
  useFrame(() => {
    const current = director.active;
    const ages = impactAges(current);
    const enemyHit = !!current?.enemy;
    const type = current?.effect.cardType;
    const playerAttack = current && !enemyHit && current.effect.kind === 'attack';
    const power = enemyHit ? (current.plan.style === 'slam' ? 1.2 : .7) : (IMPACT_POWER[type] ?? 1) * (current?.effect.upgraded ? 1.2 : 1);
    if (current) color.set(enemyHit ? current.plan.color : CARD_MOTIONS[type]?.color ?? 0xffe5a5);
    let shake = 0;
    slots.forEach((slot, slotIndex) => {
      const group = slot.current;
      if (!group) return;
      // 이 칸이 맡은 가장 최근 타격
      let age = -1, hitIndex = -1;
      ages.forEach((value, index) => { if (index % SLOTS === slotIndex && value >= 0) { age = value; hitIndex = index; } });
      const live = !reduced && (playerAttack || enemyHit) && age >= 0 && age < 620;
      group.visible = live;
      if (!live) return;
      shake = Math.max(shake, (1 - age / 320) ** 2 * power);
      const p = pose();
      const targetX = enemyHit ? p.heroX + .25 : p.enemyX - .3;
      const height = type === 'heavy' ? 1.05 : .95;
      group.position.set(targetX, 0, .45);
      const facing = group.getObjectByName('facing');
      facing.position.set(0, height, 0);
      facing.quaternion.copy(camera.quaternion);
      const direction = enemyHit ? -1 : 1;
      const melee = enemyHit ? ['claw', 'blade', 'slam', 'ram', 'dive'].includes(current.plan.style) : MELEE.includes(type);

      // 1) 베기 궤적: 타격 순간부터 100ms 동안 위에서 아래로 그어지고, 곧 사라진다.
      const slash = facing.getObjectByName('slash');
      const swing = clamp01(age / 100), out = clamp01((age - 110) / 260);
      slash.visible = melee;
      if (melee) {
        // 호의 한가운데가 타격 지점을 지나도록 호의 중심을 반대쪽으로 옮긴다. 위에서 아래로 그어진다.
        const mirrored = enemyHit || (type === 'twin' && hitIndex % 2 === 1);
        const angle = type === 'heavy' ? -.15 : -.75, sign = mirrored ? -1 : 1;
        const size = (type === 'heavy' ? 1.25 : .95) * (1 + out * .1) * (enemyHit ? .75 : 1) * (current.effect.upgraded ? 1.15 : 1);
        const reach = .87 * size;
        slash.rotation.set(0, 0, angle);
        slash.scale.set(size * sign, size, 1);
        slash.position.set((.22 - Math.cos(angle) * reach) * sign, .18 - Math.sin(angle) * reach, 0);
        const m = slash.material.uniforms;
        m.color.value.copy(color); m.sweep.value = easeOut(swing) * 1.05; m.fade.value = 1 - out;
      }

      // 2) 별빛 번쩍임: 한 프레임 안에 크게 터졌다가 빠르게 줄어든다.
      const flash = facing.getObjectByName('flash');
      const flashT = clamp01(age / 200);
      flash.scale.setScalar((.45 + 1.05 * power ** .5) * (age < 40 ? .6 + age / 100 : 1 - flashT * .5));
      flash.rotation.z = hitIndex * .7 + .3;
      flash.material.uniforms.color.value.copy(color);
      flash.material.uniforms.fade.value = (1 - flashT) ** 1.5;

      // 3) 충격파 고리
      const ring = facing.getObjectByName('ring'), ringT = clamp01(age / 300);
      ring.scale.setScalar(.3 + easeOut(ringT) * 1.7 * power ** .5);
      ring.material.uniforms.color.value.copy(color);
      ring.material.uniforms.thickness.value = .25 * (1 - ringT) + .04;
      ring.material.uniforms.fade.value = (1 - ringT) ** 1.2;

      // 4) 불꽃: 맞은 반대쪽으로 부채꼴로 튀고 중력에 떨어진다.
      const sparkMesh = facing.getObjectByName('sparks'), sparkT = age / 1000;
      sparkMesh.material.uniforms.color.value.copy(color);
      sparkMesh.material.uniforms.fade.value = 1 - clamp01(age / 480);
      for (let i = 0; i < sparks; i++) {
        const seed = i + hitIndex * 31 + (current.effect.id ?? 0) * 7;
        const spread = (random(seed) - .5) * 2.4 + (random(seed + 3) < .2 ? Math.PI : 0);
        const speed = (2.6 + random(seed + 1) * 4.2) * (.8 + power * .25);
        const vx = Math.cos(spread) * speed * direction, vy = Math.sin(spread) * speed + 1.2;
        const drag = 1 - Math.min(.6, sparkT * 1.2);
        const x = vx * sparkT * drag, y = vy * sparkT * drag - 4.5 * sparkT * sparkT;
        const length = Math.max(0, (.18 + speed * .045) * (1 - clamp01(age / 420)));
        dummy.position.set(x, y, 0);
        dummy.rotation.set(0, 0, Math.atan2(vy - 9 * sparkT, vx));
        dummy.scale.set(length, .035 + random(seed + 2) * .03, 1);
        dummy.updateMatrix();
        sparkMesh.setMatrixAt(i, dummy.matrix);
      }
      sparkMesh.instanceMatrix.needsUpdate = true;

      // 5) 바닥 먼지 고리: 무거운 공격일수록 넓게 퍼진다.
      const dust = group.getObjectByName('dust'), dustT = clamp01(age / 520);
      dust.visible = power >= 1;
      dust.position.set(0, .03, -.45);
      dust.scale.setScalar(.4 + easeOut(dustT) * 2.6 * power ** .6);
      dust.material.uniforms.color.value.set(type === 'heavy' ? 0xffd9a0 : 0xd8c9b0);
      dust.material.uniforms.thickness.value = .35 * (1 - dustT) + .05;
      dust.material.uniforms.fade.value = (1 - dustT) * .7;
    });

    // 카메라 흔들림 + 살짝 당겨 보기(펀치 줌). 기준 위치는 CameraFit이 정한 값이다.
    const base = camera.userData.base;
    if (base && shake > .001) {
      const t = (current?.clock ?? 0) / 1000;
      shakeOffset.set(Math.sin(t * 91) + Math.sin(t * 53) * .5, Math.cos(t * 77) * .8, 0).multiplyScalar(.055 * shake);
      camera.position.copy(base).add(shakeOffset);
      camera.fov = camera.userData.baseFov - 1.6 * shake;
      camera.updateProjectionMatrix();
      shaken.current = true;
      invalidate();
    } else if (base && shaken.current) {
      camera.position.copy(base); camera.fov = camera.userData.baseFov; camera.updateProjectionMatrix();
      shaken.current = false;
    }
  });
  return <group name="impact-effects">
    {slots.map((slot, index) => <ImpactSlot key={index} slotRef={slot} sparks={sparks} />)}
  </group>;
}

/** 맞은 쪽 몸을 하얗게 덮는 세기(0~1). 타격 직후 가장 밝고 150ms 안에 사라진다. */
export function hitFlashAmount(current, target) {
  if (!current) return 0;
  const enemyHit = !!current.enemy;
  if (target === 'enemy' ? enemyHit || current.effect.kind !== 'attack' : !enemyHit) return 0;
  return Math.max(0, ...impactAges(current).map(age => age < 0 ? 0 : (1 - clamp01(age / 150)) ** 1.5)) * (target === 'enemy' ? .85 : .6);
}
