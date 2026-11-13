import { attackPose, ATTACK_HITS, attackDuration } from './attackTimeline.js';
import { CARD_MOTIONS } from './cardMotions.js';

// Retain the drawing curves while aligning their contact frames to the shared playback.
const INK_HITS = { strike: [780], heavy: [1000], twin: [700, 1100], flare: [1000], nova: [1100] };
function inkTime(type, elapsed) {
  const hits = ATTACK_HITS[type];
  const ink = INK_HITS[type];
  const duration = attackDuration(type);
  let previous = 0, previousInk = 0;
  for (let index = 0; index <= hits.length; index++) {
    const next = hits[index] ?? duration;
    const nextInk = ink[index] ?? 2000;
    if (elapsed <= next) return previousInk + (nextInk - previousInk) * (elapsed - previous) / (next - previous);
    previous = next;
    previousInk = nextInk;
  }
  return 2000;
}

const unit = (t) => Math.max(0, Math.min(1, t));
const fade = (time, start, duration) => time < start ? 0 : Math.sin(Math.PI * unit((time - start) / duration));
export function paintAttack(scene, attack, elapsed) {
  const g = scene.attackInk;
  const { cardType: type, upgraded } = attack.effect;
  const color = attack.color, width = scene.layoutWidth;
  const hx = scene.heroHome.x, ex = scene.enemyHome.x;
  const floor = scene.floor, hy = floor - 48 * scene.actorScale, ey = floor - 46 * scene.actorScale;
  const time = inkTime(type, elapsed);
  const pose = attackPose(type, elapsed);
  g.clear();
  scene.adventurer.setPosition(hx + (ex - hx) * pose.advance, floor + pose.lift).setAngle(pose.lean);
  scene.armAngle = pose.arm;
  scene.paintHero(time);
  const scale = Math.max(.75, Math.min(1.7, scene.actorScale / 1.8));
  const ring = (x, y, radius, alpha, tint = color) => {
    if (alpha <= 0) return;
    g.lineStyle(10 * scale, tint, alpha * .12).strokeCircle(x, y, radius);
    g.lineStyle(2 * scale, tint, alpha).strokeCircle(x, y, radius);
  };
  const sparks = (x, y, start, duration, count = 60, reach = 120, tint = color) => {
    const t = unit((time - start) / duration), alpha = fade(time, start, duration);
    if (!alpha) return;
    for (let i = 0; i < count; i++) {
      const angle = i * 2.39996, distance = t * reach * (.5 + i % 7 / 8) * scale;
      g.fillStyle(i % 6 ? tint : 0xfff7dc, alpha);
      g.fillRect(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance + t * t * 35, (i % 4 ? 2 : 5) * scale, (i % 3 ? 3 : 8) * scale);
    }
  };
  const slash = (start, reverse, tint, size = 1) => {
    const t = unit((time - start) / 420), alpha = fade(time, start, 650);
    if (!alpha) return;
    const radius = 68 * scale * size, angle = reverse ? 2.7 : -.9;
    for (let i = 0; i < 7; i++) {
      g.lineStyle((14 - i * 1.8) * scale, i < 4 ? tint : 0xffffff, alpha * (i < 4 ? .14 : .75));
      g.beginPath().arc(ex, ey, radius + i * 2, angle - .5, angle + .2 + t * 1.9).strokePath();
    }
    sparks(ex, ey, start + 80, 780, 65, 145, tint);
  };
  // Energy gathers visibly before the weapon moves.
  if (time < 700) {
    const t = unit(time / 650);
    ring(hx + 26 * scene.actorScale, hy, 22 + 40 * (1 - t), Math.sin(t * Math.PI) * .8);
    for (let i = 0; i < 30; i++) {
      const a = i * 2.4 + time / 1500, r = (1 - t) * (65 + i % 6 * 9);
      g.fillStyle(i % 4 ? color : 0xffffff, .25 + t * .6).fillCircle(hx + 22 * scene.actorScale + Math.cos(a) * r, hy + Math.sin(a) * r, (1 + i % 3) * scale);
    }
  }
  if (type === 'strike') {
    slash(620, false, color, 1.2);
    const alpha = fade(time, 550, 1050);
    for (let i = 0; i < 12; i++) {
      const t = i / 12, x = hx + (ex - hx) * t;
      g.lineStyle((1 + t * 3) * scale, color, alpha * t * .5).lineBetween(x - 20, ey + 55 - t * 95, x + 30, ey + 20 - t * 65);
    }
    ring(ex, ey, 30 + unit((time - 780) / 700) * 95, fade(time, 780, 850));
  } else if (type === 'heavy') {
    const alpha = fade(time, 760, 700);
    g.lineStyle(20 * scale, color, alpha * .15).lineBetween(ex - 35, ey - 125, ex + 20, floor);
    g.lineStyle(5 * scale, 0xffefc3, alpha).lineBetween(ex - 35, ey - 125, ex + 20, floor);
    const t = unit((time - 1000) / 650), glow = fade(time, 1000, 950);
    for (let i = -5; i <= 5; i++) {
      const x = ex + i * 28 * scale * t, y = floor + Math.abs(i % 3) * 4;
      g.lineStyle(3 * scale, color, glow).beginPath().moveTo(ex, floor).lineTo(x, y).lineTo(x + i * 6, y - 13 * t).strokePath();
      g.fillStyle(0xb7a27a, glow).fillRect(x, floor - Math.sin(t * Math.PI) * (30 + i * i * 2), 9 * scale, 8 * scale);
    }
    ring(ex, floor - 4, 25 + t * 150 * scale, glow);
    sparks(ex, floor - 10, 1000, 950, 110, 150);
  } else if (type === 'twin') {
    slash(550, false, 0xbfe8ff, 1.1); slash(950, true, 0xd5baff, 1.3);
    ring(ex, ey, 40 + unit((time - 1100) / 650) * 70, fade(time, 1100, 800), 0xf2e7ff);
  } else if (type === 'flare') {
    const launch = CARD_MOTIONS.flare.marks.launch;
    const travel = unit((elapsed - launch) / (ATTACK_HITS.flare[0] - launch)), x = hx + (ex - hx) * travel;
    const alpha = fade(time, 450, 850);
    for (let i = 0; i < 8; i++) {
      g.lineStyle((i % 3 ? 3 : 7) * scale, i % 2 ? color : 0xffe9ff, alpha * (1 - i / 10));
      g.beginPath().arc(x - i * 12 * scale, ey, (35 + i * 5) * scale, -1.3, 1.3).strokePath();
    }
    sparks(ex, ey, 950, 1000, 120, 180);
    ring(ex, ey, 20 + unit((time - 1000) / 900) * 150, fade(time, 1000, 1000));
  } else if (type === 'nova') {
    const charge = fade(time, 0, 1600), radius = (25 + 45 * unit(time / 800)) * scale;
    ring(ex, ey, radius, charge);
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4 + time / 1100;
      const x = ex + Math.cos(a) * radius, y = ey + Math.sin(a) * radius;
      g.lineStyle(2 * scale, color, charge).strokeTriangle(x, y - 9, x - 7, y + 5, x + 7, y + 5);
    }
    const beam = fade(time, 900, 720);
    g.fillStyle(color, beam * .15).fillRect(ex - 65 * scale, 0, 130 * scale, floor);
    g.fillStyle(color, beam * .6).fillRect(ex - 20 * scale, 0, 40 * scale, floor);
    g.fillStyle(0xfffbe2, beam).fillRect(ex - 5 * scale, 0, 10 * scale, floor);
    sparks(ex, ey, 1050, 950, 140, 190);
    ring(hx, hy + 25, 60 * scale, fade(time, 1200, 800));
  }
  if (upgraded) {
    const alpha = fade(time, 600, 1400);
    ring(ex, ey, 90 * scale, alpha * .6, 0xffffff);
    sparks(ex, ey, 750, 1200, 50, 220, 0xffffff);
  }
  let recoil = 0;
  for (const age of attack.ages ?? ATTACK_HITS[type].map((at) => elapsed - at)) {
    const t = age / 300;
    if (t >= 0 && t <= 1) recoil += Math.sin(t * Math.PI) * 18 * scale;
  }
  scene.foe.setPosition(ex + recoil, floor).setAngle(recoil * .3);
  scene.enemyFigure.setAlpha(1 - Math.min(.65, recoil / 40));
  return { width, pose };
}
