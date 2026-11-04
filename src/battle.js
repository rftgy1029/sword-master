import vocabulary from './data/vocabulary.json' with { type: 'json' };

export const BRONZE_WORDS = vocabulary.filter(({ tier }) => tier === 'bronze');
const byId = new Map(BRONZE_WORDS.map((word) => [word.id, word]));
export const LEARNING_KEY = 'sword-master.bronze-learning.v1';
export const ENCOUNTERS = [
  { id: 'rescue', title: '모모를 구해라!', enemy: '풍선 몬스터', kind: 'balloon', objective: '계약 스티커의 명령을 해독해 모모를 풀어 주세요.', success: '계약 스티커 해제! 모모가 용사 뒤로 숨었어요.', types: ['meaning'] },
  { id: 'signs', title: '뒤집힌 길 안내', enemy: '고장 난 마법 표지판', kind: 'sign', objective: '표지판의 뜻을 바로잡아 다음 길을 열어 주세요.', success: '화살표가 제자리를 찾았어요. 골목으로 가는 길이 열립니다.', types: ['meaning'] },
  { id: 'alley', title: '장난꾸러기의 그림 미로', enemy: '골목 몬스터', kind: 'alley', objective: '뜻과 비슷한 표현을 찾아 그림 타일을 되돌려 주세요.', success: '그림 타일 정렬 완료! 몬스터가 무대 뒷길을 가리킵니다.', types: ['meaning', 'synonyms'] },
  { id: 'backdoor', title: '잠긴 소품 문', enemy: '봉인된 마법판', kind: 'seal', objective: '문을 잠근 명령을 해독해 대본의 흔적을 따라가세요.', success: '봉인이 풀렸어요. 소품이 떠다니는 방이 나타납니다.', types: ['meaning'] },
  { id: 'props', title: '서로 반대되는 명령', enemy: '폭주하는 무대 소품', kind: 'props', objective: '뜻과 반대 표현을 찾아 충돌하는 명령을 멈춰 주세요.', success: '소품들이 제자리로 돌아갔어요. 니아가 달려옵니다.', types: ['meaning', 'antonyms'] },
  { id: 'ads', title: '광고 괴물 · 거짓 분신', enemy: '광고 괴물의 분신', kind: 'boss', objective: '과장된 광고를 해독해 가짜 분신부터 지워 주세요.', success: '분신이 사라졌어요. 광고 괴물이 마지막 가면을 꺼냅니다.', types: ['meaning', 'synonyms'] },
  { id: 'boss', title: '광고 괴물 · 마지막 방송', enemy: '떠들썩한 광고 괴물', kind: 'boss', objective: '뒤집힌 명령을 바로잡고 마지막 광고판을 무너뜨리세요.', success: '방송 종료! 간판이 무너지는 순간, 낯선 문양이 스칩니다.', types: ['meaning', 'synonyms', 'antonyms'] },
];

function hash(value) {
  let result = 2166136261;
  for (const character of value) result = Math.imul(result ^ character.charCodeAt(0), 16777619) >>> 0;
  return result;
}

function shuffled(values, seed) {
  return [...values].map((value, index) => ({ value, order: hash(`${seed}:${index}`) }))
    .sort((a, b) => a.order - b.order).map(({ value }) => value);
}

function relation(word, type) {
  if (type === 'meaning') return word.meaning;
  const value = word[type];
  if (!value || value === '—' || value.includes('[상대어]')) return null;
  return value.replace(/[①②③④⑤]/g, '').trim();
}

function englishTokens(value) {
  return value.toLowerCase().replace(/\([^)]*\)/g, '').replace(/[①②③④⑤]/g, '')
    .split(',').map((token) => token.trim()).filter(Boolean);
}

function related(a, b) {
  const tokens = englishTokens(`${a.term},${a.synonyms}`);
  if (englishTokens(`${b.term},${b.synonyms}`).some((token) => tokens.includes(token))) return true;
  const korean = a.meaning.match(/[가-힣]{3}/g) ?? [];
  return korean.some((token) => b.meaning.includes(token));
}

export function emptyLearning() { return { encounters: {}, history: [] }; }

function answerHistory(learning) {
  if (Array.isArray(learning.history)) return learning.history;
  return ENCOUNTERS.flatMap(({ id }) => {
    const session = learning.encounters[id];
    return session ? session.answers.map((choice, index) => ({ encounterId: id, wordId: session.wordIds[index], index, choice })) : [];
  });
}

export function getMistakes(learning) {
  const latest = new Map();
  for (const event of answerHistory(learning)) {
    const question = makeQuestion(event.encounterId, event.wordId, event.index);
    latest.set(`${question.word.id}:${question.type}`, { ...question, correct: event.choice === question.answerIndex });
  }
  return [...latest.values()].filter(({ correct }) => !correct);
}

