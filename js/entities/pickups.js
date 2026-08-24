// entities/pickups.js —— 「气」经验珠拾取
// 敌人死亡掉落，主角靠近后自动吸收并积累经验。
import { dist2 } from '../utils.js?v=18';
import { PLAYER } from '../config.js?v=18';

export class Pickup {
  constructor(x, y, value = 2) {
    this.x = x; this.y = y;
    this.value = value;      // 经验值
    this.dead = false;
    this.bob = Math.random() * Math.PI * 2;
    this.magnet = false;     // 是否已进入吸收状态
    this.attractSpeed = 0;
  }

  update(dt, world) {
    this.bob += dt * 4;
    const p = world.player;
    if (!p || !p.alive) return;

    const d2 = dist2(this.x, this.y, p.x, p.y);
    const d = Math.sqrt(d2);
    const magnetR = p.stats.pickupRadius ?? PLAYER.PICKUP_RADIUS;
    const easeR = PLAYER.PICKUP_EASE_RADIUS;

    // 大范围缓吸：未进入磁吸圈的气珠也缓缓漂向主角
    if (!this.magnet && d <= easeR) {
      // 缓慢靠近（全屏吸尘感）
      const ease = 0.9; // 每秒移动比例
      this.x += (p.x - this.x) * Math.min(1, ease * dt);
      this.y += (p.y - this.y) * Math.min(1, ease * dt);
    }

    if (!this.magnet && d <= magnetR) this.magnet = true;

    if (this.magnet) {
      const dx = p.x - this.x, dy = p.y - this.y;
      const dd = Math.sqrt(dist2(this.x, this.y, p.x, p.y)) || 1;
      this.attractSpeed = Math.min(1400, this.attractSpeed + 2600 * dt);
      const step = this.attractSpeed * dt;
      this.x += (dx / dd) * step;
      this.y += (dy / dd) * step;
      if (dd < p.radius + 8) {
        this.dead = true;
        p.gainXp(this.value);
      }
    }
  }

  draw(ctx) {
    const s = 6 + Math.sin(this.bob) * 1.5;
    ctx.save();
    ctx.translate(this.x, this.y);
    // 光晕
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 2.2);
    grad.addColorStop(0, 'rgba(255,235,180,0.9)');
    grad.addColorStop(0.5, 'rgba(244,162,97,0.45)');
    grad.addColorStop(1, 'rgba(244,162,97,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(0, 0, s * 2.2, 0, Math.PI * 2); ctx.fill();
    // 核心
    ctx.fillStyle = '#ffe9b0';
    ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}
