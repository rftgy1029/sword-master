# S’word Master 작업 지침

이 파일은 저장소 전체에 적용하는 공통 작업 기준이다. 현재 패키지·타이틀 기준 버전은 **0.8.0**이며(3/4 사선 전투 카메라·로우폴리 3D 몬스터·전투 집중 UI/인라인 퀴즈 도크·첫 실행 3D 품질 선택 및 자산 프리로드·연습 전투 튜토리얼·단일 HTML 관리자판 포함), 기능별 요구사항과 구현 기록은 아래 문서를 참고하고 작업 범위와 충돌하는 과거 제안은 현재 사용자 요청과 실제 코드를 기준으로 판단한다.

## 프로젝트 목적과 명칭

- 학교 영어 클래스룸의 티어 단어리스트를 중심으로 개인 단어장(CSV·Excel)까지 활용하는 영단어 덱빌딩 웹게임이다. 영단어 학습도구 완성이 목적이며, 학습의 정확성·퀴즈 가독성·게임의 재미를 함께 고려한다.
- 프로젝트 가칭은 **S’word Master**다. 새 문서와 UI에는 이 이름을 사용한다. 사용자가 지정한 기획안 제목 **영어 단어앱 기획안**은 유지하고 프로젝트명을 별도로 표시한다.
- 2026년 2학기 기말고사 준비부터 2027년 수능까지 활용할 수 있는 학습도구를 목표로 한다.
- 티어는 선생님이 정한 누적 학습 범위다. 개인의 게임 등급이나 승급 규칙과 동일시하지 않는다.
- AI를 활용한 바이브코딩과 코딩에 관심 있는 학생이 참여하는 프로젝트다. 유료 AI 사용을 참여의 필수 조건으로 해석하지 않는다.
- 역할별 담당자·현재 참여 인원·개발 일정은 확인 없이 확정하지 않는다. 모집 문의 대상은 이규태 선생님이며, 연락이나 메시지 발송은 별도 요청이 있을 때만 한다.
- 기존 UI와 문서는 요청 범위에 맞게 수정하고, 승인된 공식 문서 제목과 제출일은 유지한다.

## 기술 구성과 주요 위치

- **React 19 + Vite 8 + JavaScript + CSS**(Node.js 20.19+ / 22.12+ 기준)를 사용한다. 정적 타입 검사는 파일 단위 옵트인 방식(`tsconfig.json`의 `allowJs: true`, `checkJs: false`, `strict: true`, `noImplicitAny: false` + 파일 상단 `// @ts-check`·JSDoc)으로 `tsc --noEmit`을 사용한다. 개발 소스와 명령 실행 기준은 이 저장소 루트다.
- 기본 입체 장면(타이틀·입장·전투·보상·휴식·대장간·결과)은 **Three.js + React Three Fiber**로 구현한다. 모험 화면(`AdventureDialog`)은 풀스크린 레이아웃과 단일 뷰(고정 하단 액션 바)를, 던전 경로 지도는 평면 보드(`RouteMap`)를 사용한다. Phaser 4 기반 간편 화면과 그래픽 오류 시 2D 복구 흐름은 유지한다.
- 개인 단어장 파싱(`papaparse`, `read-excel-file`)과 오답 PDF 내보내기(`pdfmake`)를 포함하며, 일반 웹 배포(`dist/`, `wrangler.jsonc`), 학생용 단일 HTML(`standalone/sword-master.html`), 관리자용 단일 HTML(`standalone/sword-master-admin.html`)을 모두 지원한다.
- 전역 스타일은 `src/main.jsx`에서 `styles.css` → `premium.css` → `dusk.css` → `battleFocus.css` → `dungeonCraft.css` 순서로 불러온다. 스타일 수정 시 이 계층 순서를 존중한다.
- 기존 구조를 확인하고 기능에 맞는 위치를 수정한다. 게임 규칙·UI·전투 연출·저장을 각자의 책임에 맞게 관리한다.

