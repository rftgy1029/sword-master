"""Faceted low-poly bmesh sculpting, vertex-color shading, and rigging helpers for S'word Master."""
import bpy
import bmesh
import math
from mathutils import Matrix, Quaternion, Vector


def srgb_to_linear_channel(c):
    c = max(0.0, min(1.0, c))
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_to_srgb(hex_color):
    h = hex_color.lstrip('#')
    return tuple(int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))


def hex_to_linear(hex_color):
    return tuple(srgb_to_linear_channel(v) for v in hex_to_srgb(hex_color))


def mix_srgb(hex_a, hex_b, t):
    t = max(0.0, min(1.0, t))
    a = hex_to_srgb(hex_a)
    b = hex_to_srgb(hex_b)
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


def mix_linear(hex_a, hex_b, t):
    return tuple(srgb_to_linear_channel(v) for v in mix_srgb(hex_a, hex_b, t))


def hash01(seed):
    x = math.sin(seed * 127.1 + 311.7) * 43758.5453123
    return x - math.floor(x)


def jitter_linear(rgb, seed, amount=0.06):
    delta = (hash01(seed) - 0.5) * 2.0 * amount
    return tuple(max(0.0, min(1.0, c * (1.0 + delta))) for c in rgb)


class MatLibrary:
    """Per-monster material cache with vertex-color, metallic, emissive, glass, and detail support."""

    def __init__(self):
        self.mats = {}

    def _base(self, name, color='#ffffff', metal=0.0, rough=0.65, glow=0.0, alpha=1.0,
              double_sided=False, use_vcol=False, glow_vcol=False):
        if name in self.mats:
            return self.mats[name]
        mat = bpy.data.materials.new(name)
        mat.use_nodes = True
        mat.use_backface_culling = not double_sided
        bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        rgb = hex_to_linear(color)
        bsdf.inputs['Base Color'].default_value = (*rgb, alpha)
        bsdf.inputs['Metallic'].default_value = metal
        bsdf.inputs['Roughness'].default_value = rough
        bsdf.inputs['Emission Color'].default_value = (*rgb, 1.0)
        bsdf.inputs['Emission Strength'].default_value = glow
        bsdf.inputs['Alpha'].default_value = alpha
        if alpha < 1.0:
            mat.surface_render_method = 'DITHERED'
        if use_vcol:
            vcol = mat.node_tree.nodes.new('ShaderNodeVertexColor')
            vcol.layer_name = 'Col'
            mat.node_tree.links.new(vcol.outputs['Color'], bsdf.inputs['Base Color'])
            if glow_vcol:
                mat.node_tree.links.new(vcol.outputs['Color'], bsdf.inputs['Emission Color'])
        mat.diffuse_color = (*rgb, alpha)
        self.mats[name] = mat
        return mat

    def vcol(self, name='body vcol', metal=0.0, rough=0.68, double_sided=False):
        return self._base(name, '#ffffff', metal=metal, rough=rough, double_sided=double_sided, use_vcol=True)

    def vcol_glow(self, name='glow vcol', glow=1.6, metal=0.0, rough=0.3, alpha=1.0, double_sided=False):
        return self._base(name, '#ffffff', metal=metal, rough=rough, glow=glow, alpha=alpha,
                          double_sided=double_sided, use_vcol=True, glow_vcol=True)

    def solid(self, name, color, metal=0.0, rough=0.6, glow=0.0, alpha=1.0, double_sided=False):
        return self._base(name, color, metal=metal, rough=rough, glow=glow, alpha=alpha, double_sided=double_sided)

    def metal(self, name, color, metal=0.78, rough=0.28, double_sided=False):
        return self._base(name, color, metal=metal, rough=rough, double_sided=double_sided)

    def detail(self, name, color, metal=0.0, rough=0.45, glow=0.0):
        """Materials ending in ' detail' omit toon outlines in src/game/three/toon.js."""
        full = name if name.endswith(' detail') else f'{name} detail'
        return self._base(full, color, metal=metal, rough=rough, glow=glow, double_sided=False)


