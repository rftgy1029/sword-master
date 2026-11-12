"""Original articulated S’word Master models. Run with Blender 4.3+:
blender --background --python scripts/create_3d_assets.py
(only the hero: blender --background --python scripts/create_3d_assets.py -- hero)
Creates GLB meshes, PBR materials and named NLA animations; no external assets.
Also saves each model scene as assets/models/<name>.blend for viewing in Blender.
"""
import bpy
import math
import json
import struct
import sys
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/models'
OUT.mkdir(parents=True, exist_ok=True)
# Blender에서 열어 볼 수 있는 원본 장면. 게임은 GLB만 읽으며, 이 스크립트를 다시 실행하면 덮어쓴다.
BLEND_OUT = ROOT / 'assets/models'
BLEND_OUT.mkdir(parents=True, exist_ok=True)
MATS = {}
JOINTS = []
# Blender UI가 한국어여도 새 데이터 이름은 영어로 만들어 어느 컴퓨터에서든 같은 GLB가 나오게 한다.
bpy.context.preferences.view.use_translate_new_dataname = False
bpy.context.preferences.filepaths.save_version = 0  # .blend1 백업 파일을 만들지 않는다.

def material(name, color, metal=0, rough=.55, glow=0, alpha=1):
    if name in MATS: return MATS[name]
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    # 노드 이름은 Blender 언어 설정(예: '프린시플드 BSDF')에 따라 바뀌므로 종류로 찾는다.
    node = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    srgb = tuple(int(color[i:i+2], 16) / 255 for i in (1, 3, 5))
    rgb = tuple(value / 12.92 if value <= .04045 else ((value + .055) / 1.055) ** 2.4 for value in srgb)
    node.inputs['Base Color'].default_value = (*rgb, alpha)
    node.inputs['Metallic'].default_value = metal
    node.inputs['Roughness'].default_value = rough
    node.inputs['Emission Color'].default_value = (*rgb, 1)
    node.inputs['Emission Strength'].default_value = glow
    node.inputs['Alpha'].default_value = alpha
    if alpha < 1: mat.surface_render_method = 'DITHERED'
    mat.diffuse_color = (*rgb, alpha)
    MATS[name] = mat
    return mat

def mesh_finish(obj, name, mat, parent=None):
    obj.name = name
    if mat: obj.data.materials.append(mat)
    if parent: obj.parent = parent
    for poly in obj.data.polygons: poly.use_smooth = True
    return obj

def sphere(name, loc, size, mat, parent=None, segments=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=10, location=(0,0,0))
    obj = bpy.context.object
    obj.location = loc; obj.scale = size
    return mesh_finish(obj, name, mat, parent)

def cone(name, loc, radius, depth, mat, parent=None, top=0, vertices=16):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius, radius2=top, depth=depth)
    obj = bpy.context.object; obj.location = loc
    return mesh_finish(obj, name, mat, parent)

def box(name, loc, size, mat, parent=None, bevel=.035):
    bpy.ops.mesh.primitive_cube_add(size=1)
    obj = bpy.context.object; obj.location = loc; obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = obj.modifiers.new('soft forged edges', 'BEVEL'); mod.width = bevel; mod.segments = 2
        bpy.context.view_layer.objects.active = obj; bpy.ops.object.modifier_apply(modifier=mod.name)
    return mesh_finish(obj, name, mat, parent)

def rod(name, a, b, radius, mat, parent=None, taper=.8):
    midpoint = (Vector(a) + Vector(b)) / 2
    obj = cone(name, midpoint, radius, (Vector(b)-Vector(a)).length, mat, parent, radius*taper)
    obj.rotation_euler = (Vector(b)-Vector(a)).to_track_quat('Z','Y').to_euler()
    return obj

def curve(name, points, radius, mat, parent=None):
    data = bpy.data.curves.new(name, 'CURVE'); data.dimensions = '3D'; data.resolution_u = 8
    data.bevel_depth = radius; data.bevel_resolution = 2
    spline = data.splines.new('BEZIER'); spline.bezier_points.add(len(points)-1)
    for point, co in zip(spline.bezier_points, points):
        point.co=co; point.handle_left_type='AUTO'; point.handle_right_type='AUTO'
    obj=bpy.data.objects.new(name,data); bpy.context.collection.objects.link(obj)
    if parent: obj.parent=parent
    data.materials.append(mat)
    bpy.context.view_layer.objects.active=obj; obj.select_set(True)
    bpy.ops.object.convert(target='MESH'); obj.select_set(False)
    return obj

def joint(name, loc, parent, role):
    obj=bpy.data.objects.new(name, None); bpy.context.collection.objects.link(obj)
    obj.location=loc; obj.parent=parent
    JOINTS.append((obj, role, tuple(obj.location), tuple(obj.rotation_euler), tuple(obj.scale)))
    return obj

