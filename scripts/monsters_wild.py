"""Sculpted low-poly beast & creature monster builders: crawler, bat, slime, mushroom, scarab, hound."""
import math
import bmesh
from mathutils import Vector
from mesh_sculpt import (
    MatLibrary, add_box, add_claw_paw, add_cone, add_crystal, add_eye_pair,
    add_fern_sprig, add_fur_collar, add_icosphere, add_joint, add_leaf,
    add_mini_mushroom, add_rod, add_tube, finalize_bmesh, hex_to_linear, mix_linear,
)


def build_crawler(root, joints):
    """Mossy forest tortoise crawler matching the stylized low-poly reference."""
    mats = MatLibrary()
    body_mat = mats.vcol('crawler body', rough=0.74)
    shell_mat = mats.vcol('crawler shell', rough=0.72)
    moss_mat = mats.vcol('crawler moss', rough=0.84)
    leaf_mat = mats.vcol('crawler leaf', rough=0.68, double_sided=True)
    horn_mat = mats.solid('crawler horn', '#dfd2b4', rough=0.42)
    mush_stem = mats.vcol('crawler mush stem', rough=0.75)
    # Keep glow < 1.2 so mushrooms glow warm golden-amber without blowing out to solid white
    mush_cap = mats.vcol_glow('crawler mush cap', glow=0.45, rough=0.32)

    body = add_joint(joints, 'body', (0, 0, 0), root, 'beast_body')

    def torso_deform(p):
        z = p.z * (0.72 if p.z < 0 else 1.0)
        flare = 1.0 + 0.08 * math.sin(p.y * math.pi)
        return (p.x * flare, p.y, z)

    def torso_color(c, n, i):
        t_z = max(0.0, min(1.0, (c.z - 0.25) / 0.55))
        base = mix_linear('#2b4730', '#4d7a47', t_z)
        if 0.42 < c.z < 0.62 and abs(c.x) > 0.34 and (i % 7 == 0):
            return mix_linear('#4d7a47', '#94b855', 0.65)
        return base

    add_icosphere('crawler torso', (0, 0.08, 0.54), (0.48, 0.68, 0.34), body_mat, body,
                  subdiv=2, deform_fn=torso_deform, color_fn=torso_color, base_hex='#497445')

    # Drooping mossy overhang skirt under the shell rim
    moss_rim_count = 14
    for i in range(moss_rim_count):
        a = i * math.tau / moss_rim_count
        rx = math.cos(a) * 0.44
        ry = math.sin(a) * 0.58 + 0.08
        rz = 0.72 - 0.04 * (i % 2)
        drip = 0.11 + (i % 3) * 0.03
        add_icosphere(f'moss drip {i}', (rx, ry, rz), (0.14, 0.14, drip), moss_mat, body,
                      subdiv=1, deform_fn=lambda p: (p.x, p.y, p.z * (1.25 if p.z < 0 else 0.75)),
                      color_fn=lambda c, n, idx, k=i: mix_linear('#578839', '#83b544', (k % 3) * 0.35),
                      base_hex='#6fa140')

    # Segmented striped melon-like shell lobes arranged around the back
    lobe_count = 10
    for i in range(lobe_count):
        a = i * math.tau / lobe_count + 0.15
        lx = math.sin(a) * 0.28
        ly = math.cos(a) * 0.41 + 0.08
        lz = 0.85 + 0.02 * math.cos(i * 1.7)
        warm = (i % 3 != 0)
        main_hex = '#b6c554' if (i % 2 == 0) else ('#8dae53' if warm else '#709862')
        stripe_hex = '#e3eb96' if warm else '#a4cca0'

        def lobe_color(c, n, idx, mh=main_hex, sh=stripe_hex, ang=a):
            proj = c.x * math.cos(ang + 0.4) - c.y * math.sin(ang + 0.4)
            band = math.sin(proj * 36.0 + c.z * 8.0)
            if band > 0.26:
                return hex_to_linear(sh)
            return mix_linear('#5a7a42', mh, max(0.0, min(1.0, (c.z + 0.15) / 0.30)))

        add_icosphere(f'shell lobe {i}', (lx, ly, lz), (0.22, 0.25, 0.18), shell_mat, body,
                      subdiv=2, rot=(0.15 * math.cos(a), -0.15 * math.sin(a), -a),
                      deform_fn=lambda p: (p.x * (1.0 - 0.15 * abs(p.z)), p.y, p.z * (0.7 if p.z < 0 else 1.08)),
                      color_fn=lobe_color, base_hex=main_hex, jitter=0.03)
        if i % 2 == 0:
            sx = math.sin(a) * 0.45
            sy = math.cos(a) * 0.58 + 0.08
            add_cone(f'shell thorn {i}', (sx, sy, 0.88), 0.028, 0.002, 0.10, horn_mat, body,
                     sides=5, rot=(math.cos(a) * -1.0, math.sin(a) * 1.0, 0))

    # Central mossy garden mound on top of shell
    for i in range(5):
        a = i * math.tau / 5 + 0.4
        r = 0.10 if i else 0.0
        add_icosphere(f'shell moss mound {i}', (math.sin(a) * r, math.cos(a) * r + 0.08, 0.98 + (0.04 if i == 0 else 0)),
                      (0.22, 0.27, 0.11), moss_mat, body, subdiv=2,
                      color_fn=lambda c, n, idx: mix_linear('#5e9236', '#92c44a', max(0, min(1, (c.z + 0.05) / 0.14))),
                      base_hex='#77ad40')

    # Warm golden glowing little mushrooms on the mossy back
    mush_specs = [
        ((-0.09, -0.04, 1.03), 0.56, (0.12, -0.15, 0.2)),
        ((0.04, 0.06, 1.05), 0.42, (-0.1, 0.18, -0.4)),
        ((0.16, -0.02, 1.01), 0.46, (0.15, 0.22, 0.5)),
        ((-0.18, 0.16, 0.99), 0.36, (-0.18, -0.1, 0.1)),
        ((0.12, 0.22, 0.99), 0.38, (-0.14, 0.16, 0.8)),
    ]
    for idx, (loc, sc, rot) in enumerate(mush_specs):
        add_mini_mushroom(f'back mushroom {idx}', loc, sc, rot, mush_stem, mush_cap, body,
                          stem_hex='#e3d4ad', cap_hex='#ffcc54', cap_rim_hex='#d98226')

    # Botanical leafy sprigs and ferns growing from the shell top
    fern_specs = [
        ((-0.02, 0.20, 1.03), (0.05, 0.30, 1.0), 0.22),
        ((0.14, 0.12, 1.02), (0.45, 0.15, 0.9), 0.20),
        ((-0.17, 0.05, 1.01), (-0.42, 0.2, 0.88), 0.19),
        ((0.02, -0.14, 1.01), (-0.12, -0.2, 0.95), 0.18),
    ]
    for idx, (ori, direction, length) in enumerate(fern_specs):
        add_fern_sprig(f'shell fern {idx}', ori, direction, length, leaf_mat, body, leaflets=3,
                       color_fn=lambda c, n, i: mix_linear('#689941', '#a5c758', 0.45),
                       base_hex='#7eab48')

    # Tail spikes on back rump
    for tz, angle in [(0.52, 0.95), (0.40, 1.25), (0.63, 0.72)]:
        add_cone('rump spike', (0, 0.73, tz), 0.048, 0.003, 0.17, body_mat, body, sides=5,
                 rot=(-angle, 0, 0), base_hex='#375b39')

    # Expressive cute head with bulbous snout, tusks, horns, moss sprout, and pure glossy starry eyes
    head = add_joint(joints, 'head', (0, -0.52, 0.56), root, 'head')

    add_icosphere('crawler skull', (0, -0.14, 0.05), (0.29, 0.31, 0.25), body_mat, head,
                  subdiv=2, deform_fn=lambda p: (p.x * (1.06 if p.y < 0 else 0.94), p.y, p.z * (0.85 if p.z < 0 else 1.02)),
                  color_fn=lambda c, n, i: mix_linear('#3d6641', '#5c8c53', max(0, min(1, (c.z + 0.2) / 0.45))),
                  base_hex='#4f7e49')

    add_icosphere('crawler snout', (0, -0.39, -0.02), (0.20, 0.18, 0.14), body_mat, head,
                  subdiv=2, deform_fn=lambda p: (p.x, p.y, max(-0.7, p.z)),
                  color_fn=lambda c, n, i: mix_linear('#4a774b', '#6d9b61', max(0, min(1, (c.z + 0.1) / 0.22))),
                  base_hex='#5d8d55')

    for sign in (-1, 1):
        add_tube(f'tusk {sign}',
                 [(sign * 0.12, -0.45, -0.04), (sign * 0.135, -0.49, -0.13), (sign * 0.11, -0.47, -0.22)],
                 [0.036, 0.024, 0.004], horn_mat, head, sides=6, base_hex='#e6dac0')

    # Big glossy dark eyes with crisp golden-white catchlights (matching reference image)
    add_eye_pair(head, mats, z=0.09, y=-0.34, spread=0.19, radius=0.105,
                 iris_color='#e8b146', dark_color='#110e18', glow_iris=False,
                 show_iris_front=False, socket_color=None, shine_glow=1.35,
                 brow_color=None, eye_yaw=0.38, squash_y=0.95)

    for sign in (-1, 1):
        add_leaf(f'leaf brow {sign}', (sign * 0.13, -0.34, 0.19), (sign * 0.65, -0.45, 0.45),
                 0.16, 0.10, 0.04, leaf_mat, head, base_hex='#5d9440')
        add_cone(f'head ear {sign}', (sign * 0.22, -0.06, 0.22), 0.048, 0.004, 0.18, body_mat, head,
                 sides=5, rot=(0.25, sign * 0.55, 0), base_hex='#497445')
        add_cone(f'head horn {sign}', (sign * 0.11, -0.04, 0.27), 0.036, 0.003, 0.15, horn_mat, head,
                 sides=5, rot=(-0.2, sign * 0.28, 0), base_hex='#dfd2b4')
    add_icosphere('head moss', (0, -0.11, 0.27), (0.14, 0.14, 0.065), moss_mat, head, subdiv=1, base_hex='#77ad40')
    add_tube('head sprout stem', [(0, -0.11, 0.30), (0, -0.13, 0.42)], [0.014, 0.010], leaf_mat, head, sides=5, base_hex='#76aa42')
    for sign in (-1, 1):
        add_leaf(f'sprout leaf {sign}', (0, -0.13, 0.41), (sign * 0.75, -0.25, 0.55),
                 0.14, 0.075, 0.03, leaf_mat, head, base_hex='#8dc44b')

    leg_coords = [
        ('leg_0', -0.34, -0.28, 'legFL'),
        ('leg_1', 0.34, -0.28, 'legFR'),
        ('leg_2', -0.35, 0.36, 'legBL'),
        ('leg_3', 0.35, 0.36, 'legBR'),
    ]
    for name, lx, ly, role in leg_coords:
        sign = -1 if lx < 0 else 1
        leg = add_joint(joints, name, (lx, ly, 0.46), root, role)
        add_tube(f'{name}_limb',
                 [(0, 0, 0.03), (sign * 0.07, -0.02, -0.18), (sign * 0.09, -0.06, -0.38)],
                 [(0.13, 0.13), (0.10, 0.10), (0.11, 0.11)],
                 body_mat, leg, sides=7,
                 color_fn=lambda c, n, idx: mix_linear('#335435', '#4f7d4b', max(0, min(1, (c.z + 0.40) / 0.45))),
                 base_hex='#446e43')
        for sz in (-0.10, -0.21):
            add_cone(f'{name}_spike_{sz}', (sign * 0.16, -0.02, sz), 0.036, 0.003, 0.10, body_mat, leg,
                     sides=5, rot=(0.15, sign * 1.25, 0), base_hex='#2f5031')
        vine_pts = [(sign * 0.09 + math.cos(k * math.tau / 8) * 0.115,
                     -0.06 + math.sin(k * math.tau / 8) * 0.115,
                     -0.31 + (k % 2) * 0.015) for k in range(9)]
        add_tube(f'{name}_vine', vine_pts, 0.022, leaf_mat, leg, sides=5, caps=(False, False), base_hex='#8cb34c')
        for l_ang, l_len in [(-0.4, 0.16), (0.2, 0.14)]:
            add_leaf(f'{name}_leaf_{l_ang}', (sign * 0.10, -0.14, -0.31),
                     (sign * (0.35 + l_ang * 0.3), -0.45, 0.85),
                     l_len, l_len * 0.48, 0.03, leaf_mat, leg, base_hex='#6fa344')
        add_claw_paw(leg, mats, (sign * 0.10, -0.14, -0.405), paw_scale=(0.14, 0.18, 0.075),
                     body_hex='#467045', dark_hex='#2f4e31', claw_hex='#e3d6b8', toes=3)


