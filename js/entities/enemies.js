// entities/enemies.js —— 敌人 AI + 技能状态机
// 三类敌人：
//  - 大刀兵：低压迫包围单位，快刀连闪（前摇短、无地面预警）
//  - 锤兵  ：扬锤砸地（前摇阶段地面落点预警圆；玩家离开范围则不受伤）
//  - Boss  ：三阶段技能（一阶段近战斩 → 二阶段蓄力冲锋 → 三阶段红扇形斩），
//            每个技能 = 蓄力提示（朱砂预警区+音效）→ 有效帧（伤害仅结算一次）→ 收招硬直
// 所有技能参数集中在 config.js 的 BLADE_SKILL / HAMMER_SKILL / BOSS_SKILLS。
import { Entity } from './entity.js?v=17';
import { ENEMY, GAME, BLADE_SKILL, HAMMER_SKILL, BOSS_SKILLS } from '../config.js?v=17';
import { bossPhaseIndex, decideBossSkill } from './bossai.js?v=17';
import { dist, angleTo, angleDiff, norm, clamp } from '../utils.js?v=17';

let nextId = 1;

/** 工厂：diff = 难度倍率（config.DIFFICULTY）；dmgScale = 当前波次伤害倍率（WAVES.dmgScale） */
export function makeEnemy(tier, x, y, diff, dmgScale = 1) {
  const c = ENEMY[tier];
  const e = new Enemy(x, y, tier, c, diff, dmgScale);
  return e;
}

/** 敌人间最小间距（相邻推挤，防止完全重叠）。O(n²)，场上 ≤20 无压力。 */
export function separateEnemies(list) {
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (!a.alive) continue;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      if (!b.alive) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const min = a.radius + b.radius + 6;
      const d2 = dx * dx + dy * dy;
      if (d2 < min * min && d2 > 0.01) {
        const d = Math.sqrt(d2);
        const push = (min - d) / d * 0.5;
        a.x -= dx * push; a.y -= dy * push;
        b.x += dx * push; b.y += dy * push;
      }
    }
    a.clampToWorld();
  }
}

class Enemy extends Entity {
  constructor(x, y, tier, c, diff = null, dmgScale = 1) {
    super(x, y, { radius: c.radius, maxHp: Math.round(c.maxHp * ((diff && diff.hp) || 1)) });
    this.id = nextId++;
    this.tier = tier;
    this.name = c.name;
    this.kind = c.kind;
    this.speed = c.speed;
    this.damage = c.damage * ((diff && diff.dmg) || 1) * dmgScale;
    this.xp = c.xp * ((diff && diff.xp) || 1);
    this.score = c.score;
    this.color = c.color;
    this.diff = diff;   // 难度倍率（bossCd 用于技能冷却）

    this.aimAngle = 0;        // 朝玩家方向（仅移动/预警朝向）
    this.anim = Math.random();
    this.attackAnim = 0;      // 攻击表现计时（驱动精灵切换）
    this.attackAnimKind = ''; // slash | raise | kick | red | chargeDash
    this.elite = tier !== 'blade';
    this.isBoss = tier === 'boss';
    this.phase = Math.random() * Math.PI * 2;

    // —— 攻击状态机：idle → windup（蓄力+预警）→ strike（有效帧，伤害一次）→ recover → idle ——
    this.atk = { state: 'idle', kind: '', t: 0, hitDone: true, ang: 0, tx: 0, ty: 0 };
    this.attackCd = 0.35 + Math.random() * 0.5;      // 首次出手错开
    this.chargeCd = 1.6;                              // Boss 冲锋冷却（入场 1.6s 后可用）
    this.redCd = 2.4;                                 // Boss 红斩冷却
    this.telegraph = null;                            // 当前预警（地面朱砂区，main 负责绘制）
    this.dash = null;                                 // 冲锋状态 {ang, t, dur} 

    this.slowMul = 1;   // 擒拿手减速
    this.slowT = 0;
    this.fade = 1;      // 通关清场淡出
  }

  /** 擒拿手减速：绝对倍率 + 刷新时长（不叠乘） */
  applySlow(mul, dur) {
    this.slowMul = mul;
    this.slowT = dur;               // 只刷新持续时间
  }

  /** 当前 Boss 阶段（逻辑在 bossai.js）：0（>66%）、1（33~66%）、2（<33%） */
  get phaseIndex() { return bossPhaseIndex(this); }

  /* ---------------- 状态机驱动 ---------------- */