def gem(name, loc, radius, mat, parent):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=radius)
    obj=bpy.context.object; obj.location=loc; obj.scale=(.7,.45,1.25)
    return mesh_finish(obj,name,mat,parent)

def cloth(root, royal=False, top=(0,.16,1.65), length=None, width=(.38,.60), flare=.28, clasps=((-.24,-.025,1.67),(.24,-.025,1.67)), clasp_size=(.055,.045,.055)):
    red=material('oxblood cloth','#802c32',rough=.88)
    gold=material('aged brass','#bc9555',.65,.32)
    cape=joint('cape',top,root,'cape')
    vertices=[]; faces=[]; cols=9; rows=10
    length=length or (1.36 if royal else 1.08)
    for row in range(rows):
        t=row/(rows-1); half=width[0]+t*(width[1]-width[0])
        for col in range(cols):
            u=col/(cols-1)
            vertices.append(((u-.5)*half*2, .05+t*flare+math.cos(u*math.pi*6)*.035*t, -t*length + (math.sin(u*math.pi*5)*.06 if row==rows-1 else 0)))
    for row in range(rows-1):
        for col in range(cols-1):
            a=row*cols+col; faces.append((a,a+1,a+1+cols,a+cols))
    data=bpy.data.meshes.new('woven cape'); data.from_pydata(vertices,[],faces); data.update()
    obj=bpy.data.objects.new('cape fabric',data); bpy.context.collection.objects.link(obj)
    mesh_finish(obj,'cape fabric',red,cape)
    mod=obj.modifiers.new('cloth thickness','SOLIDIFY'); mod.thickness=.018
    bpy.context.view_layer.objects.active=obj; bpy.ops.object.modifier_apply(modifier=mod.name)
    for side in [0,cols-1]: curve('cape stitched edge',[vertices[row*cols+side] for row in range(rows)],.01,gold,cape)
    for loc in clasps: sphere('cape clasp',loc,clasp_size,gold,root)

def sword(parent, gold, steel, heavy=False, axe=False, hand=-.57):
    weapon=bpy.data.objects.new('weapon',None); bpy.context.collection.objects.link(weapon); weapon.parent=parent
    weapon.location=(0,0,hand); weapon.rotation_euler.x=2.1
    leather=material('weapon leather','#3b261e',rough=.8)
    rod('bound grip',(0,0,-.13),(0,0,.12),.038,leather,weapon)
    sphere('pommel',(0,0,-.16),(.06,.06,.06),gold,weapon)
    box('crossguard',(0,0,.13),(.34,.07,.065),gold,weapon,.024)
    if axe:
        rod('axe shaft',(0,0,0),(0,0,1),.035,leather,weapon)
        for sign in [-1,1]:
            blade=sphere('crescent axe head',(sign*.19,0,.78),(.26,.045,.25),steel,weapon)
            blade.rotation_euler.y=sign*.5
        gem('axe fire core',(0,-.05,.8),.075,material('ember light','#ff9e45',glow=2),weapon)
    else:
        width=.095 if heavy else .065; length=1.08 if heavy else .86
        verts=[(-width,0,.18),(0,-.026,.18),(width,0,.18),(0,.026,.18),(-width*.65,0,.18+length*.78),(0,-.018,.18+length*.78),(width*.65,0,.18+length*.78),(0,.018,.18+length*.78),(0,0,.18+length)]
        faces=[(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,8),(5,6,8),(6,7,8),(7,4,8),(3,2,1,0)]
        data=bpy.data.meshes.new('forged blade'); data.from_pydata(verts,[],faces); data.update()
        obj=bpy.data.objects.new('silver blade',data); bpy.context.collection.objects.link(obj); mesh_finish(obj,'silver blade',steel,weapon)
        rod('blade fuller',(0,-.029,.25),(0,-.022,.18+length*.76),.008,gold,weapon)