def build_bat(root, joints):
    """Glass-winged bat with fluffy ruff, big ruby eyes, and stained-glass wings."""
    mats = MatLibrary()
    fur_mat = mats.vcol('bat fur', rough=0.82)
    skin_mat = mats.vcol('bat wing frame', rough=0.65)
    glass_mat = mats.vcol_glow('bat glass wing', glow=0.32, rough=0.14, alpha=0.84, double_sided=True)
    claw_mat = mats.solid('bat claw', '#e8dec8', rough=0.4)
    nose_mat = mats.detail('bat nose detail', '#a85f85', rough=0.55)

    body = add_joint(joints, 'body', (0, 0, 0.55), root, 'spirit')

    add_icosphere('bat body', (0, 0, 0.52), (0.21, 0.19, 0.29), fur_mat, body, subdiv=2,
                  deform_fn=lambda p: (p.x * (1.0 - 0.15 * max(0, p.z)), p.y, p.z),
                  color_fn=lambda c, n, i: mix_linear('#33264a', '#59457a', max(0, min(1, (c.z + 0.25) / 0.55))),
                  base_hex='#483866')
    add_fur_collar('bat ruff', body, mats, (0, -0.02, 0.72), 0.21, 0.18, count=14,
                   spike_len=0.14, spike_r=0.065, color_top='#73589c', color_tip='#483768', droop=0.35)
    for sign in (-1, 1):
        add_tube(f'bat leg {sign}', [(sign * 0.08, 0.0, 0.28), (sign * 0.10, -0.04, 0.15)],
                 [0.036, 0.026], skin_mat, body, sides=6, base_hex='#392a52')
        for toe in (-1, 0, 1):
            add_cone(f'bat foot claw {sign}_{toe}', (sign * 0.10 + toe * 0.02, -0.07, 0.13),
                     0.012, 0.002, 0.055, claw_mat, body, sides=5, rot=(math.pi * 0.65, 0, 0))
    add_cone('bat tail', (0, 0.16, 0.26), 0.045, 0.004, 0.18, fur_mat, body, sides=5,
             rot=(math.pi * 0.75, 0, 0), base_hex='#34274c')

    head = add_joint(joints, 'head', (0, -0.03, 0.86), body, 'head')
    add_icosphere('bat skull', (0, -0.02, 0.06), (0.24, 0.21, 0.21), fur_mat, head, subdiv=2,
                  color_fn=lambda c, n, i: mix_linear('#3f3059', '#66508a', max(0, min(1, (c.z + 0.2) / 0.4))),
                  base_hex='#554275')
    add_icosphere('bat snout', (0, -0.22, 0.0), (0.095, 0.085, 0.068), fur_mat, head, subdiv=1,
                  color_fn=lambda c, n, i: hex_to_linear('#785585'), base_hex='#785585')
    for sign in (-1, 1):
        add_icosphere(f'nostril {sign}', (sign * 0.028, -0.295, 0.015), (0.014, 0.012, 0.014), nose_mat, head, subdiv=1)
        add_cone(f'bat fang {sign}', (sign * 0.048, -0.24, -0.055), 0.016, 0.002, 0.055,
                 mats.detail('bat fang detail', '#f7f1e3', rough=0.3), head, sides=5, rot=(math.pi, 0, 0))
        add_cone(f'bat ear {sign}', (sign * 0.16, 0.0, 0.27), 0.115, 0.008, 0.34, fur_mat, head,
                 sides=6, deform_fn=lambda p: (p.x * 0.9, p.y * 0.52, p.z),
                 rot=(0.12, sign * 0.22, sign * 0.15), base_hex='#4c3a69')
        add_cone(f'bat inner ear {sign}', (sign * 0.16, -0.032, 0.25), 0.072, 0.005, 0.23,
                 mats.detail('inner ear detail', '#946ca6', rough=0.7), head,
                 sides=5, deform_fn=lambda p: (p.x * 0.85, p.y * 0.35, p.z),
                 rot=(0.12, sign * 0.22, sign * 0.15))

    # Glossy dark ruby eyes with crisp crimson glow and bright catchlights
    add_eye_pair(head, mats, z=0.075, y=-0.19, spread=0.115, radius=0.072,
                 iris_color='#ff386e', dark_color='#180c24', glow_iris=True,
                 socket_color=None, shine_glow=1.35,
                 brow_color='#433261', fierce=0.22, eye_yaw=0.24)

    for sign, jname, role in [(-1, 'wing_left', 'wingL'), (1, 'wing_right', 'wingR')]:
        wing = add_joint(joints, jname, (sign * 0.16, 0.02, 0.72), body, role)
        wing.rotation_euler.z = sign * -0.18
        shoulder = Vector((0, 0, 0))
        elbow = Vector((sign * 0.26, 0.04, 0.16))
        wrist = Vector((sign * 0.52, 0.01, 0.36))
        tip = Vector((sign * 1.05, 0.08, 0.56))
        f1 = Vector((sign * 0.96, 0.06, 0.14))
        f2 = Vector((sign * 0.74, 0.04, -0.14))
        f3 = Vector((sign * 0.46, 0.02, -0.28))
        rib_mid = Vector((sign * 0.22, 0.02, -0.22))

        add_tube('wing arm', [shoulder, elbow, wrist, tip], [0.042, 0.034, 0.030, 0.012],
                 skin_mat, wing, sides=6, base_hex='#3b2c54')
        add_cone('wing thumb claw', wrist + Vector((0, -0.02, 0.06)), 0.022, 0.002, 0.085,
                 claw_mat, wing, sides=5, rot=(-0.4, sign * 0.3, 0))
        for fname, target in [('f1', f1), ('f2', f2), ('f3', f3)]:
            add_rod(f'wing strut {fname}', wrist, target, 0.020, skin_mat, wing, taper=0.45, sides=6, base_hex='#3b2c54')

        bm = bmesh.new()
        pts = [shoulder, elbow, wrist, tip, f1, f2, f3, rib_mid,
               (wrist + f1) * 0.52 + Vector((0, -0.02, 0)),
               (wrist + f2) * 0.52 + Vector((0, -0.02, 0)),
               (elbow + f3) * 0.50 + Vector((0, -0.02, 0))]
        v = [bm.verts.new(p) for p in pts]
        tris = [
            (2, 3, 8), (3, 4, 8), (2, 8, 9), (8, 4, 9), (4, 5, 9),
            (2, 9, 10), (9, 5, 6), (9, 6, 10), (1, 2, 10),
            (1, 10, 6), (1, 6, 7), (0, 1, 7),
        ]
        for tri in tris:
            bm.faces.new([v[k] for k in tri])

        def glass_color(c, n, idx):
            dist = min(1.0, abs(c.x) / 1.02)
            if idx % 3 == 0:
                return mix_linear('#8c6cf2', '#5ae6ff', dist)
            elif idx % 3 == 1:
                return mix_linear('#c76cf2', '#64f0e8', dist)
            return mix_linear('#7894ff', '#8ef7ff', dist)

        finalize_bmesh('stained glass wing', bm, glass_mat, wing, smooth=False,
                       color_fn=glass_color, base_hex='#6ae4ff', jitter=0.08)


