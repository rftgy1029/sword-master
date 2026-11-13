"""Kenney 'Mini Characters'(CC0) 캐릭터를 S’word Master 용사 모델로 변환한다. Blender 4.3+:
blender --background --factory-startup --python scripts/import_kenney_hero.py -- [캐릭터 이름] [키]
  예) ... -- knight        (기본값, assets/kenney/mini-characters/character-knight.glb)
      ... -- raider 1.8    (같은 폴더에 character-raider.glb를 넣어 둔 경우)

하는 일
- 캐릭터의 오른손에 같은 팩의 검을 쥐여 주고, 게임이 쓰는 키(발바닥 Y=0)에 맞춘다.
- 팩의 동작 32개 중 게임이 재생하는 7개만 남기고 게임의 이름으로 바꾼다.
- 뼈 이름을 게임·검사가 찾는 이름(arm_right 등)으로 바꾼다.
- 검을 팔과 따로 움직일 수 있게 손목 관절(weapon)과 칼끝 표시 관절(weapon_tip)을 추가한다.
  전투 장면은 이 관절로 베기 궤적을 직접 만들고, 칼끝 위치를 읽어 검 잔상을 그린다.
- public/models/hero.glb, assets/models/hero.blend를 만들고 manifest.json의 hero 항목을 갱신한다.
"""
import bpy
import json
import math
import struct
import sys
from pathlib import Path
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/kenney/mini-characters'
OUT = ROOT / 'public/models'
BLEND_OUT = ROOT / 'assets/models'
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
CHARACTER = args[0] if args else 'knight'
HEIGHT = float(args[1]) if len(args) > 1 else 2.0

# Kenney 동작 이름 -> 게임이 재생하는 이름. 이 다섯 개는 그대로 쓴다.
CLIPS = {
    'idle': 'idle',
    'walk': 'walk',
    'fall': 'hit',
    'die': 'death',
    'holding-both': 'guard',
}
# 팩의 근접 공격은 주먹을 휘두르는 동작이다. 검을 쥐면 칼날이 뒤로 넘어갔다가 머리 위를 지나
# 앞으로 떨어지므로, 칼날이 앞을 향하는 시점(원본의 85%)을 게임의 타격 시점(동작의 50%)에 맞춰 다시 굽는다.
ATTACK_SOURCE = 'attack-melee-right'
ATTACK_CONTACT = .85
ATTACK_FRAMES = 24
CHOP = math.radians(60)  # 타격 순간에 팔을 더 숙여 칼날이 수평 아래로 떨어지게 한다
BONES = {'arm-right': 'arm_right', 'arm-left': 'arm_left', 'leg-left': 'leg_left', 'leg-right': 'leg_right'}
# 대기 자세에서 칼날은 앞을 향하고 이만큼 위로 들린다. Blender 좌표: -Y가 캐릭터의 앞, +Z가 위.
READY = math.radians(45)
# 대기 자세의 오른팔은 T자 기본 자세에서 앞뒤 축으로 45도 내려와 있다. 그 회전을 되돌려
# 기본 자세 기준의 칼날 방향을 구한다(검은 기본 자세에서 손에 붙인다).
BLADE = Vector((math.sin(READY) * math.sin(math.pi / 4), -math.cos(READY), math.sin(READY) * math.cos(math.pi / 4)))
# 게임은 공격이 아닌 카드(회복·집중 등)와 승리 화면에 victory를 쓴다.
# 대기 자세에서 오른팔만 뒤로 젖혀 검을 똑바로 세운 자세를 만든다.
SALUTE = -READY
GRIP = .05  # 검 원점(가드)에서 손잡이 가운데까지의 거리

bpy.context.preferences.filepaths.save_version = 0
bpy.context.scene.render.fps = 30  # Kenney 동작은 초당 30프레임이다
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()