def humanoid(root, kind):
    hero=kind=='hero'; royal=kind=='boss'; ravager=kind=='ravager'
    skin=material('warm skin','#d8a67c',rough=.68)
    olive=material('forest cloth','#43594c',rough=.88)
    steel=material('moon steel','#a8b7b9',.8,.28)
    armor=material('stone green','#637268',.28,.62) if not ravager else material('black iron','#343d43',.75,.35)
    gold=material('aged brass','#bc9555',.65,.32)
    dark=material('charcoal','#17212a',rough=.8)
    leather=material('worn leather','#624534',rough=.75)
    boot=material('dark leather','#332b27',rough=.8)
    plate=leather if hero else armor
    torso=joint('torso',(0,0,0),root,'torso')
    sphere('tunic body',(0,0,1.26),(.33,.21,.42),olive if hero else plate,torso)
    chest=cone('cuirass',(0,-.015,1.43),.29,.45,plate,torso,.35)
    chest.scale.y=.65
    for side in [-1,1]:
        box('segmented chest',(side*.15,-.17,1.49),(.25,.1,.27),plate,torso,.05)
        rod('chest trim',(side*.03,-.23,1.57),(side*.26,-.17,1.57),.014,gold,torso)
        for z in [1.30,1.39,1.48]: sphere('rivet',(side*.245,-.17,z),(.018,.018,.018),gold,torso,10)
    belt=cone('broad belt',(0,0,1.03),.32,.12,leather,torso,.32); belt.scale.y=.69
    box('belt buckle',(0,-.24,1.03),(.12,.045,.1),gold,torso,.012)
    box('belt inset',(0,-.268,1.03),(.07,.012,.052),dark,torso,.005)
    for side in [-1,1]:
        hip=joint('leg_left' if side<0 else 'leg_right',(side*.18,0,.97),root,'legL' if side<0 else 'legR')
        sphere('trouser thigh',(0,0,-.2),(.14,.145,.26),dark,hip)
        sphere('knee guard',(0,-.1,-.43),(.14,.10,.13),leather if hero else armor,hip)
        rod('shin',(0,0,-.4),(0,0,-.78),.105,boot,hip,.94)
        sphere('boot toe',(0,-.105,-.84),(.125,.23,.11),boot,hip)
        for z in [-.55,-.68]:
            box('boot strap',(0,-.105,z),(.21,.035,.045),leather,hip,.01)
            box('boot clasp',(.075,-.13,z),(.035,.02,.04),gold,hip,.005)
        arm=joint('arm_left' if side<0 else 'arm_right',(side*.36,0,1.61),torso,'armL' if side<0 else 'armR')
        sphere('shoulder pauldron',(side*.035,0,-.015),(.19,.18,.15),plate,arm)
        rod('upper sleeve',(0,0,-.05),(0,0,-.31),.105,olive if hero else armor,arm)
        sphere('elbow',(0,0,-.32),(.11,.10,.10),skin if hero else dark,arm)
        rod('forearm bracer',(0,0,-.33),(0,0,-.54),.105,leather if hero else armor,arm,.8)
        box('bracer trim',(0,-.095,-.43),(.12,.025,.16),gold,arm,.016)
        sphere('gloved hand',(0,-.015,-.59),(.085,.09,.105),boot,arm)
        if side>0: sword(arm,gold,steel,not hero,ravager)
        arm.rotation_euler.x=-.7 if side>0 else -.15
        arm.rotation_euler.y=side*-.1
        JOINTS[-1:] # Base rotations are captured again before animation.
    head=joint('head',(0,-.005,1.81),torso,'head')
    if hero:
        rod('neck',(0,0,-.12),(0,0,.015),.09,skin,head)
        sphere('face',(0,-.025,.08),(.16,.145,.205),skin,head)
        sphere('nose',(0,-.166,.075),(.035,.045,.042),skin,head)
        hair=material('chestnut hair','#422b23',rough=.9)
        sphere('hair crown',(0,.015,.19),(.179,.156,.148),hair,head)
        for i in range(10):
            a=i*2.39996; x=math.sin(a)*.13; y=math.cos(a)*.13
            tuft=cone('swept hair',(x,y,.205+(i%3)*.025),.065,.20,hair,head,vertices=7)
            tuft.rotation_euler=(.35+(i%2)*.4,-.5, a)
        for sign in [-1,1]:
            sphere('eye white',(sign*.065,-.148,.105),(.037,.012,.018),material('eye ivory','#eee2c5'),head)
            sphere('iris',(sign*.066,-.159,.105),(.014,.008,.015),dark,head)
            brow=rod('brow',(sign*.035,-.158,.148),(sign*.10,-.142,.16),.012,hair,head)
            sphere('ear',(sign*.157,-.005,.08),(.037,.028,.055),skin,head)
        curve('mouth',[(-.035,-.151,.012),(0,-.16,.007),(.035,-.151,.012)],.005,leather,head)
    else:
        sphere('armored helm',(0,0,.08),(.21,.18,.25),plate,head)
        box('dark visor',(0,-.165,.10),(.32,.045,.11),dark,head,.028)
        for sign in [-1,1]:
            box('glowing eye',(sign*.079,-.192,.11),(.089,.012,.022),material('gold eyes','#ffd18a',glow=2.3),head,.008)
            rod('helm cheek trim',(sign*.17,-.13,.16),(sign*.14,-.13,-.09),.018,gold,head)
        rod('helm center ridge',(0,-.19,-.08),(0,-.19,.30),.022,gold,head)
        gem('chest rune',(0,-.235,1.43),.078,material('rune light','#f0ae65' if ravager else '#96d8b7',glow=1.8),torso)
        if royal:
            ring=cone('golden crown',(0,0,.31),.225,.10,gold,head,.225); ring.scale.y=.85
            for i in range(7):
                a=i*math.tau/7
                cone('crown point',(math.cos(a)*.20,math.sin(a)*.16,.43),.05,.22,gold,head,vertices=8)
            gem('crown jewel',(0,-.184,.34),.055,material('royal amber','#ffbc63',glow=1),head)
        if ravager:
            for side in [-1,1]:
                for j in range(3):
                    spike=cone('shoulder spike',(side*(.32+j*.06),.015,1.77),.055,.22,steel,torso,vertices=7)
                    spike.rotation_euler.y=side*.8
    if hero or royal: cloth(root,royal)
    if not hero:
        for x in [-.22,0,.22]: box('hanging armor plate',(x,-.17,.88),(.19,.08,.29),plate,root,.035)
    if royal: root.scale=(1.2,1.2,1.2)
    elif not hero: root.scale=(1.12,1.12,1.12)