| 위치 | 역할 |
| --- | --- |
| `src/App.jsx`, `src/menuNavigation.js`, `src/titleWords.js`, `src/survey.js` | 타이틀, 메뉴, 키보드·단어 입력, 브론즈 돌파 설문 자격·링크 검증 |
| `src/components/GraphicsQualityOverlay.jsx`, `src/components/AssetDownloadOverlay.jsx`, `src/game/assetPreload.js` | 최초 실행 3D 그래픽 품질 선택, 3D 무대·모델 14종·전투 이펙트 일괄 사전 로드 및 진행률 표시 |
| `src/components/TutorialDialog.jsx`, `src/components/tutorial.css`, `src/game/tutorial.js` | `새 모험` 진입 및 `설정`·티어 화면에서 실행하는 격리된 연습 전투 튜토리얼(3단계: 카드 선택·퀴즈·턴 종료) |
| `src/components/AdventureDialog.jsx`, `src/components/BattleQuizDock.jsx`, `src/components/QuizPanel.jsx`, `src/components/DungeonEntrance.jsx` | 풀스크린 모험 흐름(티어·입장·전투·보상·휴식·대장간·결과), 전투 하단 인라인 퀴즈 도크(`BattleQuizDock`), 오답 복습 퀴즈 패널(`QuizPanel`) |
| `src/components/RouteMap.jsx`, `src/components/routeMap.css`, `src/game/routeMap.js` | 평면 던전 경로 지도(방 상태·길 표시·숫자 키 선택) |
| `src/components/CombatScene.jsx`, `src/components/CombatIndicators.jsx`, `src/components/StatusBadges.jsx`, `src/components/useHeldStatuses.js`, `src/game/enemyIntent.js`, `src/game/cardPreview.js`, `src/game/overhead.js`, `src/components/overhead.css` | 전투 장면·좌표 투영 연결, 지연 잔상 체력바·에너지 오브·카드 호버/포커스 예상 결과 미리보기, 캐릭터 머리 위 적 의도 유불리·지속 상태 배지·증가분(`+N`) 표시 |
| `src/components/VocabularyDialog.jsx`, `src/components/WordbookImport.jsx`, `src/components/ReviewDialog.jsx`, `src/components/SettingsDialog.jsx`, `src/components/SurveyDialog.jsx` | 단어장·개인 단어장 가져오기, 상시 오답 복습·내보내기, 설정(품질·모션·사운드·단축키 확정·튜토리얼 재실행), 설문 참여 창 |
| `src/game/engine.js`, `src/game/catalog.js`, `src/game/combatShortcuts.js`, `src/game/tierNavigation.js`, `src/game/random.js` | 실제 전투·진행 reducer, 카드 12종·몬스터 12종·유물 6종 데이터, 1회/2회 확정 전투 단축키·티어 키보드 탐색 |
| `src/game/quiz.js`, `src/game/learning.js`, `src/game/learningExport.js`, `src/game/wordbooks.js`, `src/game/wordbookImport.js`, `src/vocabulary.js`, `src/data/vocabulary.json` | 학교 1,000단어(1,048문제)·개인 단어장 출제와 객관식/철자 입력 판정, 상시 오답 통계·PDF/CSV 내보내기, CSV/XLSX 검증 |
| `src/game/storage.js`, `src/game/useProgress.js`, `src/settings.js`, `src/publicAsset.js` | 진행·학습·오답·개인 단어장·설정 저장과 복구, 다중 탭 저장 충돌 감지, `public/` 자산 및 단일 HTML 내장 자산 경로 해결 |
| `src/admin/entry.js`, `src/admin/noop.js`, `src/admin/runtime.jsx`, `src/admin/adminEngine.js`, `src/admin/adminState.js`, `src/admin/admin.css` | 관리자 전용 치트·전투/퀴즈 테스트 도구(`Ctrl/Alt+Shift+A`, 독립 저장 키). 일반·학생용 빌드에서는 `noop.js`로 대체되어 완전 제외 |
| `src/components/SceneView.jsx`, `src/components/GraphicsContext.jsx`, `src/components/GameErrorBoundary.jsx`, `src/components/TitleScene.jsx`, `src/components/SceneTransition.jsx` | 3D·2D 선택, 그래픽·오디오 설정 컨텍스트, 오류 경계 및 2D 복구(25초 로드 타임아웃 포함), 장면 전환 |
| `src/game/three/World.jsx`, `src/game/three/ThreeStage.jsx`, `src/game/three/kenneyDungeon.js` | 3D 장면·조명·셰이더 사전 컴파일(`gl.compile`)·Kenney 던전 부품 배치·수요 기반 렌더 루프(`frameloop="demand"`)·좌표 투영(`top()`) |
| `src/game/three/BattleCamera.jsx`, `src/game/three/battleCamera.js`, `src/game/three/cameraDirector.js` | 용사 뒤쪽 3/4 사선 기본 구도, 화면 비율 대응, 카드·행동·처치별 카메라 연출 |
| `src/game/three/knightRig.js`, `src/game/three/heroMotion.js`, `src/game/three/SkillEffects.jsx`, `src/game/three/ImpactEffects.jsx`, `src/game/three/SwordTrail.jsx`, `src/game/three/CombatAtmosphere.jsx`, `src/game/three/BattleBloom.jsx` | Kenney 기사 관절 자세, 12종 스킬 3D 이펙트, 타격감·흔들림·펀치 줌, 검 끝 궤적 잔상, 플립북 폭발·연기, 선택적 블룸 |
| `src/game/three/playback.js`, `src/game/attackTimeline.js`, `src/game/enemyAttackTimeline.js`, `src/game/cardMotions.js`, `src/game/combatAudio.js` | 연출 재생기, 타격 정지(hit-stop), 카드별 동작·카메라 키 타임라인, Web Audio 전투·보상 효과음 |
| `src/game/three/quality.js`, `src/game/three/toon.js` | 4단계 명시 품질(`lowest`·`low`·`balanced`·`high`)·GPU 추천·상황별 목표 FPS(`effectiveFrameRate`), 툰 명암·선택적 외곽선·피격 플래시 |
| `src/game/combatScene.js`, `src/game/attackEffects.js`, `src/game/enemyAttackEffects.js`, `src/game/titleScene.js`, `src/game/entranceScene.js`, `src/game/illustratedHero.js`, `src/game/spriteAssets.js`, `src/game/mapAssets.js`, `src/components/LegacyCombatScene.jsx`, `src/components/LegacyTitleScene.jsx` | Phaser 간편 화면·2D 복구 렌더링 및 일러스트·Tiled 맵 자산 |
| `src/components/useCardDeal.js`, `src/game/cardDeal.js`, `src/game/cardArt.js`, `src/styles/`, `src/components/adventure.css`, `src/components/ui/` | 카드 드로우 연출, 카드 12종 일러스트(`assets/cards/*.webp`), 스타일 계층(`premium`·`dusk`·`battleFocus`·`dungeonCraft`), 벡터 아이콘(`GameIcon`)·티어 문장(`TierCrest`)·칼 로고(`SwordLogo`)·포털 툴팁(`FloatingTooltip`) |
| `public/`, `assets/`, `scripts/`, `standalone/`, `.agents/`, `wrangler.jsonc`, `vite.config.js`, `tsconfig.json` | 실행용 GLB·이펙트·글꼴·라이선스(`public/`), 원본 자산(`.blend`·Kenney·Tiled·Pixelorama·일러스트·카드 아트워크), 생성·빌드·검증 스크립트, 학생/관리자 단일 HTML, 에이전트 환경 설정(`.agents/environment.json`), Cloudflare Workers·Vite 모드·옵트인 JSDoc 타입 검사 설정 |
| `test/`, `dev/three-preview.html`, `dev/animation-preview.html`, `dev/hero-preview.html` | `node --test` 자동 검사(29개 파일·154개 검사)와 저장 없이 확인하는 3D·연출·일러스트 미리보기 |

