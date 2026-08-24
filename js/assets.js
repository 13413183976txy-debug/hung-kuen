// assets.js —— 精灵加载与缓存
// 图片路径来自 config.SPRITES，加载完成后按逻辑名缓存。失败时回退为占位色块。
// 支持：
//  - 帧序列：SPRITES 里定义 frames=N 时，src 为水平排列的 sprite sheet，drawSprite 传 frame 索引播放。
//  - 描边：drawSprite 传 outline（颜色数字）时绘制预生成轮廓，遮住白边、让角色突出；
//    描边在“约 2 倍显示尺寸”的低分辨率下生成（像素量缩小几十倍），
//    并由 prebuildOutlines() 在加载后异步分批完成，不阻塞点击开始的首页与首帧。

import { SPRITES, ASSET_V } from './config.js?v=17';

const cache = new Map();        // key -> {img, size, loaded, frames}
const outlineCache = new Map(); // key -> {canvas, frames, fw, fh, small}
const keys = Object.keys(SPRITES);

/** 开始加载所有精灵 */
export function loadAssets() {
  return Promise.all(keys.map(name => new Promise((resolve) => {
    const def = SPRITES[name];
    const img = new Image();
    img.onload = () => {
      cache.set(name, { img, size: def.size, loaded: true, frames: def.frames || 1 });
      resolve({ name, ok: true });
    };
    img.onerror = () => {
      cache.set(name, { img: null, size: def.size, loaded: false, frames: def.frames || 1 });
      resolve({ name, ok: false });
    };
    img.src = def.src + '?v=' + ASSET_V;   // 素材缓存版本号（config.ASSET_V）
  })));
}

export function getSprite(name) {
  return cache.get(name) || null;
}

/* ---------------- 描边（低分辨率预生成） ---------------- */

const OUTLINE_COLOR = 0x11161f;
const OUTLINE_NAMES = [
  'hero_idle', 'hero_walk_front', 'hero_walk_right', 'hero_walk_left', 'hero_walk_back',
  'hero_attack', 'hero_hurt', 'hero_special',
  'blade_idle', 'blade_slash',
  'hammer_idle', 'hammer_raise', 'hammer_kick',
  'boss_idle', 'boss_slash', 'boss_red', 'boss_kick',
];

/**
 * 生成描边缓存：先缩放到约 2 倍显示尺寸，再做 3x3 alpha 膨胀。
 * 返回 { canvas, frames, fw, fh }。视觉与全分辨率版一致，成本低几十倍。
 */
function buildOutlineSmall(name, outlineColor) {
  const s = cache.get(name);
  if (!s || !s.loaded) return null;
  const img = s.img;
  const frames = s.frames || 1;
  const fw0 = img.width / frames;
  const fh0 = img.height;
  const fw = Math.max(32, Math.round(s.size * 2));           // 2x 显示尺寸
  const fh = Math.max(32, Math.round(fw * (fh0 / fw0)));
  const tw = fw * frames;

  const oc = document.createElement('canvas');
  oc.width = tw; oc.height = fh;
  const g = oc.getContext('2d');
  for (let f = 0; f < frames; f++) {
    g.drawImage(img, f * fw0, 0, fw0, fh0, f * fw, 0, fw, fh);
  }

  const src = g.getImageData(0, 0, tw, fh).data;
  const alpha = new Float32Array(tw * fh);
  for (let p = 0; p < tw * fh; p++) alpha[p] = src[p * 4 + 3] / 255;

  const mask = new Uint8Array(tw * fh);
  const cr = (outlineColor >> 16) & 255, cg = (outlineColor >> 8) & 255, cb = outlineColor & 255;
  for (let y = 0; y < fh; y++) {
    for (let x = 0; x < tw; x++) {
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ny = y + dy, nx = x + dx;
          if (ny >= 0 && ny < fh && nx >= 0 && nx < tw && alpha[ny * tw + nx] > 0.2) { near = true; break; }
        }
      }
      mask[y * tw + x] = near ? 1 : 0;
    }
  }
  const out = new Uint8ClampedArray(src.length);
  for (let p = 0; p < tw * fh; p++) {
    // 只在“原本无 alpha 但邻域有 alpha”处涂轮廓色；本体区域透明（随后画本体覆盖）
    if (mask[p] && alpha[p] <= 0.2) {
      out[p * 4] = cr; out[p * 4 + 1] = cg; out[p * 4 + 2] = cb; out[p * 4 + 3] = 255;
    }
  }
  g.putImageData(new ImageData(out, tw, fh), 0, 0);
  return { canvas: oc, frames, fw, fh };
}

function getOutline(name, color) {
  const key = name + ':' + color;
  let oc = outlineCache.get(key);
  if (!oc) {
    oc = buildOutlineSmall(name, color);
    if (oc) outlineCache.set(key, oc);
  }
  return oc;
}

/** 启动后异步分批预生成描边（每批限时 ~4ms，不阻塞首帧）
 *  预生成的默认颜色与绘制一致（OUTLINE_COLOR）。 */
export function prebuildOutlines() {
  let i = 0;
  const step = () => {
    const t0 = performance.now();
    while (i < OUTLINE_NAMES.length && performance.now() - t0 < 4) {
      const name = OUTLINE_NAMES[i++];
      if (cache.has(name) && cache.get(name).loaded) {
        const oc = buildOutlineSmall(name, OUTLINE_COLOR);
        if (oc) outlineCache.set(name + ':' + OUTLINE_COLOR, oc);
      }
    }
    if (i < OUTLINE_NAMES.length) setTimeout(step, 0);
  };
  setTimeout(step, 30);
}

/* ---------------- 绘制 ---------------- */

/** 绘制精灵：居中绘制到 (x,y)，可选旋转/水平翻转/帧索引/描边 */
export function drawSprite(ctx, name, x, y, opts = {}) {
  const s = getSprite(name);
  const size = opts.size || (s ? s.size : 48);
  const rot = opts.rot || 0;
  const frame = opts.frame || 0;

  if (!s || !s.loaded) {
    if (opts.placeholder !== false) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#666';
      ctx.beginPath();
      ctx.arc(x, y, size * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    return;
  }

  const outline = opts.outline;
  if (outline) {
    const oc = getOutline(name, typeof outline === 'number' ? outline : 0x101824);
    if (oc) {
      const fi = Math.max(0, Math.min(oc.frames - 1, Math.floor(frame)));
      const half = size / 2;
      ctx.save();
      ctx.translate(x, y);
      if (rot) ctx.rotate(rot);
      if (opts.flip) ctx.scale(-1, 1);
      if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
      ctx.drawImage(oc.canvas, fi * oc.fw, 0, oc.fw, oc.fh, -half, -half, size, size);
      ctx.restore();
    }
  }

  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  if (opts.flip) ctx.scale(-1, 1);
  if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
  const half = size / 2;

  const frames = s.frames || 1;
  if (frames > 1) {
    const fw = s.img.width / frames;
    const fh = s.img.height;
    const fi = Math.max(0, Math.min(frames - 1, Math.floor(frame)));
    ctx.drawImage(s.img, fi * fw, 0, fw, fh, -half, -half, size, size);
  } else {
    ctx.drawImage(s.img, -half, -half, size, size);
  }
  ctx.restore();
}