def _uses_vcol(mat):
    if not mat or not mat.use_nodes:
        return False
    return any(n.type == 'VERTEX_COLOR' for n in mat.node_tree.nodes)


def paint_mesh(obj, color_fn=None, base_hex='#808080', jitter=0.04, per_vertex=False):
    """Populate the 'Col' corner color attribute on a mesh object."""
    mesh = obj.data
    ca = mesh.color_attributes.get('Col') or mesh.color_attributes.new('Col', 'BYTE_COLOR', 'CORNER')
    default_lin = hex_to_linear(base_hex)
    verts = mesh.vertices
    if per_vertex and color_fn is not None:
        v_colors = [color_fn(v.co, v.normal, i) for i, v in enumerate(verts)]
        for poly in mesh.polygons:
            for li, vi in zip(poly.loop_indices, poly.vertices):
                rgb = v_colors[vi]
                if jitter:
                    rgb = jitter_linear(rgb, poly.index * 17.3 + vi * 0.7, jitter)
                ca.data[li].color = (*rgb, 1.0)
    else:
        for poly in mesh.polygons:
            center = poly.center
            normal = poly.normal
            if color_fn is not None:
                rgb = color_fn(center, normal, poly.index)
            else:
                rgb = default_lin
            if jitter:
                rgb = jitter_linear(rgb, poly.index * 13.7 + center.x * 31.1 + center.y * 19.7 + center.z * 7.3, jitter)
            for li in poly.loop_indices:
                ca.data[li].color = (*rgb, 1.0)


def finalize_bmesh(name, bm, mat, parent=None, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1),
                   smooth=False, color_fn=None, base_hex='#888888', jitter=0.04, per_vertex=False):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = loc
    obj.rotation_euler = rot
    obj.scale = scale
    if parent:
        obj.parent = parent
    if mat:
        obj.data.materials.append(mat)
    for poly in obj.data.polygons:
        poly.use_smooth = smooth
    if _uses_vcol(mat) or color_fn is not None:
        paint_mesh(obj, color_fn=color_fn, base_hex=base_hex, jitter=jitter, per_vertex=per_vertex)
    return obj


def add_icosphere(name, loc, scale, mat, parent=None, subdiv=2, deform_fn=None,
                  color_fn=None, base_hex='#888888', jitter=0.045, rot=(0, 0, 0),
                  smooth=False, per_vertex=False):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=1.0)
    if deform_fn is not None:
        for v in bm.verts:
            v.co = Vector(deform_fn(v.co.copy()))
    for v in bm.verts:
        v.co.x *= scale[0]
        v.co.y *= scale[1]
        v.co.z *= scale[2]
    return finalize_bmesh(name, bm, mat, parent, loc=loc, rot=rot, smooth=smooth,
                          color_fn=color_fn, base_hex=base_hex, jitter=jitter, per_vertex=per_vertex)


def add_uv_sphere(name, loc, scale, mat, parent=None, segs=16, rings=10, deform_fn=None,
                  color_fn=None, base_hex='#888888', jitter=0.04, rot=(0, 0, 0), smooth=False):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=1.0)
    if deform_fn is not None:
        for v in bm.verts:
            v.co = Vector(deform_fn(v.co.copy()))
    for v in bm.verts:
        v.co.x *= scale[0]
        v.co.y *= scale[1]
        v.co.z *= scale[2]
    return finalize_bmesh(name, bm, mat, parent, loc=loc, rot=rot, smooth=smooth,
                          color_fn=color_fn, base_hex=base_hex, jitter=jitter)


def add_box(name, loc, size, mat, parent=None, bevel=0.025, bevel_seg=1, rot=(0, 0, 0),
            deform_fn=None, color_fn=None, base_hex='#888888', jitter=0.04, smooth=False):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= size[0]
        v.co.y *= size[1]
        v.co.z *= size[2]
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=bevel_seg, affect='EDGES')
    if deform_fn is not None:
        for v in bm.verts:
            v.co = Vector(deform_fn(v.co.copy()))
    return finalize_bmesh(name, bm, mat, parent, loc=loc, rot=rot, smooth=smooth,
                          color_fn=color_fn, base_hex=base_hex, jitter=jitter)


