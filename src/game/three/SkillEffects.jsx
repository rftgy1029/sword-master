import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ENEMY_HOME, HERO_HOME } from './heroMotion.js';
import { impactAges } from './playback.js';

const TAU = Math.PI * 2;
const clamp = (value) => Math.max(0, Math.min(1, value));
const ease = (value) => { const t = clamp(value); return t * t * (3 - 2 * t); };
const FADE = { transparent: true, depthWrite: false, toneMapped: false };
const ADD = { ...FADE, blending: THREE.AdditiveBlending };
const ENEMY_STYLE = { block: 'guard', buff: 'empower', charge: 'focus', wait: 'flow' };
const UPGRADE_POLYGONS = [3, 4, 5, 6, 7, 8, 10, 12];
const UPGRADES = {
  strike: [0xffdf7d, 3], heavy: [0xff8b43, 6], twin: [0xc4a7ff, 4], flare: [0xbba0ff, 8],
  nova: [0xffc34d, 12], guard: [0x93eed1, 6], heal: [0xfcc7ec, 7], empower: [0xff9753, 5],
  weaken: [0xdab0ff, 6], focus: [0xa6e7ff, 8], flow: [0x8bf8ec, 5], oath: [0xffdc82, 10],
};

function Orb({ color = 0xffffff }) {
  return <mesh><octahedronGeometry args={[1, 0]} /><meshBasicMaterial {...ADD} color={color} /></mesh>;
}

function Ring({ radius = 1, width = .026, sides = 48, color = 0xffffff }) {
  return <mesh rotation={[-Math.PI / 2, 0, 0]}>
    <ringGeometry args={[radius - width, radius, sides]} />
    <meshBasicMaterial {...ADD} color={color} side={THREE.DoubleSide} />
  </mesh>;
}

function GroundSigil({ sides, color }) {
  return <>
    <Ring radius={1} color={color} />
    <Ring radius={.83} sides={sides} width={.04} color={color} />
    <Ring radius={.48} sides={sides} width={.018} color={color} />
    {Array.from({ length: sides }, (_, index) => {
      const angle = index / sides * TAU;
      return <mesh key={index} position={[.9 * Math.cos(angle), .01, .9 * Math.sin(angle)]}
        rotation={[-Math.PI / 2, 0, -angle]}>
        <planeGeometry args={[.09, .024]} /><meshBasicMaterial {...ADD} color={color} side={THREE.DoubleSide} />
      </mesh>;
    })}
  </>;
}

