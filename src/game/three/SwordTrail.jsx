import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { swingWindows } from './heroMotion.js';
import { publicAsset } from '../../publicAsset.js';

const MAX_AGE = 170;
const MASK = publicAsset('effects/sword-light.png');
const VERTEX = `
  attribute float strength;
  varying float glow;
  varying vec2 edge;
  void main() {
    glow = strength;
    edge = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;
const FRAGMENT = `
  uniform vec3 tint;
  uniform sampler2D mask;
  varying float glow;
  varying vec2 edge;
  void main() {
    float profile = texture2D(mask, vec2(0.53, edge.y)).a;
    vec3 color = mix(tint, vec3(1.0, 0.96, 0.83), smoothstep(0.65, 0.94, edge.y));
    gl_FragColor = vec4(color, glow * profile);
  }`;

function makeRibbon(size, mask) {
  const geometry = new THREE.BufferGeometry();
  const points = new THREE.BufferAttribute(new Float32Array(size * 6), 3).setUsage(THREE.DynamicDrawUsage);
  const strength = new THREE.BufferAttribute(new Float32Array(size * 2), 1).setUsage(THREE.DynamicDrawUsage);
  const uvs = [], indices = [];
  for (let i = 0; i < size; i++) {
    uvs.push(i / (size - 1), 0, i / (size - 1), 1);
    const a = i * 2;
    if (i < size - 1) indices.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
  }
  geometry.setAttribute('position', points);
  geometry.setAttribute('strength', strength);
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.setDrawRange(0, 0);
  const material = new THREE.ShaderMaterial({
    uniforms: { tint: { value: new THREE.Color() }, mask: { value: mask } },
    vertexShader: VERTEX, fragmentShader: FRAGMENT,
    side: THREE.DoubleSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  return {
    geometry, material, points, strength, offset: 0, count: 0, last: -Infinity,
    samples: Array.from({ length: size }, () => ({ base: new THREE.Vector3(), tip: new THREE.Vector3(), time: 0 })),
  };
}

export default function SwordTrail({ director, quality, sword }) {
  const size = quality.trail;
  const mask = useLoader(THREE.TextureLoader, MASK);
  const ribbons = useMemo(() => [makeRibbon(size, mask), makeRibbon(size, mask)], [size, mask]);
  const previous = useRef(null);
  const base = useMemo(() => new THREE.Vector3(), []);
  const tip = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => () => {
    for (const ribbon of ribbons) {
      ribbon.geometry.dispose();
      ribbon.material.dispose();
    }
  }, [ribbons]);

  useFrame(() => {
    const current = director.active;
    if (previous.current !== current) {
      previous.current = current;
      for (const ribbon of ribbons) {
        ribbon.offset = ribbon.count = 0;
        ribbon.last = -Infinity;
        ribbon.geometry.setDrawRange(0, 0);
      }
    }
    if (!current || current.plan.calm || !sword.current) return;
    const { clock, elapsed, plan } = current;
    const windows = swingWindows(plan);
    ribbons.forEach((ribbon, slot) => {
      const window = windows[slot];
      if (window && elapsed >= window[0] && elapsed <= window[1] && elapsed > ribbon.last) {
        sword.current.base.getWorldPosition(base);
        sword.current.tip.getWorldPosition(tip);
        const lastIndex = (ribbon.offset + ribbon.count - 1) % size;
        if (ribbon.count && ribbon.samples[lastIndex].tip.distanceToSquared(tip) > 2.25) {
          ribbon.offset = ribbon.count = 0;
        }
        const target = ribbon.samples[(ribbon.offset + ribbon.count) % size];
        target.tip.copy(tip);
        target.base.copy(base).lerp(tip, slot ? .27 : .2);
        target.time = clock;
        ribbon.last = elapsed;
        if (ribbon.count === size) ribbon.offset = (ribbon.offset + 1) % size;
        else ribbon.count++;
      }
      while (ribbon.count && clock - ribbon.samples[ribbon.offset].time >= MAX_AGE) {
        ribbon.offset = (ribbon.offset + 1) % size;
        ribbon.count--;
      }
      ribbon.geometry.setDrawRange(0, Math.max(0, ribbon.count - 1) * 6);
      if (ribbon.count < 2) return;
      ribbon.material.uniforms.tint.value.setHex(slot ? plan.recipe.accent : plan.recipe.color)
        .multiplyScalar(plan.upgraded ? 1.7 : 1.22);
      for (let index = 0; index < ribbon.count; index++) {
        const sample = ribbon.samples[(ribbon.offset + index) % size];
        const alpha = (1 - (clock - sample.time) / MAX_AGE) * (plan.upgraded ? .96 : .73);
        ribbon.points.setXYZ(index * 2, sample.base.x, sample.base.y, sample.base.z);
        ribbon.points.setXYZ(index * 2 + 1, sample.tip.x, sample.tip.y, sample.tip.z);
        ribbon.strength.setX(index * 2, alpha * .55);
        ribbon.strength.setX(index * 2 + 1, alpha);
      }
      ribbon.points.needsUpdate = true;
      ribbon.strength.needsUpdate = true;
    });
  });

  return <group name="sword-trails">{ribbons.map(({ geometry, material }, index) =>
    <mesh key={index} geometry={geometry} material={material} frustumCulled={false} renderOrder={2} dispose={null} />)}</group>;
}
