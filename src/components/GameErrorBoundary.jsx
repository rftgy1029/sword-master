import { Component } from 'react';

export default class GameErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="game-recovery" role="alert">
      <p className="game-recovery-brand">S’WORD MASTER</p>
      <h1>화면을 다시 불러와 주세요</h1>
      <p>게임 화면을 표시하는 중 문제가 생겼습니다.<br />저장된 기록을 지우지 않고 다시 시도할 수 있습니다.</p>
      <button onClick={() => window.location.reload()}>화면 다시 열기 <span aria-hidden="true">↻</span></button>
    </main>;
  }
}
