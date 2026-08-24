// systems/particles.js —— 战斗特效池（有对象上限，生命周期到期自动清理）
// 种类：
//  - slash     ：短距离扇形拳风 / 水墨弧光（普通攻击）
//  - spark     ：白黄火星（普通命中）
//  - critRing  ：朱砂红爆裂环 + 尖刺（暴击）
//  - inkBlob   ：碎墨（敌人死亡爆散）
//  - scrap     ：纸屑（死亡爆散）
//  - dmgText   ：浮空伤害数字（暴击更大更红）
//  - qiWisp    ：金色气劲（升级时向角色汇聚）
//  - qiRing    ：金色气环（升级/暴击涟漪）
import { hexToRgb, TAU } from '../utils.js?v=16';

const INK_RGB = hexToRgb('#17130F');
const PAPER_RGB = hexToRgb('#E9D7AA');
const GOLD_RGB = hexToRgb('#D6A84A');
const GOLD_HI_RGB = hexToRgb('#F0CE7E');
const CINNABAR_RGB = hexToRgb('#B5362D');
const CINNABAR_HI_RGB = hexToRgb('#F0664C');

const F_DMG = '700 15px "Microsoft YaHei","PingFang SC",sans-serif';
const F_DMG_CRIT = '800 23px "KaiTi","STKaiti","Microsoft YaHei",sans-serif';

export class Particles {
  constructor(world) {
    this.world = world;
    this.list = [];
    this.cap = 900;          // 对象上限：超出时丢最旧
    this.critRingCanvas = null;
  }

  _push(p) {
    // 达到上限时：优先丢弃“非重要”粒子（普通火星/碎墨等），保护玩家攻击/伤害数字/预警
    if (this.list.length >= this.cap) {
      if (p.priority > 0) {
        const i = this.list.findIndex(q => !q.priority);
        if (i >= 0) { this.list[i] = p; return; }
        this.list[0] = p;
        return;
      }
      this.list[Math.floor(Math.random() * this.cap)] = p;
      return;
    }
    this.list.push(p);
  }

  /* ---------------- 生成 ---------------- */

  /** 短距离扇形拳风 / 水墨弧光 */
  slash(x, y, angle, radius, arc, crit = false) {
    this._push({
      kind: 'slash', x, y, angle, radius, arc,
      life: 0.16, maxLife: 0.16, crit, priority: 2,
    });
  }

