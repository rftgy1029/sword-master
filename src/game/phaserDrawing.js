import Phaser from 'phaser';

// Reuse the pixel art drawing functions through Phaser Graphics commands.
export function drawingContext(graphics) {
  return {
    set fillStyle(color) {
      if (color.startsWith('#')) graphics.fillStyle(Number.parseInt(color.slice(1), 16), 1);
      else {
        const value = Phaser.Display.Color.ValueToColor(color);
        graphics.fillStyle(value.color, value.alphaGL);
      }
    },
    fillRect: (x, y, width, height) => graphics.fillRect(x, y, width, height),
    save: () => graphics.save(),
    restore: () => graphics.restore(),
    translate: (x, y) => graphics.translateCanvas(x, y),
    rotate: (angle) => graphics.rotateCanvas(angle),
    scale: (x, y) => graphics.scaleCanvas(x, y),
  };
}
