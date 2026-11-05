export const FESTIVAL_PLACES = {
  square: '루미페스타 · 환영 광장', market: '루미페스타 · 달빛 과자 거리', balloons: '루미페스타 · 풍선의 거리',
  crossroads: '루미페스타 · 안내 표지판 갈림길', alley: '루미페스타 · 장난의 골목', service: '루미페스타 · 직원용 뒷길',
  backstage: '루미페스타 · 대본 보관 창고', door: '루미페스타 · 봉인된 소품 문', props: '루미페스타 · 무대 소품실',
  stage: '루미페스타 · 결승 무대', quiet: '루미페스타 · 방송이 끝난 광장', stall: '루미페스타 · 문 닫는 간식 가게',
  records: '루미페스타 · 방송 기록 확인실', school: '루미페스타 · 팔레트 학교로 가는 길',
};

// Cuts are tied to the existing dialogue indices, preserving story saves and
// battle triggers. Each line receives its own resolved composition and cast.
const cut = (from, id, place, title, focus = 'dialogue', state = '') => ({ from, id, place, title, focus, state });
export const FESTIVAL_CUTS = {
  S02: [
    cut(0, 'festival-reveal', 'square', '문 너머 펼쳐진 축제 도시', 'wide'),
    cut(1, 'nia-welcome', 'square', '니아의 환영 방송'),
    cut(5, 'underground-sky', 'square', '지하에 떠 있는 달', 'sky'),
    cut(8, 'flying-camera', 'square', '용사 앞에 날아온 마법 카메라', 'camera'),
    cut(11, 'first-interview', 'square', '예고 없던 첫 인터뷰'),
    cut(16, 'reusable-banner', 'square', '신입 용사 특별 출연 깃발', 'banner'),
    cut(19, 'skeleton-bakery', 'market', '케이크를 파는 해골 상인', 'wide'),
    cut(22, 'demon-rumor', 'market', '축제 뒤에 남은 마왕의 소문'),
    cut(26, 'mask-contest', 'square', '다섯 가면 조각의 도전', 'board'),
    cut(33, 'five-empty-masks', 'square', '첫 번째 가면이 빛나는 안내판', 'board', 'first-mask'),
    cut(35, 'hero-registers', 'square', '용사의 참가 선언'),
    cut(39, 'help-from-street', 'balloons', '거리 뒤편의 구조 요청', 'wide'),
  ],
  S03: [
    cut(0, 'balloon-chase', 'balloons', '왕관 슬라임과 풍선 추격전', 'wide', 'chase'),
    cut(4, 'momo-introduction', 'balloons', '미래의 마왕 모모'),
    cut(11, 'runaway-contract', 'balloons', '왕관을 휘감는 계약 스티커', 'contract', 'contract'),
    cut(16, 'rescue-momo', 'balloons', '모모의 계약을 해독하라', 'wide', 'contract'),
    cut(17, 'balloons-deflate', 'balloons', '취소된 계약과 내려앉는 풍선', 'wide', 'deflated'),
    cut(19, 'behind-the-cape', 'balloons', '망토 뒤에서 나온 모모', 'dialogue', 'rescued'),
    cut(24, 'future-demon-king', 'balloons', '아직 준비 중인 마왕', 'dialogue', 'rescued'),
    cut(28, 'new-companion', 'crossroads', '길잡이가 된 새 동료'),
    cut(32, 'momo-meets-wall', 'alley', '벽부터 점검한 길잡이', 'wide', 'bump'),
  ],
  S04: [
    cut(0, 'spinning-crossroads', 'crossroads', '돌아간 화살표와 배달 수레', 'wide', 'broken'),
    cut(4, 'snack-detour', 'crossroads', '모모가 가리킨 간식 가게'),
    cut(7, 'loose-sign-bolt', 'crossroads', '떨어진 고정쇠와 지워진 안내', 'sign', 'broken'),
    cut(13, 'repair-the-sign', 'crossroads', '길 안내를 제자리로', 'wide', 'broken'),
    cut(14, 'route-restored', 'crossroads', '무대를 가리키는 화살표', 'wide', 'restored'),
    cut(15, 'toward-the-alley', 'crossroads', '장난의 골목으로'),
    cut(19, 'puppet-alert', 'alley', '사진 인형의 붉어진 눈', 'wide', 'hostile'),
    cut(24, 'evacuate-residents', 'alley', '주민들의 피할 길을 만드는 모모', 'wide', 'evacuating'),
    cut(27, 'puppet-blockade', 'alley', '좁은 길을 막은 그림 인형', 'wide', 'hostile'),
    cut(28, 'puppet-restored', 'alley', '제 빛을 되찾은 그림 인형', 'dialogue', 'restored'),
    cut(35, 'nia-to-the-stage', 'service', '직원용 안내선을 따라', 'wide', 'nia-leaving'),
    cut(38, 'backstage-route', 'service', '용사와 모모의 무대 뒷길', 'wide'),
  ],
  S05: [
    cut(0, 'backstage-storage', 'backstage', '음악 뒤편의 조용한 창고', 'wide'),
    cut(3, 'broken-guide-line', 'backstage', '갑자기 끊긴 안내선', 'floor'),
    cut(5, 'unexpected-script', 'backstage', '오늘의 신입 용사', 'letter'),
    cut(11, 'script-date', 'backstage', '용사가 오기 전 적힌 날짜', 'date'),
    cut(12, 'erased-performer', 'backstage', '흐려진 출연자의 이름', 'performer'),
    cut(16, 'torn-school-stamp', 'backstage', '종이 뒤편의 찢어진 학교 도장', 'stamp'),
    cut(19, 'sealed-prop-door', 'door', '반대 명령에 잠긴 소품 문', 'wide', 'sealed'),
    cut(23, 'door-unsealed', 'door', '열린 문과 남은 의문', 'dialogue', 'open'),
    cut(26, 'runaway-props', 'props', '서로 반대로 움직이는 무대 소품', 'wide', 'runaway'),
    cut(28, 'nia-returns', 'props', '소품실로 달려온 니아', 'wide', 'arrival'),
    cut(30, 'script-confrontation', 'props', '니아도 모르는 대본'),
  ],
  S06: [
    cut(0, 'final-stage', 'stage', '오늘의 신입 용사 특별 결승', 'wide', 'show'),
    cut(3, 'moving-billboards', 'stage', '움직이기 시작한 광고 간판', 'wide', 'assembling'),
    cut(4, 'advert-monster', 'stage', '간판이 합쳐 만든 광고 괴물', 'wide', 'boss'),
    cut(5, 'sensational-news', 'stage', '근거 없는 속보와 과장 광고', 'dialogue', 'boss'),
    cut(11, 'false-doubles', 'stage', '거짓 명령으로 만든 분신', 'wide', 'doubles'),
    cut(13, 'advert-card-storm', 'stage', '용사를 에워싼 광고 카드', 'wide', 'cards'),
    cut(17, 'first-panel-break', 'stage', '첫 장식이 떨어진 광고판', 'wide', 'damaged'),
    cut(20, 'camera-trick', 'stage', '카메라가 보여 주는 다른 이야기', 'camera', 'damaged'),
    cut(24, 'masked-attack', 'stage', '웃는 가면 뒤의 진짜 공격', 'wide', 'masked'),
    cut(25, 'momo-rescues-hero', 'stage', '망토를 잡아당긴 모모', 'wide', 'dodge'),
    cut(29, 'saved-by-momo', 'stage', '서로의 등을 지키는 두 동료', 'dialogue', 'damaged'),
    cut(31, 'false-warnings', 'stage', '뜻이 뒤집힌 마지막 경고', 'wide', 'warnings'),
    cut(35, 'last-broadcast', 'stage', '갈라진 가면과 마지막 방어막', 'wide', 'cracked'),
    cut(36, 'school-flash', 'stage', '꺼지는 화면에 스친 학교 표식', 'wide', 'shattered'),
    cut(37, 'broadcast-ends', 'stage', '광고 괴물의 마지막 방송', 'wide', 'fallen'),
    cut(41, 'paper-actor-exit', 'stage', '공연을 마친 종이 배우', 'wide', 'paper'),
  ],
  S07: [
    cut(0, 'victory-confetti', 'stage', '금빛 종이 아래 내려온 선물', 'wide', 'celebration'),
    cut(3, 'first-victory-talk', 'stage', '처음으로 모험 같았던 순간', 'dialogue', 'celebration'),
    cut(10, 'first-mask-award', 'stage', '첫 번째 은빛 가면 조각', 'mask', 'award'),
    cut(12, 'five-piece-promise', 'stage', '다섯 조각 너머의 약속', 'dialogue', 'award'),
    cut(18, 'last-greeting', 'stage', '방송이 끝나면 대조할 기록', 'dialogue', 'award'),
    cut(23, 'red-light-off', 'quiet', '방송 장치의 붉은 불이 꺼지다', 'wide', 'closing'),
    cut(25, 'after-the-show', 'quiet', '축제 뒤의 작은 농담'),
  ],
  S08: [
    cut(0, 'empty-festival', 'quiet', '간판을 접는 한산한 광장', 'wide', 'closing'),
    cut(1, 'resident-forgot', 'quiet', '경기를 기억하지 못하는 주민'),
    cut(10, 'vendor-forgot', 'stall', '시상식을 기억하지 못하는 상인'),
    cut(13, 'shared-memory', 'quiet', '용사와 모모에게만 남은 기억'),
    cut(16, 'nia-brings-records', 'records', '방송 장비를 챙기던 니아', 'wide'),
    cut(21, 'open-original-record', 'records', '원본 기록을 켜다', 'recording', 'original'),
    cut(25, 'unknown-student', 'records', '용사 대신 서 있는 낯선 학생', 'recording', 'altered'),
    cut(30, 'all-records-changed', 'records', '보관된 기록까지 바뀌었다', 'recording', 'copies'),
    cut(33, 'mask-still-remains', 'records', '아직 남아 있는 승리의 증거', 'mask', 'proof'),
    cut(36, 'record-corner-mark', 'records', '영상 구석의 낯선 표식', 'recording', 'mark'),
    cut(37, 'matching-school-stamp', 'records', '대본과 영상에 겹치는 도장', 'stamp', 'matched'),
    cut(40, 'palette-school-clue', 'records', '기록을 복원하는 팔레트 마법학교', 'school'),
    cut(46, 'keep-the-record-safe', 'records', '함부로 보여 줄 수 없는 기록'),
    cut(52, 'next-destination-school', 'school', '지워진 오늘을 찾아, 팔레트 마법학교', 'wide'),
  ],
};

export function festivalVisual(sceneId, lineIndex, speaker) {
  const shot = FESTIVAL_CUTS[sceneId]?.findLast(({ from }) => from <= lineIndex);
  if (!shot) return null;
  const cast = sceneId === 'S02' ? ['용사', '니아']
    : (sceneId === 'S04' && lineIndex >= 38) || (sceneId === 'S05' && lineIndex < 28) || (sceneId === 'S08' && lineIndex < 16)
      ? ['용사', '모모'] : ['용사', '니아', '모모'];
  const focus = shot.focus === 'dialogue' ? ['용사', '니아', '모모', '광고 괴물', '골목 몬스터', '풍선 몬스터', '주민', '상인'].includes(speaker) ? speaker : 'wide' : shot.focus;
  return { ...shot, focus, cast, location: FESTIVAL_PLACES[shot.place] };
}
