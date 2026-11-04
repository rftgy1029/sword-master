// Small, layered pixel scene. Every coordinate belongs to a 384 × 288 grid.
// Walls are cached once; the cloth and torch pixels are painted independently.
const WIDTH = 384;
const HEIGHT = 288;
const COLORS = {
  background: '#151919', wall: '#222b2a', mortar: '#192321',
  stone: ['#28332f', '#2c3732', '#303a34', '#26312f'],
  edge: '#424b3e', moss: '#566147', dark: '#101a1b',
  cloak: '#98634b', cloakShade: '#714b3f', cloakLight: '#b17b56',
};

function masonry(ctx) {
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = COLORS.mortar;
  ctx.fillRect(28, 28, 332, 208);
  for (let row = 0; row < 8; row++) {
    for (let column = 0; column < 8; column++) {
      const x = 29 + column * 46 - (row % 2) * 23;
      const y = 30 + row * 26;
      const left = Math.max(29, x);
      const right = Math.min(359, x + 44);
      if (right <= left) continue;
      ctx.fillStyle = COLORS.stone[(row * 3 + column * 7) % 4];
      ctx.fillRect(left, y, right - left, 24);
      ctx.fillStyle = '#364035';
      ctx.fillRect(left + 2, y, Math.max(0, right - left - 4), 1);
    }
  }
  // Side pillars and capstones use the same two-pixel steps as the entrance.
  for (const x of [28, 340]) {
    ctx.fillStyle = '#182321';
    ctx.fillRect(x, 32, 20, 202);
    for (let row = 0; row < 8; row++) {
      ctx.fillStyle = row % 3 === 0 ? '#354033' : '#303a31';
      ctx.fillRect(x, 34 + row * 25, 18, 23);
      ctx.fillStyle = '#46503d';
      ctx.fillRect(x, 34 + row * 25, 18, 2);
    }
    ctx.fillStyle = '#414a3a';
    ctx.fillRect(x - 4, 26, 26, 8);
    ctx.fillRect(x - 4, 228, 26, 8);
  }
  ctx.fillStyle = '#1d2826';
  ctx.fillRect(48, 26, 292, 4);
  ctx.fillStyle = '#394432';
  for (const [x, y, w] of [[65, 56, 14], [77, 58, 8], [113, 82, 10], [152, 31, 17], [311, 58, 13], [322, 60, 7], [51, 188, 10]]) {
    ctx.fillRect(x, y, w, 2);
    ctx.fillRect(x + 3, y + 2, 3, 3);
  }
}

function doorway(ctx) {
  const stones = [
    [232, 114, 17, 28], [231, 144, 18, 29], [232, 175, 17, 29], [231, 206, 18, 30],
    [314, 114, 17, 28], [314, 144, 18, 29], [314, 175, 17, 29], [314, 206, 18, 30],
    [236, 99, 19, 14], [246, 85, 18, 15], [262, 77, 17, 15],
    [280, 77, 18, 15], [298, 85, 18, 15], [308, 99, 19, 14],
  ];
  ctx.fillStyle = '#111b1c';
  ctx.fillRect(249, 111, 65, 125);
  ctx.fillRect(255, 99, 53, 14);
  ctx.fillRect(264, 91, 35, 10);
  ctx.fillStyle = '#17262a';
  ctx.fillRect(257, 117, 49, 119);
  ctx.fillStyle = '#1e3032';
  ctx.fillRect(266, 143, 32, 93);
  ctx.fillStyle = '#142326';
  ctx.fillRect(273, 158, 18, 77);
  ctx.fillStyle = '#30413b';
  ctx.fillRect(265, 143, 2, 89);
  ctx.fillRect(265, 142, 32, 2);
  ctx.fillStyle = '#2c3d38';
  ctx.fillRect(256, 224, 50, 3);
  ctx.fillRect(256, 230, 50, 3);
  stones.forEach(([x, y, width, height], index) => {
    ctx.fillStyle = index % 3 === 0 ? '#4c5442' : '#414b3c';
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle = '#62694d';
    ctx.fillRect(x, y, width, 2);
    ctx.fillStyle = '#303c32';
    ctx.fillRect(x + width - 2, y + 2, 2, height - 2);
  });
  ctx.fillStyle = '#727251';
  ctx.fillRect(276, 75, 10, 15);
  ctx.fillStyle = '#a4925b';
  ctx.fillRect(279, 78, 4, 4);
}

