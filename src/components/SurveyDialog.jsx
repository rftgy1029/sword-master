import { useEffect, useRef } from 'react';
import { TransitionVeil, useSceneTransition } from './SceneTransition.jsx';
import { highestClearedTier, schoolClearCount, surveyFormUrl } from '../survey.js';

const percent = (part, total) => total ? `${Math.round(part / total * 100)}%` : '—';

export default function SurveyDialog({ progress, formUrl, onClose }) {
  const dialog = useRef(null);
  const transition = useSceneTransition();
  const requestClose = () => transition(() => dialog.current.close());
  const url = surveyFormUrl(formUrl);
  const tier = highestClearedTier(progress);
  const { attempts, correct, runs } = progress.learning;

  useEffect(() => {
    if (!dialog.current.open) dialog.current.showModal();
    dialog.current.querySelector('[data-initial-focus]')?.focus({ preventScroll: true });
  }, []);

  return <dialog ref={dialog} className="game-dialog survey-dialog" aria-labelledby="survey-title" aria-describedby="survey-intro"
    onClose={onClose} onCancel={(event) => { event.preventDefault(); requestClose(); }}
    onClick={(event) => {
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.target === event.currentTarget && (event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom)) requestClose();
    }}>
    <header className="game-header">
      <div><p className="game-eyebrow">브론즈 돌파 기념</p><h2 id="survey-title">사용자 경험 조사</h2></div>
      <button className="settings-close" aria-label="설문 창 닫기" onClick={requestClose}>×</button>
    </header>
    <div className="game-body survey-body">
      <p id="survey-intro" className="survey-intro">석문을 돌파했어요! S’word Master를 더 좋은 단어 학습 도구로 다듬을 수 있도록,
        직접 플레이해 본 느낌을 구글 폼으로 들려주세요.</p>
      <dl className="learning-summary survey-record" aria-label="설문에 참고할 내 기록">
        <div><dt>최고 클리어</dt><dd>{tier?.label ?? '—'}</dd><small>학교 티어 클리어 {schoolClearCount(progress)}회</small></div>
        <div><dt>모험</dt><dd>{runs}회</dd><small>새 모험을 시작한 횟수</small></div>
        <div><dt>정답률</dt><dd>{percent(correct, attempts)}</dd><small>정답 {correct} / {attempts}문제</small></div>
      </dl>
      <p className="game-muted">설문은 새 탭에서 열려요. 게임 진행과 학습 기록은 그대로 저장돼요.</p>
      {url ? <a className="game-primary survey-open" href={url} target="_blank" rel="noopener noreferrer" data-initial-focus>
        구글 폼 열기 <span aria-hidden="true">↗</span><span className="sr-only">(새 탭)</span></a>
        : <><button className="game-primary survey-open" disabled>설문 주소 준비 중</button>
          <p className="survey-pending" role="status">선생님이 설문 주소를 등록하면 이곳에서 열 수 있어요.</p></>}
      <button className="game-secondary survey-later" onClick={requestClose} data-initial-focus={url ? undefined : ''}>나중에 할게요</button>
    </div>
    <TransitionVeil />
  </dialog>;
}
