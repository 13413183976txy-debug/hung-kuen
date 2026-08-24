// utils.js —— 数学 / 向量 / 随机 / 辅助工具（仅保留被战斗代码实际使用的函数）

export const TAU = Math.PI * 2;
export const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
export const dist2 = (ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay;
  return dx * dx + dy * dy;
};
export const angleTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
export const angleDiff = (a, b) => {
  let d = (b - a) % TAU;
  if (d < -Math.PI) d += TAU;
  if (d > Math.PI) d -= TAU;
  return d;
};

/** 归一化方向向量 {x,y}，零向量返回 0 */
export const norm = (x, y) => {
  const len = Math.hypot(x, y);
  return len > 1e-6 ? { x: x / len, y: y / len } : { x: 0, y: 0 };
};

export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/** 将 CSS 颜色转 0xRRGGBB（供粒子/闪光叠加用） */
export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
