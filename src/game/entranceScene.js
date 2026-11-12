import Phaser from 'phaser';
import { dungeonEntrance, hero } from '../scene.js';
import { drawingContext } from './phaserDrawing.js';
import { heroPoses } from './spriteAssets.js';
import { createHeroRig, drawHeroRig, HERO_SURFACE_SCALE } from './illustratedHero.js';

export function startEntranceScene(parent, { motionPreference = 'normal', onComplete }) {
  let disposed = false;
  let completed = false;
  const reducedMotion = motionPreference !== 'normal' || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finish = () => {
    if (disposed || completed) return;
    completed = true;
    onComplete();
  };

  class EntranceScene extends Phaser.Scene {
    constructor() { super('dungeon-entrance'); }
    preload() { this.load.image('entrance-hero', heroPoses); }

    create() {
      this.tweens.setLagSmooth();
      if (disposed) return;
      this.cameras.main.setZoom(3).centerOn(192, 144);
      dungeonEntrance(drawingContext(this.add.graphics()));
      this.shadow = this.add.ellipse(134, 238, 46, 5, 0x101b18, .7);
      this.adventurer = this.add.container(reducedMotion ? 278 : 134, 236);
      this.figure = this.add.graphics();
      this.adventurer.add(this.figure);
      this.context = drawingContext(this.figure);
      if (this.textures.exists('entrance-hero')) {
        this.rig = createHeroRig(this.textures.get('entrance-hero').getSourceImage());
        this.surface = this.textures.createCanvas('entrance-hero-animated', 96 * HERO_SURFACE_SCALE, 96 * HERO_SURFACE_SCALE);
        this.sprite = this.add.image(0, 0, 'entrance-hero-animated').setOrigin(.5, 82 / 96).setScale(1.15 / HERO_SURFACE_SCALE);
        this.adventurer.add(this.sprite); this.figure.setVisible(false);
      }
      this.walking = !reducedMotion;
      this.paintHero(0);
      this.embers = Array.from({ length: 32 }, (_, i) => {
        const dot = this.add.circle(255 + Math.sin(i * 2.4) * 43, 50 + i * 6, i % 4 ? .7 : 1.3, i % 3 ? 0xf7c57f : 0xafd5b4, .5);
        if (!reducedMotion) this.tweens.add({ targets: dot, y: dot.y - 55, x: dot.x + 12, alpha: 0, duration: 1800 + i * 33, delay: i * 75, repeat: -1 });
        return dot;
      });

      if (reducedMotion) {
        this.adventurer.setScale(.7);
        this.shadow.setPosition(278, 238).setScale(.7);
        this.time.delayedCall(250, finish);
        return;
      }

      this.tweens.add({
        targets: this.adventurer,
        x: 278,
        delay: 200,
        duration: 1700,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          if (disposed) return;
          this.tweens.add({
            targets: this.adventurer,
            x: 282, y: 209, scaleX: .45, scaleY: .45, alpha: 0,
            duration: 900,
            ease: 'Sine.easeIn',
            onComplete: () => {
              if (disposed) return;
              this.walking = false;
              this.shadow.setVisible(false);
              finish();
            },
          });
        },
      });
    }

    paintHero(time) {
      if (this.rig) {
        const ctx = this.surface.context;
        ctx.clearRect(0, 0, this.surface.width, this.surface.height);
        drawHeroRig(ctx, this.rig, { time, x: 48 * HERO_SURFACE_SCALE, y: 82 * HERO_SURFACE_SCALE, scale: HERO_SURFACE_SCALE, walking: this.walking, motion: !reducedMotion });
        this.surface.refresh();
        return;
      }
      this.figure.clear();
      this.context.save();
      this.context.translate(-144, -236);
      hero(this.context, time, this.walking);
      this.context.restore();
    }

    update(time) {
      if (disposed || reducedMotion || !this.figure || completed) return;
      this.paintHero(time);
      this.figure.y = this.walking ? Math.round(Math.sin(time / 100)) : 0;
      this.shadow.setPosition(this.adventurer.x, this.adventurer.y + 2)
        .setScale(this.adventurer.scaleX).setAlpha(this.adventurer.alpha * .7);
    }
  }

  const game = new Phaser.Game({
    type: Phaser.CANVAS,
    parent,
    width: 1152, height: 864,
    backgroundColor: '#151919',
    pixelArt: false, antialias: true, roundPixels: false,
    banner: false,
    autoFocus: false,
    audio: { noAudio: true },
    input: { keyboard: false, mouse: false, touch: false, gamepad: false, windowEvents: false },
    fps: { target: 60, forceSetTimeOut: true, smoothStep: false },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, expandParent: false },
    scene: [new EntranceScene()],
  });
  const observer = new ResizeObserver(() => {
    if (disposed || !game.isBooted) return;
    game.scale.setParentSize(Math.max(1, parent.clientWidth), Math.max(1, parent.clientHeight));
    if (game.isRunning) game.loop.tick();
  });
  observer.observe(parent);

  return {
    destroy() {
      if (disposed) return;
      disposed = true;
      observer.disconnect();
      game.destroy(true);
    },
  };
}
