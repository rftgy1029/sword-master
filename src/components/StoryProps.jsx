import StoryCharacter from './StoryCharacter.jsx';

export default function StoryProps({ prop, lineIndex, sceneId }) {
  if (!prop) return null;
  return <div className={`cinematic-prop cinematic-prop-${prop}`} aria-hidden="true">
    {prop === 'letter' || prop === 'stamp' ? <div className="cinematic-letter"><span>오늘의 신입 용사</span><p>용사는 첫 시험에 통과한다.</p><div className="letter-ink-line" /><div className="letter-ink-line is-short" /><small>출연자: <i>████</i></small><div className="school-seal">♜</div><span className="letter-date">오늘 아침</span></div>
      : prop === 'recording' ? <div className={`cinematic-recording${lineIndex >= 25 ? ' is-altered' : ''}`}><span className="recording-label">● REC <small>오늘의 결승 · 원본 기록</small></span><div className="recording-hero"><StoryCharacter character="용사" /></div><div className="recording-student"><i /><span /><b /></div><span className="recording-timecode">00:03:17 <small>▸ PLAY</small></span><div className="recording-scanline" /></div>
        : <div className="cinematic-school"><svg viewBox="0 0 100 100" shapeRendering="crispEdges"><path fill="#bda7c4" d="M17 44h66v43H17Zm-5-6 38-27 38 27Z" /><path fill="#26373d" d="M28 52h10v12H28Zm34 0h10v12H62ZM43 61h14v26H43Z" /><path fill="#e4d6b2" d="M45 24h10v16H45Z" /><path fill="#bda7c4" d="M7 87h86v5H7Z" /></svg><span>{sceneId === 'S05' ? '찢어진 문양' : '팔레트 마법학교'}</span></div>}
  </div>;
}
