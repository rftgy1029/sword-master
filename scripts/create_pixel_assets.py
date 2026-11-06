"""Original S’word Master pixel art. Rebuild transparent sheets; edit .pxo for hand changes.
No external artwork, resampling or generated imagery is used.
"""
from PIL import Image, ImageDraw
from pathlib import Path
import math
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/sprites'
INK = '#18252a'

def canvas():
    im = Image.new('RGBA', (64,64)); return im, ImageDraw.Draw(im)
def poly(d, pts, fill, outline=INK): d.polygon(pts, fill=fill, outline=outline)
def box(d, xy, fill): d.rectangle(xy, fill=fill)
def eye(d,x,y,c='#fff3ac'):
    box(d,(x-1,y-1,x+3,y+2), INK); box(d,(x,y,x+2,y+1),c)
def jewel(d,x,y,c):
    poly(d,[(x,y-5),(x+4,y),(x,y+6),(x-4,y)],c); box(d,(x,y-3,x+1,y),'#f7f3d4')

def creature(kind, frame):
    im,d=canvas(); shift=[0,1,0,0,-2,1][frame]
    # Body silhouettes, stepped shading, edge highlights and distinct anatomy.
    if kind=='crawler':
        for x in [12,22,36,46]:
            poly(d,[(x,38),(x-6,48),(x-5,55),(x,54),(x+4,42)],'#687653')
            box(d,(x-5,53,x,54),'#c3b48a')
        poly(d,[(8,33),(15,23),(38,20),(53,29),(55,42),(46,48),(17,47),(7,41)],'#435d49')
        poly(d,[(12,32),(21,24),(38,24),(49,31),(48,39),(17,41)],'#6c8659')
        for x,y in [(20,27),(31,25),(42,29),(27,33),(38,36)]: box(d,(x,y,x+3,y+2),'#9da870')
        eye(d,17,36);eye(d,40,35);box(d,(24,43,36,44),INK)
        for x in [24,29,34]:box(d,(x,43,x+1,45),'#ddcfac')
    elif kind=='bat':
        wing=5 if frame in [1,2] else 0
        for mirror in [False,True]:
            pts=[(29,30),(20,15-wing),(6,12+wing),(2,36),(11,31),(16,42),(23,35)]
            if mirror:pts=[(64-x,y) for x,y in pts]
            poly(d,pts,'#5c6583'); pts2=[(26,29),(16,21),(9,20),(10,28),(17,33)]
            if mirror:pts2=[(64-x,y) for x,y in pts2]
            poly(d,pts2,'#96bdc8',None)
        poly(d,[(25,22),(24,10),(31,18),(38,10),(39,24),(43,35),(37,47),(29,49),(22,38)],'#403a5b')
        box(d,(28,35,36,42),'#6c5c7d');eye(d,27,28,'#a4f4ec');eye(d,36,28,'#a4f4ec')
        box(d,(29,35,30,38),'#f5eed2');box(d,(35,35,36,38),'#f5eed2')
    elif kind=='slime':
        poly(d,[(9,53),(5,45),(9,33),(16,22),(27,18),(40,20),(50,29),(57,44),(54,53)],'#316f68')
        poly(d,[(10,44),(17,30),(28,23),(40,25),(49,35),(51,45),(44,49),(17,48)],'#57b39a',None)
        box(d,(18,29,23,32),'#b3e7ba');box(d,(14,35,17,39),'#96d7aa')
        eye(d,24,39,'#e5ffd0');eye(d,40,39,'#e5ffd0');box(d,(29,45,36,46),'#24564e')
        for x in [14,22,43,50]:box(d,(x,51,x+3,53),'#86ce9e')
        jewel(d,34,30,'#d0e38a')
    elif kind=='mushroom':
        poly(d,[(23,31),(41,31),(43,52),(38,57),(22,56),(19,51)],'#b8ae8c')
        box(d,(24,35,28,51),'#ded1a4');eye(d,26,44);eye(d,36,44)
        poly(d,[(5,31),(10,18),(23,9),(39,10),(52,20),(58,32),(49,38),(16,37)],'#674661')
        poly(d,[(10,29),(17,19),(29,13),(40,15),(51,26),(51,31)],'#b86b82',None)
        for x,y in [(21,19),(36,21),(46,28),(14,29)]: jewel(d,x,y,'#f0cba4')
        box(d,(17,35,47,36),'#e5c3ad')
        for x in [18,26,36,44]:box(d,(x,36,x+1,39),'#8e6d77')
    elif kind=='scarab':
        for y in [29,39,47]:
            for x,sign in [(13,-1),(49,1)]:poly(d,[(x,y),(x+sign*9,y-3),(x+sign*11,y+5),(x+sign*7,y+7),(x,y+3)],'#746747')
        poly(d,[(18,22),(28,15),(38,16),(47,25),(49,44),(39,55),(24,55),(14,44),(14,29)],'#596b65')
        poly(d,[(17,30),(26,23),(30,24),(30,50),(23,48),(18,41)],'#c29a59')
        poly(d,[(34,24),(41,24),(45,32),(43,44),(35,51)],'#8f7648')
        box(d,(30,24,33,53),'#263d3d');jewel(d,32,31,'#8bdbc8')
        poly(d,[(21,20),(20,10),(26,15),(38,15),(45,9),(44,21),(36,25),(27,25)],'#475851');eye(d,25,20);eye(d,37,20)
    elif kind in ['wisp','ember','watcher']:
        cold=kind=='wisp'; elite=kind=='watcher'
        main='#638caa' if cold else '#ad7550' if not elite else '#8e5b83'
        poly(d,[(16,47),(13,31),(20,17),(25,22),(32,6),(35,21),(44,14),(49,29),(47,45),(39,55),(32,49),(24,56)],main)
        poly(d,[(22,43),(23,30),(31,18),(35,29),(42,25),(43,42),(34,48)],'#a5d7d8' if cold else '#efba71',None)
        poly(d,[(22,30),(42,30),(40,42),(24,42)],'#283440');eye(d,25,34);eye(d,36,34)
        if elite:
            for x,y in [(10,16),(51,13),(8,44),(54,40)]:jewel(d,x,y,'#e5b76e')
            poly(d,[(13,26),(10,8),(21,18),(42,18),(53,7),(50,28),(44,21),(20,21)],'#ab8c62')
            jewel(d,32,13,'#f7d798')
        for x,y in [(14,11),(50,48),(10,38)]:box(d,(x,y,x+2,y+2),main)
    elif kind=='hound':
        poly(d,[(10,38),(18,28),(39,29),(47,35),(49,47),(40,50),(22,47),(10,46)],'#3f4955')
        for x in [16,25,40,47]:poly(d,[(x,42),(x+3,43),(x+1,56),(x-5,56)],'#526173')
        poly(d,[(38,33),(37,17),(43,10),(46,21),(54,18),(56,31),(61,35),(57,41),(44,40)],'#596275')
        poly(d,[(13,33),(6,22),(4,24),(5,38),(13,44)],'#3e4554')
        for x,y in [(22,31),(29,31),(36,32)]:poly(d,[(x,y),(x+3,y-5),(x+4,y+3)],'#8090a1')
        eye(d,49,28,'#ed929b');box(d,(53,36,58,37),INK);box(d,(55,37,56,40),'#d9d6bf')
    else:
        elite=kind=='ravager';boss=kind=='boss'
        base='#716b73' if elite else '#99815b' if boss else '#64756c'
        for x in [20,37]:poly(d,[(x,42),(x+8,42),(x+9,56),(x-2,56)],'#414951');box(d,(x,54,x+9,57),'#7a7e73')
        poly(d,[(17,24),(27,20),(42,22),(49,31),(45,46),(20,46),(13,33)],base)
        box(d,(24,27,40,29),'#c3b78d');box(d,(29,30,34,42),'#3f494a');jewel(d,32,32,'#eea17b' if elite else '#b2d3a6')
        poly(d,[(19,10),(25,6),(40,7),(46,15),(43,24),(23,24)],base);box(d,(23,14,42,19),'#28333b');eye(d,25,16);eye(d,37,16)
        poly(d,[(12,26),(19,28),(17,40),(10,42),(7,34)],'#414b52')
        if elite:
            poly(d,[(49,11),(59,16),(57,26),(50,29),(45,22)],'#b39ba1');box(d,(51,25,53,53),'#86745f')
            for x,y in [(27,9),(24,27),(38,34)]:d.line([(x,y),(x+4,y+5),(x+1,y+9)],fill='#e6b293',width=1)
        else:box(d,(50,18,52,53),'#c1c4a9');box(d,(47,42,57,44),'#b69a62')
        if boss:
            poly(d,[(18,12),(16,1),(26,8),(32,0),(39,8),(48,1),(45,13)],'#d6b56b');jewel(d,32,10,'#fff0b1')
            poly(d,[(16,27),(8,29),(9,51),(20,53)],'#884d54');poly(d,[(46,28),(53,30),(53,51),(44,52)],'#884d54')
    # Distinct action frames retain each creature's silhouette.
    if frame==3:
        poly(d,[(6,23),(17,20),(28,24),(26,43),(16,52),(7,43)],'#607e8a')
        d.line([(8,25),(16,23),(25,26),(23,41),(16,48),(10,41),(8,25)],fill='#bfe3d9',width=1);jewel(d,16,34,'#dbd39b')
    if frame==4:
        for x,y in [(6,7),(52,5),(8,49),(56,45)]:jewel(d,x,y,'#f0ba71')
    if frame==5:
        for x,y in [(8,17),(54,24),(47,9)]:d.line([(x-3,y-3),(x+3,y+3)],fill='#fff2bf',width=2)
    if shift:
        moved=Image.new('RGBA',(64,64));moved.paste(im,(0,shift));im=moved
    return im

