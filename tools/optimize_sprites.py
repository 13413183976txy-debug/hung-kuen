# -*- coding: utf-8 -*-
"""optimize_sprites.py —— 精灵图生产压缩脚本

素材源图多为 1024~2048px，而展示尺寸仅 92~144 逻辑像素（dpr=2 时最多 288）。
按「2 倍逻辑尺寸」重采样（LANCZOS，等于 dpr2 下 1:1 像素，视觉无损），
把首屏素材从 ~11MB 压到 1MB 级。改完素材后记得递增缓存版本号（见 config.js ASSET_V）。

用法: python tools/optimize_sprites.py
"""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, 'assets', 'sprites')

# (路径, 目标最长边像素) —— 2x 逻辑尺寸（dpr 上限 2 下的 1:1 渲染）
TARGETS = {
    'hero/idle.png': 184,
    'hero/stance.png': 184,
    'hero/walk_front.png': 184,
    'hero/walk_back.png': 184,
    'hero/attack_punch.png': 184,
    'hero/water_wave.png': 256,           # 大招 128 逻辑 → 2x
    'hero/walk_right_sheet.png': ('frame', 184),   # 4 帧横向 sheet：按单帧 184px 缩放
    'hero/walk_left_sheet.png': ('frame', 184),
    'blade/idle.png': 160,
    'blade/slash_down.png': 160,
    'hammer/idle.png': 184,
    'hammer/raise.png': 200,
    'hammer/jump_kick.png': 208,
    'boss/idle.png': 264,
    'boss/slash.png': 280,
    'boss/slash_red.png': 280,
    'boss/kick.png': 288,
    'ui/background.png': 0,               # 0 = 保持原尺寸（背景拉伸绘制，无需重采样）
    'ui/victory.png': 512,                # 结算页 <img> 展示 300px 级别
    # 未被游戏加载的备用/旧素材：统一压到 512，仅减小仓库体积
    'hero/walk.png': 512,
    'hero/walk_right.png': 512,
    'hero/walk_sheet.png': 512,
    'hero/power_aura.png': 512,
    'hero/attack_aura.png': 512,
    'hero/water_spin.png': 512,
    'blade/slash_side.png': 512,
    'blade/throw.png': 512,
    'hammer/idle2.png': 512,
    'ui/start_btn.png': 512,
}


def optimize(rel, target):
    if target == 0:
        return None
    src = os.path.join(ASSETS, rel)
    if not os.path.exists(src):
        return None
    im = Image.open(src)
    if im.mode != 'RGBA':
        im = im.convert('RGBA')
    w, h = im.size
    if isinstance(target, tuple) and target[0] == 'frame':
        # sprite sheet：按单帧宽度/高度等比缩放（帧尺寸 = 整图宽/frames）
        frame_h = target[1]
        scale = frame_h / h
    else:
        scale = target / max(w, h)
    nw, nh = max(2, round(w * scale)), max(2, round(h * scale))
    im = im.resize((nw, nh), Image.LANCZOS)
    out = os.path.join(ASSETS, rel)
    im.save(out, 'PNG', optimize=True)
    return (src, out, (w, h), (nw, nh))


def main():
    before = after = 0
    for rel, target in TARGETS.items():
        src = os.path.join(ASSETS, rel)
        if not os.path.exists(src):
            print('  SKIP', rel)
            continue
        b = os.path.getsize(src)
        r = optimize(rel, target)
        if not r:
            continue
        _, out, (w, h), (nw, nh) = r
        a = os.path.getsize(out)
        before += b
        after += a
        print('  %-34s %4dx%-4d -> %4dx%-4d  %6.0fKB -> %5.0fKB  (x%.1f)'
              % (rel, w, h, nw, nh, b / 1024, a / 1024, b / max(1, a)))
    print('TOTAL: %.0fKB -> %.0fKB (x%.1f)' % (before / 1024, after / 1024, before / max(1, after)))


if __name__ == '__main__':
    main()