def build_slime(root, joints):
    """Jade faceted jelly slime with melted puddle skirt, glossy eyes, and prominent emerald crystal core."""
    mats = MatLibrary()
    body_mat = mats.vcol('slime jade', rough=0.20)
    crystal_mat = mats.vcol_glow('slime crystal', glow=0.30, rough=0.16)
    bubble_mat = mats.vcol_glow('slime bubble', glow=0.28, rough=0.15)

    body = add_joint(joints, 'body', (0, 0, 0), root, 'slime')

    def slime_deform(p):
        ang = math.atan2(p.y, p.x)
        wobble = 1.0 + 0.15 * math.sin(ang * 5.0) + 0.08 * math.cos(ang * 3.0 + 1.0)
        if p.z < -0.55:
            return (p.x * 1.20 * wobble, p.y * 1.20 * wobble, -0.55)
        skirt = max(0.0, (-0.08 - p.z) / 0.47) ** 1.5
        r_mul = 1.0 + skirt * 0.36 * wobble
        dome_rip = 1.0 + 0.045 * math.sin(p.z * 7.0 + ang * 3.0)
        return (p.x * r_mul * dome_rip, p.y * r_mul * dome_rip, p.z)

    def slime_color(c, n, idx):
        t_h = max(0.0, min(1.0, c.z / 0.95))
        rim = max(0.0, min(1.0, math.hypot(c.x, c.y) / 0.72))
        col = mix_linear('#166650', '#4ae39c', t_h * 0.75 + (1.0 - rim) * 0.25)
        dist_core = Vector((c.x - 0.14, c.y + 0.38, c.z - 0.56)).length
        if dist_core < 0.36:
            glow_t = (1.0 - dist_core / 0.36) * 0.75
            col = mix_linear('#4ae39c', '#b5ffd8', glow_t)
        return col

    add_icosphere('slime jelly dome', (0, 0, 0.34), (0.58, 0.54, 0.62), body_mat, body,
                  subdiv=3, deform_fn=slime_deform, color_fn=slime_color, base_hex='#34c484', jitter=0.05)

    for idx, (dx, dy, sx, sy) in enumerate([(-0.78, -0.32, 0.16, 0.14), (0.72, -0.36, 0.14, 0.12), (0.62, 0.45, 0.17, 0.14)]):
        add_icosphere(f'slime drop {idx}', (dx, dy, 0.04), (sx, sy, 0.055), body_mat, body,
                      subdiv=1, deform_fn=lambda p: (p.x, p.y, max(-0.5, p.z)),
                      color_fn=lambda c, n, i: hex_to_linear('#2ba876'), base_hex='#2ba876')

    # Prominent glowing faceted emerald crystal emerging clearly from upper front-left (camera side!)
    add_crystal('slime crystal core', (-0.06, -0.44, 0.58), 0.15, 0.40, crystal_mat, body,
                sides=5, rot=(0.55, 0.22, -0.2),
                color_fn=lambda c, n, i: mix_linear('#2ef08e', '#ccffe6', max(0, min(1, (c.z + 0.18) / 0.38))),
                base_hex='#6bffb3')
    add_crystal('slime side shard', (0.20, -0.38, 0.72), 0.085, 0.22, crystal_mat, body,
                sides=5, rot=(0.45, -0.30, 0.1), base_hex='#88ffc4')

    # Glowing surface & rim bubbles
    for idx, (bx, by, bz, br) in enumerate([
        (-0.36, -0.34, 0.62, 0.058), (0.34, -0.28, 0.72, 0.052),
        (-0.22, 0.18, 0.88, 0.054), (0.32, 0.20, 0.44, 0.062),
        (-0.48, -0.10, 0.36, 0.055),
    ]):
        add_icosphere(f'slime bubble {idx}', (bx, by, bz), (br, br, br), bubble_mat, body,
                      subdiv=1, base_hex='#94ffc9')

    head = add_joint(joints, 'head', (0, -0.22, 0.52), body, 'head')
    add_eye_pair(head, mats, z=-0.04, y=-0.27, spread=0.22, radius=0.090,
                 iris_color='#ffbe42', dark_color='#181410', glow_iris=True,
                 socket_color=None, shine_glow=1.30,
                 brow_color='#1a7a56', fierce=0.52, eye_yaw=0.24)