export default function SkillEffects({ director, quality, sword }) {
  const root = useRef(null), particles = useRef(null), upgrade = useRef(null);
  const groups = useRef({});
  const ages = useRef([]);
  const geo = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(quality.particles * 3), 3).setUsage(THREE.DynamicDrawUsage));
    return geometry;
  }, [quality.particles]);
  const tip = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => () => geo.dispose(), [geo]);

  useFrame(() => {
    const current = director.active;
    const stage = root.current;
    stage.visible = !!current && !current.plan.calm;
    if (!stage.visible) return;
    const { plan, elapsed, effect } = current;
    const type = plan.cardType ?? ENEMY_STYLE[plan.action];
    const target = plan.role === 'curse' || plan.side === 'enemy' || plan.hits.length ? ENEMY_HOME : HERO_HOME;
    stage.position.set(plan.side === 'enemy' ? ENEMY_HOME : target, .035, 0);
    if (import.meta.env.DEV) Object.assign(stage.userData, { effectId: effect.id, upgraded: plan.upgraded, type });
    const impact = impactAges(current, ages.current).findLast((age) => age >= 0) ?? -1;
    const moment = plan.moment ?? plan.hits[0] ?? 280;
    const approach = ease(elapsed / Math.max(1, moment));
    const after = Math.max(0, elapsed - moment);
    const tail = 1 - ease(after / Math.max(1, plan.duration - moment));
    const pulse = approach * tail;
    const rise = ease(elapsed / 220);
    const color = plan.color;
    const shape = groups.current;
    for (const group of Object.values(shape)) group.visible = false;

    if (type === 'guard' && plan.kind !== 'miss') {
      const guard = shape.guard;
      guard.visible = true;
      guard.scale.setScalar(.6 + rise * .52);
      guard.children[0].rotation.y = elapsed * .0016;
      const shield = guard.children[1];
      shield.scale.set(1 + .1 * pulse, 1, .66);
      shield.material.opacity = pulse * .44;
      const plates = guard.children[2];
      plates.children.forEach((plate, index) => {
        const angle = (index - 3) * .27;
        const gap = 1.6 - .65 * approach;
        plate.position.set(Math.sin(angle) * gap, .12 + pulse * (.92 - Math.abs(angle) * .32), Math.cos(angle) * gap * .54);
        plate.rotation.y = angle + (1 - approach) * .85;
        plate.scale.setScalar(rise * Math.max(.01, tail));
        plate.material.opacity = pulse * .87;
      });
    } else if (type === 'heal' && plan.kind !== 'miss') {
      const heal = shape.heal;
      heal.visible = true;
      heal.children[0].rotation.y = elapsed * -.002;
      heal.children[0].children.forEach((petal, index) => {
        const angle = index / 7 * TAU;
        petal.position.set(Math.cos(angle) * (.72 + pulse * .17), .04, Math.sin(angle) * (.72 + pulse * .17));
        petal.rotation.set(-Math.PI / 2, 0, -angle);
        petal.scale.set(.19 * rise, .41 * rise, 1);
        petal.material.opacity = .72 * tail;
      });
      heal.children[1].scale.set(.65 + pulse * .25, .54 + pulse, .65 + pulse * .25);
      heal.children[1].material.opacity = pulse * .24;
    } else if (type === 'empower' && plan.kind !== 'miss') {
      const fire = shape.fire;
      fire.visible = true;
      fire.rotation.y = elapsed * .006;
      fire.children.forEach((flame, index) => {
        const a = index / 9 * TAU;
        const strength = pulse * (.72 + .28 * Math.sin(elapsed * .028 + index));
        flame.position.set(Math.cos(a) * .42, .38 + strength * .39, Math.sin(a) * .42);
        flame.scale.set(.85 + strength, .24 + strength * 1.9, .85 + strength);
        flame.material.opacity = strength * .85;
      });
    } else if (type === 'weaken' && plan.kind !== 'miss') {
      const seal = shape.seal;
      seal.visible = true;
      seal.rotation.y = -elapsed * .004;
      seal.scale.setScalar((1.66 - approach * .74) * (.94 + rise * .06));
      seal.children[0].rotation.y = elapsed * .007;
      seal.children[1].children.forEach((link, index) => {
        link.position.y = .58 + Math.sin(index / 12 * TAU + elapsed * .006) * .24;
        link.scale.setScalar(Math.max(.001, pulse));
      });
    } else if (type === 'focus' && plan.kind !== 'miss') {
      const focus = shape.focus;
      focus.visible = true;
      const atBlade = plan.side === 'hero' && sword.current;
      if (atBlade) {
        sword.current.tip.getWorldPosition(tip);
        focus.position.set(tip.x - HERO_HOME, tip.y, tip.z);
      } else focus.position.set(0, 1.42, 0);
      focus.scale.setScalar(.85 * (1 - approach) + .22 + .32 * pulse);
      focus.rotation.set(elapsed * .007, elapsed * .012, elapsed * -.004);
      focus.children[3].scale.setScalar(.16 + Math.exp(-after / 100) * approach * .48);
    } else if (type === 'flow' && plan.kind !== 'miss') {
      const flow = shape.flow;
      flow.visible = true;
      flow.rotation.y = -elapsed * .012;
      flow.children.forEach((ring, index) => {
        ring.position.y = (.32 + index * .29) * (1 + approach * .65);
        ring.rotation.set(Math.PI / 2 + index * .17, .22, elapsed * .005 + index);
        ring.scale.setScalar(.64 + .28 * pulse);
        ring.material.opacity = pulse * (.8 - index * .1);
      });
    } else if (type === 'oath' && plan.kind !== 'miss') {
      const oath = shape.oath;
      oath.visible = true;
      oath.children[0].scale.setScalar(.45 + rise * 1.05);
      oath.children[0].rotation.y = elapsed * .0025;
      const crown = oath.children[1];
      crown.position.y = 1.75 + .78 * approach - .33 * ease(after / 250);
      crown.scale.setScalar(.45 + .72 * pulse);
      crown.rotation.y = elapsed * .003;
      oath.children[2].scale.set(.3 + pulse * .6, 1, .3 + pulse * .6);
      oath.children[2].material.opacity = pulse * .25;
    } else if (type === 'nova' && plan.kind !== 'miss') {
      const nova = shape.nova;
      nova.visible = true;
      const explode = impact >= 0;
      const age = Math.max(0, impact);
      nova.children[0].scale.setScalar(explode ? .52 + 2.9 * ease(age / 420) : 1.8 - approach * 1.48);
      nova.children[0].rotation.y = elapsed * -.003;
      nova.children[1].visible = explode && age < 680;
      nova.children[1].scale.set(.48 + 1.2 * ease(age / 160), 1.4 + .45 * ease(age / 300), .48 + 1.2 * ease(age / 160));
      nova.children[1].material.opacity = (1 - ease(age / 680)) * .49;
      nova.children[2].visible = explode && age < 420;
      nova.children[2].scale.set(.46 + .63 * ease(age / 320), 1.5, .46 + .63 * ease(age / 320));
      nova.children[2].material.opacity = (1 - ease(age / 420)) * .72;
    } else if (type === 'heavy' && impact >= 0) {
      const fracture = shape.fracture;
      fracture.visible = impact < 690;
      const spread = ease(impact / 270);
      fracture.scale.setScalar(.36 + 1.8 * spread);
      fracture.children.forEach((crack, index) => { crack.material.opacity = (1 - ease(impact / 690)) * (index % 2 ? .56 : .92); });
    } else if (type === 'twin' && current.delivered > 1) {
      const cross = shape.cross;
      cross.visible = impact < 360;
      cross.scale.setScalar(.7 + .3 * ease(impact / 250));
      cross.children.forEach((arc) => { arc.material.opacity = 1 - ease(impact / 360); });
    }

    const upgraded = upgrade.current;
    upgraded.visible = !!plan.upgraded && plan.kind !== 'miss' && elapsed > moment - 130;
    if (upgraded.visible) {
      const age = Math.max(0, elapsed - moment);
      upgraded.scale.setScalar((plan.hits.length ? 1.08 : .78) + 1.22 * ease(age / 350));
      upgraded.rotation.y = elapsed * .005;
      const [tint, sides] = UPGRADES[type];
      for (let index = 0; index < upgraded.children.length; index++) {
        const mesh = upgraded.children[index];
        mesh.material.color.setHex(tint);
        mesh.material.opacity = Math.max(.02, tail) * .8;
        mesh.visible = index === 0 || index === UPGRADE_POLYGONS.indexOf(sides) + 1;
      }
      upgraded.children[0].scale.setScalar(.8 + .2 * ease(age / 200));
    }

    const dots = particles.current;
    const charging = (type === 'heavy' || type === 'flare') && elapsed < (plan.recipe?.marks.launch ?? moment);
    const quiet = type === 'nova' && elapsed >= plan.recipe.marks.hush && elapsed < moment;
    const particleType = type && plan.kind !== 'miss' && (['heal', 'focus', 'empower', 'weaken', 'oath', 'flow', 'nova'].includes(type) || charging);
    dots.visible = !!particleType && !quiet && !(type === 'nova' && impact >= 0);
    if (!dots.visible) return;
    const aroundBlade = (charging || type === 'focus') && plan.side === 'hero' && sword.current;
    if (aroundBlade) {
      sword.current.tip.getWorldPosition(tip);
      dots.position.set(tip.x - stage.position.x, tip.y - stage.position.y, tip.z);
    } else dots.position.set(0, type === 'nova' ? 1.12 : 0, 0);
    const points = geo.attributes.position;
    for (let index = 0; index < quality.particles; index++) {
      const orbit = index * 2.39996 + elapsed * (type === 'flow' ? .009 : .003);
      const fraction = (index * .137 + elapsed * .0018) % 1;
      let radius = .25 + index % 9 * .07, height = .2 + fraction * 2.6;
      if (type === 'focus' || charging || type === 'nova') {
        radius = (.28 + index % 12 * .11) * (1 - approach * .88);
        height = Math.sin(index * 1.27 + elapsed * .004) * radius;
      } else if (type === 'weaken') {
        radius *= 1.9 - approach * 1.13;
        height = .24 + (1 - fraction) * 1.5;
      } else if (type === 'heal') radius *= 1.55 - fraction;
      points.setXYZ(index, Math.cos(orbit) * radius, height, Math.sin(orbit) * radius);
    }
    points.needsUpdate = true;
    dots.material.color.setHex(color).multiplyScalar(1.18);
    dots.material.opacity = Math.min(1, rise * 1.45) * tail;
    dots.material.size = type === 'focus' ? .045 : .065;
  });

  const bind = (key) => (node) => { if (node) groups.current[key] = node; };
  return <group ref={root} name="skill-effects" visible={false}>
    <group ref={bind('guard')} visible={false} name="guard-shield">
      <group><GroundSigil sides={6} color={0xa3f6dc} /></group>
      <mesh position={[0, .78, .12]}><sphereGeometry args={[.84, 24, 12, 0, TAU, 0, Math.PI * .72]} />
        <meshBasicMaterial {...ADD} side={THREE.DoubleSide} color={0x7ee9ce} /></mesh>
      <group>{Array.from({ length: 7 }, (_, index) => <mesh key={index}>
        <boxGeometry args={[.21, .55 - .045 * Math.abs(index - 3), .1]} /><meshStandardMaterial {...FADE} metalness={.55} roughness={.37}
          color={0xa8c8ad} emissive={0x17534c} />
      </mesh>)}</group>
    </group>
    <group ref={bind('heal')} visible={false} name="heal-petals">
      <group>{Array.from({ length: 7 }, (_, index) => <mesh key={index}><circleGeometry args={[1, 24]} />
        <meshBasicMaterial {...ADD} color={index % 2 ? 0xffc8e6 : 0x81ffd6} side={THREE.DoubleSide} />
      </mesh>)}</group>
      <mesh position={[0, .94, 0]}><cylinderGeometry args={[.47, .86, 1.9, 32, 1, true]} />
        <meshBasicMaterial {...ADD} color={0xa0f7c5} side={THREE.DoubleSide} /></mesh>
    </group>
    <group ref={bind('fire')} visible={false} name="empower-fire">
      {Array.from({ length: 9 }, (_, index) => <mesh key={index}><coneGeometry args={[.14, .84, 7]} />
        <meshBasicMaterial {...ADD} color={index % 3 ? 0xff6f44 : 0xffd575} /></mesh>)}
    </group>
    <group ref={bind('seal')} visible={false} name="weaken-chains">
      <group><GroundSigil sides={5} color={0xb9a0f3} /></group>
      <group>{Array.from({ length: 12 }, (_, index) => {
        const angle = index / 12 * TAU;
        return <mesh key={index} position={[Math.cos(angle) * .74, .7, Math.sin(angle) * .74]}
          rotation={[index % 2 ? .85 : -.18, -angle, .3]}>
          <torusGeometry args={[.15, .039, 5, 12]} /><meshStandardMaterial roughness={.48} metalness={.68} color={0x6e4f91} emissive={0x291333} />
        </mesh>;
      })}</group>
    </group>
    <group ref={bind('focus')} visible={false} name="focus-star">
      {[0, 1, 2].map((index) => <mesh key={index} rotation={[index * 1.1, index * .7, 0]}>
        <torusGeometry args={[.68, .024, 6, 42]} /><meshBasicMaterial {...ADD} color={0x87bcff} />
      </mesh>)}
      <Orb color={0xbce7ff} />
    </group>
    <group ref={bind('flow')} visible={false} name="flow-spiral">
      {Array.from({ length: 4 }, (_, index) => <mesh key={index}>
        <torusGeometry args={[.64 + index * .14, .021, 6, 40, Math.PI * 1.43]} />
        <meshBasicMaterial {...ADD} color={index % 2 ? 0xc2fff0 : 0x60e4d8} />
      </mesh>)}
    </group>
    <group ref={bind('oath')} visible={false} name="oath-crown">
      <group><GroundSigil sides={8} color={0xffd46f} /></group>
      <group>
        <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.45, .048, 8, 40]} /><meshStandardMaterial color={0xffce68} metalness={.72}
          roughness={.36} emissive={0x8c4b14} /></mesh>
        {Array.from({ length: 7 }, (_, index) => <mesh key={index}
          position={[Math.cos(index / 7 * TAU) * .45, .15, Math.sin(index / 7 * TAU) * .45]}>
          <octahedronGeometry args={[.19]} /><meshStandardMaterial color={0xffdf9b} metalness={.55} emissive={0xb26724} />
        </mesh>)}
      </group>
      <mesh position={[0, 1.3, 0]}><cylinderGeometry args={[.45, .65, 2.6, 32, 1, true]} />
        <meshBasicMaterial {...ADD} side={THREE.DoubleSide} color={0xffdb7c} /></mesh>
    </group>
    <group ref={bind('nova')} visible={false} name="nova-column">
      <group><GroundSigil sides={8} color={0xffbd5e} /></group>
      <mesh position={[0, 1.7, 0]}><cylinderGeometry args={[.78, 1.06, 3.8, 44, 1, true]} />
        <meshBasicMaterial {...ADD} color={[1.55, .56, .12]} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, 1.55, 0]}><cylinderGeometry args={[.18, .54, 3.9, 32]} />
        <meshBasicMaterial {...ADD} color={[2.2, 1.6, .68]} /></mesh>
    </group>
    <group ref={bind('fracture')} visible={false} position={[0, .018, 0]} name="heavy-cracks">
      {Array.from({ length: 11 }, (_, index) => <mesh key={index} position={[Math.sin(index / 11 * TAU) * .58, 0, -Math.cos(index / 11 * TAU) * .58]}
        rotation={[-Math.PI / 2, 0, -index / 11 * TAU]}>
        <planeGeometry args={[.025, 1.38]} />
        <meshBasicMaterial {...ADD} color={index % 3 ? 0xe96933 : 0xffca87} side={THREE.DoubleSide} />
      </mesh>)}
    </group>
    <group ref={bind('cross')} visible={false} position={[0, 1.12, .47]} name="twin-cross">
      {[-1, 1].map((sign) => <mesh key={sign} rotation={[0, 0, sign * .8]}>
        <torusGeometry args={[.63, .034, 6, 38, Math.PI * 1.15]} /><meshBasicMaterial {...ADD} color={sign < 0 ? 0x88cfff : 0xd0acff} />
      </mesh>)}
    </group>
    <group ref={upgrade} visible={false} name="upgraded-halo">
      <Ring radius={1} width={.06} />
      {UPGRADE_POLYGONS.map((sides) => <Ring key={sides} radius={.82} width={.035} sides={sides} />)}
    </group>
    <points ref={particles} geometry={geo} frustumCulled={false}><pointsMaterial {...ADD} size={.06} /></points>
  </group>;
}
