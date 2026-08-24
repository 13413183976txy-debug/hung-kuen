# -*- coding: utf-8 -*-
"""
专业级抠图工具（Pillow + numpy）
针对白色/浅色背景原图。

流程:
1. 参考背景色 = 四角/边缘的中位数
2. 用"区域生长"从边缘提取连通背景，而不是全图阈值：
   - 只把与背景连通、且颜色接近背景色的区域判为背景
   - 角色内部即使有近似白色（白衣/高光）也保留，因为不与边缘背景连通
3. defringe：仅对"邻接背景的边环"，做颜色去污染（un-premultiply），消除白边/白晕
4. 边缘 alpha 羽化 1px

用法:
  python cutout3.py <in> <out> <tol>
"""
import sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage  # 若没有 scipy 则 fallback

HAVE_SCIPY = True
try:
    from scipy import ndimage
except Exception:
    HAVE_SCIPY = False


def cutout(in_path, out_path, tol=28.0):
    im = Image.open(in_path).convert('RGB')
    a = np.asarray(im).astype(np.float32)  # (H,W,3)
    h, w, _ = a.shape

    # 1) 背景色 = 所有边缘像素的中位数
    edges = np.concatenate([
        a[0, :], a[-1, :], a[:, 0], a[:, -1],
        a[1, :], a[-2, :], a[:, 1], a[:, -2],
    ])
    bg = np.median(edges, axis=0)
    bgv = bg.reshape(1, 1, 3)

    # 2) 到背景色的距离
    dist = np.sqrt(((a - bg) ** 2).sum(axis=2))  # (H,W)

    # 3) 区域生长：背景 = 从边缘出发、颜色接近背景的连通区域
    seed = dist < tol
    # 让背景种子覆盖整圈边缘（含边缘附近所有低距离像素）
    border = np.zeros((h, w), bool)
    border[0, :] = True; border[-1, :] = True
    border[:, 0] = True; border[:, -1] = True
    close_to_bg = (dist < tol) | border
    bg_mask = close_to_bg.copy()
    if HAVE_SCIPY:
        # 连通成分：只保留与边缘相连的背景区
        lbl, n = ndimage.label(close_to_bg)
        # 找出所有接触到边界标签
        edge_labels = set(np.unique(np.concatenate([
            lbl[0, :], lbl[-1, :], lbl[:, 0], lbl[:, -1]
        ])))
        edge_labels.discard(0)
        keep = np.isin(lbl, list(edge_labels))
        bg_mask = keep
    else:
        # 无 scipy，退化为简单 flood（BFS）
        from collections import deque
        bg_mask = np.zeros((h, w), bool)
        dq = deque()
        for x in range(w):
            for y in (0, h - 1):
                if close_to_bg[y, x] and not bg_mask[y, x]:
                    bg_mask[y, x] = True; dq.append((y, x))
        for y in range(h):
            for x in (0, w - 1):
                if close_to_bg[y, x] and not bg_mask[y, x]:
                    bg_mask[y, x] = True; dq.append((y, x))
        while dq:
            y, x = dq.popleft()
            for ny, nx in ((y-1,x),(y+1,x),(y,x-1),(y,x+1)):
                if 0 <= ny < h and 0 <= nx < w and close_to_bg[ny, nx] and not bg_mask[ny, nx]:
                    bg_mask[ny, nx] = True; dq.append((ny, nx))

    # 4) alpha：背景=0，else 1。对 bg_mask 边缘做 1px 羽化
    alpha = np.where(bg_mask, 0, 1).astype(np.float32)

    # 5) defringe：邻接背景的前景像素做去污染
    #    对这些像素：real = (pixel - (1-alpha)*bg)/alpha（alpha 在边缘是半透明）
    #    先给边缘一个平滑 alpha（靠近背景的淡出）
    #    用高斯模糊 alpha 做平滑过渡（实际有效边缘）
    alpha_img = Image.fromarray((alpha * 255).astype(np.uint8))
    alpha_img = alpha_img.filter(ImageFilter.GaussianBlur(1.0))  # 1px 柔和
    alpha_s = np.asarray(alpha_img).astype(np.float32) / 255.0

    # un-premultiply：真实色 = (像素 - (1-a)*bg)/a，仅对 a>0
    eps = 1e-4
    a_safe = np.clip(alpha_s, eps, 1)[..., None]   # (H,W,1)
    real = (a - (1 - a_safe) * bgv) / a_safe
    real = np.clip(real, 0, 255)

    # 组合 RGBA
    rgba = np.dstack([real, alpha_s[..., None] * 255.0])
    rgba = np.clip(rgba, 0, 255).astype(np.uint8)
    out = Image.fromarray(rgba, 'RGBA')
    out.save(out_path)


if __name__ == '__main__':
    in_p = sys.argv[1]; out_p = sys.argv[2]
    tol = float(sys.argv[3]) if len(sys.argv) > 3 else 28.0
    cutout(in_p, out_p, tol)
    print('done ->', out_p, 'scipy=', HAVE_SCIPY)
