"""S’word Master 던전 경로 지도용 로우폴리 미니어처(원본 제작, 외부 자산 없음).
Blender 4.3+ (MCP for Blender에서 exec하거나 headless로 실행):
  blender --background --factory-startup --python scripts/create_map_tokens.py
산출물:
  public/models/map-tokens.glb   게임이 읽는 GLB (오브젝트 이름: map-tile, token-<방 종류>, map-step, map-entrance,
                                 map-stair, map-pillar, map-sconce)
  assets/models/map-tokens.blend Blender에서 열어 보는 원본 장면(이 스크립트를 다시 실행하면 덮어쓴다)
좌표: Blender Z-up, 바닥 중심이 원점. glTF로 내보내면 Y-up이 된다. 방 타일 지름은 약 1.0.
"""
import math
from pathlib import Path

import bmesh
import bpy
from mathutils import Euler, Vector

try:
    ROOT = Path(__file__).resolve().parents[1]
except NameError:  # MCP exec에는 __file__이 없을 수 있다
    ROOT = Path(bpy.path.abspath('//')).resolve() if bpy.data.filepath else Path.cwd()
OUT = ROOT / 'public/models/map-tokens.glb'
BLEND_OUT = ROOT / 'assets/models/map-tokens.blend'

MATS = {}


SCENE_NAME = 'MapTokens'


