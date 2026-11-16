"""Sculpted low-poly spirit, guardian, elite, and boss monster builders: ember, wisp, watcher, sentinel, ravager, boss."""
import math
import bpy
import bmesh
from mathutils import Vector
from mesh_sculpt import (
    MatLibrary, add_box, add_cone, add_crystal, add_eye_pair,
    add_fern_sprig, add_fur_collar, add_icosphere, add_joint, add_leaf,
    add_rod, add_tattered_cape, add_tube, finalize_bmesh, hex_to_linear, mix_linear,
)


def _spirit_vortex(parent, mat, core_mat, heights, radii, pts_ribbon,
                   col_bot, col_mid, col_top, col_core, tail_points):
    """Build a sculpted multi-layered swirling faceted flame cloak behind the mask."""
    def body_col(c, n, idx):
        t = max(0.0, min(1.0, (c.z - heights[0]) / max(0.01, heights[1] - heights[0])))
        return mix_linear(col_bot, col_mid, t * 0.7) if t < 0.6 else mix_linear(col_mid, col_top, (t - 0.6) / 0.4)

    def ribbon_prof(ang, t):
        return 1.0 + 0.30 * math.cos(ang * 3.0 + t * 2.8)

    add_tube('flame cloak', tail_points, radii, mat, parent, sides=8, profile_fn=ribbon_prof,
             twist=1.6, color_fn=body_col, base_hex=col_mid)

    for idx, (pts, r_list) in enumerate(pts_ribbon):
        add_tube(f'flame ribbon {idx}', pts, r_list, mat, parent, sides=5,
                 twist=0.7 * (1 if idx % 2 == 0 else -1),
                 color_fn=lambda c, n, i, cb=col_mid, ct=col_top: mix_linear(cb, ct, max(0, min(1, (c.z - 0.45) / 1.35))),
                 base_hex=col_top)

    add_icosphere('flame inner heart', (0, 0.08, 0.90), (0.20, 0.14, 0.30), core_mat, parent, subdiv=2,
                  color_fn=lambda c, n, i: hex_to_linear(col_core), base_hex=col_core)


def build_ember(root, joints):
    """Fiery wraith with swirling sculpted flame vortex, ornate bronze horned mask, and ember motes."""
    mats = MatLibrary()
    flame_mat = mats.vcol('ember flame', rough=0.45)
    core_mat = mats.vcol_glow('ember core', glow=0.38, rough=0.25)
    mask_mat = mats.metal('ember bronze mask', '#614030', metal=0.72, rough=0.34)
    gold_mat = mats.metal('ember gold trim', '#d49d4a', metal=0.82, rough=0.26)
    gem_mat = mats.vcol_glow('ember gem', glow=0.40, rough=0.2)

    body = add_joint(joints, 'body', (0, 0, 0.22), root, 'spirit')

    tail_pts = [(0.08, 0.22, 0.02), (-0.10, 0.16, 0.34), (0.04, 0.12, 0.68), (0, 0.14, 1.04), (0, 0.18, 1.54)]
    radii = [(0.015, 0.015), (0.12, 0.09), (0.29, 0.20), (0.33, 0.21), (0.02, 0.02)]
    ribbons = [
        ([(-0.22, 0.08, 0.50), (-0.42, 0.14, 0.94), (-0.28, 0.18, 1.40), (-0.10, 0.22, 1.76)], [(0.09, 0.06), (0.11, 0.07), (0.07, 0.04), (0.01, 0.01)]),
        ([(0.22, 0.08, 0.50), (0.42, 0.14, 0.96), (0.28, 0.18, 1.42), (0.08, 0.22, 1.80)], [(0.09, 0.06), (0.11, 0.07), (0.07, 0.04), (0.01, 0.01)]),
        ([(0.0, 0.28, 0.60), (-0.10, 0.32, 1.12), (0.04, 0.26, 1.58), (0.0, 0.20, 1.88)], [(0.12, 0.07), (0.13, 0.08), (0.08, 0.05), (0.01, 0.01)]),
        ([(-0.14, 0.04, 0.44), (-0.30, 0.02, 0.72), (-0.18, 0.08, 0.32)], [(0.07, 0.05), (0.08, 0.05), (0.01, 0.01)]),
        ([(0.14, 0.04, 0.44), (0.30, 0.02, 0.72), (0.18, 0.08, 0.32)], [(0.07, 0.05), (0.08, 0.05), (0.01, 0.01)]),
    ]
    _spirit_vortex(body, flame_mat, core_mat, (0.02, 1.85), radii, ribbons,
                   '#c92814', '#ff731c', '#ffd25a', '#ffe680', tail_pts)

    # Ornate dark-bronze horned flame mask cleanly in front of the flames
    head = add_joint(joints, 'head', (0, -0.18, 0.96), body, 'head')
    add_icosphere('ember mask base', (0, -0.06, 0.0), (0.30, 0.12, 0.31), mask_mat, head, subdiv=2,
                  deform_fn=lambda p: (p.x * (0.45 if p.z < -0.35 else 1.0), p.y, p.z * (1.22 if p.z < 0 else 0.92)),
                  base_hex='#614030')
    for sign in (-1, 1):
        add_tube(f'ember mask horn {sign}',
                 [(sign * 0.17, -0.05, 0.18), (sign * 0.36, -0.02, 0.38), (sign * 0.30, 0.04, 0.64), (sign * 0.18, 0.08, 0.78)],
                 [0.072, 0.054, 0.030, 0.006], mask_mat, head, sides=6, base_hex='#614030')
        add_tube(f'ember mask ridge {sign}',
                 [(sign * 0.24, -0.11, 0.17), (sign * 0.15, -0.17, 0.0), (sign * 0.04, -0.15, -0.24)],
                 [0.024, 0.020, 0.014], gold_mat, head, sides=5, base_hex='#d49d4a')
    add_crystal('ember forehead gem', (0, -0.16, 0.18), 0.058, 0.13, gem_mat, head, sides=4, base_hex='#ffc448')
    add_eye_pair(head, mats, z=0.02, y=-0.13, spread=0.115, radius=0.062,
                 iris_color='#ffd959', dark_color='#1a0d08', glow_iris=True,
                 socket_color=None, shine_glow=1.22,
                 brow_color='#4a2d20', fierce=0.55, eye_yaw=0.22, squash_y=0.72)

    crystals = add_joint(joints, 'crystals', (0, 0, 0.96), body, 'crystals')
    for i in range(7):
        a = i * math.tau / 7
        r = 0.50 + (i % 2) * 0.10
        z = -0.26 + (i % 3) * 0.28
        add_crystal(f'ember spark {i}', (math.cos(a) * r, math.sin(a) * r, z),
                    0.042, 0.10, gem_mat, crystals, sides=4, rot=(0.2 * i, 0.3, a), base_hex='#ff8c2e')


