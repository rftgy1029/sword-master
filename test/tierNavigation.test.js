import test from 'node:test';
import assert from 'node:assert/strict';
import { navigateTiers } from '../src/game/tierNavigation.js';

function setup() {
  let focus = null, selected = 'bronze';
  const tiers = ['bronze', 'silver'].map((tier) => ({
    dataset: { tier }, focus() { focus = this; },
    getAttribute() { return selected === tier ? 'true' : 'false'; },
  }));
  const start = { focus() { focus = this; } };
  function key(target, key, extra = {}) {
    const event = { target, key, preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.stopped = true; }, ...extra };
    navigateTiers(event, { tiers, start, select: (value) => { selected = value; } });
    return event;
  }
  return { tiers, start, key, focus: () => focus, selected: () => selected };
}
test('Enter selects a tier then focuses start without activating it; repeated Enter cannot start', () => {
  const s = setup();
  const first = s.key(s.tiers[1], 'Enter');
  assert.equal(first.defaultPrevented, true);
  assert.equal(s.selected(), 'silver'); assert.equal(s.focus(), s.start);
  assert.equal(s.key(s.start, 'Enter').defaultPrevented, undefined, 'Native button activation remains available');
  assert.equal(s.key(s.start, 'Enter', { repeat: true }).defaultPrevented, true);
});
test('arrows cross the tier/start boundary, cycle only available tiers and preserve selected tier', () => {
  const s = setup();
  s.key(s.tiers[0], 'ArrowRight'); assert.equal(s.focus(), s.tiers[1]);
  s.key(s.tiers[1], 'ArrowDown'); assert.equal(s.focus(), s.start);
  s.key(s.start, 'ArrowUp'); assert.equal(s.focus(), s.tiers[1]);
  s.key(s.tiers[1], 'ArrowRight'); assert.equal(s.focus(), s.tiers[0]);
  s.key(s.tiers[0], 'End'); assert.equal(s.focus(), s.tiers[1]);
  s.key(s.tiers[1], 'Home'); assert.equal(s.focus(), s.tiers[0]);
});
test('composing, modifiers, already consumed events and other controls do not trigger tier navigation', () => {
  const s = setup();
  for (const flags of [{ isComposing: true }, { altKey: true }, { defaultPrevented: true }]) {
    s.key(s.tiers[0], 'Enter', flags); assert.equal(s.focus(), null);
  }
  s.key({}, 'Enter'); assert.equal(s.focus(), null);
});
