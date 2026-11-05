import TitleScene from './TitleScene.jsx';
import DungeonCorridor from './DungeonCorridor.jsx';
import FestivalArt from './FestivalArt.jsx';
import { festivalVisual } from '../festivalDirection.js';

export { default as StoryCharacter } from './StoryCharacter.jsx';

export default function StoryArt({ background, motionPreference, cue = 'idle', paused, ...props }) {
  if (background === 'entrance') return <div className={`story-art story-art-entrance cue-${cue}`} data-paused={paused}>
    <TitleScene motionPreference={paused ? 'off' : motionPreference} storyAction={cue} />
    <div className="entrance-mist" /><span className="entrance-dust" />
  </div>;
  if (background === 'corridor') return <DungeonCorridor {...props} cue={cue} paused={paused} />;
  const visual = props.visual ?? festivalVisual(props.sceneId, props.lineIndex ?? 0, props.speaker);
  return visual ? <FestivalArt {...props} visual={visual} cue={cue} paused={paused} /> : null;
}