## 게임 상태·학습 자료·저장 보호

- 연출 수정 시 기존 피해량·카드 효과·에너지·보상·티어 해금·문제 규칙을 보존한다. 규칙 변경 요청이 있을 때는 해당 요구사항에 맞춰 수정한다.
- 실제 전투 상태는 기존 reducer(`engine.js`)가 관리한다. 렌더러와 재생기는 표시와 연출을 담당하며 피해를 다시 적용하지 않는다. 카드 예상 결과(`cardPreview.js`)와 적 의도 유불리(`enemyIntent.js`)도 상태를 변경하지 않으며, 전투 규칙 변경 시 `engine.js`와 계산을 동기화한다.
- 타격 콜백, 표시 체력(지연 잔상 게이지 포함), 머리 위 의도·상태 표시는 타격 이벤트 및 연출 완료에 맞춰 갱신한다. 같은 effect ID를 중복 재생하지 않고, 프레임이 건너뛰거나 3D 오류로 간편 화면에 인계되더라도 각 타격을 정확히 한 번 전달한다.
- 연출 완료·취소·장면 전환에서 입력 잠금이 남지 않게 한다. 처치·플레이어 사망·턴 종료·정답/오답 자동 복귀 결과가 중복되거나 누락되지 않게 한다.
- 진행·학습·오답 복습(`review`)·개인 단어장(`wordbooks`)·설정(`graphicsQuality`, `shortcutConfirm`, `combatSound`, `combatVolume` 포함)과 이어하기의 호환성을 유지한다. 다중 탭 저장 충돌 감지(`useProgress.js`)를 보존하고, 저장 구조를 바꿀 때는 기존 기록(구 `graphicsQuality: 'auto'` 등)의 처리 방법을 마련한다.
- 연습 전투 튜토리얼(`tutorial.js`, `TutorialDialog.jsx`)은 격리된 상태를 사용하며 학습·오답·클리어 기록을 남기지 않는다.
- 관리자 모드(`src/admin/*`)는 전용 저장 키(`sword-master.admin.adventure.v1`, `sword-master.admin.cheats.v1`)로 일반 학생 기록과 분리한다. `vite.config.js`의 `adminEntryPlugin`이 일반 빌드(`build`)와 학생용 단일 HTML(`build:single`)에서 관리자 코드·CSS를 완전히 제외하도록 유지한다.
- 개인 단어장 클리어는 학교 티어 해금 및 브론즈 돌파 설문 자격(`src/survey.js`)에 포함하지 않는다.
- 단어·뜻·유의어·반의어·티어 범위를 근거 없이 변경하지 않는다. 출제(학교 1,000단어·1,048문제 및 개인 단어장의 중복 필터·주관식 철자 입력)와 정답 판정 변경은 원자료와 대조한다.
- 단어 자료는 선생님이 검수를 마친 것이다. 다시 검수하거나 검수를 출제 조건으로 요구하지 않는다.

