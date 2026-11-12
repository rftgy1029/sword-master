import SceneView from './SceneView.jsx';
import LegacyTitleScene from './LegacyTitleScene.jsx';

export default function TitleScene({ motionPreference='normal', active=true }) {
  return <div className="scene"><SceneView mode="title" active={active} motionPreference={motionPreference} fallback={<LegacyTitleScene motionPreference={motionPreference}/>} /></div>;
}