def build_wisp(root, joints):
    """Frost-lantern spirit with silver-gold crown mask, icicle vortex, and orbiting frost shards."""
    mats = MatLibrary()
    frost_mat = mats.vcol('wisp frost', rough=0.38)
    core_mat = mats.vcol_glow('wisp core', glow=0.35, rough=0.22)
    crown_mat = mats.metal('wisp silver mask', '#bfd0e2', metal=0.78, rough=0.26)
    gold_mat = mats.metal('wisp gold trim', '#cfb16b', metal=0.80, rough=0.28)
    shard_mat = mats.vcol_glow('wisp frost shard', glow=0.34, rough=0.18)

    body = add_joint(joints, 'body', (0, 0, 0.22), root, 'spirit')

    tail_pts = [(0.0, 0.14, 0.0), (0.04, 0.16, 0.32), (-0.04, 0.12, 0.65), (0.0, 0.12, 1.05), (0.05, 0.18, 1.60)]
    radii = [(0.01, 0.01), (0.14, 0.10), (0.30, 0.20), (0.34, 0.22), (0.02, 0.02)]
    ribbons = [
        ([(-0.22, 0.08, 0.65), (-0.40, 0.14, 1.05), (-0.26, 0.20, 1.50), (-0.08, 0.24, 1.84)], [(0.09, 0.06), (0.11, 0.07), (0.07, 0.05), (0.01, 0.01)]),
        ([(0.24, 0.08, 0.68), (0.42, 0.14, 1.08), (0.28, 0.20, 1.48), (0.10, 0.22, 1.76)], [(0.09, 0.06), (0.11, 0.07), (0.07, 0.05), (0.01, 0.01)]),
    ]
    _spirit_vortex(body, frost_mat, core_mat, (0.0, 1.84), radii, ribbons,
                   '#1c6099', '#4dc6f2', '#c8f8ff', '#9cf2ff', tail_pts)

    for idx, (ix, iy, ilen) in enumerate([(-0.18, 0.06, 0.34), (0.18, 0.06, 0.32), (0.0, -0.02, 0.28), (0.0, 0.22, 0.36)]):
        add_cone(f'wisp icicle {idx}', (ix, iy, 0.36), 0.065, 0.002, ilen, frost_mat, body,
                 sides=5, rot=(math.pi, 0, 0.4 * idx), base_hex='#67d8fa')

    # Silver-gold crystalline crown-mask cleanly in front of the frost tornado
    head = add_joint(joints, 'head', (0, -0.20, 0.96), body, 'head')
    add_icosphere('wisp mask plate', (0, -0.06, -0.02), (0.30, 0.12, 0.28), crown_mat, head, subdiv=2,
                  deform_fn=lambda p: (p.x * (0.48 if p.z < -0.35 else 1.0), p.y, p.z * (1.25 if p.z < 0 else 0.9)),
                  base_hex='#bdd0e2')
    add_cone('wisp crown center spire', (0, -0.08, 0.30), 0.068, 0.004, 0.28, crown_mat, head, sides=5, base_hex='#d0e2f2')
    for sign in (-1, 1):
        add_tube(f'wisp crown wing {sign}',
                 [(sign * 0.12, -0.08, 0.14), (sign * 0.30, -0.05, 0.28), (sign * 0.38, 0.02, 0.44)],
                 [0.050, 0.042, 0.006], crown_mat, head, sides=5, base_hex='#bdd0e2')
        add_cone(f'wisp cheek fin {sign}', (sign * 0.30, -0.06, 0.02), 0.048, 0.003, 0.22, gold_mat, head,
                 sides=4, rot=(0.2, sign * 1.1, 0), base_hex='#cfb16b')
        add_tube(f'wisp gold rim {sign}',
                 [(sign * 0.23, -0.13, 0.14), (sign * 0.16, -0.16, -0.02), (sign * 0.04, -0.15, -0.24)],
                 [0.018, 0.016, 0.010], gold_mat, head, sides=4, base_hex='#cfb16b')

    add_crystal('wisp crown crystal', (0, -0.14, 0.16), 0.058, 0.13, shard_mat, head, sides=4, base_hex='#5be8ff')
    add_eye_pair(head, mats, z=0.01, y=-0.13, spread=0.110, radius=0.060,
                 iris_color='#75f0ff', dark_color='#0d1d2e', glow_iris=True,
                 socket_color=None, shine_glow=1.25,
                 brow_color='#8ea5bd', fierce=0.35, eye_yaw=0.22, squash_y=0.78)

    crystals = add_joint(joints, 'crystals', (0, 0, 0.96), body, 'crystals')
    for i in range(6):
        a = i * math.tau / 6
        r = 0.52 + (i % 2) * 0.08
        z = -0.20 + (i % 3) * 0.24
        add_crystal(f'frost shard {i}', (math.cos(a) * r, math.sin(a) * r, z),
                    0.055, 0.15, shard_mat, crystals, sides=4, rot=(0.25, 0.2 * (i % 2), a), base_hex='#5ee6ff')


