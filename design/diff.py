import glob,sys
from PIL import Image, ImageChops
rows=[]
for o in sorted(glob.glob('design/compare/*-ours.png')):
    p=o.replace('-ours','-proto')
    a=Image.open(o).convert('RGB');b=Image.open(p).convert('RGB')
    if a.size!=b.size: rows.append((100,o,'size')); continue
    d=ImageChops.difference(a,b).convert('L').point(lambda v:255 if v>25 else 0)
    pct=sum(d.histogram()[255:])/ (a.size[0]*a.size[1])*100
    d.save(o.replace('-ours','-diff'))
    rows.append((round(pct,2),o.split('/')[-1].replace('-ours.png','')))
for r in sorted(rows,reverse=True): print(*r)
