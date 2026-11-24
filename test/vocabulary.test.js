import test from 'node:test';
import assert from 'node:assert/strict';
import words from '../src/data/vocabulary.json' with { type: 'json' };
import { findVocabulary, TIERS } from '../src/vocabulary.js';
import {
  buildGameHomeUrl,
  buildVocabularyTabUrl,
  isStandaloneVocabularyUrl,
  parseVocabularyUrlState,
} from '../src/vocabularyUrl.js';

test('all five cumulative ranges match the teacher PDFs', () => {
  assert.deepEqual(TIERS.map(({ id }) => findVocabulary({ tier: id }).length), [64, 290, 741, 969, 1000]);
  for (let index = 1; index < TIERS.length; index++) {
    const current = new Set(findVocabulary({ tier: TIERS[index].id }).map(({ id }) => id));
    for (const word of findVocabulary({ tier: TIERS[index - 1].id })) assert.ok(current.has(word.id));
  }
});

test('additional-word ranges exclude lower tiers and cover exactly 1000 distinct entries', () => {
  const additions = TIERS.map(({ id }) => findVocabulary({ tier: id, scope: 'new' }));
  assert.deepEqual(additions.map((items) => items.length), [64, 226, 451, 228, 31]);
  assert.equal(new Set(additions.flat().map(({ id }) => id)).size, 1000);
  additions.forEach((items, index) => assert.ok(items.every(({ tier }) => tier === TIERS[index].id)));
});

test('same spelling with different meanings remains separate and in its original tier', () => {
  const claims = words.filter(({ term }) => term === 'claim' || term === 'claim (주장)');
  assert.equal(claims.length, 2);
  assert.notEqual(claims[0].id, claims[1].id);
  assert.deepEqual(claims.map(({ meaning, tier }) => ({ meaning, tier })), [
    { meaning: '(목숨을) 앗아 가다', tier: 'silver' },
    { meaning: '주장하다', tier: 'bronze' },
  ]);
});

test('search stays within the selected cumulative or additional range', () => {
  assert.equal(findVocabulary({ tier: 'bronze', query: 'acquired' }).length, 0);
  assert.equal(findVocabulary({ tier: 'silver', scope: 'new', query: ' ACQUIRED ' })[0].term, 'acquired');
  assert.equal(findVocabulary({ tier: 'master', scope: 'new', query: 'acquired' }).length, 0);
  assert.equal(findVocabulary({ tier: 'master', query: 'ａｃｑｕｉｒｅｄ' })[0].term, 'acquired');
});

test('Korean meanings, synonyms, antonyms and sources are searchable', () => {
  for (const query of ['후천적인', 'learned', 'innate', '4과']) {
    assert.ok(findVocabulary({ tier: 'silver', query }).some(({ term }) => term === 'acquired'));
  }
  assert.deepEqual(findVocabulary({ tier: 'master', query: 'does-not-exist-123' }), []);
  assert.deepEqual(findVocabulary({ tier: 'unknown' }), []);
  assert.equal(findVocabulary({ tier: 'bronze', query: '   ' }).length, 64);
});

test('every imported entry has a unique meaning identity, complete fields and a valid tier', () => {
  assert.equal(words.length, 1000);
  assert.equal(new Set(words.map(({ id }) => id)).size, 1000);
  for (const word of words) {
    for (const field of ['term', 'meaning', 'synonyms', 'antonyms']) assert.ok(word[field].trim(), `${word.id}: ${field}`);
    assert.ok(TIERS.some(({ id }) => id === word.tier));
    assert.ok(word.sources.length > 0 && word.sources.every((source) => source.trim()));
  }
  assert.equal(words.find(({ term }) => term === 'captain').antonyms, '[상대어] crew(선원)');
  assert.equal(words.find(({ term }) => term === 'cell').synonyms, '—');
});

test('standalone vocabulary URL detection and state parsing handle valid, invalid, and personal tabs', () => {
  assert.equal(isStandaloneVocabularyUrl(''), false);
  assert.equal(isStandaloneVocabularyUrl('?view=other'), false);
  assert.equal(isStandaloneVocabularyUrl('?view=vocabulary'), true);
  assert.equal(isStandaloneVocabularyUrl('?foo=1&view=vocabulary&tier=master'), true);

  assert.deepEqual(parseVocabularyUrlState(''), {
    personal: false,
    tier: 'bronze',
    scope: 'all',
    query: '',
  });
  assert.deepEqual(parseVocabularyUrlState('?view=vocabulary&tier=gold&scope=new&q=adverse'), {
    personal: false,
    tier: 'gold',
    scope: 'new',
    query: 'adverse',
  });
  assert.deepEqual(parseVocabularyUrlState('?view=vocabulary&tier=diamond&scope=bogus'), {
    personal: false,
    tier: 'bronze',
    scope: 'all',
    query: '',
  });
  assert.deepEqual(parseVocabularyUrlState('?view=vocabulary&tab=personal&q=hello'), {
    personal: true,
    tier: 'bronze',
    scope: 'all',
    query: 'hello',
  });
});

test('buildVocabularyTabUrl and buildGameHomeUrl preserve HTTP and file:// bases safely', () => {
  const httpTab = buildVocabularyTabUrl('https://sword-master.example/app?keep=1', {
    personal: false,
    tier: 'platinum',
    scope: 'new',
    query: '  vital  ',
  });
  assert.equal(httpTab, 'https://sword-master.example/app?keep=1&view=vocabulary&tier=platinum&scope=new&q=vital');
  assert.equal(buildGameHomeUrl(httpTab), 'https://sword-master.example/app?keep=1');

  const filePersonal = buildVocabularyTabUrl('file:///Users/student/sword-master.html?view=vocabulary&tier=gold&scope=new', {
    personal: true,
    tier: 'gold',
    scope: 'new',
    query: '',
  });
  assert.equal(filePersonal, 'file:///Users/student/sword-master.html?view=vocabulary&tab=personal');
  assert.equal(buildGameHomeUrl(filePersonal), 'file:///Users/student/sword-master.html');
});