def build_watcher(root, joints):
    """Elite void spirit with horned golden crescent crown-mask, third-eye gem, and 5 orbiting gold crystals."""
    mats = MatLibrary()
    void_mat = mats.vcol('watcher void', rough=0.45)
    core_mat = mats.vcol_glow('watcher core', glow=0.35, rough=0.25)
    gold_mat = mats.metal('watcher gold crown', '#ddb04d', metal=0.82, rough=0.25)
    gem_mat = mats.vcol_glow('watcher amethyst', glow=0.40, rough=0.18)
    orb_mat = mats.vcol_glow('watcher orb crystal', glow=0.30, metal=0.25, rough=0.22)

    body = add_joint(joints, 'body', (0, 0, 0.24), root, 'spirit')

    tail_pts = [(0.08, 0.22, 0.0), (-0.10, 0.18, 0.34), (0.04, 0.14, 0.68), (0, 0.14, 1.06), (0, 0.18, 1.66)]
    radii = [(0.015, 0.015), (0.15, 0.11), (0.33, 0.21), (0.38, 0.24), (0.03, 0.03)]
    ribbons = [
        ([(-0.28, 0.08, 0.56), (-0.48, 0.14, 1.04), (-0.34, 0.18, 1.50), (-0.14, 0.22, 1.90)], [(0.11, 0.07), (0.13, 0.08), (0.09, 0.05), (0.01, 0.01)]),
        ([(0.28, 0.08, 0.56), (0.48, 0.14, 1.04), (0.34, 0.18, 1.50), (0.14, 0.22, 1.90)], [(0.11, 0.07), (0.13, 0.08), (0.09, 0.05), (0.01, 0.01)]),
        ([(0, 0.30, 0.65), (-0.10, 0.34, 1.24), (0.04, 0.30, 1.70), (0, 0.24, 2.00)], [(0.14, 0.08), (0.14, 0.08), (0.08, 0.05), (0.01, 0.01)]),
    ]
    _spirit_vortex(body, void_mat, core_mat, (0.0, 1.96), radii, ribbons,
                   '#351463', '#7c33cf', '#c978ff', '#c98aff', tail_pts)

    head = add_joint(joints, 'head', (0, -0.22, 1.00), body, 'head')
    add_icosphere('watcher mask', (0, -0.06, -0.02), (0.34, 0.12, 0.30), gold_mat, head, subdiv=2,
                  deform_fn=lambda p: (p.x * (0.45 if p.z < -0.35 else 1.0), p.y, p.z * (1.2 if p.z < 0 else 0.9)),
                  base_hex='#d9ab4c')
    add_cone('watcher crest spike', (0, -0.08, 0.31), 0.082, 0.005, 0.28, gold_mat, head, sides=5, base_hex='#ddb04d')
    add_crystal('watcher third eye', (0, -0.16, 0.18), 0.072, 0.15, gem_mat, head, sides=5, base_hex='#c966ff')

    for sign in (-1, 1):
        add_tube(f'watcher crescent horn {sign}',
                 [(sign * 0.14, -0.08, 0.16), (sign * 0.38, -0.04, 0.32),
                  (sign * 0.46, 0.02, 0.58), (sign * 0.30, 0.06, 0.78)],
                 [0.072, 0.062, 0.036, 0.006], gold_mat, head, sides=6, base_hex='#ddb04d')
        add_cone(f'watcher cheek wing {sign}', (sign * 0.33, -0.06, -0.02), 0.065, 0.004, 0.24, gold_mat, head,
                 sides=5, rot=(0.2, sign * 1.25, 0), base_hex='#ddb04d')

    add_eye_pair(head, mats, z=0.0, y=-0.15, spread=0.115, radius=0.056,
                 iris_color='#d46eff', dark_color='#180a26', glow_iris=True,
                 socket_color=None, shine_glow=1.12,
                 brow_color='#b58a34', fierce=0.65, eye_yaw=0.22, squash_y=0.58)

    crystals = add_joint(joints, 'crystals', (0, 0, 0.98), body, 'crystals')
    for i in range(5):
        a = i * math.tau / 5
        r = 0.66
        z = math.sin(a * 2.0) * 0.28
        add_crystal(f'watcher crystal {i}', (math.cos(a) * r, math.sin(a) * r, z),
                    0.095, 0.24, orb_mat, crystals, sides=4, rot=(0.15, 0.15, a),
                    color_fn=lambda c, n, idx: mix_linear('#d4841c', '#ffd659', max(0, min(1, (c.z + 0.12) / 0.24))),
                    base_hex='#ffbf3d')


def _build_armored_legs(root, joints, armor_mat, dark_mat, trim_mat, boot_mat,
                        hip_x=0.19, hip_z=0.96, leg_scale=1.0, mossy_knee=False, moss_mat=None):
    for sign, name, role in [(-1, 'leg_left', 'legL'), (1, 'leg_right', 'legR')]:
        leg = add_joint(joints, name, (sign * hip_x, 0, hip_z), root, role)
        add_tube(f'{name}_thigh', [(0, 0, 0.02), (0, -0.02, -0.44 * leg_scale)],
                 [(0.15 * leg_scale, 0.15 * leg_scale), (0.12 * leg_scale, 0.12 * leg_scale)],
                 dark_mat, leg, sides=8, base_hex='#252a2b')
        add_box(f'{name}_knee', (0, -0.12 * leg_scale, -0.44 * leg_scale),
                (0.20 * leg_scale, 0.14 * leg_scale, 0.18 * leg_scale),
                armor_mat, leg, bevel=0.028 * leg_scale, base_hex='#697468')
        if mossy_knee and moss_mat:
            add_icosphere(f'{name}_moss', (sign * 0.05 * leg_scale, -0.15 * leg_scale, -0.38 * leg_scale),
                          (0.11, 0.09, 0.07), moss_mat, leg, subdiv=1, base_hex='#6fa342')
        add_tube(f'{name}_greave', [(0, -0.01, -0.45 * leg_scale), (0, -0.02, -0.86 * leg_scale)],
                 [(0.135 * leg_scale, 0.14 * leg_scale), (0.115 * leg_scale, 0.125 * leg_scale)],
                 armor_mat, leg, sides=8, base_hex='#606b60')
        foot_z = -hip_z + 0.065 * leg_scale
        add_icosphere(f'{name}_boot', (0, -0.09 * leg_scale, foot_z),
                      (0.15 * leg_scale, 0.24 * leg_scale, 0.105 * leg_scale),
                      boot_mat, leg, subdiv=2,
                      deform_fn=lambda p: (p.x * (1.12 if p.y < 0 else 0.9), p.y, max(-0.62, p.z)),
                      base_hex='#37322e')
        add_box(f'{name}_boot_cuff', (0, -0.10 * leg_scale, foot_z + 0.09 * leg_scale),
                (0.22 * leg_scale, 0.16 * leg_scale, 0.06 * leg_scale),
                trim_mat, leg, bevel=0.012, base_hex='#b89250')


