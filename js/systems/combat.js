// systems/combat.js —— 主动攻击结算 / 命中 / 击杀 / 打击感触发
import { PLAYER } from '../config.js?v=19';
import { dist, angleTo, norm } from '../utils.js?v=19';
import { Pickup } from '../entities/pickups.js?v=19';

export class Combat {
  constructor(world) { this.world = world; }

  /** J：按住自动连击。自动索敌：不管朝向如何，攻击范围内最近的一名敌人（单体，自动转向）。 */
  normalAttack(player, world) {
    if (player.cooldown > 0 || player.attackAnim > 0) return;
    const arc = player.stats.arc;

    // 自动索敌：任何方向、攻击范围内最近的存活敌人
    const effRange = player.stats.range;
    let target = null, best = Infinity;
    for (const e of world.enemies) {
      if (!e.alive) continue;
      const d = dist(player.x, player.y, e.x, e.y);
      if (d > effRange + e.radius) continue;
      if (d < best) { best = d; target = e; }
    }

    // 空挥：起手 + 拳风 + 风声；不消耗正式攻击冷却（仅被当前出手动画本身拦住）
    if (!target) {
      player.attackAnim = 0.16;
      player.attackKind = 'normal';
      world.particles.slash(player.x, player.y, player.facing, effRange, arc, false);
      if (world.audio) world.audio.play('swing');
      return;
    }

    // 锁定目标：自动转向（无论行走方向）
    player.facing = angleTo(player.x, player.y, target.x, target.y);
    player.cooldown = PLAYER.ATK_COOLDOWN * player.stats.cooldownMul;
    player.attackAnim = 0.22;
    player.attackKind = 'normal';
    world.particles.slash(player.x, player.y, player.facing, effRange, arc * 1.06, false);
    const res = this.hitEnemy(target, player, world, PLAYER.ATK_DAMAGE * player.stats.atkMul, PLAYER.ATK_KNOCKBACK);
    // 本局统计：普攻总伤害 / 最高单次伤害 / DPS 窗口
    world.stats.normalDmg += res.dmg;
    world.stats.maxHit = Math.max(world.stats.maxHit, res.dmg);
    if (world.stats.dmgWindow) world.stats.dmgWindow.push({ t: performance.now() / 1000, v: res.dmg });
    // 擒拿手（PLAYER.GRAB 统一数据）：只对本次命中的单个目标生效，重复命中刷新时长不叠倍率
    if (player.stats.grabLv > 0) {
      target.applySlow(PLAYER.GRAB.slowMul, PLAYER.GRAB.durationBase + PLAYER.GRAB.durationPerLevel * (player.stats.grabLv - 1));
    }
    if (world.audio) world.audio.play('hit');
  }

  /** K：以主角为圆心的 360° 水波大招（单次施放，有冷却；施放时主角定身）。 */
  specialAttack(player, world) {
    if (player.specialCooldown > 0) return;
    player.specialCooldown = player.stats.specialCd;
    player.attackAnim = 0.40;
    player.attackKind = 'special';
    world.particles.waveRing(player.x, player.y, player.stats.specialRange);
    // 本次施放的唯一 castId：破阵每个目标每次 K 只触发一次，但下次 K 可再次触发
    world.specialCastId = (world.specialCastId || 0) + 1;
    const castId = world.specialCastId;
    world.stats.specialCasts += 1;

    const stats = player.stats;
    let anyHit = false;
    for (const e of world.enemies) {
      if (!e.alive) continue;
      const d = dist(player.x, player.y, e.x, e.y);
      if (d > stats.specialRange + e.radius) continue;   // 360° 全圆

      // 破阵：本 castId 内每个精英/Boss 各触发一次
      if (stats.breakLv > 0 && e._breakCast !== castId && (e.tier === 'hammer' || e.isBoss)) {
        e._breakCast = castId;
        const extra = e.maxHp * 0.015 * stats.breakLv;
        if (extra > 0) {
          e.takeDamage(extra, { x: 0, y: 0 });
          world.particles.damageText(e.x, e.y - e.radius * 1.15, extra, true);
          world.camera.addShake(6);
          world.stats.maxHit = Math.max(world.stats.maxHit, extra);
          if (!e.alive) this.onKill(e, world);
        }
      }
      if (!e.alive) { anyHit = true; continue; }

      const res = this.hitEnemy(e, player, world, stats.specialDmg, PLAYER.SPECIAL_KNOCKBACK, true, true);
      anyHit = true;
    }
    if (world.audio) world.audio.play(anyHit ? 'crit' : 'swing');
  }

