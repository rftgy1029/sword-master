import * as THREE from 'three';

// 3단계 명암 램프: 어두운 면·중간 면·밝은 면으로 나누되, 경계는 선형 보간으로 살짝 풀어
// 저폴리 구에서 계단처럼 깨지는 얼룩을 줄인다.
const RAMP_STEPS = [118, 118, 124, 186, 194, 246, 255, 255];
const ramp = new THREE.DataTexture(Uint8Array.from(RAMP_STEPS.flatMap(v => [v, v, v, 255])), RAMP_STEPS.length, 1);
ramp.magFilter = ramp.minFilter = THREE.LinearFilter;
ramp.generateMipmaps = false;
ramp.needsUpdate = true;

export const OUTLINE_WIDTH = .016;
const OUTLINE_MIN_SIZE = .07;
const RIM_COLOR = new THREE.Color('#fff0cf');
const toonCache = new WeakMap();

// 뒷면을 법선 방향으로 밀어내 그리는 외곽선. 스킨 메시(뼈대가 있는 모델)도 같은 셰이더로 그린다.
// 각진 모델은 면마다 법선이 달라 모서리에서 선이 끊기므로, 같은 위치의 법선을 평균한 outlineNormal을 쓴다.
const baseOutline = new THREE.ShaderMaterial({
  name: 'actor outline',
  side: THREE.BackSide,
  uniforms: { width: { value: OUTLINE_WIDTH }, color: { value: new THREE.Color('#14100d') } },
  vertexShader: `
    #include <common>
    #include <skinning_pars_vertex>
    attribute vec3 outlineNormal;
    uniform float width;
    void main() {
      vec3 objectNormal = outlineNormal;
      #include <skinbase_vertex>
      #include <skinnormal_vertex>
      vec3 transformed = position;
      #include <skinning_vertex>
      vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
      viewPosition.xyz += normalize(normalMatrix * objectNormal) * width;
      gl_Position = projectionMatrix * viewPosition;
    }`,
  fragmentShader: `
    uniform vec3 color;
    void main() { gl_FragColor = vec4(color, 1.0); }`,
});

const corner = new THREE.Vector3();
function addOutlineNormals(geometry) {
  if (geometry.getAttribute('outlineNormal')) return;
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const round = value => Math.round(value * 1e4);
  const place = index => `${round(position.getX(index))},${round(position.getY(index))},${round(position.getZ(index))}`;
  const sums = new Map();
  const seen = new Set();
  for (let index = 0; index < position.count; index += 1) {
    const key = place(index);
    // 한 면이 여러 삼각형으로 나뉘어도 같은 방향은 한 번만 더해 평균이 치우치지 않게 한다.
    const facing = `${key}|${Math.round(normal.getX(index) * 100)},${Math.round(normal.getY(index) * 100)},${Math.round(normal.getZ(index) * 100)}`;
    if (seen.has(facing)) continue;
    seen.add(facing);
    if (!sums.has(key)) sums.set(key, new THREE.Vector3());
    sums.get(key).add(corner.fromBufferAttribute(normal, index));
  }
  const values = new Float32Array(position.count * 3);
  for (let index = 0; index < position.count; index += 1) {
    corner.copy(sums.get(place(index)));
    if (corner.lengthSq() < 1e-8) corner.fromBufferAttribute(normal, index);
    corner.normalize().toArray(values, index * 3);
  }
  geometry.setAttribute('outlineNormal', new THREE.BufferAttribute(values, 3));
}

function addRim(material, strength) {
  // 피격 번쩍임: 맞는 순간 몸 전체를 흰빛으로 덮는다. 값은 setHitFlash로 액터마다 바꾼다.
  material.userData.hitFlash = { value: 0 };
  material.userData.hitFlashColor = { value: new THREE.Color('#ffffff') };
  material.onBeforeCompile = shader => {
    shader.uniforms.rimColor = { value: RIM_COLOR.clone().multiplyScalar(strength) };
    shader.uniforms.hitFlash = material.userData.hitFlash;
    shader.uniforms.hitFlashColor = material.userData.hitFlashColor;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 rimColor;\nuniform float hitFlash;\nuniform vec3 hitFlashColor;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float facing = 1.0 - saturate(dot(normal, normalize(vViewPosition)));
        totalEmissiveRadiance += rimColor * diffuseColor.rgb * smoothstep(.58, .72, facing);`)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        gl_FragColor.rgb = mix(gl_FragColor.rgb, hitFlashColor, hitFlash);`);
  };
  material.customProgramCacheKey = () => `actor-rim-${strength}`;
}