def _build_sword(parent, mats, length=1.08, width=0.095, steel_hex='#9eaab0', trim_hex='#c49b52',
                 glow_hex=None, notched=False, hand_z=-0.58):
    weapon = bpy.data.objects.new('weapon', None)
    bpy.context.collection.objects.link(weapon)
    weapon.parent = parent
    weapon.location = (0, 0, hand_z)
    weapon.rotation_euler.x = 2.05

    steel_mat = mats.vcol('weapon steel', metal=0.72, rough=0.32)
    trim_mat = mats.metal('weapon brass', trim_hex, metal=0.78, rough=0.28)
    grip_mat = mats.solid('weapon grip', '#3d281f', rough=0.82)

    add_tube('weapon grip', [(0, 0, -0.15), (0, 0, 0.13)], [0.040, 0.042], grip_mat, weapon, sides=7, base_hex='#3d281f')
    add_icosphere('weapon pommel', (0, 0, -0.18), (0.065, 0.065, 0.065), trim_mat, weapon, subdiv=1, base_hex=trim_hex)
    add_box('weapon guard', (0, 0, 0.14), (width * 3.8, 0.085, 0.075), trim_mat, weapon, bevel=0.018, base_hex=trim_hex)
    for sign in (-1, 1):
        add_cone(f'guard wing {sign}', (sign * width * 2.0, 0, 0.17), 0.04, 0.005, 0.10, trim_mat, weapon,
                 sides=5, rot=(0, sign * 0.75, 0), base_hex=trim_hex)

    bm = bmesh.new()
    segs = 5
    rings = []
    for s in range(segs + 1):
        t = s / segs
        z = 0.18 + t * length * 0.80
        w = width * (1.0 - t * 0.28)
        w_l = w * 0.72 if (notched and s in (2, 4)) else w
        w_r = w
        th = 0.032 * (1.0 - t * 0.35)
        rings.append([bm.verts.new((-w_l, 0, z)), bm.verts.new((0, -th, z)),
                      bm.verts.new((w_r, 0, z)), bm.verts.new((0, th, z))])
    for s in range(segs):
        r0, r1 = rings[s], rings[s + 1]
        for k in range(4):
            nk = (k + 1) % 4
            bm.faces.new((r0[k], r0[nk], r1[nk], r1[k]))
    tip = bm.verts.new((0, 0, 0.18 + length))
    for k in range(4):
        nk = (k + 1) % 4
        bm.faces.new((rings[-1][k], rings[-1][nk], tip))
    bm.faces.new((rings[0][3], rings[0][2], rings[0][1], rings[0][0]))
    finalize_bmesh('weapon blade', bm, steel_mat, weapon, smooth=False,
                   color_fn=lambda c, n, idx, sh=steel_hex: mix_linear('#687478', sh, 0.7 if c.y < 0 else 0.35),
                   base_hex=steel_hex)

    if glow_hex:
        glow_mat = mats.vcol_glow('weapon rune glow', glow=0.55, rough=0.25)
        add_tube('blade rune fuller', [(0, -0.028, 0.24), (0, -0.020, 0.18 + length * 0.72)],
                 [0.015, 0.008], glow_mat, weapon, sides=4, base_hex=glow_hex)


