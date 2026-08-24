// entities/player.js —— 主角（蓝衣洪拳弟子）
import { Entity } from './entity.js?v=18';
import { PLAYER, GAME } from '../config.js?v=18';
import { moveAxis, isDown, consumeKeyPress } from '../input.js?v=18';
import { clamp } from '../utils.js?v=18';

export class Player extends Entity {
  constructor(x, y) {
    super(x, y, { radius: PLAYER.RADIUS, maxHp: PLAYER.MAX_HP });
    // 可被升级改写的状态（全部被 combat/enemies/pickups 实际读取）
    this.stats = {
      maxHp: PLAYER.MAX_HP,
      speed: PLAYER.SPEED,
      atkMul: 1.0,             // 虎形连环
      cooldownMul: 1.0,        // 龙形吐纳
      range: PLAYER.ATK_RANGE, // 鹤步点穴
      arc: PLAYER.ATK_ARC,     // 鹤步点穴
      crit: 0,                 // 寸劲透体
      critMul: 2.0,            // 寸劲透体（基础 2.0，习得后 2.2）
      invuln: PLAYER.INVULN_TIME,   // 金钟护体
      pickupRadius: PLAYER.PICKUP_RADIUS,   // 气珠吸附（默认值）
      specialDmg: PLAYER.SPECIAL_DAMAGE,    // 铁线水波
      specialCd: PLAYER.SPECIAL_COOLDOWN,   // 内劲回环
      specialRange: PLAYER.SPECIAL_RANGE,   // 震场劲
      grabLv: 0,               // 擒拿手
      killHealLv: 0,           // 斩敌回春
      breakLv: 0,              // 破阵
    };
    this.hp = this.stats.maxHp;
    this.level = 1;
    this.xp = 0;
    this.xpToNext = PLAYER.XP_PER_LEVEL_BASE;
    this.cooldown = 0;          // 普攻冷却
    this.specialCooldown = 0;   // 大招冷却
    this.facing = 0;            // 朝向（弧度，最后一次移动方向）
    this.attackAnim = 0;        // 出手动画计时
    this.attackKind = null;     // normal | special
    this.invuln = 0;            // 无敌计时
    this.moving = false;
    this.kills = 0;
    this.canLevel = false;
    this.upgradeLevels = {};    // id -> 已习等级
    this.knock = { x: 0, y: 0 };// 受击击退速度（阻尼滑步，避免“直接飞出去”）
  }

  update(dt, world) {
    this.tickCommon(dt);
    if (this.invuln > 0) this.invuln -= dt;
    if (this.cooldown > 0) this.cooldown -= dt;
    if (this.specialCooldown > 0) this.specialCooldown -= dt;
    if (this.attackAnim > 0) this.attackAnim -= dt;
    else this.attackKind = null;

    // ---- 击退滑步（外力；施放大招期间也会被推动）----
    if (this.knock.x !== 0 || this.knock.y !== 0) {
      this.x += this.knock.x * dt;
      this.y += this.knock.y * dt;
      const damp = Math.pow(6.14e-6, dt);        // 指数衰减（λ≈12，约 0.3s 停稳）
      this.knock.x *= damp;
      this.knock.y *= damp;
      if (Math.abs(this.knock.x) + Math.abs(this.knock.y) < 6) {
        this.knock.x = 0;
        this.knock.y = 0;
      }
      this.clampToWorld();
    }

    // ---- 移动 ----
    this.moving = false;
    const casting = this.attackKind === 'special' && this.attackAnim > 0;  // 大招施放：短暂定身
    if (!casting) {
      const axis = moveAxis();
      this.moving = axis.x !== 0 || axis.y !== 0;
      const speed = this.stats.speed;
      this.x += axis.x * speed * dt;
      this.y += axis.y * speed * dt;
      this.clampToWorld();
      // ---- 朝向：最后一次移动方向 ----
      if (this.moving) this.facing = Math.atan2(axis.y, axis.x);
    }

    // ---- 主动攻击 ----
    if (!world.combat) return;
    // J：按住自动连击（normalAttack 内部按冷却节流）
    if (isDown('KeyJ')) world.combat.normalAttack(this, world);
    // K：一次性按键，长按不重复施放
    if (consumeKeyPress('KeyK')) world.combat.specialAttack(this, world);
  }

  clampToWorld() {
    // 只允许在草坪可活动区内移动（顶部山峦为背景）
    const W = GAME.WALK;
    const pad = this.radius * 0.8;
    this.x = clamp(this.x, W.x + pad, W.x + W.w - pad);
    this.y = clamp(this.y, W.y + pad, W.y + W.h - pad);
  }

  /** 拾取「气」经验 */
  gainXp(amount) {
    this.xp += amount;
    let leveled = false;
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level += 1;
      this.xpToNext = Math.round(this.xpToNext * PLAYER.XP_GROWTH);
      leveled = true;
    }
    if (leveled) this.canLevel = true;
    return leveled;
  }

  takeDamage(dmg, knock = { x: 0, y: 0 }) {
    if (!this.alive || this.invuln > 0) return 0;
    // 位移交给击退滑步（不做瞬间位移）
    const dealt = super.takeDamage(dmg, { x: 0, y: 0 });
    // 击退力度 → 滑步初速（×12），上限 1400px/s（最远滑出 ≈117px，重击但不“飞”）
    let kx = knock.x * 12, ky = knock.y * 12;
    const mag = Math.hypot(kx, ky);
    if (mag > 1400) { kx *= 1400 / mag; ky *= 1400 / mag; }
    this.knock.x = kx;
    this.knock.y = ky;
    this.invuln = this.stats.invuln;
    return dealt;
  }
}