function floor(ctx) {
  ctx.fillStyle = '#1d2724';
  ctx.fillRect(20, 236, 348, 38);
  for (let row = 0; row < 3; row++) {
    for (let column = 0; column < 12; column++) {
      const x = 21 + column * 32 - (row % 2) * 16;
      const y = 239 + row * 12;
      const left = Math.max(21, x);
      const width = Math.min(367, x + 30) - left;
      if (width <= 0) continue;
      ctx.fillStyle = (row + column) % 3 === 0 ? '#30392b' : '#29332a';
      ctx.fillRect(left, y, width, 10);
    }
  }
  ctx.fillStyle = '#50573e';
  ctx.fillRect(20, 235, 348, 3);
  ctx.fillStyle = '#222c26';
  ctx.fillRect(16, 270, 356, 5);
  ctx.fillStyle = '#1c2421';
  ctx.fillRect(16, 275, 356, 3);
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(16, 278, 356, 10);
  ctx.fillRect(16, 270, 12, 8);
  ctx.fillRect(360, 270, 12, 8);
  ctx.fillStyle = '#4b5638';
  ctx.fillRect(49, 233, 12, 2);
  ctx.fillRect(56, 231, 3, 3);
  ctx.fillRect(323, 233, 16, 2);
  ctx.fillRect(326, 231, 4, 3);
  ctx.fillStyle = '#131e1c';
  ctx.fillRect(118, 237, 48, 4);
}

function hero(ctx, milliseconds) {
  ctx.save();
  ctx.translate(124, 168);
  ctx.scale(2, 2);
  const rect = (x, y, width, height, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, height);
  };
  // Two boots, trousers, tunic. Feet remain on the same ground plane.
  rect(5, 20, 6, 9, '#333b31');
  rect(11, 20, 5, 9, '#3f4536');
  rect(4, 28, 5, 5, '#392f29');
  rect(12, 28, 4, 5, '#483b2f');
  rect(3, 32, 6, 2, '#272a24');
  rect(12, 32, 6, 2, '#272a24');
  rect(5, 11, 10, 11, '#65664a');
  rect(10, 12, 4, 8, '#7c7a54');
  rect(5, 20, 10, 2, '#493c30');
  rect(11, 20, 2, 2, '#b9a16a');
  // Separate cloth rows allow the lower hem to sway by one source pixel.
  const leftEdge = [4, 3, 2, 2, 1, 0, -1, -2, -3, -3, -4, -5, -5, -3, -4, -2, 0];
  const rightEdge = [11, 10, 10, 9, 9, 8, 8, 8, 7, 7, 7, 6, 6, 5, 4, 3, 1];
  leftEdge.forEach((left, index) => {
    const movement = Math.round(Math.sin(milliseconds / 760 - index * .14) * index / 16);
    const y = 11 + index;
    const x = left + movement;
    rect(x, y, rightEdge[index] - left, 1, COLORS.cloak);
    rect(x, y, Math.min(2, rightEdge[index] - left), 1, COLORS.cloakShade);
    if (index < 13) rect(x + 3, y, 2, 1, COLORS.cloakLight);
  });
  rect(4, 9, 10, 3, COLORS.cloakShade);
  rect(3, 10, 11, 2, COLORS.cloak);
  rect(5, 9, 8, 1, COLORS.cloakLight);
  // Hair and face are not part of the animated cloth.
  rect(5, 1, 7, 1, '#594735');
  rect(3, 2, 10, 6, '#473c30');
  rect(2, 3, 3, 3, '#473c30');
  rect(4, 1, 3, 2, '#473c30');
  rect(9, 4, 5, 5, '#b4986b');
  rect(12, 5, 3, 2, '#d0b482');
  rect(9, 4, 3, 2, '#473c30');
  rect(10, 8, 4, 1, '#8d7655');
  rect(6, 2, 5, 1, '#69543c');
  // Arm, gauntlet, sword: a few readable blocks, no painted texture.
  rect(13, 12, 3, 7, '#838369');
  rect(14, 14, 2, 2, '#b1ab83');
  rect(15, 18, 2, 3, '#515848');
  rect(15, 20, 3, 2, '#c2a573');
  for (let index = 0; index < 9; index++) {
    rect(18 + index, 18 - index, 2, 2, '#78867c');
    rect(18 + index, 18 - index, 1, 1, '#c7ccaf');
  }
  rect(17, 20, 5, 1, '#a68b52');
  rect(18, 21, 1, 3, '#564532');
  ctx.restore();
}

