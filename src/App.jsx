import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import TitleScene from './components/TitleScene.jsx';
import MenuDialog from './components/MenuDialog.jsx';
import SettingsDialog from './components/SettingsDialog.jsx';
import VocabularyDialog from './components/VocabularyDialog.jsx';
import TierSelectDialog from './components/TierSelectDialog.jsx';
import LearningReviewDialog from './components/LearningReviewDialog.jsx';
import { firstStoryProgress, readStoryProgress, STORIES } from './story.js';
import { readLearning, saveLearning } from './battle.js';
import { DEFAULT_SETTINGS, normalizeSettings, readSettings, saveSettings } from './settings.js';
import { listenForMenuNavigation } from './menuNavigation.js';
import './story.css';
import './cinematics.css';
import './slime-skill.css';

const StoryPlayer = lazy(() => import('./components/StoryPlayer.jsx'));

const MENU = [
  { label: '게임 시작', description: '티어를 고르고 그 티어의 이야기를 시작하세요.' },
  { label: '단어장', description: '티어별 단어와 뜻, 유의어·반의어를 살펴보세요.' },
  { label: '오답 복습', description: '헷갈렸던 단어를 다시 만나 보세요.' },
  { label: '설정', description: '나에게 편한 학습 환경을 준비하세요.' },
];

