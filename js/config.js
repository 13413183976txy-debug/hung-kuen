// config.js —— 全局配置 / 平衡数值 / 波次表 / 精灵映射 / 升级池 / 敌人技能
// 洪拳割草 (Hung Kuen Hordes)
// 说明：所有战斗数值集中在本文档；技能参数（蓄力/有效帧/硬直/冷却）同样在此，
//       禁止在其它文件中硬编码同一数值。

const MAP_SCALE = 1.9;

export const GAME = {
  WIDTH: 960,          // 逻辑画布宽
  HEIGHT: 540,         // 逻辑画布高
  MAP_SCALE,
  WORLD_W: Math.round(816 * MAP_SCALE),   // ≈1550
  WORLD_H: Math.round(484 * MAP_SCALE),   // ≈920
  BG_COLOR: '#1E2619',
};

// 可活动区域：仅草坪（背景图以 816x484 计）
const GRASS = { x: 12, y: 146, w: 792, h: 332 };
GAME.WALK = {
  x: Math.round(GRASS.x * MAP_SCALE),
  y: Math.round(GRASS.y * MAP_SCALE),
  w: Math.round(GRASS.w * MAP_SCALE),
  h: Math.round(GRASS.h * MAP_SCALE),
  get x0() { return this.x; },
  get y0() { return this.y; },
  get x1() { return this.x + this.w; },
  get y1() { return this.y + this.h; },
};

// ---------- 精灵表 ----------
// 只登记被实际绘制的精灵（loadAssets 会全量加载，未用到的条目应删除以省加载）
export const SPRITES = {
  hero_idle:   { src: 'assets/sprites/hero/idle.png',       size: 92 },
  // 定向行走（豆包素材：向两侧各 4 帧 + 背面单帧；向下沿用正脸站姿）
  hero_walk_front: { src: 'assets/sprites/hero/walk_front.png', size: 92 },
  hero_walk_right: { src: 'assets/sprites/hero/walk_right_sheet.png', size: 92, frames: 4 },
  hero_walk_left:  { src: 'assets/sprites/hero/walk_left_sheet.png',  size: 92, frames: 4 },
  hero_walk_back:  { src: 'assets/sprites/hero/walk_back.png',         size: 92 },
  // 普攻：豆包冲拳式（已去底/去水印，含水墨描边）；大招「惊涛叠浪」仍使用水浪素材
  hero_attack: { src: 'assets/sprites/hero/attack_punch.png', size: 92 },
  // 受击：拳架式（被打瞬间的受击姿态，hitFlash 期间显示）
  hero_hurt:   { src: 'assets/sprites/hero/stance.png', size: 92 },
  hero_special:{ src: 'assets/sprites/hero/water_wave.png', size: 128 },

  blade_idle:     { src: 'assets/sprites/blade/idle.png',       size: 76 },
  blade_slash:    { src: 'assets/sprites/blade/slash_down.png', size: 80 },

  hammer_idle:  { src: 'assets/sprites/hammer/idle.png',      size: 92 },
  hammer_raise: { src: 'assets/sprites/hammer/raise.png',     size: 100 },
  hammer_kick:  { src: 'assets/sprites/hammer/jump_kick.png', size: 104 },

  boss_idle:  { src: 'assets/sprites/boss/idle.png',      size: 132 },
  boss_slash: { src: 'assets/sprites/boss/slash.png',     size: 140 },
  boss_red:   { src: 'assets/sprites/boss/slash_red.png', size: 140 },
  boss_kick:  { src: 'assets/sprites/boss/kick.png',      size: 144 },

  ui_background: { src: 'assets/sprites/ui/background.png', size: 0 },
};

// ---------- 主角 ----------
export const PLAYER = {
  RADIUS: 20,
  MAX_HP: 170,
  SPEED: 245,
  // J：普攻（按住自动连击，自动索敌最近一名敌人，单体结算）
  ATK_DAMAGE: 36,
  ATK_COOLDOWN: 0.32,               // 秒
  ATK_RANGE: 150,                   // 命中判定为 150 + 敌人半径
  ATK_ARC: Math.PI * 42 / 180,      // 拳风视觉扇形角度
  ATK_KNOCKBACK: 125,
  // K：惊涛叠浪（360° 水波大招，单次施放，冷却 6s；代价仅为 0.4s 定身，无长时间弱化）
  SPECIAL_DAMAGE: 135,
  SPECIAL_COOLDOWN: 6.0,
  SPECIAL_RANGE: 300,
  SPECIAL_KNOCKBACK: 260,
  // 擒拿手（统一数据，combat 与 enemy 共同遵守）
  GRAB: {
    slowMul: 0.65,         // 减速倍率（35% 减速）
    durationBase: 0.55,    // Lv.1 持续
    durationPerLevel: 0.20,// 每级 +0.20s，最多 3 级
  },
  PICKUP_RADIUS: 240,
  PICKUP_EASE_RADIUS: 420,
  XP_PER_LEVEL_BASE: 10,            // 升级节奏：第 3 波 ≈ Lv.5~6，Boss 前 ≈ Lv.9~11
  XP_GROWTH: 1.18,
  INVULN_TIME: 0.65,
};

