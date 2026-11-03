import { banks } from '../data/words.ts';
import type { Difficulty, Mistake, Word } from '../types.ts';
import { rules } from './rules.ts';

function shuffle<T>(array: readonly T[], random: () => number): T[] {
  const a = array.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Owns questions and learning records; it has no DOM or battle dependencies. */
export class Quiz {
  difficulty: Difficulty = 'basic';
  question!: Word;
  choices: Word[] = [];
  locked = false;
  hinted = false;
  attempts = 0;
  correct = 0;
  combo = 0;
  feedbackLeft = 0;
  feedback = '';
  selected: number | null = null;
  revision = 0;
  mistakes = new Map<string, Mistake>();
  private recent: string[] = [];
  private due: { word: Word; at: number }[] = [];
  private random: () => number;

  constructor(random = Math.random) {
    this.random = random;
    this.next();
  }

  reset() {
    this.attempts = 0;
    this.correct = 0;
    this.combo = 0;
    this.recent = [];
    this.due = [];
    this.mistakes.clear();
    this.next();
  }

  setDifficulty(difficulty: Difficulty) {
    this.difficulty = difficulty;
    this.recent = [];
    this.next();
  }

  next() {
    const pool = banks[this.difficulty];
    const previous = this.question?.[0];
    const repeat = this.due.findIndex(d =>
      d.at <= this.attempts && d.word[0] !== previous && pool.some(w => w[0] === d.word[0]),
    );
    if (repeat >= 0) this.question = this.due.splice(repeat, 1)[0].word;
    else {
      const available = pool.filter(w => !this.recent.includes(w[0]));
      this.question = shuffle(available.length ? available : pool, this.random)[0];
    }
    this.recent.push(this.question[0]);
    if (this.recent.length > 5) this.recent.shift();
    // Distinct meanings ensure that every multiple-choice question has one answer.
    const alternatives = [...new Map(pool.filter(w => w[1] !== this.question[1]).map(w => [w[1], w])).values()];
    this.choices = shuffle([this.question, ...shuffle(alternatives, this.random).slice(0, 3)], this.random);
    this.locked = false;
    this.hinted = false;
    this.feedbackLeft = 0;
    this.selected = null;
    this.feedback = '정답으로 에너지를 보급하세요.';
    this.revision++;
  }

  answer(index: number): number | null {
    if (this.locked || !this.choices[index]) return null;
    this.locked = true;
    this.selected = index;
    this.attempts++;
    const ok = this.choices[index][0] === this.question[0];
    let reward = 0;
    if (ok) {
      this.correct++;
      this.combo = this.hinted ? 0 : this.combo + 1;
      reward = this.hinted ? 0 : rules.correctReward + (this.combo % rules.comboEvery === 0 ? rules.comboReward : 0);
      const mistake = this.mistakes.get(this.question[0]);
      if (mistake) mistake.recovered = true;
      this.due = this.due.filter(d => d.word[0] !== this.question[0]);
      this.feedback = this.hinted ? '정답! 힌트 사용으로 이번 보상은 없어요.'
        : `정답! +${reward} ⚡` + (this.combo % rules.comboEvery === 0 ? ' · 연속 정답 보너스!' : '');
      this.feedbackLeft = 1.25;
    } else {
      this.combo = 0;
      const old = this.mistakes.get(this.question[0]);
      this.mistakes.set(this.question[0], {
        meaning: this.question[1], count: (old?.count ?? 0) + 1, recovered: false,
      });
      if (!this.due.some(d => d.word[0] === this.question[0])) {
        this.due.push({ word: this.question, at: this.attempts + 2 });
      }
      this.feedback = `정답은 ‘${this.question[1]}’이에요. 잠시 후 다시 만나요!`;
      this.feedbackLeft = 2.3;
    }
    return reward;
  }

  showHint() {
    if (this.locked || this.hinted) return;
    this.hinted = true;
    this.combo = 0;
    this.feedback = `문장 힌트: ${this.question[2]} (이번 문제 보상 없음)`;
  }

  update(dt: number) {
    if (!this.locked || !Number.isFinite(dt) || dt <= 0) return;
    this.feedbackLeft -= dt;
    if (this.feedbackLeft <= 0) this.next();
  }
}