def add_cone(name, loc, r1, r2, depth, mat, parent=None, sides=8, rot=(0, 0, 0),
             deform_fn=None, color_fn=None, base_hex='#888888', jitter=0.04, cap=True, smooth=False):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=cap, cap_tris=True, segments=sides,
                          radius1=max(0.001, r1), radius2=max(0.0, r2), depth=depth)
    if deform_fn is not None:
        for v in bm.verts:
            v.co = Vector(deform_fn(v.co.copy()))
    return finalize_bmesh(name, bm, mat, parent, loc=loc, rot=rot, smooth=smooth,
                          color_fn=color_fn, base_hex=base_hex, jitter=jitter)


def add_rod(name, a, b, radius, mat, parent=None, taper=0.8, sides=8,
            color_fn=None, base_hex='#888888', jitter=0.04):
    va, vb = Vector(a), Vector(b)
    diff = vb - va
    length = max(0.001, diff.length)
    mid = (va + vb) * 0.5
    rot = diff.to_track_quat('Z', 'Y').to_euler()
    return add_cone(name, mid, radius, radius * taper, length, mat, parent, sides=sides,
                    rot=rot, color_fn=color_fn, base_hex=base_hex, jitter=jitter)


def add_tube(name, points, radii, mat, parent=None, sides=8, caps=(True, True),
             profile_fn=None, twist=0.0, color_fn=None, base_hex='#888888', jitter=0.04, smooth=False):
    """Loft a smooth low-poly faceted tube along 3D spline points using parallel-transport frames."""
    pts = [Vector(p) for p in points]
    n = len(pts)
    assert n >= 2
    if isinstance(radii, (int, float)):
        r_list = [(radii, radii)] * n
    else:
        r_list = [(r, r) if isinstance(r, (int, float)) else (r[0], r[1]) for r in radii]

    bm = bmesh.new()
    tangents = []
    for i in range(n):
        if i == 0:
            t = (pts[1] - pts[0]).normalized()
        elif i == n - 1:
            t = (pts[-1] - pts[-2]).normalized()
        else:
            t = (pts[i + 1] - pts[i - 1]).normalized()
        if t.length < 1e-6:
            t = Vector((0, 0, 1))
        tangents.append(t)

    ref = Vector((0, -1, 0)) if abs(tangents[0].y) < 0.85 else Vector((0, 0, 1))
    u_axis = tangents[0].cross(ref).normalized()
    v_axis = tangents[0].cross(u_axis).normalized()

    rings = []
    for i in range(n):
        t_frac = i / (n - 1)
        if i > 0:
            rot_q = tangents[i - 1].rotation_difference(tangents[i])
            u_axis = (rot_q @ u_axis).normalized()
            v_axis = tangents[i].cross(u_axis).normalized()
        rx, ry = r_list[i]
        ring = []
        ang_off = twist * t_frac
        for s in range(sides):
            ang = s * math.tau / sides + ang_off
            cx, cy = math.cos(ang), math.sin(ang)
            if profile_fn is not None:
                mul = profile_fn(ang, t_frac)
                cx *= mul
                cy *= mul
            pos = pts[i] + u_axis * (cx * rx) + v_axis * (cy * ry)
            ring.append(bm.verts.new(pos))
        rings.append(ring)

    for i in range(n - 1):
        r0, r1 = rings[i], rings[i + 1]
        for s in range(sides):
            ns = (s + 1) % sides
            bm.faces.new((r0[s], r0[ns], r1[ns], r1[s]))

    if caps[0]:
        c0 = bm.verts.new(pts[0])
        for s in range(sides):
            ns = (s + 1) % sides
            bm.faces.new((c0, rings[0][ns], rings[0][s]))
    if caps[1]:
        c1 = bm.verts.new(pts[-1])
        for s in range(sides):
            ns = (s + 1) % sides
            bm.faces.new((c1, rings[-1][s], rings[-1][ns]))

    return finalize_bmesh(name, bm, mat, parent, smooth=smooth,
                          color_fn=color_fn, base_hex=base_hex, jitter=jitter)


