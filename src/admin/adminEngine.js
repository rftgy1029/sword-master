import { CARDS } from '../game/catalog.js';
import { gameReducer, intentFor, unlockedTierIds } from '../game/engine.js';
import { isCorrectAnswer, questionById } from '../game/quiz.js';
import { random, shuffle } from '../game/random.js';
import { TIERS } from '../vocabulary.js';
import { DEFAULT_ADMIN_CHEATS } from './adminState.js';

function cloneProgress(current) {
  const { wordbooks, ...mutable } = current;
  const next = structuredClone(mutable);
  if (wordbooks) next.wordbooks = wordbooks;
  return next;
}

function clampInt(value, min, max, fallback) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function pickQuizAnswer(question, wordbooks = [], correct = true) {
  if (!question) return null;
  const source = questionById(question.id, wordbooks);
  if (!source) return null;
  if (question.mode === 'typing') {
    if (correct) return source.answers[0] ?? source.word.term;
    const candidate = '__admin_wrong__';
    return isCorrectAnswer(question, candidate, wordbooks) ? '__admin_wrong_2__' : candidate;
  }
  return question.options.find((option) => isCorrectAnswer(question, option, wordbooks) === correct) ?? null;
}

function applyOneHitKill(battle) {
  if (!battle || battle.effect?.kind !== 'attack') return;
  const remaining = battle.enemy.hp;
  if (remaining <= 0 && battle.enemy.block <= 0) return;
  battle.enemy.block = 0;
  battle.enemy.hp = 0;
  if (remaining > 0) {
    battle.effect.amount += remaining;
    if (Array.isArray(battle.effect.impacts) && battle.effect.impacts.length > 0) {
      battle.effect.impacts[battle.effect.impacts.length - 1] += remaining;
    }
    if (battle.log?.length) {
      battle.log[0] = `${battle.log[0]} · 원킬`;
    }
  }
}

