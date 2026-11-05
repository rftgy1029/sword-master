import TitleScene from './TitleScene.jsx';
import StoryProps from './StoryProps.jsx';
import DungeonCorridor from './DungeonCorridor.jsx';
import EnemyHealth from './EnemyHealth.jsx';

import StoryCharacter from './StoryCharacter.jsx';
export { default as StoryCharacter } from './StoryCharacter.jsx';

const buildings = [
  [0, 100, 80, 115, '#384051'], [62, 132, 68, 86, '#3d4b54'], [112, 73, 74, 142, '#50465c'],
  [178, 117, 65, 100, '#334e55'], [399, 116, 66, 105, '#354a52'],
  [449, 79, 79, 144, '#56475b'], [517, 125, 61, 95, '#3b4a54'], [563, 100, 77, 120, '#404757'],
];

export default function StoryArt({ background, sceneId, lineIndex = 0, recordingRevealed, speaker, motionPreference, cue = 'idle', prop, enemyState, paused, battleVisual, limitedMotion, audio, soundEnabled, onSkillComplete }) {
  if (background === 'entrance') return <div className={`story-art story-art-entrance cue-${cue}`} data-paused={paused}><TitleScene motionPreference={paused ? 'off' : motionPreference} storyAction={cue} /><div className="entrance-mist" /><span className="entrance-dust" /></div>;
  if (background === 'corridor') return <DungeonCorridor lineIndex={lineIndex} cue={cue} enemyState={enemyState} paused={paused} battleVisual={battleVisual} limitedMotion={limitedMotion} audio={audio} soundEnabled={soundEnabled} onSkillComplete={onSkillComplete} />;
  const backstage = background === 'backstage';
  const ending = background === 'ending';
  const stage = background === 'stage';
  const action = battleVisual?.action ?? cue;
  const token = battleVisual?.token ?? `${sceneId}-${lineIndex}`;
  const enemyKind = battleVisual?.kind;
  return (
    <div className={`story-art story-art-${background} cue-${cue} action-${action}${battleVisual ? battleVisual.mode === 'puzzle' ? ' is-solving' : ' is-fighting' : ''}`} data-paused={paused}>
      <svg className="story-panorama" viewBox={battleVisual ? '90 65 500 235' : '0 0 640 300'} role="img" aria-label={backstage ? '소품과 대본이 있는 조용한 무대 뒷길' : ending ? '축제의 불이 꺼진 광장과 낯선 기록 화면' : stage ? '니아, 용사, 모모가 서 있는 축제 무대' : '달과 색색의 깃발 아래 펼쳐진 루미페스타 축제 광장'} shapeRendering="crispEdges">
        <rect width="640" height="300" fill={backstage ? '#1d292c' : ending ? '#202b37' : '#283548'} />
        {backstage ? <>
          {Array.from({ length: 10 }, (_, row) => Array.from({ length: 14 }, (_, col) => <rect key={`${row}-${col}`} x={col * 50 - (row % 2) * 25} y={row * 25} width="48" height="23" fill={(row + col) % 3 ? '#293638' : '#2e3b3b'} />))}
          <path fill="#111e23" d="M265 54h112v196H265Z" /><path fill="#5c6350" d="M255 47h132v10H255Zm0 10h10v193h-10Zm122 0h10v193h-10Z" />
          <path fill="#817155" d="M45 176h102v75H45Zm440-30h110v105H485Z" />
          <path fill="#484336" d="M49 182h94v5H49Zm0 58h94v5H49Zm440-87h102v5H489Zm0 80h102v5H489Z" />
          <path fill="#c2b58c" d="m116 160 40-6 5 29-40 6Z" /><path fill="#6e715b" d="m124 166 24-4v3l-24 4Zm1 7 19-3v2l-19 3Z" />
          <rect x="416" y="100" width="4" height="43" fill="#bba16e" /><rect x="412" y="96" width="12" height="15" fill="#e8c47b" />
        </> : <>
          <path fill={ending ? '#7a8791' : '#d6cbaa'} d="M307 24h26v5h6v22h-6v5h-26v-5h-6V29h6Z" />
          <path fill={ending ? '#202b37' : '#283548'} d="M301 24h16v5h-5v20h-11Z" />
          {Array.from({ length: 24 }, (_, i) => <rect className="scene-star" style={{ animationDelay: `${i % 5 * -.8}s` }} key={i} x={(i * 97 + 17) % 640} y={(i * 29 + 9) % 115} width={i % 4 === 0 ? 3 : 1} height={i % 4 === 0 ? 3 : 1} fill={ending ? '#6a7b8a' : '#aeb6ad'} />)}
          {buildings.map(([x, y, w, h, fill], index) => <g key={x}>
            <rect x={x} y={y} width={w} height={h} fill={ending ? '#303c45' : fill} />
            <rect x={x - 3} y={y} width={w + 6} height="6" fill={ending ? '#475052' : '#7b7880'} />
            {Array.from({ length: 3 }, (_, row) => [0, 1, 2].map((col) => <rect key={`${row}-${col}`} x={x + 11 + col * 20} y={y + 17 + row * 27} width="7" height="12" fill={ending ? '#4d5757' : (index + col) % 3 ? '#bea477' : '#82acb4'} />))}
          </g>)}
          <path fill="#4b4b5b" d="M239 120h162v100H239Z" /><path fill="#806682" d="M233 114h174v9H233Z" />
          <rect x="247" y="132" width="146" height="47" fill={ending ? '#26343b' : '#353248'} />
          <path fill={ending ? '#697268' : '#d9b46f'} d="M249 135h142v2H249Zm0 39h142v2H249Z" />
          <text x="320" y="154" textAnchor="middle" fill={ending ? '#89968d' : '#ecd7a5'} fontSize="13" fontFamily="Georgia, serif" letterSpacing="2">{stage ? 'SPECIAL SHOW' : 'LUMIFESTA'}</text>
          <text x="320" y="168" textAnchor="middle" fill={ending ? '#798488' : '#bbacc1'} fontSize="5" letterSpacing="2">THE FULL MOON MASQUERADE</text>
          {!ending && <>
            <path d="M0 49 170 79 320 61 470 79 640 49" stroke="#a39b87" fill="none" strokeWidth="1" />
            {Array.from({ length: 19 }, (_, i) => {
              const x = i * 35 + 3;
              const y = x < 170 ? 49 + x * .176 : x < 320 ? 79 - (x - 170) * .12 : x < 470 ? 61 + (x - 320) * .12 : 79 - (x - 470) * .176;
              return <path className="scene-flag" style={{ animationDelay: `${i % 4 * -.4}s` }} key={i} d={`M${x} ${y}h16l-8 19Z`} fill={['#ba8392', '#b9a676', '#78a8b1'][i % 3]} />;
            })}
          </>}
        </>}
        <rect y="218" width="640" height="82" fill={backstage ? '#253130' : '#3a4144'} />
        {Array.from({ length: 5 }, (_, row) => <path key={row} d={`M0 ${230 + row * 17}h640`} stroke="#4c5251" strokeWidth="1" />)}
        {stage && <><rect x="170" y="219" width="306" height="42" fill="#65525c" /><path fill="#a18a70" d="M166 216h314v5H166Zm12 42h290v4H178Z" /></>}
        <ellipse cx="305" cy="271" rx="91" ry="9" fill="#111e22" opacity=".5" />
        <g key={`hero-${token}`} className={`story-actor actor-hero${speaker === '용사' ? ' is-speaking' : ''}`}><StoryCharacter character="용사" sheathed={battleVisual?.mode === 'puzzle' || ['sign', 'route-open'].includes(cue)} x={battleVisual ? 185 : 243} y="196" width="64" height="77" /></g>
        {sceneId !== 'S02' && <g key={`momo-${token}`} className={`story-actor actor-momo${speaker === '모모' ? ' is-speaking' : ''}`}><StoryCharacter character="모모" x={battleVisual ? 252 : 304} y="221" width="43" height="52" /></g>}
        {!backstage && <g key={`nia-${token}`} className={`story-actor actor-nia${speaker === '니아' ? ' is-speaking' : ''}`}><StoryCharacter character="니아" x={battleVisual ? 120 : 357} y="195" width="64" height="77" /></g>}
        {sceneId === 'S03' && lineIndex <= 18 && <g key={`balloon-${token}`} className="scene-enemy enemy-balloon"><StoryCharacter character="풍선 몬스터" x="448" y="164" width="65" height="78" /><StoryCharacter character="풍선 몬스터" x="510" y="141" width="55" height="66" /></g>}
        {((sceneId === 'S04' && lineIndex >= 19 && lineIndex <= 29) || enemyKind === 'alley') && <g key={`alley-${token}`} className="scene-enemy enemy-alley"><StoryCharacter character="골목 몬스터" x="473" y="198" width="65" height="78" /></g>}
        {(enemyKind === 'sign' || cue === 'sign') && <g key={`sign-${token}`} className="scene-puzzle puzzle-sign"><path fill="#937b59" d="M490 153h9v114h-9Z" /><g className="puzzle-sign-arrows"><path fill="#c2aa79" d="M447 157h81l14 13-14 13h-81Zm5 34h78v25h-78l-13-13Z" /><text x="490" y="176" textAnchor="middle" fill="#3b493e" fontSize="18">→</text><text x="490" y="210" textAnchor="middle" fill="#3b493e" fontSize="18">←</text></g></g>}
        {(enemyKind === 'seal' || cue === 'seal') && <g key={`seal-${token}`} className="scene-enemy enemy-seal"><circle cx="475" cy="171" r="41" fill="none" stroke="#aa8fbc" strokeWidth="3" strokeDasharray="12 7" /><path d="m475 132 34 59h-68Z" fill="none" stroke="#c7b28b" strokeWidth="2" /><rect x="462" y="159" width="25" height="24" fill="#a9a68a" /><path d="M468 159v-12h13v12" fill="none" stroke="#d5c59b" strokeWidth="4" /></g>}
        {(enemyKind === 'props' || cue === 'props') && <g key={`props-${token}`} className="scene-enemy enemy-props"><path fill="#b99b78" d="M447 174h36v28h-36Zm58-26h30v24h-30Zm-13 57h50v10h-50Zm3 10h6v23h-6Zm33 0h6v23h-6Z" /><path d="m451 187 25-5m33-23 22 7" stroke="#6a604e" strokeWidth="2" /></g>}
        {sceneId === 'S06' && lineIndex >= 4 && lineIndex <= 40 && <g key={`boss-${token}`} className="scene-enemy enemy-boss"><StoryCharacter character="광고 괴물" x="438" y="113" width="116" height="139" /></g>}
        {sceneId === 'S07' && <g className="scene-mask"><path fill="#d5cba9" d="M479 158h40v23h-8v8h-9v8h-8v-14h-8v-5h-7Z" /><path fill="#49574e" d="M486 165h9v5h-9Zm16 0h9v5h-9Z" /></g>}
        {ending && recordingRevealed && <g><path fill="#b8aa88" d="M444 111h124v89H444Z" /><rect x="449" y="116" width="114" height="77" fill="#23333d" />
          <path fill="#788594" d="M494 128h14v13h-14Zm-7 17h28v27h-28Zm4 29h8v17h-8Zm14 0h8v17h-8Z" />
          <path fill="#aa87a6" d="M539 170h15v15h-15Zm-2-3 10-8 10 8Z" /><path fill="#c5b4bd" d="M544 175h4v10h-4Z" /></g>}
        {!backstage && !ending && Array.from({ length: 11 }, (_, i) => <g className="scene-spectator" style={{ animationDelay: `${i % 4 * -.2}s` }} key={i} opacity=".75"><rect x={i * 65 - 8} y={278 + i % 2 * 5} width="22" height="22" fill={['#5f7580', '#776276', '#69765e'][i % 3]} /><rect x={i * 65 - 4} y={270 + i % 2 * 5} width="14" height="12" fill="#a89b87" /></g>)}
        {sceneId === 'S02' && lineIndex >= 9 && <g className="scene-camera"><path fill="#9eb3b3" d="M411 99h21v16h-21Zm21 4 10-4v16l-10-4Z" /><rect x="415" y="104" width="5" height="5" fill="#d6b57b" /></g>}
        {(cue === 'ads' || enemyKind === 'boss') && <g className="scene-ad-cards">{['99%', 'SALE', 'FAKE'].map((word, i) => <g key={word} className="scene-ad-card" style={{ animationDelay: `${i * -.6}s` }}><rect x={320 + i * 72} y={70 + i % 2 * 30} width="58" height="29" fill={i % 2 ? '#aa858c' : '#bbaa79'} /><text x={349 + i * 72} y={89 + i % 2 * 30} textAnchor="middle" fontSize="11" fill="#333e42">{word}</text></g>)}</g>}
        {(cue === 'celebrate' || cue === 'reveal' || sceneId === 'S07') && <g className="scene-confetti">{Array.from({ length: 22 }, (_, i) => <rect className="confetti-piece" style={{ animationDelay: `${i % 7 * -.6}s` }} key={i} x={i * 29} y={i % 5 * 22} width="3" height="6" fill={['#c8a16f', '#a689b5', '#93b9be'][i % 3]} />)}</g>}
        {(action === 'slash' || action === 'guard' || action === 'victory') && <g key={`fx-${token}`} className={`battle-scene-effect effect-${action}`}><path className="slash-arc" d="M303 199q100-120 208-55-130-17-170 89Z" fill="#ecdcad" /><circle className="magic-ring" cx="225" cy="230" r="43" fill="none" stroke="#89b6bb" strokeWidth="4" /><text className="battle-impact-label" x="390" y="132" textAnchor="middle" fill="#f1d6a1" fontSize="14" letterSpacing="2">{action === 'guard' ? 'GUARD' : action === 'victory' ? 'CLEAR' : 'BREAK'}</text></g>}
        {['solve', 'hint', 'restored'].includes(action) && <g key={`puzzle-${token}`} className={`puzzle-scene-effect effect-${action}`}><circle className="puzzle-light" cx="490" cy="183" r="54" fill="none" stroke="#a0bda2" strokeWidth="2" strokeDasharray="6 9" /><text className="puzzle-feedback-label" x="490" y="117" textAnchor="middle" fill="#cdd9b5" fontSize="11">{action === 'hint' ? '다시 읽어 보기' : action === 'restored' ? '복원 완료' : '문구 확인'}</text></g>}
      </svg>
      {battleVisual?.mode === 'combat' && <EnemyHealth enemy={battleVisual.enemy} percent={battleVisual.healthPercent} kind={enemyKind} />}
      <StoryProps key={`${sceneId}-${prop}`} prop={prop} lineIndex={lineIndex} sceneId={sceneId} />
      <div key={`transition-${sceneId}`} className="scene-transition-shade" />
    </div>
  );
}
