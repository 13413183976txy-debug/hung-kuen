// systems/settings.js —— 本地偏好与个人战绩（localStorage，无外部依赖）
// 键：hg_shake / hg_tutorial / hg_difficulty / hg_records

const KEYS = {
  shake: 'hg_shake',
  tutorial: 'hg_tutorial',
  difficulty: 'hg_difficulty',
  records: 'hg_records',
};

function read(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v;
  } catch (e) { return fallback; }
}
function write(key, value) {
  try { localStorage.setItem(key, value); } catch (e) { /* 隐私模式等：静默 */ }
}

export const Settings = {
  /* —— 减少屏幕震动 —— */
  getReducedShake() { return read(KEYS.shake, '0') === '1'; },
  setReducedShake(v) { write(KEYS.shake, v ? '1' : '0'); },

  /* —— 首次引导 —— */
  getTutorialSeen() { return read(KEYS.tutorial, '0') === '1'; },
  setTutorialSeen() { write(KEYS.tutorial, '1'); },

  /* —— 难度（normal | shura） —— */
  getDifficulty() {
    const d = read(KEYS.difficulty, 'normal');
    return d === 'shura' ? 'shura' : 'normal';
  },
  setDifficulty(d) { write(KEYS.difficulty, d === 'shura' ? 'shura' : 'normal'); },

  /* —— 个人战绩 —— */
  getRecords() {
    try {
      const r = JSON.parse(read(KEYS.records, '{}'));
      return {
        bestBossTime: r.bestBossTime || 0,   // 最快 Boss 击败时间（秒）
        maxKills: r.maxKills || 0,
        maxLevel: r.maxLevel || 0,
        wins: r.wins || 0,
      };
    } catch (e) {
      return { bestBossTime: 0, maxKills: 0, maxLevel: 0, wins: 0 };
    }
  },

  /** 胜负局后更新纪录；返回 { newBestTime } */
  updateRecords(win, stats) {
    const r = this.getRecords();
    let newBestTime = false;
    if (win) {
      r.wins += 1;
      if (stats.bossDown && stats.time > 0 && (!r.bestBossTime || stats.time < r.bestBossTime)) {
        r.bestBossTime = Math.floor(stats.time);
        newBestTime = true;
      }
    }
    if (stats.kills > r.maxKills) r.maxKills = stats.kills;
    if (stats.level > r.maxLevel) r.maxLevel = stats.level;
    write(KEYS.records, JSON.stringify(r));
    return { newBestTime };
  },
};
