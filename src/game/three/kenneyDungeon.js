// Kenney 'Mini Dungeon'(CC0) 부품으로 던전 장면을 배치한다.
// 부품 파일은 scripts/build_kenney_dungeon.py가 public/models/dungeon-kit.glb 하나로 묶는다.

/** Kenney 부품 1칸(1 단위)을 장면에서 몇 단위로 키울지. 팩의 캐릭터(약 0.78)를 키 2.0 용사에 맞춘 비율이다. */
export const KIT_SCALE = 2.5;
/** 바닥과 벽의 한 칸 크기 */
export const TILE = KIT_SCALE;
/** 뒷벽 앞면의 위치. 횃불·깃발·책장은 이 면에 붙인다. */
export const WALL_FRONT = -2.5;
/** 하나의 메시가 아니라 여러 조각(상자 뚜껑, 창살 문 등)으로 이루어져 복제해서 그리는 부품 */
export const COMPOSITE_PIECES = Object.freeze(['chest', 'gate', 'trap']);

/**
 * Kenney 색상표에 곱하는 색. 원래 색 그대로는 이 장면의 조명에서 돌이 거의 흰색으로 날아가서
 * 밝기를 낮춘다. 노을빛(주황)과 보랏빛 하늘 조명을 받아 돌이 연보라·주황으로 물든다.
 */
export const KIT_TINT = '#9b95a6';

export const dungeonKitUrl = () => `${import.meta.env?.BASE_URL ?? '/'}models/dungeon-kit.glb`;

// 같은 장면에서는 항상 같은 모양이 나오도록 위치에서 0~1 사이 값을 만든다.
const hash = (x, z) => {
  const value = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return value - Math.floor(value);
};

const place = (piece, x, z, { y = 0, rotate = 0, scale = 1 } = {}) => ({ piece, position: [x, y, z], rotate, scale });

/**
 * 장면 종류에 맞는 부품 배치 목록. 각 항목은 { piece, position, rotate(Y축 라디안), scale(KIT_SCALE에 곱함) }.
 * @param {'hall'|'library'|'forge'} variant 전투 장소(몬스터에 따라 정해진다)
 * @param {string} mode 장면(battle·title·entry·reward·rest·forge·result)
 */
export function dungeonLayout(variant = 'hall', mode = 'battle') {
  const items = [];
  const columns = 11;
  // 바닥: 가운데 줄(용사와 적이 서는 곳)은 평평한 바닥, 앞뒤 가장자리에만 돌 장식 바닥을 섞는다.
  for (let col = 0; col < columns; col += 1) {
    const x = (col - (columns - 1) / 2) * TILE;
    for (const z of [-1.25, 1.25, 3.75, 6.25]) {
      const edge = z < 0 || z > 4;
      items.push(place(edge && Math.abs(x) > 3 && hash(x, z) > .55 ? 'floor-detail' : 'floor', x, z, { rotate: Math.floor(hash(z, x) * 4) * Math.PI / 2 }));
    }
    // 뒷벽은 한 줄만 둔다. 가운데 칸은 출입구, 몇 칸마다 장식이 있는 좁은 벽을 섞어 반복이 덜 보이게 한다.
    // (벽 위로 한 줄을 더 쌓으면 앞 벽과 떨어져 떠 보여서, 벽 위는 어두운 배경으로 남긴다.)
    const wall = x === 0 ? 'wall-opening' : Math.abs(col - 5) % 3 === 2 ? 'wall-narrow' : 'wall';
    items.push(place(wall, x, WALL_FRONT - TILE / 2));
  }

  const columnsAt = variant === 'library' ? [-10, 10] : [-5, 5, -10, 10];
  for (const x of columnsAt) items.push(place('column', x, WALL_FRONT + .55));

  if (variant !== 'library') for (const x of [-7.5, 7.5]) items.push(place('banner', x, WALL_FRONT + TILE / 2));

  if (variant === 'hall') {
    items.push(place('barrel', -8.6, -1.55), place('barrel', -7.75, -1.95, { rotate: .6 }), place('barrel', -8.25, -.95, { scale: .85 }));
    items.push(place('pot', 8.1, -1.8, { rotate: .4 }), place('pot', 8.8, -1.3, { scale: .8 }));
    items.push(place('rocks', 10.6, -1.3, { scale: .9 }), place('stones', -11.2, .6, { rotate: 1.2 }));
  } else if (variant === 'library') {
    items.push(place('table', -7.6, -1.55), place('chair', -7.6, -.55, { rotate: Math.PI }));
    items.push(place('potion', -7.95, -1.55, { y: .78, scale: .7 }), place('potion', -7.25, -1.7, { y: .78, scale: .55 }));
    items.push(place('table', 7.6, -1.55, { rotate: .1 }), place('pot', 7.3, -1.55, { y: .78, scale: .55 }));
    items.push(place('pot', 9.2, -1.7, { scale: .8 }), place('stones', 11, .5));
  } else {
    items.push(place('wood-structure', -7.8, -1.35), place('barrel', -10, -1.6), place('barrel', -9.2, -1.95, { scale: .85 }));
    items.push(place('wood-support', 7.8, -1.9), place('stones', 9.6, -1.3, { rotate: .5 }), place('rocks', -11.3, .4));
    items.push(place('weapon-spear', 6.4, -2.15, { rotate: .3 }), place('shield-round', 6.9, -2.2, { y: .5, scale: .9 }));
  }

  if (mode === 'title') items.push(place('gate', 0, WALL_FRONT - TILE / 2));
  if (mode === 'reward') {
    items.push(place('chest', 1.2, 0, { rotate: -.35 }));
    items.push(place('coin', .25, .55, { scale: .45, rotate: .8 }), place('coin', .55, .95, { scale: .4, rotate: -.4 }), place('key', 2.05, .7, { scale: .55, rotate: 1.1 }));
  }
  return items;
}

/** 배치 목록을 부품별로 묶는다. 인스턴스로 그릴 때 한 부품당 한 번만 그린다. */
export function groupByPiece(items) {
  const groups = new Map();
  for (const item of items) {
    if (!groups.has(item.piece)) groups.set(item.piece, []);
    groups.get(item.piece).push(item);
  }
  return groups;
}
