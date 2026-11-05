import { useEffect, useRef, useState } from 'react';
import { CAPES, equippedCape, LENS_PRICE, MAX_LENSES } from '../shop.js';
import { ENCOUNTERS } from '../battle.js';
import StoryCharacter from './StoryCharacter.jsx';

export default function ShopDialog({ economy, unlocked, saved, onAction, onClose }) {
  const dialog = useRef(null);
  const [message, setMessage] = useState('');
  const cape = equippedCape(economy);
  useEffect(() => { if (!dialog.current.open) dialog.current.showModal(); }, []);

  function act(action, id, name) {
    const success = onAction(action, id);
    setMessage(success ? action === 'equip' ? `${name}를 장착했어요.` : `${name} 구매 완료!${id === 'lens' ? ' 전투에서 사용할 수 있어요.' : ' 바로 장착했어요.'}` : '지금은 구매하거나 장착할 수 없어요.');
  }

  return <dialog ref={dialog} className="adventure-dialog shop-dialog" aria-labelledby="shop-title" aria-describedby="shop-description" onClose={onClose}>
    <header className="adventure-header"><div><p className="adventure-eyebrow">S’WORD MASTER / ADVENTURER’S SHOP</p><h2 id="shop-title">모험가의 상점</h2><p id="shop-description">{unlocked ? '브론즈를 마친 용사님, 어서 오세요.' : '브론즈의 모험을 마치면 문을 열어요.'}</p></div><button className="settings-close" aria-label="상점 닫기" onClick={() => dialog.current.close()}>×</button></header>
    <div className="adventure-body">
      <div className="shop-balance"><span><span aria-hidden="true">◈</span> 보유 코인</span><strong>{economy.coins.toLocaleString()} <small>COIN</small></strong></div>
      {!unlocked ? <section className="shop-locked"><div className="shop-chest" aria-hidden="true">▣</div><h3>아직 닫혀 있어요</h3><p>브론즈의 모든 전투·퍼즐을 풀고<br />이야기 끝까지 도달하면 해금돼요.</p><ul><li><span>전투·퍼즐 완료</span><strong>{economy.cleared.length} / {ENCOUNTERS.length}</strong></li><li><span>브론즈 이야기</span><strong>{economy.storyComplete ? '감상 완료' : '진행 중'}</strong></li></ul><p className="shop-tip">코인은 해금 전부터 모을 수 있어요.<br />연출만 감상한 구간은 완료에 포함되지 않아요.</p></section>
        : <>
          <section className="shop-tools"><div className="shop-section-heading"><h3>모험 도구</h3><span>CONSUMABLE</span></div><article className="shop-tool"><span className="shop-lens" aria-hidden="true">◉</span><div><h4>집중의 렌즈</h4><p>문제에서 오답 보기 하나를 지워요.<br />한 문제에 한 번 사용해요.</p><small>보유 {economy.lenses} / {MAX_LENSES}개</small></div><button className="shop-buy" disabled={economy.coins < LENS_PRICE || economy.lenses >= MAX_LENSES} onClick={() => act('buy', 'lens', '집중의 렌즈')}>구매 <span>{LENS_PRICE} 코인</span></button></article></section>
          <section><div className="shop-section-heading"><h3>용사의 망토</h3><span>WARDROBE</span></div><p className="shop-tip">구매하면 바로 장착해요. 타이틀과 모험 속 용사에게 적용돼요.</p><div className="shop-capes">{CAPES.map((item) => {
            const owned = economy.owned.includes(item.id);
            const equipped = economy.equipped === item.id;
            return <article className={`shop-cape${equipped ? ' is-equipped' : ''}`} key={item.id} style={{ '--hero-cloak': item.color, '--hero-cloak-shade': item.shade, '--hero-cloak-light': item.light }}><div className="shop-cape-preview"><StoryCharacter character="용사" sheathed /></div><h4>{item.name}</h4><p>{owned ? equipped ? '장착 중' : '보유 중' : `${item.price} 코인`}</p><button className="shop-buy" aria-label={`${item.name} ${equipped ? '장착 중' : owned ? '장착' : '구매'}`} disabled={equipped || (!owned && economy.coins < item.price)} onClick={() => act(owned ? 'equip' : 'buy', item.id, item.name)}>{equipped ? '장착 중 ✓' : owned ? '장착하기' : '구매·장착'}</button></article>;
          })}</div></section>
          <p className="shop-tip">일반 전투 20코인 · 보스 전투 80코인 + 정답당 5코인.<br />재도전도 끝까지 풀면 보상을 받아요. 퍼즐과 연출 감상에는 코인이 지급되지 않아요.</p>
        </>}
      <p className="shop-message" role="status">{message || (unlocked ? `현재 장착: ${cape.name}` : '브론즈 완료 후 이곳에서 구매할 수 있어요.')}</p>
    </div>
    <footer className="adventure-footer"><p role="status">{saved ? '코인과 아이템을 이 브라우저에 저장해요.' : '저장할 수 없어 이번 접속에서만 유지해요.'}</p><button className="return-button" onClick={() => dialog.current.close()}>타이틀로</button></footer>
  </dialog>;
}
