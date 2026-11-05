import { ENCOUNTERS, encounterHealth, encounterQuestion } from './battle.js';
import { normalizeStoryProgress } from './story.js';
import { addCoins, CAPES, LENS_PRICE, MAX_LENSES } from './shop.js';

export function shopUnlocked(economy) {
  return economy.storyComplete && ENCOUNTERS.every(({ id }) => economy.cleared.includes(id));
}

export function battleReward(id, session) {
  const encounter = ENCOUNTERS.find((entry) => entry.id === id);
  if (!session || encounter?.mode !== 'combat' || encounterHealth(id, session) !== 0) return 0;
  const correct = session.answers.filter((choice, index) => choice === encounterQuestion(id, session, index).answerIndex).length;
  return (encounter.kind === 'boss' ? 80 : 20) + correct * 5;
}

// Rewards and their receipts share the learning save. Reloading or revisiting a
// result cannot pay twice; a fresh replay session can earn its own reward.
export function settleProgress(learning, progress) {
  let { economy, encounters } = learning;
  for (const { id } of ENCOUNTERS) {
    const session = encounters[id];
    if (!session || encounterHealth(id, session) !== 0) continue;
    if (!economy.cleared.includes(id)) economy = { ...economy, cleared: [...economy.cleared, id] };
    if (!session.rewarded) {
      economy = addCoins(economy, battleReward(id, session));
      encounters = { ...encounters, [id]: { ...session, rewarded: true } };
    }
  }
  if (!economy.storyComplete && normalizeStoryProgress(progress)?.completed) economy = { ...economy, storyComplete: true };
  return economy === learning.economy && encounters === learning.encounters ? learning : { ...learning, economy, encounters };
}

export function transactShop(learning, action, id) {
  const { economy } = learning;
  if (!shopUnlocked(economy)) return learning;
  if (action === 'buy' && id === 'lens') {
    if (economy.coins < LENS_PRICE || economy.lenses >= MAX_LENSES) return learning;
    return { ...learning, economy: { ...economy, coins: economy.coins - LENS_PRICE, lenses: economy.lenses + 1 } };
  }
  const cape = CAPES.find((item) => item.id === id);
  if (!cape) return learning;
  if (action === 'equip' && economy.owned.includes(id) && economy.equipped !== id) return { ...learning, economy: { ...economy, equipped: id } };
  if (action !== 'buy' || economy.owned.includes(id) || economy.coins < cape.price) return learning;
  return { ...learning, economy: { ...economy, coins: economy.coins - cape.price, owned: [...economy.owned, id], equipped: id } };
}

export function useFocusLens(learning, id, session, index) {
  if (!shopUnlocked(learning.economy) || learning.economy.lenses < 1 ||
      !ENCOUNTERS.some((item) => item.id === id) || index !== session.answers.length || encounterHealth(id, session) === 0 ||
      session.hints?.includes(index) || (learning.encounters[id] && learning.encounters[id] !== session)) return learning;
  return { ...learning, economy: { ...learning.economy, lenses: learning.economy.lenses - 1 },
    encounters: { ...learning.encounters, [id]: { ...session, hints: [...(session.hints ?? []), index] } } };
}
