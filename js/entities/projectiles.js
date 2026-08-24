// entities/projectiles.js —— 主角气弹（可选远程手段）与敌人攻击弹（暂不启用远程敌方）
// 目前主角以近战扇形攻击为主，此文件保留一个可复用的气弹类，供后续「铁线拳外放」等招式扩展。

export class QiBolt {
  constructor(x, y, angle, opts = {}) {
    this.x = x; this.y = y;
    this.angle = angle;
    this.speed = opts.speed || 520;
    this.radius = opts.radius || 10;
    this.damage = opts.damage || 18;
    this.life = opts.life || 1.1;
    this.friendly = opts.friendly !== false; // true=玩家方
    this.dead = false;
    this.from = opts.from || 'player';
  }

  update(dt, world) {
    this.x += Math.cos(this.angle) * this.speed * dt;
    this.y += Math.sin(this.angle) * this.speed * dt;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    // 气劲球：蓝白光晕
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, this.radius * 1.6);
    grad.addColorStop(0, 'rgba(220,255,255,0.95)');
    grad.addColorStop(0.6, 'rgba(90,200,255,0.6)');
    grad.addColorStop(1, 'rgba(90,200,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, this.radius * 1.6, this.radius * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