def build_sentinel(root, joints):
    """Ancient mossy carved-stone golem knight with vine-draped shoulders, jade rune, and notched broadsword."""
    mats = MatLibrary()
    stone_mat = mats.vcol('sentinel stone', metal=0.14, rough=0.78)
    dark_mat = mats.vcol('sentinel dark stone', metal=0.1, rough=0.82)
    moss_mat = mats.vcol('sentinel moss', rough=0.85)
    leaf_mat = mats.vcol('sentinel vines', rough=0.68, double_sided=True)
    trim_mat = mats.metal('sentinel brass', '#b5904e', metal=0.74, rough=0.34)
    rune_mat = mats.vcol_glow('sentinel jade rune', glow=0.36, rough=0.2)

    torso = add_joint(joints, 'torso', (0, 0, 0), root, 'torso')

    def stone_col(c, n, idx):
        moss_area = (c.x > 0.08 and c.z > 1.38) or (c.x < -0.10 and c.z > 1.42) or (c.z < 1.30 and c.y < 0 and idx % 4 == 0)
        if moss_area and (idx % 3 != 0):
            return mix_linear('#4f7c3b', '#76a648', (idx % 2) * 0.5)
        return mix_linear('#4c574e', '#7b8779', max(0, min(1, (c.z - 1.0) / 0.65)))

    add_tube('sentinel chest', [(0, 0.02, 1.04), (0, 0.0, 1.36), (0, -0.02, 1.66)],
             [(0.28, 0.21), (0.37, 0.25), (0.34, 0.23)],
             stone_mat, torso, sides=10, color_fn=stone_col, base_hex='#657064')

    for sign in (-1, 1):
        add_box(f'chest plate {sign}', (sign * 0.15, -0.19, 1.46), (0.24, 0.11, 0.28),
                stone_mat, torso, bevel=0.030, rot=(0.08, sign * -0.12, 0),
                color_fn=stone_col, base_hex='#6e7a6d')

    # Glowing jade chest rune diamond cleanly in front of chest plates
    add_crystal('sentinel chest bezel', (0, -0.27, 1.46), 0.105, 0.18, trim_mat, torso, sides=4, base_hex='#b5904e')
    add_crystal('sentinel chest rune', (0, -0.31, 1.46), 0.072, 0.14, rune_mat, torso, sides=4, base_hex='#1ae888')

    add_box('sentinel belt', (0, -0.01, 1.04), (0.62, 0.44, 0.12), trim_mat, torso, bevel=0.022, base_hex='#b5904e')
    for tx, tz_len in [(-0.22, 0.26), (0.0, 0.32), (0.22, 0.26)]:
        add_box(f'sentinel tasset {tx}', (tx, -0.19, 0.90), (0.18, 0.07, tz_len),
                stone_mat, torso, bevel=0.022, rot=(-0.16, 0, 0), color_fn=stone_col, base_hex='#657064')

    # Chiseled angular carved stone helmet
    head = add_joint(joints, 'head', (0, -0.01, 1.78), torso, 'head')
    add_box('sentinel helm', (0, 0.0, 0.12), (0.36, 0.34, 0.40), stone_mat, head, bevel=0.055,
            deform_fn=lambda p: (p.x * (0.76 if p.z > 0.10 else 1.0), p.y * (0.85 if p.z > 0.10 else 1.0), p.z),
            color_fn=lambda c, n, i: mix_linear('#4f7c3b', '#76a648', 0.5) if (c.x > 0.05 and c.z > 0.16) else mix_linear('#525c53', '#849080', max(0, min(1, (c.z + 0.15) / 0.45))),
            base_hex='#6d786b')
    add_box('sentinel visor', (0, -0.16, 0.09), (0.27, 0.07, 0.13), dark_mat, head, bevel=0.012, base_hex='#161c1e')
    add_box('sentinel nose bar', (0, -0.19, 0.08), (0.052, 0.045, 0.18), stone_mat, head, bevel=0.01, base_hex='#7c8779')
    add_box('sentinel helm crest', (0, -0.06, 0.31), (0.08, 0.28, 0.12), stone_mat, head, bevel=0.018, base_hex='#7a8576')
    add_eye_pair(head, mats, z=0.10, y=-0.185, spread=0.080, radius=0.044,
                 iris_color='#ffb842', dark_color='#121618', glow_iris=True,
                 socket_color=None, shine_glow=1.22,
                 brow_color='#586357', fierce=0.38, eye_yaw=0.14, squash_y=0.65)

    # Angular stone pauldrons with prominent moss & trailing vines on camera-facing shoulder!
    for sign, jname, role in [(-1, 'arm_left', 'armL'), (1, 'arm_right', 'armR')]:
        arm = add_joint(joints, jname, (sign * 0.43, 0, 1.59), torso, role)
        add_box(f'{jname}_pauldron', (sign * 0.04, 0, 0.02), (0.34, 0.34, 0.28),
                stone_mat, arm, bevel=0.045, rot=(0, sign * 0.18, 0),
                color_fn=stone_col, base_hex='#6d786b')
        if sign > 0:
            add_icosphere('near shoulder moss', (0.04, -0.02, 0.14), (0.20, 0.18, 0.09), moss_mat, arm, subdiv=1, base_hex='#6ea342')
            add_fern_sprig('near shoulder vine', (0.14, -0.08, 0.12), (0.40, -0.35, -0.78), 0.36, leaf_mat, arm, leaflets=3, base_hex='#77ad46')
        else:
            add_icosphere('far shoulder moss', (-0.04, -0.02, 0.14), (0.18, 0.16, 0.08), moss_mat, arm, subdiv=1, base_hex='#6ea342')
            add_fern_sprig('far shoulder vine', (-0.12, -0.08, 0.12), (-0.42, -0.35, -0.78), 0.34, leaf_mat, arm, leaflets=3, base_hex='#77ad46')
        add_tube(f'{jname}_upper', [(0, 0, -0.04), (0, 0, -0.30)], [0.12, 0.11], dark_mat, arm, sides=8, base_hex='#2d3635')
        add_tube(f'{jname}_bracer', [(0, 0, -0.30), (0, -0.01, -0.55)], [0.135, 0.115], stone_mat, arm, sides=8, base_hex='#657064')
        add_icosphere(f'{jname}_fist', (0, -0.02, -0.60), (0.10, 0.10, 0.11), dark_mat, arm, subdiv=1, base_hex='#2a302f')
        if sign < 0:
            add_box('stone buckler', (-0.13, -0.06, -0.44), (0.08, 0.30, 0.42), stone_mat, arm, bevel=0.025, base_hex='#6d786b')
            add_box('buckler trim', (-0.17, -0.06, -0.44), (0.04, 0.18, 0.24), trim_mat, arm, bevel=0.012, base_hex='#b5904e')
        else:
            _build_sword(arm, mats, length=0.98, width=0.092, steel_hex='#9ea8a4', trim_hex='#b5904e',
                         glow_hex=None, notched=True, hand_z=-0.59)
        arm.rotation_euler.x = -0.46 if sign > 0 else -0.18
        arm.rotation_euler.y = sign * -0.32 if sign > 0 else sign * -0.12

    _build_armored_legs(root, joints, stone_mat, dark_mat, trim_mat, dark_mat,
                        hip_x=0.19, hip_z=0.96, leg_scale=1.0, mossy_knee=True, moss_mat=moss_mat)
    root.scale = (1.06, 1.06, 1.06)


