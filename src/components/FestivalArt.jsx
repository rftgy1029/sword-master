import StoryCharacter from './StoryCharacter.jsx';
import EnemyHealth from './EnemyHealth.jsx';
import FestivalBackdrop, { SchoolSilhouette } from './FestivalBackdrop.jsx';
import '../festival.css';

const VIEWS = {
  wide: '0 0 640 300', sky: '0 0 640 215', '용사': '150 115 340 185', '니아': '240 110 340 190',
  '모모': '200 140 320 160', '주민': '285 110 330 190', '상인': '275 110 330 190',
  '광고 괴물': '330 65 280 235', '골목 몬스터': '335 110 275 190', '풍선 몬스터': '330 65 280 235',
  camera: '270 65 320 225', banner: '135 15 370 220', board: '265 35 350 245',
  contract: '260 110 350 190', sign: '300 95 310 205', floor: '125 170 450 130',
  letter: '235 45 345 245', date: '290 125 265 175', performer: '270 90 285 210',
  stamp: '220 30 375 265', recording: '205 25 395 275', mask: '235 55 365 245', school: '215 20 390 280',
};

function Mask({ x = 0, y = 0, scale = 1, dim = false }) {
  return <g className={dim ? '' : 'festival-mask-glow'} transform={`translate(${x} ${y}) scale(${scale})`}>
    <path fill={dim ? '#354751' : '#d8d8bb'} stroke={dim ? '#6f8083' : '#f0dc9f'} d="M0 0h35v17h-7v7h-7v10h-8V24H6v-7H0Z" />
    <path fill="#334752" d="M5 7h9v5H5Zm17 0h8v5h-8Z" />
  </g>;
}

function Camera({ off = false }) {
  return <g className="scene-camera" transform="translate(414 145)">
    <path fill="#9eb5b6" d="M0 0h48v31H0Zm48 8 22-10v34L48 23Z" />
    <path fill="#405b69" d="M8 7h27v18H8Z" /><rect x="13" y="11" width="16" height="10" fill="#d3c99e" />
    <rect x="5" y="-6" width="11" height="5" fill={off ? '#64706c' : '#d5827c'} />
    <path d="M18 31v10m-10 0h20" stroke="#c3bb91" strokeWidth="3" />
  </g>;
}

function Paper({ focus }) {
  const reverse = focus === 'stamp';
  return <g className="festival-paper" transform="translate(300 73)">
    <path fill="#16272c88" d="M5 9h204v153H5Z" /><path fill="#d5c49b" d="M0 0h198v139l-22 18H0Z" />
    <path d="M12 12h174m-174 131h151" stroke="#ab9c79" />
    {reverse ? <><path fill="#aa928e" d="M50 32h88v77H50Z" /><SchoolSilhouette x={45} y={25} scale={.48} />
      <path fill="#d5c49b" d="m122 19-14 28 13 20-14 21 24 14-9 32h35V19Z" />
      <text x="90" y="132" textAnchor="middle" fill="#655b59" fontSize="9">찢어진 학교 도장</text></>
      : <><text x="16" y="34" fill="#465046" fontSize="13">오늘의 신입 용사</text>
        <text x="16" y="64" fill="#465046" fontSize="10">용사는 첫 시험에 통과한다.</text>
        <text x="16" y="92" fill="#6c6e57" fontSize="9">출연자:</text><rect x="61" y="82" width="67" height="12" fill="#8c8b72" opacity=".65" />
        <path d="M65 85h14m5 3h22m4-4h12" stroke="#c2b68e" strokeWidth="3" />
        <text x="16" y="126" fill="#6b6c55" fontSize="10">작성: 오늘 아침</text>
        {focus === 'date' && <path d="M11 112h95v20H11Z" stroke="#b77b77" strokeWidth="2" fill="none" />}
        {focus === 'performer' && <path d="M11 78h129v20H11Z" stroke="#b77b77" strokeWidth="2" fill="none" />}
      </>}
  </g>;
}

