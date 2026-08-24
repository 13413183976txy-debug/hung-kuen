// systems/devcheck.js —— 启动 self-check（只 console.warn，不阻断游戏）
// 检查项：精灵加载失败 / 升级 fields 对应实际读取字段（见 upgrades.js 校验）/
//         波次合法（最后一波为 Boss 波且仅一个）/ 难度倍率有效。
import { WAVES, DIFFICULTY } from '../config.js?v=19';

export function runSelfCheck(loadResults) {
  // 1) 精灵路径可加载
  const failed = (loadResults || []).filter(r => !r.ok);
  if (failed.length) {
    console.warn('[self-check] 精灵加载失败：', failed.map(f => f.name).join(', '));
  }

  // 2) 波次合法：有且仅有最后一波为 Boss 波
  const bossWaves = WAVES.map((w, i) => ({ w, i })).filter(x => x.w.bossWave);
  if (bossWaves.length !== 1) {
    console.warn('[self-check] Boss 波数量异常（应为 1）：', bossWaves.length);
  } else if (bossWaves[0].i !== WAVES.length - 1) {
    console.warn('[self-check] Boss 波不是最后一波');
  }
  if (!WAVES.length || WAVES[0].time !== 0) {
    console.warn('[self-check] 首波应以 time=0 开始');
  }
  for (const w of WAVES) {
    if (w.maxAlive < 0 || w.spawnInterval < 0) console.warn('[self-check] 波次参数非法：', w.name);
  }

  // 3) 难度倍率有效
  for (const [key, d] of Object.entries(DIFFICULTY)) {
    for (const k of ['hp', 'dmg', 'xp', 'bossCd']) {
      if (!(d[k] > 0)) console.warn(`[self-check] 难度 ${key} 的 ${k} 倍率无效`);
    }
    if (!d.name) console.warn(`[self-check] 难度 ${key} 缺少名称`);
  }
}
