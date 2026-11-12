import Phaser from 'phaser';
import { hero } from '../scene.js';
import { drawingContext } from './phaserDrawing.js';
import { battleMapForMonster, createMapLayers, preloadMap } from './mapAssets.js';
import { CARD_MOTIONS } from './cardMotions.js';
import { MONSTERS } from './catalog.js';
import { ATTACK_HITS, ATTACK_DURATION, impactsCrossed } from './attackTimeline.js';
import { paintAttack } from './attackEffects.js';
import { heroImage, monsterSheet, monsterFrame } from './spriteAssets.js';
import { createHeroRig, drawHeroRig } from './heroRig.js';
import { enemyAttackPlan, enemyImpactsCrossed } from './enemyAttackTimeline.js';
import { paintEnemyAttack } from './enemyAttackEffects.js';

function monster(ctx, art) {
  const rect = (x, y, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
  if (art === 'crawler') {
    rect(2, 25, 34, 15, '#465540'); rect(6, 20, 25, 12, '#63704c');
    rect(0, 32, 8, 5, '#859062'); rect(32, 32, 8, 5, '#859062');
    for (const x of [4, 14, 26, 32]) rect(x, 40, 4, 7, '#858267');
    rect(7, 30, 4, 3, '#dfb975'); rect(24, 30, 4, 3, '#dfb975');
    rect(12, 38, 13, 2, '#202b26'); rect(17, 21, 4, 5, '#98a169');
  } else if (art === 'ember') {
    rect(8, 16, 23, 27, '#65554c'); rect(4, 26, 31, 12, '#4b4840');
    rect(11, 8, 17, 12, '#8b6e4b'); rect(14, 11, 12, 9, '#1c2726');
    rect(16, 15, 3, 2, '#e6b56c'); rect(23, 15, 3, 2, '#e6b56c');
    rect(16, 25, 7, 10, '#d49c55'); rect(18, 23, 3, 9, '#f0d997');
    for (const x of [7, 15, 26]) rect(x, 42, 4, 4, '#7a6250');
  } else {
    const boss = art === 'boss';
    rect(7, 12, 27, 29, boss ? '#756548' : '#666d5a');
    rect(3, 17, 8, 20, '#414e45'); rect(30, 17, 8, 20, '#414e45');
    rect(10, 2, 20, 15, '#85866b'); rect(12, 6, 16, 8, '#293632');
    rect(13, 8, 5, 2, '#dbba75'); rect(23, 8, 4, 2, '#dbba75');
    rect(14, 19, 12, 3, '#a79a65'); rect(18, 22, 4, 12, '#4a5143');
    rect(9, 40, 8, 8, '#3c463e'); rect(24, 40, 8, 8, '#3c463e');
    rect(35, 8, 3, 27, '#a4a78b'); rect(32, 33, 10, 3, '#a78c55');
    if (boss) {
      rect(8, -4, 4, 10, '#b49b5c'); rect(28, -4, 4, 10, '#b49b5c');
      rect(17, -6, 7, 10, '#c6a768'); rect(18, -3, 4, 4, '#e4cc8b');
      rect(0, 22, 4, 18, '#805b48'); rect(36, 22, 4, 18, '#805b48');
    }
  }
}

function drawArena(ctx, w, h) {
  const floor = Math.round(h * .86);
  const rect = (x, y, rw, rh, color) => { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), rw, rh); };
  rect(0, 0, w, h, '#17201e');
  for (let row = 0; row * 26 < floor; row++) for (let col = 0; col * 40 < w + 40; col++) {
    rect(col * 40 - (row % 2) * 20, row * 26, 38, 24, (row + col) % 3 ? '#25302b' : '#2a342d');
  }
  for (let x = 20; x < w; x += 160) {
    rect(x, 0, 20, floor, '#323d32'); rect(x + 2, 0, 3, floor, '#48513c');
  }
  rect(0, floor, w, h - floor, '#30382a');
  for (let x = 0; x < w; x += 44) rect(x, floor + 11, 42, 2, '#404732');
  for (const x of [w * .12, w * .86]) {
    const y = Math.max(28, floor - 65);
    rect(x, y, 5, 15, '#756444'); rect(x - 2, y - 8, 9, 9, '#b98149');
    rect(x, y - 11, 5, 10, '#e4b466'); rect(x + 1, y - 5, 3, 6, '#f1d899');
  }
}

