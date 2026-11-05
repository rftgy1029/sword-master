import { useEffect, useId, useRef, useState } from 'react';
import TitleScene from './TitleScene.jsx';
import StoryCharacter from './StoryCharacter.jsx';
import TierCrest from './TierCrest.jsx';
import { TIERS } from '../vocabulary.js';
import { playDungeonEntry } from '../dungeonEntry.js';
import '../dungeon-entry.css';

const PHASE_LABEL = {
  opening: '무거운 석문이 열립니다.', walking: '용사가 문을 향해 걸어갑니다.',
  entering: '어둠 속으로 발걸음을 옮깁니다.', closing: '용사가 들어간 뒤 석문이 닫힙니다.', closed: '던전 안으로…',
};

export default function DungeonEntry({ tier, motionPreference, onComplete }) {
  const stage = useRef(null);
  const heading = useRef(null);
  const clipId = useId();
  const [phase, setPhase] = useState('opening');
  const [systemReduced, setSystemReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const limited = systemReduced || motionPreference !== 'normal';
  const selectedTier = TIERS.find(({ id }) => id === tier);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setSystemReduced(media.matches);
    media.addEventListener('change', change);
    heading.current?.focus({ preventScroll: true });
    return () => media.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    playDungeonEntry(stage.current, { signal: controller.signal, limited, onPhase: setPhase, onComplete });
    return () => controller.abort();
  }, [limited, onComplete]);
  return <main className="entry-screen" data-phase={phase} aria-label="던전 입장" onKeyDown={(event) => {
    if (event.key === 'Escape' && !event.repeat && !event.isComposing && !event.altKey && !event.ctrlKey && !event.metaKey) { event.preventDefault(); onComplete(); }
  }}>
    <p className="entry-tier"><TierCrest tier={tier} small />{selectedTier?.label} · 모험의 시작</p>
    <h1 ref={heading} tabIndex={-1}>문 너머의 세계로</h1>
    <div ref={stage} className="entry-stage">
      <TitleScene motionPreference={motionPreference} hideHero />
      <svg className="entry-actors" viewBox="0 0 384 288" shapeRendering="crispEdges" aria-hidden="true">
        <defs><clipPath id={clipId}><path d="M249 236V114h6v-14h9v-8h35v8h9v14h6v122Z" /></clipPath></defs>
        <g className="entry-hero"><StoryCharacter character="용사" sheathed x="116" y="164" width="62" height="74" /></g>
        <g clipPath={`url(#${clipId})`}>
          <g className="entry-door-left"><path fill="#4b5547" d="M248 91h33v146h-33Z" /><path fill="#68715a" d="M249 91h3v146h-3Z" /><path d="M251 120h30m-30 35h30m-30 35h30m-30 35h30" stroke="#303e35" strokeWidth="2" /><path fill="#9d9665" d="M274 173h4v7h-4Z" /></g>
          <g className="entry-door-right"><path fill="#424e43" d="M281 91h34v146h-34Z" /><path fill="#657058" d="M282 91h2v146h-2Z" /><path d="M284 120h30m-30 35h30m-30 35h30m-30 35h30" stroke="#2d3932" strokeWidth="2" /><path fill="#9d9665" d="M287 173h4v7h-4Z" /></g>
        </g>
      </svg>
    </div>
    <p className="entry-status" role="status">{PHASE_LABEL[phase]}</p>
    <button className="story-text-button entry-skip" onClick={onComplete}>연출 건너뛰기 <kbd>Esc</kbd></button>
  </main>;
}