def hero(root):
    """약 4.8등신의 날렵한 젊은 검사. 넓은 어깨·좁은 허리·긴 다리와 작은 눈·결연한 눈썹으로
    2D 일러스트(assets/illustrations/hero.webp)의 인상에 맞춘다.
    관절 이름(torso·head·arm_*·leg_*·cape)은 전투 연출·검사와 공유하므로 바꾸지 않는다."""
    skin=material('warm skin','#dcaa84',rough=.68)
    tunic=material('forest tunic','#466346',rough=.88)
    tunic_dark=material('tunic hem','#33493a',rough=.9)
    steel=material('moon steel','#a8b7b9',.8,.28)
    gold=material('aged brass','#bc9555',.65,.32)
    trousers=material('navy trousers','#2a3040',rough=.85)
    leather=material('worn leather','#6e4a33',rough=.75)
    boot=material('dark leather','#3a2a22',rough=.8)
    hair=material('chestnut hair','#4a2b1e',rough=.9)
    shine=material('eye shine','#ffffff',glow=.6)
    # 이름이 ' detail'로 끝나는 재질은 게임에서 외곽선을 붙이지 않는다(src/game/three/toon.js).
    ivory=material('eye white detail','#f1e8d4')
    iris=material('iris detail','#2e2219',rough=.4)
    nose=material('nose detail','#dcaa84',rough=.68)
    brow=material('brow detail','#2f1a12',rough=.9)
    lips=material('mouth detail','#7d4535',rough=.8)

    torso=joint('torso',(0,0,0),root,'torso')
    # 허리에서 어깨로 넓어지는 역삼각형 몸통. 앞면을 납작하게 해 둥근 가슴처럼 보이지 않게 한다.
    chest=cone('chest',(0,0,1.29),.155,.44,tunic,torso,.215,20); chest.scale.y=.6
    sphere('shoulder line',(0,0,1.48),(.215,.125,.075),tunic,torso)
    skirt=cone('tunic skirt',(0,0,.97),.215,.26,tunic_dark,torso,.165); skirt.scale.y=.78
    cone('collar',(0,-.005,1.535),.095,.06,tunic_dark,torso,.07)
    rod('chest strap',(-.17,-.125,1.49),(.15,-.13,1.07),.022,leather,torso,1)
    box('strap buckle',(-.01,-.15,1.29),(.05,.025,.05),gold,torso,.008)
    belt=cone('broad belt',(0,0,1.065),.185,.07,leather,torso,.185); belt.scale.y=.76
    box('belt buckle',(0,-.145,1.065),(.075,.03,.06),gold,torso,.01)
    box('belt pouch',(.155,-.085,1.0),(.08,.06,.09),leather,torso,.02)

    for side in [-1,1]:
        hip=joint('leg_left' if side<0 else 'leg_right',(side*.095,0,1.0),root,'legL' if side<0 else 'legR')
        rod('trouser thigh',(0,0,-.02),(0,0,-.46),.072,trousers,hip,.82)
        sphere('knee pad',(0,-.055,-.48),(.058,.045,.06),leather,hip)
        rod('boot shaft',(0,0,-.50),(0,0,-.88),.06,boot,hip,1.12)
        cone('boot cuff',(0,0,-.51),.075,.06,leather,hip,.07)
        sphere('boot toe',(0,-.05,-.935),(.068,.125,.06),boot,hip)
        box('boot strap',(0,-.058,-.70),(.12,.025,.028),leather,hip,.006)
        hip.rotation_euler.y=-side*.06  # 발을 어깨너비로 벌린 안정된 자세

        arm=joint('arm_left' if side<0 else 'arm_right',(side*.245,0,1.47),torso,'armL' if side<0 else 'armR')
        sphere('shoulder pad',(side*.018,0,.005),(.082,.078,.065),leather,arm)
        rod('upper sleeve',(0,0,-.02),(0,0,-.26),.054,tunic,arm,.9)
        rod('forearm bracer',(0,0,-.26),(0,0,-.46),.056,leather,arm,.82)
        box('bracer trim',(0,-.05,-.36),(.06,.016,.12),gold,arm,.008)
        sphere('gloved hand',(0,-.008,-.51),(.05,.054,.058),boot,arm)
        if side>0: sword(arm,gold,steel,hand=-.52)
        arm.rotation_euler.x=-.7 if side>0 else -.15
        arm.rotation_euler.y=side*-.1

    head=joint('head',(0,-.005,1.555),torso,'head')
    rod('neck',(0,0,-.05),(0,0,.07),.052,skin,head,1)
    sphere('skull',(0,-.005,.21),(.145,.155,.17),skin,head,20)
    jaw=cone('jaw',(0,-.03,.095),.05,.15,skin,head,.125,20); jaw.scale.y=.95
    sphere('nose',(0,-.163,.165),(.016,.02,.022),nose,head)
    for sign in [-1,1]:
        sphere('ear',(sign*.143,0,.19),(.028,.02,.045),skin,head)
        sphere('eye white',(sign*.057,-.141,.204),(.034,.012,.021),ivory,head)
        sphere('iris',(sign*.055,-.149,.203),(.019,.008,.02),iris,head)
        sphere('eye shine',(sign*.049,-.155,.21),(.005,.003,.005),shine,head)
        rod('brow',(sign*.022,-.153,.232),(sign*.098,-.137,.252),.0095,brow,head,.65)
        rod('upper lash',(sign*.026,-.152,.216),(sign*.09,-.141,.221),.0055,brow,head,.7)
    curve('mouth',[(-.026,-.148,.105),(0,-.151,.103),(.026,-.148,.105)],.0045,lips,head)

    sphere('hair crown',(0,.03,.30),(.16,.17,.12),hair,head,20)
    sphere('hair back',(0,.065,.20),(.148,.125,.16),hair,head,20)
    for x in [-.11,-.055,0,.055,.11]:
        rod('fringe lock',(x,-.10,.37),(x*1.25+.045,-.162,.27-abs(x)*.25),.042,hair,head,.06)
    for i,x in enumerate([-.12,-.06,0,.06,.12]):
        rod('swept spike',(x,.0,.39),(x*1.45,.20,.35+(i%2)*.04),.05,hair,head,.06)
    for sign in [-1,1]:
        rod('side lock',(sign*.14,-.03,.28),(sign*.155,-.055,.15),.032,hair,head,.1)

    cloth(root,top=(0,.14,1.48),length=1.0,width=(.20,.32),flare=.2,
          clasps=((-.13,-.12,1.50),(.13,-.12,1.50)),clasp_size=(.035,.028,.035))

