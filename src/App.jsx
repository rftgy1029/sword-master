import { useEffect, useRef, useState } from 'react';
import TitleScene from './components/TitleScene.jsx';
import AdventureDialog from './components/AdventureDialog.jsx';
import ReviewDialog from './components/ReviewDialog.jsx';
import SettingsDialog from './components/SettingsDialog.jsx';
import VocabularyDialog from './components/VocabularyDialog.jsx';
import SurveyDialog from './components/SurveyDialog.jsx';
import { SURVEY_FORM_URL, surveyUnlocked } from './survey.js';
import { DEFAULT_SETTINGS, normalizeSettings, readSettings, saveSettings } from './settings.js';
import { listenForMenuNavigation } from './menuNavigation.js';
import { useProgress } from './game/useProgress.js';
import { TIERS } from './vocabulary.js';
import { SceneTransitionProvider, useSceneTransition } from './components/SceneTransition.jsx';
import { GraphicsProvider } from './components/GraphicsContext.jsx';
import { version } from '../package.json';
import SwordLogo from './components/ui/SwordLogo.jsx';
import { MENU_REACTIONS, MENU_WORDS, matchTyped, typeKey } from './titleWords.js';

// 메뉴 이름은 그대로 두고, 설명은 게임 세계의 말투로 쓴다.
const MENU = [
  { label: '새 모험', description: '석문 너머로 첫발을 내딛는다.' },
  { label: '이어하기', description: '멈췄던 층에서 다시 칼을 든다.' },
  { label: '단어장', description: '모아 둔 단어를 펼쳐 본다.' },
  { label: '오답 복습', description: '놓쳤던 단어가 다시 길을 막는다.' },
  { label: '설정', description: '모험의 채비를 고친다.' },
  { label: '설문 참여', description: '석문을 돌파한 이야기를 선생님께 들려준다.' },
];
const CONTINUE = 1;
const SURVEY = 5; // 학교 티어를 클리어한 기록이 있을 때만 보인다
const TYPED_SWING = 650; // 단어를 끝까지 치면 기사가 칼을 휘두른 뒤 메뉴가 열린다