def build_ravager(root, joints):
    """Massive cracked dark-iron executioner with fur mantle, glowing magma fissures, and broad double battleaxe."""
    mats = MatLibrary()
    iron_mat = mats.vcol('ravager dark iron', metal=0.65, rough=0.38)
    dark_mat = mats.vcol('ravager charcoal', metal=0.2, rough=0.75)
    magma_mat = mats.vcol_glow('ravager magma', glow=0.36, rough=0.22)
    cloth_mat = mats.vcol('ravager crimson cloth', rough=0.86, double_sided=True)
    horn_mat = mats.vcol('ravager horn', rough=0.52)
    steel_mat = mats.metal('ravager steel', '#737982', metal=0.82, rough=0.32)

    torso = add_joint(joints, 'torso', (0, 0, 0), root, 'torso')

    add_tube('ravager chest', [(0, 0.02, 1.06), (0, -0.02, 1.42), (0, -0.04, 1.76)],
             [(0.32, 0.23), (0.44, 0.29), (0.42, 0.27)],
             iron_mat, torso, sides=10,
             color_fn=lambda c, n, i: mix_linear('#202229', '#454954', max(0, min(1, (c.z - 1.0) / 0.75))),
             base_hex='#343842')

    # Glowing molten magma fissures sitting cleanly ON the front chest cuirass
    crack_paths = [
        [(0, -0.30, 1.46), (-0.14, -0.28, 1.59), (-0.28, -0.22, 1.69)],
        [(0, -0.30, 1.46), (0.15, -0.28, 1.57), (0.29, -0.21, 1.68)],
        [(0, -0.30, 1.46), (-0.08, -0.28, 1.31), (-0.20, -0.23, 1.20)],
        [(0, -0.30, 1.46), (0.11, -0.28, 1.30), (0.19, -0.23, 1.18)],
    ]
    for idx, cpts in enumerate(crack_paths):
        add_tube(f'chest magma crack {idx}', cpts, [0.024, 0.018, 0.009], magma_mat, torso, sides=4,
                 color_fn=lambda c, n, i: mix_linear('#ff5114', '#ffc845', max(0, min(1, (c.z - 1.2) / 0.5))),
                 base_hex='#ff731c')
    add_crystal('ravager magma core', (0, -0.31, 1.46), 0.082, 0.15, magma_mat, torso, sides=5, base_hex='#ff962e')

    cape = add_joint(joints, 'cape', (0, 0.16, 1.74), torso, 'cape')
    add_fur_collar('ravager fur mantle', cape, mats, (0, 0.04, 0.02), 0.44, 0.24, count=16,
                   spike_len=0.28, spike_r=0.11, color_top='#47373a', color_tip='#241b1e', droop=0.55)
    add_tattered_cape('ravager pelt', cape, mats, top=(0, 0.06, -0.02), length=1.18,
                      width=(0.42, 0.68), flare=0.30, base_hex='#3d2e32', trim_hex='#5c4c48', dark_hex='#21181b')

    add_box('ravager belt', (0, -0.02, 1.06), (0.68, 0.50, 0.14), iron_mat, torso, bevel=0.022, base_hex='#2c3038')
    add_box('ravager loincloth', (0, -0.26, 0.80), (0.30, 0.07, 0.42), cloth_mat, torso, bevel=0.015,
            rot=(-0.15, 0, 0), deform_fn=lambda p: (p.x * (0.75 if p.z < 0 else 1.0), p.y, p.z), base_hex='#7a2424')
    for sign in (-1, 1):
        add_box(f'ravager hip plate {sign}', (sign * 0.26, -0.16, 0.90), (0.20, 0.26, 0.26),
                iron_mat, torso, bevel=0.022, rot=(-0.1, sign * 0.2, 0), base_hex='#393e47')

    head = add_joint(joints, 'head', (0, -0.04, 1.88), torso, 'head')
    add_box('ravager helm', (0, 0, 0.12), (0.38, 0.36, 0.40), iron_mat, head, bevel=0.06,
            deform_fn=lambda p: (p.x * (0.82 if p.z > 0.1 else 1.0), p.y, p.z), base_hex='#323640')
    add_box('ravager visor', (0, -0.18, 0.10), (0.28, 0.08, 0.15), dark_mat, head, bevel=0.012, base_hex='#121014')
    add_box('ravager nasal bar', (0, -0.22, 0.10), (0.055, 0.04, 0.20), iron_mat, head, bevel=0.01, base_hex='#494e59')
    for sign in (-1, 1):
        add_tube(f'ravager bull horn {sign}',
                 [(sign * 0.18, -0.02, 0.20), (sign * 0.38, -0.04, 0.30), (sign * 0.40, -0.08, 0.50)],
                 [0.075, 0.052, 0.008], horn_mat, head, sides=6,
                 color_fn=lambda c, n, i: mix_linear('#453d38', '#aba090', max(0, min(1, (c.z - 0.18) / 0.35))),
                 base_hex='#82786d')
    add_eye_pair(head, mats, z=0.11, y=-0.20, spread=0.085, radius=0.046,
                 iris_color='#ff7e29', dark_color='#180c08', glow_iris=True,
                 socket_color=None, shine_glow=1.22,
                 brow_color='#2c3038', fierce=0.65, eye_yaw=0.15, squash_y=0.65)

    # Angular spiked iron pauldrons & huge double-headed cracked magma battleaxe oriented toward camera
    for sign, jname, role in [(-1, 'arm_left', 'armL'), (1, 'arm_right', 'armR')]:
        arm = add_joint(joints, jname, (sign * 0.50, -0.02, 1.66), torso, role)
        add_box(f'{jname}_pauldron', (sign * 0.05, 0, 0.03), (0.38, 0.36, 0.30), iron_mat, arm,
                bevel=0.05, rot=(0, sign * 0.22, 0), base_hex='#3d424d')
        for j, (sx, sy, sz, rot_y) in enumerate([(0.06, -0.04, 0.22, 0.25), (0.18, 0.0, 0.18, 0.65), (0.26, 0.04, 0.10, 1.05)]):
            add_cone(f'{jname}_spike_{j}', (sign * sx, sy, sz), 0.055, 0.004, 0.22, steel_mat, arm,
                     sides=5, rot=(0, sign * rot_y, 0), base_hex='#737982')
        add_tube(f'{jname}_upper', [(0, 0, -0.04), (0, 0, -0.32)], [0.145, 0.13], dark_mat, arm, sides=8, base_hex='#27262b')
        add_tube(f'{jname}_bracer', [(0, 0, -0.32), (0, -0.02, -0.60)], [0.15, 0.13], iron_mat, arm, sides=8, base_hex='#393e47')
        add_icosphere(f'{jname}_fist', (0, -0.02, -0.65), (0.115, 0.115, 0.12), dark_mat, arm, subdiv=1, base_hex='#232228')

        if sign > 0:
            weapon = bpy.data.objects.new('weapon', None)
            bpy.context.collection.objects.link(weapon)
            weapon.parent = arm
            weapon.location = (0, 0, -0.64)
            # Tilt battleaxe so broad crescent blades show clearly to both hero and 3/4 camera
            weapon.rotation_euler = (1.98, 0.72, 0.0)
            add_tube('axe haft', [(0, 0, -0.28), (0, 0, 1.25)], [0.045, 0.048],
                     mats.solid('axe wood', '#452c22', rough=0.82), weapon, sides=7, base_hex='#452c22')
            add_icosphere('axe pommel', (0, 0, -0.31), (0.075, 0.075, 0.075), iron_mat, weapon, subdiv=1, base_hex='#494e59')
            for bsign in (-1, 1):
                add_box(f'axe blade {bsign}', (bsign * 0.24, 0, 0.96), (0.38, 0.075, 0.46), iron_mat, weapon,
                        bevel=0.020, rot=(0, bsign * 0.18, 0),
                        deform_fn=lambda p, bs=bsign: (p.x, p.y * (0.25 if p.x * bs > 0.08 else 1.0), p.z * (1.30 if p.x * bs > 0.04 else 0.68)),
                        base_hex='#464b57')
                for side_y in (-1, 1):
                    add_tube(f'axe crack {bsign}_{side_y}',
                             [(bsign * 0.08, side_y * 0.038, 0.96), (bsign * 0.22, side_y * 0.032, 1.04), (bsign * 0.30, side_y * 0.022, 0.92)],
                             [0.020, 0.015, 0.008], magma_mat, weapon, sides=4, base_hex='#ff731c')
            add_crystal('axe magma core', (0, 0, 0.96), 0.085, 0.18, magma_mat, weapon, sides=5, base_hex='#ff8c2e')

        arm.rotation_euler.x = -0.48 if sign > 0 else -0.22
        arm.rotation_euler.y = sign * -0.34 if sign > 0 else sign * -0.14

    _build_armored_legs(root, joints, iron_mat, dark_mat, iron_mat, dark_mat,
                        hip_x=0.22, hip_z=0.98, leg_scale=1.02)
    root.scale = (1.14, 1.14, 1.14)


