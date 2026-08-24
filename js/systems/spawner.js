// systems/spawner.js —— 刷怪波次系统
// 小兵一律从地图（草坪）边缘刷出后向主角靠近；
// 最终 Boss 波只出 Boss 本体、不再刷小兵，且不按时间结束（胜负由 Boss 死亡决定）；
// Boss 死亡后由 main 走“清场淡出 → 胜利”流程（见 spawner.stopSpawning）。
import { WAVES, GAME } from '../config.js?v=19';
import { makeEnemy } from '../entities/enemies.js?v=19';
import { pick } from '../utils.js?v=19';

export class Spawner {
  constructor(world) {
    this.world = world;
    this.time = 0;          // 当前波次内计时
    this.globalTime = 0;    // 全场计时（秒）
    this.waveIndex = 0;     // 当前波索引（开局即第一波）
    this.spawnTimer = 0.5;  // 开局缓冲后出第一只怪
    this.bossSpawned = false;
    this.stopSpawning = false;   // Boss 已死亡：停止一切刷新
    this.shuraMiniTimer = 0;     // 修罗 Boss 波：大刀兵补充计时
    this.waitTimer = 0;          // 爆发波开场警告停顿（>0 时停止出怪）
  }

  /** 当前波配置 */
  get current() { return WAVES[this.waveIndex] || null; }

  /** Boss 死亡：停止刷新（清场与胜利判定由 main 驱动） */
  onBossDefeated() {
    this.stopSpawning = true;
  }

  update(dt) {
    if (this.stopSpawning) return;
    const w = this.current;
    if (!w) return;

    this.globalTime += dt;
    this.time += dt;

    // Boss 波：只出 Boss 本体（修罗：每 9s 补 1 名大刀兵，最多 2，无锤兵）
    if (w.bossWave) {
      if (!this.bossSpawned) {
        this.bossSpawned = true;
        this.spawnOne('boss');
      }
      if (this.world.difficulty === 'shura') {
        this.shuraMiniTimer -= dt;
        if (this.shuraMiniTimer <= 0) {
          this.shuraMiniTimer = 9;
          const blades = this.world.enemies.filter(e => e.tier === 'blade' && e.alive).length;
          if (blades < 2) this.spawnOne('blade');
        }
      }
    } else {
      // 爆发波开场：先停止出怪，屏幕中央警告 2 秒，随后爆发一波（翻倍）
      if (this.waitTimer > 0) {
        this.waitTimer -= dt;
        if (this.waitTimer <= 0) {
          this._spawnSurge(w);              // 停顿结束：立即爆发（翻倍批量）
          this.spawnTimer = w.spawnInterval;
        }
      } else {
        // 普通出怪：按间隔刷小兵（爆发波整波批量翻倍）
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
          this.spawnTimer = w.spawnInterval;
          this.spawnBatch(w);
        }
      }
    }

    // 波次切换：非 Boss 波按时间推进；Boss 波交由 Boss 死亡判定
    if (!w.bossWave && this.time >= w.duration) {
      this.waveIndex += 1;
      if (this.waveIndex < WAVES.length) {
        this.time = 0;
        this.bossSpawned = false;
        const nw = WAVES[this.waveIndex];
        if (nw.surge) this.waitTimer = 2.0;   // 爆发波：2s 警告停顿再出怪
        this.spawnTimer = nw.spawnInterval;
      }
    }
  }

  /** 爆发波开场：一次性翻倍批量出怪 */
  _spawnSurge(w) {
    const n = (w.enemies.length > 1 ? 2 : 1) * 2;
    for (let i = 0; i < n; i++) {
      this.spawnOne(pick(w.enemies));
    }
  }

  /** 在场地边缘批量生成（限制在场存活数；修罗难度第四波上限 +2） */
  spawnBatch(w) {
    const alive = this.world.enemies.filter(e => e.alive).length;
    const maxAlive = w.maxAlive + (this.world.difficulty === 'shura' && this.waveIndex === 3 ? 2 : 0);
    if (alive >= maxAlive) return;
    const n = (w.enemies.length > 1 ? 2 : 1) * (w.surge ? 2 : 1);   // 爆发波批量翻倍
    for (let i = 0; i < n; i++) {
      const tier = pick(w.enemies);
      this.spawnOne(tier);
    }
  }

  /** 从地图（草坪）边缘刷出，随后自动向主角靠近 */
  spawnOne(tier) {
    const W = GAME.WALK;
    const inset = 30;
    const side = Math.floor(Math.random() * 4);
    let x, y;
    if (side === 0) {       // 上缘
      x = W.x + inset + Math.random() * (W.w - inset * 2);
      y = W.y + inset;
    } else if (side === 1) { // 下缘
      x = W.x + inset + Math.random() * (W.w - inset * 2);
      y = W.y + W.h - inset;
    } else if (side === 2) { // 左缘
      y = W.y + inset + Math.random() * (W.h - inset * 2);
      x = W.x + inset;
    } else {                 // 右缘
      y = W.y + inset + Math.random() * (W.h - inset * 2);
      x = W.x + W.w - inset;
    }
    const w = this.current;
    const dmgScale = w && w.dmgScale ? w.dmgScale : 1;
    this.world.enemies.push(makeEnemy(tier, x, y, this.world.diff, dmgScale));
  }
}
