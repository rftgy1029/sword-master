import SceneView from './SceneView.jsx';
import LegacyTitleScene from './LegacyTitleScene.jsx';

// heroAction: 메뉴를 고르는 동안 기사가 보이는 반응(용사 모델의 동작 이름)
export default function TitleScene({ motionPreference='normal', active=true, heroAction='idle' }) {
  return <div className="scene"><SceneView mode="title" active={active} motionPreference={motionPreference} heroAction={heroAction} fallback={<LegacyTitleScene motionPreference={motionPreference}/>} /></div>;
}
