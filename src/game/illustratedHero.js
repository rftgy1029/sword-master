import { heroPoses } from './spriteAssets.js';

// Each pose is a complete painting. Keep its face, anatomy and weapon intact.
export const HERO_ART_SIZE = 314;
export const HERO_SURFACE_SCALE = 4;
export const HERO_BASELINE = .91;

export function heroPose({ walking = false, armAngle = 0 } = {}) {
  if (armAngle < -.3) return 1;
  if (armAngle > .3) return 2;
  return walking ? 3 : 0;
}

export function createHeroRig(image) {
  return { image, frameSize: image.naturalHeight || image.height };
}

export function drawHeroRig(ctx, rig, { time = 0, x = 0, y = 0, scale = 1, walking = false, armAngle = 0, motion = true } = {}) {
  const frame = heroPose({ walking, armAngle });
  const stride = walking && motion ? Math.sin(time / 115) : 0;
  const breath = motion ? Math.sin(time / 600) * .2 : 0;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.translate(x, y + (breath - Math.abs(stride) * .65) * scale);
  ctx.scale(scale, scale);
  ctx.rotate(stride * .012);
  ctx.drawImage(rig.image, frame * rig.frameSize, 0, rig.frameSize, rig.frameSize, -32, -64 * HERO_BASELINE, 64, 64);
  ctx.restore();
}

let loading;
export function loadHeroRig() {
  if (typeof Image === 'undefined') return Promise.resolve(null);
  loading ??= new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(createHeroRig(image));
    image.onerror = () => { loading = undefined; resolve(null); };
    image.src = heroPoses;
  });
  return loading;
}