KINDS=['crawler','sentinel','ember','bat','slime','mushroom','scarab','wisp','hound','ravager','watcher','boss']
sheet=Image.new('RGBA',(384,len(KINDS)*64))
for row,kind in enumerate(KINDS):
    for frame in range(6):sheet.paste(creature(kind,frame),(frame*64,row*64))
sheet.save(OUT/'monsters.png')

# Six hand-designed weapon poses: rest, draw-back, high guard, strike, cross-strike, recovery.
hero=Image.new('RGBA',(384,64))
for frame in range(6):
    im,d=canvas()
    for x,y in [(26,43),(36,43)]:poly(d,[(x,y),(x+5,y),(x+5,55),(x+8,58),(x-1,58)],'#414b42');box(d,(x-1,55,x+8,58),'#493b32')
    poly(d,[(24,24),(35,23),(41,34),(39,45),(25,45),(20,34)],'#717756');box(d,(33,28,37,40),'#94976c')
    box(d,(25,42,39,44),'#463e32');box(d,(31,42,34,44),'#dab975')
    poly(d,[(23,22),(32,24),(28,34),(20,48),(8,53),(13,44),(18,30)],'#8f5e49')
    d.line([(23,26),(20,36),(13,48)],fill='#ba8260',width=2);d.line([(20,29),(16,42),(10,49)],fill='#5b453a',width=2)
    poly(d,[(24,9),(35,9),(39,15),(37,23),(29,25),(23,20)],'#c3a578');box(d,(22,10,35,14),'#493d32');box(d,(21,13,26,20),'#493d32');box(d,(25,8,33,9),'#796044');eye(d,35,16,'#2c3430')
    # Different elbows and blade vectors make the card's anticipation readable.
    hand=[(43,35),(27,24),(36,17),(47,40),(44,28),(42,34)][frame]
    d.line([(35,28),(40 if frame!=1 else 31,31),hand],fill='#c2b28a',width=5)
    box(d,(hand[0]-2,hand[1]-2,hand[0]+1,hand[1]+2),'#d2b589')
    dx,dy=[(15,-17),(-16,-13),(0,-16),(15,5),(14,-18),(16,-12)][frame]
    end=(hand[0]+dx,hand[1]+dy)
    d.line([hand,end],fill='#536c70',width=4);d.line([(hand[0],hand[1]-1),end],fill='#e2e6cd',width=2)
    nx,ny=(-dy/20,dx/20)
    d.line([(hand[0]-nx*4,hand[1]-ny*4),(hand[0]+nx*4,hand[1]+ny*4)],fill='#d4b473',width=2)
    hero.paste(im,(frame*64,0))