export function createEncounter(id, learning = emptyLearning()) {
  const index = ENCOUNTERS.findIndex((item) => item.id === id);
  if (index < 0) return null;
  const words = BRONZE_WORDS.slice(index * 10, index * 10 + 10).map(({ id: wordId }) => wordId);
  if (id === 'boss') {
    const preferred = [...new Set(getMistakes(learning).map(({ word }) => word.id))];
    const earlier = [...preferred, ...BRONZE_WORDS.slice(0, 60).map(({ id: wordId }) => wordId)];
    for (const wordId of earlier) {
      if (!words.includes(wordId)) words.push(wordId);
      if (words.length >= 10) break;
    }
  }
  return { wordIds: words, answers: [] };
}

export function makeQuestion(encounterId, wordId, index) {
  const encounter = ENCOUNTERS.find(({ id }) => id === encounterId);
  const word = byId.get(wordId);
  if (!encounter || !word) return null;
  let type = encounter.types[index % encounter.types.length];
  if (!relation(word, type)) type = 'meaning';
  const answer = relation(word, type);
  const answerTokens = englishTokens(answer);
  const candidates = BRONZE_WORDS.filter((other) => other.id !== word.id && !related(word, other))
    .map((other) => relation(other, type)).filter((value) => value && value !== answer &&
      (type === 'meaning' || !englishTokens(value).some((token) => answerTokens.includes(token))));
  const wrong = shuffled([...new Set(candidates)], `${encounterId}:${wordId}:wrong`).slice(0, 3);
  const options = shuffled([answer, ...wrong], `${encounterId}:${wordId}:options`);
  return { encounterId, word, type, options, answerIndex: options.indexOf(answer), answer,
    term: word.term.replace(/\s*\([^)]*[가-힣][^)]*\)/g, '').trim(),
    prompt: type === 'meaning' ? '이 명령의 뜻은 무엇일까요?' : type === 'synonyms' ? '단어장에 등록된 유의어를 고르세요.' : '단어장에 등록된 반의어를 고르세요.' };
}

export function recordAnswer(learning, id, session, index, choice) {
  if (index !== session.answers.length || index >= session.wordIds.length) return learning;
  const question = makeQuestion(id, session.wordIds[index], index);
  if (!Number.isInteger(choice) || choice < 0 || choice >= question.options.length) return learning;
  return {
    encounters: { ...learning.encounters, [id]: { wordIds: [...session.wordIds], answers: [...session.answers, choice] } },
    history: [...answerHistory(learning), { encounterId: id, wordId: session.wordIds[index], index, choice }],
  };
}

export function readLearning(storage) {
  try {
    const raw = JSON.parse((storage ?? globalThis.localStorage).getItem(LEARNING_KEY));
    if (raw?.version !== 1 || !raw.encounters || typeof raw.encounters !== 'object') return emptyLearning();
    const result = emptyLearning();
    for (const { id } of ENCOUNTERS) {
      const session = raw.encounters[id];
      const expected = createEncounter(id, result);
      if (!session || !Array.isArray(session.wordIds) || !Array.isArray(session.answers) ||
          session.wordIds.length !== expected.wordIds.length || new Set(session.wordIds).size !== session.wordIds.length ||
          session.answers.length > session.wordIds.length || session.wordIds.some((wordId, index) =>
            !byId.has(wordId) || (id !== 'boss' && wordId !== expected.wordIds[index]) || (id === 'boss' && index < 4 && wordId !== expected.wordIds[index]))) continue;
      if (session.answers.some((choice, index) => !Number.isInteger(choice) || choice < 0 || choice >= makeQuestion(id, session.wordIds[index], index).options.length)) continue;
      result.encounters[id] = { wordIds: [...session.wordIds], answers: [...session.answers] };
    }
    if (Array.isArray(raw.history)) {
      result.history = raw.history.filter((event) => {
        if (!event || !Number.isInteger(event.index) || event.index < 0 || event.index >= 10 || !Number.isInteger(event.choice)) return false;
        const question = makeQuestion(event.encounterId, event.wordId, event.index);
        return question && event.choice >= 0 && event.choice < question.options.length;
      }).map(({ encounterId, wordId, index, choice }) => ({ encounterId, wordId, index, choice }));
    } else result.history = answerHistory({ encounters: result.encounters });
    return result;
  } catch { return emptyLearning(); }
}

export function saveLearning(learning, storage) {
  try {
    (storage ?? globalThis.localStorage).setItem(LEARNING_KEY, JSON.stringify({ version: 1, encounters: learning.encounters, history: answerHistory(learning) }));
    return true;
  } catch { return false; }
}

export function learningSummary(learning) {
  const learned = new Set();
  let correct = 0;
  let answered = 0;
  for (const event of answerHistory(learning)) {
    const question = makeQuestion(event.encounterId, event.wordId, event.index);
    learned.add(question.word.id);
    answered++;
    if (event.choice === question.answerIndex) correct++;
  }
  return { answered, correct, learned: learned.size, mistakes: getMistakes(learning) };
}
