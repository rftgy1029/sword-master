import test from 'node:test';
import assert from 'node:assert/strict';
import { MENU_REACTIONS, MENU_WORDS, matchTyped, typeKey } from '../src/titleWords.js';

test('typed letters pick the first enabled menu word that starts with them', () => {
  assert.deepEqual(matchTyped('s'), { index: 0, complete: false, valid: true });
  assert.deepEqual(matchTyped('se'), { index: 4, complete: false, valid: true });
  assert.deepEqual(matchTyped('start'), { index: 0, complete: true, valid: true });
  assert.deepEqual(matchTyped('WORDS'), { index: 2, complete: true, valid: true });
  assert.deepEqual(matchTyped('x'), { index: -1, complete: false, valid: false });
});

test('a disabled menu (continue without a save) is recognised but never chosen', () => {
  const enabled = [true, false, true, true, true];
  assert.deepEqual(matchTyped('continue', enabled), { index: -1, complete: false, valid: true });
  assert.equal(matchTyped('c', enabled).index, -1);
});

test('typing keeps a prefix of some word, restarting on a fresh first letter', () => {
  let typed = '';
  for (const key of 'sta') typed = typeKey(typed, key);
  assert.equal(typed, 'sta');
  assert.equal(typeKey(typed, 'w'), 'w', 'An impossible letter that starts another word restarts there');
  assert.equal(typeKey(typed, 'z'), '', 'A letter that starts no word clears the input');
  assert.equal(typeKey('sta', 'Backspace'), 'st');
  assert.equal(typeKey('sta', 'Escape'), '');
  assert.equal(typeKey('sta', 'Shift'), 'sta', 'Non-letter keys are ignored');
  assert.equal(typeKey('', 'R'), 'r');
});

test('every menu word has a knight reaction', () => {
  assert.equal(MENU_REACTIONS.length, MENU_WORDS.length);
  for (const word of MENU_WORDS) assert.match(word, /^[a-z]+$/);
});
