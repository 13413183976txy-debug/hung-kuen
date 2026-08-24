# -*- coding: utf-8 -*-
"""
专业级抠图工具（Pillow + numpy）
针对白色/浅色背景的原图。

算法:
1. 根据像素与背景色的距离计算 alpha（平滑过渡，非硬阈值）
2. defringe: 对边缘像素做 color decontamination，去除混入的白色背景色（消除白边/白晕）
3. 轻微的 alpha 平滑

用法:
  python cutout2.py <in.png|jpg> <out.png> [bg_mode]
  bg_mode: 'white'(默认) 或 'auto'（用四角估计背景色）
"""
import sys
import numpy as np
from PIL import Image, ImageFilter


def cutout(in_path, out_path, bg_mode='white'):
    im = Image.open(in_path).convert('RGB')
    a = np.asarray(im).astype(np.float32)  # (H,W,3)

    # 1) 估计背景色
    if bg_mode == 'auto':
        h, w, _ = a.shape
        corners = np.concatenate([
            a[3, 3], a[3, -4], a[-4, 3], a[-4, -4],
            a[0:5].reshape(-1, 3), a[-5:].reshape(-1, 3),
            a[:, 0:5].reshape(-1, 3), a[:, -5:].reshape(-1, 3),
        ])
        bg = np.median(corners, axis=0)
    else:
        bg = np.array([255, 255, 255], dtype=np.float32)

    # 2) 亮度相对背景的接近度 -> alpha
    # 距离越大越不透明
    dist = np.sqrt(((a - bg) ** 2).sum(axis=2))  # (H,W)

    # 背景距离阈值：低于这个基本透明，高于这个全透
    lo, hi = 30.0, 90.0
    # alpha 由 0 -> 1 平滑过渡，同时对"接近背景亮度但色相不同"的也保留
    alpha = np.clip((dist - lo) / (hi - lo), 0, 1)

    # 排除内部可能为纯白的部分（脸/衣服高光）——不能只靠距离
    # 但白色衣物/肤色是主体内容，距离通常 > hi，保留即可。
    # 这里不做二次处理，靠 defringe 处理边缘。

    # 3) defringe: 对每个像素，算出颜色里混入的背景白，反推"真实色"
    #    real = (pixel - (1-alpha)*bg) / alpha   (alpha>0)
    #    这样边缘像素去掉半透明白，显示物体真实颜色 -> 无白边
    eps = 1e-5
    alpha_b = np.clip(alpha, eps, 1)[..., None]   # (H,W,1)
    bgv = bg.reshape(1, 1, 3)                     # (1,1,3)
    # un-premultiply 颜色
    real = (a - (1 - alpha_b) * bgv) / alpha_b
    real = np.clip(real, 0, 255)

    # 4) 输出 RGBA：颜色取 real，alpha 取 alpha
    # 对 alpha==0 处颜色无意义，设为 bg 即可
    a_mask = alpha[..., None]
    rgba = np.concatenate([real * a_mask + bgv * (1 - a_mask), alpha[..., None]], axis=2)

    # 5) 平滑 alpha 一档（柔和边缘）
    out = Image.fromarray(rgba.astype(np.uint8), 'RGBA')
    # 分离 alpha 平滑
    r, g, b, al = out.split()
    al = al.filter(ImageFilter.GaussianBlur(1.0))
    out = Image.merge('RGBA', (r, g, b, al))
    out.save(out_path)


if __name__ == '__main__':
    in_p = sys.argv[1]
    out_p = sys.argv[2]
    bg_mode = sys.argv[3] if len(sys.argv) > 3 else 'white'
    cutout(in_p, out_p, bg_mode)
    print('done ->', out_p)
