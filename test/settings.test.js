import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, SETTINGS_KEY, normalizeSettings, readSettings, saveSettings } from '../src/settings.js';

test('missing or corrupt storage recovers to defaults', () => {
  for (const raw of [null, '', '{broken', 'null', '[]']) {
    assert.deepEqual(readSettings({ getItem: () => raw }), DEFAULT_SETTINGS);
  }
});

test('saved preferences round-trip under a dedicated versioned key', () => {
  const data = new Map([['sword-master.progress', 'keep this learning record']]);
  const storage = { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const settings = { ...DEFAULT_SETTINGS, textSize: 'larger', backgroundMotion: 'off', selectionEffect: 'static', renderer:'3d', graphicsQuality:'high', combatSound:'off', combatVolume:23 };
  assert.equal(saveSettings(settings, storage), true);
  assert.equal(JSON.parse(data.get(SETTINGS_KEY)).version, 1);
  assert.deepEqual(readSettings(storage), settings);
  assert.equal(data.get('sword-master.progress'), 'keep this learning record');
});

test('unsupported versions do not load their preference values', () => {
  assert.deepEqual(readSettings({ getItem: () => JSON.stringify({ version: 2, settings: { textSize: 'larger' } }) }), DEFAULT_SETTINGS);
});

test('invalid and extra values are ignored without losing valid fields', () => {
  assert.deepEqual(normalizeSettings({ textSize: 'large', backgroundMotion: 'unlimited', selectionEffect: false, progress: 'unexpected' }), {
    ...DEFAULT_SETTINGS, textSize: 'large', backgroundMotion: 'normal', selectionEffect: 'breathe',
  });
});

test('existing settings receive graphics defaults without changing reading and motion preferences', () => {
  const old = { textSize:'large',backgroundMotion:'off',selectionEffect:'static' };
  assert.deepEqual(readSettings({getItem:()=>JSON.stringify({version:1,settings:old})}),{...DEFAULT_SETTINGS,...old});
  assert.equal(normalizeSettings({renderer:'invalid',graphicsQuality:'unlimited'}).renderer,'auto');
});

test('unavailable storage is handled without throwing', () => {
  const unavailable = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('quota exceeded'); } };
  assert.deepEqual(readSettings(unavailable), DEFAULT_SETTINGS);
  assert.equal(saveSettings(DEFAULT_SETTINGS, unavailable), false);
});

test('restoring defaults preserves unrelated saved data', () => {
  const data = new Map([['other-app', 'untouched']]);
  const storage = { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  saveSettings({ textSize: 'larger', backgroundMotion: 'reduced', selectionEffect: 'static' }, storage);
  saveSettings(DEFAULT_SETTINGS, storage);
  assert.deepEqual(readSettings(storage), DEFAULT_SETTINGS);
  assert.equal(data.get('other-app'), 'untouched');
});


test('audio settings default for older saves and normalize the volume range', () => {
  const old = normalizeSettings({ graphicsQuality: 'high' });
  assert.equal(old.combatSound, 'on');
  assert.equal(old.combatVolume, 60);
  assert.equal(normalizeSettings({ combatVolume: 137 }).combatVolume, 100);
  assert.equal(normalizeSettings({ combatVolume: -3 }).combatVolume, 0);
  assert.equal(normalizeSettings({ combatVolume: '25' }).combatVolume, 60);
});