def add_loft(name, ring_specs, mat, parent=None, caps=(True, True),
             color_fn=None, base_hex='#888888', jitter=0.04, smooth=False):
    """Loft arbitrary 3D rings. Each ring_spec is a list of (x, y, z) tuples of equal length."""
    bm = bmesh.new()
    sides = len(ring_specs[0])
    rings = [[bm.verts.new(Vector(pt)) for pt in spec] for spec in ring_specs]
    for i in range(len(rings) - 1):
        r0, r1 = rings[i], rings[i + 1]
        for s in range(sides):
            ns = (s + 1) % sides
            bm.faces.new((r0[s], r0[ns], r1[ns], r1[s]))
    if caps[0]:
        c0 = bm.verts.new(sum((v.co for v in rings[0]), Vector()) / sides)
        for s in range(sides):
            ns = (s + 1) % sides
            bm.faces.new((c0, rings[0][ns], rings[0][s]))
    if caps[1]:
        c1 = bm.verts.new(sum((v.co for v in rings[-1]), Vector()) / sides)
        for s in range(sides):
            ns = (s + 1) % sides
            bm.faces.new((c1, rings[-1][s], rings[-1][ns]))
    return finalize_bmesh(name, bm, mat, parent, smooth=smooth,
                          color_fn=color_fn, base_hex=base_hex, jitter=jitter)


def add_crystal(name, loc, radius, height, mat, parent=None, sides=5, rot=(0, 0, 0),
                color_fn=None, base_hex='#ffd066', jitter=0.05):
    bm = bmesh.new()
    top = bm.verts.new((0, 0, height * 0.55))
    bot = bm.verts.new((0, 0, -height * 0.45))
    ring = [bm.verts.new((math.cos(i * math.tau / sides) * radius,
                          math.sin(i * math.tau / sides) * radius, 0.0)) for i in range(sides)]
    for i in range(sides):
        ni = (i + 1) % sides
        bm.faces.new((ring[i], ring[ni], top))
        bm.faces.new((ring[ni], ring[i], bot))
    return finalize_bmesh(name, bm, mat, parent, loc=loc, rot=rot, smooth=False,
                          color_fn=color_fn, base_hex=base_hex, jitter=jitter)


def add_leaf(name, origin, direction, length, width, arch, mat, parent=None,
             color_fn=None, base_hex='#6fa34b', jitter=0.05):
    """Sculpted 3D diamond/lance leaf with raised central spine and gentle curl."""
    d = Vector(direction).normalized()
    up = Vector((0, 0, 1)) if abs(d.z) < 0.9 else Vector((0, 1, 0))
    side = d.cross(up).normalized()
    normal = side.cross(d).normalized()
    o = Vector(origin)
    pts = [
        o,
        o + d * (length * 0.28) + side * (width * 0.45) + normal * (arch * 0.45),
        o + d * (length * 0.32) + normal * (arch * 0.65),
        o + d * (length * 0.28) - side * (width * 0.45) + normal * (arch * 0.45),
        o + d * (length * 0.68) + side * (width * 0.34) + normal * (arch * 0.25),
        o + d * (length * 0.70) + normal * (arch * 0.40),
        o + d * (length * 0.68) - side * (width * 0.34) + normal * (arch * 0.25),
        o + d * length - normal * (arch * 0.30),
    ]
    bm = bmesh.new()
    v = [bm.verts.new(p) for p in pts]
    for f in [(0, 1, 2), (0, 2, 3), (1, 4, 5, 2), (2, 5, 6, 3), (4, 7, 5), (5, 7, 6)]:
        bm.faces.new([v[i] for i in f])
    bmesh.ops.solidify(bm, geom=list(bm.faces), thickness=max(0.008, width * 0.08))
    return finalize_bmesh(name, bm, mat, parent, smooth=False,
                          color_fn=color_fn, base_hex=base_hex, jitter=jitter)