def build_boss(root, joints):
    """Twilight Gatekeeper final boss: towering regal emerald-and-gold armored king with crown, sculpted bearded visage, crimson cape, and twilight greatsword."""
    mats = MatLibrary()
    emerald_mat = mats.vcol('boss emerald armor', metal=0.35, rough=0.42)
    gold_mat = mats.metal('boss royal gold', '#dfb24e', metal=0.84, rough=0.24)
    crimson_mat = mats.vcol('boss crimson cloth', rough=0.84, double_sided=True)
    skin_mat = mats.vcol('boss pale skin', rough=0.68)
    hair_mat = mats.vcol('boss silver hair', rough=0.78)
    dark_mat = mats.vcol('boss dark steel', metal=0.45, rough=0.52)
    glow_mat = mats.vcol_glow('boss twilight glow', glow=0.58, rough=0.18)

    torso = add_joint(joints, 'torso', (0, 0, 0), root, 'torso')

    add_tube('boss chest', [(0, 0, 1.05), (0, -0.01, 1.40), (0, -0.02, 1.72)],
             [(0.28, 0.20), (0.37, 0.24), (0.38, 0.24)],
             emerald_mat, torso, sides=10,
             color_fn=lambda c, n, i: mix_linear('#234231', '#3d6e4f', max(0, min(1, (c.z - 1.0) / 0.72))),
             base_hex='#315941')
    for sign in (-1, 1):
        add_tube(f'boss chest filigree {sign}',
                 [(0, -0.25, 1.38), (sign * 0.16, -0.24, 1.54), (sign * 0.26, -0.19, 1.66)],
                 [0.024, 0.020, 0.016], gold_mat, torso, sides=5, base_hex='#dfb24e')
    add_crystal('boss sigil bezel', (0, -0.27, 1.50), 0.10, 0.18, gold_mat, torso, sides=4, base_hex='#dfb24e')
    add_crystal('boss twilight sigil', (0, -0.29, 1.50), 0.068, 0.13, glow_mat, torso, sides=4, base_hex='#ffbf48')

    add_box('boss royal belt', (0, -0.01, 1.05), (0.62, 0.44, 0.11), gold_mat, torso, bevel=0.018, base_hex='#dfb24e')
    add_box('boss inner robe', (0, -0.02, 0.65), (0.30, 0.24, 0.72), crimson_mat, torso, bevel=0.02,
            deform_fn=lambda p: (p.x * (1.24 if p.z < 0 else 0.9), p.y * (1.10 if p.z < 0 else 0.9), p.z),
            base_hex='#731d29')
    for sign in (-1, 1):
        add_box(f'boss coat flap {sign}', (sign * 0.22, -0.13, 0.68), (0.22, 0.10, 0.70), emerald_mat, torso,
                bevel=0.018, rot=(-0.12, sign * -0.14, sign * 0.10),
                deform_fn=lambda p: (p.x * (1.16 if p.z < 0 else 0.92), p.y, p.z), base_hex='#2f563e')
        add_tube(f'boss coat gold edge {sign}',
                 [(sign * 0.12, -0.21, 1.00), (sign * 0.15, -0.24, 0.66), (sign * 0.20, -0.26, 0.36)],
                 [0.018, 0.018, 0.016], gold_mat, torso, sides=4, base_hex='#dfb24e')

    cape = add_joint(joints, 'cape', (0, 0.15, 1.72), torso, 'cape')
    add_fur_collar('boss fur mantle', cape, mats, (0, 0.02, 0.04), 0.42, 0.22, count=14,
                   spike_len=0.22, spike_r=0.09, color_top='#ddd7cb', color_tip='#a8a196', droop=0.40)
    add_tattered_cape('boss royal cape', cape, mats, top=(0, 0.04, 0.0), length=1.42,
                      width=(0.40, 0.76), flare=0.38, base_hex='#8a1f2c', trim_hex='#dfb24e', dark_hex='#4d0e16')

    # Sovereign Twilight King Visage: dark brow recess, stern sculpted nose & cheekbones, silver beard, 7-point crown
    head = add_joint(joints, 'head', (0, -0.02, 1.86), torso, 'head')
    add_icosphere('boss skull', (0, 0, 0.11), (0.19, 0.18, 0.22), skin_mat, head, subdiv=2,
                  color_fn=lambda c, n, i: mix_linear('#4a3d40', '#cbb9a6', max(0, min(1, (0.18 - c.z) / 0.22 if c.y < -0.05 else 0.7))),
                  base_hex='#bfae9c')
    # Sculpted nose bridge & stern cheekbones
    add_box('boss nose', (0, -0.19, 0.07), (0.040, 0.045, 0.085), skin_mat, head, bevel=0.01, base_hex='#cbb9a6')
    # Flowing broad silver beard + side mustache tufts + silver locks
    add_cone('boss beard', (0, -0.13, -0.06), 0.16, 0.030, 0.32, hair_mat, head, sides=7,
             deform_fn=lambda p: (p.x * 1.05, p.y * 0.58, p.z),
             rot=(math.pi * 0.94, 0, 0),
             color_fn=lambda c, n, i: mix_linear('#b2aca2', '#ebe6dc', max(0, min(1, (c.z + 0.14) / 0.28))),
             base_hex='#dcd6ca')
    for sign in (-1, 1):
        add_rod(f'boss mustache {sign}', (0, -0.19, 0.03), (sign * 0.15, -0.16, -0.04),
                0.042, hair_mat, head, taper=0.2, sides=5, base_hex='#e6e0d4')
        add_tube(f'boss hair lock {sign}',
                 [(sign * 0.16, 0.0, 0.15), (sign * 0.22, 0.04, -0.02), (sign * 0.20, 0.09, -0.20)],
                 [0.072, 0.062, 0.022], hair_mat, head, sides=6, base_hex='#dcd6ca')
    add_icosphere('boss hair back', (0, 0.08, 0.10), (0.21, 0.17, 0.20), hair_mat, head, subdiv=1, base_hex='#d4cec2')

    add_tube('boss crown band', [(math.cos(k * math.tau / 10) * 0.19, math.sin(k * math.tau / 10) * 0.18, 0.24) for k in range(11)],
             0.042, gold_mat, head, sides=5, caps=(False, False), base_hex='#dfb24e')
    for i in range(7):
        a = i * math.tau / 7 - math.pi / 2
        spire_h = 0.24 if i == 0 else (0.18 if i in (1, 6) else 0.15)
        add_cone(f'crown point {i}', (math.cos(a) * 0.18, math.sin(a) * 0.17, 0.27 + spire_h * 0.45),
                 0.046, 0.004, spire_h, gold_mat, head, sides=5, base_hex='#dfb24e')
    add_crystal('crown jewel', (0, -0.20, 0.27), 0.048, 0.095, glow_mat, head, sides=4, base_hex='#ffae38')

    add_eye_pair(head, mats, z=0.12, y=-0.165, spread=0.072, radius=0.036,
                 iris_color='#ffc947', dark_color='#1e1610', glow_iris=True,
                 socket_color='#2a2024', shine_glow=0.95,
                 brow_color='#e3ddd2', fierce=0.55, eye_yaw=0.16, squash_y=0.58)

    # Angular layered emerald-and-gold royal shoulder pauldrons & angled sword arm
    for sign, jname, role in [(-1, 'arm_left', 'armL'), (1, 'arm_right', 'armR')]:
        arm = add_joint(joints, jname, (sign * 0.42, 0, 1.66), torso, role)
        add_box(f'{jname}_pauldron', (sign * 0.04, 0, 0.02), (0.34, 0.34, 0.26), emerald_mat, arm,
                bevel=0.045, rot=(0, sign * 0.22, 0), base_hex='#315941')
        add_box(f'{jname}_pauldron_rim', (sign * 0.06, 0, -0.05), (0.36, 0.36, 0.06), gold_mat, arm,
                bevel=0.012, rot=(0, sign * 0.22, 0), base_hex='#dfb24e')
        add_tube(f'{jname}_upper', [(0, 0, -0.04), (0, 0, -0.32)], [0.11, 0.10], dark_mat, arm, sides=8, base_hex='#2a3430')
        add_tube(f'{jname}_bracer', [(0, 0, -0.32), (0, -0.01, -0.58)], [0.125, 0.105], emerald_mat, arm, sides=8, base_hex='#315941')
        add_box(f'{jname}_bracer_trim', (0, -0.10, -0.44), (0.11, 0.03, 0.18), gold_mat, arm, bevel=0.008, base_hex='#dfb24e')
        add_icosphere(f'{jname}_fist', (0, -0.02, -0.62), (0.095, 0.095, 0.105), dark_mat, arm, subdiv=1, base_hex='#282e2c')
        if sign > 0:
            _build_sword(arm, mats, length=1.22, width=0.105, steel_hex='#bccbd0', trim_hex='#dfb24e',
                         glow_hex='#ffbf48', notched=False, hand_z=-0.60)
        arm.rotation_euler.x = -0.46 if sign > 0 else -0.18
        arm.rotation_euler.y = sign * -0.34 if sign > 0 else sign * -0.12

    _build_armored_legs(root, joints, emerald_mat, dark_mat, gold_mat, dark_mat,
                        hip_x=0.19, hip_z=0.98, leg_scale=1.02)
    root.scale = (1.18, 1.18, 1.18)
