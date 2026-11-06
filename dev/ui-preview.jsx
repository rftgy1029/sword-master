import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import AdventureDialog from '../src/components/AdventureDialog.jsx';
import { SceneTransitionProvider } from '../src/components/SceneTransition.jsx';
import { emptyProgress, gameReducer, reachableNodes } from '../src/game/engine.js';
import { questionById } from '../src/game/quiz.js';
import '../styles.css';

const scene = new URLSearchParams(location.search).get('scene') ?? 'tier';
function fixture() {
  let p = gameReducer(emptyProgress(), { type: 'START', tier: 'bronze', seed: 22 });
  if (['battle', 'correct', 'wrong'].includes(scene)) {
    p = gameReducer(p, { type: 'SELECT_NODE', id: reachableNodes(p.run)[0].id });
    Object.assign(p.run.battle, { strength: 2, focus: 5 });
    Object.assign(p.run.battle.enemy, { weak: 2, strength: 2, type: 'bat' });
    if (scene !== 'battle') {
      const card = p.run.deck.find((c) => c.type === 'strike');
      for (const pile of ['hand', 'draw', 'discard', 'exhaust']) p.run.battle[pile] = p.run.battle[pile].filter((id) => id !== card.uid);
      p.run.battle.hand.push(card.uid);
      p = gameReducer(p, { type: 'SELECT_CARD', uid: card.uid });
      const question = p.run.battle.pending.question;
      const answers = questionById(question.id).answers;
      const answer = question.options.find((option) => answers.includes(option) === (scene === 'correct'));
      p = gameReducer(p, { type: 'ANSWER', id: question.id, answer });
    }
  }
  return p;
}
function Preview() {
  const [p, setP] = useState(fixture), current = useRef(p);
  const dispatch = (action) => { const next = gameReducer(current.current, action); const changed = next !== current.current; current.current = next; setP(next); return changed; };
  return <div className="app" data-background-motion="normal"><SceneTransitionProvider motionPreference="normal"><AdventureDialog progress={p} dispatch={dispatch} newAdventure={scene === 'tier'} onClose={() => location.reload()} motionPreference="normal" /></SceneTransitionProvider></div>;
}
createRoot(document.getElementById('root')).render(<Preview />);
