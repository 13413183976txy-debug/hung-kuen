// systems/upgrades.js —— 升级三选一（武学秘籍抽取规则）
// 规则：
//  - 已满级卡不出现；
//  - 至少一张输出卡（攻击/攻速/命中/暴击/控制/范围/大招）；
//  - 不允许三张全为生存/援护；
//  - 生命 <35% 时提高生存卡权重（仍保留至少一张输出卡）；
//  - 前 3 次升级优先基础输出、攻速、范围与生存，大招卡降低权重；
//  - 卡面信息：招式名、类别、当前等级（Lv.n → n+1）、本次实际变化文本。
import { UPGRADES, KIND_GROUPS } from '../config.js?v=16';

// —— 开发校验：升级只能读写“战斗代码实际读取”的字段（防卡面有效、代码无效）——
const READ_FIELDS = new Set([
  'stats.maxHp', 'stats.speed', 'stats.atkMul', 'stats.cooldownMul', 'stats.range',
  'stats.arc', 'stats.crit', 'stats.critMul', 'stats.invuln',
  'stats.specialDmg', 'stats.specialCd', 'stats.specialRange',
  'stats.grabLv', 'stats.killHealLv', 'stats.breakLv', 'hp',
]);

let validated = false;
export function validateUpgrades() {
  if (validated) return;
  validated = true;
  for (const u of UPGRADES) {
    if (!Array.isArray(u.fields) || u.fields.length === 0) {
      console.warn(`[upgrades] ${u.id} 缺少 fields 声明`);
      continue;
    }
    for (const f of u.fields) {
      if (!READ_FIELDS.has(f)) {
        console.warn(`[upgrades] ${u.id} 声明了战斗代码不读取的字段: ${f}（假升级）`);
      }
    }
  }
}

export class UpgradeSystem {
  constructor(world) {
    this.world = world;
    validateUpgrades();
  }

  /** 从招式池按规则抽 3 张，返回 [{id,name,kind,cur,max,desc,effect}] */
  roll() {
    const player = this.world.player;
    const lvs = player.upgradeLevels || {};
    const totalLv = Object.values(lvs).reduce((s, v) => s + v, 0);
    const hpRatio = player.hp / player.stats.maxHp;

    let pool = UPGRADES
      .filter(u => (lvs[u.id] || 0) < u.max)
      .map(u => ({ ...u, cur: lvs[u.id] || 0 }));
    // 前 2 次升级：不出现纯大招路线（铁线/回环/震场/破阵），第 3 次起正常加入
    if (totalLv < 2) {
      pool = pool.filter(u => !['iron', 'aero', 'shock', 'break'].includes(u.id));
    }

    const isOffense = (u) => KIND_GROUPS.offense.includes(u.kind);
    const isSurvival = (u) => KIND_GROUPS.survival.includes(u.kind);
    const basics = ['tiger', 'dragon', 'crane', 'horse', 'golden', 'snake'];
    const coreAtk = ['tiger', 'dragon', 'crane'];

    const weightOf = (u) => {
      // 前 2 次升级：基础路线优先，大招线降权
      if (totalLv < 2) {
        if (basics.includes(u.id)) return 3;
        if (KIND_GROUPS.offense.includes(u.kind)) return 1.4;
        if (KIND_GROUPS.survival.includes(u.kind)) return 1.6;
        return 0.5;   // 机动降权
      }
      // 低血保命：生存卡权重提高
      if (hpRatio < 0.40 && isSurvival(u)) return 3;
      return 1;
    };

    // 加权抽 3（不重复）
    const picked = this._weightedSample(pool, 3, weightOf);
    const replaceOne = (predicate, fromFn) => {
      const idx = picked.findIndex(u => !predicate(u));
      if (idx < 0) return false;
      const candidates = pool.filter(fromFn);
      if (!candidates.length) return false;
      picked[idx] = candidates[Math.floor(Math.random() * candidates.length)];
      return true;
    };

    // 兜底 1：至少一张输出卡
    if (!picked.some(isOffense)) {
      replaceOne(isOffense, isOffense);
    }
    // 兜底 2：不允许三张全为生存/防守/回复
    if (picked.length === 3 && picked.every(isSurvival)) {
      replaceOne((u) => !isSurvival(u), isOffense);
    }
    // 兜底 3：前 2 次升级至少出现一次核心输出（虎形/龙形/鹤步之一）
    if (totalLv < 2 && !picked.some(u => coreAtk.includes(u.id))) {
      replaceOne((u) => coreAtk.includes(u.id), (u) => coreAtk.includes(u.id));
    }
    // 兜底 4：血量 <40% 时三选一保证至少一张可立即提高生存的卡
    if (hpRatio < 0.40 && !picked.some(isSurvival)) {
      replaceOne(isSurvival, isSurvival);
    }

    return picked.map(u => ({
      id: u.id, name: u.name, kind: u.kind, cur: u.cur, max: u.max,
      effect: u.effect,
      desc: u.desc ? u.desc(player) : '',
    }));
  }

  /** 加权不放回抽样 */
  _weightedSample(pool, count, weightOf) {
    const bag = pool.slice();
    const out = [];
    const n = Math.min(count, bag.length);
    for (let i = 0; i < n; i++) {
      let total = 0;
      for (const u of bag) total += Math.max(0.001, weightOf(u));
      let r = Math.random() * total;
      let idx = 0;
      for (let j = 0; j < bag.length; j++) {
        r -= Math.max(0.001, weightOf(bag[j]));
        if (r <= 0) { idx = j; break; }
      }
      out.push(bag.splice(idx, 1)[0]);
    }
    return out;
  }

  /** 应用一张招式卡 */
  apply(choice) {
    const player = this.world.player;
    choice.effect(player);
    if (!player.upgradeLevels) player.upgradeLevels = {};
    player.upgradeLevels[choice.id] = (player.upgradeLevels[choice.id] || 0) + 1;
  }
}
