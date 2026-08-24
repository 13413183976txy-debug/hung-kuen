# -*- coding: utf-8 -*-
"""把单帧静态图打包成"2帧走路循环 + 攻击帧"的 sprite sheet 预览，验证帧动画思路"""
import os
from PIL import Image

ASSETS = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'sprites')

def load(cat, name, size=128):
    p = os.path.join(ASSETS, cat, name + '.png')
    im = Image.open(p).convert('RGBA')
    im.thumbnail((size, size))
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    ox = (size - im.size[0]) // 2; oy = (size - im.size[1]) // 2
    canvas.paste(im, (ox, oy), im)
    return canvas

# 走路循环帧（帧0 迈步，帧1 站立，帧2 翻转迈步 = 镜像）
def mirror(im):
    return im.transpose(Image.FLIP_LEFT_RIGHT)

walk0 = load('hero', 'walk')
walkmid = load('hero', 'idle')
frames = [walk0, walkmid, mirror(walk0), walkmid]  # 4帧循环

# 竖排成 sheet
fw, fh = 128, 128
sheet = Image.new('RGBA', (fw * len(frames), fh), (0, 0, 0, 0))
for i, f in enumerate(frames):
    sheet.paste(f, (i * fw, 0), f)
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '_walk_sheet.png')
sheet.save(out)
print('saved walk sheet', out, 'frames:', len(frames))

# 也做一套攻击演示（水龙旋 施法帧 + 转身）
atk0 = load('hero', 'water_spin')
atkmid = load('hero', 'power_aura')
af = [atk0, atkmid, atk0]
asheet = Image.new('RGBA', (fw * len(af), fh), (0, 0, 0, 0))
for i, f in enumerate(af):
    asheet.paste(f, (i * fw, 0), f)
out2 = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '_attack_sheet.png')
asheet.save(out2)
print('saved attack sheet', out2, 'frames:', len(af))
