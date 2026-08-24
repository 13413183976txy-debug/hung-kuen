// entities/bossai.js —— Boss 技能决策（独立模块，便于单独调参/审查）
// 阶段由血量驱动：0（>66%）常规近战；1（33~66%）解锁蓄力冲锋；2（<33%）解锁血刃横扫。
// 每技能独立冷却；修罗难度按 DIFFICULTY.bossCd 缩短冷却（倍率在 config.js）。
import { BOSS_SKILLS } from '../config.js?v=17';

export function bossPhaseIndex(enemy) {
  const r = enemy.hp / enemy.maxHp;
  return r > 0.66 ? 0 : r > 0.33 ? 1 : 2;
}

/** 返回 { kind, skill } 或 null（无可用技能时保持追击） */
export function decideBossSkill(enemy, d, reach, world) {
  const ph = bossPhaseIndex(enemy);
  const cdMul = (enemy.diff && enemy.diff.bossCd) || 1;
  const inMelee = d <= BOSS_SKILLS.melee.range + world.player.radius + 4;

  if (ph >= 2 && enemy.redCd <= 0 && d <= BOSS_SKILLS.redslash.range + 60) {
    enemy.redCd = BOSS_SKILLS.redslash.cooldown * cdMul;
    return { kind: 'redslash', skill: BOSS_SKILLS.redslash };
  }
  if (ph >= 1 && enemy.chargeCd <= 0) {
    enemy.chargeCd = BOSS_SKILLS.charge.cooldown * cdMul;
    return { kind: 'charge', skill: BOSS_SKILLS.charge };
  }
  if (inMelee && enemy.attackCd <= 0 && enemy.attackAnim <= 0) {
    enemy.attackCd = BOSS_SKILLS.melee.cooldown * cdMul;
    return { kind: 'melee', skill: BOSS_SKILLS.melee };
  }
  return null;
}