  _startAttack(kind, skill, world) {
    const a = this.atk;
    // 修罗：Boss 二/三阶段预警缩短 12%（只减反应时间，不减伤害）
    let windup = skill.windup;
    if (this.isBoss && world.difficulty === 'shura' && (kind === 'charge' || kind === 'redslash')) {
      windup *= 0.88;
    }
    a.state = 'windup'; a.kind = kind; a.t = windup; a.hitDone = false;
    a.ang = angleTo(this.x, this.y, world.player.x, world.player.y);
    // 有效范围（伤害判定共用）：大刀兵 = reach + rangeAdd；锤兵 = 落点半径；Boss = 技能 range
    const reach = this.radius + world.player.radius + 6;
    a.range = (kind === 'slash') ? reach + BLADE_SKILL.rangeAdd
            : (kind === 'splash') ? HAMMER_SKILL.radius
            : skill.range;
    this._makeTelegraph(kind, skill, world);
    // 预警计时（frame 累计，暂停时冻结；由 main.drawTelegraph 读取 progress）
    if (this.telegraph) {
      this.telegraph.dur = windup;
      this.telegraph.age = 0;
    }
    if (world.audio) world.audio.play(kind === 'charge' ? 'charge' : 'telegraph');
    this.attackAnim = windup;
    // 前摇精灵：锤兵举锤；Boss 蓄力（冲锋/红斩）时保持站姿由预警传达
    this.attackAnimKind = this.isBoss ? '' : (this.tier === 'hammer' ? 'raise' : 'slash');
  }

  _makeTelegraph(kind, skill, world) {
    if (kind === 'splash') {
      this.atk.tx = world.player.x; this.atk.ty = world.player.y;   // 落点（预警圆与砸地伤害共用）
      this.telegraph = { kind: 'circle', x: world.player.x, y: world.player.y, r: skill.radius };
    } else if (kind === 'charge') {
      this.telegraph = { kind: 'rect', x: this.x, y: this.y, ang: this.atk.ang, len: skill.length, width: skill.width };
    } else if (kind === 'redslash') {
      this.telegraph = { kind: 'fan', x: this.x, y: this.y, ang: this.atk.ang, r: skill.range, arc: skill.arc };
    } else if (kind === 'melee') {
      this.telegraph = { kind: 'fan', x: this.x, y: this.y, ang: this.atk.ang, r: skill.range, arc: skill.arc, faint: true };
    } else if (kind === 'slash') {
      this.telegraph = { kind: 'fan', x: this.x, y: this.y, ang: this.atk.ang, r: this.radius + world.player.radius + 6 + skill.rangeAdd, arc: skill.arc, faint: true };
    }
  }

  _enterStrike(skill, world) {
    const a = this.atk;
    a.state = 'strike'; a.t = skill.strike; a.hitDone = true;   // 有效帧：进入即结算一次
    this.telegraph = null;
    this.attackAnim = skill.strike;
    // 精灵表现
    if (this.tier === 'hammer') this.attackAnimKind = 'kick';
    else if (this.isBoss) this.attackAnimKind = a.kind === 'charge' ? 'kick' : a.kind === 'redslash' ? 'red' : 'slash';
    else this.attackAnimKind = 'slash';

    if (a.kind === 'charge') {
      this.dash = { ang: a.ang, t: 0, dur: skill.strike, hit: false };
      return;   // 冲锋伤害在冲刺帧内接触判定
    }
    // 锤兵落地瞬间：尘土/碎墨环（数量有上限的轻量粒子）
    if (a.kind === 'splash') {
      world.particles.slamDust(a.tx, a.ty, a.range);
    }
    // 普通近战/砸地/红斩：一次范围判定（范围在 _startAttack 已按类型算好 → a.range）
    const p = world.player;
    if (!p || !p.alive) return;
    const d = dist(this.x, this.y, p.x, p.y);
    let hit = false;
    if (a.kind === 'melee' || a.kind === 'slash' || a.kind === 'redslash') {
      const pa = angleTo(this.x, this.y, p.x, p.y);
      hit = d <= a.range + p.radius && Math.abs(angleDiff(a.ang, pa)) <= skill.arc / 2;
    } else if (a.kind === 'splash') {
      hit = d <= a.range + p.radius * 0.4;
    }
    if (hit) {
      const kd = (a.kind === 'melee' || a.kind === 'slash') ? 80 : skill.knockback;
      const n = norm(p.x - this.x, p.y - this.y);
      world.combat.enemyHitPlayer(this, world, { x: n.x * kd, y: n.y * kd });
    }
  }

  _enterRecover(skill) {
    const a = this.atk;
    a.state = 'recover'; a.t = skill.recover;
    this.dash = null;
    this.attackAnim = 0;
    this.attackAnimKind = '';
  }

  /* ---------------- 主更新 ---------------- */