export function createAdminReducer(getCheats) {
  return function adminGameReducer(current, action) {
    const cheats = { ...DEFAULT_ADMIN_CHEATS, ...(typeof getCheats === 'function' ? getCheats() : getCheats) };

    if (action.type === 'START' && cheats.unlockAllTiers && TIERS.some((t) => t.id === action.tier)) {
      if (unlockedTierIds(current).includes(action.tier)) {
        return gameReducer(current, action);
      }
      const temp = cloneProgress(current);
      temp.learning.clears = { ...temp.learning.clears, platinum: 1 };
      const started = gameReducer(temp, action);
      if (started === temp) return current;
      started.learning.clears = structuredClone(current.learning.clears);
      return started;
    }

    if (action.type === 'SELECT_CARD' && cheats.infiniteEnergy) {
      const run = current.run;
      if (run?.phase !== 'battle' || run.battle.pending || run.battle.feedback) return current;
      const card = run.deck.find((c) => c.uid === action.uid);
      if (!card || !run.battle.hand.includes(card.uid)) return current;
      const savedEnergy = run.battle.energy;
      const temp = cloneProgress(current);
      temp.run.battle.energy = Math.max(savedEnergy, CARDS[card.type].cost);
      const next = gameReducer(temp, action);
      if (next === temp) return current;
      next.run.battle.energy = Math.max(3, savedEnergy);
      return next;
    }

    if (action.type === 'ANSWER' && cheats.oneHitKill) {
      const next = gameReducer(current, action);
      if (next === current) return current;
      if (next.run?.phase === 'battle' && next.run.battle?.feedback?.correct) {
        applyOneHitKill(next.run.battle);
      }
      return next;
    }

    if (action.type === 'END_TURN' && cheats.invincible) {
      const run = current.run;
      if (run?.phase !== 'battle' || run.battle.pending || run.battle.feedback) return current;
      const intent = intentFor(run.battle.enemy);
      if (intent.kind !== 'attack') return gameReducer(current, action);
      const temp = cloneProgress(current);
      const shield = intent.value * (intent.hits ?? 1) + 999;
      temp.run.battle.block = Math.max(temp.run.battle.block, shield);
      const next = gameReducer(temp, action);
      if (next === temp) return current;
      next.run.battle.log[0] = `${intent.label} · 무적 · HP −0`;
      return next;
    }

    if (action.type === 'ADMIN_SKIP_PLAY_CARD') {
      const run = current.run;
      if (run?.phase !== 'battle' || run.battle.pending || run.battle.feedback) return current;
      const card = run.deck.find((c) => c.uid === action.uid);
      if (!card || !run.battle.hand.includes(card.uid)) return current;
      const cost = CARDS[card.type].cost;
      if (!cheats.infiniteEnergy && cost > run.battle.energy) return current;

      const savedLearning = structuredClone(current.learning);
      const savedAnswers = run.answers;
      const savedCorrect = run.correct;
      const savedUsed = [...run.battle.used];
      const savedStreak = run.battle.streak;
      const savedEnergy = run.battle.energy;

      const temp = cloneProgress(current);
      temp.run.battle.streak = 0;
      if (cheats.infiniteEnergy) temp.run.battle.energy = Math.max(savedEnergy, cost);

      const selected = gameReducer(temp, { type: 'SELECT_CARD', uid: action.uid });
      if (selected === temp || !selected.run?.battle?.pending) return current;

      const question = selected.run.battle.pending.question;
      const answer = pickQuizAnswer(question, selected.wordbooks ?? [], true);
      if (answer === null) return current;

      const resolved = gameReducer(selected, { type: 'ANSWER', id: question.id, answer });
      if (resolved === selected) return current;

      resolved.learning = savedLearning;
      resolved.run.answers = savedAnswers;
      resolved.run.correct = savedCorrect;
      resolved.run.battle.used = savedUsed;
      resolved.run.battle.streak = savedStreak;
      resolved.run.battle.feedback = null;
      if (cheats.infiniteEnergy) {
        resolved.run.battle.energy = Math.max(3, savedEnergy);
      }
      if (cheats.oneHitKill) {
        applyOneHitKill(resolved.run.battle);
      }
      if (resolved.run.battle.log?.length) {
        resolved.run.battle.log[0] = `[스킵] ${resolved.run.battle.log[0]}`;
      }
      return resolved;
    }

    if (action.type === 'ADMIN_FINISH_VICTORY') {
      const run = current.run;
      if (run?.phase !== 'battle' || !run.battle || run.battle.pending || run.battle.enemy.hp > 0) return current;
      const temp = cloneProgress(current);
      temp.run.battle.feedback = temp.run.battle.feedback ?? { admin: true };
      return gameReducer(temp, { type: 'ACK' });
    }

    if (action.type === 'ADMIN_KILL_ENEMY') {
      const run = current.run;
      if (run?.phase !== 'battle' || !run.battle) return current;
      const temp = cloneProgress(current);
      const b = temp.run.battle;
      if (b.pending) {
        b.discard.push(b.pending.uid);
        b.pending = null;
      }
      b.enemy.block = 0;
      b.enemy.hp = 0;
      b.feedback = { admin: true };
      return gameReducer(temp, { type: 'ACK' });
    }

    if (action.type === 'ADMIN_DRAW_CARDS') {
      const run = current.run;
      if (run?.phase !== 'battle' || !run.battle || run.battle.pending || run.battle.feedback) return current;
      const count = clampInt(action.count ?? 1, 1, 10, 1);
      const next = cloneProgress(current);
      const b = next.run.battle;
      const before = b.hand.length;
      for (let i = 0; i < count && b.hand.length < 10; i++) {
        if (!b.draw.length) {
          b.draw = shuffle(b.discard, () => random(next.run));
          b.discard = [];
        }
        if (!b.draw.length) break;
        b.hand.push(b.draw.pop());
      }
      if (b.hand.length === before) return current;
      return next;
    }

    if (action.type === 'ADMIN_MODIFY_STATS') {
      const run = current.run;
      if (!run || run.phase === 'result' || !action.patch || typeof action.patch !== 'object') return current;
      const next = cloneProgress(current);
      const nextRun = next.run;
      const patch = action.patch;
      let changed = false;

      if (patch.maxHp !== undefined) {
        const value = clampInt(patch.maxHp, 1, 999, nextRun.maxHp);
        if (value !== nextRun.maxHp) {
          nextRun.maxHp = value;
          nextRun.hp = Math.min(nextRun.hp, value);
          changed = true;
        }
      }
      if (patch.hp !== undefined) {
        const value = clampInt(patch.hp, 1, nextRun.maxHp, nextRun.hp);
        if (value !== nextRun.hp) {
          nextRun.hp = value;
          changed = true;
        }
      }
      if (patch.gold !== undefined) {
        const value = clampInt(patch.gold, 0, 99999, nextRun.gold);
        if (value !== nextRun.gold) {
          nextRun.gold = value;
          changed = true;
        }
      }

      if (nextRun.phase === 'battle' && nextRun.battle) {
        const b = nextRun.battle;
        const battleFields = [
          ['energy', 0, 9],
          ['block', 0, 999],
          ['strength', 0, 999],
          ['focus', 0, 999],
        ];
        for (const [key, min, max] of battleFields) {
          if (patch[key] !== undefined) {
            const value = clampInt(patch[key], min, max, b[key]);
            if (value !== b[key]) {
              b[key] = value;
              changed = true;
            }
          }
        }
        if (patch.enemyHp !== undefined) {
          const value = clampInt(patch.enemyHp, 1, b.enemy.maxHp, b.enemy.hp);
          if (value !== b.enemy.hp) {
            b.enemy.hp = value;
            changed = true;
          }
        }
        const enemyFields = [
          ['enemyBlock', 'block', 0, 999],
          ['enemyStrength', 'strength', 0, 999],
          ['enemyWeak', 'weak', 0, 99],
        ];
        for (const [patchKey, enemyKey, min, max] of enemyFields) {
          if (patch[patchKey] !== undefined) {
            const value = clampInt(patch[patchKey], min, max, b.enemy[enemyKey]);
            if (value !== b.enemy[enemyKey]) {
              b.enemy[enemyKey] = value;
              changed = true;
            }
          }
        }
      }

      return changed ? next : current;
    }

    return gameReducer(current, action);
  };
}
