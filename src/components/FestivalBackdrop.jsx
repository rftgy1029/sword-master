import StoryCharacter from './StoryCharacter.jsx';

export function SchoolSilhouette({ x = 0, y = 0, scale = 1 }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`}>
    <path fill="#455263" d="M10 72h180v88H10Zm22-29h30v117H32Zm106 0h30v117h-30Z" />
    <path fill="#8b789b" d="m22 43 25-30 25 30Zm106 0 25-30 25 30ZM64 72l36-49 36 49Z" />
    <path fill="#64748a" d="M70 72h60v88H70Z" /><path fill="#172d3b" d="M88 115h24v45H88Z" />
    {[30, 55, 80, 105, 130, 155].map(x => <path key={x} fill="#c9b782" d={`M${x} 88h9v15h-9Z`} />)}
    <path fill="#e1c58d" d="M97 54h6v18h-6Z" />
  </g>;
}

function Sky({ quiet = false }) {
  return <>
    <rect width="640" height="300" fill={quiet ? '#1b2838' : '#293449'} />
    <path fill={quiet ? '#a7b5bd' : '#e2d0a2'} d="M484 17h25v6h7v25h-7v6h-25v-6h-7V23h7Z" />
    <path fill={quiet ? '#1b2838' : '#293449'} d="M478 17h16v8h-6v22h-10Z" />
    {Array.from({ length: 24 }, (_, i) => <rect className="scene-star" key={i} x={(i * 73 + 13) % 640} y={(i * 31 + 9) % 96} width={i % 5 ? 1 : 2} height="2" fill="#b9c4bc" />)}
  </>;
}

function Ground({ indoors = false }) {
  return <><path fill={indoors ? '#3a3436' : '#374347'} d="M0 222h640v78H0Z" />
    {[237, 263, 291].map(y => <path key={y} d={`M0 ${y}h640`} stroke={indoors ? '#64534a' : '#556060'} />)}
    {[0, 110, 240, 400, 555].map(x => <path key={x} d={`M${x} 300 320 205`} stroke="#273638" />)}</>;
}

function Garland({ y = 62 }) {
  return <g className="festival-garland"><path d={`M0 ${y}q160 70 320 0 160 70 320 0`} fill="none" stroke="#bcac8e" />
    {Array.from({ length: 18 }, (_, i) => <path className="scene-flag" key={i} d={`M${i * 37} ${y + (i % 9) * (8 - i % 9) * 1.3}h17l-8 22Z`} fill={['#bc7f96', '#c5ab70', '#75a8ad'][i % 3]} />)}
  </g>;
}

function Shop({ x, color, label, closed = false }) {
  return <g transform={`translate(${x} 105)`}>
    <path fill="#4a494c" d="M0 21h144v115H0Z" /><path fill="#827b6c" d="M-5 16h154v9H-5Z" />
    <rect x="6" y="48" width="132" height="64" fill={closed ? '#3c4547' : '#202c32'} />
    {Array.from({ length: 8 }, (_, i) => <path key={i} fill={closed ? '#66665c' : i % 2 ? '#d5c8a4' : color} d={`M${i * 18 - 3} 28h18l4 26h-22Z`} />)}
    <rect x="24" y="-7" width="96" height="26" fill={color} /><text x="72" y="10" textAnchor="middle" fontSize="10" fill="#f4e7c7">{label}</text>
    <path fill="#9a805b" d="M5 105h134v9H5Zm9 9h7v28h-7Zm104 0h7v28h-7Z" />
    {closed ? [60, 75, 90].map(y => <path key={y} d={`M10 ${y}h124`} stroke="#7a7d6b" />)
      : [20, 48, 92, 115].map((x, i) => <g key={x}><path fill={i % 2 ? '#c1947a' : '#d6c29c'} d={`M${x} 88h18v16h-18Z`} /><path fill="#ecdbc1" d={`M${x - 2} 87h22v5h-22Z`} /><rect x={x + 7} y="82" width="3" height="5" fill="#b36771" /></g>)}
  </g>;
}

function Storage({ propsRoom = false }) {
  return <>
    <rect width="640" height="300" fill="#202c33" />
    {Array.from({ length: 9 }, (_, row) => <path key={row} d={`M0 ${row * 27}h640`} stroke="#34454a" strokeWidth="2" />)}
    {[30, 450].map(x => <g key={x}><rect x={x} y="47" width="142" height="175" fill="#19242c" />
      {[55, 111, 166, 216].map(y => <path key={y} fill="#7a6956" d={`M${x - 4} ${y}h150v6H${x - 4}Z`} />)}
      {[0, 1, 2].map(i => <g key={i}><rect x={x + 8 + i * 42} y={i % 2 ? 80 : 136} width="34" height="30" fill={['#9a7c62', '#827184', '#637c79'][i]} /><path d={`m${x + 9 + i * 42} ${i % 2 ? 81 : 137} 31 27m-31 0 31-27`} stroke="#af9978" /></g>)}
    </g>)}
    <path fill="#56665c" d="M226 52h150v164H226Z" /><path fill="#16252c" d="M235 61h132v155H235Z" />
    <path d="M0 30h640" stroke="#6b645c" strokeWidth="8" />
    <path fill="#b9a57c" d="M193 70h7v66h-7Zm-9 62h25v20h-25Z" />
    <Ground indoors />
    <path className="festival-guide-line" d={propsRoom ? 'M5 275H213V243H330' : 'M5 275H213V243H280m30 0h29'} fill="none" stroke="#79afab" strokeWidth="3" strokeDasharray="10 6" />
    {!propsRoom && <><path fill="#876d51" d="M384 184h127v12H384Zm8 12h8v64h-8Zm105 0h8v64h-8Z" /><path fill="#d7c79f" d="m408 178 56-9 4 23-56 7Z" /></>}
  </>;
}

export default function FestivalBackdrop({ place, state }) {
  if (['backstage', 'props'].includes(place)) return <Storage propsRoom={place === 'props'} />;
  if (place === 'door') return <><Storage /><path fill="#6b6653" d="M379 45h186v184H379Z" /><path fill="#15232c" d="M390 56h164v173H390Z" />
    {state === 'open' ? <><path fill="#7d8266" d="m394 56 39 15v158h-39Z" /><path fill="#c9b88c33" d="m437 100 80 0 85 180H360Z" /></>
      : <><path fill="#514c4c" d="M398 58h149v167H398Z" /><path d="M470 58v166m-72-130h148m-148 93h148" stroke="#938671" strokeWidth="4" /></>}
  </>;
  if (place === 'service') return <><rect width="640" height="300" fill="#233238" /><path fill="#30444a" d="M0 0 520 60v160L0 300Z" />
    {Array.from({ length: 10 }, (_, i) => <path key={i} d={`M0 ${i * 31} 520 ${62 + i * 16}`} stroke="#182a31" strokeWidth="3" />)}
    <path fill="#816c7b" d="M482 74h111v153H482Z" /><path fill="#17262c" d="M505 83h66v144H505Z" />
    <path fill="#c4b48c" d="M451 63h157v25H451Z" /><text x="530" y="80" textAnchor="middle" fontSize="10" fill="#3b4946">무대 뒤 · STAFF</text>
    <Ground /><path d="M0 280h285l245-57" fill="none" stroke="#7cb2ad" strokeWidth="4" strokeDasharray="12 7" />
    <path fill="#8e765a" d="M42 181h77v70H42Zm82 24h56v46h-56Z" />
  </>;
  if (place === 'records') return <><rect width="640" height="300" fill="#202e37" />
    <path fill="#50606a" d="M23 35h160v151H23Z" /><path fill="#142435" d="M30 42h146v137H30Z" /><path d="M103 42v137M30 114h146" stroke="#6a7780" strokeWidth="5" />
    <path fill="#a8b4b6" d="M151 54h13v13h-13Z" />
    <path fill="#3b4b52" d="M470 38h133v182H470Z" />{[57, 100, 143, 186].map(y => <g key={y}><rect x="480" y={y} width="112" height="31" fill="#5b6665" /><path d={`M525 ${y + 10}h24`} stroke="#b9b39a" strokeWidth="3" /></g>)}
    <Ground indoors /><path fill="#7e7562" d="M208 191h252v12H208Zm13 12h10v65h-10Zm219 0h10v65h-10Z" />
    <path fill="#47636a" d="M269 90h130v100H269Z" /><rect x="277" y="98" width="114" height="80" fill="#152b39" />
    <path fill="#97afa8" d="M321 190v-11h25v11Zm-18 11h63v5h-63Z" /><path d="M414 158q42 39 12 83" fill="none" stroke="#8a8470" strokeWidth="3" />
  </>;
  if (place === 'stage') return <>
    <rect width="640" height="300" fill="#1b2532" /><path fill="#6e4764" d="M0 0h130v240H0Zm510 0h130v240H510Z" />
    {[12, 45, 79, 112, 519, 552, 585, 618].map(x => <path key={x} d={`M${x} 0v230`} stroke="#8c5d78" strokeWidth="9" />)}
    <path fill="#ad9064" d="M0 14h640v8H0Zm0 210h640v9H0Z" /><path fill="#4d3b53" d="M140 42h360v100H140Z" /><path fill="#b5a277" d="M147 49h346v86H147Z" /><path fill="#243542" d="M153 55h334v74H153Z" />
    <text x="320" y="85" textAnchor="middle" fontSize="14" fill="#e9d39c">{['celebration', 'award'].includes(state) ? '첫 번째 관문 통과' : '신입 용사 특별 결승'}</text>
    <text x="320" y="109" textAnchor="middle" fontSize="8" letterSpacing="4" fill="#a9bfc0">LUMIFESTA · SPECIAL SHOW</text>
    <path className="festival-spotlight" d="m121 23 93 211h-179Zm398 0-93 211h179Z" fill="#d7c79d10" />
    <path fill="#695564" d="M0 231h640v69H0Z" /><path d="M0 250h640m-640 25h640" stroke="#a68a71" strokeWidth="3" />
    <path fill="#363e47" d="M0 284h170v16H0Zm470 0h170v16H470Z" />
  </>;
  if (place === 'school') return <><Sky quiet /><path fill="#253e4c" d="m0 162 100-49 101 41 105-61 123 59 108-55 103 61v142H0Z" />
    <SchoolSilhouette x={240} y={7} scale={1.5} /><path fill="#192d38" d="M0 244h640v56H0Z" /><path d="m180 300 130-62h42l128 62" fill="#57636a" /><path d="M301 254h63m-91 15h119m-153 19h187" stroke="#859088" strokeWidth="2" />
  </>;
  const quiet = ['quiet', 'stall'].includes(place);
  return <><Sky quiet={quiet} />
    {place === 'alley' ? <>
      <path fill="#364352" d="M0 0h160v244H0Zm450 0h190v244H450Z" /><path fill="#4a4c5b" d="M0 23h149v8H0Zm462 7h178v9H462Z" />
      {[35, 92, 487, 564].map(x => <g key={x}><rect x={x} y="62" width="35" height="61" fill="#1a2e3a" /><rect x={x + 4} y="67" width="26" height="18" fill="#bd9b70" /></g>)}
      <path fill="#6e667a" d="M158 120h294v14H158Z" /><path d="M166 124h277" stroke="#b4a37b" strokeWidth="2" /><path fill="#a48b99" d="M12 140h100v79H12Z" />
      <text x="62" y="159" textAnchor="middle" fontSize="10" fill="#f0dac0">기념사진</text><path fill="#51475d" d="M27 172h69v43H27Z" />
    </> : place === 'crossroads' ? <>
      <path fill="#475361" d="M0 99h171v130H0Zm491-21h149v151H491Z" /><path fill="#9a7e79" d="M-6 94h183v12H-6Z" />
      <Shop x={20} color="#a88d64" label="간식 골목" /><path fill="#765e76" d="M301 110h104v112H301Z" /><path fill="#182937" d="M319 131h68v91h-68Z" />
      <text x="352" y="126" textAnchor="middle" fontSize="10" fill="#e1c893">결승 무대</text>
    </> : ['market', 'stall'].includes(place) ? <>
      <Shop x={20} color="#a27a8c" label="달빛 케이크" closed={quiet} /><Shop x={244} color="#698f94" label="별사탕 공방" closed={quiet} /><Shop x={470} color="#a08b5c" label="따끈한 빵" closed={quiet} />
      {!quiet && <g className="festival-balloon-dragon"><path d="M196 115q-40-75 12-84 50 4 9 65l-18 13" stroke="#8cb9af" strokeWidth="15" fill="none" /><path d="m211 34 12-12 8 21" fill="#c4cb9c" /><rect x="213" y="34" width="3" height="3" fill="#294449" /></g>}
    </> : place === 'balloons' ? <>
      <path fill="#404a60" d="M0 71h175v172H0Zm493-18h147v190H493Z" /><path fill="#927b83" d="M0 78h169v9H0Zm496-15h144v11H496Z" />
      <path fill="#a09073" d="M21 112h128v31H21Z" /><text x="85" y="132" textAnchor="middle" fontSize="11" fill="#344652">풍선 대로</text>
      {[46, 100, 535, 588].map((x, i) => <g key={x}><path d={`M${x} 180v-64`} stroke="#acb99f" /><ellipse cx={x} cy="99" rx="16" ry="24" fill={['#be8eac', '#bbac78', '#86b2b9', '#9296bb'][i]} /><rect x={x - 6} y="84" width="4" height="10" fill="#e0d0c1" /></g>)}
    </> : <>
      {[0, 86, 171, 446, 543].map((x, i) => <g key={x}><path fill={['#435668', '#60516a', '#435d66'][i % 3]} d={`M${x} ${94 - i % 2 * 18}h91v144h-91Z`} /><path fill="#93826f" d={`M${x - 4} ${90 - i % 2 * 18}h99v8h-99Z`} />{[0, 1].map(n => <rect key={n} x={x + 15 + n * 38} y="128" width="16" height="29" fill={quiet ? '#576769' : '#c7ad7c'} />)}</g>)}
      <path fill="#7b6a7e" d="M266 101h110v131H266Z" /><path fill="#182b35" d="M279 125h84v107H279Z" />
      <path fill="#ab9977" d="M236 83h170v23H236Z" /><text x="321" y="100" textAnchor="middle" fontSize="12" fill="#374744">LUMIFESTA</text>
    </>}
    {!quiet && <Garland y={place === 'alley' ? 100 : 51} />}
    <Ground />
    {place === 'crossroads' && <><path d="M250 300 320 230 420 300M320 230l30-20" stroke="#95a99c" strokeWidth="5" fill="none" /><path fill="#826f56" d="M75 224h93v27H75Zm8 27h5v15h-5Zm70 0h5v15h-5Z" /><circle cx="88" cy="265" r="8" fill="#182a31" /><circle cx="152" cy="265" r="8" fill="#182a31" /><StoryCharacter character="직원" x="176" y="181" width="48" height="69" /></>}
    {place === 'market' && <><path fill="#ded4b0" d="M55 174h24v22H55Zm-4 7h32v7H51Zm10 15h6v27h-6Zm11 0h5v27h-5Z" /><path fill="#29383b" d="M59 179h5v5h-5Zm12 0h5v5h-5Z" /><path fill="#ad7e9b" d="M51 218h35v20H51Z" /></>}
    {quiet && <><path fill="#827b68" d="M19 232h82v8H19Zm497-4h100v8H516Z" /><path d="m107 222 29 15m-28 0 28-15" stroke="#aa9474" strokeWidth="4" /></>}
  </>;
}
