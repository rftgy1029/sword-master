export default function SpireMap({ run, onSelectNode }) {
  const currentFloor = run.floor;

  const nodeIcons = {
    battle: '⚔️',
    elite: '💀',
    rest: '⛺',
    shop: '💰',
    event: '❓',
    boss: '👑',
  };

  return (
    <div className="spire-map-view">
      <div className="spire-map-title">
        <h2>브론즈 첨탑 (Bronze Spire)</h2>
        <p style={{ margin: 0, color: '#a7b0a6', fontSize: 14 }}>
          갈림길을 선택하여 정상의 고대 골렘을 쓰러뜨리세요. (현재 {currentFloor}층)
        </p>
      </div>

      <div className="spire-map-floors">
        {run.map.map((floorData) => {
          const isCurrentFloor = floorData.floor === currentFloor;
          const isPastFloor = floorData.floor < currentFloor;

          return (
            <div
              key={floorData.floor}
              className={`spire-map-floor-row${isCurrentFloor ? ' active-row' : ''}`}
            >
              <span className="spire-map-floor-label">{floorData.floor}F</span>

              {floorData.nodes.map((node) => {
                const isCleared = run.clearedNodeIds.includes(node.id);
                const isClickable = isCurrentFloor && !isCleared;

                return (
                  <button
                    key={node.id}
                    className={`spire-map-node-btn${isClickable ? ' clickable' : isCleared ? ' cleared' : ' locked'}`}
                    disabled={!isClickable}
                    onClick={() => onSelectNode(node)}
                  >
                    <span style={{ fontSize: 24 }}>{nodeIcons[node.type] || '✦'}</span>
                    <span style={{ fontSize: 13, fontWeight: 'bold' }}>{node.name}</span>
                    <span style={{ fontSize: 11, color: '#889894' }}>
                      {node.type === 'battle'
                        ? '일반 전투'
                        : node.type === 'elite'
                        ? '엘리트 강적'
                        : node.type === 'boss'
                        ? '보스 결전'
                        : node.type === 'rest'
                        ? '모닥불'
                        : node.type === 'shop'
                        ? '상점'
                        : '미지의 방'}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
