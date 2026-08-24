// systems/ambient.js —— 场景氛围：竹林练武场的落叶 / 尘粒 / 流动雾气
// 全部为世界坐标的轻量粒子，围绕相机视口循环（出界即回收重生），有对象上限。

const TAU = Math.PI * 2;

const LEAF_COLORS = [
  'rgba(233,215,170,0.75)',   // 宣纸落叶
  'rgba(214,168,74,0.6)',     // 鎏金
  'rgba(80,112,90,0.75)',     // 竹青
  'rgba(126,90,50,0.6)',      // 枯褐
];

export class Ambient {
  constructor(world) {
    this.world = world;
    this.time = 0;
    this.leaves = [];
    this.dust = [];
    // 对象上限
    this.maxLeaves = 26;
    this.maxDust = 30;
    // 预渲染雾气团（性能：每帧只 drawImage）
    this.fogCanvas = this._makeFog(260, 'rgba(233,215,170,1)');
    for (let i = 0; i < this.maxLeaves; i++) this.leaves.push(this._newLeaf(true));
    for (let i = 0; i < this.maxDust; i++) this.dust.push(this._newDust(true));
  }

  _makeFog(size, color) {
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, color);
    grad.addColorStop(0.55, color.replace('1)', '0.5)'));
    grad.addColorStop(1, color.replace('1)', '0)'));
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    return c;
  }

  _newLeaf(anywhere = false) {
    return {
      x: 0, y: 0,
      vx: 0, vy: 0,
      size: 3.5 + Math.random() * 4.5,
      rot: Math.random() * TAU,
      vr: (Math.random() - 0.5) * 5,
      sway: Math.random() * TAU,
      swaySpeed: 1 + Math.random() * 1.6,
      layer: Math.random() < 0.4 ? 1 : 0,   // 1 = 前景（画在角色上）
      color: LEAF_COLORS[Math.floor(Math.random() * LEAF_COLORS.length)],
      alpha: 0.35 + Math.random() * 0.35,
      // 落到任意位置（首帧铺满或用视口起点）
      anywhere,
    };
  }

  _newDust(anywhere = false) {
    return {
      x: 0, y: 0,
      vx: 0, vy: 0,
      size: 1 + Math.random() * 1.4,
      alpha: 0.10 + Math.random() * 0.16,
      phase: Math.random() * TAU,
      anywhere,
    };
  }

  _inView(item, cam, margin = 60) {
    const hw = 480 + margin, hh = 300 + margin;
    return item.x > cam.x - hw && item.x < cam.x + hw &&
           item.y > cam.y - hh && item.y < cam.y + hh;
  }

  update(dt) {
    this.time += dt;
    const cam = this.world.camera;
    if (!cam) return;

    for (const l of this.leaves) {
      if (!this._inView(l, cam)) {
        Object.assign(l, this._newLeaf(true));
        // 从视口边缘进入
        const side = Math.floor(Math.random() * 4);
        if (side === 0) { l.x = cam.x + (Math.random() * 2 - 1) * 400; l.y = cam.y - 320; }
        else if (side === 1) { l.x = cam.x + (Math.random() * 2 - 1) * 400; l.y = cam.y + 360; }
        else if (side === 2) { l.x = cam.x - 520; l.y = cam.y + (Math.random() * 2 - 1) * 300; }
        else { l.x = cam.x + 520; l.y = cam.y + (Math.random() * 2 - 1) * 300; }
        l.anywhere = false;
        continue;
      }
      l.sway += dt * l.swaySpeed;
      l.vy = 14 + Math.sin(l.sway * 0.6) * 6;
      l.vx = Math.sin(l.sway) * 18;
      l.x += l.vx * dt + 4 * dt;      // 微风向东
      l.y += l.vy * dt;
      l.rot += l.vr * dt;
    }

    for (const d of this.dust) {
      if (!this._inView(d, cam, 90)) {
        Object.assign(d, this._newDust(true));
        d.x = cam.x + (Math.random() * 2 - 1) * 500;
        d.y = cam.y + (Math.random() * 2 - 1) * 340;
        continue;
      }
      d.phase += dt;
      d.x += (Math.cos(d.phase * 0.5) * 6 + 7) * dt;
      d.y += (Math.sin(d.phase * 0.8) * 4 + 3) * dt;
    }
  }

  /** 地面层（角色下方）：叶影与尘 */
  drawGround(ctx) {
    for (const d of this.dust) {
      ctx.globalAlpha = d.alpha;
      ctx.fillStyle = '#F0E6C8';
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.size, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /** 前景层（角色上方）：少量飘叶 */
  drawFront(ctx) {
    for (const l of this.leaves) {
      if (!l.layer) continue;
      this._drawLeaf(ctx, l);
    }
    ctx.globalAlpha = 1;
  }

  /** 后景层（角色下方）：落叶铺地效果 */
  drawBack(ctx) {
    for (const l of this.leaves) {
      if (l.layer) continue;
      this._drawLeaf(ctx, l);
    }
    ctx.globalAlpha = 1;
  }

  _drawLeaf(ctx, l) {
    ctx.save();
    ctx.translate(l.x, l.y);
    ctx.rotate(l.rot);
    ctx.globalAlpha = l.alpha;
    ctx.fillStyle = l.color;
    // 小树叶：两弧拼成的椭圆叶
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(l.size * 0.6, -l.size * 0.8, l.size * 1.9, 0);
    ctx.quadraticCurveTo(l.size * 0.6, l.size * 0.8, 0, 0);
    ctx.fill();
    ctx.restore();
  }

  /** 流动雾气：2-3 团沿正弦漂移（画在地面之上、角色之下） */
  drawFog(ctx, t = this.time) {
    const cam = this.world.camera;
    if (!cam) return;
    const blobs = [
      { ox: -260, oy: -180, s: 1.15, sp: 0.014, ph: 0.0, a: 0.045 },
      { ox: 280,  oy: 120,  s: 0.95, sp: 0.011, ph: 2.1, a: 0.038 },
      { ox: 0,    oy: 240,  s: 0.8,  sp: 0.019, ph: 4.2, a: 0.03 },
    ];
    ctx.save();
    for (const b of blobs) {
      const x = cam.x + b.ox + Math.sin(t * b.sp + b.ph) * 140;
      const y = cam.y + b.oy + Math.cos(t * b.sp * 0.7 + b.ph) * 90;
      const w = 520 * b.s;
      ctx.globalAlpha = b.a;
      ctx.drawImage(this.fogCanvas, x - w / 2, y - w / 2, w, w);
    }
    ctx.restore();
  }
}
