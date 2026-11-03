import backgroundUrl from '../assets/images/title_background.png';
import cleanPlateUrl from '../assets/images/title_cloak_clean_plate.png';

// All coordinates use the approved 1672×941 illustration, independent of viewport.
const WIDTH = 1672;
const HEIGHT = 941;
const CAPE = { x: 835, y: 416, width: 304, height: 270 };
const clamp = (n) => Math.max(0, Math.min(1, n));

function capeOutline() {
  return new Path2D('M1111 428 C1089 435 1051 461 1019 435 L1006 449 L981 475 C935 485 879 519 855 559 L845 577 L842 593 L853 582 L863 579 L871 588 L865 607 L862 627 L866 647 L872 631 L887 620 L895 620 L900 642 L900 654 L908 678 L919 658 L930 647 L937 644 L942 659 L953 642 L966 636 L970 642 L978 632 L991 641 L999 649 C1007 614 1018 599 1027 566 C1044 522 1087 480 1111 428 Z');
}

function surface(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

async function loadImage(path) {
  const image = new Image();
  image.src = path;
  await image.decode();
  return image;
}

function drawTorch(ctx, x, y, scale, t) {
  const flicker = .6 + .18 * Math.sin(t * 11) + .12 * Math.sin(t * 17 + 1);
  const sway = Math.sin(t * 7) * 3 + Math.sin(t * 13) * 1.4;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  const glow = ctx.createRadialGradient(0, -21, 0, 0, -21, 118);
  glow.addColorStop(0, `rgba(255,161,55,${.15 + .1 * flicker})`);
  glow.addColorStop(1, 'rgba(255,157,50,0)');
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = glow;
  ctx.fillRect(-118, -139, 236, 236);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = `rgba(255,153,37,${.56 + flicker * .24})`;
  ctx.beginPath();
  ctx.moveTo(-10, 0);
  ctx.bezierCurveTo(-18, -13, sway - 4, -25, sway - 4, -42 - flicker * 10);
  ctx.bezierCurveTo(sway + 12, -35, 17, -12, 10, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffe4a0d9';
  ctx.beginPath();
  ctx.moveTo(-5, 0);
  ctx.quadraticCurveTo(-9, -11, sway, -26 - flicker * 4);
  ctx.quadraticCurveTo(10, -12, 5, 0);
  ctx.closePath();
  ctx.fill();
  for (let i = 0; i < 3; i++) {
    const progress = (t / (Math.PI * 2) * 4 + i / 3) % 1;
    ctx.fillStyle = `rgba(255,196,87,${Math.sin(progress * Math.PI) * .65})`;
    ctx.fillRect(Math.sin(t * 3 + i * 2.1) * 9, -24 - progress * 66, 2, 3);
  }
  ctx.restore();
}

export async function startTitleScene(canvas, { signal } = {}) {
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) return;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let original;
  let base;
  let cloth;
  let loading;
  let frameId = 0;
  let previous = 0;
  let elapsed = 0;
  let lastDraw = 0;
  let width = innerWidth;
  let height = innerHeight;
  let dpr = 1;
  const stopped = () => signal?.aborted;
  signal?.addEventListener('abort', () => cancelAnimationFrame(frameId), { once: true });

  async function prepare() {
    original ??= await loadImage(backgroundUrl);
    if (stopped()) return;
    if (motion.matches || base) return;
    const plate = await loadImage(cleanPlateUrl);
    if (stopped()) return;
    const outline = capeOutline();
    base = surface(WIDTH, HEIGHT);
    const background = base.getContext('2d');
    background.drawImage(original, 0, 0, WIDTH, HEIGHT);
    background.save();
    background.clip(outline);
    background.drawImage(plate, 0, 0, WIDTH, HEIGHT);
    background.restore();
    cloth = surface(CAPE.width, CAPE.height);
    const fabric = cloth.getContext('2d');
    fabric.translate(-CAPE.x, -CAPE.y);
    fabric.clip(outline);
    fabric.drawImage(original, 0, 0, WIDTH, HEIGHT);
  }

  function draw() {
    if (!original || stopped()) return;
    const scale = Math.max(width / WIDTH, height / HEIGHT);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.translate((width - WIDTH * scale) * .7, (height - HEIGHT * scale) * .5);
    context.scale(scale, scale);
    if (motion.matches || !base) {
      context.drawImage(original, 0, 0, WIDTH, HEIGHT);
      return;
    }
    context.drawImage(base, 0, 0);
    const t = elapsed / 6400 * Math.PI * 2;
    // Narrow strips keep the shoulder pinned while waves travel toward the hem.
    for (let row = 0; row < CAPE.height; row += 2) {
      const worldY = CAPE.y + row;
      const weight = clamp((worldY - 444) / 220);
      const wave = Math.sin(t * 2 - (worldY - 440) / 95);
      const offset = weight * (10 * wave + 3 * Math.sin(t * 3 - worldY / 90));
      context.drawImage(cloth, 0, row, CAPE.width, 2, CAPE.x + offset, worldY, CAPE.width, 2);
    }
    drawTorch(context, 841, 281, 1, t);
    drawTorch(context, 1549, 266, 1.16, t + 1.7);
    drawTorch(context, 1235, 298, .27, t + 3.1);
    drawTorch(context, 1430, 395, .22, t + 4.4);
  }

  function frame(now) {
    if (stopped()) return;
    if (previous) elapsed += Math.min(now - previous, 100);
    previous = now;
    if (now - lastDraw >= 1000 / 30) {
      draw();
      lastDraw = now;
    }
    frameId = requestAnimationFrame(frame);
  }

  function sync() {
    cancelAnimationFrame(frameId);
    if (stopped()) return;
    previous = 0;
    if (!document.hidden && !motion.matches && base) frameId = requestAnimationFrame(frame);
    else draw();
  }

  function resize() {
    if (stopped()) return;
    width = innerWidth;
    height = innerHeight;
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    draw();
  }

  async function updateMotion() {
    if (stopped()) return;
    sync();
    loading ??= prepare().finally(() => { loading = null; });
    try {
      await loading;
      resize();
      sync();
    } catch (error) {
      // Hide the canvas so the CSS still background remains visible.
      cancelAnimationFrame(frameId);
      if (!stopped()) canvas.hidden = true;
      throw error;
    }
  }

  await updateMotion();
  if (stopped()) return;
  addEventListener('resize', resize, { signal });
  document.addEventListener('visibilitychange', sync, { signal });
  motion.addEventListener('change', () => updateMotion().catch(console.warn), { signal });
  addEventListener('pagehide', () => { cancelAnimationFrame(frameId); previous = 0; }, { signal });
  addEventListener('pageshow', sync, { signal });
}