function GameApp({ settings, setSettings }) {
  const transition = useSceneTransition();
  const [selected, setSelected] = useState(0);
  const [openedMenu, setOpenedMenu] = useState(null);
  const [settingsSaved, setSettingsSaved] = useState(null);
  const { progress, dispatch, error } = useProgress();
  const canContinue = !!progress.run && progress.run.phase !== 'result';
  const canSurvey = surveyUnlocked(progress);
  // 이어하기는 잠긴 채 보이고, 설문은 열리기 전까지 숨긴다. 둘 다 키보드·단어 입력 대상에서 빠진다.
  const isEnabled = (i) => i === CONTINUE ? canContinue : i === SURVEY ? canSurvey : true;
  const buttons = useRef([]);
  const menu = useRef(null);
  const opener = useRef(null);
  const [typed, setTyped] = useState('');
  const typedRef = useRef('');
  const [swinging, setSwinging] = useState(false);
  const [typeMiss, setTypeMiss] = useState(false);
  const swing = useRef(null);
  const reducedMotion = settings.backgroundMotion !== 'normal';

  useEffect(() => { buttons.current[0]?.focus({ preventScroll: true }); }, []);
  useEffect(() => { setSettingsSaved(saveSettings(settings)); }, [settings]);
  useEffect(() => {
    if (openedMenu !== null) return;
    const indices = MENU.map((_, i) => i).filter(isEnabled);
    return listenForMenuNavigation(document, {
      menu: menu.current, buttons: indices.map((i) => buttons.current[i]), selected: Math.max(0, indices.indexOf(selected)),
      onSelect: (i) => setSelected(indices[i]),
    });
  }, [openedMenu, selected, canContinue, canSurvey]);

  useEffect(() => () => clearTimeout(swing.current), []);
  useEffect(() => {
    if (openedMenu !== null) { typedRef.current = ''; setTyped(''); return; }
    const enabled = MENU.map((_, i) => isEnabled(i));
    function onKey(event) {
      if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || swing.current) return;
      const background = event.target === document.body || event.target === document.documentElement || menu.current?.contains(event.target);
      if (!background || !/^([a-z]|Backspace|Escape)$/i.test(event.key)) return;
      event.preventDefault();
      const next = typeKey(typedRef.current, event.key);
      const match = matchTyped(next, enabled);
      typedRef.current = next;
      setTyped(next);
      setTypeMiss(/^[a-z]$/i.test(event.key) && match.index < 0);
      if (match.index >= 0) focusMenu(match.index);
      if (match.complete) {
        const index = match.index;
        setSwinging(true);
        swing.current = setTimeout(() => {
          swing.current = null; typedRef.current = ''; setSwinging(false); setTyped('');
          buttons.current[index]?.click();
        }, reducedMotion ? 0 : TYPED_SWING);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [openedMenu, canContinue, canSurvey, reducedMotion]);

  function focusMenu(index) {
    setSelected(index);
    buttons.current[index]?.focus({ preventScroll: true });
  }

  function closeMenu() {
    setOpenedMenu(null);
    if (opener.current?.disabled) focusMenu(0);
    else opener.current?.focus({ preventScroll: true });
  }

  function closeAdventure(reason) {
    if (reason === 'bronze-clear') setOpenedMenu('설문 참여');
    else closeMenu();
  }

  function menuButton(index) {
    const isContinue = index === CONTINUE;
    const isSurvey = index === SURVEY;
    const word = MENU_WORDS[index];
    const match = matchTyped(typed, MENU.map((_, i) => isEnabled(i)));
    const typedHere = typed && word.startsWith(typed) ? typed.length : 0;
    return <button ref={(element) => { buttons.current[index] = element; }}
      className={`menu-button${isContinue ? ' continue-button' : ''}${isSurvey ? ' survey-button' : ''}${selected === index ? ' is-selected' : ''}${match.index === index ? ' is-typed' : ''}`}
      disabled={!isEnabled(index)} onFocus={() => setSelected(index)}
      onPointerEnter={(event) => { if (event.pointerType === 'mouse' && openedMenu === null && isEnabled(index)) focusMenu(index); }}
      onClick={(event) => {
        if (openedMenu !== null) return;
        setSelected(index);
        opener.current = event.currentTarget;
        transition(() => setOpenedMenu(MENU[index].label));
      }}>
      <span className="menu-label">{MENU[index].label}</span>
      <span className="menu-word" aria-hidden="true"><b>{word.slice(0, typedHere)}</b>{word.slice(typedHere)}</span>
      {isContinue && <small>{canContinue ? `${TIERS.find((t) => t.id === progress.run.tier)?.label ?? progress.wordbooks?.find((book) => book.id === progress.run.tier)?.name} · ${Math.max(1, progress.run.floor + 1)}층` : '아직 아무도 이 문을 지나지 않았다'}</small>}
      {isSurvey && <small>브론즈 돌파 · 사용자 경험 조사</small>}
    </button>;
  }

  const heroAction = swinging ? 'attack' : MENU_REACTIONS[selected] ?? 'idle';

  return (
    <div className="app" data-text-size={settings.textSize} data-selection-effect={settings.selectionEffect} data-background-motion={settings.backgroundMotion}>
      <main className="start-screen">
        <div className="title-backdrop">
          <TitleScene active={openedMenu === null || openedMenu === '설문 참여'} motionPreference={settings.backgroundMotion} heroAction={heroAction} />
        </div>
        <section className="title-panel" aria-label="S’word Master 시작">
          <SwordLogo />
          <nav ref={menu} className="menu" aria-label="시작 메뉴" aria-describedby="title-typing-help">
            {MENU.map(({ label }, index) => index === CONTINUE || (index === SURVEY && !canSurvey) ? null : (
              <div className={index === 0 ? 'adventure-actions' : index === SURVEY ? 'menu-item survey-item' : 'menu-item'} key={label}>
                {menuButton(index)}
                {index === 0 && menuButton(CONTINUE)}
              </div>
            ))}
          </nav>
          <p className="menu-description" aria-live="polite">{MENU[selected].description}</p>
          <p className={`title-typing${typeMiss ? ' is-miss' : ''}${typed ? ' has-text' : ''}`} id="title-typing-help">
            <span aria-hidden="true">›</span>
            {typed ? <strong aria-live="polite">{typed}</strong> : <span>메뉴의 영어 단어를 치면 칼이 응답한다</span>}
          </p>
          {error && openedMenu === null && <p className="title-save-error" role="alert">{error}</p>}
        </section>
        <p className="title-place" aria-hidden="true">황혼의 석문</p>
        <p className="version">v{version}</p>
      </main>
      {openedMenu === '설정' ? (
        <SettingsDialog settings={settings} saved={settingsSaved} onClose={closeMenu}
          onChange={(key, value) => setSettings((current) => normalizeSettings({ ...current, [key]: value }))}
          onReset={() => setSettings({ ...DEFAULT_SETTINGS })} />
      ) : openedMenu === '단어장' ? <VocabularyDialog wordbooks={progress.wordbooks ?? []} error={error}
        onSaveBook={(book) => dispatch({ type: 'ADD_WORDBOOK', book })} onClose={closeMenu} />
        : openedMenu === '오답 복습' ? <ReviewDialog progress={progress} dispatch={dispatch} error={error} onClose={closeMenu} />
        : openedMenu === '설문 참여' ? <SurveyDialog progress={progress} formUrl={SURVEY_FORM_URL} onClose={closeMenu} />
          : ['새 모험', '이어하기'].includes(openedMenu) ? <AdventureDialog progress={progress} dispatch={dispatch} error={error} motionPreference={settings.backgroundMotion}
            newAdventure={openedMenu === '새 모험'} onClose={closeAdventure} /> : null}
    </div>
  );
}

export default function App() {
  const [settings, setSettings] = useState(readSettings);
  return <GraphicsProvider settings={settings}><SceneTransitionProvider motionPreference={settings.backgroundMotion}><GameApp settings={settings} setSettings={setSettings} /></SceneTransitionProvider></GraphicsProvider>;
}