def build_mushroom(root, joints):
    """Star-spot mushroom creature with gnarled root feet, baby mushrooms, and glowing star spots."""
    mats = MatLibrary()
    root_mat = mats.vcol('mushroom root', rough=0.82)
    cap_mat = mats.vcol('mushroom cap', rough=0.68)
    gill_mat = mats.vcol('mushroom gills', rough=0.76)
    spot_mat = mats.vcol_glow('mushroom star spots', glow=0.44, rough=0.42)
    moss_mat = mats.vcol('mushroom moss', rough=0.85)

    body = add_joint(joints, 'body', (0, 0, 0), root, 'torso')

    def stalk_profile(ang, t):
        return 1.0 + 0.16 * math.sin(ang * 6.0 + t * 1.4)

    add_tube('gnarled stalk',
             [(0, 0.02, 0.06), (0.01, -0.01, 0.32), (-0.01, -0.02, 0.62), (0, 0, 0.95)],
             [(0.34, 0.34), (0.25, 0.24), (0.23, 0.22), (0.24, 0.23)],
             root_mat, body, sides=10, profile_fn=stalk_profile,
             color_fn=lambda c, n, i: mix_linear('#6c553b', '#bfa57c', max(0, min(1, c.z / 0.95))),
             base_hex='#9a7f5b')

    for idx, ang in enumerate([-2.55, -1.9, -1.25, -0.5, 0.2, 1.0, 2.2]):
        dx, dy = math.cos(ang), math.sin(ang)
        r_len = 0.44 if dy < 0 else 0.38
        add_tube(f'root foot {idx}',
                 [(dx * 0.16, dy * 0.16, 0.20), (dx * 0.31, dy * 0.31, 0.07), (dx * r_len, dy * r_len, 0.025)],
                 [0.095, 0.068, 0.028], root_mat, body, sides=6,
                 color_fn=lambda c, n, i: mix_linear('#5c4732', '#9b815c', max(0, min(1, c.z / 0.22))),
                 base_hex='#856c4b')

    for sign, jname, role in [(-1, 'arm_left', 'armL'), (1, 'arm_right', 'armR')]:
        arm = add_joint(joints, jname, (sign * 0.22, -0.04, 0.56), body, role)
        add_tube(f'{jname}_branch',
                 [(0, 0, 0), (sign * 0.14, -0.04, -0.10), (sign * 0.20, -0.10, -0.22)],
                 [0.072, 0.054, 0.030], root_mat, arm, sides=6, base_hex='#8f7553')

    for idx, (loc, sc, rot) in enumerate([
        ((-0.28, -0.22, 0.04), 0.52, (0.15, -0.2, 0.3)),
        ((0.26, -0.24, 0.04), 0.45, (0.2, 0.22, -0.4)),
        ((0.32, 0.12, 0.05), 0.38, (-0.1, 0.18, 0.8)),
    ]):
        add_mini_mushroom(f'baby mush {idx}', loc, sc, rot, root_mat, cap_mat, body,
                          stem_hex='#cfba94', cap_hex='#943862', cap_rim_hex='#5e1e3f')
    for idx, (mx, my) in enumerate([(-0.20, -0.26), (0.18, -0.27), (0.02, -0.29)]):
        add_icosphere(f'root moss {idx}', (mx, my, 0.06), (0.09, 0.08, 0.05), moss_mat, body, subdiv=1, base_hex='#63963f')

    add_eye_pair(body, mats, z=0.73, y=-0.24, spread=0.10, radius=0.062,
                 iris_color='#ffd666', dark_color='#1e1410', glow_iris=True,
                 socket_color=None, shine_glow=1.30,
                 brow_color='#665038', fierce=0.35, eye_yaw=0.16)

    head = add_joint(joints, 'head', (0, 0, 0.96), body, 'head')

    def cap_deform(p):
        ang = math.atan2(p.y, p.x)
        scallop = 1.0 + 0.065 * math.sin(ang * 7.0)
        if p.z < 0:
            return (p.x * scallop, p.y * scallop, p.z * 0.22)
        peak = 1.0 + 0.18 * (p.z ** 2)
        return (p.x * scallop * (1.0 - 0.1 * p.z), p.y * scallop * (1.0 - 0.1 * p.z), p.z * peak)

    def cap_color(c, n, idx):
        t_z = max(0.0, min(1.0, (c.z + 0.04) / 0.50))
        return mix_linear('#571c3c', '#9e3e6a', t_z)

    add_icosphere('mushroom cap', (0, 0, 0.14), (0.72, 0.66, 0.36), cap_mat, head,
                  subdiv=3, deform_fn=cap_deform, color_fn=cap_color, base_hex='#87315a', jitter=0.04)

    # Tucked fluted cream gills completely under cap rim
    add_cone('mushroom gills', (0, 0, 0.04), 0.55, 0.22, 0.10, gill_mat, head, sides=16,
             deform_fn=lambda p: (p.x * (1.0 + 0.06 * math.sin(math.atan2(p.y, p.x) * 16.0)), p.y, p.z),
             color_fn=lambda c, n, i: mix_linear('#b59c72', '#e8d7b2', max(0, min(1, math.hypot(c.x, c.y) / 0.55))),
             base_hex='#d6c29a')

    # Glowing 5-pointed star spots positioned cleanly ON the outer cap dome
    cap_obj = [o for o in head.children if o.name == 'mushroom cap'][0]
    star_angles = [
        (0.0, 0.34, 0.125), (-0.75, 0.42, 0.105), (0.75, 0.42, 0.110),
        (-1.45, 0.48, 0.095), (1.45, 0.48, 0.095), (-0.42, 0.16, 0.095),
        (0.55, 0.20, 0.090), (2.4, 0.44, 0.095), (-2.4, 0.44, 0.095),
    ]
    for idx, (theta, radial, sr) in enumerate(star_angles):
        # Compute point on cap ellipsoid (rx=0.72, ry=0.66, rz=0.36 centered at z=0.14)
        nx = math.sin(theta) * radial * 0.90
        ny = -math.cos(theta) * radial * 0.85
        u = math.sin(theta) * radial
        v = -math.cos(theta) * radial
        nz = math.sqrt(max(0.04, 1.0 - (u / 0.72) ** 2 - (v / 0.66) ** 2))
        sx, sy, sz = u, v, 0.14 + nz * 0.36 * (1.0 + 0.18 * nz * nz) + 0.015
        normal = Vector((u / (0.72 ** 2), v / (0.66 ** 2), nz / 0.36)).normalized()
        rot = normal.to_track_quat('Z', 'Y').to_euler()
        bm = bmesh.new()
        center_top = bm.verts.new((0, 0, 0.022))
        ring = []
        for k in range(10):
            r = sr if k % 2 == 0 else sr * 0.44
            ang = k * math.tau / 10
            ring.append(bm.verts.new((math.cos(ang) * r, math.sin(ang) * r, 0.0)))
        for k in range(10):
            nk = (k + 1) % 10
            bm.faces.new((ring[k], ring[nk], center_top))
        bmesh.ops.solidify(bm, geom=list(bm.faces), thickness=0.016)
        finalize_bmesh(f'cap star {idx}', bm, spot_mat, head, loc=(sx, sy, sz), rot=rot,
                       smooth=False, base_hex='#ffe99e', jitter=0.02)


