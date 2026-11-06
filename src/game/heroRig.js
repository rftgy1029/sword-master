import { heroImage } from './spriteAssets.js';

export const HERO_ANCHOR = Object.freeze({ x: 32, y: 61 });
const armOutline = [[27, 27], [31, 27], [34, 31], [36, 30], [51, 19], [55, 19], [55, 23], [38, 35], [37, 39], [33, 38], [30, 35], [28, 33]];
function inside(x, y, polygon) {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [ax, ay] = polygon[i], [bx, by] = polygon[j];
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) result = !result;
  }
  return result;
}

// Every source pixel belongs to exactly one part. The edited face is always body.
export function heroPart(x, y, r, g, b) {
  if (y < 18) return 'body';
  if (y >= 20 && y <= 50 && (x < 23 || (y < 39 && x < 29 && r > g * 1.25 && r > b * 1.2))) return 'cape';
  if (inside(x + .5, y + .5, armOutline)) return 'arm';
  if (y >= 45 && x >= 23) return x < 33 ? 'rearLeg' : 'frontLeg';
  return 'body';
}

export function createHeroRig(image) {
  const source = document.createElement('canvas'); source.width = source.height = 64;
  const ctx = source.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);
  const original = ctx.getImageData(0, 0, 64, 64);
  const names = ['cape', 'rearLeg', 'frontLeg', 'body', 'arm'];
  const parts = Object.fromEntries(names.map((name) => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
    return [name, { canvas, pixels: new ImageData(64, 64) }];
  }));
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const index = (y * 64 + x) * 4;
    if (!original.data[index + 3]) continue;
    const part = heroPart(x, y, ...original.data.slice(index, index + 3));
    parts[part].pixels.data.set(original.data.subarray(index, index + 4), index);
  }
  for (const part of Object.values(parts)) part.canvas.getContext('2d').putImageData(part.pixels, 0, 0);
  return { original: source, ...Object.fromEntries(names.map((name) => [name, parts[name].canvas])) };
}

export function drawHeroRig(ctx, rig, { time = 0, x = 0, y = 0, scale = 1, walking = false, armAngle = 0, motion = true } = {}) {
  const t = motion ? time : 0;
  const stride = walking && motion ? Math.sin(t / 115) : 0;
  ctx.save(); ctx.imageSmoothingEnabled = false;
  ctx.translate(x, y); ctx.scale(scale, scale);
  const draw = (part, angle = 0, px = 32, py = 61, dy = 0) => {
    ctx.save(); ctx.translate(px - 32, py - 61 + dy); ctx.rotate(angle);
    ctx.drawImage(rig[part], -px, -py); ctx.restore();
  };
  // Row-by-row flutter keeps the cloth flexible while preserving sharp pixels.
  for (let row = 0; row < 64; row++) {
    const wave = motion ? Math.round(Math.sin(t / 430 - row * .16) * Math.max(0, row - 20) / 30) : 0;
    ctx.drawImage(rig.cape, 0, row, 64, 1, -32 + wave, row - 61, 64, 1);
  }
  draw('rearLeg', stride * .16, 28, 45, Math.max(0, stride) * -1.5);
  draw('frontLeg', -stride * .16, 37, 45, Math.max(0, -stride) * -1.5);
  if (Math.abs(armAngle) > .02) {
    // The original cel has no hidden torso pixels behind its moving sword arm.
    ctx.fillStyle = '#493c2d';
    ctx.beginPath(); ctx.moveTo(-2, -34); ctx.lineTo(5, -33); ctx.lineTo(6, -23); ctx.lineTo(-2, -24); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#77644d'; ctx.fillRect(-1, -32, 2, 3); ctx.fillRect(1, -29, 2, 2);
    ctx.fillStyle = '#a18a62'; ctx.fillRect(-2, -26, 7, 1);
  }
  draw('body', 0, 32, 61, motion ? Math.sin(t / 530) * .25 : 0);
  draw('arm', armAngle + (walking ? stride * .035 : 0), 30, 28);
  ctx.restore();
}

let loading;
export function loadHeroRig() {
  if (typeof Image === 'undefined') return Promise.resolve(null);
  loading ??= new Promise((resolve) => {
    const image = new Image();
    image.onload = () => { try { resolve(createHeroRig(image)); } catch { resolve(null); } };
    image.onerror = () => resolve(null);
    image.src = heroImage;
  });
  return loading;
}
