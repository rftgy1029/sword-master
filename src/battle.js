import vocabulary from './data/vocabulary.json' with { type: 'json' };
import { emptyEconomy, normalizeEconomy } from './shop.js';

export const BRONZE_WORDS = vocabulary.filter(({ tier }) => tier === 'bronze');
const byId = new Map(BRONZE_WORDS.map((word) => [word.id, word]));
export const LEARNING_KEY = 'sword-master.bronze-learning.v1';
export const ENCOUNTERS = [
  { id: 'slime', title: '통로의 작은 슬라임', enemy: '작은 슬라임', kind: 'slime', mode: 'combat', wordStart: 0, wordCount: 4, objective: '검의 주문을 읽고 달려드는 슬라임을 물러나게 하세요.', success: '슬라임이 바닥 틈으로 도망갔어요. 통로 끝으로 나아갈 수 있습니다.', types: ['meaning'], correctFeedback: '주문의 뜻에 힘을 실어 검을 휘두릅니다.', incorrectFeedback: '검을 세워 공격을 막았어요. 뜻을 확인하고 다음 빈틈을 노려요.', watchLines: ['칼날의 해독 문양이 빛나기 시작합니다.', '용사가 공격을 막고, 빛을 실어 검을 휘두릅니다.'] },
  { id: 'rescue', title: '모모를 구해라!', enemy: '풍선 몬스터', kind: 'balloon', mode: 'combat', wordStart: 4, wordCount: 6, objective: '계약 스티커의 명령을 해독해 모모를 풀어 주세요.', success: '계약 스티커 해제! 모모가 용사 뒤로 숨었어요.', types: ['meaning'] },
  { id: 'signs', title: '뒤집힌 길 안내', enemy: '돌아간 안내 표지판', kind: 'sign', mode: 'puzzle', wordStart: 10, wordCount: 10, objective: '안내 문구를 읽고 무대로 가는 화살표를 맞춰 주세요.', success: '표지판 고정 완료! 직원의 안내를 받아 골목으로 향합니다.', types: ['meaning'], correctFeedback: '안내 문구를 읽었어요. 화살표가 제자리를 찾습니다.', incorrectFeedback: '뜻을 다시 확인해 보세요. 니아가 안내판을 비춰 줍니다.', questionPrompt: '이 안내 문구는 무슨 뜻일까요?', watchLines: ['모모가 돌아가는 표지판을 받칩니다.', '용사가 문구를 읽고 고정쇠와 화살표를 맞춥니다.'] },
  { id: 'alley', title: '고장 난 그림 인형', enemy: '왕관을 노리는 그림 인형', kind: 'alley', mode: 'combat', wordStart: 20, wordCount: 10, objective: '주민들이 대피할 시간을 벌고, 잘못된 수거 명령을 끊어 주세요.', success: '인형이 멈췄어요. 왕관과 주민들은 무사하고, 무대 뒷길이 보입니다.', types: ['meaning', 'synonyms'] },
  { id: 'backdoor', title: '잠긴 소품 문', enemy: '봉인된 마법판', kind: 'seal', mode: 'puzzle', wordStart: 30, wordCount: 10, objective: '문을 잠근 명령을 해독해 대본의 흔적을 따라가세요.', success: '봉인이 풀렸어요. 소품이 떠다니는 방이 나타납니다.', types: ['meaning'] },
  { id: 'props', title: '서로 반대되는 명령', enemy: '폭주하는 무대 소품', kind: 'props', mode: 'puzzle', wordStart: 40, wordCount: 10, objective: '뜻과 반대 표현을 찾아 충돌하는 명령을 멈춰 주세요.', success: '소품들이 제자리로 돌아갔어요. 니아가 달려옵니다.', types: ['meaning', 'antonyms'] },
  { id: 'ads', title: '광고 괴물 · 거짓 분신', enemy: '광고 괴물의 분신', kind: 'boss', mode: 'combat', wordStart: 50, wordCount: 10, objective: '과장된 광고를 해독해 가짜 분신부터 지워 주세요.', success: '분신이 사라졌어요. 광고 괴물이 마지막 가면을 꺼냅니다.', types: ['meaning', 'synonyms'] },
  { id: 'boss', title: '광고 괴물 · 마지막 방송', enemy: '떠들썩한 광고 괴물', kind: 'boss', mode: 'combat', wordStart: 60, wordCount: 4, objective: '뒤집힌 명령을 바로잡고 마지막 광고판을 무너뜨리세요.', success: '방송 종료! 간판이 무너지는 순간, 낯선 문양이 스칩니다.', types: ['meaning', 'synonyms', 'antonyms'] },
];

