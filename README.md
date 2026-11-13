# S’word Master

학교 영어 클래스룸의 티어별 단어 목록으로 공부하는 영단어 덱빌딩 웹게임입니다. 2026년 2학기 기말고사부터 2027년 수능까지 활용할 수 있는 학습 도구를 목표로 합니다. 현재 타이틀과 패키지 버전은 **0.7.0**입니다.

**바로 플레이:** Cloudflare Workers에 배포한 사이트 [sword-master.jcy0164.workers.dev](https://sword-master.jcy0164.workers.dev)에서 설치 없이 플레이할 수 있습니다. 배포 설정은 `wrangler.jsonc`(빌드 결과 `dist/`를 그대로 올림)에 있습니다.

기본 장면은 **Three.js + React Three Fiber의 실제 3D**입니다. 용사와 몬스터 12종, 던전·입장·경로·보상·휴식·대장간·결과 장면을 입체로 구성하고 전체 UI를 같은 녹색·아이보리·금색 규칙으로 개편했습니다. 모바일 퀴즈는 큰 세로 선택지를 사용합니다. [구현과 검증 기록](docs/UI_3D_IMPLEMENTATION.md) · [실행한 계획](docs/UI_3D_UPGRADE_PLAN.md)

설정에서 입체·간편 화면과 그래픽 품질을 고릅니다. 그래픽 오류 시 기존 저장을 유지하며 2D 일러스트 화면으로 복구합니다. 몬스터 모델 생성 코드는 `scripts/create_3d_assets.py`, 용사(Kenney Mini Characters, CC0) 변환 코드는 `scripts/import_kenney_hero.py`, 던전 부품(Kenney Mini Dungeon, CC0) 묶음 코드는 `scripts/build_kenney_dungeon.py`, GLB와 자산 목록은 `public/models/`에 있습니다. [전투 화면](docs/screenshots/3d-battle-production.png)

## 실행

Node.js 20.19 이상(20.x) 또는 22.12 이상이 필요합니다. 저장소 루트에서 실행합니다.

```sh
npm ci
npm run dev
```

개발 서버는 `http://127.0.0.1:8175/`에서 열립니다.

```sh
npm test
npm run build
npm run preview
```

빌드 결과는 `dist/`에 생성되며 `http://127.0.0.1:8176/`에서 미리 볼 수 있습니다.

`npm run build:single`은 게임 전체(코드·화면·3D 모델·글꼴·단어 자료)를 HTML 파일 하나로 묶어 [standalone/sword-master.html](standalone/sword-master.html)에 저장합니다. 서버나 인터넷 없이 브라우저로 파일을 열어 바로 플레이할 수 있으며, 기록은 그 브라우저에 저장됩니다. 게임을 고친 뒤에는 이 명령으로 파일을 다시 만듭니다.

## 플레이와 학습

- **새 모험**에서 티어를 고르면 던전 입장 연출을 거쳐 8층 경로가 열립니다. 전투·보물·휴식·대장간을 거쳐 보스를 상대합니다. 첫 모험은 브론즈에서 시작하며, 해당 티어의 보스를 쓰러뜨리면 다음 티어가 열립니다.
- **브론즈 클리어 설문 안내**는 승리 결과의 ‘타이틀로 돌아가기’를 누르면 타이틀 위에 자동으로 표시됩니다. 닫기·나중에 할게요·Esc로 돌아갈 수 있고, 다른 화면을 닫을 때 다시 표시되지 않습니다. 설문 주소는 `src/survey.js`의 `SURVEY_FORM_URL`에서 연결하며, 주소가 없으면 설문 주소 준비 중 안내를 표시합니다. `npm run test:survey`로 자동 표시·모바일·다른 티어와 패배의 제외 조건을 검증할 수 있습니다.
- **전투**는 매 턴 에너지 3과 카드 5장으로 시작합니다. 카드를 고르면 에너지를 쓰고, 뜻·유의어·반의어 퀴즈를 맞히면 카드 효과가 발동합니다. 전투 보상으로 덱에 카드를 추가하거나 유물을 얻고, 휴식이나 대장간에서 강화할 수 있습니다.
- **단어장**에서는 모든 티어의 누적 범위를 조회할 수 있습니다. 브론즈 64개, 실버 290개, 골드 741개, 플래티넘 969개, 마스터 1,000개입니다. 단어·뜻·유의어·반의어는 선생님이 검수를 마친 자료입니다. 전투에서는 선택한 티어 범위의 모든 단어가 뜻 문제로 나옵니다(1,000개 단어·1,048문제). 72개 단어는 직접 만든 선택지, 나머지는 같은 품사·티어 단어의 뜻 중 정답과 뜻이 겹치지 않는 것을 자동으로 고른 선택지이며, 유의어·반의어 문제는 24개 단어에서 나옵니다. [단어 자료와 검색 방식](docs/vocabulary.md)
- **설문 참여**는 학교 티어(브론즈 이상)를 한 번이라도 클리어한 브라우저의 타이틀 메뉴에만 나타나며, 선생님의 사용자 경험 조사 구글폼을 새 탭으로 엽니다. 폼 주소는 `src/survey.js`의 `SURVEY_FORM_URL`에 넣습니다. 비어 있으면 ‘설문 주소 준비 중’으로 잠기고, `https://forms.gle/…`·`https://docs.google.com/forms/…` 주소만 링크로 엽니다.
- **이어하기와 오답 복습**에 쓰이는 진행 상태, 학습 기록, 클리어 기록은 같은 브라우저에 저장합니다. 퀴즈나 해설을 열어 둔 채 종료해도 해당 상태에서 이어갈 수 있습니다. 화면 설정도 같은 브라우저에 저장됩니다.

| 화면 | 키 | 동작 |
| --- | --- | --- |
| 타이틀 | ↑ / ↓, Enter | 메뉴 이동 및 선택 |
| 전투 손패 | 1–4 | 첫 네 장 중 해당 카드를 한 번 눌러 선택하고 같은 키를 다시 눌러 사용 |
| 퀴즈 | 1–4 | 해당 보기를 한 번 눌러 선택하고 같은 키를 다시 눌러 제출 |
| 전투 손패 | Enter | 기본 전투 단축키로 두 번 눌러 턴 종료 |

## 버전별 변경

날짜는 각 변경이 처음 기록된 커밋 기준입니다. 현재 v0.7.0은 v0.6 덱빌딩 게임에 전체 UI·3D 개편을 적용한 버전입니다. Git 이력에 남은 이전 v0.7~v0.9 스토리 실험과 스파이어 에디션 v1.0은 별도 개발 이력입니다.

| 날짜 | 버전·변경 | 주요 차이 | 커밋 |
| --- | --- | --- | --- |
| 2026-11-03 | v0.1 Word Paws | Vite + TypeScript로 옮긴 단어 디펜스 초안. 정답으로 에너지를 얻고 고양이 부대를 소환했습니다. 이후 저장소의 앱 파일을 초기화했습니다. | `8778147`, `d4b7e31` |
| 2026-11-03 | v0.3 React 시작 화면 | React로 타이틀, 키보드 메뉴, 안내창을 구성했습니다. | `a6ffafd` |
| 2026-11-03 | v0.4 타이틀 개편 | 왼쪽에 로고와 메뉴, 오른쪽에 Canvas 픽셀 던전 입구를 배치했습니다. [구현 기록](docs/main-screen-v0.4.md) | `2cc1653` |
| 2026-11-04 | v0.5 설정·단어장 | 글자 크기와 배경 움직임 설정을 저장하고, 창이나 탭을 전환한 뒤에도 키보드 조작을 이어갈 수 있게 했습니다. 5개 누적 티어와 1,000개 단어 검색을 추가했습니다. [설정 기록](docs/settings-v0.5.md) | `cfbd757`, `b9b9ed8`, `b778a93` |
| 2026-11-04~05 | v0.7~v0.9 스토리 실험 | 브론즈 스토리의 대사·전투·퍼즐(v0.7), 던전 통로와 첫 슬라임전(v0.8), 해독검 모션과 효과음(v0.9)을 별도 개발 이력에서 추가했습니다. | `c195e10`, `2960af8`, `b92fd58` |
| 2026-11-05 | 스파이어 에디션 v1.0·롤백 | 브론즈 전투 프로토타입을 추가했다가 v0.5 단어장 상태로 되돌렸습니다. | `8fb35b0`, `1351ba3` |
| 2026-11-05 | v0.6 덱빌딩 | 티어별 8층 모험, 퀴즈로 발동하는 카드, 보상·유물·강화·상점, 이어하기와 오답 복습을 도입했습니다. [초기 전투 설계](docs/deckbuilding-v0.6.md) | `5f7715d` |
| 2026-11-06 | v0.6 전투 연출 | Phaser 전투와 던전 입장, 카드별 기술·드로우 연출, 보스 클리어에 따른 티어 순차 해금을 추가했습니다. 용사 스프라이트를 연결하고, 몬스터 동작과 타격 시점의 피해 표시를 개선했습니다. [구현 기록](docs/priority-implementation.md) | `ac99ecc`, `7597480` |
| 2026-11-06 | v0.6 맵·키보드 조작 | 타이틀 던전 입구와 전투 배경 3종을 Tiled 맵으로 구성했습니다. 카드·퀴즈·턴 종료에 두 번 눌러 확정하는 단축키를 추가했습니다. [맵 편집 안내](assets/maps/README.md) | `e30bd48` |
| 2026-11-10 | v0.6 전투 화면 수정 | 퀴즈를 풀 때 전투 장면 높이와 문제 패널의 여백을 줄였습니다. 넓은 전투 화면에서 반복 배치한 타일이 잘려 보이는 문제를 수정했습니다. | `3955eb8` |
| 2026-11-12 | v0.7.0 UI·3D 개편 | 실제 3D 용사·몬스터 12종과 던전·기술·전체 UI, 품질 설정과 간편 화면 복구를 추가했습니다. [구현 기록](docs/UI_3D_IMPLEMENTATION.md) | 이 PR |

## 코드와 에셋

| 위치 | 역할 |
| --- | --- |
| `src/App.jsx`, `src/menuNavigation.js` | 타이틀 메뉴와 키보드 초점 처리 |
| `src/components/AdventureDialog.jsx`, `src/components/QuizPanel.jsx` | 티어 선택, 경로, 전투·퀴즈, 보상과 결과 UI |
| `src/game/engine.js`, `catalog.js`, `quiz.js`, `storage.js` | 전투 규칙, 카드·유물 데이터, 출제 및 진행 상태 저장 |
| `src/components/SceneView.jsx`, `src/game/three/` | 3D 장면·관절 애니메이션·기술·품질 설정과 간편 화면 연결 |
| `src/styles/dusk.css`, `src/titleWords.js`, `src/components/ui/SwordLogo.jsx` | 황혼 색·Galmuri 글꼴의 화면 디자인, 단어로 고르는 타이틀 메뉴, 칼 모양 로고 |
| `src/game/titleScene.js`, `entranceScene.js`, `combatScene.js` | 간편 화면용 Phaser 타이틀·입장·전투 렌더링 |
| `src/vocabulary.js`, `src/data/vocabulary.json` | 티어별 단어 자료와 검색 |
| `assets/maps/`, `assets/source/`, `assets/illustrations/` | Tiled 맵·Pixelorama 보관 원본과 2D 일러스트 |
| `public/models/`, `scripts/create_3d_assets.py`, `scripts/import_kenney_hero.py` | 실제 3D GLB·자산 목록, 몬스터 생성 코드와 Kenney 용사 변환 코드 |
| `assets/kenney/`, `assets/models/` | Kenney CC0 원본(용사·검·던전 부품)과 Blender에서 열어 볼 수 있는 `.blend` 장면 |
| `src/game/three/kenneyDungeon.js`, `scripts/build_kenney_dungeon.py` | Kenney 던전 부품 배치와 `dungeon-kit.glb` 생성 |
| `src/styles/premium.css`, `src/components/ui/` | 공통 UI 규칙과 벡터 아이콘 |

React와 JavaScript가 게임 상태와 UI를 관리하고, Three.js가 입체 장면과 기술 효과를 그립니다. Phaser는 간편 화면에 사용합니다. Vite로 개발 서버와 배포 빌드를 실행합니다. 용사 Pixelorama 원본을 수정한 뒤 `npm run assets:hero`로 PNG를 갱신하고 `npm run assets:check`로 일치 여부를 확인할 수 있습니다. [용사 에셋 안내](assets/source/README.md)


## 검증

자동 검사 76개, 배포 빌드, 기존 Pixelorama 원본 일치 검사가 통과했습니다. 실제 Chromium WebGL에서 8층 모험 완주, 몬스터 12종·카드 12종과 강화형, PC·모바일 퀴즈·터치·복습·설정, 치명타 결과와 2D 복구를 확인했습니다. 실제 학교 컴퓨터·휴대폰의 GPU 성능과 교실 플레이테스트는 남아 있습니다.

개발 서버가 실행 중일 때 아래 브라우저 검증을 실행할 수 있습니다. 최초 1회 `npx playwright install chromium`으로 브라우저를 설치합니다. 이미 설치된 Chromium은 `CHROMIUM_PATH`로 지정할 수 있습니다.

```sh
npm run test:3d
npm run test:ui
npm run test:journey
```

저장 없이 확인하는 3D 미리보기는 `/dev/three-preview.html`입니다. 2D 일러스트는 `npm run assets:illustrations`, 모델은 Blender 4.3 이상에서 `npm run assets:models`(몬스터), `npm run assets:hero3d`(용사), `npm run assets:dungeon`(던전 부품)으로 다시 생성할 수 있습니다. [보관 원본과 자산 안내](assets/source/README.md)
