"""Lossless export of the user's Pixelorama RGBA cel; never changes the .pxo.
Run: python3 scripts/export_hero.py [--check]
Only the current single-layer, single-frame format is accepted explicitly.
"""
import argparse
import binascii
import hashlib
import json
import re
import struct
import zlib
from pathlib import Path
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/concepts/young-warrior-pixel.png.pxo'
TARGET = ROOT / 'assets/sprites/hero-young.png'
MANIFEST = TARGET.with_suffix('.json')

def export_bytes(path):
    with ZipFile(path) as archive:
        data = json.loads(archive.read('data.json'))
        if data.get('color_mode') != 5 or len(data['layers']) != 1 or len(data['frames']) != 1:
            raise ValueError('Expected one RGBA8 layer and one frame; export layered animation with Pixelorama instead.')
        layer = data['layers'][0]
        cel = data['frames'][0]['cels'][0]
        if not layer.get('visible', True) or layer.get('opacity', 1) != 1 or cel.get('opacity', 1) != 1:
            raise ValueError('Expected a fully visible layer/cel.')
        width, height = data['size_x'], data['size_y']
        if (width, height) != (64, 64):
            raise ValueError('Hero canvas must remain 64 x 64.')
        cw, ch = map(int, re.fullmatch(r'Vector2i\((\d+), (\d+)\)', cel['image_size']).groups())
        ox, oy = map(int, re.fullmatch(r'\((-?\d+), (-?\d+)\)', cel['offset']).groups())
        raw = archive.read('image_data/frames/1/layer_1')
        if len(raw) != cw * ch * 4:
            raise ValueError('Invalid RGBA cel size.')
        pixels = bytearray(width * height * 4)
        for y in range(ch):
            for x in range(cw):
                if 0 <= ox + x < width and 0 <= oy + y < height:
                    dest = ((oy + y) * width + ox + x) * 4
                    pixels[dest:dest + 4] = raw[(y * cw + x) * 4:(y * cw + x + 1) * 4]
    def chunk(tag, value):
        return struct.pack('>I', len(value)) + tag + value + struct.pack('>I', binascii.crc32(tag + value) & 0xffffffff)
    scanlines = b''.join(b'\0' + pixels[y * width * 4:(y + 1) * width * 4] for y in range(height))
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(scanlines, 9)) + chunk(b'IEND', b'')
    metadata = {'source': str(path.relative_to(ROOT)), 'sourceSha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                'width': width, 'height': height, 'frames': 1, 'anchor': {'x': 32, 'y': 61},
                'note': 'Exact Pixelorama RGBA cel export; eye and face pixels preserved.'}
    return png, (json.dumps(metadata, ensure_ascii=False, indent=2) + '\n').encode()

def main():
    parser = argparse.ArgumentParser(); parser.add_argument('--check', action='store_true'); args = parser.parse_args()
    png, metadata = export_bytes(SOURCE)
    if args.check:
        if not TARGET.exists() or TARGET.read_bytes() != png or not MANIFEST.exists() or MANIFEST.read_bytes() != metadata:
            raise SystemExit('Hero PNG is out of date. Run npm run assets:hero.')
        print('Hero PNG exactly matches the saved Pixelorama source.')
    else:
        TARGET.write_bytes(png); MANIFEST.write_bytes(metadata)
        print('Exported', TARGET.relative_to(ROOT), '(64x64, original RGBA pixels preserved).')

if __name__ == '__main__': main()
