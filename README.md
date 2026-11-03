# S’word Master — React 웹게임

현재 개발 소스는 **React + Vite + JavaScript + CSS**입니다. 단어 학습용 게임을 만들기 위한 구조로 시작 화면, 메뉴 조작, 안내창을 React 컴포넌트로 전환했습니다.

## 실행

Node.js 20.19+ 또는 22.12 이상이 필요합니다. 이 폴더에서 실행합니다.

```sh
npm install
npm run dev
```

개발 주소: `http://127.0.0.1:8175/`. 종료는 터미널에서 Ctrl+C입니다.

배포용 파일 생성과 확인:

```sh
npm run build
npm run preview
```

미리보기 주소: `http://127.0.0.1:8176/`. `dist/`가 배포할 파일입니다. 학교에서 사용할 공개 주소는 아직 없습니다. 원본 소스는 Vite를 통해 실행하며, Python 서버로 원본 JSX를 직접 제공하지 않습니다.

## 파일 역할

- `src/main.jsx`: React 시작점과 StrictMode.
- `src/App.jsx`: 시작 화면과 메뉴 선택 상태, 키보드 이동.
- `src/components/MenuDialog.jsx`: 준비 중 안내창과 HTML dialog 동작.
- `src/components/TitleScene.jsx`: Canvas 애니메이션 연결. 컴포넌트가 사라지면 AbortController로 루프·이벤트를 정리합니다.
- `src/scene.js`: 기존 횃불·망토·불씨 애니메이션. 화면 변화마다 React 상태를 갱신하지 않고 Canvas에서 그립니다.
- `styles.css`: 배치·글꼴·선택 메뉴의 3.2초 밝기 변화·작은 창 대응.
- `assets/`: 기존 이미지와 공개 글꼴. 이미지와 글꼴은 Vite가 배포 파일에 포함합니다.
- `public/licenses/`: 배포 파일에도 포함되는 글꼴 OFL 라이선스.
- `package-lock.json`: 실제 설치한 의존성 버전을 고정한 기록. 팀에서는 `npm ci`로 동일하게 설치할 수 있습니다.

## 구현 범위와 확인

저장 기능이 아직 없으므로 이어하기는 비활성화했고, 활성 메뉴는 준비 중 안내창을 엽니다. 전투 화면·단어 문제·학습 기록은 이후 요청에서 추가합니다.

React 19.3.1, React DOM 19.3.1, Vite 8.3.5, React 플러그인 6.2.1 설치와 배포 빌드가 통과했습니다. 개발 컴퓨터는 Node.js 26.8.1입니다.

React 배포 빌드의 실제 브라우저에서 방향키 순환·비활성 메뉴 건너뛰기·Tab·Enter·Esc·초점 복귀, 클릭으로 오답 복습 안내 열기와 돌아가기를 확인했습니다. 1366×768 및 360×480 창에서 메뉴에 접근할 수 있었고 가로 넘침은 없었습니다. 서로 다른 시점의 캡처로 횃불·망토·선택 표시가 움직이는지 확인했으며, 브라우저 콘솔 오류·경고는 없었습니다. 캡처는 `docs/screenshots/react-*.jpg`에 보관합니다.

플랫폼의 움직임 줄이기 설정에 따른 정지 화면과 숨겨진 탭에서의 일시 정지를 지원합니다. 실제 학교 크롬북·터치패드 하드웨어·학교 네트워크·메모리 사용량은 아직 검증하지 않았습니다.

[기존 이미지 생성 기록](docs/animation-assets.md). React 전환에서는 새 이미지를 생성하지 않았습니다. 이전 Flutter 격자 방식 설명은 당시 작업 기록이며, 현재는 Canvas 2D의 가로 띠 변형 방식입니다.
