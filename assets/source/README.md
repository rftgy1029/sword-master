# S’word Master 캐릭터 원본

기본 화면의 실제 3D 모델은 `public/models/`, Blender 제작 원본은 `scripts/create_3d_assets.py`입니다. [UI·3D 구현 기록](../../docs/UI_3D_IMPLEMENTATION.md)을 참고하세요. 아래 일러스트와 픽셀 자료는 간편 화면과 보관용 원본입니다.

## 간편 화면의 일러스트 캐릭터

- `characters-illustrated.png`: 새로 생성한 투명 배경의 4×4 일러스트 원본. 첫 행은 용사의 대기·공격 준비·베기·이동, 나머지는 몬스터 12종입니다.
- `../illustrations/hero.webp`, `hero-poses.webp`, `monsters.webp`, `monsters.json`: 게임용 314px 프레임과 Phaser 아틀라스. 이미지 합계 약 645 kB입니다. 캐릭터는 부드럽게 확대하며 시작 화면·입장 장면은 1152×864 Canvas로 렌더링합니다. 몬스터마다 알파 실루엣에서 발·꼬리 기준점을 계산해 바닥에 맞춥니다.
- `npm run assets:illustrations`: ImageMagick의 `identify`, `convert`로 원본의 각 셀을 분리하고 투명 WebP와 아틀라스를 다시 만듭니다. 원본 그림을 덮어쓰지 않습니다.
- `src/game/illustratedHero.js`: 그림 전체를 유지하며 공격 단계에 맞는 자세를 선택합니다. 호흡·이동·돌진·피격과 기존 기술 효과를 합성하며, 몬스터는 각 1장의 일러스트에 이동·기울기·부유·피격 효과를 적용합니다.
- `/dev/hero-preview.html`: 용사 4개 자세와 몬스터 12종을 한 화면에서 확인합니다. `/dev/animation-preview.html`에서 실제 전투 연출을 확인합니다.

## 보존한 픽셀 용사

- 사용자가 수정·저장한 원본: `../concepts/young-warrior-pixel.png.pxo` (64×64, 한 레이어·한 자세).
- 보관 PNG: `../sprites/hero-young.png`. 원본 cel의 RGBA 픽셀과 위치를 그대로 내보냅니다. 수정한 눈·얼굴을 다시 그리거나 축소하지 않습니다.
- 변환 정보: `../sprites/hero-young.json`에 원본 경로·SHA-256·크기·발 기준점을 기록합니다.
- 원본을 수정해서 저장한 뒤 저장소 루트에서 `npm run assets:hero`로 갱신합니다. `npm run assets:check`는 저장 원본과 PNG의 일치를 확인합니다. 변환 명령은 Python 3 표준 라이브러리만 사용합니다. 레이어·프레임을 추가하면 자동으로 잘못 합치지 않고 Pixelorama 내보내기를 사용하라는 오류를 냅니다.

이전 픽셀 렌더러 `src/game/heroRig.js`와 원본 검사를 보존합니다. 현재 타이틀·던전 입장·지도 표식·전투는 새 일러스트를 사용합니다. 픽셀 원본 내보내기 명령은 새 일러스트를 덮어쓰지 않습니다.

## 기존 직접 정의 에셋

- `../sprites/monsters.png`: 이전 64×64 셀, 6프레임×12종. 보관용이며 현재 게임은 일러스트 아틀라스를 사용합니다.
- `../sprites/status-icons.png`: 24×24 셀 8개.
- `../sprites/hero-attacks.png`: 이전 코드 제작 용사 6자세. 보존하며 현재 게임에서는 사용하지 않습니다.
- `scripts/create_pixel_assets.py`: 위 초기 에셋의 제작 소스입니다. 현재 용사 PNG를 덮어쓰지 않습니다.

몬스터·상태 아이콘의 별도 Pixelorama 편집 원본은 아직 없습니다. 이전 프로토타입과 생성 시안도 보존합니다.