  /** 对单个敌人结算伤害与打击特效；返回 { dmg, crit }（不播音效，由调用方统一播放）
   *  lightFx=true 时跳过每目标单独的火星/爆裂（大招整体已有环形水波覆盖，避免洪峰卡顿） */
  hitEnemy(enemy, player, world, baseDamage, knockback, forceCrit = false, lightFx = false) {
    let dmg = baseDamage;
    const crit = forceCrit || (player.stats.crit > 0 && Math.random() < player.stats.crit);
    if (!forceCrit && crit) dmg *= player.stats.critMul;
    const n = norm(enemy.x - player.x, enemy.y - player.y);
    const kb = knockback * (enemy.isBoss ? 0.25 : 1);
    enemy.takeDamage(dmg, { x: n.x * kb, y: n.y * kb });
    if (!lightFx) world.particles.hit(enemy.x, enemy.y, crit, enemy.color);
    world.particles.damageText(enemy.x, enemy.y - enemy.radius * 1.15, dmg, crit);
    world.hitStop = Math.max(world.hitStop || 0, crit ? 0.055 : 0.03);
    world.camera.addShake(crit ? 12 : 4.5);
    if (!enemy.alive) this.onKill(enemy, world);
    return { dmg, crit };
  }

  /** 敌人命中主角（由 enemies.update / Boss 冲锋在有效帧触达）；knock 为击退向量 */
  enemyHitPlayer(enemy, world, knock = { x: 0, y: 0 }) {
    const p = world.player;
    const dealt = p.takeDamage(enemy.damage, knock);
    if (dealt > 0) {
      world.particles.hit(p.x, p.y, false);
      world.particles.damageText(p.x, p.y - p.radius * 1.2, dealt, false);
      world.hitStop = Math.max(world.hitStop || 0, 0.035);
      world.camera.addShake(7);
      world.hurtFlash = 0.15;   // 屏幕边缘极轻朱砂闪（≤0.18s）
      if (world.stats && world.stats.hurtWindow) world.stats.hurtWindow.push({ t: performance.now() / 1000, v: dealt });
      if (world.audio) world.audio.play('hurt');
    }
  }

  /** 敌人死亡：计分 + 掉落气珠 + 碎墨爆散 + 斩敌回春 */
  onKill(enemy, world) {
    if (enemy.dead) return;
    enemy.dead = true;
    world.player.kills += 1;
    // 掉落气珠，Boss 掉更多
    const drops = enemy.isBoss ? 12 : (enemy.tier === 'hammer' ? 4 : 2);
    for (let i = 0; i < drops; i++) {
      const ax = enemy.x + (Math.random() * 2 - 1) * enemy.radius;
      const ay = enemy.y + (Math.random() * 2 - 1) * enemy.radius;
      world.pickups.push(new Pickup(ax, ay, Math.max(1, Math.round(enemy.xp / drops))));
    }
    // 斩敌回春：普通 +1 / 精英 +4（每级翻倍）
    const p = world.player;
    if (p.stats.killHealLv > 0) {
      const heal = (enemy.tier === 'hammer' || enemy.isBoss ? 4 : 1) * p.stats.killHealLv;
      p.hp = Math.min(p.stats.maxHp, p.hp + heal);
    }
    // 碎墨 + 纸屑爆散（Boss/精英更大）
    world.particles.inkBurst(enemy.x, enemy.y, enemy.color, enemy.isBoss || enemy.tier === 'hammer');
    world.camera.addShake(enemy.isBoss ? 14 : enemy.tier === 'hammer' ? 7 : 3);
    // 击杀音效按帧节流：大招一波十几杀时不轰炸音频栈
    if (world.audio) {
      world.fxKills = (world.fxKills || 0) + 1;
      if (world.fxKills <= 4) world.audio.play(enemy.tier === 'boss' ? 'boss_down' : 'kill');
    }
  }
}
