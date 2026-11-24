import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import {
  mergeStaticJointMeshes,
  setActorOutlines,
  setHitFlash,
  stylizeActor,
} from '../src/game/three/toon.js';

function countMeshes(root) {
  let count = 0;
  root.traverse((node) => {
    if (node.isMesh && !node.userData.outline) count += 1;
  });
  return count;
}

function withoutTextures(glb) {
  const length = glb.readUInt32LE(12);
  const gltf = JSON.parse(glb.subarray(20, 20 + length).toString());
  delete gltf.images;
  delete gltf.textures;
  delete gltf.samplers;
  for (const material of gltf.materials ?? []) {
    delete material.pbrMetallicRoughness?.baseColorTexture;
  }
  let json = Buffer.from(JSON.stringify(gltf));
  json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
  const rest = glb.subarray(20 + length);
  const head = Buffer.alloc(20);
  head.write('glTF', 0);
  head.writeUInt32LE(2, 4);
  head.writeUInt32LE(20 + json.length + rest.length, 8);
  head.writeUInt32LE(json.length, 12);
  head.writeUInt32LE(0x4e4f534a, 16);
  return Buffer.concat([head, json, rest]);
}

async function loadModel(name, stripTextures = false) {
  let bytes = readFileSync(new URL(`../public/models/${name}.glb`, import.meta.url));
  if (stripTextures) bytes = withoutTextures(bytes);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return new GLTFLoader().parseAsync(buffer, '');
}

test('mergeStaticJointMeshes batches static child meshes per boundary joint while preserving vertex colors and transforms', () => {
  const root = new THREE.Group();
  const joint = new THREE.Group();
  joint.name = 'body';
  root.add(joint);

  const subGroup = new THREE.Group();
  subGroup.name = 'decor';
  subGroup.position.set(1, 2, 0);
  joint.add(subGroup);

  const boxA = new THREE.BoxGeometry(1, 1, 1);
  const boxB = new THREE.BoxGeometry(0.5, 0.5, 0.5);
  const boxAOrigPos = Float32Array.from(boxA.getAttribute('position').array);

  const meshA = new THREE.Mesh(boxA, new THREE.MeshStandardMaterial({ color: '#ff0000' }));
  meshA.name = 'part_a';
  meshA.position.set(-1, 0, 0);
  joint.add(meshA);

  // Mesh with pre-existing 4-component vertex colors + tint
  const colors4 = new Uint8Array(boxB.getAttribute('position').count * 4);
  for (let i = 0; i < colors4.length; i += 4) {
    colors4[i] = 0;
    colors4[i + 1] = 255;
    colors4[i + 2] = 0;
    colors4[i + 3] = 255;
  }
  boxB.setAttribute('color', new THREE.BufferAttribute(colors4, 4, true));
  const meshB = new THREE.Mesh(boxB, new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true }));
  meshB.name = 'part_b';
  subGroup.add(meshB);

  // Animated sub-joint must remain separate as a boundary anchor
  const arm = new THREE.Group();
  arm.name = 'arm_left';
  joint.add(arm);
  const armGeo1 = new THREE.BoxGeometry(0.4, 0.4, 0.4);
  const armGeo2 = new THREE.BoxGeometry(0.4, 0.4, 0.4);
  arm.add(new THREE.Mesh(armGeo1, new THREE.MeshStandardMaterial({ color: '#336699' })));
  arm.add(new THREE.Mesh(armGeo2, new THREE.MeshStandardMaterial({ color: '#4477aa' })));

  // Head boundary + glowing + facial detail + mirrored negative-scale mesh
  const head = new THREE.Group();
  head.name = 'head';
  joint.add(head);
  const headGeo1 = new THREE.BoxGeometry(0.6, 0.6, 0.6);
  const headGeo2 = new THREE.BoxGeometry(0.3, 0.3, 0.3);
  const glowGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
  const detailGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
  const leafGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
  const mirroredGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);

  head.add(new THREE.Mesh(headGeo1, new THREE.MeshStandardMaterial({ color: '#889977' })));
  head.add(new THREE.Mesh(headGeo2, new THREE.MeshStandardMaterial({ color: '#778866' })));
  head.add(new THREE.Mesh(glowGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffaa33' })));
  head.add(new THREE.Mesh(detailGeo, new THREE.MeshStandardMaterial({ name: 'brow detail', color: '#222222' })));
  head.add(new THREE.Mesh(leafGeo, new THREE.MeshStandardMaterial({ color: '#44aa44', side: THREE.DoubleSide })));
  const mirrored = new THREE.Mesh(mirroredGeo, new THREE.MeshStandardMaterial({ color: '#abcdef' }));
  mirrored.scale.set(-1, 1, 1);
  head.add(mirrored);

  let sourceDisposed = false;
  boxA.addEventListener('dispose', () => { sourceDisposed = true; });

  const clip = new THREE.AnimationClip('idle', 1, [
    new THREE.VectorKeyframeTrack('body.position', [0, 1], [0, 0, 0, 0, 0.1, 0]),
    new THREE.QuaternionKeyframeTrack('arm_left.quaternion', [0, 1], [0, 0, 0, 1, 0, 0, 0, 1]),
  ]);

  const result = mergeStaticJointMeshes(root, [clip]);
  assert.equal(sourceDisposed, false, 'cached source geometries are never disposed');
  assert.deepEqual(boxA.getAttribute('position').array, boxAOrigPos, 'cached source geometries are never mutated');
  assert.equal(result.mergedCount, 3, 'merges body(2), arm_left(2), and head opaque FrontSide(2)');

  const bodyBatch = joint.children.find((child) => child.userData.mergedGeometry);
  assert.ok(bodyBatch, 'merged mesh added directly to boundary joint');
  assert.equal(bodyBatch.material.vertexColors, true);
  assert.equal(bodyBatch.material.color.getHexString(), 'ffffff');
  assert.ok(bodyBatch.geometry.getAttribute('color'), 'merged mesh carries baked vertex colors');

  // Verify subGroup offset (1, 2, 0) was baked into bodyBatch vertex positions
  const posAttr = bodyBatch.geometry.getAttribute('position');
  let maxY = -Infinity;
  for (let i = 0; i < posAttr.count; i += 1) maxY = Math.max(maxY, posAttr.getY(i));
  assert.ok(maxY > 2.2, `subGroup translation baked into joint-local vertices (maxY=${maxY})`);

  // Verify baked red (from meshA) and green (from meshB) are both present in merged vertex colors
  const bakedColors = bodyBatch.geometry.getAttribute('color');
  let sawRed = false;
  let sawGreen = false;
  for (let i = 0; i < bakedColors.count; i += 1) {
    if (bakedColors.getX(i) > 0.9 && bakedColors.getY(i) < 0.05) sawRed = true;
    if (bakedColors.getY(i) > 0.9 && bakedColors.getX(i) < 0.05) sawGreen = true;
  }
  assert.ok(sawRed && sawGreen, 'merged vertex colors preserve both solid mat.color and existing vertex color');

  // Verify head, arm_left, glowing, facial detail, DoubleSide, and mirrored meshes remained untouched
  assert.equal(head.children.filter((c) => c.isMesh).length, 5, 'head has 1 merged + glow + detail + DoubleSide + mirrored');
  assert.equal(arm.children.filter((c) => c.isMesh).length, 1, 'arm_left has its own merged mesh');

  let mergedDisposed = 0;
  for (const g of result.mergedGeometries) {
    g.addEventListener('dispose', () => { mergedDisposed += 1; });
  }
  result.dispose();
  assert.equal(mergedDisposed, 3, 'dispose cleans up all merged geometries');

  [boxA, boxB, armGeo1, armGeo2, headGeo1, headGeo2, glowGeo, detailGeo, leafGeo, mirroredGeo].forEach((g) => g.dispose());
});