hero.save(OUT/'hero-attacks.png')

icons=Image.new('RGBA',(8*24,24))
for i,col in enumerate(['#b9dccc','#edac77','#c7b3ee','#df9390','#efd78d','#b6d9ec','#a8d79d','#e9b5f2']):
    d=ImageDraw.Draw(icons);cx=i*24+12
    if i==0:poly(d,[(cx-7,4),(cx,2),(cx+7,4),(cx+6,15),(cx,21),(cx-6,15)],col);d.line([(cx,5),(cx,17)],fill='#f4f3da',width=2)
    elif i==1:d.line([(cx-6,18),(cx+6,4)],fill=col,width=4);d.line([(cx-6,11),(cx+1,18)],fill='#fff0c8',width=2)
    elif i in [2,7]:
        for r in [8,4]:d.ellipse((cx-r,12-r,cx+r,12+r),outline=col,width=1)
        box(d,(cx-1,11,cx+1,13),'#fff3dc')
    elif i==3:d.line([(cx-6,7),(cx,15),(cx+6,7)],fill=col,width=3);box(d,(cx-5,19,cx+5,20),col)
    else:
        jewel(d,cx,12,col)
        for x,y in [(cx-8,6),(cx+8,18)]:box(d,(x,y,x+1,y+1),col)
icons.save(OUT/'status-icons.png')
print('Created original transparent sheets:', ', '.join(p.name for p in OUT.glob('*.png')))
