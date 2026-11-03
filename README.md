# 단어 수비대 · WORD PAWS

공유 드라이브의 `냥코초안(찬영).html`을 Vite + TypeScript 프로젝트로 옮긴 버전입니다.
단어 정답으로 에너지를 모으고, 고양이 부대를 소환해 적 기지를 파괴합니다.
기존 화면과 게임 규칙을 기준으로 코드를 역할별로 분리했습니다.

## 내 컴퓨터에서 실행

1. ZIP을 압축 해제하고 `word-paws` 폴더를 VS Code 또는 Codex에서 엽니다.
2. [Node.js](https://nodejs.org/) 24 LTS 이상을 설치합니다.
3. 프로젝트 폴더의 터미널에서 실행합니다.

```sh
npm ci
npm run dev
```

브라우저에서 <http://localhost:5173>을 엽니다.
이제 `index.html`을 더블 클릭하는 대신 개발 서버로 실행합니다.
코드를 저장하면 변경 사항이 브라우저에 반영됩니다. 새로고침/코드 갱신 시 플레이는 초기화됩니다.

## 명령어

| 명령어 | 용도 |
| --- | --- |
| `npm run dev` | 개발 서버 실행 |
| `npm run typecheck` | TypeScript 검사 |
| `npm test` | 전투·퀴즈 핵심 로직 테스트 |
| `npm run build` | 타입 검사 후 배포 파일을 `dist/`에 생성 |
| `npm run preview` | 빌드 결과를 <http://localhost:4173>에서 확인 |
| `npm run test:e2e` | 빌드 후 Chromium에서 사용자 흐름 테스트 |

브라우저 테스트를 처음 실행하기 전에는 `npx playwright install chromium`을 실행합니다.
Linux에서 추가 라이브러리가 필요하면 Playwright의 설치 안내를 따릅니다.

## 폴더 구조

```text
word-paws/
├── index.html            # 웹 진입점
├── package.json          # 실행 명령어와 의존성
├── package-lock.json     # 같은 버전으로 설치하기 위한 잠금 파일
├── vite.config.ts        # 개발 서버·빌드 설정
├── tsconfig.json         # TypeScript 설정
├── playwright.config.ts  # 브라우저 테스트 설정
├── public/favicon.svg
├── src/
│   ├── main.ts           # 화면 생성과 앱 시작
│   ├── app.ts            # 입력·게임 루프·각 모듈 연결
│   ├── types.ts          # 공유 데이터 타입
│   ├── styles.css        # 디자인과 반응형 레이아웃
│   ├── data/
│   │   ├── words.ts      # 기초·중학 단어 40개 (초기 테스트용)
│   │   ├── stages.ts     # 스테이지 3개
│   │   └── units.ts      # 유닛 3종 능력치
│   ├── game/
│   │   ├── battle.ts     # 소환·자동 전투·승패 시뮬레이션
│   │   ├── quiz.ts       # 출제·힌트·콤보·오답 복습
│   │   ├── rules.ts      # 에너지 등 공통 게임 규칙
│   │   └── renderer.ts   # Canvas 2D 전장·캐릭터 그리기
│   └── ui/
│       ├── screen.html   # 게임 화면 구조
│       ├── view.ts       # 버튼·통계·결과 화면 갱신
│       └── dom.ts        # 화면 요소 조회
├── tests/
│   ├── game.test.ts      # 순수 로직 회귀 테스트
│   └── browser/          # 실제 브라우저 테스트
└── docs/architecture.md  # 구조와 다음 확장 지점
```

## 현재 플레이 범위

- 돌격·방패·마법 고양이 3종, 적 3종, 스테이지 3개
- 영어 뜻 4지선다, 기초/중학 난이도 선택, 문장 힌트
- 정답 보상 55, 3연속 정답 보너스 35, 오답/힌트 사용 시 보상 없음
- 에너지 자동 회복, 소환 비용과 쿨타임, 전투 승리/패배/재도전
- 오답 재출제, 플레이 중 정답률과 복습 기록
- 키보드 선택 `1–4`, 소환 `Q/W/E`, 일시정지 `P`, 버튼·터치 조작
- 다른 탭으로 이동하면 자동 일시정지

단어 데이터와 유닛·스테이지를 수정할 때는 `src/data/`에서 시작합니다.
단어 형식은 `[영어 단어, 한국어 뜻, 영문 힌트 문장]`이며 각 난이도에는 서로 다른 뜻이 최소 4개 있어야 합니다.
원본과 동일하게 기록은 현재 플레이 동안만 유지됩니다. 로그인, DB, 자동 저장, 랭킹은 아직 구현하지 않았습니다.

## 웹 배포

```sh
npm ci
npm run build
```

생성된 `dist/` 폴더를 정적 웹 호스팅에 올리면 웹주소로 플레이할 수 있습니다.
Vercel 등을 사용할 경우 프로젝트 루트는 `package.json`이 있는 저장소 루트, 빌드 명령은 `npm run build`, 출력 폴더는 `dist`로 설정합니다.
이 프로젝트 변환 작업에서는 실제 호스팅 배포를 수행하지 않았습니다.

## 이전 기획 문서

프로젝트 초기 목표와 Flutter Web 검토 내용은 [초기 기획 기록](docs/project-background.md)에 보관했습니다.
현재 실행 가능한 프로토타입은 이 저장소 루트의 Vite + TypeScript 프로젝트입니다.

## 앞으로 확장할 부분

전투와 퀴즈는 브라우저 화면에 의존하지 않아 독립적으로 테스트할 수 있습니다.
React 메뉴는 `ui/`, Phaser 전투 화면은 `renderer.ts`의 역할을 대체하며 단계적으로 도입할 수 있습니다.
계정·학교 단어장·온라인 저장을 추가할 때는 API/저장소 계층을 별도로 두고 연결합니다.
구체적인 경계는 [구조 문서](docs/architecture.md)를 참고하세요.
