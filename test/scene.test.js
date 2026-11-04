import test from 'node:test';
import assert from 'node:assert/strict';
import { startTitleScene } from '../src/scene.js';

function setup(t, reducedMotion = false) {
  const original = new Map();
  const frames = new Map();
  const documentMock = new EventTarget();
  documentMock.hidden = false;
  const media = new EventTarget();
  media.matches = reducedMotion;
  const windowMock = new EventTarget();
  const context = () => ({ fillRect() {}, drawImage() {}, save() {}, restore() {}, translate() {}, scale() {} });
  documentMock.createElement = () => ({ getContext: context });
  let nextFrame = 0;
  const values = {
    document: documentMock,
    matchMedia: () => media,
    requestAnimationFrame(callback) { frames.set(++nextFrame, callback); return nextFrame; },
    cancelAnimationFrame(id) { frames.delete(id); },
    addEventListener: windowMock.addEventListener.bind(windowMock),
  };
  for (const [key, value] of Object.entries(values)) {
    original.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  t.after(() => {
    for (const [key, descriptor] of original) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  return { frames, document: documentMock, canvas: { getContext: context } };
}

test('turning background motion off draws a static scene without a running animation', async (t) => {
  const { frames, canvas } = setup(t);
  const controller = new AbortController();
  await startTitleScene(canvas, { signal: controller.signal, motionPreference: 'off' });
  assert.equal(canvas.width, 384);
  assert.equal(frames.size, 0);
  controller.abort();
});

test('system reduced motion keeps the background static even when normal is selected', async (t) => {
  const { frames, canvas } = setup(t, true);
  const controller = new AbortController();
  await startTitleScene(canvas, { signal: controller.signal, motionPreference: 'normal' });
  assert.equal(frames.size, 0);
  controller.abort();
});

test('animation pauses when hidden, resumes when visible, and stops on cleanup', async (t) => {
  const fixture = setup(t);
  const controller = new AbortController();
  await startTitleScene(fixture.canvas, { signal: controller.signal, motionPreference: 'reduced' });
  assert.equal(fixture.frames.size, 1);
  fixture.document.hidden = true;
  fixture.document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(fixture.frames.size, 0);
  fixture.document.hidden = false;
  fixture.document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(fixture.frames.size, 1);
  controller.abort();
  assert.equal(fixture.frames.size, 0);
  fixture.document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(fixture.frames.size, 0);
});
