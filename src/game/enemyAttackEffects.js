import { enemyAttackPose } from './enemyAttackTimeline.js';
import { monsterFrame } from './spriteAssets.js';

const unit = (value) => Math.max(0, Math.min(1, value));
const fade = (time, start, duration) => time < start ? 0 : Math.sin(Math.PI * unit((time - start) / duration));

export function paintEnemyAttack(scene, attack, time) {
  const { plan, type, effect, ages } = attack, { color, style } = plan;
  const g = scene.attackInk, pose = enemyAttackPose(plan, time);
  const hx = scene.heroHome.x, ex = scene.enemyHome.x, floor = scene.floor;
  const scale = Math.max(.65, Math.min(1.6, scene.actorScale / 1.8));
  const hy = floor - 46 * scene.actorScale, ey = floor - 44 * scene.actorScale;
  g.clear();
  scene.foe.setPosition(ex + (hx - ex) * pose.advance, floor + pose.lift).setAngle(pose.lean);
  scene.foe.setScale(scene.actorScale * (1 + pose.squash), scene.actorScale * (1 - pose.squash));
  scene.enemyPose = pose.pose;
  if (scene.enemyFigure.setFrame) scene.enemyFigure.setFrame(monsterFrame(type, pose.pose));
  scene.adventurer.setPosition(hx - pose.recoil * 15 * scale, floor).setAngle(-pose.recoil * 7);
  scene.heroSprite?.setAlpha(1 - pose.recoil * .35);

  const ring = (x, y, radius, alpha, tint = color) => {
    g.lineStyle(10 * scale, tint, alpha * .12).strokeCircle(x, y, radius);
    g.lineStyle(2 * scale, tint, alpha).strokeCircle(x, y, radius);
  };
  const charge = fade(time, 0, plan.hits[0]);
  ring(ex, ey, (55 - unit(time / 700) * 30) * scale, charge);
  for (let i = 0; i < 24; i++) {
    const angle = i * 2.4 + time / 900, radius = (1 - unit(time / 700)) * (50 + i % 5 * 8) * scale;
    g.fillStyle(i % 4 ? color : 0xffffff, charge * .8).fillCircle(ex + Math.cos(angle) * radius, ey + Math.sin(angle) * radius, (1 + i % 3) * scale);
  }
  for (const [index, at] of plan.hits.entries()) {
    const age = ages?.[index] ?? time - at;
    const alpha = fade(time, at - 130, 650), impact = unit(age / 600);
    if (plan.ranged) {
      const travel = unit((time - at + 400) / 400), projectileAlpha = fade(time, at - 430, 540);
      const x = ex + (hx - ex) * travel, y = ey + (hy - ey) * travel - Math.sin(travel * Math.PI) * (style === 'spore' ? 60 : 20) * scale;
      for (let trail = 8; trail >= 0; trail--) {
        const tx = x + trail * 9 * scale;
        g.fillStyle(color, projectileAlpha * (1 - trail / 10) * .55).fillCircle(tx, y + Math.sin(time / 80 + trail) * 4, (18 - trail) * scale);
      }
      g.fillStyle(0xfff5d7, projectileAlpha).fillCircle(x, y, 6 * scale);
      if (style === 'frost') for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3 + time / 300;
        g.lineStyle(2 * scale, 0xe5fbff, projectileAlpha).lineBetween(x, y, x + Math.cos(a) * 27 * scale, y + Math.sin(a) * 27 * scale);
      }
      if (style === 'spore') for (let i = 0; i < 10; i++) {
        g.fillStyle(color, projectileAlpha * .6).fillCircle(x + Math.sin(i * 4.7) * 30 * scale, y + Math.cos(i * 2.4) * 24 * scale, (2 + i % 4) * scale);
      }
    } else if (['slam', 'ram', 'bounce'].includes(style)) {
      const sweep = unit((time - at + 170) / 230);
      if (style === 'slam') {
        g.lineStyle(22 * scale, color, alpha * .17).lineBetween(hx + 30 * scale, hy - 95 * scale, hx, floor);
        g.lineStyle(5 * scale, 0xffe5bc, alpha).lineBetween(hx + 30 * scale, hy - 95 * scale, hx, floor);
      }
      ring(hx, floor - 4, (12 + sweep * 75) * scale, alpha);
      for (let i = -4; i <= 4; i++) {
        const x = hx + i * 22 * impact * scale;
        g.lineStyle(2 * scale, color, alpha).lineBetween(hx, floor, x, floor - Math.abs(i % 2) * 9);
        g.fillStyle(color, alpha * .8).fillRect(x, floor - Math.sin(Math.PI * impact) * (25 + Math.abs(i) * 12) * scale, 6 * scale, 8 * scale);
      }
    } else {
      // Claws, blades and wings cross the hero rather than slashing empty space.
      const sweep = unit((time - at + 140) / 320), reverse = index % 2 ? -1 : 1;
      for (let claw = 0; claw < (style === 'blade' ? 1 : 3); claw++) {
        const x = hx + (claw - 1) * 15 * scale, radius = (49 + claw * 6) * scale;
        g.lineStyle(13 * scale, color, alpha * .13).beginPath().arc(x, hy, radius, -.9 * reverse, (-.8 + sweep * 2) * reverse, reverse < 0).strokePath();
        g.lineStyle(3 * scale, color, alpha).beginPath().arc(x, hy, radius, -.9 * reverse, (-.8 + sweep * 2) * reverse, reverse < 0).strokePath();
      }
    }
    const flash = fade(age, 0, 280);
    ring(hx, hy, (15 + impact * 100) * scale, fade(age, 0, 620));
    g.fillStyle(color, flash * .18).fillRect(hx - 45 * scale, hy - 55 * scale, 90 * scale, 110 * scale);
    const blocked = effect.impacts?.[index] === 0;
    if (blocked) ring(hx, hy, 42 * scale, fade(age, 0, 480), 0xb7f4ef);
    for (let i = 0; i < 45; i++) {
      const a = i * 2.39996, distance = impact * (40 + i % 7 * 14) * scale;
      g.fillStyle(i % 4 ? (blocked ? 0xb7f4ef : color) : 0xffffff, fade(age, 0, 700));
      g.fillRect(hx + Math.cos(a) * distance, hy + Math.sin(a) * distance + impact * impact * 30, 3 * scale, (i % 3 ? 3 : 7) * scale);
    }
  }
  if (scene.playerFalling) {
    const fall = unit((time - plan.hits.at(-1) - 180) / 450);
    scene.adventurer.setAngle(-65 * fall).setAlpha(1 - .8 * fall).setY(floor + 12 * fall);
    scene.heroShadow.setAlpha(.7 * (1 - fall));
  }
}