def import_glb(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    return set(bpy.data.objects) - before


created = import_glb(SOURCE / f'character-{CHARACTER}.glb')
armature = next(obj for obj in created if obj.type == 'ARMATURE')
for obj in created:  # 가져오기 도구가 만든 뼈 표시용 도형
    if obj.type == 'MESH' and obj.parent is None:
        bpy.data.objects.remove(obj)
armature.name = 'hero'
for old, new in BONES.items():
    armature.data.bones[old].name = new

# 검은 팔을 움직이기 전의 기본 자세에서 손 위치에 맞춘다.
armature.data.pose_position = 'REST'
bpy.context.view_layer.update()
body = next(obj for obj in armature.children if obj.type == 'MESH' and 'arm_right' in obj.vertex_groups)
group = body.vertex_groups['arm_right'].index
arm_points = [body.matrix_world @ v.co for v in body.data.vertices if any(g.group == group and g.weight > .5 for g in v.groups)]
reach = min(point.x for point in arm_points)
hand_points = [point for point in arm_points if point.x < reach + .08]
hand = sum(hand_points, Vector()) / len(hand_points)

created = import_glb(SOURCE / 'weapon-sword.glb')
sword = next(obj for obj in created if obj.type == 'MESH')
for obj in created:
    if obj is not sword:
        bpy.data.objects.remove(obj)
aim = Vector((0, 0, 1)).rotation_difference(BLADE)
sword.rotation_mode = 'QUATERNION'
sword.rotation_quaternion = aim
sword.location = hand + aim @ Vector((0, 0, GRIP))
bpy.context.view_layer.update()
blade_length = GRIP + max(vertex.co.z for vertex in sword.data.vertices)  # 손에서 칼끝까지

# 손목 관절: 손 위치에서 시작해 칼날 방향(+Y)으로 뻗는다. 관절의 X축은 칼날의 폭, Z축은 칼날의 넓은 면이다.
# 기존 동작에는 이 관절의 키가 없어 팔과 함께 그대로 움직이므로 대기·이동·방어 등은 전과 같아 보인다.
bpy.ops.object.select_all(action='DESELECT')
armature.select_set(True)
bpy.context.view_layer.objects.active = armature
bpy.ops.object.mode_set(mode='EDIT')
edit_bones = armature.data.edit_bones
flat = aim @ Vector((0, -1, 0))
wrist = edit_bones.new('weapon')
wrist.head = hand
wrist.tail = hand + BLADE * blade_length
wrist.align_roll(flat)
wrist.parent = edit_bones['arm_right']
wrist.use_connect = False
tip = edit_bones.new('weapon_tip')
tip.head = hand + BLADE * blade_length
tip.tail = hand + BLADE * (blade_length + .05)
tip.align_roll(flat)
tip.parent = wrist
tip.use_connect = False
tip.use_deform = False
bpy.ops.object.mode_set(mode='OBJECT')

# 검을 손목 관절에만 묶인 스킨 메시로 몸에 합친다. 별도 물체로 뼈에 붙이면 내보낼 때의 포즈에 따라
# 위치가 틀어질 수 있지만, 스킨 메시는 어떤 동작에서도 손을 그대로 따라간다.
sword.data.materials.clear()
sword.data.materials.append(body.data.materials[0])
sword.vertex_groups.new(name='weapon').add(range(len(sword.data.vertices)), 1, 'REPLACE')
bpy.ops.object.select_all(action='DESELECT')
sword.select_set(True)
body.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.ops.object.join()
armature.data.pose_position = 'POSE'

animation = armature.animation_data
bones = armature.pose.bones


def use_action(action):
    animation.action = action
    if action and getattr(action, 'slots', None):  # Blender 4.4+
        animation.action_slot = action.slots[0]


def sample(action, fraction):
    """동작의 한 시점에서 모든 뼈의 위치·회전·크기를 읽는다."""
    use_action(action)
    start, end = action.frame_range
    frame = start + (end - start) * fraction
    bpy.context.scene.frame_set(math.floor(frame), subframe=frame - math.floor(frame))
    return {bone.name: (bone.location.copy(), bone.rotation_quaternion.copy(), bone.scale.copy()) for bone in bones}


def bake(name, poses, arm_pitch=None):
    """읽어 둔 자세들을 한 프레임씩 새 동작으로 굽고 NLA 트랙에 올린다.
    arm_pitch(프레임 번호)가 있으면 그 각도만큼 오른팔을 어깨를 축으로 앞으로 더 숙인다."""
    action = bpy.data.actions.new(name)
    animation.action = action
    previous = {}
    for index, pose in enumerate(poses):
        if arm_pitch and arm_pitch(index):
            for bone in bones:
                bone.location, bone.rotation_quaternion, bone.scale = pose[bone.name]
            bpy.context.view_layer.update()
            arm = bones['arm_right']
            shoulder = Matrix.Translation(arm.matrix.translation)
            arm.matrix = shoulder @ Matrix.Rotation(arm_pitch(index), 4, 'X') @ shoulder.inverted() @ arm.matrix
            bpy.context.view_layer.update()
            pose = {**pose, 'arm_right': (arm.location.copy(), arm.rotation_quaternion.copy(), arm.scale.copy())}
        for bone in bones:
            location, rotation, scale = pose[bone.name]
            if bone.name in previous and rotation.dot(previous[bone.name]) < 0:
                rotation = -rotation  # 같은 회전의 반대 부호: 보간이 반대로 돌지 않게 맞춘다
            previous[bone.name] = rotation
            bone.location, bone.rotation_quaternion, bone.scale = location, rotation, scale
            for path in ('location', 'rotation_quaternion', 'scale'):
                bone.keyframe_insert(path, frame=index + 1)
    animation.action = None
    track = animation.nla_tracks.new()
    track.name = name
    track.strips.new(name, 1, action).name = name


def attack_source_time(game_time):
    if game_time <= .5:
        return game_time / .5 * ATTACK_CONTACT
    return ATTACK_CONTACT + (game_time - .5) / .5 * (1 - ATTACK_CONTACT)


def smooth(edge0, edge1, value):
    t = min(1, max(0, (value - edge0) / (edge1 - edge0)))
    return t * t * (3 - 2 * t)


def chop(index):
    """휘두르는 동안 커졌다가 타격(50%) 뒤에 대기 자세로 돌아가는 추가 숙임 각도."""
    game_time = index / (ATTACK_FRAMES - 1)
    return CHOP * smooth(.32, .5, game_time) * (1 - smooth(.62, .92, game_time))


animation.use_nla = False
source = bpy.data.actions[ATTACK_SOURCE]
attack_poses = [sample(source, attack_source_time(index / (ATTACK_FRAMES - 1))) for index in range(ATTACK_FRAMES)]
salute = sample(bpy.data.actions['idle'], 0)
for track in list(animation.nla_tracks):
    if track.name in CLIPS:
        track.name = CLIPS[track.name]
        for strip in track.strips:
            strip.name = track.name
            strip.action.name = track.name
    else:
        animation.nla_tracks.remove(track)
bake('attack', attack_poses, chop)
bake('victory', [salute, salute], lambda index: SALUTE)
for bone in bones:
    bone.location, bone.rotation_quaternion, bone.scale = (0, 0, 0), (1, 0, 0, 0), (1, 1, 1)
animation.use_nla = True
bpy.context.scene.frame_set(1)
required = {*CLIPS.values(), 'attack', 'victory'}
missing = required - {track.name for track in animation.nla_tracks}
if missing:
    raise SystemExit(f'Kenney 모델에 필요한 동작이 없습니다: {sorted(missing)}')

bpy.context.view_layer.update()
top = max((obj.matrix_world @ Vector(corner)).z for obj in armature.children if 'head' in obj.vertex_groups for corner in obj.bound_box)
armature.scale = (HEIGHT / top,) * 3

BLEND_OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_OUT / 'hero.blend'), copy=True, compress=True)