function torch(ctx, x, y, milliseconds, phase) {
  const step = (Math.floor(milliseconds / 180) + phase) % 4;
  // Square light falloff respects the scene's pixel grid.
  ctx.fillStyle = `rgba(211,174,99,${.018 + step * .004})`;
  ctx.fillRect(x - 25, y - 25, 50, 48);
  ctx.fillStyle = `rgba(211,174,99,${.025 + step * .005})`;
  ctx.fillRect(x - 14, y - 17, 28, 31);
  ctx.fillStyle = '#30372c';
  ctx.fillRect(x - 2, y + 4, 5, 10);
  ctx.fillRect(x - 1, y + 11, 7, 3);
  ctx.fillStyle = '#756444';
  ctx.fillRect(x - 4, y + 2, 9, 3);
  const lean = [0, 1, 0, -1][step];
  ctx.fillStyle = '#ad713f';
  ctx.fillRect(x - 3, y - 6, 7, 8);
  ctx.fillRect(x + lean - 1, y - 11, 3, 7);
  ctx.fillStyle = '#dfac5e';
  ctx.fillRect(x - 2, y - 6, 5, 7);
  ctx.fillRect(x + lean, y - 9, 2, 5);
  ctx.fillStyle = '#f1d899';
  ctx.fillRect(x, y - 3, 2, 4);
  const ember = (milliseconds / 2400 + phase / 3) % 1;
  ctx.fillStyle = `rgba(223,172,94,${Math.sin(ember * Math.PI) * .45})`;
  ctx.fillRect(x + lean * 2, Math.round(y - 12 - ember * 12), 1, 1);
}

export async function startTitleScene(canvas, { signal, motionPreference = 'normal' } = {}) {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx || signal?.aborted) return;
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  ctx.imageSmoothingEnabled = false;
  const background = document.createElement('canvas');
  background.width = WIDTH;
  background.height = HEIGHT;
  const staticContext = background.getContext('2d', { alpha: false });
  masonry(staticContext);
  doorway(staticContext);
  floor(staticContext);

  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const isStatic = () => motion.matches || motionPreference === 'off';
  const speed = motionPreference === 'reduced' ? .35 : 1;
  const paintInterval = 1000 / (motionPreference === 'reduced' ? 12 : 24);
  let frameId = 0;
  let previous = null;
  let elapsed = 0;
  let lastPaint = -Infinity;

  function paint() {
    ctx.drawImage(background, 0, 0);
    const time = isStatic() ? 0 : elapsed * speed;
    torch(ctx, 209, 137, time, 0);
    torch(ctx, 351, 137, time, 2);
    hero(ctx, time);
  }
  function frame(now) {
    if (signal?.aborted) return;
    if (previous !== null) elapsed += Math.min(now - previous, 100);
    previous = now;
    if (now - lastPaint >= paintInterval) {
      paint();
      lastPaint = now;
    }
    frameId = requestAnimationFrame(frame);
  }
  function sync() {
    cancelAnimationFrame(frameId);
    previous = null;
    if (signal?.aborted) return;
    paint();
    if (!document.hidden && !isStatic()) frameId = requestAnimationFrame(frame);
  }
  signal?.addEventListener('abort', () => cancelAnimationFrame(frameId), { once: true });
  document.addEventListener('visibilitychange', sync, { signal });
  motion.addEventListener('change', sync, { signal });
  addEventListener('pagehide', () => { cancelAnimationFrame(frameId); previous = null; }, { signal });
  addEventListener('pageshow', sync, { signal });
  sync();
}
