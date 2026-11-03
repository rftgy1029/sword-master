# S’word Master 시작 화면 애니메이션 자산

- 생성 방식: 내장 imagegen 도구. CLI/API 대체 실행은 사용하지 않음.
- 입력/기존 보존 자산: `assets/images/title_background.png`.
- 새 저장 자산: `assets/images/title_cloak_clean_plate.png`.
- 용도: 움직이는 망토 아래에 드러나는 바닥·벽·의복 보완. 전체 장면 교체용이 아님.
- 실제 망토는 원본 이미지에서 코드로 분리해 작은 삼각형 격자로 움직임. 어깨 부근은 고정하고 끝부분은 약 10px 내외로 흔들림. 신규 배경은 원래 망토 윤곽 내부에만 합성.
- 횃불 빛·불꽃·불씨와 메뉴 강조 효과는 코드로 그림. 추가 이미지 자산 없음.

최종 생성 요청:

> Use case: precise-object-edit. Edit target: the supplied S’word Master dungeon title background. Create a CLEAN PLATE for a cloth animation, not a redesign. Keep EXACTLY the original image dimensions, camera, crop, character proportions, pixel-art style, lighting, architecture, and every other pixel as closely as possible. The original is 1672 by 941. REMOVE ONLY the long trailing rust-red cloak fabric below the shoulder hood, roughly the cloth area x842..1118,y431..678. Remove the hanging flapping fabric behind the left arm and sweeping left/down; fill that area naturally with the stone wall and floor visible around it, and the small previously occluded portion of the adventurer's rear clothing/left thigh where needed. KEEP the short rust-red shoulder hood/cowl at x1015..1140,y390..448, the head, arms, armor, belt, legs, boots and sword entirely unchanged. Do not erase the whole character. Do not replace or repaint anything outside the trailing cloak. No additional character, no text, no UI, no frame, no new props. This image will only be sampled under the old cloak silhouette, so the rebuilt paving and wall must have exactly matching perspective and color. Return the full same composition, not a crop.

구현에 참고한 공식 문서: [Canvas.drawVertices](https://api.flutter.dev/flutter/dart-ui/Canvas/drawVertices.html), [CustomPainter](https://api.flutter.dev/flutter/rendering/CustomPainter-class.html), [MediaQueryData.disableAnimations](https://api.flutter.dev/flutter/widgets/MediaQueryData/disableAnimations.html).