def eye_pair(parent, z, y, spread, color='#ffd986', radius=.06):
    dark=material('eye sockets','#16232a')
    light=material('eyes '+color,color,rough=.25,glow=2)
    for sign in [-1,1]:
        sphere('eye socket',(sign*spread,y+.025,z),(.11,.065,.09),dark,parent)
        sphere('luminous eye',(sign*spread,y-.035,z),(radius,.04,radius*.7),light,parent)

def beast(root, kind):
    hound=kind=='hound'; scarab=kind=='scarab'
    color='#343444' if hound else '#526b55'
    bodymat=material('body '+kind,color,metal=.12 if not scarab else .6)
    body=joint('body',(0,0,0),root,'torso')
    sphere('body mass',(0,.1,.67),(.45,.75,.36),bodymat,body)
    if scarab:
        gold=material('bronze shell','#bc9555',.75,.3)
        jade=material('jade shell','#237b6b',.45,.25)
        for side in [-1,1]:
            sphere('segmented carapace',(side*.2,.15,.84),(.25,.6,.23),jade,body)
            curve('shell inlay',[(side*.10,-.4,.94),(side*.38,.1,.98),(side*.1,.66,.94)],.024,gold,body)
        gem('scarab core',(0,-.02,1.045),.14,material('scarab jewel','#75ecc8',.2,.25,1.2),body)
    else:
        for i in range(12):
            a=i*2.39996
            if hound:
                spike=cone('mane spine',(math.sin(a)*.28, -.17+i*.065,.97+(i%3)*.04),.10,.25,bodymat,body,vertices=7)
                spike.rotation_euler.x=.5
            else:
                sphere('mossy rock',(math.sin(a)*.30,math.cos(a)*.51+.1,.94),(.22,.22,.14),material('moss '+str(i%3),['#718666','#8a9964','#536b50'][i%3]),body)
    count=6 if scarab else 4
    for index in range(count):
        side=-1 if index%2 else 1; y=(-.35 if index<2 else .47) if count==4 else (index//2-1)*.4
        leg=joint('leg_'+str(index),(side*.30,y,.57),root,'legL' if index%2 else 'legR')
        if scarab:
            curve('articulated insect leg',[(0,0,0),(side*.36,-.04,-.06),(side*.48,-.10,-.52)],.045,material('insect bronze','#967843',.5),leg)
        else:
            rod('upper leg',(0,0,0),(side*.1,-.04,-.28),.12,bodymat,leg)
            rod('lower leg',(side*.1,-.04,-.28),(side*.12,-.14,-.49),.085,bodymat,leg)
            sphere('paw',(side*.12,-.22,-.50),(.14,.22,.08),bodymat,leg)
            for toe in [-1,0,1]: cone('claw',(side*.12+toe*.067,-.39,-.48),.026,.10,material('ivory claw','#d8c6a3'),leg,vertices=7).rotation_euler.x=math.pi/2
    head=joint('head',(0,-.64,.75),root,'head')
    sphere('beast skull',(0,-.10,.03),(.29,.34,.25),bodymat,head)
    sphere('snout',(0,-.36,-.05),(.19,.24,.13),bodymat,head)
    eye_pair(head,.14,-.33,.18,'#f77a86' if hound else '#ffd986',.045)
    for sign in [-1,1]:
        if hound: cone('pointed ear',(sign*.20,.01,.27),.115,.35,bodymat,head,vertices=9)
        if scarab:
            curve('scarab horn',[(sign*.15,-.30,.08),(sign*.28,-.50,.38),(sign*.14,-.55,.58)],.05,material('bronze shell','#bc9555',.75,.3),head)
        else:
            cone('fang',(sign*.13,-.48,-.12),.037,.16,material('ivory claw','#d8c6a3'),head,vertices=7).rotation_euler.x=math.pi
    if hound: curve('tail',[(0,.7,.7),(0,1.05,.73),(.1,1.2,1.1)],.075,bodymat,root)
    root.scale=(1.1,1.1,1.1)

def spirit(root, kind):
    color={'ember':'#fa9b42','wisp':'#7fcfef','watcher':'#b48dec'}[kind]
    main=material('spirit '+kind,color,rough=.22,glow=.55)
    gold=material('spirit brass','#bc9555',.75,.3)
    body=joint('body',(0,0,.2),root,'spirit')
    sphere('spirit heart',(0,0,.9),(.34,.28,.44),main,body)
    for i in range(9):
        angle=i*math.tau/9
        pts=[(math.cos(angle)*.25,math.sin(angle)*.2,.65),(math.cos(angle+.3)*.36,math.sin(angle+.3)*.3,1.15),(math.cos(angle+.6)*.25,math.sin(angle+.6)*.3,1.65+(i%3)*.13)]
        curve('flowing flame',pts,.055+(i%2)*.02,main,body)
    curve('ethereal tail',[(0,0,.9),(.18,.1,.45),(-.1,.15,.15),(.07,.1,.02)],.10,main,body)
    mask=material('spirit mask','#67563d',.75,.35)
    sphere('mask',(0,-.24,1.02),(.30,.09,.31),mask,body)
    for sign in [-1,1]:
        curve('mask filigree',[(sign*.24,-.32,1.21),(sign*.17,-.36,1.1),(sign*.04,-.34,.82)],.018,gold,body)
    eye_pair(body,1.09,-.325,.11,color,.065)
    if kind=='watcher':
        for sign in [-1,1]:
            curve('mask horns',[(sign*.2,-.2,1.2),(sign*.37,-.15,1.49),(sign*.30,-.17,1.71)],.05,gold,body)
        for i in range(5):
            a=i*math.tau/5
            gem('orbiting crystal',(math.cos(a)*.65,math.sin(a)*.4,.9+math.sin(a)*.4),.085,gold,body)

def odd(root, kind):
    if kind=='slime':
        jade=material('jade jelly','#329e78',metal=.15,rough=.15)
        body=joint('body',(0,0,0),root,'slime')
        sphere('jelly dome',(0,0,.43),(.68,.57,.49),jade,body)
        for i in range(7):
            a=i*math.tau/7; sphere('jelly foot',(math.cos(a)*.5,math.sin(a)*.4,.12),(.23,.21,.12),jade,body)
        eye_pair(body,.51,-.51,.20,'#ffe7a1',.055)
        gem('jelly light',(0,-.18,.72),.12,material('jelly core','#b8ffab',glow=1.5),body)
        for i in range(7): sphere('bubble',(math.sin(i*2.4)*.38,math.cos(i*2.4)*.25,.3+(i%3)*.16),(.04,.04,.04),material('jelly bubble','#79d4a5',.1,.2),body,10)
    elif kind=='mushroom':
        stem=material('ivory stalk','#d6c39b',rough=.8)
        body=joint('body',(0,0,0),root,'torso')
        sphere('stalk',(0,0,.56),(.25,.25,.55),stem,body)
        cap=joint('head',(0,0,1.13),body,'head')
        burgundy=material('plum cap','#893b62',rough=.7)
        sphere('mushroom cap',(0,0,.06),(.72,.64,.32),burgundy,cap)
        sphere('gills',(0,0,-.09),(.65,.56,.08),stem,cap)
        for i in range(11):
            a=i*2.39996; r=.19+(i%3)*.13
            sphere('cap ivory spots',(math.cos(a)*r,math.sin(a)*r,.30-(r/.7)**2*.2),(.085,.075,.026),stem,cap,12)
        for sign in [-1,1]:
            curve('root arm',[(sign*.17,0,.65),(sign*.36,-.03,.38),(sign*.42,-.14,.32)],.055,stem,body)
            sphere('root foot',(sign*.22,-.07,.12),(.23,.28,.10),stem,body)
        eye_pair(body,.67,-.24,.10,'#ffd286',.035)
    elif kind=='bat':
        violet=material('bat velvet','#423953',rough=.78)
        membrane=material('wing membrane','#626c92',rough=.65)
        body=joint('body',(0,0,.4),root,'spirit')
        sphere('bat body',(0,0,.60),(.18,.18,.33),violet,body)
        sphere('bat head',(0,-.04,.89),(.21,.16,.19),violet,body)
        eye_pair(body,.93,-.17,.085,'#ffa1ae',.035)
        for sign in [-1,1]:
            cone('bat ear',(sign*.14,0,1.11),.09,.28,violet,body,vertices=9)
            wing=joint('wing_left' if sign<0 else 'wing_right',(sign*.13,.02,.76),body,'wingL' if sign<0 else 'wingR')
            points=[(0,0,0),(sign*.35,.01,.35),(sign*.90,.03,.51),(sign*.78,.02,-.12),(sign*.48,.02,-.03),(sign*.25,.01,-.26)]
            data=bpy.data.meshes.new('bat wing'); data.from_pydata(points,[],[(0,1,2),(0,2,3),(0,3,4),(0,4,5)]); data.update()
            obj=bpy.data.objects.new('leathery wing',data); bpy.context.collection.objects.link(obj); mesh_finish(obj,'leathery wing',membrane,wing)
            for p in [points[2],points[3],points[4],points[5]]: rod('wing finger',(0,0,0),p,.019,violet,wing)
            curve('wing leading edge',points[:3],.026,violet,wing)

def animate():
    # Rigid articulated joints retain complete meshes; all clips are in the GLB.
    bases=[(obj,role,tuple(obj.location),tuple(obj.rotation_euler),tuple(obj.scale)) for obj,role,*_ in JOINTS]
    for clip in ['idle','walk','attack','hit','guard','victory','death']:
        length=48 if clip in ['idle','walk'] else 30
        for obj,role,loc,rot,scale in bases:
            action=bpy.data.actions.new(clip+'_'+obj.name)
            obj.animation_data_create(); obj.animation_data.action=action
            for frame in range(1,length+1,3):
                t=(frame-1)/(length-1); wave=math.sin(t*math.tau)
                obj.location=loc; obj.rotation_euler=rot; obj.scale=scale
                if clip=='idle':
                    if role in ['torso','spirit']: obj.location.z+=math.sin(t*math.tau)*(.045 if role=='spirit' else .012)
                    if role=='cape': obj.rotation_euler.x+=wave*.045
                    if role=='slime': obj.scale.z=1+wave*.04
                    if role in ['wingL','wingR']: obj.rotation_euler.y=wave*(.34 if role=='wingL' else -.34)
                if clip=='walk':
                    if role in ['legL','armR']: obj.rotation_euler.x+=wave*.38
                    if role in ['legR','armL']: obj.rotation_euler.x-=wave*.38
                    if role=='torso': obj.location.z+=abs(wave)*.025
                    if role=='cape': obj.rotation_euler.x=-.15+wave*.05
                pulse=math.sin(math.pi*t)
                if clip=='attack':
                    if role=='armR':
                        # Anticipation, forward contact, then follow-through.
                        swing=-1.25*math.sin(t/.3*math.pi/2) if t<.3 else -1.25+(t-.3)/.28*2.15 if t<.58 else .9*(1-(t-.58)/.42)
                        obj.rotation_euler.x+=swing
                    if role=='armL': obj.rotation_euler.x-=pulse*.35
                    if role in ['torso','head']: obj.rotation_euler.z+=pulse*.25
                    if role=='slime': obj.scale=(1+pulse*.15,1+pulse*.15,1-pulse*.18)
                    if role=='spirit': obj.location.z+=pulse*.17
                    if role in ['wingL','wingR']: obj.rotation_euler.y=wave*(.6 if role=='wingL' else -.6)
                if clip=='hit':
                    if role=='torso': obj.rotation_euler.x+=pulse*.25
                    if role=='head': obj.rotation_euler.x+=pulse*.18
                if clip=='guard' and role in ['armL','armR']: obj.rotation_euler.x-=pulse*1.1
                if clip=='victory' and role=='armR': obj.rotation_euler.x-=pulse*2.3
                if clip=='death' and role=='torso': obj.rotation_euler.x+=t*1.35; obj.location.z-=t*.20
                for prop in ['location','rotation_euler','scale']: obj.keyframe_insert(data_path=prop,frame=frame)
            track=obj.animation_data.nla_tracks.new(); track.name=clip
            strip=track.strips.new(clip,1,action); strip.name=clip
            obj.animation_data.action=None
            obj.location=loc; obj.rotation_euler=rot; obj.scale=scale

def optimize_meshes():
    groups={}
    for obj in list(bpy.context.scene.objects):
        if obj.type=='MESH' and len(obj.data.materials)==1:
            groups.setdefault((obj.parent, obj.data.materials[0]),[]).append(obj)
    for (parent,mat),objects in groups.items():
        if len(objects)<2: continue
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objects: obj.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        bpy.ops.object.join()
        objects[0].name=(parent.name if parent else 'root')+'_'+mat.name

catalog=['hero','crawler','sentinel','ember','bat','slime','mushroom','scarab','wisp','hound','ravager','watcher','boss']
# 게임의 용사는 Kenney Mini Characters(CC0)를 scripts/import_kenney_hero.py로 변환한 모델이다.
# 그래서 기본 실행은 몬스터 12종만 만든다. 이 파일의 hero()는 직접 조형한 이전 용사로,
# `-- hero`를 명시했을 때만 public/models/hero.glb를 그 모델로 되돌린다.
default=[name for name in catalog if name!='hero']
manifest={'source':'scripts/create_3d_assets.py, scripts/import_kenney_hero.py','license':'Monsters: original S’word Master artwork (scripts/create_3d_assets.py). Hero: Kenney Mini Characters, CC0 (scripts/import_kenney_hero.py).','coordinateSystem':'glTF Y-up, forward +Z, feet at Y=0','models':{}}
# `-- sentinel boss` 처럼 이름을 넘기면 해당 모델만 다시 만든다. 만들지 않은 모델의 manifest 항목은 항상 유지한다.
selected=[name for name in (sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []) if name in catalog]
if (OUT/'manifest.json').exists():
    manifest['models']=json.loads((OUT/'manifest.json').read_text())['models']
for kind in (selected or default):
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
    MATS={}; JOINTS=[]
    root=bpy.data.objects.new(kind,None); bpy.context.collection.objects.link(root)
    if kind=='hero': hero(root)
    elif kind in ['sentinel','ravager','boss']: humanoid(root,kind)
    elif kind in ['crawler','hound','scarab']: beast(root,kind)
    elif kind in ['ember','wisp','watcher']: spirit(root,kind)
    else: odd(root,kind)
    optimize_meshes()
    animate()
    bpy.context.scene.frame_start=1; bpy.context.scene.frame_end=48; bpy.context.scene.render.fps=24
    bpy.context.scene.frame_set(1)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_OUT/(kind+'.blend')),copy=True,compress=True)
    bpy.ops.object.select_all(action='SELECT')
    filepath=OUT/(kind+'.glb')
    options=dict(filepath=str(filepath),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_nla_strips=True,export_force_sampling=True,export_frame_range=False,export_materials='EXPORT',export_cameras=False,export_lights=False)
    supported=bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
    bpy.ops.export_scene.gltf(**{key:value for key,value in options.items() if key in supported})
    raw=filepath.read_bytes(); count=struct.unpack_from('<I',raw,12)[0]
    data=json.loads(raw[20:20+count])
    manifest['models'][kind]={'file':kind+'.glb','bytes':len(raw),'clips':[item['name'] for item in data.get('animations',[])],'meshes':len(data.get('meshes',[])),'rig':'articulated transform hierarchy','ground':0}
    print('SWORD_MODEL',kind,filepath.stat().st_size,flush=True)
manifest['models']={name:manifest['models'][name] for name in catalog if name in manifest['models']}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n')
print('SWORD_MODELS_COMPLETE',len(selected or default),flush=True)
