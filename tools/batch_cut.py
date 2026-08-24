# -*- coding: utf-8 -*-
"""批量抠图 V3：彻底去白边
用 alpha 梯度的颜色填充（color decontamination）+ 区域生长，消除半透明白边。
"""
import os, sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

MAP = {
    '404fd930c1aae7f791d5b03a0ab20071': ('hero', 'idle'),
    '6dc224660e68a26d207f4ad3e5b68a0d': ('hero', 'stance'),
    'a90ca1be503d33ec119337823252dab9': ('hero', 'power_aura'),
    'c1922851e68f06773d818921c9c1cf43': ('hero', 'walk'),
    'f14a533ea9a33c829504d00fd780d952': ('hero', 'walk_right'),
    'f915ccb3b29e3eb00a4dea9753d90386': ('hero', 'water_spin'),
    'bef4d5712b6bc34bc3495dc46f04b13b': ('hero', 'water_wave'),
    '2fb68cf066518c2c941e2bdfbff97d36': ('blade', 'slash_down'),
    '4e3876d3fe3f631b10477f17e175e12d': ('blade', 'idle'),
    '5a9cf96e18f04a86f1443c669f0f4901': ('blade', 'slash_side'),
    '8f99626dbdb7a3e2289533f41ee67871': ('blade', 'throw'),
    '59c81b1d4b1ac15730e27c9517c14336': ('hammer', 'raise'),
    'b2dcf82d715acd9fa58015039c1bf06f': ('hammer', 'idle'),
    'd65204fbe7b5dc2e726d8c5482d8b027': ('hammer', 'jump_kick'),
    'ed674c8ead8c0bee0e1d8ec60298204b': ('hammer', 'idle2'),
    '2351d4df3e52d006343aa29e7b20c193': ('boss', 'idle'),
    '5a1aa322939355179d6b0d4afcccba43': ('boss', 'slash'),
    'a4598258f1621f9750211f15765176ce': ('boss', 'slash_red'),
    'cb28ee126977a42c20a707384b913274': ('boss', 'kick'),
    '002ddc3b9b101f0cea336ca82f38c91b': ('ui', 'background'),
    '92c5e6c6b9f580f46b69a60d334fa191': ('ui', 'start_btn'),
    'f6852ca78fbf588516542e4f9a5a3c35': ('ui', 'victory'),
}

ROOT = os.path.dirname(os.path.abspath(__file__))
IMG = os.path.join(os.path.dirname(ROOT), 'img')
ASSETS = os.path.join(os.path.dirname(ROOT), 'assets', 'sprites')
TOL = float(sys.argv[1]) if len(sys.argv) > 1 else 28.0


def cut(a, tol):
    h, w, _ = a.shape
    edges = np.concatenate([a[0, :], a[-1, :], a[:, 0], a[:, -1],
                            a[1, :], a[-2, :], a[:, 1], a[:, -2]])
    bg = np.median(edges, axis=0)
    bgv = bg.reshape(1, 1, 3)
    dist = np.sqrt(((a - bg) ** 2).sum(axis=2))
    close = dist < tol
    border = np.zeros((h, w), bool)
    border[0, :] = True; border[-1, :] = True; border[:, 0] = True; border[:, -1] = True
    close = close | border
    lbl, n = ndimage.label(close)
    edge_labels = set(np.unique(np.concatenate([lbl[0, :], lbl[-1, :], lbl[:, 0], lbl[:, -1]])))
    edge_labels.discard(0)
    bg_mask = np.isin(lbl, list(edge_labels))

    # 基础 alpha（背景=0）
    alpha = np.where(bg_mask, 0, 1).astype(np.float32)

    # 边缘羽化 1px（在 alpha 域，产生柔和边界）
    alpha_img = Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))
    alpha_s = np.asarray(alpha_img).astype(np.float32) / 255.0

    # ---- 颜色去污染（un-premultiply over bg）----
    eps = 1e-4
    a_safe = np.clip(alpha_s, eps, 1)[..., None]
    real = np.clip((a - (1 - a_safe) * bgv) / a_safe, 0, 255)

    # ---- 边缘重新着色：对 alpha 不完全为1的边缘像素，往"更不透明"方向采样颜色 ----
    color = real.copy()
    al = alpha_s
    for _ in range(4):
        semitrans = (al > 0.03) & (al < 0.995)
        if not semitrans.any():
            break
        # 找每个半透明像素 4 邻域中 alpha 最大者
        max_al = al.copy()
        best_c = color.copy()
        for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            sy = slice(max(0, dy), h + min(0, dy))
            sx = slice(max(0, dx), w + min(0, dx))
            ty = slice(max(0, -dy), h + min(0, -dy))
            tx = slice(max(0, -dx), w + min(0, -dx))
            na = np.zeros_like(al); na[ty, tx] = al[sy, sx]
            nc = np.zeros_like(color); nc[ty, tx] = color[sy, sx]
            upd = (na > max_al)
            max_al = np.where(upd, na, max_al)
            # 逐通道更新颜色
            for c in range(3):
                best_c[..., c] = np.where(upd, nc[..., c], best_c[..., c])
        upd = semitrans & (max_al > al + 1e-3)
        color = np.where(upd[..., None], best_c, color)

    rgba = np.clip(np.dstack([color, alpha_s[..., None] * 255.0]), 0, 255).astype(np.uint8)
    return Image.fromarray(rgba, 'RGBA')


def main():
    count = 0
    for k, (cat, name) in MAP.items():
        in_p = os.path.join(IMG, k + '.jpg')
        if not os.path.exists(in_p):
            print('MISS', k); continue
        out_dir = os.path.join(ASSETS, cat)
        os.makedirs(out_dir, exist_ok=True)
        out_p = os.path.join(out_dir, name + '.png')
        im = Image.open(in_p).convert('RGB')
        a = np.asarray(im).astype(np.float32)
        res = cut(a, TOL)
        res.save(out_p)
        print('  %-8s %-14s <- %s' % (cat, name, k[:8]))
        count += 1
    print('total', count)


if __name__ == '__main__':
    main()