## 화면·전투 연출의 공통 기준

- 황혼(Dusk) 색·나무 테두리·Galmuri 픽셀 글꼴(`dusk.css`) 위에 Slay the Spire형 전투 집중 레이아웃(`battleFocus.css`)과 단조 철·황동 HUD·일러스트 카드·단일 뷰 보상/휴식/대장간/결과(`dungeonCraft.css`)를 얹은 애니메이션풍 다크 판타지 스타일을 유지한다. 3D는 Kenney 기사·던전 부품·로우폴리 패싯 판타지 몬스터 12종·툰 명암/외곽선(`toon.js`)을 사용한다.
- 스킬은 색·형태·움직임·리듬으로 구분한다. 준비·발동·타격 또는 효과 완성·잔향·복귀의 흐름을 맞춘다.
- 전투 카메라는 용사 뒤쪽 3/4 사선 구도(`battleCamera.js`)를 기본으로 카드·행동·처치별 카메라 연출(`cameraDirector.js`, `cardMotions.js`)을 적용하고, 퀴즈 중(`studying`)·오답 헛손질·모션 감소 시에는 기본 구도에 고정한다.
- 이동 속도와 발동작을 맞추고, 무기·투사체 접촉과 피격·타격 정지·이펙트·소리·피해 표시를 동기화한다.
- 퀴즈·선택지·다음 행동 표시의 가독성을 유지한다. 전투 퀴즈는 하단 인라인 도크(`BattleQuizDock`, `.is-quizzing`)로 열어 전장 시야를 가리지 않고, 정답 시 연출 후 자동 복귀·오답 시 1.15초 정답 표시(클릭·Enter·Space 즉시 넘김)와 상단 단어 토스트로 복기를 돕는다. 머리 위 적 의도(`EnemyIntent`)와 지속 상태(`StatusBadges`)는 마우스·터치·키보드(`FloatingTooltip`, `Esc` 닫기)와 접근성 라벨을 지원하고, 장식성 미리보기 배지·피해 숫자는 `aria-hidden`으로 구분한다.
- 모바일 화면·터치·키보드 조작과 초점 이동을 지원한다. 전투 손패 `1–5`와 퀴즈 보기 `1–4`는 `settings.shortcutConfirm`(`single` 기본 / `double` 선택)에 맞춰 동작하고, 턴 종료 `Enter`는 `single` 모드에서 낼 카드가 없거나 턴 종료에 초점이 있을 때만 1회·그 외에는 2회 확정하며, 던전 경로 숫자 키는 2회 확정한다. 타이틀 단어 입력·티어 탐색(`tierNavigation.js`)·튜토리얼 키보드 흐름을 유지한다.
- 움직임 줄이기·끄기와 시스템 모션 감소 설정을 존중한다. 감소 모드에서도 타격·방어·회복 결과는 분명하게 전달한다.
- 사운드(`combatAudio.js`) 추가·수정 시 브라우저 오디오 재생 조건(`unlock`)과 효과음 끄기·음량 조절(전투·보상 효과음 모두 포함)을 처리한다.

## 성능과 자산 관리

