# -*- coding: utf-8 -*-
"""把主角单帧打包成 sprite sheet，供游戏逐帧播放（真实帧动画）"""
import os
from PIL import Image

ASSETS = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'sprites')
OUT = os.path.join(ASSETS, 'hero', 'walk_sheet.png')

SIZE = 128

def load(name):
    p = os.path.join(ASSETS, 'hero', name + '.png')
    im = Image.open(p).convert('RGBA')
    im.thumbnail((SIZE, SIZE))
    canvas = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    ox = (SIZE - im.size[0]) // 2; oy = (SIZE - im.size[1]) // 2
    canvas.paste(im, (ox, oy), im)
    return canvas

def mirror(im):
    return im.transpose(Image.FLIP_LEFT_RIGHT)

walk = load('walk')       # 迈步
idle = load('idle')       # 站直
# 4 帧走动：迈步 -> 站 -> 反向迈步 -> 站
frames = [walk, idle, mirror(walk), idle]

sheet = Image.new('RGBA', (SIZE * len(frames), SIZE), (0, 0, 0, 0))
for i, f in enumerate(frames):
    sheet.paste(f, (i * SIZE, 0), f)
sheet.save(OUT)
print('saved', OUT, 'frames:', len(frames))