function Recording({ state }) {
  const altered = ['altered', 'copies', 'mark'].includes(state);
  return <g className={`festival-recording${altered ? ' recording-altered' : ''}`}>
    {state === 'copies' && [0, 1].map(i => <g key={i} transform={`translate(${218 + i * 70} ${45 + i * 11})`}><rect width="215" height="149" fill="#617578" /><rect x="7" y="7" width="201" height="135" fill="#203b48" /></g>)}
    <g transform="translate(279 70)">
      <path fill="#172a32" d="M5 5h230v162H5Z" /><rect width="230" height="158" fill="#9caa9b" /><rect x="7" y="7" width="216" height="143" fill="#243646" />
      <path fill="#65546b" d="M14 33h202v8H14Zm0 91h202v44H14Z" /><path d="M21 27h188" stroke="#b69973" strokeWidth="3" />
      <text x="15" y="22" fontSize="8" fill="#d7a1a5">● REC · 오늘의 결승</text>
      {altered ? <g className="festival-recorded-student" transform="translate(67 47)">
        <path fill="#4e5566" d="M8 0h18v17H8Z" /><path fill="#b8b49a" d="M10 7h17v13H10Z" />
        <path fill="#7c8a9d" d="M3 23h31v34H3Z" /><path fill="#c5c6ba" d="m4 23 15 12 14-12" /><path fill="#a1a9ac" d="M17 33h4v19h-4Z" />
        <path fill="#5a687b" d="M7 57h10v24H7Zm15 0h10v24H22Z" /><path fill="#344353" d="M8 4h18v10H8Z" opacity=".55" />
      </g> : <StoryCharacter character="용사" x="53" y="48" width="66" height="80" />}
      <StoryCharacter character="광고 괴물" x="148" y="33" width="67" height="93" />
      <path d="M12 137h204" stroke="#718c94" /><text x="15" y="146" fontSize="6" fill="#c2d4c8">00:03:17 · LUMIFESTA</text>
      {state === 'mark' && <><path d="M174 106h45v26h-45Z" fill="#b29eba" /><SchoolSilhouette x={177} y={106} scale={.19} /></>}
      {altered && <path className="festival-recording-scan" d="M8 55h214m-214 25h214m-214 26h214" stroke="#a2c8c533" strokeWidth="3" />}
    </g>
  </g>;
}

function StampComparison() {
  return <g className="festival-stamp-comparison">
    {[255, 420].map((x, index) => <g key={x}>
      <rect x={x} y="63" width="145" height="160" fill={index ? '#243c49' : '#d3c09b'} stroke={index ? '#95ada8' : '#a89572'} strokeWidth="3" />
      <SchoolSilhouette x={x + 14} y={76} scale={.6} />
      <path fill={index ? '#243c49' : '#d3c09b'} d={`m${x + 103} 72-12 22 11 18-12 22 20 14-9 26h35V72Z`} />
      <text x={x + 72} y="205" textAnchor="middle" fontSize="10" fill={index ? '#d7d7bc' : '#565b50'}>{index ? '영상 속 표식' : '대본의 도장'}</text>
    </g>)}
    <path d="M401 140h17m-17 8h17" stroke="#dbc48a" strokeWidth="3" />
  </g>;
}

function Sign({ broken }) {
  return <g className={`scene-puzzle puzzle-sign${broken ? '' : ' is-restored'}`}>
    <path fill="#947e60" d="M490 149h9v124h-9Z" />
    <g className="puzzle-sign-arrows"><path fill="#cfbc8c" d="M446 154h78l17 13-17 13h-78Zm6 36h78v25h-78l-14-13Z" />
      <text x="492" y="172" textAnchor="middle" fill="#3b504d" fontSize="12">무대 →</text><text x="488" y="207" textAnchor="middle" fill="#3b504d" fontSize="10">← 간식</text>
    </g>
    {broken && <><path d="M451 176h35" stroke="#c6b78e" strokeWidth="7" /><path d="M467 260h14v4h-14m3-4v-5" stroke="#a9ad9b" strokeWidth="3" /></>}
  </g>;
}

