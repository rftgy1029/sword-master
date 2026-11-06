# S’word Master 픽셀 아트 원본

## 현재 용사

- 사용자가 수정·저장한 원본: `../concepts/young-warrior-pixel.png.pxo` (64×64, 한 레이어·한 자세).
- 게임용 PNG: `../sprites/hero-young.png`. 원본 cel의 RGBA 픽셀과 위치를 그대로 내보냅니다. 수정한 눈·얼굴을 다시 그리거나 축소하지 않습니다.
- 변환 정보: `../sprites/hero-young.json`에 원본 경로·SHA-256·크기·발 기준점을 기록합니다.
- 원본을 수정해서 저장한 뒤 저장소 루트에서 `npm run assets:hero`로 갱신합니다. `npm run assets:check`는 저장 원본과 PNG의 일치를 확인합니다. 변환 명령은 Python 3 표준 라이브러리만 사용합니다. 레이어·프레임을 추가하면 자동으로 잘못 합치지 않고 Pixelorama 내보내기를 사용하라는 오류를 냅니다.

타이틀·던전 입장·지도 표식·전투가 같은 외형을 사용합니다. `src/game/heroRig.js`가 원본을 얼굴/몸·망토·검을 든 팔·양다리로 나누어 실시간으로 그립니다. 원본에 없는 자세는 회전·이동으로 합성하며, 팔 뒤에 가려져 있던 몸통 부분은 작은 보완 도형으로 채웁니다. 한 자세 원본을 수작업으로 그린 여러 공격 프레임이라고 표시하지 않습니다. 정지 상태에서는 원본 4,096픽셀이 모두 일치합니다.

## 기존 직접 정의 에셋

- `../sprites/monsters.png`: 64×64 셀, 6프레임×12종. 행 순서는 `src/game/spriteAssets.js`의 `MONSTER_ROWS`입니다. 기본·호흡·공격·방어·집중·피격 자세에 실제 이동·광륜·입자를 합성합니다.
- `../sprites/status-icons.png`: 24×24 셀 8개.
- `../sprites/hero-attacks.png`: 이전 코드 제작 용사 6자세. 보존하며 현재 게임에서는 사용하지 않습니다.
- `scripts/create_pixel_assets.py`: 위 초기 에셋의 제작 소스입니다. 현재 용사 PNG를 덮어쓰지 않습니다.

몬스터·상태 아이콘의 별도 Pixelorama 편집 원본은 아직 없습니다. 이전 프로토타입과 생성 시안도 보존합니다.