- PC 60fps·모바일 30fps·저사양 기기(학교 노트북·크롬북) 24fps를 목표로 **4단계 명시 품질(`lowest`, `low`, `balanced`, `high`)**을 제공한다. 구 `auto` 품질 대신 최초 실행 시 `GraphicsQualityOverlay`가 GPU·기기 추천 배지(`recommendGraphicsQuality`)와 함께 직접 선택을 안내하며, 실제 대상 기기에서 측정하지 않은 성능을 검증 완료로 기록하지 않는다.
- 일반 웹 첫 접속 시 `assetPreload.js`와 `AssetDownloadOverlay`가 3D 무대 모듈, 타이틀 GLB, 전투 이펙트 텍스처, 몬스터 12종 GLB를 일괄 사전 로드하고 `THREE.Cache`에 채워 전투 진입 지연과 2D 오동작 복구를 방지한다(단일 HTML 내장 번들에서는 자동 생략). 3D 장면 마운트 시 `gl.compile()`로 셰이더를 사전 컴파일한다.
- `effectiveFrameRate`로 전투 활성 시에는 품질별 최대 FPS를 쓰고 퀴즈·대기 중에는 FPS를 낮춘다(`lowest`는 퀴즈 중 0fps 정지). 낮은 품질에서도 핵심 동작·검광·투사체·충돌 타이밍을 유지하고, `lowest`는 DPR(0.75)·외곽선(`outlines: false`)·그림자·환경광(`RoomEnvironment`)·포인트/림 라이트·부유 입자를 생략하며, `BattleBloom`은 `high` 전용(모션 감소 시 꺼짐)으로 유지한다.
- 프레임마다 불필요한 객체·지오메트리·재질을 만들지 않는다. 필요한 곳에서 재사용·풀링·인스턴싱(`Stones`, `SkillEffects`, `ImpactEffects`, 머리 위 좌표 투영 캐싱)을 활용한다.
- 장면 전환과 반복 실행 시 텍스처·지오메트리·재질·이벤트·오디오 자원을 정리한다.
- 외부 자산의 출처와 라이선스를 `public/licenses/`에 기록하고, 기존 Kenney CC0 고지를 유지한다.
- 모델·이미지 원본, 생성 스크립트, 실행용 산출물의 관계를 확인한다. 재생성으로 덮어쓰는 자산은 원본이나 생성 절차에도 변경을 반영한다.
  - 몬스터 12종 GLB(`public/models/*.glb`, `manifest.json`)와 `.blend`(`assets/models/*.blend`): `scripts/create_3d_assets.py` · `mesh_sculpt.py` · `monsters_wild.py` · `monsters_guardian.py` (`npm run assets:models`, Blender 4.3+). `.blend`를 직접 수정하면 재생성 시 덮어쓴다.
  - 용사(`public/models/hero.glb`): `scripts/import_kenney_hero.py` (`npm run assets:hero3d`), 던전 부품(`public/models/dungeon-kit.glb`): `scripts/build_kenney_dungeon.py` (`npm run assets:dungeon`).
  - 전투 이펙트 텍스처(`public/effects/`): `scripts/export_combat_textures.py` (Pillow).
  - 카드 12종 일러스트(`assets/cards/*.webp`): `src/game/cardArt.js`로 Vite 번들에 포함.
  - 2D 일러스트·보관 픽셀 용사: `scripts/export_illustrations.mjs` (`npm run assets:illustrations`), `scripts/export_hero.py` (`npm run assets:hero`, `npm run assets:check`).
  - `public/` 내 실행 자산(`models/`, `effects/`, `fonts/`)은 `publicAsset()`(`src/publicAsset.js`)으로 참조해 일반 빌드(`dist/`)와 단일 HTML(`standalone/sword-master.html`, `standalone/sword-master-admin.html`의 `window.__SWORD_MASTER_ASSETS__`) 모두에서 로드되게 한다.

## 실행과 변경 범위별 검증

명령은 저장소 루트에서 실행한다. 정확한 스크립트는 `package.json`을 기준으로 한다. 에이전트 환경 초기화 스크립트는 `.agents/environment.json`에 정의되어 있다.

