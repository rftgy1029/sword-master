import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dialogueDelay, firstStoryProgress, moveStory, normalizeStoryProgress, saveStoryProgress, STORIES } from '../story.js';
import { ENCOUNTERS, learningSummary } from '../battle.js';
import BattlePanel from './BattlePanel.jsx';
import StoryArt, { StoryCharacter } from './StoryArt.jsx';
import TierCrest from './TierCrest.jsx';
import { createBattleAudio } from '../battleAudio.js';

export default function StoryPlayer({ tier, initialProgress, settings, learning, onLearning, learningSaved, onProgress, onClose, onSelectTier }) {
  const story = STORIES[tier];
  const [progress, setProgress] = useState(() => normalizeStoryProgress(initialProgress) ?? firstStoryProgress(tier));
  const [contentsOpen, setContentsOpen] = useState(false);
  const [saved, setSaved] = useState(true);
  const [autoPlaying, setAutoPlaying] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [visible, setVisible] = useState(() => !document.hidden);
  const [battleVisual, setBattleVisual] = useState(null);
  const [skillDone, setSkillDone] = useState(null);
  const [audio] = useState(createBattleAudio);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const skillComplete = useCallback((token) => setSkillDone(token), []);
  const limitedMotion = reducedMotion || settings.backgroundMotion !== 'normal';
  const heading = useRef(null);
  const dialogue = useRef(null);
  const contentsButton = useRef(null);
  const sceneIndex = story.scenes.findIndex(({ id }) => id === progress.sceneId);
  const scene = story.scenes[sceneIndex];
  const line = scene.lines[progress.lineIndex];
  const battleId = !progress.completed ? line.battleId : null;
  const isFirst = sceneIndex === 0 && progress.lineIndex === 0;
  const isLast = sceneIndex === story.scenes.length - 1 && progress.lineIndex === scene.lines.length - 1;
  const totalLines = story.scenes.reduce((sum, item) => sum + item.lines.length, 0);
  const position = story.scenes.slice(0, sceneIndex).reduce((sum, item) => sum + item.lines.length, 0) + progress.lineIndex + 1;
  const summary = useMemo(() => learningSummary(learning), [learning]);

  const completeBattle = useCallback(() => setProgress((current) => moveStory(current, 1)), []);

  useEffect(() => { window.scrollTo({ top: 0 }); }, []);
  useEffect(() => () => audio.dispose(), [audio]);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const changed = () => setReducedMotion(media.matches);
    media.addEventListener('change', changed);
    return () => media.removeEventListener('change', changed);
  }, []);
  useEffect(() => {
    const changed = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', changed);
    return () => document.removeEventListener('visibilitychange', changed);
  }, []);
  useEffect(() => {
    if (!autoPlaying || !visible || contentsOpen || battleId || progress.completed) return;
    const timer = setTimeout(() => setProgress((current) => moveStory(current, 1)), dialogueDelay(line, playbackRate));
    return () => clearTimeout(timer);
  }, [autoPlaying, visible, contentsOpen, battleId, progress.completed, line, playbackRate]);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [progress.completed]);
  useEffect(() => {
    setSaved(saveStoryProgress(progress));
    onProgress(progress);
  }, [progress, onProgress]);
  useEffect(() => { dialogue.current?.scrollTo({ top: 0 }); }, [progress.sceneId, progress.lineIndex]);
  useEffect(() => {
    function navigate(event) {
      if (event.defaultPrevented || event.isComposing || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        if (contentsOpen) { setContentsOpen(false); contentsButton.current?.focus(); }
        else onClose();
        return;
      }
      if (contentsOpen || battleId || progress.completed || event.target.closest('input, select, textarea, [contenteditable="true"]')) return;
      if (['Enter', ' '].includes(event.key) && event.target.closest('button, a, summary')) return;
      if (['Enter', ' ', 'ArrowRight', 'ArrowLeft'].includes(event.key)) {
        event.preventDefault();
        if (event.key === 'ArrowLeft') setAutoPlaying(false);
        setProgress((current) => moveStory(current, event.key === 'ArrowLeft' ? -1 : 1));
      }
    }
    document.addEventListener('keydown', navigate);
    return () => document.removeEventListener('keydown', navigate);
  }, [contentsOpen, battleId, progress.completed, onClose]);

  function jumpToScene(index) {
    setProgress({ ...firstStoryProgress(tier), sceneId: story.scenes[index].id });
    setContentsOpen(false);
    heading.current?.focus({ preventScroll: true });
  }

  return (
    <main className="story-screen" data-motion={settings.backgroundMotion}>
      <header className="story-header"><span className="story-brand">S’WORD MASTER <span>/</span> STORY</span>
        <div className="story-header-actions"><button className="story-text-button" onClick={onSelectTier}>티어 선택</button>
          <button className="story-text-button" onClick={onClose}><span aria-hidden="true">×</span> 타이틀로</button></div></header>
      {progress.completed ? (
        <section className="story-complete">
          <p className="story-eyebrow">BRONZE · CHAPTER 01</p>
          <svg className="story-mask" viewBox="0 0 80 88" aria-hidden="true" shapeRendering="crispEdges"><path fill="#c1c4b1" d="M10 12h58v36H57v10H46v14H35V61H24V48H10Z" /><path fill="#e1dbbb" d="M13 15h51v5H13Zm0 5h5v24h-5Z" /><path fill="#394942" d="M19 28h16v9H19Zm25 0h16v9H44Zm-7 13h6v12h-6Z" /><path fill="#908763" d="M46 57h11v5H46Zm-11 4h11v11H35Z" /></svg>
          <h1 ref={heading} tabIndex={-1}>제1장 이야기 끝</h1>
          <p className="story-complete-title">{story.title}</p>
          {summary.answered > 0 && <p className="story-learning-summary">학습한 단어 <strong>{summary.learned} / 64</strong> · 정답 <strong>{summary.correct} / {summary.answered}</strong></p>}
          <p className="story-complete-quote">“내가 분명히 구한 사람들과 방송 기록은<br />왜 다른 이야기를 하고 있는 걸까?”</p>
          <div className="story-next-destination"><span>NEXT DESTINATION</span><strong>팔레트 마법학교</strong><p>지워진 오늘의 기록을 찾아서.<br />다음 장의 이야기는 준비 중이에요.</p></div>
          <div className="story-complete-actions"><button className="story-text-button" onClick={() => { setProgress(firstStoryProgress(tier)); setContentsOpen(false); }}>처음부터 다시 보기</button>
            <button className="return-button" onClick={onSelectTier}>티어 선택으로 <span aria-hidden="true">→</span></button></div>
          <p className="story-storage-note" role="status">{saved ? '이야기 감상 완료를 이 브라우저에 저장했어요.' : '저장 공간을 사용할 수 없어 이번 접속에서만 기록을 유지해요.'}</p>
        </section>
      ) : <>
        <div className="story-chapter-heading"><div><p className="story-eyebrow"><TierCrest tier={tier} small /> BRONZE <span>/</span> CHAPTER 01</p>
          <h1 ref={heading} tabIndex={-1}>{story.title}</h1></div><span className="story-mode">이야기와 단어 마법</span></div>
        <div className="story-playback-controls"><div><button className="story-play-toggle" aria-pressed={autoPlaying} onClick={() => setAutoPlaying((playing) => !playing)}><span aria-hidden="true">{autoPlaying ? 'Ⅱ' : '▶'}</span>{autoPlaying ? '자동 진행 중 · 일시정지' : '자동 진행 재생'}</button>
          <label className="story-speed">속도 <select aria-label="이야기 재생 속도" value={playbackRate} onChange={(event) => setPlaybackRate(Number(event.target.value))}><option value={0.75}>느리게</option><option value={1}>보통</option><option value={1.5}>빠르게</option></select></label></div><span>{battleId ? '문제를 푸는 동안 이야기는 기다려요.' : '대사 길이에 맞춰 자동으로 넘어가요.'}</span></div>
        <div className={`story-frame${battleId ? ' is-battle' : ''}`}>
          <div className="story-scene-label"><span><i aria-hidden="true" />{scene.location}</span><span>SCENE {String(sceneIndex + 1).padStart(2, '0')} <b>/ {String(story.scenes.length).padStart(2, '0')}</b></span></div>
          <StoryArt background={scene.background} sceneId={scene.id} lineIndex={progress.lineIndex} speaker={line.speaker} motionPreference={settings.backgroundMotion}
            limitedMotion={limitedMotion} audio={audio} soundEnabled={settings.soundEffects === 'on'} onSkillComplete={skillComplete}
            cue={line.cue} prop={line.prop} enemyState={line.enemyState} paused={!visible || contentsOpen || (!autoPlaying && !battleId)} battleVisual={battleId ? battleVisual : null}
            recordingRevealed={scene.id === 'S08' && scene.lines.slice(0, progress.lineIndex + 1).some(({ text }) => text.includes('교복 차림의 낯선 학생'))} />
          <div className="story-scene-caption"><span>{scene.title}</span><span aria-hidden="true">✦</span></div>
          {battleId ? <BattlePanel key={battleId} id={battleId} learning={learning} onLearning={onLearning} onComplete={completeBattle} onVisual={setBattleVisual} onPause={() => setAutoPlaying(false)} autoPlaying={autoPlaying} suspended={!visible || contentsOpen} audio={audio} soundEnabled={settings.soundEffects === 'on'} skillDone={skillDone} limitedMotion={limitedMotion} /> : <><section className={`story-dialogue${line.speaker === '내레이션' ? ' is-narration' : ''}`} aria-label="이야기 대사">
            <div className="story-portrait" aria-hidden="true">{line.speaker === '내레이션' ? <span>✦</span> : <StoryCharacter character={line.speaker} />}</div>
            <div className="story-dialogue-main"><p className="story-speaker">{line.speaker}<span>{line.speaker === '내레이션' ? 'NARRATION' : 'DIALOGUE'}</span></p>
              <div ref={dialogue} className="story-dialogue-text" tabIndex={0} role="log" aria-label={`${line.speaker}의 대사`} aria-live="polite" aria-atomic="true" onFocus={() => setAutoPlaying(false)}><p>{line.text}</p></div>
            </div>
          </section>
          <div className="story-reader-controls"><button className="story-text-button" disabled={isFirst} onClick={() => { setAutoPlaying(false); setProgress((current) => moveStory(current, -1)); }}>← 이전 대사</button>
            <span className="story-line-number">{progress.lineIndex + 1} <span>/ {scene.lines.length}</span></span>
            <button className="story-next-button" onClick={() => setProgress((current) => moveStory(current, 1))}>{isLast ? '이야기 마치기' : progress.lineIndex === scene.lines.length - 1 ? '다음 장면' : '다음 대사'} <span aria-hidden="true">→</span></button></div></>}
        </div>
        <div className="story-progress-track" role="progressbar" aria-label="이야기 감상 진행" aria-valuemin={0} aria-valuemax={totalLines} aria-valuenow={position}><span style={{ width: `${position / totalLines * 100}%` }} /></div>
        <footer className="story-footer"><div className="story-tools"><button ref={contentsButton} className="story-text-button" aria-expanded={contentsOpen} aria-controls="story-contents" onClick={() => setContentsOpen((open) => !open)}>☷ 장면 목록</button>
          <button className="story-text-button" disabled={sceneIndex === story.scenes.length - 1} onClick={() => jumpToScene(sceneIndex + 1)}>장면 건너뛰기 <span aria-hidden="true">»</span></button></div>
          <p className="story-save-status" role="status">{saved ? '읽은 위치 자동 저장' : '이번 접속에서만 기록 유지'}</p></footer>
        {contentsOpen && <nav id="story-contents" className="story-contents" aria-label="장면 목록"><div><h2>제1장 · 장면 목록</h2><button className="story-text-button" onClick={() => { setContentsOpen(false); contentsButton.current?.focus(); }}>닫기 ×</button></div>
          <p>원하는 장면으로 바로 이동할 수 있어요.</p><ol>{story.scenes.map((item, index) => <li key={item.id}><button aria-current={scene.id === item.id ? 'step' : undefined} onClick={() => jumpToScene(index)}><span>{String(index + 1).padStart(2, '0')}</span>{item.title}<span aria-hidden="true">→</span></button></li>)}</ol>
          <details className="story-battle-jumps"><summary>전투·마법 퍼즐 바로가기</summary><div>{ENCOUNTERS.map((encounter) => <button className="story-text-button" key={encounter.id} onClick={() => {
            const targetScene = story.scenes.find((item) => item.lines.some((entry) => entry.battleId === encounter.id));
            setProgress({ ...firstStoryProgress(tier), sceneId: targetScene.id, lineIndex: targetScene.lines.findIndex((entry) => entry.battleId === encounter.id) });
            setContentsOpen(false);
          }}>{encounter.title} →</button>)}</div></details></nav>}
        <p className="story-keyboard-hint"><kbd>Enter</kbd> / <kbd>→</kbd> 다음 <span><kbd>←</kbd> 이전</span><span>대사 버튼을 눌러서도 읽을 수 있어요</span></p>
        {!saved && <p className="story-storage-note">브라우저 저장 공간을 사용할 수 없어요. 페이지를 새로고침하면 읽은 위치가 사라질 수 있어요.</p>}
        {!learningSaved && <p className="story-storage-note" role="status">학습 기록을 저장할 수 없어 이번 접속에서만 유지해요.</p>}
      </>}
    </main>
  );
}