export default function App() {
  const [selected, setSelected] = useState(0);
  const [openedMenu, setOpenedMenu] = useState(null);
  const [settings, setSettings] = useState(readSettings);
  const [settingsSaved, setSettingsSaved] = useState(null);
  const [storyProgress, setStoryProgress] = useState(readStoryProgress);
  const [playingTier, setPlayingTier] = useState(null);
  const [initialProgress, setInitialProgress] = useState(null);
  const [learning, setLearning] = useState(readLearning);
  const [learningSaved, setLearningSaved] = useState(true);
  const menuItems = [MENU[0], ...(storyProgress ? [{ label: '이어보기', description: '마지막으로 읽던 브론즈 이야기를 이어서 보세요.' }] : []), ...MENU.slice(1)];
  const buttons = useRef([]);
  const menu = useRef(null);
  const updateLearning = useCallback((next) => {
    setLearning(next);
    setLearningSaved(saveLearning(next));
  }, []);

  useEffect(() => {
    if (openedMenu === null && playingTier === null) buttons.current[selected]?.focus({ preventScroll: true });
  }, [openedMenu, playingTier, selected]);
  useEffect(() => { setSettingsSaved(saveSettings(settings)); }, [settings]);
  useEffect(() => {
    if (openedMenu !== null || playingTier !== null) return;
    return listenForMenuNavigation(document, {
      menu: menu.current, buttons: buttons.current.slice(0, menuItems.length), selected, onSelect: setSelected,
    });
  }, [openedMenu, playingTier, selected, menuItems.length]);

  function focusMenu(index) {
    setSelected(index);
    buttons.current[index]?.focus({ preventScroll: true });
  }

  function closeMenu() {
    setOpenedMenu(null);
  }

  function startStory(tier, resume = false) {
    setInitialProgress(resume ? storyProgress : firstStoryProgress(tier));
    setOpenedMenu(null);
    setPlayingTier(tier);
  }

  function closeStory(selectTier = false) {
    setPlayingTier(null);
    setSelected(0);
    setOpenedMenu(selectTier ? '게임 시작' : null);
    window.scrollTo({ top: 0 });
  }

  function openEncounter(id) {
    const scene = STORIES.bronze.scenes.find((item) => item.lines.some((line) => line.battleId === id));
    if (!scene) return;
    setInitialProgress({ ...firstStoryProgress('bronze'), sceneId: scene.id, lineIndex: scene.lines.findIndex((line) => line.battleId === id) });
    setOpenedMenu(null);
    setPlayingTier('bronze');
  }

  if (playingTier) return (
    <div className="app" data-text-size={settings.textSize} data-selection-effect={settings.selectionEffect}>
      <Suspense fallback={<main className="story-loading" role="status">✦ 이야기를 펼치고 있어요…</main>}><StoryPlayer key={playingTier} tier={playingTier} initialProgress={initialProgress} settings={settings}
        learning={learning} onLearning={updateLearning} learningSaved={learningSaved}
        onProgress={setStoryProgress} onClose={() => closeStory()} onSelectTier={() => closeStory(true)} /></Suspense>
    </div>
  );

  return (
    <div className="app" data-text-size={settings.textSize} data-selection-effect={settings.selectionEffect}>
      <main className="start-screen">
        <div className="title-layout">
          <section className="menu-column" aria-label="S’word Master 시작">
            <header className="brand">
              <svg className="brand-mark" viewBox="0 0 32 40" aria-hidden="true">
                <path d="M14 0h4v4h2v18h-2v4h8v4H18v6h2v4h-8v-4h2v-6H6v-4h8v-4h-2V4h2Z" />
                <path className="blade-highlight" d="M16 4h2v18h-2Z" />
              </svg>
              <div>
                <h1><span>S’WORD</span><span>MASTER</span></h1>
              </div>
            </header>
            <nav ref={menu} className="menu" aria-label="시작 메뉴">
              {menuItems.map(({ label }, index) => (
                <div className={(index === 0 && !storyProgress) || label === '이어보기' ? 'adventure-actions' : 'menu-item'} key={label}>
                  <button
                    ref={(element) => { buttons.current[index] = element; }}
                    className={`menu-button${label === '이어보기' ? ' continue-button' : ''}${selected === index ? ' is-selected' : ''}`}
                    onFocus={() => setSelected(index)}
                    onPointerEnter={(event) => {
                      if (event.pointerType === 'mouse' && openedMenu === null) focusMenu(index);
                    }}
                    onClick={() => {
                      if (openedMenu !== null) return;
                      setSelected(index);
                      if (label === '이어보기') startStory(storyProgress.tier, true);
                      else setOpenedMenu(label);
                    }}
                  >
                    <span className="marker" aria-hidden="true">▸</span>
                    <span>{label}</span>
                    <span className="enter" aria-hidden="true">↵</span>
                  </button>
                  {index === 0 && !storyProgress && (
                    <button className="menu-button continue-button" disabled>
                      <span className="marker" aria-hidden="true">▸</span>
                      <span>이어보기</span><small>저장된 이야기 없음</small>
                    </button>
                  )}
                </div>
              ))}
            </nav>
            <p className="menu-description">{menuItems[selected].description}</p>
          </section>
          <figure className="dungeon-scene">
            <TitleScene motionPreference={settings.backgroundMotion} />
            <figcaption><span className="location-marker" aria-hidden="true" />던전 입구</figcaption>
          </figure>
        </div>
        <footer className="screen-footer">
          <div className="hints">
            <span><kbd>↑ ↓</kbd> 이동</span>
            <span><kbd>Enter</kbd> 선택</span>
            <span><kbd>Esc</kbd> 닫기</span>
            <span className="pointer-hint">클릭으로 선택할 수 있어요</span>
          </div>
          <p className="version">미리보기 <span aria-hidden="true">/</span> v0.9</p>
        </footer>
      </main>
      {openedMenu === '게임 시작' ? <TierSelectDialog onClose={closeMenu} onStart={startStory} /> : openedMenu === '설정' ? (
        <SettingsDialog settings={settings} saved={settingsSaved} onClose={closeMenu}
          onChange={(key, value) => setSettings((current) => normalizeSettings({ ...current, [key]: value }))}
          onReset={() => setSettings({ ...DEFAULT_SETTINGS })} />
      ) : openedMenu === '단어장' ? <VocabularyDialog onClose={closeMenu} />
        : openedMenu === '오답 복습' ? <LearningReviewDialog learning={learning} saved={learningSaved} onClose={closeMenu} onEncounter={openEncounter} />
        : <MenuDialog title={openedMenu} onClose={closeMenu} />}
    </div>
  );
}