test('mergeStaticJointMeshes cuts mesh count by >= 50% on crawler, boss, and sentinel while keeping head and animation joints', async () => {
  for (const name of ['crawler', 'boss', 'sentinel']) {
    const gltf = await loadModel(name);
    const cloned = cloneSkeleton(gltf.scene);
    const before = countMeshes(cloned);

    const animTargets = new Set();
    for (const clip of gltf.animations) {
      for (const track of clip.tracks) animTargets.add(track.name.split('.')[0]);
    }

    const handle = stylizeActor(cloned, { outlines: true, animations: gltf.animations, batch: true });
    const after = countMeshes(cloned);
    const reduction = (before - after) / before;

    assert.ok(
      reduction >= 0.5,
      `${name} mesh count reduced by >= 50% (before=${before}, after=${after}, reduction=${(reduction * 100).toFixed(1)}%)`,
    );

    const head = cloned.getObjectByName('head');
    assert.ok(head, `${name} preserves head joint`);
    assert.ok(!new THREE.Box3().setFromObject(head).isEmpty(), `${name} head retains measurable bounds`);

    for (const target of animTargets) {
      assert.ok(cloned.getObjectByName(target), `${name} preserves animation target ${target}`);
    }

    // Exercise animation mixer, hit flash, outline toggle, and dispose cleanup
    const mixer = new THREE.AnimationMixer(cloned);
    const attackClip = gltf.animations.find((clip) => clip.name === 'attack');
    assert.ok(attackClip);
    mixer.clipAction(attackClip).play();
    mixer.update(0.25);
    mixer.stopAllAction();

    assert.ok(handle.userData.flashTargets.size >= 1);
    setHitFlash(handle, 0.75, '#ffd2c4');
    for (const mat of handle.userData.flashTargets) {
      assert.equal(mat.userData.hitFlash.value, 0.75);
    }

    setActorOutlines(cloned, handle, false);
    for (const outline of handle.userData.outlines) assert.equal(outline.visible, false);
    setActorOutlines(cloned, handle, true);
    for (const outline of handle.userData.outlines) assert.equal(outline.visible, true);

    const mergedCount = handle.userData.mergedGeometries.length;
    assert.ok(mergedCount > 0, `${name} produced merged geometries`);
    let disposed = 0;
    for (const g of handle.userData.mergedGeometries) {
      g.addEventListener('dispose', () => { disposed += 1; });
    }
    handle.dispose();
    assert.equal(disposed, mergedCount, `${name} disposes every merged geometry`);
  }
});

test('skinned hero meshes are left untouched even if mergeStaticJointMeshes or stylizeActor(batch=true) runs', async () => {
  const gltf = await loadModel('hero', true);
  const cloned = cloneSkeleton(gltf.scene);
  const before = countMeshes(cloned);

  const skinnedBefore = [];
  cloned.traverse((node) => { if (node.isSkinnedMesh) skinnedBefore.push(node); });
  assert.ok(skinnedBefore.length >= 2, 'hero has skinned meshes');

  const handle = stylizeActor(cloned, { outlines: false, animations: gltf.animations, batch: true });
  assert.equal(countMeshes(cloned), before, 'hero skinned meshes are not merged');
  assert.equal(handle.userData.mergedGeometries.length, 0);
  assert.ok(cloned.getObjectByName('weapon'), 'hero weapon joint preserved');
  assert.ok(cloned.getObjectByName('weapon_tip'), 'hero weapon_tip joint preserved');
  handle.dispose();
});