// ---------- 敌人数值 ----------
export const ENEMY = {
  // 常态移速均低于主角（245）：普通敌人跑不过玩家（可走位），Boss 靠技能施压
  // 伤害为基础值，随波次 dmgScale 轻微递增（见 WAVES）
  blade: {
    name: '大刀兵', kind: '杂怪', tier: 'normal',
    maxHp: 24,  speed: 205, damage: 6,  attackCd: 1.0,  xp: 2,
    radius: 18, score: 10, sprite: 'blade', color: '#c9a227',
  },
  hammer: {
    name: '锤兵', kind: '精英', tier: 'elite',
    maxHp: 100, speed: 175, damage: 18, attackCd: 1.15, xp: 10,
    radius: 28, score: 50, sprite: 'hammer', color: '#b0483a',
  },
  boss: {
    name: '山贼头目', kind: '关底BOSS', tier: 'boss',
    maxHp: 3200, speed: 215, damage: 24, attackCd: 1.2, xp: 250,
    radius: 46, score: 500, sprite: 'boss', color: '#8e2f2f',
  },
};

// ---------- 敌人技能参数（蓄力提示 → 有效帧 → 收招硬直） ----------
// 所有敌人攻击的伤害只在状态机“有效帧”结算一次；前摇期间播放预警。
// 可用 DEG 角度制转弧度：以下直接用弧度。
export const BLADE_SKILL = {
  windup: 0.18,              // 前摇（短扇面预警，可反应）
  strike: 0.10,              // 有效帧（伤害判定）
  recover: 0.25,             // 收招硬直
  rangeAdd: 34,              // 斩击距离 = 敌人半径+主角半径+6+此值
  arc: Math.PI * 0.55,       // 斩击扇形
  cooldown: ENEMY.blade.attackCd,
};

export const HAMMER_SKILL = {
  windup: 0.48,              // 扬锤蓄力（地面落点预警，足够绕开）
  strike: 0.14,              // 落地有效帧（范围内结算一次）
  recover: 0.70,             // 砸地硬直（罚打窗口）
  radius: 86,                // 落点预警圆 / 伤害半径
  knockback: 240,
  cooldown: ENEMY.hammer.attackCd,
};

// Boss 三阶段技能：minPhase 为所需阶段（0/1/2 = 血量 >66% / 33~66% / <33%）
// 每个技能独立冷却、独立时序，禁止无缝连招；修罗难度下冷却按 DIFFICULTY.bossCd 缩短。
export const BOSS_SKILLS = {
  // 近战：攻击距离 185 > 主角普攻 150（Boss 出手先于主角），前摇 0.28s 仍可读、可躲、可反击
  // 伤害不在此声明——统一走 enemy.damage × 波次 dmgScale（spawner 注入）
  melee: {
    windup: 0.28, strike: 0.18, recover: 0.42,
    range: 185, arc: Math.PI * 0.7,
    knockback: 160,
    cooldown: ENEMY.boss.attackCd,
    minPhase: 0,
  },
  charge: {                  // 二阶段：直线蓄力冲锋（朱砂直线预警 + 倒计时收缩）
    windup: 0.35, strike: 0.5, recover: 0.95,  // 前摇收紧；扑空 0.95s 硬直 = 主要输出窗口
    length: 330, width: 58, dashSpeed: 700,
    knockback: 300,
    cooldown: 5.0,
    minPhase: 1,
  },
  redslash: {                // 三阶段：血刃横扫（宽扇形红预警，可绕后）
    windup: 0.62, strike: 0.22, recover: 0.85,
    range: 210, arc: Math.PI * 0.65,
    knockback: 300,
    cooldown: 4.5,
    minPhase: 2,
  },
};