  /** 白黄火星（普通命中） */
  hitSparks(x, y, n = 6) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const sp = 90 + Math.random() * 150;
      this._push({
        kind: 'spark', x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.22 + Math.random() * 0.14, maxLife: 0.36,
        color: Math.random() < 0.5 ? PAPER_RGB : GOLD_RGB,
        size: 1.6 + Math.random() * 2.2,
      });
    }
  }

  /** 朱砂红爆裂（暴击）：环 + 放射尖刺 + 火花 */
  critBurst(x, y) {
    // 尖刺
    const n = 12;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + Math.random() * 0.4;
      const sp = 210 + Math.random() * 150;
      this._push({
        kind: 'spike', x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.3 + Math.random() * 0.12, maxLife: 0.42,
        color: Math.random() < 0.4 ? CINNABAR_RGB : CINNABAR_HI_RGB,
        size: 2.4 + Math.random() * 2.4, priority: 1,
      });
    }
    // 环
    this._ring(x, y, 84, CINNABAR_RGB, 0.34, 5);
    this._ring(x, y, 46, CINNABAR_HI_RGB, 0.26, 3.2);
    // 金火星
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * TAU;
      const sp = 130 + Math.random() * 180;
      this._push({
        kind: 'spark', x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.3, maxLife: 0.3,
        color: GOLD_HI_RGB, size: 2 + Math.random() * 2,
      });
    }
  }

  _ring(x, y, maxR, rgb, life, width) {
    this._push({
      kind: 'ring', x, y, r: 6, maxR, color: rgb, life, maxLife: life, width, priority: 2,
    });
  }

  /** K 大招：以主角为圆心的环形水波（扩散环 + 环形水珠） */
  waveRing(x, y, radius) {
    this._ring(x, y, radius, GOLD_RGB, 0.5, 5);
    this._ring(x, y, radius * 0.72, GOLD_HI_RGB, 0.62, 3);
    this._ring(x, y, radius * 0.5, CINNABAR_RGB, 0.42, 2.5);
    const n = 18;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + Math.random() * 0.25;
      const sp = 170 + Math.random() * 140;
      this._push({
        kind: 'spark',
        x: x + Math.cos(a) * radius * 0.35,
        y: y + Math.sin(a) * radius * 0.35,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.42, maxLife: 0.42,
        color: i % 3 === 0 ? CINNABAR_HI_RGB : GOLD_HI_RGB,
        size: 2 + Math.random() * 2.2,
      });
    }
  }

  /** 锤兵砸地：短促尘土环 + 少量尘土（低优先级，可最先被丢弃） */
  slamDust(x, y, r) {
    this._push({
      kind: 'ring', x, y, r: r * 0.25, maxR: r * 0.85,
      color: { r: 176, g: 150, b: 110 }, life: 0.32, maxLife: 0.32, width: 3,
    });
    for (let i = 0; i < 7; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 90;
      this._push({
        kind: 'ink', x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 6,
        life: 0.3 + Math.random() * 0.15, maxLife: 0.45,
        color: Math.random() < 0.5 ? { r: 96, g: 74, b: 48 } : { r: 60, g: 50, b: 42 },
        size: 2.5 + Math.random() * 3,
      });
    }
  }

  /** 敌人死亡：碎墨 + 纸屑爆散 */
  inkBurst(x, y, accent = '#C9A227', big = false) {
    const scale = big ? 1.7 : 1;
    const nInk = big ? 16 : 10;
    const nScrap = big ? 14 : 8;
    const accentRgb = hexToRgb(accent);

    for (let i = 0; i < nInk; i++) {
      const a = Math.random() * TAU;
      const sp = (60 + Math.random() * 190) * scale;
      const ink = Math.random() < 0.55 ? INK_RGB : (Math.random() < 0.5 ? { r: 52, g: 44, b: 38 } : accentRgb);
      this._push({
        kind: 'ink', x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 9,
        life: 0.5 + Math.random() * 0.3, maxLife: 0.8,
        color: ink, size: (3 + Math.random() * 5.5) * scale,
      });
    }
    for (let i = 0; i < nScrap; i++) {
      const a = Math.random() * TAU;
      const sp = (120 + Math.random() * 200) * scale;
      this._push({
        kind: 'scrap', x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 14,
        life: 0.45 + Math.random() * 0.3, maxLife: 0.75,
        color: Math.random() < 0.6 ? PAPER_RGB : (Math.random() < 0.5 ? GOLD_RGB : CINNABAR_RGB),
        size: 2.5 + Math.random() * 4,
      });
    }
  }

  /** 浮空伤害数字 */
  damageText(x, y, amount, crit = false) {
    this._push({
      kind: 'dmg', x: x + (Math.random() * 18 - 9), y: y - 6,
      vy: crit ? -60 : -46,
      life: crit ? 0.85 : 0.6, maxLife: crit ? 0.85 : 0.6,
      text: String(Math.round(amount)), crit, priority: 3,
    });
  }

  /** 升级：金色气劲向角色汇聚 + 金环 */
  qiLevelUp(x, y, count = 26) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      const r = 120 + Math.random() * 190;
      this._push({
        kind: 'qi', cx: x, cy: y,
        x: x + Math.cos(a) * r, y: y + Math.sin(a) * r,
        spd: 60 + Math.random() * 90,
        life: 0.9 + Math.random() * 0.5, maxLife: 1.4,
        size: 2 + Math.random() * 2.5,
        tint: Math.random() < 0.3 ? PAPER_RGB : GOLD_HI_RGB, priority: 1,
      });
    }
    this._ring(x, y, 150, GOLD_RGB, 0.5, 4);
    this._ring(x, y, 220, GOLD_HI_RGB, 0.62, 2.5);
  }

  /** 打击瞬间的一点金星辅助（暴击额外火星） */
  hit(x, y, crit = false) {
    this.hitSparks(x, y, crit ? 12 : 6);
    if (crit) this.critBurst(x, y);
  }

  /* ---------------- 更新 ---------------- */

  update(dt) {
    const list = this.list;
    const player = this.world ? this.world.player : null;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      p.life -= dt;
      switch (p.kind) {
        case 'slash':
        case 'dmg':
          p.y += (p.vy || 0) * dt;
          break;
        case 'spark':
        case 'spike':
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vx *= Math.pow(0.06, dt);   // 帧率无关阻尼
          p.vy *= Math.pow(0.06, dt);
          break;
        case 'ink':
        case 'scrap':
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vx *= Math.pow(0.1, dt);
          p.vy *= Math.pow(0.1, dt);
          p.rot += (p.vr || 0) * dt;
          break;
        case 'ring':
          p.r += (p.maxR - p.r) * Math.min(1, dt * 14);
          break;
        case 'qi': {
          // 金色气劲：加速盘旋汇聚向角色
          if (player && player.alive) {
            const dx = player.x - p.x, dy = player.y - p.y;
            const d = Math.hypot(dx, dy) || 1;
            const acc = 1200 + p.spd * 10;
            p.vx = (p.vx || 0) + (dx / d) * acc * dt;
            p.vy = (p.vy || 0) + (dy / d) * acc * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            if (d < player.radius + 6) p.life = Math.min(p.life, 0.05);
          }
          break;
        }
      }
    }
    this.list = list.filter(p => p.life > 0);
  }

  /* ---------------- 绘制 ---------------- */

  draw(ctx) {
    let additive = false;
    for (let i = 0; i < this.list.length; i++) {
      const p = this.list[i];
      const a = Math.max(0, p.life / p.maxLife);
      const additiveKind = p.kind === 'spark' || p.kind === 'spike' || p.kind === 'ring' || p.kind === 'slash' || p.kind === 'qi';
      if (additiveKind !== additive) {
        ctx.globalCompositeOperation = additiveKind ? 'lighter' : 'source-over';
        additive = additiveKind;
      }

      switch (p.kind) {
        case 'slash': this._drawSlash(ctx, p, a); break;
        case 'spark':
          ctx.globalAlpha = a;
          ctx.fillStyle = `rgb(${p.color.r},${p.color.g},${p.color.b})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0.4, p.size * a), 0, TAU);
          ctx.fill();
          break;
        case 'spike': {
          // 用短粗线条表现暴击尖刺
          ctx.globalAlpha = a;
          ctx.strokeStyle = `rgb(${p.color.r},${p.color.g},${p.color.b})`;
          ctx.lineWidth = p.size;
          ctx.lineCap = 'round';
          const l = 6 + p.size * 2.2;
          const d = Math.hypot(p.vx, p.vy) || 1;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + (p.vx / d) * l, p.y + (p.vy / d) * l);
          ctx.stroke();
          break;
        }
        case 'ring': {
          ctx.globalAlpha = a * 0.9;
          ctx.strokeStyle = `rgb(${p.color.r},${p.color.g},${p.color.b})`;
          ctx.lineWidth = p.width * a + 1;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, TAU);
          ctx.stroke();
          break;
        }
        case 'ink': {
          ctx.globalAlpha = a * 0.75;
          ctx.fillStyle = `rgb(${p.color.r},${p.color.g},${p.color.b})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0.4, p.size * a * 0.95), 0, TAU);
          ctx.fill();
          break;
        }
        case 'scrap': {
          ctx.globalAlpha = a;
          ctx.fillStyle = `rgb(${p.color.r},${p.color.g},${p.color.b})`;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66);
          ctx.restore();
          break;
        }
        case 'dmg': {
          const pop = Math.min(1, (1 - a) * 8 + 0.25);
          ctx.globalAlpha = Math.min(1, a * 2.2);
          ctx.font = p.crit ? F_DMG_CRIT : F_DMG;
          ctx.textAlign = 'center';
          ctx.lineWidth = p.crit ? 4 : 3;
          ctx.strokeStyle = 'rgba(23,19,15,0.9)';
          ctx.strokeText(p.text, p.x, p.y);
          ctx.fillStyle = p.crit ? '#F0664C' : '#F7EEDC';
          ctx.fillText(p.text, p.x, p.y);
          if (p.crit) {
            ctx.globalAlpha = 0.55 * a;
            ctx.font = '700 10px "KaiTi","Microsoft YaHei",sans-serif';
            ctx.fillStyle = '#F0CE7E';
            ctx.fillText('暴!', p.x + 26, p.y - 12 * pop);
          }
          break;
        }
        case 'qi': {
          ctx.globalAlpha = a * 0.85;
          ctx.fillStyle = `rgb(${p.tint.r},${p.tint.g},${p.tint.b})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (0.7 + a * 0.5), 0, TAU);
          ctx.fill();
          break;
        }
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  /** 扇形水墨弧光：外缘弧线 + 内部渐变扇面 */
  _drawSlash(ctx, p, a) {
    const half = p.arc / 2;
    const r0 = p.radius * 0.25;
    const r1 = p.radius * (0.6 + a * 0.4);
    const fade = Math.pow(a, 1.4);

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.globalAlpha = fade * (p.crit ? 0.85 : 0.6);

    // 扇面渐变（内侧亮、外缘淡）
    const g = ctx.createLinearGradient(0, 0, r1, 0);
    if (p.crit) {
      g.addColorStop(0, 'rgba(240,207,126,0.55)');
      g.addColorStop(0.55, 'rgba(209,68,47,0.30)');
      g.addColorStop(1, 'rgba(209,68,47,0)');
    } else {
      g.addColorStop(0, 'rgba(233,215,170,0.42)');
      g.addColorStop(0.5, 'rgba(210,220,225,0.22)');
      g.addColorStop(1, 'rgba(210,220,225,0)');
    }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r1, -half, half);
    ctx.closePath();
    ctx.fill();

    // 外缘弧光（细）
    ctx.strokeStyle = p.crit ? 'rgba(240,102,76,0.8)' : 'rgba(240,206,126,0.75)';
    ctx.lineWidth = p.crit ? 3 : 2;
    ctx.beginPath();
    ctx.arc(0, 0, r1, -half * 0.92, half * 0.92);
    ctx.stroke();

    // 两道笔意弧线（水墨）
    ctx.globalAlpha *= 0.75;
    ctx.strokeStyle = p.crit ? 'rgba(181,54,45,0.5)' : 'rgba(80,112,90,0.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, r1 * 0.78, -half * 0.7, half * 0.7);
    ctx.stroke();
    ctx.restore();
  }
}
