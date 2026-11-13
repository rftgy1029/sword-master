// public/ 폴더 파일(3D 모델·효과 이미지·PDF 글꼴)의 주소.
// 한 파일짜리 HTML(npm run build:single)은 이 파일들을 data URL 표로 함께 넣어 두므로 그 표를 먼저 본다.
export function publicAsset(path) {
  return globalThis.__SWORD_MASTER_ASSETS__?.[path] ?? `${import.meta.env?.BASE_URL ?? '/'}${path}`;
}