export function encounterAction(encounter, phase) {
  const actions = encounter.mode === 'puzzle'
    ? { correct: 'solve', incorrect: 'hint', complete: 'restored', ready: 'ready' }
    : { correct: 'slash', incorrect: 'guard', complete: 'victory', ready: 'ready' };
  return actions[phase] ?? 'ready';
}

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

export function emptyLearning() { return { encounters: {}, history: [], economy: emptyEconomy() }; }

function answerHistory(learning) {
  if (Array.isArray(learning.history)) return learning.history;
  return ENCOUNTERS.flatMap(({ id }) => {
    const session = learning.encounters[id];
    return session ? session.answers.map((choice, index) => ({ encounterId: id, wordId: session.wordIds[index % session.wordIds.length], index, choice })) : [];
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
  const encounter = ENCOUNTERS.find((item) => item.id === id);
  if (!encounter) return null;
  const words = BRONZE_WORDS.slice(encounter.wordStart, encounter.wordStart + encounter.wordCount).map(({ id: wordId }) => wordId);
  if (id === 'boss') {
    const preferred = [...new Set(getMistakes(learning).map(({ word }) => word.id))];
    const earlier = [...preferred, ...BRONZE_WORDS.slice(0, 60).map(({ id: wordId }) => wordId)];
    for (const wordId of earlier) {
      if (!words.includes(wordId)) words.push(wordId);
      if (words.length >= 10) break;
    }
  }
  return { wordIds: words, answers: [], ...(id === 'slime' ? { combat: { skillUses: [] } } : {}) };
}

export function encounterQuestion(id, session, index = session.answers.length) {
  return makeQuestion(id, session.wordIds[id === 'slime' ? index % session.wordIds.length : index], index);
}

export function lensRemovedChoice(question, session, index) {
  return question && session.hints?.includes(index) ? question.options.findIndex((_, i) => i !== question.answerIndex) : -1;
}

// Persist casts at their answer positions, so health and charge always replay
// together. An interrupted cinematic cannot refund a cast or apply it twice.
export function slimeCombat(session) {
  const uses = session.combat?.skillUses ?? [];
  if (!Array.isArray(uses) || new Set(uses).size !== uses.length ||
      uses.some((at) => !Number.isInteger(at) || at < 1 || at > session.answers.length) || session.answers.length > 5) return null;
  let hp = 100, streak = 0, charged = false;
  for (let index = 0; index < session.answers.length; index++) {
    if (hp === 0) return null;
    const question = encounterQuestion('slime', session, index);
    hp = Math.max(0, hp - 20);
    if (!charged) {
      streak = session.answers[index] === question.answerIndex ? streak + 1 : 0;
      charged = streak === 3;
    }
    if (uses.includes(index + 1)) {
      if (!charged || hp === 0) return null;
      hp = Math.max(0, hp - 40);
      streak = 0; charged = false;
    }
  }
  if (session.combat?.legacyComplete === true) {
    if (session.answers.length !== 4 || uses.length) return null;
    hp = 0;
  }
  return { hp, streak, charged: charged && hp > 0 };
}

export function encounterHealth(id, session) {
  return id === 'slime' ? slimeCombat(session).hp : Math.max(0, Math.ceil(100 * (session.wordIds.length - session.answers.length) / session.wordIds.length));
}

export function activateSlimeSkill(learning, session) {
  if (learning.encounters.slime !== session || !slimeCombat(session)?.charged) return learning;
  return { ...learning, encounters: { ...learning.encounters, slime: {
    ...session, combat: { skillUses: [...session.combat.skillUses, session.answers.length] },
  } } };
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
  if (index !== session.answers.length || encounterHealth(id, session) === 0 ||
      index >= (id === 'slime' ? 5 : session.wordIds.length)) return learning;
  const question = encounterQuestion(id, session, index);
  if (!Number.isInteger(choice) || choice < 0 || choice >= question.options.length || choice === lensRemovedChoice(question, session, index)) return learning;
  return {
    ...learning,
    encounters: { ...learning.encounters, [id]: { ...session, wordIds: [...session.wordIds], answers: [...session.answers, choice] } },
    history: [...answerHistory(learning), { encounterId: id, wordId: question.word.id, index, choice }],
  };
}

export function readLearning(storage) {
  try {
    const raw = JSON.parse((storage ?? globalThis.localStorage).getItem(LEARNING_KEY));
    if (raw?.version !== 1 || !raw.encounters || typeof raw.encounters !== 'object') return emptyLearning();
    const result = emptyLearning();
    result.economy = normalizeEconomy(raw.economy, ENCOUNTERS.map(({ id }) => id));
    const legacyHistory = [];
    for (const { id } of ENCOUNTERS) {
      let session = raw.encounters[id];
      let migrated = false;
      if (id === 'rescue' && Array.isArray(session?.wordIds) && session.wordIds.length === 10 &&
          session.wordIds.every((wordId, index) => wordId === BRONZE_WORDS[index].id) &&
          Array.isArray(session.answers) && session.answers.length <= 10 && session.answers.every((choice, index) =>
            Number.isInteger(choice) && choice >= 0 && choice < makeQuestion(id, session.wordIds[index], index).options.length)) {
        legacyHistory.push(...session.answers.map((choice, index) => ({ encounterId: id, wordId: session.wordIds[index], index, choice })));
        session = { wordIds: session.wordIds.slice(4), answers: session.answers.slice(4) };
        migrated = true;
      }
      const expected = createEncounter(id, result);
      if (!session || !Array.isArray(session.wordIds) || !Array.isArray(session.answers) ||
          session.wordIds.length !== expected.wordIds.length || new Set(session.wordIds).size !== session.wordIds.length ||
          session.answers.length > (id === 'slime' ? 5 : session.wordIds.length) || session.wordIds.some((wordId, index) =>
            !byId.has(wordId) || (id !== 'boss' && wordId !== expected.wordIds[index]) || (id === 'boss' && index < 4 && wordId !== expected.wordIds[index]))) continue;
      if (session.answers.some((choice, index) => !Number.isInteger(choice) || choice < 0 || choice >= encounterQuestion(id, session, index).options.length)) continue;
      const restored = { wordIds: [...session.wordIds], answers: [...session.answers] };
      if (session.rewarded === true) restored.rewarded = true;
      if (Array.isArray(session.hints)) {
        const hints = [...new Set(session.hints.filter((index) => Number.isInteger(index) && index >= 0 && index <= session.answers.length && index < (id === 'slime' ? 5 : session.wordIds.length)))];
        if (hints.length) restored.hints = hints;
      }
      if (id === 'slime') {
        if (session.combat !== undefined && (!session.combat || !Array.isArray(session.combat.skillUses))) continue;
        restored.combat = session.combat ? { skillUses: [...session.combat.skillUses], ...(session.combat.legacyComplete === true ? { legacyComplete: true } : {}) }
          : { skillUses: [], ...(session.answers.length === 4 ? { legacyComplete: true } : {}) };
        if (!slimeCombat(restored)) continue;
      }
      result.encounters[id] = restored;
      if (!migrated) legacyHistory.push(...session.answers.map((choice, index) => ({ encounterId: id, wordId: session.wordIds[index % session.wordIds.length], index, choice })));
    }
    if (Array.isArray(raw.history)) {
      result.history = raw.history.filter((event) => {
        if (!event || !Number.isInteger(event.index) || event.index < 0 || event.index >= 10 || !Number.isInteger(event.choice)) return false;
        const question = makeQuestion(event.encounterId, event.wordId, event.index);
        return question && event.choice >= 0 && event.choice < question.options.length;
      }).map(({ encounterId, wordId, index, choice }) => ({ encounterId, wordId, index, choice }));
    } else result.history = legacyHistory;
    return result;
  } catch { return emptyLearning(); }
}

export function saveLearning(learning, storage) {
  try {
    (storage ?? globalThis.localStorage).setItem(LEARNING_KEY, JSON.stringify({ version: 1, encounters: learning.encounters, history: answerHistory(learning), economy: learning.economy }));
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