export function toonMaterial(source) {
  if (!source || source.isMeshToonMaterial) return source;
  if (toonCache.has(source)) return toonCache.get(source);
  const metal = source.metalness ?? 0;
  const material = new THREE.MeshToonMaterial({
    name: `${source.name || 'actor'} toon`,
    color: source.color?.clone().offsetHSL(0, .04, metal > .5 ? .06 : .02) ?? new THREE.Color('#ffffff'),
    map: source.map ?? null,
    emissive: source.emissive?.clone() ?? new THREE.Color('#000000'),
    emissiveMap: source.emissiveMap ?? null,
    emissiveIntensity: source.emissiveIntensity ?? 1,
    transparent: source.transparent,
    opacity: source.opacity,
    alphaTest: source.alphaTest,
    side: source.side,
    vertexColors: source.vertexColors,
    gradientMap: ramp,
  });
  addRim(material, metal > .5 ? 1.1 : .6);
  toonCache.set(source, material);
  return material;
}

const glowing = material => material.transparent || (material.emissive && material.emissive.getHSL({ h: 0, s: 0, l: 0 }).l > .05);
// 코·입·눈썹처럼 얼굴 위에 얹는 작은 부위는 외곽선이 생기면 덩어리처럼 보여서 제외한다.
const facialDetail = material => /\sdetail$/.test(material.name ?? '');
const box = new THREE.Box3();
const size = new THREE.Vector3();

function attachOutlines(object, outlineMaterial, candidates) {
  if (outlineMaterial.userData.built) return;
  object.updateMatrixWorld(true);
  const material = outlineMaterial.userData.shaderMaterial ?? baseOutline.clone();
  outlineMaterial.userData.shaderMaterial = material;
  material.uniforms.width.value = OUTLINE_WIDTH * (outlineMaterial.userData.scale ?? 1);
  const list = [];
  for (const mesh of candidates) {
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    box.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld).getSize(size);
    if (Math.max(size.x, size.y, size.z) < OUTLINE_MIN_SIZE) continue;
    addOutlineNormals(mesh.geometry);
    let outline;
    if (mesh.isSkinnedMesh) {
      outline = new THREE.SkinnedMesh(mesh.geometry, material);
      outline.bind(mesh.skeleton, mesh.bindMatrix);
    } else outline = new THREE.Mesh(mesh.geometry, material);
    outline.name = `${mesh.name} outline`;
    outline.userData.outline = true;
    outline.raycast = () => {};
    mesh.add(outline);
    list.push(outline);
  }
  outlineMaterial.userData.outlines = list;
  outlineMaterial.userData.built = true;
}

/**
 * 액터 메시를 툰 재질로 바꾸고, 필요할 때 충분히 큰 불투명 부위에 뒷면 외곽선을 붙인다.
 * 저사양(outlines: false)에서는 외곽선 복제와 법선 계산을 생략해 드로우콜과 초기화 시간을 절반 가까이 줄인다.
 */
export function stylizeActor(object, { outlines = true } = {}) {
  const handle = {
    userData: {
      flashTargets: new Set(),
      candidates: [],
      outlines: [],
      built: false,
      shaderMaterial: null,
      scale: 1,
    },
    dispose() {
      this.userData.shaderMaterial?.dispose();
      this.userData.shaderMaterial = null;
    },
  };
  const meshes = [];
  object.traverse(node => { if (node.isMesh && !node.userData.outline) meshes.push(node); });
  for (const mesh of meshes) {
    const sources = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mesh.material = Array.isArray(mesh.material) ? sources.map(toonMaterial) : toonMaterial(mesh.material);
    for (const material of [mesh.material].flat()) if (material.userData.hitFlash) handle.userData.flashTargets.add(material);
    if (sources.some(glowing) || sources.some(facialDetail)) continue;
    handle.userData.candidates.push(mesh);
  }
  if (outlines) attachOutlines(object, handle, handle.userData.candidates);
  return handle;
}

export function setActorOutlines(object, handle, enabled) {
  if (!handle?.userData) return;
  if (enabled && !handle.userData.built) attachOutlines(object, handle, handle.userData.candidates);
  for (const outline of handle.userData.outlines) outline.visible = enabled;
}

export function setOutlineScale(handle, scale) {
  if (!handle?.userData) return;
  handle.userData.scale = scale;
  if (handle.userData.shaderMaterial) handle.userData.shaderMaterial.uniforms.width.value = OUTLINE_WIDTH * scale;
}

/** 액터의 피격 번쩍임 세기(0~1)와 색. stylizeActor가 돌려준 핸들을 쓴다. */
export function setHitFlash(outline, amount, color = '#ffffff') {
  for (const material of outline?.userData?.flashTargets ?? []) {
    material.userData.hitFlash.value = amount;
    if (amount > 0) material.userData.hitFlashColor.value.set(color);
  }
}
