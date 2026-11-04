import originalBronze from './data/bronze-story.json' with { type: 'json' };
import direction from './data/bronze-direction.json' with { type: 'json' };

const bronze = { ...originalBronze, id: 'bronze-chapter-01-v2', scenes: originalBronze.scenes.map((scene) => ({
  ...scene, lines: scene.lines.map((line, index) => ({ ...line, ...direction[scene.id]?.[index] })),
})) };

export const STORIES = { bronze };
export const STORY_PROGRESS_KEY = 'sword-master.story-progress.v1';

export function dialogueDelay(line, speed = 1) {
  return Math.round(Math.max(3200, 1400 + line.text.length * 105, line.cue ? 4200 : 0) / speed);
}

export function normalizeStoryProgress(value) {
  const story = Object.hasOwn(STORIES, value?.tier) ? STORIES[value.tier] : null;
  if (!story || (value.storyId !== story.id && value.storyId !== originalBronze.id)) return null;
  const scene = story.scenes.find((item) => item.id === value.sceneId);
  if (!scene || !Number.isInteger(value.lineIndex) || value.lineIndex < 0 || value.lineIndex >= scene.lines.length) return null;
  return {
    tier: story.tier, storyId: story.id, sceneId: scene.id, lineIndex: value.lineIndex,
    completed: value.completed === true && scene === story.scenes.at(-1) && value.lineIndex === scene.lines.length - 1,
  };
}

export function firstStoryProgress(tier) {
  const story = Object.hasOwn(STORIES, tier) ? STORIES[tier] : null;
  if (!story) return null;
  return { tier, storyId: story.id, sceneId: story.scenes[0].id, lineIndex: 0, completed: false };
}

export function moveStory(progress, direction) {
  const current = normalizeStoryProgress(progress);
  if (!current) return null;
  const story = STORIES[current.tier];
  const sceneIndex = story.scenes.findIndex(({ id }) => id === current.sceneId);
  const scene = story.scenes[sceneIndex];
  if (direction < 0) {
    if (current.completed) return { ...current, completed: false };
    if (current.lineIndex > 0) return { ...current, lineIndex: current.lineIndex - 1 };
    if (sceneIndex === 0) return current;
    const previous = story.scenes[sceneIndex - 1];
    return { ...current, sceneId: previous.id, lineIndex: previous.lines.length - 1 };
  }
  if (current.lineIndex < scene.lines.length - 1) return { ...current, lineIndex: current.lineIndex + 1 };
  if (sceneIndex < story.scenes.length - 1) return { ...current, sceneId: story.scenes[sceneIndex + 1].id, lineIndex: 0 };
  return { ...current, completed: true };
}

export function readStoryProgress(storage) {
  try {
    const saved = JSON.parse((storage ?? globalThis.localStorage).getItem(STORY_PROGRESS_KEY));
    return saved?.version === 1 ? normalizeStoryProgress(saved.progress) : null;
  } catch {
    return null;
  }
}

export function saveStoryProgress(progress, storage) {
  const normalized = normalizeStoryProgress(progress);
  if (!normalized) return false;
  try {
    (storage ?? globalThis.localStorage).setItem(STORY_PROGRESS_KEY, JSON.stringify({ version: 1, progress: normalized }));
    return true;
  } catch {
    return false;
  }
}
