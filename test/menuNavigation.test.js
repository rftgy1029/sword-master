import test from 'node:test';
import assert from 'node:assert/strict';
import { listenForMenuNavigation } from '../src/menuNavigation.js';

function setup(selected = 0) {
  const document = new EventTarget();
  document.body = {};
  document.documentElement = {};
  document.hidden = false;
  const moves = [];
  const clicks = [];
  const buttons = Array.from({ length: 4 }, (_, index) => ({
    focus() { document.activeElement = this; },
    scrollIntoView() {},
    click() { clicks.push(index); },
  }));
  const cleanup = listenForMenuNavigation(document, {
    menu: { contains: (target) => buttons.includes(target) },
    buttons, selected, onSelect: (index) => moves.push(index),
  });
  function key(key, target = document.body, options = {}) {
    const event = new Event('keydown', { cancelable: true });
    Object.defineProperties(event, Object.fromEntries(
      Object.entries({ key, target, ...options }).map(([name, value]) => [name, { value }]),
    ));
    document.dispatchEvent(event);
    return event;
  }
  return { document, buttons, moves, clicks, key, cleanup };
}

test('arrows recover lost page focus and continue from the last selection', () => {
  const { document, buttons, moves, key } = setup(2);
  assert.equal(key('ArrowDown').defaultPrevented, true);
  assert.equal(document.activeElement, buttons[3]);
  key('ArrowDown');
  key('ArrowUp');
  assert.deepEqual(moves, [3, 0, 3]);
});

test('menu focus and document-root focus both support arrows, Home and End', () => {
  const { document, buttons, moves, key } = setup();
  key('End', buttons[0]);
  key('Home', document.documentElement);
  key('ArrowUp', buttons[0]);
  assert.deepEqual(moves, [3, 0, 3]);
});

test('Enter and Space recover focus and activate the last selection on the background', () => {
  const { document, buttons, moves, clicks, key } = setup(3);
  assert.equal(key('Enter').defaultPrevented, true);
  assert.equal(document.activeElement, buttons[3]);
  key(' ');
  key('Enter', document.body, { repeat: true });
  assert.deepEqual(clicks, [3, 3]);
  assert.deepEqual(moves, []);
});

test('focused buttons keep native activation and Tab keeps native focus movement', () => {
  const { buttons, moves, clicks, key } = setup();
  for (const value of ['Enter', ' ', 'Tab']) {
    assert.equal(key(value, buttons[0]).defaultPrevented, false);
  }
  assert.deepEqual(clicks, []);
  assert.deepEqual(moves, []);
});

test('dialog controls and other focus targets never move or activate the title menu', () => {
  const { moves, clicks, key } = setup();
  const control = {};
  for (const value of ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' ']) {
    assert.equal(key(value, control).defaultPrevented, false);
  }
  assert.deepEqual(moves, []);
  assert.deepEqual(clicks, []);
});

test('modified, composing, consumed and hidden-page events are ignored', () => {
  const { document, moves, key } = setup();
  for (const flag of ['altKey', 'ctrlKey', 'metaKey', 'shiftKey', 'isComposing', 'defaultPrevented']) {
    key('ArrowDown', document.body, { [flag]: true });
  }
  document.hidden = true;
  assert.equal(key('ArrowDown').defaultPrevented, false);
  assert.deepEqual(moves, []);
});

test('cleanup disables title navigation when a dialog opens or the app unmounts', () => {
  const { document, moves, clicks, key, cleanup } = setup(1);
  cleanup();
  assert.equal(key('ArrowDown').defaultPrevented, false);
  key('Enter', document.body);
  assert.deepEqual(moves, []);
  assert.deepEqual(clicks, []);
});
