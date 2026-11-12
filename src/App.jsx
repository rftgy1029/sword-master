import { useEffect, useRef, useState } from 'react';
import TitleScene from './components/TitleScene.jsx';
import AdventureDialog from './components/AdventureDialog.jsx';
import ReviewDialog from './components/ReviewDialog.jsx';
import SettingsDialog from './components/SettingsDialog.jsx';
import VocabularyDialog from './components/VocabularyDialog.jsx';
import { DEFAULT_SETTINGS, normalizeSettings, readSettings, saveSettings } from './settings.js';
import { listenForMenuNavigation } from './menuNavigation.js';
import { useProgress } from './game/useProgress.js';
import { TIERS } from './vocabulary.js';
import { SceneTransitionProvider, useSceneTransition } from './components/SceneTransition.jsx';
import { GraphicsProvider } from './components/GraphicsContext.jsx';
import { version } from '../package.json';

const MENU = [
  { label: '새 모험', description: '학습 범위를 고르고 새로운 모험을 시작하세요.' },
  { label: '이어하기', description: '저장된 던전에서 카드와 학습을 이어가세요.' },
  { label: '단어장', description: '티어별 단어와 뜻, 유의어·반의어를 살펴보세요.' },
  { label: '오답 복습', description: '헷갈렸던 단어를 다시 만나 보세요.' },
  { label: '설정', description: '나에게 편한 학습 환경을 준비하세요.' },
];

function GameApp({ settings, setSettings }) {
  const transition = useSceneTransition();
  const [selected, setSelected] = useState(0);
  const [openedMenu, setOpenedMenu] = useState(null);
  const [settingsSaved, setSettingsSaved] = useState(null);
  const { progress, dispatch, error } = useProgress();
  const canContinue = !!progress.run && progress.run.phase !== 'result';
  const buttons = useRef([]);
  const menu = useRef(null);
  const opener = useRef(null);

  useEffect(() => { buttons.current[0]?.focus({ preventScroll: true }); }, []);
  useEffect(() => { setSettingsSaved(saveSettings(settings)); }, [settings]);
  useEffect(() => {
    if (openedMenu !== null) return;
    const indices = MENU.map((_, i) => i).filter((i) => i !== 1 || canContinue);
    return listenForMenuNavigation(document, {
      menu: menu.current, buttons: indices.map((i) => buttons.current[i]), selected: Math.max(0, indices.indexOf(selected)),
      onSelect: (i) => setSelected(indices[i]),
    });
  }, [openedMenu, selected, canContinue]);

  function focusMenu(index) {
    setSelected(index);
    buttons.current[index]?.focus({ preventScroll: true });
  }

  function closeMenu() {
    setOpenedMenu(null);
    if (opener.current?.disabled) focusMenu(0);
    else opener.current?.focus({ preventScroll: true });
  }

  function menuButton(index) {
    const isContinue = index === 1;
    return <button ref={(element) => { buttons.current[index] = element; }}
      className={`menu-button${isContinue ? ' continue-button' : ''}${selected === index ? ' is-selected' : ''}`}
      disabled={isContinue && !canContinue} onFocus={() => setSelected(index)}
      onPointerEnter={(event) => { if (event.pointerType === 'mouse' && openedMenu === null && (!isContinue || canContinue)) focusMenu(index); }}
      onClick={(event) => {
        if (openedMenu !== null) return;
        setSelected(index);
        opener.current = event.currentTarget;
        transition(() => setOpenedMenu(MENU[index].label));
      }}>
      <span className="marker" aria-hidden="true">▸</span><span>{MENU[index].label}</span>
      {isContinue ? <small>{canContinue ? `${TIERS.find((t) => t.id === progress.run.tier).label} · ${Math.max(1, progress.run.floor + 1)}층` : '저장된 기록 없음'}</small>
        : <span className="enter" aria-hidden="true">↵</span>}
    </button>;
  }

  return (
    <div className="app" data-text-size={settings.textSize} data-selection-effect={settings.selectionEffect} data-background-motion={settings.backgroundMotion}>
      <main className="start-screen">
        <div className="title-layout">
          <section className="menu-column" aria-label="S’word Master 시작">
            <p className="title-eyebrow"><span/> WORDS BECOME YOUR WEAPON</p>
            <header className="brand">
              <svg className="brand-mark" viewBox="0 0 32 40" aria-hidden="true">
                <path d="M14 0h4v4h2v18h-2v4h8v4H18v6h2v4h-8v-4h2v-6H6v-4h8v-4h-2V4h2Z" />
                <path className="blade-highlight" d="M16 4h2v18h-2Z" />
              </svg>
              <div>
                <h1><span>S’WORD</span><span>MASTER</span></h1>
              </div>
            </header>
            <p className="title-intro">한 단어씩,<br/>더 깊은 모험으로.</p>
            <nav ref={menu} className="menu" aria-label="시작 메뉴">
              {MENU.map(({ label }, index) => index === 1 ? null : (
                <div className={index === 0 ? 'adventure-actions' : 'menu-item'} key={label}>
                  {menuButton(index)}
                  {index === 0 && menuButton(1)}
                </div>
              ))}
            </nav>
            <p className="menu-description">{MENU[selected].description}</p>
            {error && openedMenu === null && <p className="title-save-error" role="alert">{error}</p>}
          </section>
          <figure className="dungeon-scene">
            <TitleScene active={openedMenu === null} motionPreference={settings.backgroundMotion} />
            <figcaption><span><small>CHAPTER I</small><strong>황혼의 석문</strong></span><span>단어의 힘이 깨어나는 곳 <span aria-hidden="true">↗</span></span></figcaption>
          </figure>
        </div>
        <footer className="screen-footer">
          <div className="hints">
            <span><kbd>↑ ↓</kbd> 이동</span>
            <span><kbd>Enter</kbd> 선택</span>
            <span><kbd>Esc</kbd> 닫기</span>
            <span className="pointer-hint">클릭으로 선택할 수 있어요</span>
          </div>
          <p className="version">미리보기 <span aria-hidden="true">/</span> v{version}</p>
        </footer>
      </main>
      {openedMenu === '설정' ? (
        <SettingsDialog settings={settings} saved={settingsSaved} onClose={closeMenu}
          onChange={(key, value) => setSettings((current) => normalizeSettings({ ...current, [key]: value }))}
          onReset={() => setSettings({ ...DEFAULT_SETTINGS })} />
      ) : openedMenu === '단어장' ? <VocabularyDialog onClose={closeMenu} />
        : openedMenu === '오답 복습' ? <ReviewDialog progress={progress} dispatch={dispatch} error={error} onClose={closeMenu} />
          : ['새 모험', '이어하기'].includes(openedMenu) ? <AdventureDialog progress={progress} dispatch={dispatch} error={error} motionPreference={settings.backgroundMotion}
            newAdventure={openedMenu === '새 모험'} onClose={closeMenu} /> : null}
    </div>
  );
}

export default function App() {
  const [settings, setSettings] = useState(readSettings);
  return <GraphicsProvider settings={settings}><SceneTransitionProvider motionPreference={settings.backgroundMotion}><GameApp settings={settings} setSettings={setSettings} /></SceneTransitionProvider></GraphicsProvider>;
}