// ---------- 难度倍率（全部集中于此；修罗 = 敌人更硬更痛、Boss 预警更短，非加速碾压） ----------
// 修罗额外规则（spawner/enemies 实现）：Boss 二/三阶段预警 -12%；第四波存活上限 +2；
// Boss 波每 9 秒刷 1 名大刀兵（最多 2）；不调整任何普通敌人移速（保持低于主角）。
export const DIFFICULTY = {
  normal: { hp: 1.0, dmg: 1.0, xp: 1.0, bossCd: 1.0, name: '常规' },
  shura:  { hp: 1.15, dmg: 1.12, xp: 1.05, bossCd: 0.90, name: '修罗' },
};

export const BOSS_PHASES = ['一 · 蓄势', '二 · 暴起', '三 · 搏命'];

// ---------- 波次表 ----------
// dmgScale：敌人伤害随波次轻微递增（基础伤害 × 该倍率，spawner 注入）；Boss 波恒为 1.0
// maxAlive：场上存活上限（低饱和压力）；spawnInterval：刷怪间隔
// 最终 Boss 波不按时间结束：Boss 死亡后由 main 走清场淡出 → 胜利流程
export const WAVES = [
  { time: 0,   name: '初入洪门', duration: 28, enemies: ['blade'],          spawnInterval: 0.95, maxAlive: 8,  bossWave: false, dmgScale: 1.00 },
  { time: 28,  name: '群刀来袭', duration: 30, enemies: ['blade'],          spawnInterval: 0.82, maxAlive: 11, bossWave: false, dmgScale: 1.04,
    surge: true, surgeText: '群刀压境' },   // 爆发波：出怪量翻倍；开场前 2s 警告停顿
  { time: 58,  name: '精英出头', duration: 32, enemies: ['blade','hammer'], spawnInterval: 0.72, maxAlive: 14, bossWave: false, dmgScale: 1.08 },
  { time: 90,  name: '围剿之战', duration: 35, enemies: ['blade','hammer'], spawnInterval: 0.62, maxAlive: 16, bossWave: false, dmgScale: 1.14,
    surge: true, surgeText: '重围压境' },   // 爆发波：出怪量翻倍；开场前 2s 警告停顿
  { time: 125, name: '头目降临', duration: 0,  enemies: [],                spawnInterval: 0,    maxAlive: 0,  bossWave: true,  dmgScale: 1.00 },  // Boss 波只出 Boss（修罗：每 9s 补 1 名刀兵，最多 2）
];

// ---------- 升级池 ----------
// 约定：
//  - effect(f) 只写 fields 声明的字段；fields 必须是战斗代码实际读取的字段（见 upgrades.js 校验）；
//  - desc(p) 输出“本次实际变化”，卡面预览 = 代码实际执行（加法/乘法必须与文案一致）；
//  - 虎形连环采用线性叠加（+25% 基础伤害/级），非乘法。
const DEG = Math.PI / 180;
const dmg = (p) => PLAYER.ATK_DAMAGE * p.stats.atkMul;