def build_scarab(root, joints):
    """Royal bronze-and-emerald scarab beetle with raised gold filigree, cyan jewel, and 6 legs."""
    mats = MatLibrary()
    body_mat = mats.vcol('scarab bronze body', metal=0.45, rough=0.45)
    shell_mat = mats.vcol('scarab jade shell', metal=0.25, rough=0.28)
    gold_mat = mats.metal('scarab gold filigree', '#d6a94e', metal=0.82, rough=0.25)
    jewel_mat = mats.vcol_glow('scarab cyan jewel', glow=0.32, rough=0.15)

    body = add_joint(joints, 'body', (0, 0, 0), root, 'beast_body')

    add_icosphere('scarab belly', (0, 0.08, 0.56), (0.44, 0.66, 0.25), body_mat, body, subdiv=2,
                  deform_fn=lambda p: (p.x, p.y, p.z * (0.75 if p.z < 0 else 0.9)),
                  color_fn=lambda c, n, i: mix_linear('#3b2c1c', '#735732', max(0, min(1, (c.z - 0.35) / 0.35))),
                  base_hex='#594226')

    for sign in (-1, 1):
        add_icosphere(f'scarab wing {sign}', (sign * 0.21, 0.16, 0.79), (0.25, 0.56, 0.24),
                      shell_mat, body, subdiv=2,
                      rot=(0.08, sign * 0.18, sign * -0.05),
                      deform_fn=lambda p, s=sign: (p.x * (0.65 if p.x * s < 0 else 1.05), p.y, max(-0.2, p.z)),
                      color_fn=lambda c, n, i: mix_linear('#145248', '#33b590', max(0, min(1, (c.z + 0.1) / 0.35))),
                      base_hex='#248e74')
        # Thick raised golden filigree border & swirl inlays sitting cleanly atop the elytra
        add_tube(f'wing gold border {sign}',
                 [(sign * 0.04, -0.32, 0.91), (sign * 0.39, -0.10, 0.89),
                  (sign * 0.45, 0.22, 0.85), (sign * 0.26, 0.64, 0.74), (sign * 0.04, 0.70, 0.72)],
                 [0.032, 0.036, 0.034, 0.028, 0.024], gold_mat, body, sides=6, base_hex='#d6a94e')
        add_tube(f'wing gold swirl {sign}',
                 [(sign * 0.14, -0.06, 0.98), (sign * 0.32, 0.14, 0.96),
                  (sign * 0.26, 0.42, 0.89), (sign * 0.12, 0.28, 0.96)],
                 [0.024, 0.028, 0.024, 0.018], gold_mat, body, sides=5, base_hex='#d6a94e')

    add_icosphere('scarab bezel', (0, -0.22, 0.92), (0.15, 0.19, 0.09), gold_mat, body, subdiv=1, base_hex='#d6a94e')
    add_crystal('scarab jewel core', (0, -0.22, 0.97), 0.115, 0.18, jewel_mat, body,
                sides=6, rot=(0.25, 0, 0),
                color_fn=lambda c, n, i: mix_linear('#2edec8', '#a6fff4', max(0, min(1, (c.z + 0.08) / 0.16))),
                base_hex='#5bf5e3')

    head = add_joint(joints, 'head', (0, -0.50, 0.58), root, 'head')
    add_icosphere('scarab pronotum', (0, 0.06, 0.12), (0.36, 0.22, 0.20), body_mat, head, subdiv=2,
                  color_fn=lambda c, n, i: mix_linear('#6e4e26', '#b58842', max(0, min(1, (c.z + 0.1) / 0.3))),
                  base_hex='#946e34')
    add_icosphere('scarab headplate', (0, -0.14, 0.02), (0.24, 0.22, 0.16), body_mat, head, subdiv=2,
                  color_fn=lambda c, n, i: mix_linear('#4f3b22', '#8f6c3a', max(0, min(1, (c.z + 0.1) / 0.25))),
                  base_hex='#75582e')
    add_eye_pair(head, mats, z=0.05, y=-0.26, spread=0.145, radius=0.062,
                 iris_color='#ffd059', dark_color='#1f160c', glow_iris=True,
                 socket_color=None, shine_glow=1.28,
                 brow_color='#8c6b36', fierce=0.3, eye_yaw=0.28)
    add_tube('scarab main horn',
             [(0, -0.28, -0.02), (0, -0.52, 0.12), (0, -0.60, 0.42), (0, -0.48, 0.68)],
             [0.065, 0.048, 0.032, 0.008], gold_mat, head, sides=6, base_hex='#cfa24c')
    for sign in (-1, 1):
        add_tube(f'scarab mandible {sign}',
                 [(sign * 0.12, -0.28, -0.06), (sign * 0.23, -0.44, -0.04), (sign * 0.15, -0.54, 0.05)],
                 [0.036, 0.026, 0.005], gold_mat, head, sides=5, base_hex='#cfa24c')

    leg_rows = [
        ('leg_0', -1, -0.34, 'legFL'), ('leg_1', 1, -0.34, 'legFR'),
        ('leg_2', -1, 0.04, 'legML'), ('leg_3', 1, 0.04, 'legMR'),
        ('leg_4', -1, 0.42, 'legBL'), ('leg_5', 1, 0.42, 'legBR'),
    ]
    for name, sign, ly, role in leg_rows:
        leg = add_joint(joints, name, (sign * 0.34, ly, 0.50), root, role)
        fwd = -0.10 if ly < 0 else (0.10 if ly > 0.2 else 0.0)
        p0 = (0, 0, 0)
        p1 = (sign * 0.22, fwd * 0.4, 0.14)
        p2 = (sign * 0.36, fwd * 0.8, -0.16)
        p3 = (sign * 0.38, fwd * 1.1 - 0.06, -0.48)
        add_tube(f'{name}_seg', [p0, p1, p2, p3], [0.052, 0.042, 0.034, 0.018], gold_mat, leg, sides=6, base_hex='#a8803c')
        add_icosphere(f'{name}_knee', p1, (0.065, 0.065, 0.065), gold_mat, leg, subdiv=1, base_hex='#cfa24c')
        add_cone(f'{name}_claw', (p3[0], p3[1] - 0.03, -0.49), 0.022, 0.002, 0.07,
                 body_mat, leg, sides=5, rot=(math.pi * 0.42, 0, 0), base_hex='#4a371f')