def add_fern_sprig(name, origin, direction, length, mat, parent=None, leaflets=3,
                   color_fn=None, base_hex='#6ea64d'):
    d = Vector(direction).normalized()
    up = Vector((0, 0, 1)) if abs(d.z) < 0.9 else Vector((0, 1, 0))
    side = d.cross(up).normalized()
    norm = side.cross(d).normalized()
    o = Vector(origin)
    for i in range(leaflets):
        t = (i + 0.5) / (leaflets + 0.4)
        base = o + d * (length * t) + norm * (math.sin(t * math.pi) * length * 0.1)
        l_len = length * (0.48 - t * 0.18)
        for sign in (-1, 1):
            ldir = (d * 0.7 + side * (sign * 0.7) + norm * 0.25).normalized()
            add_leaf(f'{name}_l{i}_{sign}', base, ldir, l_len, l_len * 0.42, l_len * 0.14,
                     mat, parent, color_fn=color_fn, base_hex=base_hex)
    tip_base = o + d * (length * 0.72) + norm * (length * 0.08)
    add_leaf(f'{name}_tip', tip_base, (d + norm * 0.2).normalized(), length * 0.42,
             length * 0.18, length * 0.06, mat, parent, color_fn=color_fn, base_hex=base_hex)


def add_mini_mushroom(name, loc, scale, rot, stem_mat, cap_mat, parent=None,
                      stem_hex='#d9caa0', cap_hex='#ffbf55', cap_rim_hex='#e08a30'):
    grp = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(grp)
    grp.location = loc
    grp.rotation_euler = rot
    grp.scale = (scale, scale, scale)
    if parent:
        grp.parent = parent
    add_tube(f'{name}_stem', [(0, 0, 0), (0.02, -0.01, 0.12), (0.0, 0.0, 0.24)],
             [0.065, 0.048, 0.042], stem_mat, grp, sides=7,
             color_fn=lambda c, n, i: mix_linear(stem_hex, '#efe4c4', max(0, min(1, c.z / 0.25))),
             base_hex=stem_hex)
    add_icosphere(f'{name}_cap', (0, 0, 0.27), (0.17, 0.17, 0.105), cap_mat, grp, subdiv=2,
                  deform_fn=lambda p: (p.x, p.y, p.z * 0.45 if p.z < 0 else p.z * (1.0 - 0.18 * (p.x * p.x + p.y * p.y))),
                  color_fn=lambda c, n, i: mix_linear(cap_rim_hex, cap_hex, max(0, min(1, (c.z + 0.03) / 0.12))),
                  base_hex=cap_hex)
    return grp


