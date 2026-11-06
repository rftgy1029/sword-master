import Phaser from 'phaser';
import { CARDS } from './catalog.js';

export function startCardDealScene(parent) {
  let disposed = false, request = null;
  class DealScene extends Phaser.Scene {
    constructor() { super('card-dealer'); }
    create() { this.tweens.setLagSmooth(); this.ready = true; this.playRequest(); }
    playRequest() {
      if (!this.ready || !request || disposed) return;
      const batch = request;
      request = null;
      this.active = batch;
      if (batch.reshuffle) {
        for (let i = 0; i < 8; i++) {
          const back = this.cardBack(32, 45);
          back.setPosition(batch.discard.x + i, batch.discard.y - i * 2);
          this.tweens.add({ targets: back, x: batch.source.x, y: batch.source.y, angle: -12,
            duration: 260, delay: i * 16, onComplete: () => back.destroy() });
        }
      }
      const lead = batch.reshuffle ? 360 : 0;
      batch.cards.forEach((card, index) => {
        const target = batch.targets[index];
        const width = Math.min(166, target.width), height = Math.min(145, target.height);
        const figure = this.cardBack(width, height);
        const front = this.add.container();
        front.add(this.add.rectangle(0, 0, width, height, 0x28362a).setStrokeStyle(2, 0xe6c785));
        front.add(this.add.text(-width / 2 + 10, -height / 2 + 12, String(CARDS[card.type].cost), { fontFamily: 'GothicA1', fontSize: '19px', color: '#ffe8ac' }));
        front.add(this.add.text(0, -5, CARDS[card.type].name, { fontFamily: 'GothicA1', fontSize: '13px', color: '#fff1d0', wordWrap: { width: width - 18 }, align: 'center' }).setOrigin(.5));
        figure.add(front); front.setVisible(false);
        const motion = { t: 0 };
        figure.setPosition(batch.source.x, batch.source.y).setScale(.4).setAlpha(0);
        this.tweens.add({ targets: motion, t: 1, duration: 460, delay: lead + index * 120, ease: 'Cubic.easeInOut',
          onUpdate: () => {
            const t = motion.t;
            const x = Phaser.Math.Linear(batch.source.x, target.x, t);
            const y = Phaser.Math.Linear(batch.source.y, target.y, t) - Math.sin(t * Math.PI) * 105;
            const scale = .4 + t * .6;
            figure.setPosition(x, y).setAngle((1 - t) * -28).setAlpha(Math.min(1, t * 5))
              .setScale(scale * Math.max(.12, Math.abs(Math.cos(t * Math.PI))), scale);
            front.setVisible(t > .5);
            const trail = this.add.circle(x, y + 20, 3, index % 2 ? 0xd2eddd : 0xffd98a, .5);
            this.tweens.add({ targets: trail, alpha: 0, scale: .1, duration: 220, onComplete: () => trail.destroy() });
          },
          onComplete: () => {
            figure.destroy(); batch.onArrive(card.uid);
            if (index === batch.cards.length - 1) { this.active = null; batch.resolve(); }
          },
        });
      });
      if (!batch.cards.length) { this.active = null; batch.resolve(); }
    }
    cardBack(width, height) {
      const card = this.add.container();
      card.add(this.add.rectangle(0, 0, width, height, 0x14241e).setStrokeStyle(2, 0xc8ad70));
      card.add(this.add.rectangle(0, 0, width - 12, height - 12, 0x253b2f).setStrokeStyle(1, 0x8c8153));
      const sigil = this.add.graphics().lineStyle(2, 0xe9cd86, .9).strokeCircle(0, 0, width * .2)
        .lineBetween(0, -height * .28, 0, height * .28).strokeTriangle(0, -25, 14, 16, -14, 16);
      card.add(sigil);
      return card;
    }
  }
  const scene = new DealScene();
  const game = new Phaser.Game({
    type: Phaser.CANVAS, parent, transparent: true,
    width: Math.max(1, parent.clientWidth), height: Math.max(1, parent.clientHeight),
    banner: false, autoFocus: false, audio: { noAudio: true },
    input: { keyboard: false, mouse: false, touch: false, gamepad: false, windowEvents: false },
    fps: { target: 60, forceSetTimeOut: true, smoothStep: false },
    scale: { mode: Phaser.Scale.RESIZE, expandParent: false }, scene: [scene],
  });
  const observer = new ResizeObserver(() => {
    if (!game.isBooted || disposed) return;
    if (game.scale.width !== parent.clientWidth || game.scale.height !== parent.clientHeight) {
      // A resized hand has new DOM targets. Reveal it rather than landing at stale coordinates.
      scene.tweens?.killAll();
      scene.children?.removeAll(true);
      if (scene.active) { scene.active.cards.forEach((card) => scene.active.onArrive(card.uid)); scene.active.resolve(); scene.active = null; }
      game.scale.setParentSize(Math.max(1, parent.clientWidth), Math.max(1, parent.clientHeight));
    }
  });
  observer.observe(parent);
  return {
    sampleFrame(milliseconds) {
      if (!scene.ready || disposed) return;
      scene.tweens.getTweens().forEach((tween) => tween.seek(milliseconds, 16.6, true));
      game.renderer.preRender(); game.scene.render(game.renderer); game.renderer.postRender();
    },
    play(batch) {
      return new Promise((resolve) => { request = { ...batch, resolve }; scene.playRequest(); });
    },
    destroy() {
      if (disposed) return;
      disposed = true; observer.disconnect();
      request?.resolve(); scene.active?.resolve(); game.destroy(true);
    },
  };
}
