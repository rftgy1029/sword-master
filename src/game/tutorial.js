import { emptyProgress, gameReducer, reachableNodes } from './engine.js';

export function createPracticeBattle() {
  // Give the learner one strike and a repeatable bronze question, even after a retry.
  const practice = gameReducer(emptyProgress(), { type: 'START', tier: 'bronze', seed: 180 });
  practice.run.deck = [practice.run.deck.find((card) => card.type === 'strike')];
  return gameReducer(practice, { type: 'SELECT_NODE', id: reachableNodes(practice.run)[0].id });
}
