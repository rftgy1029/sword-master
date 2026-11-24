// DOM card backs keep the actual accessible hand in React and avoid a second engine.
// 카드 한 장의 흐름: 뽑기 더미에서 살짝 들려 나옴 → 호를 그리며 손패 자리로 이동 →
// 부채꼴 각도에 정확히 안착 → 뒷면이 옆으로 접히고 실제 카드가 앞면으로 펼쳐짐.

// 배속: 전투 긴장감을 위해 기본 연출 시간을 이 값으로 나눈다(1 = 원래 속도).
export const DEAL_SPEED = 1.8;
const scaled = (ms) => Math.round(ms / DEAL_SPEED);
const FLIGHT_MS = scaled(500);
const FLIP_OUT_MS = scaled(105);
const FLIP_IN_MS = scaled(170);
const STAGGER_MS = scaled(105);
const RESHUFFLE_DELAY_MS = scaled(180);
const SHEEN_MS = scaled(520);
const PILE_BUMP_MS = scaled(190);
const PERSPECTIVE = 'perspective(760px)';

const BACK_MARKUP = '<span class="card-back-rim"></span>'
  + '<svg class="card-back-emblem" viewBox="0 0 48 48" aria-hidden="true">'
  + '<path d="M24 4 L27 9 L27 30 L21 30 L21 9 Z" />'
  + '<path d="M14 30 H34 V33.5 H14 Z" />'
  + '<path d="M22 33.5 H26 V41 H22 Z" />'
  + '<circle cx="24" cy="43.5" r="2.6" />'
  + '</svg><span class="card-back-sheen"></span>';

function parseMatrix(value) {
  if (!value || value === 'none') return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  const nums = value.match(/-?[\d.]+(?:e-?\d+)?/g)?.map(Number) ?? [];
  if (value.startsWith('matrix3d')) return { a: nums[0], b: nums[1], c: nums[4], d: nums[5], e: nums[12], f: nums[13] };
  const [a = 1, b = 0, c = 0, d = 1, e = 0, f = 0] = nums;
  return { a, b, c, d, e, f };
}

function parseOrigin(value, width, height) {
  const [x = width / 2, y = height / 2] = (value || '').split(' ').map((part) => parseFloat(part));
  return { x: Number.isFinite(x) ? x : width / 2, y: Number.isFinite(y) ? y : height / 2 };
}

/** 실제 카드의 화면 배치(중심·각도·배율)와 원본 크기를 읽는다. 상위 컨테이너 기준 좌표. */
export function measureCard(element, bounds) {
  const style = getComputedStyle(element);
  // 소수점 크기까지 맞춰야 착지 순간 실제 카드와 픽셀 단위로 겹친다.
  const borderBox = style.boxSizing === 'border-box';
  const width = (borderBox && parseFloat(style.width)) || element.offsetWidth;
  const height = (borderBox && parseFloat(style.height)) || element.offsetHeight;
  const box = element.getBoundingClientRect();
  const m = parseMatrix(style.transform);
  return {
    width,
    height,
    // 아핀 변환된 사각형의 외접 상자 중심 = 변환된 카드 중심
    center: { x: box.left + box.width / 2 - bounds.left, y: box.top + box.height / 2 - bounds.top },
    angle: Math.atan2(m.b, m.a) * 180 / Math.PI,
    scale: Math.hypot(m.a, m.b) || 1,
    origin: parseOrigin(style.transformOrigin, width, height),
    transform: style.transform && style.transform !== 'none' ? style.transform : '',
  };
}

/** transform-origin을 유지한 채 요소 중심이 center에 오도록 하는 transform 문자열. */
export function placement(card, center, angle, scale, flip = 0) {
  const rad = angle * Math.PI / 180;
  const dx = card.width / 2 - card.origin.x;
  const dy = card.height / 2 - card.origin.y;
  // p → O + t + R·s·(p − O) 에서 p = 카드 중심일 때 결과가 center가 되도록 t를 푼다.
  const rx = (Math.cos(rad) * dx - Math.sin(rad) * dy) * scale;
  const ry = (Math.sin(rad) * dx + Math.cos(rad) * dy) * scale;
  const tx = center.x - card.origin.x - rx;
  const ty = center.y - card.origin.y - ry;
  return `translate(${tx.toFixed(2)}px,${ty.toFixed(2)}px) rotate(${angle.toFixed(2)}deg) scale(${scale.toFixed(4)}) ${PERSPECTIVE} rotateY(${flip}deg)`;
}

/** 뽑기 더미 → 손패 자리까지의 호 궤적 키프레임. */
export function flightKeyframes(card, source) {
  const target = card.center;
  const distance = Math.hypot(target.x - source.x, target.y - source.y);
  const lift = Math.max(34, Math.min(120, distance * 0.2));
  const startScale = Math.max(0.12, Math.min(0.5, source.height / card.height));
  const popped = { x: source.x + 4, y: source.y - 16 };
  const mid = {
    x: source.x + (target.x - source.x) * 0.56,
    y: source.y + (target.y - source.y) * 0.56 - lift,
  };
  const endScale = card.scale;
  return [
    { offset: 0, opacity: 0, transform: placement(card, source, source.angle, startScale), easing: 'cubic-bezier(.3,0,.4,1)' },
    { offset: 0.14, opacity: 1, transform: placement(card, popped, source.angle - 9, startScale * 1.22), easing: 'cubic-bezier(.35,.05,.45,1)' },
    { offset: 0.58, opacity: 1, transform: placement(card, mid, (source.angle + card.angle) / 2 + 7, startScale + (endScale - startScale) * 0.82), easing: 'cubic-bezier(.2,.75,.25,1)' },
    { offset: 1, opacity: 1, transform: placement(card, target, card.angle, endScale) },
  ];
}