| 명령 | 용도 |
| --- | --- |
| `npm ci` | 의존성 설치가 필요한 경우 |
| `npm run dev` | 개발 서버: http://127.0.0.1:8175/ |
| `npm run dev:admin` | 관리자 모드 개발 서버: http://127.0.0.1:8175/ (`Ctrl/Alt+Shift+A` 오버레이) |
| `npm test` | 게임 규칙·저장·출제·단어장·프리로드·튜토리얼·관리자·카메라·연출 등 자동 검사(29개 파일·154개 검사) |
| `npm run typecheck` | `// @ts-check` 적용 파일 정적 타입 검사(`tsc --noEmit`) |
| `npm run build` | 일반 웹 배포 빌드(`dist/`) |
| `npm run build:single` | 학생용 단일 HTML 파일 빌드(`standalone/sword-master.html`) |
| `npm run build:admin` | 관리자용 단일 HTML 파일 빌드(`standalone/sword-master-admin.html`) |
| `npm run preview` | 빌드 미리보기: http://127.0.0.1:8176/ |
| `npm run test:3d` | 3D 카드·몬스터·타격·품질·복구 브라우저 검증 |
| `npm run test:ui` | UI·모바일·설정·개인 단어장·복습·튜토리얼 등 브라우저 검증 |
| `npm run test:journey` | 모험 전체 흐름 브라우저 검증 |
| `npm run test:survey` | 브론즈 클리어 설문 안내·설문 메뉴 조건 브라우저 검증 |
| `npm run assets:check` | 보관 Pixelorama 원본과 산출물 일치 확인 |

- 코드·동작 변경은 관련 자동 검사(`npm test`), 타입 검사(`npm run typecheck`), 빌드를 실행하고, 영향 범위에 맞는 브라우저 검증을 수행한다. `// @ts-check` 적용 파일(현재 `src/game/storage.js`, `src/game/cardPreview.js`)의 JSDoc 타입을 유지하며, 핵심 로직 추가·수정 시 점진적으로 확장한다. 배포·공유용 산출물을 함께 갱신하는 작업에서는 `npm run build:single`과 필요 시 `npm run build:admin`으로 `standalone/` 반영 여부도 확인한다. 문서만 변경할 때는 내용·참조·차이를 확인한다.
- 브라우저 검증에는 실행 중인 개발 서버와 Playwright Chromium이 필요하다. 설치가 필요하면 `npx playwright install chromium`, 기존 브라우저를 사용할 때는 `CHROMIUM_PATH`를 사용한다. 서버 주소 변경에는 `BROWSER_BASE_URL`을 사용한다.
- 시각적 변경은 실제 브라우저에서 확인한다. 모션·카메라 변경은 영상이나 연속 캡처(`node scripts/capture-combat.mjs` 등)로 이동·접촉·복귀를 확인한다.
- 새로운 테스트는 타격 횟수·순서·중복 방지·완료·저장 호환성·카메라 안전성·관리자 격리 등 실제로 중요한 동작을 검증한다.
- 브라우저 결과물은 Git에서 제외된 `artifacts/`에 생성된다. 공유해야 하는 결과물은 위치를 명확히 안내한다.

## 관련 문서와 완료 보고

- [README](README.md): v0.8.0 개요·실행·단일 HTML·Cloudflare Workers 배포 안내(최신 구현 세부 사항은 코드와 이 문서를 우선 확인한다).
- [전장 개편 구현 기록](docs/combat-overhaul-implementation.md): 타임라인·이펙트·오디오·3/4 사선 전투 카메라·카드별 카메라·브라우저 검증 기록.
- [전장 경험 개편 명세](docs/combat-overhaul.md): 전장 개편 요구사항 명세. 구현 상태는 구현 기록 및 코드와 대조해 확인한다.
- [전투 가독성 개선 계획](docs/feedback-readability-plan.md): 선생님 피드백 반영 계획(입장·퀴즈·전투 HUD·머리 위 표시·사선 카메라 등 후속 구현 범위는 코드 기준으로 확인).
- [UI·3D 구현 기록](docs/UI_3D_IMPLEMENTATION.md), [UI·3D 계획](docs/UI_3D_UPGRADE_PLAN.md): v0.7.0 3D·황혼 UI 구현과 검증 이력.
- [단어 자료](docs/vocabulary.md): 학교 티어 1,000개 단어 자료와 변환 규칙.
- [프로젝트 배경·초기 기획·모집문 원문](docs/project-background.md): 기존 지침의 원문 보관. 과거 인원·일정·30개 단어 검증안은 당시 기록이며 현재 구현 범위로 단정하지 않는다.
- 완료 보고에는 실제로 바뀐 내용, 수행한 검증과 결과, 관련 파일·결과물 위치, 남은 한계를 간결하게 적는다. 목표·제안·확인된 구현·미검증 항목을 구분한다.
