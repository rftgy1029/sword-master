import { emptyProgress, gameReducer, reachableNodes } from './engine.js';

export function shouldShowTutorial(progressKey) {
  try {
    return localStorage.getItem(progressKey) === null && localStorage.getItem(`${progressKey}.tutorial`) === null;
  } catch {
    return true;
  }
}

export function rememberTutorial(progressKey) {
  try {
    localStorage.setItem(`${progressKey}.tutorial`, 'seen');
  } catch {
    // The dialog still closes for this session when browser storage is unavailable.
  }
}

export function createPracticeBattle() {
  // Give the learner one strike and a repeatable bronze question, even after a retry.
  const practice = gameReducer(emptyProgress(), { type: 'START', tier: 'bronze', seed: 180 });
  practice.run.deck = [practice.run.deck.find((card) => card.type === 'strike')];
  return gameReducer(practice, { type: 'SELECT_NODE', id: reachableNodes(practice.run)[0].id });
}