def build_hound(root, joints):
    """Fierce low-poly shadow wolf with sleek swept mane, ember cracks, fangs, and bushy tail."""
    mats = MatLibrary()
    fur_mat = mats.vcol('hound shadow fur', rough=0.84)
    ember_mat = mats.vcol_glow('hound ember cracks', glow=0.36, rough=0.28)

    body = add_joint(joints, 'body', (0, 0, 0), root, 'beast_body')

    add_tube('hound torso',
             [(0, -0.44, 0.72), (0, -0.16, 0.76), (0, 0.18, 0.72), (0, 0.52, 0.68)],
             [(0.32, 0.34), (0.30, 0.30), (0.24, 0.24), (0.26, 0.25)],
             fur_mat, body, sides=9,
             color_fn=lambda c, n, i: mix_linear('#1d1629', '#45355e', max(0, min(1, (c.z - 0.45) / 0.55))),
             base_hex='#342848')

    # Glowing magma/ember fissures pressed cleanly onto shoulder/flank contours
    for sign in (-1, 1):
        add_tube(f'hound ember vein {sign}',
                 [(sign * 0.28, -0.32, 0.72), (sign * 0.29, -0.20, 0.62), (sign * 0.25, -0.10, 0.65)],
                 [0.018, 0.013, 0.008], ember_mat, body, sides=4, base_hex='#ff6a1a')
        add_tube(f'hound rib vein {sign}',
                 [(sign * 0.22, 0.06, 0.76), (sign * 0.23, 0.14, 0.64)],
                 [0.015, 0.007], ember_mat, body, sides=4, base_hex='#ff8428')

    # Sleek backward-sweeping jagged wolf mane & dorsal spine tufts
    for i in range(10):
        a = i * math.tau / 10
        if math.sin(a) < -0.55:  # skip underside
            continue
        px = math.cos(a) * 0.26
        pz = 0.78 + math.sin(a) * 0.22
        add_rod(f'mane ruff {i}', (px, -0.40, pz), (px * 1.25, -0.12, pz + 0.12),
                0.085, fur_mat, body, taper=0.06, sides=6, base_hex='#4a3868')
    for i in range(9):
        t = i / 8.0
        sy = -0.36 + t * 0.92
        sz = 0.98 - t * 0.12
        for side_off in (0.0, -0.09, 0.09) if i < 5 else (0.0,):
            s_len = 0.24 - t * 0.07
            add_rod(f'dorsal tuft {i}_{side_off}', (side_off, sy, sz - 0.06),
                    (side_off * 1.3, sy + 0.24, sz + s_len * 0.55),
                    0.072, fur_mat, body, taper=0.05, sides=6,
                    color_fn=lambda c, n, idx: mix_linear('#2b203d', '#554175', max(0, min(1, (c.z - 0.8) / 0.35))),
                    base_hex='#443360')

    tail = add_joint(joints, 'tail', (0, 0.56, 0.70), body, 'tail')
    add_tube('hound tail',
             [(0, 0, 0), (0, 0.26, 0.04), (0.04, 0.52, -0.10), (0.06, 0.70, -0.26)],
             [0.10, 0.14, 0.11, 0.02], fur_mat, tail, sides=7,
             color_fn=lambda c, n, i: mix_linear('#261c38', '#4f3c6e', max(0, min(1, (c.z + 0.2) / 0.4))),
             base_hex='#3d2e57')

    head = add_joint(joints, 'head', (0, -0.58, 0.82), root, 'head')
    add_icosphere('hound skull', (0, -0.08, 0.04), (0.26, 0.28, 0.23), fur_mat, head, subdiv=2,
                  color_fn=lambda c, n, i: mix_linear('#251b36', '#4a3869', max(0, min(1, (c.z + 0.15) / 0.35))),
                  base_hex='#3b2d54')
    for sign in (-1, 1):
        add_rod(f'cheek fur {sign}', (sign * 0.20, -0.05, 0.0), (sign * 0.30, 0.14, -0.04),
                0.060, fur_mat, head, taper=0.08, sides=5, base_hex='#4a3869')
    add_cone('hound snout', (0, -0.34, 0.02), 0.17, 0.075, 0.34, fur_mat, head, sides=6,
             deform_fn=lambda p: (p.x * 0.9, p.y * 0.65, p.z),
             rot=(math.pi * 0.52, 0, 0), base_hex='#3b2d54')
    add_cone('hound lower jaw', (0, -0.30, -0.09), 0.12, 0.05, 0.28, fur_mat, head, sides=6,
             deform_fn=lambda p: (p.x * 0.85, p.y * 0.45, p.z),
             rot=(math.pi * 0.58, 0, 0), base_hex='#271d38')
    for sign in (-1, 1):
        add_cone(f'upper fang {sign}', (sign * 0.075, -0.42, -0.02), 0.022, 0.002, 0.095,
                 mats.detail('hound fang detail', '#f5eedc', rough=0.35), head, sides=5, rot=(math.pi, 0, 0))
        add_cone(f'lower fang {sign}', (sign * 0.065, -0.40, -0.10), 0.016, 0.002, 0.065,
                 mats.detail('hound fang detail', '#f5eedc', rough=0.35), head, sides=5)
        add_cone(f'hound ear {sign}', (sign * 0.16, 0.08, 0.26), 0.095, 0.006, 0.34, fur_mat, head,
                 sides=5, deform_fn=lambda p: (p.x * 0.8, p.y * 0.55, p.z),
                 rot=(-0.48, sign * 0.25, sign * 0.15), base_hex='#433361')

    add_eye_pair(head, mats, z=0.09, y=-0.27, spread=0.135, radius=0.056,
                 iris_color='#ff3352', dark_color='#1a0a10', glow_iris=True,
                 socket_color=None, shine_glow=1.30,
                 brow_color='#2a1f3d', fierce=0.55, eye_yaw=0.25, squash_y=0.82)

    legs = [
        ('leg_0', -0.24, -0.38, 'legFL'), ('leg_1', 0.24, -0.38, 'legFR'),
        ('leg_2', -0.23, 0.46, 'legBL'), ('leg_3', 0.23, 0.46, 'legBR'),
    ]
    for name, lx, ly, role in legs:
        sign = -1 if lx < 0 else 1
        leg = add_joint(joints, name, (lx, ly, 0.62), root, role)
        knee_y = -0.08 if ly < 0 else 0.12
        add_tube(f'{name}_leg',
                 [(0, 0, 0.04), (sign * 0.04, knee_y, -0.26), (sign * 0.04, -0.02, -0.46), (sign * 0.05, -0.08, -0.58)],
                 [0.125, 0.085, 0.062, 0.058], fur_mat, leg, sides=7,
                 color_fn=lambda c, n, i: mix_linear('#20172e', '#3d2f54', max(0, min(1, (c.z + 0.6) / 0.65))),
                 base_hex='#342848')
        add_claw_paw(leg, mats, (sign * 0.05, -0.14, -0.57), paw_scale=(0.10, 0.14, 0.055),
                     body_hex='#322546', dark_hex='#1c1429', claw_hex='#e3d7bd', toes=3)
