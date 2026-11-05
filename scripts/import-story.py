"""Import chapter dialogue from the supplied DOCX; planning sections stay out of the UI."""
import json
import re
import sys
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile

source = Path(sys.argv[1])
target = Path(__file__).resolve().parents[1] / 'src/data/bronze-story.json'
ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
with ZipFile(source) as archive:
    document = ET.fromstring(archive.read('word/document.xml'))
paragraphs = [
    ''.join(text.text or '' for text in paragraph.findall('.//w:t', ns)).strip()
    for paragraph in document.findall('.//w:body/w:p', ns)
]

# These bridges describe what happens in the story-only reader. The document's
# suggested quiz implementation is not imported as application instructions.
bridges = [
    '용사가 단어의 의미를 해독하자, 검에 작은 빛이 생긴다. 잘못 붙은 계약 스티커가 떨어져 나간다.',
    '마법 표지판의 문구가 바로잡힌다. 화살표가 제자리를 찾고, 잠긴 길이 하나씩 열린다.',
    '뒤섞인 주문의 의미가 제자리를 찾는다. 바닥의 그림 타일이 돌아가며 길을 드러낸다.',
    '용사가 마법판의 명령을 해독한다. 잠긴 소품 문 너머로 길이 열린다.',
    '충돌하던 명령이 바로잡힌다. 혼자 움직이던 소품들이 멈추고 행사장 통로가 정리된다.',
    '광고 문구의 의미가 드러날 때마다 카드의 불빛이 꺼진다. 보스의 가짜 분신이 하나씩 사라진다.',
    '용사가 뒤집힌 명령을 차례로 해독한다. 거짓 경고와 조작된 광고 문장이 힘을 잃는다.',
]
locations = ['어둠의 석문', '루미페스타 · 환영의 광장', '루미페스타 · 환영의 광장',
             '루미페스타 · 장난의 골목', '행사장 · 무대 뒷길', '행사장 · 결승 무대',
             '행사장 · 시상식', '루미페스타 · 축제가 끝난 광장']
backgrounds = ['entrance', 'plaza', 'plaza', 'plaza', 'backstage', 'stage', 'stage', 'ending']
scenes = []
bridge_index = 0
for paragraph in paragraphs:
    match = re.match(r'^(S0[1-8]) — (.+)$', paragraph)
    if match:
        index = len(scenes)
        scenes.append({'id': match[1], 'title': match[2], 'location': locations[index],
                       'background': backgrounds[index], 'lines': []})
        continue
    if not scenes:
        continue
    if paragraph.startswith('4. 학습과 전투 구성'):
        break
    if not paragraph or paragraph.startswith(('장면 목표', '장면 끝:', 'CHAPTER CLEAR:')):
        continue
    if paragraph.startswith('[학습 연결'):
        scenes[-1]['lines'].append({'speaker': '내레이션', 'text': bridges[bridge_index]})
        bridge_index += 1
        continue
    dialogue = re.match(r'^(.+?)\s{2,}“(.*)”$', paragraph)
    if dialogue:
        scenes[-1]['lines'].append({'speaker': dialogue[1], 'text': dialogue[2]})
        continue
    if paragraph.startswith('['):
        text = re.sub(r'^\[[^]]+\]\s*', '', paragraph)
        if scenes[-1]['id'] == 'S01' and not scenes[-1]['lines']:
            text = '어두운 석벽 앞. 횃불이 한 번 흔들리고, 용사가 던전 문 앞에서 멈춘다. 발걸음과 바람 소리만 남는다.'
        text = text.replace('마지막 정답 연출과 함께', '마지막 명령이 해제되자')
        text = text.replace('사라진 존재가 아니라 공연을 마친 듯한 연출이다.', '마치 공연을 마친 배우 같다.')
        if paragraph.startswith('[장면 전환]'):
            text = '첫 번째 가면 조각을 손에 넣었다. 이제, 지워진 오늘의 기록을 찾아야 한다. 다음 목적지는 팔레트 마법학교다.'
        scenes[-1]['lines'].append({'speaker': '내레이션', 'text': text})
        continue
    raise ValueError(f'Unrecognized story paragraph: {paragraph}')

assert len(scenes) == 8 and bridge_index == 7
story = {
    'id': 'bronze-chapter-01-v1', 'tier': 'bronze', 'chapter': 1,
    'title': '던전에 오신 걸 환영합니다!', 'subtitle': '환락의 던전',
    'source': source.name, 'scenes': scenes,
}
target.write_text(json.dumps(story, ensure_ascii=False, indent=2) + '\n')
print(f'Imported {len(scenes)} scenes / {sum(len(scene["lines"]) for scene in scenes)} lines into {target}')