export function startCardDealScene(parent) {
  let disposed = false;
  const flights = new Set();
  let width = parent.clientWidth, height = parent.clientHeight;
  const finish = () => { for (const flight of [...flights]) flight.finish(); };
  const observer = new ResizeObserver(() => {
    if (Math.abs(parent.clientWidth - width) > .5 || Math.abs(parent.clientHeight - height) > .5) {
      width = parent.clientWidth; height = parent.clientHeight; finish();
    }
  });
  observer.observe(parent);

  const bumpPile = (pile) => {
    if (!pile?.animate) return;
    const base = getComputedStyle(pile).transform;
    const rest = base && base !== 'none' ? base : 'translate(0,0)';
    pile.animate([
      { transform: rest },
      { transform: `${rest} translateY(-3px) scale(1.09)`, offset: .35 },
      { transform: rest },
    ], { duration: PILE_BUMP_MS, easing: 'ease-out' });
  };

  return {
    /**
     * @param {{ cards: { uid: string }[], targets: (Element|null)[], source: Element|null,
     *   reshuffle?: boolean, onLaunch?: (uid: string) => void, onArrive?: (uid: string) => void }} options
     */
    async play({ cards, targets, source, reshuffle = false, onLaunch = () => {}, onArrive = () => {} }) {
      if (disposed) return;
      finish();
      const bounds = parent.getBoundingClientRect();
      const pile = source?.querySelector('.pile-stack') ?? source;
      const pileBox = pile?.getBoundingClientRect();
      const pileMatrix = pile ? parseMatrix(getComputedStyle(pile).transform) : null;
      const pileAngle = pileMatrix ? Math.atan2(pileMatrix.b, pileMatrix.a) * 180 / Math.PI : -6;
      const from = pileBox
        ? { x: pileBox.left + pileBox.width / 2 - bounds.left, y: pileBox.top + pileBox.height / 2 - bounds.top, height: pile.offsetHeight || pileBox.height, angle: pileAngle }
        : { x: 40, y: bounds.height - 40, height: 40, angle: -6 };

      await Promise.all(cards.map((card, index) => new Promise((resolve) => {
        const element = targets[index];
        if (!element || !parent.animate || !element.animate) { onLaunch(card.uid); onArrive(card.uid); resolve(); return; }
        const shape = measureCard(element, bounds);
        const delay = index * STAGGER_MS + (reshuffle ? RESHUFFLE_DELAY_MS : 0);
        const figure = document.createElement('div');
        figure.className = 'flying-card-back';
        figure.setAttribute('aria-hidden', 'true');
        figure.innerHTML = BACK_MARKUP;
        figure.style.width = shape.width + 'px';
        figure.style.height = shape.height + 'px';
        figure.style.transformOrigin = `${shape.origin.x}px ${shape.origin.y}px`;
        figure.style.opacity = '0';
        figure.style.setProperty('--deal-sheen-ms', SHEEN_MS + 'ms');
        parent.append(figure);

        let settled = false, launched = false, arrived = false;
        const animations = [];
        let launchTimer = 0;
        const launch = () => {
          if (launched) return;
          launched = true;
          if (!disposed) { onLaunch(card.uid); bumpPile(pile); }
        };
        const arrive = () => {
          if (arrived) return;
          arrived = true;
          figure.remove();
          if (!disposed) onArrive(card.uid);
        };
        const flight = {
          finish() {
            if (settled) return;
            settled = true;
            clearTimeout(launchTimer);
            for (const animation of animations) animation.cancel();
            figure.remove(); flights.delete(flight);
            launch(); arrive();
            resolve();
          },
        };
        flights.add(flight);
        launchTimer = setTimeout(launch, delay);

        const fly = figure.animate(flightKeyframes(shape, from), { duration: FLIGHT_MS, delay, fill: 'both' });
        animations.push(fly);
        fly.finished.then(() => {
          if (settled) return;
          const flipOut = figure.animate([
            { opacity: 1, transform: placement(shape, shape.center, shape.angle, shape.scale, 0) },
            { opacity: 1, transform: placement(shape, shape.center, shape.angle, shape.scale, 90) },
          ], { duration: FLIP_OUT_MS, easing: 'cubic-bezier(.5,0,.9,.6)', fill: 'forwards' });
          animations.push(flipOut);
          return flipOut.finished;
        }).then(() => {
          if (settled) return;
          arrive();
          // 실제 카드가 같은 자리·각도에서 앞면으로 펼쳐진다(종료 후에는 CSS transform이 그대로 이어받음).
          const base = shape.transform;
          const reveal = element.animate([
            { opacity: 1, transform: `${base} ${PERSPECTIVE} rotateY(-90deg) translateY(0px)`, filter: 'brightness(1.45)' },
            { opacity: 1, transform: `${base} ${PERSPECTIVE} rotateY(8deg) translateY(-6px)`, filter: 'brightness(1.15)', offset: .62 },
            // 마지막 프레임은 opacity·filter를 비워 실제 카드의 CSS 값(사용 불가 흐림 등)으로 자연스럽게 이어지게 한다.
            { transform: `${base} ${PERSPECTIVE} rotateY(0deg) translateY(0px)` },
          ], { duration: FLIP_IN_MS, easing: 'cubic-bezier(.15,.7,.3,1)' });
          animations.push(reveal);
          return reveal.finished;
        }).then(flight.finish, flight.finish);
      })));
    },
    destroy() { disposed = true; finish(); observer.disconnect(); },
  };
}