  update(dt, world) {
    this.tickCommon(dt);
    this.anim += dt * (this.isBoss ? 3 : 6);
    if (this.attackAnim > 0) this.attackAnim -= dt;
    if (this.telegraph) this.telegraph.age += dt;
    if (this.slowT > 0) { this.slowT -= dt; if (this.slowT <= 0) this.slowMul = 1; }
    if (this.attackCd > 0) this.attackCd -= dt;
    if (this.chargeCd > 0) this.chargeCd -= dt;
    if (this.redCd > 0) this.redCd -= dt;

    const p = world.player;
    if (!p || !p.alive) return;
    const d = dist(this.x, this.y, p.x, p.y);
    const ang = angleTo(this.x, this.y, p.x, p.y);
    this.aimAngle = ang;
    const speed = this.speed * this.slowMul;
    const reach = this.radius + p.radius + 6;

    // —— 技能状态机推进 ——
    const a = this.atk;
    if (a.state !== 'idle') {
      a.t -= dt;
      if (a.t <= 0) {
        if (a.state === 'windup') this._enterStrike(this._skill(a.kind), world);
        else if (a.state === 'strike') this._enterRecover(this._skill(a.kind));
        else { a.state = 'idle'; a.kind = ''; }
      }
    }

    // —— 冲锋位移（strike 阶段，每帧接触判定一次）——
    if (this.dash) {
      const st = this._skill('charge');
      this.dash.t += dt;
      this.x += Math.cos(this.dash.ang) * st.dashSpeed * dt;
      this.y += Math.sin(this.dash.ang) * st.dashSpeed * dt;
      // 接触判定（一次性）
      if (!this.dash.hit && p.alive && dist(this.x, this.y, p.x, p.y) < this.radius + p.radius + 14) {
        this.dash.hit = true;
        const n = norm(this.x - p.x, this.y - p.y);
        world.combat.enemyHitPlayer(this, world, { x: n.x * st.knockback, y: n.y * st.knockback });
      }
      // 撞到活动区边缘：提前结束冲锋 + 更长硬直（安全输出窗口≥0.6s）
      const W = GAME.WALK, pad = this.radius;
      const hitWall = this.x <= W.x + pad + 1 || this.x >= W.x + W.w - pad - 1 ||
                      this.y <= W.y + pad + 1 || this.y >= W.y + W.h - pad - 1;
      if (hitWall) {
        this.dash.t = this.dash.dur;
        this._hardRecover(Math.max(0.6, st.recover));
        this.clampToWorld();
      } else if (this.dash.t >= this.dash.dur) {
        this._enterRecover(st);
      }
      this.clampToWorld();
      return;   // 冲锋期间不执行其它移动
    }

    // —— 攻击发起（Idle 时按技能冷却与距离）——
    if (a.state === 'idle') {
      if (this.isBoss) this._tryBossSkill(d, reach, world);
      else if (this.tier === 'hammer') this._tryHammer(d, reach, world);
      else this._tryBlade(d, reach, world);
    }

    // —— 移动（非攻击状态才移动；攻击期间站桩）——
    if (a.state !== 'idle') {
      this.clampToWorld();
      return;
    }

    if (this.isBoss) {
      // Boss：直冲 + 一点左右蛇形，压迫感更强
      const sway = Math.sin(this.phase + performance.now() * 0.0011) * 0.35;
      const aa = ang + sway;
      this.x += Math.cos(aa) * speed * dt;
      this.y += Math.sin(aa) * speed * dt;
    } else {
      const engage = this.tier === 'hammer' ? reach + 22 : reach + 6;
      if (d > engage) {
        const n = norm(p.x - this.x, p.y - this.y);
        this.x += n.x * speed * dt;
        this.y += n.y * speed * dt;
      } else {
        // 松散包围：沿切向缓慢游走
        const side = Math.sin(this.phase + performance.now() * 0.0007) > 0 ? 1 : -1;
        this.x += Math.cos(ang + Math.PI / 2) * side * speed * 0.22 * dt;
        this.y += Math.sin(ang + Math.PI / 2) * side * speed * 0.22 * dt;
      }
    }
    this.clampToWorld();
  }

  _skill(kind) {
    if (this.isBoss) return BOSS_SKILLS[kind] || BOSS_SKILLS.melee;
    if (this.tier === 'hammer') return HAMMER_SKILL;
    return BLADE_SKILL;
  }

  _hardRecover(dur) {
    const a = this.atk;
    a.state = 'recover'; a.t = dur; a.hitDone = true;
    this.telegraph = null;
    this.dash = null;
  }

  _tryBlade(d, reach, world) {
    const sk = BLADE_SKILL;
    const attackRange = reach + sk.rangeAdd;
    const p = world.player;
    if (d <= attackRange && this.attackCd <= 0 && this.attackAnim <= 0) {
      this.attackCd = sk.cooldown;
      this._startAttack('slash', sk, world);
    }
  }

  _tryHammer(d, reach, world) {
    const sk = HAMMER_SKILL;
    const attackRange = reach + 24;
    if (d <= attackRange && this.attackCd <= 0 && this.attackAnim <= 0) {
      this.attackCd = sk.cooldown;
      this._startAttack('splash', sk, world);
    }
  }

  /** Boss 技能决策（逻辑在 bossai.js；每技能独立冷却，不无缝连招） */
  _tryBossSkill(d, reach, world) {
    const pick = decideBossSkill(this, d, reach, world);
    if (pick) this._startAttack(pick.kind, pick.skill, world);
  }

  clampToWorld() {
    const W = GAME.WALK;
    const pad = this.radius * 0.35;
    this.x = clamp(this.x, W.x + pad, W.x + W.w - pad);
    this.y = clamp(this.y, W.y + pad, W.y + W.h - pad);
  }
}
