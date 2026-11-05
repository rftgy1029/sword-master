// All run randomness is persisted, including quiz order and rewards.
export function random(run) {
  run.rng = (Math.imul(1664525, run.rng) + 1013904223) >>> 0;
  return run.rng / 4294967296;
}

export function shuffle(items, nextRandom) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
