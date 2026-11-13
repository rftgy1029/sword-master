import { Euler, MathUtils, Quaternion, Vector3 } from 'three';

const { degToRad } = MathUtils;
const UP = new Vector3(0, 1, 0);
const FORWARD = new Vector3(1, 0, 0);

export function createKnightRig(model) {
  const joints = Object.fromEntries(['torso', 'head', 'arm_left', 'arm_right', 'leg_left', 'leg_right', 'weapon', 'weapon_tip']
    .map((name) => [name, model.getObjectByName(name)]));
  if (Object.values(joints).some((joint) => !joint)) return null;

  const rest = new Map(Object.values(joints).map((joint) => [joint, joint.quaternion.clone()]));
  const directions = new Map([
    [joints.arm_right, joints.weapon.position.clone().normalize()],
    [joints.arm_left, joints.weapon.position.clone().multiply(new Vector3(-1, 1, 1)).normalize()],
    [joints.leg_left, new Vector3(0, -1, 0)],
    [joints.leg_right, new Vector3(0, -1, 0)],
    [joints.weapon, joints.weapon_tip.position.clone().normalize()],
  ]);
  const euler = new Euler(0, 0, 0, 'YXZ');
  const rotation = new Quaternion();
  const parentRotation = new Quaternion();
  const from = new Vector3();
  const direction = new Vector3();
  const origin = new Vector3();
  const grip = new Vector3();
  const side = new Vector3();

  function rotate(joint, pitch, yaw, roll = 0) {
    euler.set(degToRad(pitch), degToRad(yaw), degToRad(roll));
    joint.quaternion.copy(rest.get(joint)).multiply(rotation.setFromEuler(euler));
  }

  function aim(joint, worldDirection) {
    joint.parent.getWorldQuaternion(parentRotation).invert();
    direction.copy(worldDirection).normalize().applyQuaternion(parentRotation);
    from.copy(directions.get(joint)).applyQuaternion(rest.get(joint));
    rotation.setFromUnitVectors(from, direction);
    joint.quaternion.copy(rest.get(joint)).premultiply(rotation);
  }

  function aimArm(joint, swing, spread, yaw, sideSign) {
    const pitch = degToRad(swing), opening = degToRad(spread);
    const heading = degToRad(yaw);
    direction.set(Math.sin(pitch) * Math.cos(opening), -Math.cos(pitch) * Math.cos(opening), Math.sin(opening) * sideSign);
    direction.applyAxisAngle(UP, -heading);
    aim(joint, direction);
  }

  function plantFoot(joint, pose, foot, sideSign) {
    const heading = degToRad(pose.yaw);
    side.set(-Math.sin(heading) * sideSign * .205, 0, Math.cos(heading) * sideSign * .205);
    joint.getWorldPosition(origin);
    const x = MathUtils.lerp(pose[`${foot}X`], pose.x + pose[`${foot}Dx`], pose[`${foot}Rel`]);
    direction.set(x, pose[`${foot}Lift`], pose.z).add(side).sub(origin);
    aim(joint, direction);
  }

  return {
    apply(pose) {
      rotate(joints.torso, pose.torsoPitch, pose.torsoYaw, pose.torsoRoll);
      rotate(joints.head, pose.headPitch, pose.headYaw);
      aimArm(joints.arm_right, pose.armRSwing, pose.armRSpread, pose.yaw + pose.torsoYaw, 1);
      aimArm(joints.arm_left, pose.armLSwing, pose.armLSpread, pose.yaw + pose.torsoYaw, -1);
      const blade = degToRad(pose.blade);
      direction.set(Math.cos(blade), Math.sin(blade), 0)
        .applyAxisAngle(FORWARD, degToRad(pose.bladeTilt)).applyAxisAngle(UP, degToRad(pose.bladeTurn));
      aim(joints.weapon, direction);
      if (pose.grip > 0) {
        joints.weapon.getWorldPosition(grip);
        joints.arm_left.getWorldPosition(origin);
        grip.sub(origin);
        const pitch = degToRad(pose.armLSwing), heading = degToRad(pose.yaw + pose.torsoYaw);
        direction.set(Math.sin(pitch) * Math.cos(heading), -Math.cos(pitch), Math.sin(pitch) * Math.sin(heading))
          .lerp(grip.normalize(), pose.grip);
        aim(joints.arm_left, direction);
      }
      plantFoot(joints.leg_left, pose, 'footL', -1);
      plantFoot(joints.leg_right, pose, 'footR', 1);
    },
  };
}
