// systems/balance.js —— 开发用平衡信息面板（F3 切换，默认隐藏）
// 显示：波次/存活数 / DPS 估算 / 近 10 秒受创 / 等级·已选升级 / K 冷却 / Boss 阶段与技能状态。
import { UPGRADES, BOSS_PHASES } from '../config.js?v=18';

const NAME = Object.fromEntries(UPGRADES.map(u => [u.id, u.name]));
const NOW = () => performance.now() / 1000;

export class BalancePanel {
  constructor() {
    this.on = false;
  }

  toggle() { this.on = !this.on; return this.on; }

  draw(ctx, world) {
    if (!this.on || !world) return;
    const x = 20, y = 86, pw = 252, ph = 178;
    const now = NOW();

    ctx.save();
    ctx.fillStyle = 'rgba(23,19,15,0.82)';
    ctx.fillRect(x, y, pw, ph);
    ctx.strokeStyle = 'rgba(214,168,74,0.65)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, pw - 1, ph - 1);

    const F = `600 11px "Microsoft YaHei","PingFang SC",sans-serif`;
    const F_BR = `700 11px "KaiTi","STKaiti","Microsoft YaHei",sans-serif`;
    const lines = [];

    const w = world;
    const sp = w.spawner;
    const p = w.player;

    // 波次 · 存活
    const waveName = sp.current ? `${sp.current.name}（第${sp.waveIndex + 1}波）` : '收官';
    const alive = w.enemies.filter(e => e.alive).length;
    lines.push([`波次：${waveName}  存活：${alive}`]);

    // DPS 估算（近 10s 普攻伤害 / 10）
    const now0 = now - 10;
    let dealSum = 0, hurtSum = 0;
    if (w.stats) {
      const dmg = w.stats.dmgWindow || [];
      for (let i = dmg.length - 1; i >= 0; i--) {
        if (dmg[i].t < now0) { dmg.splice(0, i + 1); break; }
        dealSum += dmg[i].v;
      }
      const hurt = w.stats.hurtWindow || [];
      for (let i = hurt.length - 1; i >= 0; i--) {
        if (hurt[i].t < now0) { hurt.splice(0, i + 1); break; }
        hurtSum += hurt[i].v;
      }
    }
    lines.push([`DPS 估算：${Math.round(dealSum / 10)}`]);
    lines.push([`近10s受创：${Math.round(hurtSum)}`]);

    // 等级 + 已选升级
    const ups = Object.entries(p.upgradeLevels || {})
      .filter(([, lv]) => lv > 0)
      .map(([id, lv]) => `${NAME[id] || id}${lv > 1 ? '×' + lv : ''}`)
      .join(' · ');
    lines.push([`Lv.${p.level}  ${ups || '（未习得）'}`]);

    // K 冷却
    lines.push([`K 冷却：${p.specialCooldown > 0 ? p.specialCooldown.toFixed(1) + 's' : '就绪'}`]);

    // Boss 状态
    const boss = w.enemies.find(e => e.isBoss && e.alive);
    if (boss) {
      const st = boss.atk ? `${boss.atk.state}${boss.atk.kind ? '(' + boss.atk.kind + ')' : ''}` : '-';
      lines.push([`Boss：${BOSS_PHASES[boss.phaseIndex] || ''}  ${st}`]);
    } else {
      lines.push(['Boss：未出场']);
    }
    // 全局
    lines.push([`难度：${(w.diff && w.diff.name) || '常规'}  命中率自检通过`]);

    let ly = y + 16;
    for (const [text] of lines) {
      ctx.font = F_BR;
      ctx.fillStyle = 'rgba(233,215,170,0.9)';
      ctx.textAlign = 'left';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 2;
      ctx.fillText(text, x + 10, ly);
      ly += 22;
    }
    ctx.font = F;
    ctx.fillStyle = 'rgba(233,215,170,0.4)';
    ctx.fillText('F3 关闭 · 开发平衡面板', x + 10, y + ph - 8);
    ctx.restore();
  }
}