def add_eye_pair(parent, mats, z, y, spread, radius=0.08, iris_color='#ffcf6e',
                 dark_color='#14101c', glow_iris=False, brow_color=None, fierce=0.0,
                 eye_yaw=0.22, squash_y=0.92, socket_color='#1b1924', show_iris_front=True,
                 shine_glow=1.18):
    """Expressive dual eyes with socket, glossy orb, colored iris/glow, and dual catchlight orbs."""
    dark_mat = mats.solid(f'eye_dark_{dark_color}', dark_color, rough=0.06)
    sock_mat = mats.solid(f'eye_sock_{socket_color}', socket_color, rough=0.75) if socket_color else None
    iris_mat = mats.detail(f'eye_iris_{iris_color}_{glow_iris}', iris_color,
                           rough=0.18, glow=1.05 if glow_iris else 0.0)
    shine_mat = mats.detail('eye shine detail', '#fff9dc', rough=0.1, glow=shine_glow)
    brow_mat = mats.detail(f'brow_{brow_color}', brow_color, rough=0.65) if brow_color else None

    for sign in (-1, 1):
        # Optional subtle orbital recess behind eye
        if sock_mat:
            add_icosphere('eye socket', (sign * spread, y + radius * 0.25, z),
                          (radius * 1.12, radius * 0.65, radius * 1.06 * squash_y),
                          sock_mat, parent, subdiv=1, rot=(0, 0, -sign * eye_yaw))
        # Main glossy eyeball
        add_uv_sphere('eyeball', (sign * spread, y - radius * 0.06, z),
                      (radius, radius * 0.78, radius * squash_y),
                      dark_mat, parent, segs=14, rings=10,
                      rot=(0, 0, -sign * eye_yaw), smooth=True)
        # Forward iris/glow accent
        if glow_iris:
            add_uv_sphere('glowing iris', (sign * spread * 0.99, y - radius * 0.62, z),
                          (radius * 0.56, radius * 0.34, radius * 0.52 * squash_y),
                          iris_mat, parent, segs=12, rings=8,
                          rot=(0, 0, -sign * eye_yaw), smooth=True)
        elif show_iris_front:
            add_uv_sphere('iris ring', (sign * spread - sign * radius * 0.04, y - radius * 0.56, z - radius * 0.06),
                          (radius * 0.52, radius * 0.32, radius * 0.48 * squash_y),
                          iris_mat, parent, segs=12, rings=8,
                          rot=(0, 0, -sign * eye_yaw), smooth=True)
            add_uv_sphere('pupil', (sign * spread - sign * radius * 0.04, y - radius * 0.66, z - radius * 0.03),
                          (radius * 0.40, radius * 0.25, radius * 0.38 * squash_y),
                          dark_mat, parent, segs=12, rings=8,
                          rot=(0, 0, -sign * eye_yaw), smooth=True)
        # Dual crisp directional catchlights (upper-camera-side big + opposite small)
        c_dir = -1.0
        add_uv_sphere('eye catchlight big',
                      (sign * spread + c_dir * radius * 0.26, y - radius * 0.78, z + radius * 0.28 * squash_y),
                      (radius * 0.23, radius * 0.14, radius * 0.23),
                      shine_mat, parent, segs=10, rings=6, smooth=True)
        add_uv_sphere('eye catchlight small',
                      (sign * spread - c_dir * radius * 0.24, y - radius * 0.74, z - radius * 0.22 * squash_y),
                      (radius * 0.11, radius * 0.08, radius * 0.11),
                      shine_mat, parent, segs=8, rings=6, smooth=True)
        if brow_mat:
            add_box('brow ridge', (sign * spread, y - radius * 0.35, z + radius * 0.92 * squash_y),
                    (radius * 1.95, radius * 0.75, radius * 0.38), brow_mat, parent,
                    bevel=radius * 0.12, rot=(0.15, -sign * fierce * 0.45, -sign * eye_yaw))


def add_claw_paw(parent, mats, loc, paw_scale=(0.15, 0.20, 0.085), body_hex='#446c43',
                 dark_hex='#2f4e32', claw_hex='#e3d6b8', toes=3):
    vmat = mats.vcol('paw vcol', rough=0.72)
    cmat = mats.solid('ivory claw', claw_hex, rough=0.42)
    add_icosphere('paw pad', loc, paw_scale, vmat, parent, subdiv=2,
                  deform_fn=lambda p: (p.x * (1.12 if p.y < 0 else 0.88), p.y, max(-0.55, p.z)),
                  color_fn=lambda c, n, i: mix_linear(dark_hex, body_hex, max(0, min(1, (c.z + paw_scale[2] * 0.5) / paw_scale[2]))),
                  base_hex=body_hex)
    angles = [((i - (toes - 1) / 2.0) * 0.36) for i in range(toes)]
    for a in angles:
        cx = loc[0] + math.sin(a) * paw_scale[0] * 0.92
        cy = loc[1] - math.cos(a) * paw_scale[1] * 0.95
        cz = loc[2] - paw_scale[2] * 0.12
        add_cone('claw', (cx, cy, cz), paw_scale[0] * 0.24, 0.002, paw_scale[1] * 0.65,
                 cmat, parent, sides=6, rot=(math.pi * 0.54, 0, a), base_hex=claw_hex)


