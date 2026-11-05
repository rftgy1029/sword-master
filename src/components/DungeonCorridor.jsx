import StoryCharacter from './StoryCharacter.jsx';
import { useEffect, useRef, useState } from 'react';
import { playSlimeSkill } from '../slimeSkill.js';
import EnemyHealth from './EnemyHealth.jsx';

export default function DungeonCorridor({ lineIndex, cue, enemyState, paused, battleVisual, limitedMotion, audio, soundEnabled, onSkillComplete }) {
  const stage = useRef(null);
  const playback = useRef(null);
  const [impactToken, setImpactToken] = useState(null);
  const skill = battleVisual?.skill;
  useEffect(() => {
    if (!skill) return;
    const player = playSlimeSkill(stage.current, { type: skill.type, limited: limitedMotion, audio, soundEnabled,
      onImpact: () => setImpactToken(skill.token), onComplete: () => onSkillComplete(skill.token) });
    playback.current = player;
    return () => { player.cancel(); playback.current = null; };
  }, [skill, limitedMotion, audio, soundEnabled, onSkillComplete]);
  useEffect(() => {
    if (paused) playback.current?.pause(); else playback.current?.resume();
  }, [paused, skill, limitedMotion, soundEnabled]);
  const action = battleVisual?.action ?? cue;
  const token = battleVisual?.token ?? `corridor-${lineIndex}`;
  const visibleSlime = enemyState === 'hostile' || enemyState === 'retreating';
  const warmExit = enemyState === 'gone';
  const heroX = lineIndex >= 12 ? 360 : 170;
  return <div ref={stage} className={`story-art story-art-corridor cue-${cue} action-${action}${battleVisual ? ' is-fighting slime-stage' : ''}${skill ? ' has-skill' : ''}${limitedMotion ? ' skill-limited' : ''}`} data-paused={paused} data-skill-type={skill?.type} data-skill-token={skill?.token}>
    <svg className="story-panorama corridor-panorama" viewBox={battleVisual ? '110 100 430 200' : '0 0 640 300'} shapeRendering="crispEdges" role="img" aria-label={visibleSlime ? '지하 통로의 돌기둥과 횃불 아래, 용사와 작은 푸른 슬라임이 마주하고 있다.' : '돌기둥과 횃불이 길게 이어진 지하 통로. 용사가 끝에 있는 문을 바라본다.'}>
      <rect width="640" height="300" fill="#121e24" />
      <path fill="#233239" d="M0 0h640v55L520 90 0 38Z" />
      <path fill="#293b40" d="M0 38 515 91v101L0 266Z" />
      <path fill="#1d2e37" d="m640 45-92 47v102l92 73Z" />
      <path fill="#324348" d="m0 266 515-74h33l92 75v33H0Z" />
      {Array.from({ length: 8 }, (_, row) => <path key={row} d={`M0 ${52 + row * 27} 514 ${95 + row * 12}`} fill="none" stroke="#182b32" strokeWidth="3" />)}
      {Array.from({ length: 7 }, (_, column) => <path key={column} d={`M${column * 90} 38v${228 - column * 15}`} fill="none" stroke="#1a2d34" strokeWidth="3" />)}
      {[[32, 37, 31, 220], [204, 60, 23, 171], [351, 79, 17, 132], [449, 91, 10, 108]].map(([x, y, w, h]) => <g key={x}>
        <rect x={x} y={y} width={w} height={h} fill="#3c504f" /><rect x={x + w - 5} y={y} width="5" height={h} fill="#20343a" />
        <rect x={x - 5} y={y} width={w + 10} height="6" fill="#5a6556" /><rect x={x - 4} y={y + h - 5} width={w + 8} height="7" fill="#46584f" />
        {[1, 2, 3, 4].map((part) => <rect key={part} x={x} y={y + part * h / 5} width={w} height="2" fill="#1d3339" />)}
      </g>)}
      <path fill="#0c1920" d="M504 99h51v94h-51Z" /><path fill="#3e5150" d="M499 94h61v7h-61Zm0 7h5v93h-5Zm56 0h5v93h-5Z" />
      <rect x="511" y="105" width="37" height="80" fill={warmExit ? '#a48b65' : '#1b313a'} />
      <rect x="529" y="105" width={warmExit ? 9 : 2} height="80" fill={warmExit ? '#e0c294' : '#495653'} />
      {warmExit && <path className="corridor-exit-light" fill="#c8b08222" d="m529 185-49 115h160l-102-115Z" />}
      {Array.from({ length: 6 }, (_, i) => <path key={i} d={`M${i * 127} 300 531 189`} stroke="#24383e" strokeWidth="2" />)}
      {[210, 233, 263, 297].map((y) => <path key={y} d={`M0 ${y}h640`} stroke="#50605a" strokeWidth="1" />)}
      {[[103, 110, 1], [308, 119, .8], [421, 125, .6]].map(([x, y, scale]) => <g key={x} transform={`translate(${x} ${y}) scale(${scale})`}>
        <rect x="-22" y="-24" width="46" height="50" fill="#c8ac6d0b" /><path fill="#7a7355" d="M-4 1h9v16h-9Z" />
        <g className="corridor-torch"><path fill="#bf8a51" d="M-3-12h7v14h-7Zm2-7h3v8h-3Z" /><path fill="#e0bd7e" d="M-1-9h4v10h-4Z" /></g>
      </g>)}
      <path fill="#43616a" d="M381 271h81v3h-81Zm16-4h45v2h-45Z" /><path fill="#75908a" d="M402 270h12v1h-12Z" />
      <ellipse cx={heroX + 31} cy="271" rx="35" ry="6" fill="#0a171d" opacity=".6" />
      {battleVisual && <g className="skill-trails" aria-hidden="true">{[275, 315, 350].map((x) => <StoryCharacter key={x} character="용사" x={x} y="190" width="66" height="80" opacity=".35" />)}</g>}
      <g key={`hero-${token}`} className={`story-actor actor-hero${cue === 'corridor-enter' ? ' corridor-entering' : ''}${lineIndex === 11 ? ' corridor-leaving' : ''}`}><g className="skill-mover"><StoryCharacter character="용사" sheathed={lineIndex < 6} x={heroX} y="190" width="66" height="80" /></g></g>
      {visibleSlime && <g key={`slime-${token}`} className={`scene-enemy enemy-slime${enemyState === 'retreating' ? ' is-retreating' : ''}`}><StoryCharacter character="작은 슬라임" x="415" y="197" width="80" height="77" /></g>}
      {(cue === 'rune-light' || battleVisual) && <g className="corridor-runes"><path d="m270 175 6-8 6 8-6 8Zm20 8 5-7 5 7-5 7Z" fill="#b2d0bb" /><path d="M252 192h28m-15-9v18" stroke="#c9d9b2" strokeWidth="2" /></g>}
      {battleVisual && <g className="skill-effects" aria-hidden="true">
        <g className="skill-charge"><circle cx="218" cy="227" r="30" fill="none" stroke="#d8d6a1" strokeWidth="2" strokeDasharray="6 5" /><path d="m218 185 5 12-5 12-5-12Zm-42 37 12 5-12 5-12-5Zm84 0 12 5-12 5-12-5Z" fill="#b6dccb" /></g>
        <g className="skill-arc"><path d="M374 188q69-40 115 47-53-53-113 1 52-40-2-48Z" fill="#ead8a2" /><path d="M388 183q70-16 101 52" fill="none" stroke="#fff4d1" strokeWidth="3" /></g>
        <g className="skill-impact"><circle cx="447" cy="232" r="22" fill="none" stroke="#e4c782" strokeWidth="3" /><path d="m447 205 5 21 23 6-23 6-5 21-5-21-23-6 23-6Z" fill="#fff0bd" />{Array.from({ length: 7 }, (_, i) => <path key={i} transform={`rotate(${i * 51} 447 232)`} d="M447 196v-10" stroke="#bce5d5" strokeWidth="3" />)}</g>
        <g className="skill-shield"><path d="M247 193q25 38 0 76" fill="none" stroke="#badbc5" strokeWidth="5" /><path d="m254 224 16 8-16 8" fill="none" stroke="#f2db9e" strokeWidth="3" /></g>
      </g>}
      {['slash', 'guard', 'victory'].includes(action) && <g key={`effect-${token}`} className={`battle-scene-effect effect-${action}`}>
        <path className="slash-arc" d="M278 206q92-100 204-56-105-3-170 91Z" fill="#ead9aa" />
        <circle className="magic-ring" cx="203" cy="230" r="35" fill="none" stroke="#a9bcad" strokeWidth="4" />
        <text className="battle-impact-label" x="374" y="150" fill="#e4d8ad" fontSize="12" textAnchor="middle">{action === 'guard' ? 'GUARD' : action === 'victory' ? 'CLEAR' : 'STRIKE'}</text>
      </g>}
    </svg>
    {battleVisual && <>
      <EnemyHealth enemy={battleVisual.enemy} percent={skill && impactToken !== skill.token ? skill.healthBefore : battleVisual.healthPercent} kind="slime" />
      <div className="skill-vignette" aria-hidden="true" />
      {skill?.type === 'finish' && <div className="skill-cutin" aria-hidden="true"><div className="skill-cutin-stripe" /><svg className="skill-portrait" viewBox="0 0 140 95" shapeRendering="crispEdges"><StoryCharacter character="용사" x="22" y="-6" width="105" height="126" /></svg><div className="skill-cutin-copy"><span>세 번의 해독, 하나의 검격</span><strong>해독검</strong><small>DECODE BLADE</small></div></div>}
      <div className="skill-stage-label"><span>{skill?.type === 'guard' ? 'DEFEND' : skill?.type === 'finish' ? 'DECODE BLADE' : 'SWORD STRIKE'}</span><strong className="skill-phase-label">{action === 'cleared' ? '통로 확보' : skill ? '뜻을 검에 새깁니다' : '3연속 정답으로 해독검을 충전하세요'}</strong></div>
    </>}
    <div className="entrance-mist" />
    <div className="scene-transition-shade" />
  </div>;
}