def reset_scene():
    """전용 'MapTokens' 장면만 비우고 그 안에서 만든다(열려 있는 다른 장면은 건드리지 않는다)."""
    bpy.context.preferences.view.use_translate_new_dataname = False
    bpy.context.preferences.filepaths.save_version = 0
    if bpy.context.window:
        scene = bpy.data.scenes.get(SCENE_NAME) or bpy.data.scenes.new(SCENE_NAME)
        bpy.context.window.scene = scene
    else:  # headless(--factory-startup): 기본 장면을 전용 장면으로 쓴다
        scene = bpy.context.scene
        scene.name = SCENE_NAME
    for obj in list(scene.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for block in (bpy.data.meshes, bpy.data.materials):
        for item in list(block):
            if item.users == 0:
                block.remove(item)
    MATS.clear()
    return scene


def linear(hex_color):
    srgb = [int(hex_color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in srgb)


def material(name, color, metal=0.0, rough=.7, glow=0.0):
    if name in MATS:
        return MATS[name]
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    # 노드 이름은 Blender 언어 설정에 따라 바뀌므로 종류로 찾는다.
    node = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    rgb = linear(color)
    node.inputs['Base Color'].default_value = (*rgb, 1)
    node.inputs['Metallic'].default_value = metal
    node.inputs['Roughness'].default_value = rough
    if glow:
        emission = node.inputs.get('Emission Color') or node.inputs.get('Emission')
        emission.default_value = (*rgb, 1)
        node.inputs['Emission Strength'].default_value = glow
    mat.diffuse_color = (*rgb, 1)
    MATS[name] = mat
    return mat


PALETTE = {
    'stone': ('#4b4058', 0, .9), 'stone-dark': ('#2a2233', 0, .95), 'stone-light': ('#6d6380', 0, .85),
    'brass': ('#c39552', .75, .38), 'gold': ('#f2c35c', .85, .3), 'steel': ('#d4d8e2', .8, .28),
    'iron': ('#474b57', .7, .45), 'wood': ('#7b4b2b', 0, .8), 'wood-dark': ('#4a2d1c', 0, .85),
    'bone': ('#e6dccb', 0, .6), 'leather': ('#3a2a22', 0, .8), 'velvet': ('#8f2f3c', 0, .7),
    'rock': ('#5e5668', 0, .92),
}


def mat(key):
    color, metal, rough = PALETTE[key]
    return material(key, color, metal, rough)


def glow(name, color, strength=3.0):
    return material(name, color, 0, .5, strength)


def finish(obj, mtl, smooth=False):
    obj.data.materials.clear()
    obj.data.materials.append(mtl)
    for poly in obj.data.polygons:
        poly.use_smooth = smooth
    return obj


def box(size, loc, mtl, rot=(0, 0, 0), bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        mod = obj.modifiers.new('bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = 1
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(obj, mtl)


def cyl(radius, depth, loc, mtl, verts=8, rot=(0, 0, 0), radius2=None):
    if radius2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=loc, rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=radius, radius2=radius2, depth=depth, location=loc, rotation=rot)
    return finish(bpy.context.active_object, mtl)


def cone(radius, depth, loc, mtl, verts=6, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=radius, radius2=0, depth=depth, location=loc, rotation=rot)
    return finish(bpy.context.active_object, mtl)


def rock(radius, loc, mtl, squash=(1, 1, .55), seed=0):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=radius, location=loc)
    obj = bpy.context.active_object
    obj.scale = squash
    obj.rotation_euler = Euler((seed * .7, seed * 1.3, seed * 2.1))
    bpy.ops.object.transform_apply(scale=True, rotation=True)
    # 면마다 살짝 다른 높이를 줘서 손으로 깎은 돌처럼 보이게 한다.
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    for i, v in enumerate(bm.verts):
        v.co *= 1 + math.sin(i * 12.9898 + seed * 78.233) * .08
    bm.to_mesh(obj.data)
    bm.free()
    return finish(obj, mtl)


def join(name, parts):
    bpy.ops.object.select_all(action='DESELECT')
    for part in parts:
        part.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    obj = bpy.context.active_object
    obj.name = name
    obj.data.name = name
    # 원점을 바닥 중심(0,0,0)으로 둔다.
    bpy.context.scene.cursor.location = (0, 0, 0)
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    return obj


# ---------- 방 받침 타일 ----------
def build_tile():
    parts = [
        cyl(.5, .14, (0, 0, .07), mat('stone'), verts=8, rot=(0, 0, math.pi / 8)),
        cyl(.53, .05, (0, 0, .025), mat('brass'), verts=8, rot=(0, 0, math.pi / 8)),
        cyl(.41, .02, (0, 0, .145), mat('stone-dark'), verts=8, rot=(0, 0, math.pi / 8)),
    ]
    # 모서리 리벳
    for i in range(8):
        a = i * math.tau / 8
        parts.append(cyl(.035, .03, (math.cos(a) * .47, math.sin(a) * .47, .15), mat('brass'), verts=6))
    return join('map-tile', parts)


# ---------- 전투: 바위에 꽂힌 교차 검 ----------
def sword(angle):
    # 칼끝이 아래(바위 속), 손잡이가 위로 오도록 세운다.
    parts = [
        box((.085, .022, .5), (0, 0, .25), mat('steel'), bevel=.008),
        cone(.043, .08, (0, 0, -.04), mat('steel'), verts=4, rot=(math.pi, 0, 0)),
        box((.28, .055, .05), (0, 0, .52), mat('brass'), bevel=.01),
        cyl(.026, .16, (0, 0, .62), mat('leather'), verts=6),
        cyl(.042, .05, (0, 0, .72), mat('brass'), verts=6),
    ]
    obj = join('sword', parts)
    obj.rotation_euler = (0, angle, 0)
    obj.location = (0, 0, .02)
    bpy.ops.object.transform_apply(location=True, rotation=True)
    return obj


def build_battle():
    # 위에서 내려다보는 지도 카메라에서도 읽히도록, 뒤로 기운 붉은 원형 방패 앞에 검 두 자루를 교차해 세운다.
    shield_face = material('shield-red', '#b2412f', 0, .6)
    tilt = (math.radians(50), 0, 0)  # 앞(-Y)·위를 향하도록 뒤로 기울인다
    parts = [
        rock(.2, (0, .06, .06), mat('rock'), seed=1),
        cyl(.27, .05, (0, .1, .3), shield_face, verts=12, rot=tilt),
        cyl(.3, .035, (0, .125, .29), mat('brass'), verts=12, rot=tilt),
        cyl(.07, .05, (0, .075, .33), mat('brass'), verts=8, rot=tilt),
        sword(.42), sword(-.42),
    ]
    obj = join('token-battle', parts)
    return obj


# ---------- 강적: 뿔 달린 투구와 보라 눈빛 ----------
def horn(side):
    """투구 옆에서 바깥·위로 휘어 오르는 두 마디 뿔."""
    base = Vector((side * .17, 0, .36))
    parts = []
    for tilt, length, radius in ((1.0, .26, .068), (.25, .2, .046)):
        direction = Vector((side * math.sin(tilt), 0, math.cos(tilt)))
        parts.append(cone(radius, length, base + direction * (length / 2), mat('bone'), verts=6, rot=(0, side * tilt, 0)))
        base = base + direction * (length * .8)
    return parts


def build_elite():
    eye = glow('elite-eye', '#c49bff', 4)
    parts = [cyl(.2, .1, (0, 0, .05), mat('stone-dark'), verts=6)]
    bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=6, radius=.22, location=(0, 0, .3))
    helm = bpy.context.active_object
    helm.scale = (1, .9, 1.15)
    bpy.ops.object.transform_apply(scale=True)
    parts.append(finish(helm, mat('iron')))
    parts.append(box((.26, .06, .045), (0, -.19, .32), eye, bevel=.01))
    parts.append(box((.04, .05, .18), (0, -.205, .2), mat('iron')))
    parts += horn(-1) + horn(1)
    parts.append(cone(.05, .14, (0, 0, .58), mat('iron'), verts=4))
    return join('token-elite', parts)


# ---------- 보물: 금테 상자와 동전 ----------
def build_treasure():
    parts = [
        box((.5, .32, .24), (0, 0, .12), mat('wood'), bevel=.02),
        cyl(.16, .5, (0, 0, .24), mat('wood-dark'), verts=8, rot=(0, math.pi / 2, 0)),
    ]
    # 뚜껑 아래 절반은 몸통에 묻힌다. 금테 세 줄과 자물쇠.
    for x in (-.2, 0, .2):
        parts.append(box((.045, .34, .26), (x, 0, .13), mat('gold')))
        parts.append(cyl(.168, .046, (x, 0, .24), mat('gold'), verts=8, rot=(0, math.pi / 2, 0)))
    parts.append(box((.09, .04, .1), (0, -.17, .22), mat('gold'), bevel=.01))
    parts.append(box((.03, .045, .04), (0, -.19, .2), mat('leather')))
    for i, (x, y) in enumerate(((.32, -.14), (.36, .05), (-.33, -.12), (.28, -.02))):
        parts.append(cyl(.06, .02, (x, y, .01 + i % 2 * .02), mat('gold'), verts=8))
    return join('token-treasure', parts)


# ---------- 휴식: 돌로 두른 모닥불 ----------
def build_rest():
    flame = glow('flame', '#ff7a1f', 5)
    core = glow('flame-core', '#ffc94a', 6)
    parts = []
    for i in range(7):
        a = i * math.tau / 7
        parts.append(rock(.08, (math.cos(a) * .26, math.sin(a) * .26, .04), mat('stone-light'), seed=i + 3))
    for i in range(3):
        a = i * math.tau / 3
        parts.append(cyl(.04, .42, (math.cos(a) * .05, math.sin(a) * .05, .1), mat('wood'), verts=6,
                         rot=(math.pi / 2 - .5, 0, a + math.pi / 2)))
    parts.append(cone(.17, .42, (0, 0, .34), flame, verts=6))
    parts.append(cone(.09, .3, (.02, -.02, .32), core, verts=5))
    parts.append(cone(.07, .2, (.12, .06, .26), flame, verts=5, rot=(0, .3, 0)))
    return join('token-rest', parts)


# ---------- 대장간: 모루와 망치, 달군 쇳덩이 ----------
def build_forge():
    hot = glow('hot-iron', '#ff6a1a', 4)
    parts = [
        box((.34, .26, .08), (0, 0, .04), mat('iron'), bevel=.01),
        box((.16, .14, .16), (0, 0, .16), mat('iron')),
        box((.44, .2, .1), (0, 0, .29), mat('iron'), bevel=.012),
        cone(.1, .2, (.31, 0, .29), mat('iron'), verts=4, rot=(0, math.pi / 2, 0)),
        box((.14, .07, .04), (-.04, 0, .36), hot, bevel=.008),
        cyl(.022, .38, (-.27, .12, .18), mat('wood'), verts=6, rot=(0, .45, 0)),
        box((.08, .16, .08), (-.19, .12, .35), mat('steel'), rot=(0, .45, 0), bevel=.008),
    ]
    return join('token-forge', parts)


# ---------- 보스: 기둥 위 방석에 놓인 왕관 ----------
def build_boss():
    gem = glow('boss-gem', '#ff4b5c', 3)
    parts = [
        cyl(.3, .12, (0, 0, .06), mat('stone-dark'), verts=8),
        cyl(.2, .36, (0, 0, .3), mat('stone'), verts=8),
        cyl(.27, .06, (0, 0, .5), mat('brass'), verts=8),
        box((.42, .42, .1), (0, 0, .58), mat('velvet'), bevel=.04),
        cyl(.17, .14, (0, 0, .7), mat('gold'), verts=10),
    ]
    for i in range(5):
        a = i * math.tau / 5
        parts.append(cone(.06, .18, (math.cos(a) * .15, math.sin(a) * .15, .86), mat('gold'), verts=4))
        parts.append(rock(.03, (math.cos(a) * .17, math.sin(a) * .17, .71), gem, squash=(1, 1, 1), seed=i))
    return join('token-boss', parts)


# ---------- 길 디딤돌 · 입구 아치 ----------
def build_step():
    obj = rock(.12, (0, 0, .03), mat('stone-light'), squash=(1, .8, .3), seed=9)
    obj.name = 'map-step'
    obj.data.name = 'map-step'
    bpy.context.scene.cursor.location = (0, 0, 0)
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    return obj


def build_entrance():
    dark = material('doorway', '#0b0710', 0, 1)
    parts = [
        box((.16, .16, .62), (-.3, 0, .31), mat('stone'), bevel=.015),
        box((.16, .16, .62), (.3, 0, .31), mat('stone'), bevel=.015),
        box((.8, .2, .14), (0, 0, .68), mat('stone-light'), bevel=.02),
        box((.44, .04, .56), (0, .03, .28), dark),
        cyl(.6, .06, (0, 0, .03), mat('stone-dark'), verts=8, rot=(0, 0, math.pi / 8)),
    ]
    return join('map-entrance', parts)


# ---------- 탑 단면용: 계단 디딤판 · 돌기둥 · 벽 횃대 ----------
def build_stair():
    # 폭 0.9, 깊이 0.32, 높이 0.14 디딤판. 앞 모서리에 황동 띠를 둘러 밟을 곳을 또렷하게 한다.
    parts = [
        box((.9, .32, .14), (0, 0, .07), mat('stone-light'), bevel=.015),
        box((.92, .05, .03), (0, -.15, .135), mat('brass')),
    ]
    return join('map-stair', parts)


def build_pillar():
    # 높이 1.6(한 층) 돌기둥. 위아래 받침과 황동 고리.
    parts = [
        box((.34, .34, .14), (0, 0, .07), mat('stone-dark'), bevel=.02),
        cyl(.13, 1.32, (0, 0, .8), mat('stone'), verts=8),
        cyl(.15, .05, (0, 0, 1.1), mat('brass'), verts=8),
        box((.34, .34, .14), (0, 0, 1.53), mat('stone-dark'), bevel=.02),
    ]
    return join('map-pillar', parts)


def build_sconce():
    flame = glow('flame', '#ff7a1f', 5)
    core = glow('flame-core', '#ffc94a', 6)
    parts = [
        box((.08, .06, .22), (0, .03, 0), mat('iron'), bevel=.01),
        cyl(.07, .08, (0, -.06, .12), mat('brass'), verts=8, radius2=.04),
        cone(.07, .2, (0, -.06, .26), flame, verts=6),
        cone(.035, .13, (0, -.06, .25), core, verts=5),
    ]
    return join('map-sconce', parts)


BUILDERS = [build_tile, build_battle, build_elite, build_treasure, build_rest, build_forge, build_boss, build_step, build_entrance,
            build_stair, build_pillar, build_sconce]


def build_all():
    reset_scene()
    objects = [builder() for builder in BUILDERS]
    # Blender에서 한눈에 비교하도록 나란히 놓는다(내보낼 때는 각자 원점으로 되돌린다).
    for i, obj in enumerate(objects):
        obj.location = ((i % 6) * 1.3 - 3.2, (i // 6) * 1.6, 0)
    return objects


def export(objects):
    OUT.parent.mkdir(parents=True, exist_ok=True)
    BLEND_OUT.parent.mkdir(parents=True, exist_ok=True)
    saved = [obj.location.copy() for obj in objects]
    for obj in objects:
        obj.location = (0, 0, 0)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUT), export_format='GLB', use_selection=True, export_yup=True,
                              export_apply=True, export_materials='EXPORT', export_animations=False)
    for obj, loc in zip(objects, saved):
        obj.location = loc
    # 열려 있는 파일 전체가 아니라 토큰 장면만 원본 .blend로 저장한다.
    bpy.data.libraries.write(str(BLEND_OUT), {bpy.context.scene}, fake_user=True)
    print(f'map tokens -> {OUT.relative_to(ROOT)} ({OUT.stat().st_size} bytes), {BLEND_OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    export(build_all())