export default function FestivalArt({ visual, sceneId, lineIndex, speaker, cue, paused, battleVisual }) {
  const { place, state, focus, cast, id: shot } = visual;
  const action = battleVisual?.action ?? cue;
  const token = battleVisual?.token ?? `${sceneId}-${lineIndex}`;
  const viewBox = battleVisual ? '90 65 500 235' : VIEWS[focus] ?? VIEWS.wide;
  const balloon = sceneId === 'S03' && lineIndex <= 18;
  const puppet = sceneId === 'S04' && lineIndex >= 19 && lineIndex <= 34;
  const boss = sceneId === 'S06' && lineIndex >= 4 && lineIndex <= 40;
  const crowd = (sceneId === 'S02' && place === 'square') || place === 'stage';
  const masked = ['masked', 'dodge', 'cracked'].includes(state);
  const sheathed = battleVisual?.mode === 'puzzle' || (!battleVisual && (
    sceneId === 'S07' || sceneId === 'S08' || (sceneId === 'S05' && place === 'backstage') || (sceneId === 'S04' && lineIndex < 19)
  ));
  const showPaper = ['letter', 'date', 'performer', 'stamp'].includes(focus) || shot === 'script-confrontation';
  return <div className={`story-art story-art-festival story-art-${place} cue-${cue} action-${action}${battleVisual ? battleVisual.mode === 'puzzle' ? ' is-solving' : ' is-fighting' : ''}`}
    data-paused={paused} data-place={place} data-shot={shot} data-focus={focus}>
    <svg className="story-panorama festival-panorama" viewBox={viewBox} role="img" aria-label={`${visual.location}. ${visual.title}${focus === 'wide' ? '' : ` · ${focus === speaker ? `${speaker}의 대화` : visual.title}`}`} shapeRendering="crispEdges">
      <g key={place} className="festival-backdrop"><FestivalBackdrop place={place} state={state} /></g>
      {crowd && Array.from({ length: 9 }, (_, i) => <g key={i} className="scene-spectator" opacity=".7"><rect x={i * 77 - 5} y={280 + i % 2 * 4} width="21" height="23" fill={['#7986a0', '#ac8495', '#8f9b75'][i % 3]} /><rect x={i * 77 - 1} y={271 + i % 2 * 4} width="13" height="13" fill="#bbab8d" /></g>)}
      {['quiet', 'stall'].includes(place) && sceneId === 'S08' && lineIndex < 13 && <StoryCharacter character={place === 'stall' ? '상인' : '주민'} x="451" y="191" width="64" height="78" />}
      {place === 'alley' && ['evacuating', 'restored'].includes(state) && <g className="festival-residents"><StoryCharacter character="주민" x="78" y="186" width="48" height="62" /><StoryCharacter character="주민" x="131" y="198" width="43" height="56" /></g>}
      {[...cast].sort((a, b) => state === 'rescued' ? (a === '모모' ? -1 : b === '모모' ? 1 : 0) : 0).map(character => {
        const hero = character === '용사', momo = character === '모모';
        let x = battleVisual ? hero ? 185 : momo ? 252 : 120 : hero ? 235 : momo ? 306 : 350;
        if (state === 'nia-leaving' && character === '니아') x = 447;
        if (state === 'rescued' && momo) x = 260;
        if (state === 'evacuating' && momo) x = 175;
        if (state === 'bump' && momo) x = 445;
        if (state === 'dodge' && momo) x = 211;
        const y = state === 'dodge' && hero ? 220 : momo ? 218 : 190;
        const height = state === 'dodge' && hero ? 54 : momo ? 58 : 84;
        return <g key={`${character}-${token}`} data-character={character} className={`story-actor actor-${hero ? 'hero' : momo ? 'momo' : 'nia'}${speaker === character ? ' is-speaking' : ''}${state === 'nia-leaving' && character === '니아' ? ' festival-leaving' : ''}`}>
          <g transform={state === 'bump' && momo ? 'rotate(-18 469 260)' : undefined}><StoryCharacter character={character} sheathed={sheathed} x={x} y={y} width={momo ? 48 : 70} height={height} /></g>
        </g>;
      })}
      {balloon && <g key={`balloons-${token}`} className={`scene-enemy enemy-balloon${state === 'deflated' ? ' festival-deflated' : ''}`}>
        <StoryCharacter character="풍선 몬스터" x="448" y="164" width="65" height="78" /><StoryCharacter character="풍선 몬스터" x="510" y="141" width="55" height="66" />
        {state === 'contract' && <><path d="M465 223 341 242 350 234 321 235" stroke="#c1b68c" strokeWidth="2" fill="none" /><path fill="#ddc387" d="M332 224h31v13h-31Z" /><text x="347" y="233" textAnchor="middle" fontSize="5" fill="#5c4c57">계약</text></>}
        {state === 'chase' && <><path fill="#dec491" d="M466 221h29v18h-29Zm51-24h25v16h-25Z" /><text x="480" y="232" textAnchor="middle" fontSize="6" fill="#655368">계약서</text></>}
      </g>}
      {puppet && <g key={`puppet-${token}`} className="scene-enemy enemy-alley"><StoryCharacter character="골목 몬스터" x="473" y="198" width="65" height="78" />
        {lineIndex < 28 && <><path d="M479 250h-77v-8h-54" fill="none" stroke="#9983ad" strokeWidth="9" /><path fill="#db8e83" d="M494 235h7v5h-7Zm18 0h7v5h-7Z" /></>}
      </g>}
      {boss && <g key={`boss-${token}`} className={`scene-enemy enemy-boss${state === 'fallen' ? ' festival-boss-fallen' : ''}${state === 'shattered' ? ' festival-boss-shattered' : ''}`}><StoryCharacter character="광고 괴물" x="438" y="113" width="116" height="139" />
        {masked && <><path fill="#ddc4a7" d="M452 143h87v45l-43 22-44-22Z" /><path fill="#765765" d="M464 159h12v7h-12Zm39 0h12v7h-12Zm-33 22h39v6h-39Z" /></>}
        {['damaged', 'cracked', 'shattered'].includes(state) && <path d="m492 148-9 18 15 9-8 23" fill="none" stroke="#192936" strokeWidth="4" />}
      </g>}
      {state === 'dodge' && <><path d="m471 184-67-15-178 26" stroke="#dfb59a" strokeWidth="5" fill="none" /><path d="m237 244-15 1-9-6" stroke="#bb9873" strokeWidth="3" fill="none" /></>}
      {sceneId === 'S06' && state === 'damaged' && <path fill="#b49173" d="m500 264 27-9 10 15-21 9Z" />}
      {place === 'crossroads' && <Sign broken={sceneId === 'S04' && lineIndex < 14} />}
      {place === 'door' && state === 'sealed' && <g className="scene-enemy enemy-seal"><circle cx="475" cy="171" r="46" fill="none" stroke="#b297bd" strokeWidth="3" strokeDasharray="10 7" /><path d="m475 132 34 59h-68Z" fill="none" stroke="#d3b98d" strokeWidth="2" /></g>}
      {place === 'props' && <g className={`scene-enemy enemy-props${state === 'runaway' ? '' : ' festival-settled'}`}><path fill="#bb9b74" d="M447 174h36v28h-36Zm58-26h30v24h-30Zm-13 57h50v10h-50Zm3 10h6v23h-6Zm33 0h6v23h-6Z" /><path d="m451 187 25-5m33-23 22 7" stroke="#6a604e" strokeWidth="2" />{state === 'runaway' && <><text x="460" y="161" fill="#d3c18f" fontSize="11">← 뒤</text><text x="516" y="137" fill="#d3c18f" fontSize="11">앞 →</text></>}</g>}
      {focus === 'camera' || (sceneId === 'S02' && lineIndex >= 8 && lineIndex < 19) || (sceneId === 'S07' && lineIndex >= 23) ? <Camera off={sceneId === 'S07'} /> : null}
      {sceneId === 'S02' && lineIndex >= 16 && lineIndex < 19 && <g><rect x="190" y="56" width="271" height="38" fill="#c3ac7d" /><text x="325" y="80" textAnchor="middle" fill="#38494a" fontSize="13">신입 용사 특별 출연</text><path d="M196 93h260" stroke="#826a66" strokeWidth="3" /></g>}
      {sceneId === 'S02' && lineIndex >= 26 && <g transform="translate(386 81)"><path fill="#a79573" d="M0 0h195v109H0Z" /><rect x="7" y="7" width="181" height="94" fill="#263d48" /><text x="97" y="30" textAnchor="middle" fontSize="11" fill="#dfd2aa">다섯 가면 조각의 도전</text>{Array.from({ length: 5 }, (_, i) => <Mask key={i} x={16 + i * 34} y={48} scale={.72} dim={i > 0 || lineIndex < 33} />)}</g>}
      {showPaper && (focus === 'stamp' && sceneId === 'S08' ? <StampComparison /> : shot === 'script-confrontation' ? <g transform="translate(170 130) scale(.55)"><Paper focus={focus} /></g> : <Paper focus={focus} />)}
      {focus === 'recording' && <Recording state={state} />}
      {focus === 'school' && <g transform="translate(310 48)"><rect width="225" height="195" fill="#243747" stroke="#a797b4" /><SchoolSilhouette x={7} y={4} scale={1.05} /><text x="112" y="184" textAnchor="middle" fill="#d5c8c9" fontSize="11">팔레트 마법학교</text></g>}
      {((sceneId === 'S07' && lineIndex >= 10 && lineIndex < 23) || focus === 'mask') && <><path fill="#9d8260" d="M411 204h76v34h-76Z" /><path fill="#c2a67b" d="m409 204 10-17h65l5 17Z" /><Mask x={431} y={139} scale={1.3} /></>}
      {sceneId === 'S07' && lineIndex < 10 && <g className="festival-award-box"><path d="M449 0v135" stroke="#c2b290" strokeWidth="2" /><path fill="#a78b63" d="M415 135h69v43h-69Z" /><path fill="#d5bd85" d="M412 132h75v10h-75Zm30 10h10v36h-10Z" /></g>}
      {sceneId === 'S06' && lineIndex >= 3 && lineIndex < 37 && <g className="scene-ad-cards">{['99%', state === 'warnings' ? 'FALSE' : '속보', 'FAKE'].map((word, i) => <g key={word} className="scene-ad-card" transform={`translate(${292 + i * 70} ${69 + i % 2 * 41})`}><rect width="60" height="29" fill={i % 2 ? '#bd8d99' : '#c2b783'} /><text x="30" y="19" textAnchor="middle" fill="#37414c" fontSize="10">{word}</text></g>)}</g>}
      {sceneId === 'S06' && ['shattered', 'paper'].includes(state) && <g className="festival-paper-fragments">{Array.from({ length: 12 }, (_, i) => <path key={i} d={`m${397 + i * 13} ${109 + i % 4 * 31} 13-5-6 16-9-3Z`} fill={['#b5aa8b', '#9e859b', '#6c8b92'][i % 3]} />)}{state === 'paper' && <StoryCharacter character="직원" x="523" y="221" width="32" height="42" />}</g>}
      {sceneId === 'S06' && state === 'shattered' && <SchoolSilhouette x={502} y={152} scale={.15} />}
      {sceneId === 'S07' && lineIndex < 23 && <g className="scene-confetti">{Array.from({ length: 22 }, (_, i) => <rect className="confetti-piece" key={i} x={i * 29} y={i % 5 * 21} width="3" height="6" fill={['#d4bd7c', '#bf91a4', '#a1bfc0'][i % 3]} />)}</g>}
      {['slash', 'guard', 'victory'].includes(action) && <g key={`fx-${token}`} className={`battle-scene-effect effect-${action}`}><path className="slash-arc" d="M303 199q100-120 208-55-130-17-170 89Z" fill="#ecdcad" /><circle className="magic-ring" cx="225" cy="230" r="43" fill="none" stroke="#89b6bb" strokeWidth="4" /><text className="battle-impact-label" x="390" y="132" textAnchor="middle" fill="#f1d6a1" fontSize="14">{action === 'guard' ? 'GUARD' : action === 'victory' ? 'CLEAR' : 'BREAK'}</text></g>}
      {['solve', 'hint', 'restored'].includes(action) && <g className={`puzzle-scene-effect effect-${action}`}><circle className="puzzle-light" cx="490" cy="183" r="54" fill="none" stroke="#b7c79d" strokeWidth="2" /><text x="490" y="117" textAnchor="middle" fill="#d2d9b5" fontSize="11">{action === 'hint' ? '다시 읽어 보기' : action === 'restored' ? '복원 완료' : '문구 확인'}</text></g>}
    </svg>
    {battleVisual?.mode === 'combat' && <EnemyHealth enemy={battleVisual.enemy} percent={battleVisual.healthPercent} kind={battleVisual.kind} />}
    <div key={shot} className="festival-shot-shade" aria-hidden="true" />
  </div>;
}
