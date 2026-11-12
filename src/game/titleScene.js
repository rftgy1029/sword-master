import Phaser from 'phaser';
import { hero } from '../scene.js';
import { drawingContext } from './phaserDrawing.js';
import { createHeroRig, drawHeroRig } from './heroRig.js';
import { heroImage } from './spriteAssets.js';
import { createMapLayers, preloadMap, titleMap } from './mapAssets.js';

export function startPhaserTitleScene(canvas, { signal, motionPreference = 'normal', onReady, onError } = {}) {
  if (signal?.aborted) return;
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const still = () => media.matches || motionPreference === 'off';
  let disposed = false;
  let game;

  class TitleScene extends Phaser.Scene {
    constructor() { super('title'); }
    preload() {
      preloadMap(this, titleMap);
      this.load.image('title-hero', heroImage);
    }
    create() {
      if (disposed) return;
      try {
        const background = createMapLayers(this, titleMap, ['Walls and floor', 'Entrance and torches']);
        if (!background) throw new Error('던전 입구 맵을 불러오지 못했습니다.');
        this.shadow = this.add.ellipse(144, 238, 46, 5, 0x101b18, .7);
        this.figure = this.add.graphics();
        if (this.textures.exists('title-hero')) {
          this.rig = createHeroRig(this.textures.get('title-hero').getSourceImage());
          this.surface = this.textures.createCanvas('title-hero-animated', 96, 96);
          this.add.image(144, 236, 'title-hero-animated').setOrigin(.5, 82 / 96).setScale(1.15);
        }
        this.paintHero(0);
        this.game.events.once(Phaser.Core.Events.POST_RENDER, () => {
          if (!disposed) onReady?.();
        });
      } catch (error) {
        onError?.(error);
      }
    }
    paintHero(time) {
      if (this.rig) {
        const ctx = this.surface.context;
        ctx.clearRect(0, 0, 96, 96);
        drawHeroRig(ctx, this.rig, { time, x: 48, y: 82, motion: !still() });
        this.surface.refresh();
      } else if (this.figure) {
        this.figure.clear();
        hero(drawingContext(this.figure), time);
      }
    }
    update(time) {
      if (disposed || !this.figure) return;
      const interval = motionPreference === 'reduced' ? 1000 / 12 : 1000 / 24;
      if (still()) { if (!this.wasStill) this.paintHero(0); this.wasStill = true; return; }
      this.wasStill = false;
      if (time - (this.lastPaint ?? -Infinity) < interval) return;
      this.lastPaint = time;
      this.paintHero(time * (motionPreference === 'reduced' ? .35 : 1));
    }
  }

  game = new Phaser.Game({
    type: Phaser.CANVAS, canvas, width: 384, height: 288,
    backgroundColor: '#151919', pixelArt: true, banner: false, autoFocus: false,
    audio: { noAudio: true },
    input: { keyboard: false, mouse: false, touch: false, gamepad: false, windowEvents: false },
    fps: { target: 60, forceSetTimeOut: true, smoothStep: false },
    scene: [new TitleScene()],
  });
  const destroy = () => { if (!disposed) { disposed = true; game.destroy(false); } };
  signal?.addEventListener('abort', destroy, { once: true });
  return { destroy };
}