export const UPGRADES = [
  // —— 普攻路线 ——
  { id:'tiger', name:'虎形连环', kind:'攻击', max:5, fields:['stats.atkMul'],
    desc:(p)=>`普攻伤害 +25% 基础值（${Math.round(dmg(p))} → ${Math.round(PLAYER.ATK_DAMAGE * (p.stats.atkMul + 0.25))}）`,
    effect:(f)=>{ f.stats.atkMul += 0.25; } },
  { id:'dragon', name:'龙形吐纳', kind:'攻速', max:5, fields:['stats.cooldownMul'],
    desc:(p)=>`普攻冷却 -12%（${(PLAYER.ATK_COOLDOWN*p.stats.cooldownMul).toFixed(2)}s → ${(PLAYER.ATK_COOLDOWN*p.stats.cooldownMul*0.88).toFixed(2)}s）`,
    effect:(f)=>{ f.stats.cooldownMul *= 0.88; } },
  { id:'crane', name:'鹤步点穴', kind:'命中', max:4, fields:['stats.range','stats.arc'],
    desc:(p)=>`普攻距离 +28（${Math.round(p.stats.range)} → ${Math.round(p.stats.range+28)}），出拳扇形加宽 5°`,
    effect:(f)=>{ f.stats.range += 28; f.stats.arc += 5 * DEG; } },
  { id:'inch', name:'寸劲透体', kind:'暴击', max:4, fields:['stats.crit','stats.critMul'],
    desc:(p)=>`暴击率 +10%（${Math.round(p.stats.crit*100)}% → ${Math.round((p.stats.crit+0.10)*100)}%），暴击倍率 ×2.2`,
    effect:(f)=>{ f.stats.crit += 0.10; f.stats.critMul = 2.2; } },
  { id:'grab', name:'擒拿手', kind:'控制', max:3, fields:['stats.grabLv'],
    desc:(p)=>{ const g=PLAYER.GRAB; const cur=p.stats.grabLv;
      return `命中使目标减速 ${Math.round((1-g.slowMul)*100)}%，持续 ${(g.durationBase + g.durationPerLevel*cur).toFixed(2)}s（同一目标只刷新时长，不叠倍率）`; },
    effect:(f)=>{ f.stats.grabLv += 1; } },

  // —— 大招路线 ——
  { id:'iron', name:'铁线水波', kind:'大招', max:5, fields:['stats.specialDmg'],
    desc:(p)=>`惊涛叠浪伤害 +45（${Math.round(p.stats.specialDmg)} → ${Math.round(p.stats.specialDmg+45)}）`,
    effect:(f)=>{ f.stats.specialDmg += 45; } },
  { id:'aero', name:'内劲回环', kind:'大招', max:4, fields:['stats.specialCd'],
    desc:(p)=>`惊涛叠浪冷却 -0.55s（${Math.max(1.8, p.stats.specialCd).toFixed(1)}s → ${Math.max(1.8, p.stats.specialCd-0.55).toFixed(1)}s，最低 1.8s）`,
    effect:(f)=>{ f.stats.specialCd = Math.max(1.8, f.stats.specialCd - 0.55); } },
  { id:'shock', name:'震场劲', kind:'范围', max:3, fields:['stats.specialRange'],
    desc:(p)=>`惊涛叠浪范围 +32（${Math.round(p.stats.specialRange)} → ${Math.round(p.stats.specialRange+32)}）`,
    effect:(f)=>{ f.stats.specialRange += 32; } },
  { id:'break', name:'破阵', kind:'大招', max:3, fields:['stats.breakLv'],
    desc:(p)=>`每次惊涛叠浪对精英/Boss 各追加其最大生命 ${(1.5*(p.stats.breakLv+1)).toFixed(1)}% 伤害（每个目标每次 K 触发一次）`,
    effect:(f)=>{ f.stats.breakLv += 1; } },

  // —— 生存路线 ——
  { id:'horse', name:'马步扎桩', kind:'生存', max:4, fields:['stats.maxHp','hp'],
    desc:(p)=>`气血上限 +28（${Math.round(p.stats.maxHp)} → ${Math.round(p.stats.maxHp+28)}）并立即回复 28`,
    effect:(f)=>{ f.stats.maxHp += 28; f.hp = Math.min(f.stats.maxHp, f.hp + 28); } },
  { id:'golden', name:'金钟护体', kind:'防守', max:3, fields:['stats.invuln'],
    desc:(p)=>`受击无敌时间 +0.12s（${p.stats.invuln.toFixed(2)}s → ${(p.stats.invuln+0.12).toFixed(2)}s）`,
    effect:(f)=>{ f.stats.invuln += 0.12; } },
  { id:'breath', name:'调息养元', kind:'回复', max:3, fields:['hp'],
    desc:()=>`立即回复 35 气血`,
    effect:(f)=>{ f.hp = Math.min(f.stats.maxHp, f.hp + 35); } },
  { id:'killheal', name:'斩敌回春', kind:'生存', max:3, fields:['stats.killHealLv'],
    desc:(p)=>`击杀回复：普通 +${1*(p.stats.killHealLv+1)} / 精英 +${4*(p.stats.killHealLv+1)} 气血`,
    effect:(f)=>{ f.stats.killHealLv += 1; } },

  // —— 机动路线 ——
  { id:'snake', name:'蛇形游走', kind:'移速', max:4, fields:['stats.speed'],
    desc:(p)=>`移速 +10%（${Math.round(p.stats.speed)} → ${Math.round(p.stats.speed*1.1)}）`,
    effect:(f)=>{ f.stats.speed *= 1.10; } },
];

// 类别归类（供抽卡规则使用）
export const KIND_GROUPS = {
  offense: ['攻击', '攻速', '命中', '暴击', '控制', '范围', '大招'],
  survival: ['生存', '防守', '回复'],
  mobility: ['移速'],
};