def add_fur_collar(name, parent, mats, center, rx, ry, count=12, spike_len=0.22,
                   spike_r=0.085, color_top='#3c2f50', color_tip='#241b33', droop=0.28):
    fmat = mats.vcol(f'{name} mat', rough=0.86)
    cx, cy, cz = center
    for i in range(count):
        a = i * math.tau / count + (i % 2) * 0.08
        px = cx + math.cos(a) * rx
        py = cy + math.sin(a) * ry
        pz = cz + (i % 2) * 0.04
        out = Vector((math.cos(a), math.sin(a), -droop)).normalized()
        tip = Vector((px, py, pz)) + out * (spike_len * (0.85 + (i % 3) * 0.15))
        add_rod(f'{name}_{i}', (px, py, pz), tip, spike_r, fmat, parent, taper=0.05, sides=6,
                color_fn=lambda c, n, idx, ct=color_top, cb=color_tip: mix_linear(ct, cb, idx % 2 * 0.25),
                base_hex=color_top)


def add_tattered_cape(name, parent, mats, top=(0, 0.18, 1.72), length=1.25,
                      width=(0.36, 0.72), flare=0.36, base_hex='#7d242e', trim_hex='#caa152',
                      dark_hex='#49121a'):
    cmat = mats.vcol(f'{name}_fabric', rough=0.88, double_sided=True)
    tmat = mats.metal(f'{name}_trim', trim_hex, metal=0.72, rough=0.32)
    cols = 11
    rows = 10
    bm = bmesh.new()
    grid = []
    for r in range(rows):
        t = r / (rows - 1)
        half = width[0] + t * (width[1] - width[0])
        row_verts = []
        for c in range(cols):
            u = c / (cols - 1)
            fold = math.cos(u * math.pi * 5.0) * 0.045 * t
            edge_tatter = -abs(math.sin(u * math.pi * 4.5)) * 0.14 if r == rows - 1 else 0.0
            px = (u - 0.5) * half * 2.0
            py = 0.04 + t * flare + fold
            pz = -t * length + edge_tatter
            row_verts.append(bm.verts.new((px, py, pz)))
        grid.append(row_verts)
    for r in range(rows - 1):
        for c in range(cols - 1):
            bm.faces.new((grid[r][c], grid[r][c + 1], grid[r + 1][c + 1], grid[r + 1][c]))
    bmesh.ops.solidify(bm, geom=list(bm.faces), thickness=0.022)
    finalize_bmesh(name, bm, cmat, parent, loc=top, smooth=False,
                   color_fn=lambda c, n, idx: mix_linear(base_hex, dark_hex, max(0, min(1, -c.z / length * 0.65))),
                   base_hex=base_hex)
    # Gold ornamental shoulder clasps and upper trim border
    for side in (-1, 1):
        add_icosphere(f'{name}_clasp', (side * width[0] * 0.86, top[1] - 0.04, top[2] + 0.02),
                      (0.065, 0.05, 0.065), tmat, parent, subdiv=1, base_hex=trim_hex)
        pts = [Vector(top) + Vector(((side) * (width[0] + t * (width[1] - width[0])) * 0.98,
                                      0.05 + t * flare, -t * length * 0.92))
               for t in (0.0, 0.25, 0.5, 0.75, 1.0)]
        add_tube(f'{name}_border', pts, 0.016, tmat, parent, sides=6, base_hex=trim_hex)


def add_joint(joints_list, name, loc, parent, role):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.location = loc
    if parent:
        obj.parent = parent
    joints_list.append((obj, role, tuple(obj.location), tuple(obj.rotation_euler), tuple(obj.scale)))
    return obj
