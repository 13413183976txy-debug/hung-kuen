// entities/entity.js —— 实体基类（生命/位置/半径/受伤/存活）
export class Entity {
  constructor(x, y, opts = {}) {
    this.x = x;
    this.y = y;
    this.radius = opts.radius || 16;
    this.hp = opts.maxHp || 1;
    this.maxHp = opts.maxHp || this.hp;
    this.alive = true;
    this.hitFlash = 0;   // 受击闪白计时
    this.dead = false;   // 已结算（防止重复计分）
  }

  takeDamage(dmg, knock = { x: 0, y: 0 }) {
    if (!this.alive) return 0;
    this.hp -= dmg;
    this.hitFlash = 0.12;
    if (knock.x || knock.y) {
      this.x += knock.x;
      this.y += knock.y;
    }
    this.clampToWorld();
    if (this.hp <= 0) { this.hp = 0; this.alive = false; return dmg; }
    return dmg;
  }

  /** 每帧更新通用计时器 */
  tickCommon(dt) {
    if (this.hitFlash > 0) this.hitFlash -= dt;
  }

  clampToWorld() {}
}