bpy.ops.object.select_all(action='SELECT')
target = OUT / 'hero.glb'
bpy.ops.export_scene.gltf(filepath=str(target), export_format='GLB', use_selection=True, export_animations=True,
                          export_animation_mode='NLA_TRACKS', export_force_sampling=True, export_frame_range=False,
                          export_cameras=False, export_lights=False)

raw = target.read_bytes()
count = struct.unpack_from('<I', raw, 12)[0]
data = json.loads(raw[20:20 + count])
manifest_path = OUT / 'manifest.json'
manifest = json.loads(manifest_path.read_text())
entry = {
    'file': 'hero.glb',
    'bytes': len(raw),
    'clips': [item['name'] for item in data.get('animations', [])],
    'meshes': len(data.get('meshes', [])),
    'rig': 'skinned armature',
    'ground': 0,
    # 손목 관절에서 칼끝까지의 길이(모델 단위). 장면 단위로는 scale을 곱한다.
    'weapon': {'bone': 'weapon', 'tip': 'weapon_tip', 'length': round(blade_length, 4), 'scale': round(armature.scale[0], 4)},
    'source': f'Kenney Mini Characters 2.0 (character-{CHARACTER}, weapon-sword), CC0 — scripts/import_kenney_hero.py',
}
manifest['source'] = 'scripts/create_3d_assets.py, scripts/import_kenney_hero.py'
manifest['license'] = ('Monsters: original S’word Master artwork (scripts/create_3d_assets.py). '
                       'Hero: Kenney Mini Characters, CC0 (scripts/import_kenney_hero.py).')
manifest['models'] = {'hero': entry, **{name: value for name, value in manifest['models'].items() if name != 'hero'}}
manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n')
print('SWORD_HERO', CHARACTER, len(raw), entry['clips'], flush=True)
