import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { BATTLE_FOG, cameraPosition, fogNear } from './battleCamera.js';
import { approachPose, copyPose, createCameraPose, directCamera } from './cameraDirector.js';

/** 목표 구도로 다가가는 빠르기(1/초). 클수록 빨리 따라간다. */
const FOLLOW = 14;
const FOG_DEPTH = BATTLE_FOG[1] - BATTLE_FOG[0];

/**
 * 전투 카메라를 매 프레임 움직인다. 목표 구도는 cameraDirector가 연출 시간표로 정하고,
 * 여기서는 부드럽게 따라가 카메라·안개에 적용한다. 타격 흔들림(ImpactEffects)은 이 위치를 기준으로 더해진다.
 * 연출 진행(-2) 뒤, 흔들림·머리 위 표시(0) 앞에서 실행한다.
 */
export default function BattleCamera({ director, view, studying = false, danger = false, reduced = false, snapStudy = false }) {
  const { camera, scene } = useThree();
  const goal = useRef(createCameraPose());
  const now = useRef(null);
  const position = useRef([0, 0, 0]);
  const lastAspect = useRef(0);
  useFrame((state, delta) => {
    if (camera.userData.free) return; // 미리보기의 '카메라 회전'으로 직접 돌린 뒤에는 건드리지 않는다
    const aspect = state.size.width / Math.max(1, state.size.height);
    const current = director.active;
    directCamera({ aspect, view, plan: current?.plan, elapsed: current?.elapsed ?? 0, studying, reduced, danger, time: state.clock.elapsedTime }, goal.current);
    // 처음·화면 크기 변경·움직임 줄이기·검사용 수동 진행·오래 멈췄던 프레임·정지 퀴즈 모드에서는 따라가지 않고 바로 맞춘다.
    const snap = !now.current || reduced || (snapStudy && studying && !current) || current?.manual || aspect !== lastAspect.current || !(delta > 0 && delta < .25);
    lastAspect.current = aspect;
    if (!now.current) now.current = createCameraPose();
    if (snap) copyPose(now.current, goal.current);
    else approachPose(now.current, goal.current, 1 - Math.exp(-FOLLOW * delta));

    const pose = now.current, at = cameraPosition(pose, position.current);
    camera.position.set(at[0], at[1], at[2]);
    camera.lookAt(pose.target[0], pose.target[1], pose.target[2]);
    if (camera.fov !== pose.fov) { camera.fov = pose.fov; camera.updateProjectionMatrix(); }
    if (camera.userData.base) camera.userData.base.copy(camera.position);
    else camera.userData.base = camera.position.clone();
    camera.userData.baseFov = pose.fov;
    if (scene.fog) { scene.fog.near = fogNear(pose.distance); scene.fog.far = scene.fog.near + FOG_DEPTH; }
  }, -1);
  return null;
}
