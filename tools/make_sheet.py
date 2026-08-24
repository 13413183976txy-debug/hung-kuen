# -*- coding: utf-8 -*-
"""生成 assets/sprites 的 checkerboard 总览图，检查白边"""
import os
from PIL import Image, ImageDraw

ASSETS = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'sprites')
cats = ['hero', 'blade', 'hammer', 'boss', 'ui']
files = []
for c in cats:
    d = os.path.join(ASSETS, c)
    if not os.path.isdir(d): continue
    for n in sorted(os.listdir(d)):
        if n.lower().endswith('.png'):
            files.append((c, n))

CELL = 180; LABEL = 22; COL = 5
rows = (len(files) + COL - 1) // COL
sheet = Image.new('RGB', (COL * CELL, rows * (CELL + LABEL)), (40, 40, 40))
draw = ImageDraw.Draw(sheet)

for i, (cat, name) in enumerate(files):
    col = i % COL; row = i // COL
    x = col * CELL; y = row * (CELL + LABEL)
    # checkerboard
    for yy in range(0, CELL, 22):
        for xx in range(0, CELL, 22):
            on = ((xx // 22) + (yy // 22)) % 2 == 0
            c = (200, 200, 200) if on else (255, 255, 255)
            draw.rectangle([x + xx, y + yy, x + xx + 22, y + yy + 22], fill=c)
    # paste
    im = Image.open(os.path.join(ASSETS, cat, name)).convert('RGBA')
    im.thumbnail((CELL - 8, CELL - 8))
    ox = x + (CELL - im.size[0]) // 2; oy = y + (CELL - im.size[1]) // 2
    sheet.paste(im, (ox, oy), im)
    draw.text((x + 4, y + CELL + 4), f"{cat}/{name}", fill=(255, 255, 255))

sheet.save(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '_sheet_v2.png'))
print('saved', len(files), 'sprites')
