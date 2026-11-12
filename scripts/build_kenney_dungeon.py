"""Kenney 'Mini Dungeon'(CC0) 부품을 게임이 한 번에 읽는 하나의 GLB로 묶는다. Blender 4.3+:
blender --background --factory-startup --python scripts/build_kenney_dungeon.py

- assets/kenney/mini-dungeon/*.glb 를 모두 읽어 부품 이름(floor, wall, barrel …)을 노드 이름으로 붙인다.
- 모든 부품은 원점에 겹쳐 둔다. 배치·크기는 게임(src/game/three/kenneyDungeon.js)이 정한다.
- 색상표 텍스처 한 장을 GLB 안에 넣어 public/models/dungeon-kit.glb 로 내보낸다.
- 상자·문·함정의 열림 동작은 쓰지 않으므로 내보내지 않는다.
"""
import bpy
import json
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/kenney/mini-dungeon'
TARGET = ROOT / 'public/models/dungeon-kit.glb'

bpy.context.preferences.view.use_translate_new_dataname = False
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

pieces = sorted(path.stem for path in SOURCE.glob('*.glb'))
for name in pieces:
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(SOURCE / f'{name}.glb'))
    created = set(bpy.data.objects) - before
    roots = [obj for obj in created if obj.parent is None]
    if len(roots) == 1:
        root = roots[0]
    else:  # 여러 조각이면 빈 물체 하나로 묶는다
        root = bpy.data.objects.new(name, None)
        bpy.context.collection.objects.link(root)
        for obj in roots:
            obj.parent = root
    root.name = name
    for obj in created:
        if obj.type == 'MESH':
            obj.data.name = name if obj is root else f'{name}-{obj.name}'
    if root.animation_data:
        root.animation_data_clear()
    for obj in created:
        if obj.animation_data:
            obj.animation_data_clear()

for action in list(bpy.data.actions):
    bpy.data.actions.remove(action)

# 부품마다 같은 색상표 재질이 따로 들어오므로 하나로 합친다(게임에서 재질 하나를 공유한다).
shared = None
for obj in bpy.data.objects:
    if obj.type != 'MESH':
        continue
    for slot in obj.material_slots:
        shared = shared or slot.material
        slot.material = shared
shared.name = 'colormap'

bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(TARGET), export_format='GLB', use_selection=True, export_animations=False,
                          export_cameras=False, export_lights=False, export_image_format='AUTO')

raw = TARGET.read_bytes()
count = struct.unpack_from('<I', raw, 12)[0]
data = json.loads(raw[20:20 + count])
manifest_path = TARGET.parent / 'manifest.json'
manifest = json.loads(manifest_path.read_text())
manifest['dungeon'] = {
    'file': TARGET.name,
    'bytes': len(raw),
    'pieces': [node['name'] for node in data['nodes'] if node.get('name') in pieces],
    'source': 'Kenney Mini Dungeon 2.0, CC0 — scripts/build_kenney_dungeon.py',
}
manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n')
print('SWORD_DUNGEON', len(raw), len(manifest['dungeon']['pieces']), flush=True)
