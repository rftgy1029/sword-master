import test from 'node:test';
import assert from 'node:assert/strict';
import { cardShortcutIndex } from '../src/game/combatShortcuts.js';

test('number row and numeric keypad address the first four hand positions', () => {
  for (let n = 1; n <= 4; n++) {
    assert.equal(cardShortcutIndex({ key: String(n), code: `Digit${n}` }), n - 1);
    assert.equal(cardShortcutIndex({ key: String(n), code: `Numpad${n}` }), n - 1);
    assert.equal(cardShortcutIndex({ key: 'End', code: `Numpad${n}` }), n - 1);
  }
  assert.equal(cardShortcutIndex({ key: '5', code: 'Digit5' }), null);
});

test('shortcut ignores repeated keys, composing and modifier combinations', () => {
  for (const flag of ['repeat', 'isComposing', 'defaultPrevented', 'altKey', 'ctrlKey', 'metaKey', 'shiftKey']) {
    assert.equal(cardShortcutIndex({ key: '1', code: 'Numpad1', [flag]: true }), null);
  }
});
