// Extract game frames from the generated artwork without repainting the source.
// Requires ImageMagick (convert, identify). The original PNG is retained.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = join(root, 'assets/source/characters-illustrated.png');
const output = join(root, 'assets/illustrations');
const [width, height] = execFileSync('identify', ['-format', '%w %h', source], { encoding: 'utf8' }).split(' ').map(Number);
const cell = Math.ceil(Math.max(width, height) / 4);
const names = ['crawler', 'sentinel', 'ember', 'bat', 'slime', 'mushroom', 'scarab', 'wisp', 'hound', 'ravager', 'watcher', 'boss'];
const temporary = mkdtempSync(join(tmpdir(), 'sword-master-art-'));
mkdirSync(output, { recursive: true });
try {
  const cells = Array.from({ length: 16 }, (_, index) => {
    const col = index % 4, row = Math.floor(index / 4);
    const x = Math.round(col * width / 4), y = Math.round(row * height / 4);
    const w = Math.round((col + 1) * width / 4) - x, h = Math.round((row + 1) * height / 4) - y;
    const path = join(temporary, `${index}.png`);
    execFileSync('convert', [source, '-crop', `${w}x${h}+${x}+${y}`, '+repage', '-background', 'none', '-gravity', 'NorthWest', '-extent', `${cell}x${cell}`, path]);
    return path;
  });
  const webp = ['-quality', '94', '-define', 'webp:alpha-quality=100'];
  // Derive each foot / tail anchor from visible alpha, ignoring faint glow.
  // This keeps grounded creatures on the floor despite different blank margins.
  const baselines = cells.map((path) => {
    const bounds = execFileSync('convert', [path, '-alpha', 'extract', '-threshold', '30%', '-format', '%@', 'info:'], { encoding: 'utf8' }).match(/(\d+)x(\d+)\+(\d+)\+(\d+)/);
    if (!bounds) throw new Error(`Cannot locate character silhouette: ${path}`);
    return (Number(bounds[2]) + Number(bounds[4])) / cell;
  });
  execFileSync('convert', [cells[0], ...webp, join(output, 'hero.webp')]);
  execFileSync('convert', [...cells.slice(0, 4), '+append', ...webp, join(output, 'hero-poses.webp')]);
  const rows = [1, 2, 3].map((row) => {
    const path = join(temporary, `row-${row}.png`);
    execFileSync('convert', [...cells.slice(row * 4, row * 4 + 4), '+append', path]);
    return path;
  });
  execFileSync('convert', [...rows, '-append', ...webp, join(output, 'monsters.webp')]);
  const frames = Object.fromEntries(names.map((name, index) => [name, {
    frame: { x: index % 4 * cell, y: Math.floor(index / 4) * cell, w: cell, h: cell },
    rotated: false, trimmed: false, spriteSourceSize: { x: 0, y: 0, w: cell, h: cell }, sourceSize: { w: cell, h: cell },
    pivot: { x: .5, y: baselines[index + 4] },
  }]));
  writeFileSync(join(output, 'monsters.json'), JSON.stringify({ frames, meta: { image: 'monsters.webp', size: { w: cell * 4, h: cell * 3 }, scale: '1' } }, null, 2) + '\n');
  console.log(`Exported four ${cell}px hero poses and ${names.length} transparent monster illustrations.`);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
