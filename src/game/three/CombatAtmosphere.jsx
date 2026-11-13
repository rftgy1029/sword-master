import { useMemo, useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { impactAges } from './playback.js';
import { ENEMY_HOME, HERO_HOME } from './heroMotion.js';

const URL = `${import.meta.env.BASE_URL}effects/impact-flipbook.png`;
const spriteVertex = `
varying vec2 spriteUv;
void main() {
  spriteUv = uv;
  vec4 center = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  vec2 scale = vec2(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz));
  gl_Position = projectionMatrix * (center + vec4(position.xy * scale, 0.0, 0.0));
}`;
const spriteFragment = `
uniform sampler2D atlas;
uniform vec3 tint;
uniform float frame;
uniform float row;
uniform float opacity;
varying vec2 spriteUv;
void main() {
  vec2 inset = (spriteUv * 62.0 + 1.0) / 64.0;
  vec2 frameUv = vec2((inset.x + frame) / 8.0, (inset.y + row) / 2.0);
  float alpha = texture2D(atlas, frameUv).a;
  gl_FragColor = vec4(tint, alpha * opacity);
}`;
const cap = (value) => Math.min(1, Math.max(0, value));

function updateSprite(sprite, { age, duration, color, x, y, z, size, alpha }) {
  const t = cap(age / duration);
  sprite.visible = age >= 0 && age < duration;
  if (!sprite.visible) return;
  sprite.position.set(x, y, z);
  sprite.scale.set(size, size, 1);
  const uniforms = sprite.material.uniforms;
  uniforms.tint.value.setHex(color).multiplyScalar(alpha > .8 ? 1.65 : 1);
  uniforms.frame.value = Math.min(7, Math.floor(t * 8));
  uniforms.opacity.value = alpha * (1 - t) ** .65;
}

export default function CombatAtmosphere({ director, quality, sword }) {
  const atlas = useLoader(THREE.TextureLoader, URL);
  const root = useRef(null);
  const sparks = useRef(null);
  const ages = useRef([]);
  const matrix = useMemo(() => new THREE.Object3D(), []);
  const origin = useMemo(() => new THREE.Vector3(), []);
  const stone = useMemo(() => new THREE.Color(), []);
  const tint = useMemo(() => new THREE.Color(), []);

  useFrame(() => {
    const current = director.active;
    const group = root.current;
    group.visible = !!current && !current.plan.calm;
    if (!group.visible) return;
    const { plan, elapsed } = current;
    const hitAges = impactAges(current, ages.current);
    const type = plan.cardType;
    const color = plan.color;
    const own = plan.side === 'hero';
    const x = own ? ENEMY_HOME - .24 : HERO_HOME + .18;
    const y = type === 'heavy' ? .32 : 1.05;

    for (let slot = 0; slot < 2; slot++) {
      let age = -1, power = 1;
      for (let index = slot; index < hitAges.length; index += 2) {
        if (hitAges[index] < 0) continue;
        age = hitAges[index];
        power = plan.hitInfo[index].power;
      }
      const tint = slot === 1 && type === 'twin' ? plan.recipe.accent : color;
      updateSprite(group.children[slot], { age, duration: 300, color: tint, x, y, z: .28, size: 1.45 + .65 * power, alpha: .92 });
      updateSprite(group.children[slot + 2], {
        age, duration: 680, color: 0xab8d79, x, y: .25 + .34 * cap(age / 680), z: .15,
        size: .8 + 2.1 * cap(age / 680), alpha: quality.bloom ? .55 : .31,
      });
    }

    const lastAge = hitAges.findLast((age) => age >= 0) ?? -1;
    const debris = sparks.current;
    const burst = lastAge >= 0 && lastAge < 610 && (type === 'heavy' || type === 'nova' || plan.lethal || plan.heavy);
    debris.visible = burst;
    if (burst) {
      const t = lastAge / 610;
      tint.setHex(color);
      for (let index = 0; index < quality.debris; index++) {
        const angle = index * 2.39996, radius = t * (.7 + index % 7 * .2);
        matrix.position.set(x + Math.cos(angle) * radius, .1 + Math.sin(t * Math.PI) * (.5 + index % 5 * .22), Math.sin(angle) * radius);
        matrix.rotation.set(t * 7 + index, t * 3, index * .7);
        matrix.scale.setScalar((.08 + index % 4 * .035) * (1 - t) ** .5);
        matrix.updateMatrix();
        debris.setMatrixAt(index, matrix.matrix);
        debris.setColorAt(index, stone.setHex(0x93807f).lerp(tint, index % 3 ? .26 : .72));
      }
      debris.instanceMatrix.needsUpdate = true;
      if (debris.instanceColor) debris.instanceColor.needsUpdate = true;
    }

    const projectile = group.getObjectByName('combat-projectile');
    const ownLaunch = plan.recipe?.marks.launch;
    const nextIndex = current.hits.findIndex((at) => at >= elapsed);
    const at = current.hits[nextIndex];
    const launch = own ? ownLaunch : Math.max(plan.attack?.windup ?? 0, at - 380);
    projectile.visible = !!(own ? type === 'flare' : plan.ranged) && nextIndex >= 0 && elapsed >= launch && elapsed <= at;
    if (projectile.visible) {
      const t = cap((elapsed - launch) / Math.max(1, at - launch));
      if (own && sword.current) sword.current.tip.getWorldPosition(origin);
      else origin.set(ENEMY_HOME - .33, 1.03, .08);
      projectile.children.forEach((part, index) => {
        const f = cap(t - index * .047);
        part.position.set(THREE.MathUtils.lerp(origin.x, x, f), THREE.MathUtils.lerp(origin.y, y, f) + Math.sin(Math.PI * f) * .28, origin.z * (1 - f));
        part.rotation.set(elapsed * .02 + index, elapsed * .018, index);
        part.scale.setScalar(index ? .16 - .016 * index : .21);
        part.material.color.setHex(index ? color : 0xfffbec);
        part.material.opacity = index ? .62 * (1 - index / projectile.children.length) : .92;
      });
    }

    const marker = group.getObjectByName('combat-world-light');
    const flash = lastAge >= 0 && lastAge < 230 ? (1 - lastAge / 230) ** 2 : 0;
    marker.position.set(x, y, .4);
    marker.color.setHex(color);
    marker.intensity = quality.bloom ? flash * (type === 'nova' ? 7.5 : 5) : 0;
  });

  return <group ref={root} name="combat-atmosphere" visible={false}>
    {[false, false, true, true].map((smoke, index) => <mesh key={index} renderOrder={smoke ? 5 : 13} visible={false} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial vertexShader={spriteVertex} fragmentShader={spriteFragment} uniforms={{
        atlas: { value: atlas }, tint: { value: new THREE.Color() }, frame: { value: 0 },
        row: { value: smoke ? 0 : 1 }, opacity: { value: 0 },
      }} transparent depthWrite={false} blending={smoke ? THREE.NormalBlending : THREE.AdditiveBlending} />
    </mesh>)}
    <group name="combat-projectile" visible={false}>
      {Array.from({ length: quality.level === 'low' ? 4 : 7 }, (_, index) => <mesh key={index}>
        <icosahedronGeometry args={[1, 1]} />
        <meshBasicMaterial transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>)}
    </group>
    <instancedMesh ref={sparks} args={[undefined, undefined, quality.debris]} visible={false} frustumCulled={false}>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial roughness={.82} />
    </instancedMesh>
    <pointLight name="combat-world-light" intensity={0} distance={4} decay={2} />
  </group>;
}