// The background, actors, shadows and skill effects have independent transforms.
export function startCombatScene(parent, monsterType, { initialEffectId = 0, onBusy = () => {}, onReady = () => {}, onImpact = () => {} } = {}) {
  let disposed = false;
  const backgroundAsset = battleMapForMonster(monsterType);
  let state = null;
  let lastEffectId = initialEffectId;
  const reduced = () => state?.motion !== 'normal' || matchMedia('(prefers-reduced-motion: reduce)').matches;

  class BattleScene extends Phaser.Scene {
    constructor() { super('battle'); }
    preload() {
      preloadMap(this, backgroundAsset);
      this.load.spritesheet('monster-art', monsterSheet, { frameWidth: 64, frameHeight: 64 });
      this.load.image('hero-art', heroImage);
    }
    create() {
      this.tweens.setLagSmooth();
      if (disposed) return;
      this.stage = this.add.container();
      this.background = this.add.container();
      const tiled = createMapLayers(this, backgroundAsset, ['Masonry and floor', 'Architecture and lights']);
      if (tiled) {
        tiled.layers.forEach((layer) => layer.setSkipCull(true));
        this.background.add(tiled.layers);
        this.mainMapLayers = tiled.layers;
        this.mapWidth = tiled.map.widthInPixels; this.mapHeight = tiled.map.heightInPixels;
        this.mapRepeats = [];
      } else {
        this.fallbackBackground = this.add.graphics();
        this.background.add(this.fallbackBackground);
      }
      this.atmosphere = this.add.container();
      this.heroShadow = this.add.ellipse(0, 0, 45, 5, 0x071611, .7);
      this.enemyShadow = this.add.ellipse(0, 0, 54, 6, 0x071611, .7);
      this.adventurer = this.add.container();
      this.heroFigure = this.add.graphics();
      this.adventurer.add(this.heroFigure);
      if (this.textures.exists('hero-art')) {
        this.heroRig = createHeroRig(this.textures.get('hero-art').getSourceImage());
        this.heroSurface = this.textures.createCanvas('hero-animated', 128, 128);
        this.heroSprite = this.add.image(0, 0, 'hero-animated').setOrigin(.5, 112 / 128).setScale(1.5);
        this.adventurer.add(this.heroSprite); this.heroFigure.setVisible(false);
      }
      this.foe = this.add.container();
      const enemyFigure = this.textures.exists('monster-art')
        ? this.add.image(0, 0, 'monster-art', monsterFrame(monsterType)).setOrigin(.5, ['ember', 'watcher', 'wisp', 'bat'].includes(monsterType) ? 1 : 58 / 64).setScale(1.8).setFlipX(monsterType === 'hound')
        : this.add.graphics();
      if (!this.textures.exists('monster-art')) {
        const ctx = drawingContext(enemyFigure);
        ctx.save(); ctx.translate(-40, -96); ctx.scale(2, 2);
        monster(ctx, MONSTERS[monsterType].art); ctx.restore();
      }
      this.foe.add(enemyFigure);
      this.enemyFigure = enemyFigure;
      this.fx = this.add.container();
      this.attackInk = this.add.graphics();
      this.stage.add([this.background, this.atmosphere, this.heroShadow, this.enemyShadow, this.adventurer, this.foe, this.fx, this.attackInk]);
      this.scale.on(Phaser.Scale.Events.RESIZE, this.redraw, this);
      this.events.once(Phaser.Scenes.Events.DESTROY, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.redraw, this));
      this.redraw(this.scale.gameSize);
      this.sync();
      this.game.events.once(Phaser.Core.Events.POST_RENDER, () => {
        if (!disposed) onReady();
      });
    }
    redraw({ width, height }) {
      if (disposed || !this.background) return;
      this.cameras.main.setViewport(0, 0, width, height);
      if (this.finishEffect) {
        this.pendingLayout = { width, height };
        const scale = Math.min(width / this.layoutWidth, height / this.layoutHeight);
        this.stage.setScale(scale).setPosition((width - this.layoutWidth * scale) / 2, (height - this.layoutHeight * scale) / 2);
        return;
      }
      this.stage.setScale(1).setPosition(0, 0);
      this.layoutWidth = width; this.layoutHeight = height;
      const w = Math.max(1, Math.round(width / 2)), h = Math.max(1, Math.round(height / 2));
      if (this.fallbackBackground) {
        this.background.setPosition(0, 0).setScale(width / w, height / h);
        this.fallbackBackground.clear();
        drawArena(drawingContext(this.fallbackBackground), w, h);
      } else {
        // Keep source pixels square; repeat the map sideways when the arena is wide.
        const scale = height / this.mapHeight;
        const repeats = Math.max(0, Math.ceil((width / scale - this.mapWidth) / (2 * this.mapWidth)));
        while (this.mapRepeats.length < repeats) {
          const pair = [0, 1].flatMap(() => {
            const copy = createMapLayers(this, backgroundAsset, ['Masonry and floor', 'Architecture and lights']);
            return copy.layers.map((layer) => layer.setSkipCull(true));
          });
          this.background.add(pair);
          this.mapRepeats.push(pair);
        }
        this.mainMapLayers.forEach((layer) => layer.setPosition(repeats * this.mapWidth, 0));
        this.mapRepeats.forEach((pair, index) => pair.forEach((layer, sideIndex) => {
          const x = (repeats + (sideIndex < 2 ? -index - 1 : index + 1)) * this.mapWidth;
          layer.setPosition(x, 0).setVisible(index < repeats);
        }));
        this.background.setPosition((width - this.mapWidth * scale) / 2 - repeats * this.mapWidth * scale, 0).setScale(scale);
      }
      this.floor = height * .86;
      this.actorScale = Math.min(3.3, Math.max(1, (this.floor - 136) / 102));
      this.heroHome = { x: width * .24, y: this.floor };
      this.enemyHome = { x: width * .74, y: this.floor };
      this.adventurer.setPosition(this.heroHome.x, this.floor).setScale(this.actorScale);
      this.foe.setPosition(this.enemyHome.x, this.floor).setScale(this.actorScale);
      this.heroShadow.setPosition(this.heroHome.x, this.floor + 2).setScale(this.actorScale);
      this.enemyShadow.setPosition(this.enemyHome.x, this.floor + 2).setScale(this.actorScale);
      this.atmosphere.removeAll(true);
      this.motes = Array.from({ length: 42 }, (_, i) => {
        const dot = this.add.circle((i * 131.7) % width, (i * 73.9) % height, i % 3 ? 1.2 : 2, i % 2 ? 0xd8b574 : 0x88bda2, .3);
        this.atmosphere.add(dot);
        return { dot, x: dot.x, y: dot.y, phase: i * 1.7 };
      });
    }
    paintHero(time) {
      if (this.heroSprite) {
        const ctx = this.heroSurface.context;
        ctx.clearRect(0, 0, 128, 128);
        drawHeroRig(ctx, this.heroRig, { time, x: 64, y: 112, armAngle: this.armAngle ?? 0, motion: !reduced() });
        this.heroSurface.refresh();
        return;
      }
      this.heroFigure.clear();
      const ctx = drawingContext(this.heroFigure);
      ctx.save(); ctx.translate(-144, -236); hero(ctx, time, false, this.armAngle ?? 0); ctx.restore();
    }
    update(time, delta) {
      if (!this.heroFigure || disposed) return;
      const still = reduced();
      this.paintHero(still ? 0 : time);
      const breath = still ? 0 : Math.sin(time / 470);
      this.heroFigure.setPosition(0, breath * .65).setScale(1, 1 + breath * .009);
      if (this.heroSprite) this.heroSprite.setY(breath * .65).setScale(1.5, 1.5 + breath * .012);
      const ghost = ['ember', 'watcher', 'wisp', 'bat'].includes(monsterType);
      const crawl = monsterType === 'crawler';
      this.enemyFigure.y = still ? 0 : ghost ? Math.sin(time / 390) * 3.5 - 3 : Math.sin(time / 580) * (crawl ? .8 : .45);
      const enemyScale = this.enemyFigure.setFrame ? 1.8 : 1;
      this.enemyFigure.scaleY = enemyScale * (still ? 1 : 1 + Math.sin(time / (crawl ? 270 : 550)) * (crawl ? .025 : .012));
      this.enemyFigure.rotation = still ? 0 : Math.sin(time / 750) * (ghost ? .025 : .005);
      if (this.enemyFigure.setFrame) {
        const action = this.enemyPose ?? (this.attack && this.attack.elapsed > 700 && this.attack.elapsed < 1450 ? 5 : 0);
        this.enemyFigure.setFrame(monsterFrame(monsterType, action || (still ? 0 : Math.floor(time / 440) % 2)));
      }
      for (const mote of this.motes ?? []) {
        mote.dot.setVisible(!still);
        if (!still) mote.dot.setPosition(mote.x + Math.sin(time / 1900 + mote.phase) * 18, mote.y + Math.sin(time / 2300 + mote.phase) * 24)
          .setAlpha(.12 + (Math.sin(time / 800 + mote.phase) + 1) * .13);
      }
      if (this.attack) {
        const attack = this.attack;
        const before = attack.elapsed;
        attack.elapsed = Math.min(ATTACK_DURATION, before + (delta ?? 16));
        paintAttack(this, attack, attack.elapsed);
        for (const impact of impactsCrossed(attack.effect.cardType, before, attack.elapsed)) {
          onImpact(impact.index);
          const amount = attack.effect.impacts?.[impact.index] ?? Math.round(attack.effect.amount / ATTACK_HITS[attack.effect.cardType].length);
          const number = this.add.text(this.enemyHome.x, this.floor - 75 * this.actorScale, '−' + amount,
            { fontFamily: 'Cormorant, serif', fontSize: '38px', color: '#fff1ac', stroke: '#17251d', strokeThickness: 4 }).setOrigin(.5);
          this.transient(number, 700, { y: number.y - 45 });
          if (attack.effect.cardType === 'heavy' || attack.effect.cardType === 'nova') this.cameras.main.shake(100, .003);
        }
        if (attack.elapsed >= ATTACK_DURATION) this.finishEffect?.();
      }
      if (this.enemyAttack) {
        const attack = this.enemyAttack, before = attack.elapsed;
        attack.elapsed = Math.min(attack.plan.duration, before + (delta ?? 16));
        paintEnemyAttack(this, attack, attack.elapsed);
        for (const { index } of enemyImpactsCrossed(attack.plan, before, attack.elapsed)) {
          onImpact(index, 'player');
          const amount = attack.effect.impacts?.[index] ?? attack.effect.amount;
          const number = this.add.text(this.heroHome.x, this.floor - 75 * this.actorScale, amount ? '−' + amount : '방어',
            { fontFamily: 'Cormorant, serif', fontSize: '38px', color: amount ? '#ffc1a7' : '#b7f4ef', stroke: '#17251d', strokeThickness: 4 }).setOrigin(.5);
          this.transient(number, 680, { y: number.y - 45 });
          this.cameras.main.shake(100, ['boss', 'ravager'].includes(monsterType) ? .004 : .002);
        }
        if (attack.elapsed >= attack.plan.duration) this.finishEffect?.();
      }
    }

    transient(object, duration = 450, config = {}) {
      this.fx.add(object);
      this.tweens.add({ targets: object, alpha: 0, duration, ease: 'Sine.easeOut', ...config, onComplete: () => object.destroy() });
      return object;
    }
    burst(x, y, color, count = 36, reach = 90, delay = 0) {
      for (let i = 0; i < count; i++) {
        const angle = i * 2.39996, radius = reach * (.4 + (i % 7) / 10);
        const particle = this.add.rectangle(x, y, i % 4 ? 3 : 5, i % 3 ? 3 : 9, i % 5 ? color : 0xffffff, .9);
        particle.rotation = angle;
        this.transient(particle, 300 + (i % 6) * 65, {
          x: x + Math.cos(angle) * radius, y: y + Math.sin(angle) * radius,
          scale: .1, angle: i * 37, delay,
        });
      }
    }
    halo(x, y, color, radius = 65, delay = 0) {
      const ring = this.add.graphics().lineStyle(3, color, .9).strokeCircle(0, 0, radius);
      ring.setPosition(x, y).setScale(.2);
      this.transient(ring, 500, { scale: 1.35, delay });
      const glow = this.add.circle(x, y, radius, color, .12).setScale(.25);
      this.transient(glow, 430, { scale: 1.7, delay });
    }
    slash(x, y, color, mirrored = false, delay = 0, heavy = false) {
      const arc = this.add.graphics();
      arc.lineStyle(heavy ? 18 : 10, color, .12).beginPath().arc(0, 0, 58, -.9, 1.2).strokePath();
      arc.lineStyle(heavy ? 7 : 3, color, 1).beginPath().arc(0, 0, 58, -.9, 1.2).strokePath();
      arc.lineStyle(1, 0xffffff, .9).beginPath().arc(0, 0, 54, -.9, 1.2).strokePath();
      arc.setPosition(x, y).setAngle(mirrored ? 150 : -25).setScale(.25);
      this.transient(arc, 280, { scale: heavy ? 2 : 1.5, angle: mirrored ? 200 : -65, delay });
      this.burst(x, y, color, heavy ? 55 : 25, heavy ? 125 : 70, delay);
    }
    shield(color, stone = false) {
      const { x, y } = this.heroHome;
      for (let i = 0; i < (stone ? 7 : 3); i++) {
        const shape = this.add.graphics().lineStyle(3, color, .9);
        if (stone) shape.fillStyle(0x52634a, .8).fillRect(-9, -18, 18, 36).strokeRect(-9, -18, 18, 36);
        else shape.strokeCircle(0, 0, 42 + i * 12);
        shape.setPosition(x + (stone ? (i - 3) * 17 : 0), y + 30);
        this.transient(shape, 620, { y: y - 48 - (stone ? Math.sin(i / 6 * Math.PI) * 25 : 0), angle: stone ? 0 : 80, delay: i * 30 });
      }
      this.halo(x, y - 40, color);
    }
    lunge(actor, home, direction, heavy = false, delay = 0) {
      this.tweens.add({ targets: actor, x: home.x - direction * (heavy ? 16 : 9), angle: -direction * 5, duration: 90, delay,
        onComplete: () => {
          if (disposed) return;
          this.tweens.add({ targets: actor, x: home.x + direction * (heavy ? 62 : 38), angle: direction * 7,
            duration: 100, ease: 'Cubic.easeOut', yoyo: true, hold: 45, onComplete: () => {
              this.tweens.add({ targets: actor, x: home.x, angle: 0, duration: 160, ease: 'Sine.easeOut' });
            } });
        } });
    }
    recoil(actor, direction, delay = 160) {
      this.tweens.add({ targets: actor, x: actor.x + direction * 15, angle: direction * 5, duration: 65, delay,
        yoyo: true, repeat: 1, ease: 'Sine.easeInOut' });
    }
    skill(effect) {
      const recipe = CARD_MOTIONS[effect.cardType];
      if (!recipe) return; // Legacy saves have no card metadata; no replay is attempted.
      const { style, color } = recipe;
      const hx = this.heroHome.x, hy = this.floor - 58 * this.actorScale;
      const ex = this.enemyHome.x, ey = this.floor - 47 * this.actorScale;
      if (effect.kind === 'miss') {
        const seal = this.add.graphics().lineStyle(2, 0x948b78, .8).strokeCircle(0, 0, 30);
        seal.setPosition(hx, hy);
        this.transient(seal, 400, { scale: 1.8, angle: 100 });
        this.burst(hx, hy, 0x9b8c79, 18, 45);
        return;
      }
      if (style === 'stone') this.shield(color, true);
      if (style === 'dew') {
        this.halo(hx, hy + 35, color);
        for (let i = 0; i < 35; i++) {
          const drop = this.add.ellipse(hx + Math.sin(i * 2.4) * 55, this.floor + 12, 4, 9, i % 3 ? color : 0xf0fff4, .8);
          this.transient(drop, 500, { y: hy - 60 - i % 5 * 8, x: hx + Math.cos(i) * 32, delay: i * 8 });
        }
        this.tweens.add({ targets: this.adventurer, y: this.floor - 5, duration: 240, yoyo: true, ease: 'Sine.easeInOut' });
      }
      if (style === 'embers') {
        this.burst(hx + 30, hy + 30, color, 65, 90);
        for (let i = 0; i < 4; i++) this.halo(hx + 30, hy + 20 - i * 13, color, 28 + i * 5, i * 60);
      }
      if (style === 'seal') {
        for (let i = 0; i < 3; i++) {
          const seal = this.add.graphics().lineStyle(2, color, .9).strokeRect(-33, -33, 66, 66).strokeCircle(0, 0, 46);
          seal.setPosition(ex, ey).setAngle(i * 30).setScale(1.8);
          this.transient(seal, 650, { scale: .7, angle: 90 + i * 30, delay: i * 40 });
        }
        this.burst(ex, ey, color, 45, 90, 230);
      }
      if (style === 'focus') {
        for (let i = 0; i < 32; i++) {
          const a = i / 32 * Math.PI * 2;
          const spark = this.add.rectangle(hx + Math.cos(a) * 110, hy + Math.sin(a) * 80, 3, 7, color);
          this.transient(spark, 450, { x: hx + 27, y: hy + 22, scale: .2, delay: i * 3 });
        }
        this.halo(hx + 27, hy + 22, color, 36, 230);
      }
      if (style === 'wind') {
        for (let i = 0; i < 5; i++) {
          const wind = this.add.graphics().lineStyle(2, i % 2 ? color : 0xecfff8, .8).beginPath().arc(0, 0, 35 + i * 8, 0, Math.PI * 1.4).strokePath();
          wind.setPosition(hx, hy + 20).setAngle(i * 72);
          this.transient(wind, 620, { angle: i * 72 + 240, scale: 1.7, delay: i * 25 });
        }
      }
      if (style === 'oath') {
        for (let i = 0; i < 6; i++) {
          const rune = this.add.graphics().lineStyle(2, color, 1).strokeTriangle(0, -14, 12, 10, -12, 10);
          rune.setPosition(hx + Math.cos(i * Math.PI / 3) * 65, hy + Math.sin(i * Math.PI / 3) * 65);
          this.transient(rune, 700, { y: rune.y - 40, angle: 180, delay: i * 30 });
        }
        this.shield(color);
        this.burst(hx, hy, color, 60, 100, 150);
      }
      if (effect.upgraded) {
        this.halo(hx, hy, 0xffffff, 85, 160);
        this.burst(hx, hy, color, 50, 150, 160);
      }
    }
    sync() {
      if (disposed || !this.adventurer || !state) return;
      if (state.effect.id === lastEffectId) {
        if (state.enemy.hp <= 0 && !this.finishEffect) { this.foe.setAlpha(0); this.enemyShadow.setAlpha(0); }
        return;
      }
      lastEffectId = state.effect.id;
      if (this.finishEffect) this.finishEffect();
      if (reduced()) { this.foe.setAlpha(state.enemy.hp <= 0 ? 0 : 1); onBusy(false); return; }
      const effect = state.effect;
      const duration = effect.kind === 'miss' ? 600 : CARD_MOTIONS[effect.cardType]?.duration ?? 650;
      onBusy(true);
      if (effect.kind === 'hurt') {
        this.enemyAttack = { effect, type: monsterType, elapsed: 0, plan: enemyAttackPlan(monsterType, effect) };
        this.playerFalling = state.playerDead;
        this.finishEffect = () => {
          this.enemyAttack = null; this.enemyPose = null; this.attackInk.clear();
          this.heroSprite?.setAlpha(1);
          if (!this.playerFalling) this.adventurer.setPosition(this.heroHome.x, this.floor).setAngle(0);
          this.foe.setPosition(this.enemyHome.x, this.floor).setAngle(0).setScale(this.actorScale);
          this.finishEffect = null;
          if (this.pendingLayout) { const layout = this.pendingLayout; this.pendingLayout = null; this.redraw(layout); }
          if (this.playerFalling) this.adventurer.setPosition(this.heroHome.x, this.floor + 12).setAngle(-65);
          onBusy(false);
        };
        paintEnemyAttack(this, this.enemyAttack, 0);
        return;
      }
      if (effect.kind === 'attack' && ATTACK_HITS[effect.cardType]) {
        this.attack = { effect, color: CARD_MOTIONS[effect.cardType].color, elapsed: 0 };
        this.finishEffect = () => {
          this.attack = null; this.attackInk.clear(); this.armAngle = 0; this.paintHero(0);
          this.enemyFigure.setAlpha(1);
          this.adventurer.setPosition(this.heroHome.x, this.floor).setAngle(0);
          this.foe.setPosition(this.enemyHome.x, this.floor).setAngle(0);
          this.finishEffect = null;
          if (this.pendingLayout) { const layout = this.pendingLayout; this.pendingLayout = null; this.redraw(layout); }
          if (state.enemy.hp <= 0) {
            this.burst(this.enemyHome.x, this.floor - 75, 0xe5c78c, 100, 150);
            this.tweens.add({ targets: [this.foe, this.enemyShadow], alpha: 0, duration: 240 });
          }
          onBusy(false);
        };
        paintAttack(this, this.attack, 0);
        return;
      }
      this.skill(effect);
      if (effect.kind === 'enemy') {
        const ex = this.enemyHome.x, ey = this.floor - 80;
        if (effect.enemyAction === 'block') {
          this.enemyPose = 3;
          for (let i = 0; i < 3; i++) this.halo(ex, ey, 0xabc5ab, 50 + i * 12, i * 50);
        } else if (effect.enemyAction === 'wait') {
          this.enemyPose = 0;
          for (let i = 0; i < 5; i++) {
            const breath = this.add.circle(ex - 20 + i * 10, ey - i * 5, 3, 0xa9d6ce, .6);
            this.transient(breath, 650, { y: ey - 50, scale: 2, delay: i * 45 });
          }
        } else {
          this.enemyPose = 4;
          this.burst(ex, ey, effect.enemyAction === 'charge' ? 0xff654d : 0xffb16e, 65, 100);
          if (effect.enemyAction === 'charge') this.tweens.add({ targets: this.foe, angle: -7, duration: 90, yoyo: true, repeat: 2 });
          else this.halo(ex, ey, 0xffd19c, 65);
          this.tweens.add({ targets: this.foe, y: this.floor - 9, duration: 220, yoyo: true, ease: 'Sine.easeInOut' });
        }
      }
      const completion = this.time.delayedCall(duration, () => {
        if (disposed) return;
        this.finishEffect?.();
        if (state.enemy.hp <= 0) {
          this.burst(this.enemyHome.x, this.floor - 80, 0xd4b47a, 80, 150);
          this.tweens.add({ targets: this.foe, alpha: 0, y: this.floor - 20, duration: 240 });
          this.tweens.add({ targets: this.enemyShadow, alpha: 0, duration: 240 });
          this.tweens.add({ targets: this.adventurer, angle: -6, y: this.floor - 5, duration: 220, yoyo: true });
        }
      });
      this.finishEffect = () => {
        this.enemyPose = null;
        completion.remove(false);
        this.tweens.killTweensOf([this.adventurer, this.foe]);
        if (!state.playerDead) this.adventurer.setPosition(this.heroHome.x, this.floor).setAngle(0);
        this.foe.setPosition(this.enemyHome.x, this.floor).setAngle(0);
        this.finishEffect = null;
        if (this.pendingLayout) { const layout = this.pendingLayout; this.pendingLayout = null; this.redraw(layout); }
        onBusy(false);
      };
    }
  }
  const scene = new BattleScene();
  const game = new Phaser.Game({
    type: Phaser.CANVAS, parent,
    width: Math.max(1, parent.clientWidth), height: Math.max(1, parent.clientHeight),
    backgroundColor: '#17201e', pixelArt: true, banner: false, autoFocus: false,
    audio: { noAudio: true },
    input: { keyboard: false, mouse: false, touch: false, gamepad: false, windowEvents: false },
    fps: { target: 60, forceSetTimeOut: true, smoothStep: false },
    scale: { mode: Phaser.Scale.RESIZE, expandParent: false }, scene: [scene],
  });
  const observer = new ResizeObserver(() => {
    if (disposed || !game.isBooted || !parent.clientWidth || !parent.clientHeight) return;
    if (game.scale.width !== parent.clientWidth || game.scale.height !== parent.clientHeight) game.scale.setParentSize(parent.clientWidth, parent.clientHeight);
    if (game.isRunning) game.loop.tick();
  });
  observer.observe(parent);
  return {
    inspect() {
      return { running: game.isRunning, paused: game.isPaused, frame: game.loop.frame,
        loop: game.loop.running, scene: scene.sys.settings.status, clock: scene.time?.now,
        tweens: scene.tweens?.getTweens().length, canvas: [game.canvas?.width, game.canvas?.height],
        enemyAttack: scene.enemyAttack ? { type: monsterType, elapsed: scene.enemyAttack.elapsed, duration: scene.enemyAttack.plan.duration } : null,
        time: Date.now(), hidden: document.hidden };
    },
    // Development preview can scrub a real frame even when Safari suspends a hidden tab.
    sampleFrame(milliseconds) {
      if (!scene.fx || disposed) return 0;
      if (scene.attack) paintAttack(scene, scene.attack, milliseconds);
      else if (scene.enemyAttack) paintEnemyAttack(scene, scene.enemyAttack, milliseconds);
      else scene.tweens.getTweens().forEach((tween) => tween.seek(milliseconds, 16.6, true));
      game.renderer.preRender(); game.scene.render(game.renderer); game.renderer.postRender();
      return scene.fx.length + scene.attackInk.commandBuffer.length;
    },
    advancePreview(milliseconds, resize) {
      if (resize) scene.redraw(resize);
      for (let elapsed = 0; elapsed < milliseconds; elapsed += 16) scene.update(elapsed, Math.min(16, milliseconds - elapsed));
      game.renderer.preRender(); game.scene.render(game.renderer); game.renderer.postRender();
      return { active: !!(scene.attack || scene.enemyAttack), pendingResize: !!scene.pendingLayout, width: scene.layoutWidth, height: scene.layoutHeight,
        enemyX: scene.foe?.x, heroX: scene.adventurer?.x, home: scene.enemyHome?.x, heroAlpha: scene.adventurer?.alpha };
    },
    settlePreview() {
      scene.finishEffect?.(); scene.tweens?.killAll(); scene.fx?.removeAll(true); scene.attackInk?.clear();
      scene.playerFalling = false;
      scene.adventurer?.setAlpha(1).setPosition(scene.heroHome.x, scene.floor).setAngle(0);
      scene.heroShadow?.setAlpha(.7);
    },
    setState(next) { state = next; scene.sync(); },
    destroy() { if (disposed) return; disposed = true; observer.disconnect(); game.destroy(true); },
  };
}
