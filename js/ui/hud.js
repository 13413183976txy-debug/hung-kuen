// ui/hud.js —— 气血 / 内息（卷轴长条）、战局计时·斩敌·波次、Boss 血条与阶段
// 全部绘制在 960x540 逻辑画布上，配色沿用 CSS 五色。
import { GAME, BOSS_PHASES } from '../config.js?v=20';

const INK = '#17130F';
const PAPER = '#E9D7AA';
const PAPER_DIM = 'rgba(233,215,170,0.62)';
const CINNABAR = '#B5362D';
const GOLD = '#D6A84A';
const GOLD_HI = '#F0CE7E';
const BAMBOO = '#50705A';

const F_BRUSH = '"KaiTi","STKaiti","FangSong","Microsoft YaHei",sans-serif';
const F_BODY = '"Microsoft YaHei","PingFang SC",sans-serif';

export class Hud {
  constructor() {
    this.bossPhase = -1;
  }

  draw(ctx, world) {
    const p = world.player;
    const sp = world.spawner;
    const W = GAME.WIDTH;

    ctx.save();
    ctx.textBaseline = 'middle';

    // ---- 左上：气血 + 内息（卷轴长条）----
    const bw = 292;
    this.scrollBar(ctx, 20, 18, bw, 20, p.hp / p.stats.maxHp, '气血',
      `${Math.ceil(p.hp)}/${p.stats.maxHp}`,
      { grad: ['#D1442F', '#A3261E', '#7E1F1B'], pulse: p.hp / p.stats.maxHp < 0.28 });
    this.scrollBar(ctx, 20, 48, bw, 15, p.xp / p.xpToNext, '内息',
      `Lv.${p.level}`,
      { grad: ['#F0CE7E', '#D6A84A', '#A97F2E'], dim: true });

    // ---- 右上：战局计时 / 斩敌 / 波次 ----
    this.statsPanel(ctx, W, world);

    // ---- Boss 血条 ----
    this.bossBar(ctx, W, world);

    // ---- Boss 波目标提示（阶段提示之下，Boss 未出场/登场前显示）----
    if (world.spawner.current && world.spawner.current.bossWave && !world.bossDefeated) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `700 11px ${F_BRUSH}`;
      ctx.fillStyle = 'rgba(233,215,170,0.72)';
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur = 4;
      ctx.fillText('目标 · 击败山贼头目', W / 2, 72);
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  /** 卷轴式长条：金边深墨底 + 端轴 + 渐变填充 + kaiti 标签 */
  scrollBar(ctx, x, y, w, h, ratio, label, valueText, opt = {}) {
    ratio = Math.max(0, Math.min(1, ratio));
    const cap = Math.max(7, Math.floor(h * 0.5)); // 端轴宽
    ctx.save();

    // 底：深墨面板 + 细金描边
    ctx.fillStyle = 'rgba(23,19,15,0.82)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(214,168,74,0.75)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.strokeStyle = 'rgba(23,19,15,0.9)';
    ctx.strokeRect(x + 2.5, y + 2.5, w - 5, h - 5);

    // 填充（仅中间通行区）
    const fx = x + cap, fw = w - cap * 2;
    if (ratio > 0.003) {
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      const [c1, c2, c3] = opt.grad;
      g.addColorStop(0, c1);
      g.addColorStop(0.55, c2);
      g.addColorStop(1, c3);
      ctx.fillStyle = g;
      ctx.fillRect(fx, y + 2.5, fw * ratio, h - 5);
      // 顶部水光
      ctx.fillStyle = 'rgba(255,240,200,0.16)';
      ctx.fillRect(fx, y + 2.5, fw * ratio, Math.max(2, h * 0.28));
    }

    // 端轴（左右卷轴头）
    const capGrad = ctx.createLinearGradient(0, y, 0, y + h);
    capGrad.addColorStop(0, '#3A2A18');
    capGrad.addColorStop(0.5, '#241B10');
    capGrad.addColorStop(1, '#120D08');
    for (const cx of [x, x + w - cap]) {
      ctx.fillStyle = capGrad;
      ctx.fillRect(cx, y - 1, cap, h + 2);
      ctx.strokeStyle = 'rgba(214,168,74,0.6)';
      ctx.lineWidth = 1;
      ctx.strokeRect(cx + 0.5, y - 0.5, cap - 1, h + 1);
      // 轴芯金点
      ctx.fillStyle = 'rgba(240,206,126,0.55)';
      ctx.fillRect(cx + cap * 0.25, y + h / 2 - 1, cap * 0.5, 2);
    }

    // 标签（左）：kaiti 小字
    ctx.textAlign = 'left';
    ctx.font = `700 ${Math.max(11, h - 6)}px ${F_BRUSH}`;
    ctx.fillStyle = opt.dim ? GOLD_HI : PAPER;
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 3;
    ctx.fillText(label, x + cap + 6, y + h / 2 + 0.5);
    // 数值（右）
    ctx.textAlign = 'right';
    ctx.font = `700 ${Math.max(10, h - 8)}px ${F_BODY}`;
    ctx.fillStyle = PAPER;
    ctx.fillText(valueText, x + w - cap - 6, y + h / 2 + 0.5);
    ctx.shadowBlur = 0;

    // 低血量：标签脉动朱砂
    if (opt.pulse) {
      const t = performance.now() * 0.008;
      ctx.globalAlpha = 0.65 + Math.sin(t) * 0.35;
      ctx.textAlign = 'left';
      ctx.font = `700 ${Math.max(11, h - 6)}px ${F_BRUSH}`;
      ctx.fillStyle = '#E8604A';
      ctx.fillText(label, x + cap + 6, y + h / 2 + 0.5);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  /** 右上战绩面板 */
  statsPanel(ctx, W, world) {
    const p = world.player;
    const sp = world.spawner;
    const pw = 208, ph = 106;
    const x = W - pw - 16, y = 16;

    ctx.save();
    // 深墨半透明面板 + 细金描边 + 左侧朱砂线
    ctx.fillStyle = 'rgba(23,19,15,0.6)';
    ctx.fillRect(x, y, pw, ph);
    ctx.strokeStyle = 'rgba(214,168,74,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, pw - 1, ph - 1);
    ctx.fillStyle = 'rgba(181,54,45,0.9)';
    ctx.fillRect(x, y + 6, 2, ph - 12);

    // 战局计时
    const t = Math.floor(sp.globalTime);
    const mm = String(Math.floor(t / 60)).padStart(2, '0');
    const ss = String(t % 60).padStart(2, '0');
    ctx.textAlign = 'left';
    ctx.font = `700 11px ${F_BRUSH}`;
    ctx.fillStyle = PAPER_DIM;
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 3;
    ctx.fillText('战局', x + 12, y + 17);
    ctx.textAlign = 'right';
    ctx.font = `800 25px ${F_BODY}`;
    ctx.fillStyle = PAPER;
    ctx.fillText(`${mm}:${ss}`, x + pw - 12, y + 16);

    // 斩敌
    ctx.textAlign = 'left';
    ctx.font = `700 10.5px ${F_BRUSH}`;
    ctx.fillStyle = PAPER_DIM;
    ctx.fillText('斩敌', x + 12, y + 44);
    ctx.textAlign = 'right';
    ctx.font = `700 15px ${F_BODY}`;
    ctx.fillStyle = PAPER;
    ctx.fillText(String(p.kills), x + pw - 12, y + 44);

    // 波次
    const wIdx = sp.waveIndex + 1;
    const wName = sp.current ? sp.current.name : '收官';
    ctx.textAlign = 'left';
    ctx.font = `700 10.5px ${F_BRUSH}`;
    ctx.fillStyle = PAPER_DIM;
    ctx.fillText('波次', x + 12, y + 68);
    ctx.textAlign = 'right';
    ctx.font = `700 13px ${F_BODY}`;
    ctx.fillStyle = GOLD_HI;
    ctx.fillText(wName, x + pw - 12, y + 68);
    // 第几波（小字）
    ctx.textAlign = 'right';
    ctx.font = `600 10px ${F_BODY}`;
    ctx.fillStyle = 'rgba(233,215,170,0.5)';
    ctx.fillText(`第 ${wIdx} 番`, x + pw - 12, y + 80.5);

    // 大招状态（惊涛叠浪）：K 可用时弱金色呼吸；冷却结束瞬间有一次克制亮起
    const ready = p.specialCooldown <= 0;
    const flash = (world.kReadyFlash || 0) > 0;
    ctx.textAlign = 'left';
    ctx.font = `700 10.5px ${F_BRUSH}`;
    ctx.fillStyle = PAPER_DIM;
    ctx.fillText('绝技 K · 惊涛叠浪', x + 12, y + 96);
    ctx.textAlign = 'right';
    ctx.font = `700 13px ${F_BODY}`;
    if (ready) {
      ctx.globalAlpha = flash ? 1 : 0.82 + Math.sin(performance.now() * 0.004) * 0.18;
      ctx.fillStyle = GOLD_HI;
      if (flash) { ctx.shadowColor = 'rgba(240,206,126,0.9)'; ctx.shadowBlur = 9; }
    } else {
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(233,215,170,0.48)';
    }
    ctx.fillText(ready ? '可用' : `调息 ${p.specialCooldown.toFixed(1)}s`, x + pw - 12, y + 96);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /** Boss 血条：姓名 + 阶段提示 + 顶部专属长条 */
  bossBar(ctx, W, world) {
    const boss = world.enemies.find(e => e.isBoss && e.alive);
    if (!boss) { this.bossPhase = -1; return; }

    const ratio = Math.max(0, boss.hp / boss.maxHp);
    const ph = ratio > 0.66 ? 0 : ratio > 0.33 ? 1 : 2;
    if (ph !== this.bossPhase) {
      this.bossPhase = ph;
      this.phaseFlashAt = performance.now();   // 阶段切换：标签放大闪现
      if (world.audio) world.audio.play('boss_phase');
      world.camera.addShake(7);
    }
    const PHASES = BOSS_PHASES

    const bw = 460, bh = 13;
    const x = (W - bw) / 2, y = 30;

    ctx.save();
    // 姓名（血条上方居中）
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 16px ${F_BRUSH}`;
    ctx.fillStyle = PAPER;
    ctx.shadowColor = 'rgba(0,0,0,0.95)';
    ctx.shadowBlur = 5;
    ctx.fillText('山贼头目', W / 2, y - 10);
    ctx.shadowBlur = 0;

    // 底 + 金边
    ctx.fillStyle = 'rgba(23,19,15,0.85)';
    ctx.fillRect(x, y, bw, bh);
    ctx.strokeStyle = 'rgba(214,168,74,0.85)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, bw - 1, bh - 1);

    // 填充（朱砂渐变，越打越亮）
    if (ratio > 0.003) {
      const g = ctx.createLinearGradient(0, y, 0, y + bh);
      g.addColorStop(0, ph === 2 ? '#F0664C' : '#D1442F');
      g.addColorStop(1, ph === 2 ? '#B5362D' : '#7E1F1B');
      ctx.fillStyle = g;
      ctx.fillRect(x + 2, y + 2, (bw - 4) * ratio, bh - 4);
      ctx.fillStyle = 'rgba(255,240,200,0.18)';
      ctx.fillRect(x + 2, y + 2, (bw - 4) * ratio, 3);
    }
    // 端轴
    const cap = 8;
    for (const cx of [x, x + bw - cap]) {
      ctx.fillStyle = '#241B10';
      ctx.fillRect(cx, y - 1, cap, bh + 2);
      ctx.strokeStyle = 'rgba(214,168,74,0.55)';
      ctx.strokeRect(cx + 0.5, y - 0.5, cap - 1, bh + 1);
    }

    // 阶段标签（血条正下方）：鎏金底朱砂字；切换瞬间放大闪现（≈0.48s 弹出）
    const label = `· ${PHASES[ph]} ·`;
    ctx.font = `700 12px ${F_BRUSH}`;
    const tw = ctx.measureText(label).width;
    const tagW = tw + 26, tagH = 19;
    const now = performance.now();
    const life = this.phaseFlashAt ? (now - this.phaseFlashAt) / 480 : 2;
    const flash = life < 1;
    const pop = flash ? 1 - life : 0;
    const scale = 1 + 0.38 * pop;

    ctx.save();
    ctx.translate(W / 2, y + bh + 14);
    ctx.scale(scale, scale);
    if (flash) { ctx.shadowColor = 'rgba(240,206,126,0.95)'; ctx.shadowBlur = 14 * (1 - life); }
    // 鎏金底（硬边小标签，藏锋）
    const grad = ctx.createLinearGradient(0, -tagH / 2, 0, tagH / 2);
    grad.addColorStop(0, '#F0CE7E');
    grad.addColorStop(0.55, '#D6A84A');
    grad.addColorStop(1, '#B98F36');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(-tagW / 2, -tagH / 2, tagW, tagH, 3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(126,31,27,0.55)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // 两侧小菱饰
    ctx.fillStyle = 'rgba(126,31,27,0.8)';
    ctx.beginPath();
    ctx.moveTo(-tagW / 2 - 7, -3); ctx.lineTo(-tagW / 2 - 1.5, 0); ctx.lineTo(-tagW / 2 - 7, 3);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(tagW / 2 + 7, -3); ctx.lineTo(tagW / 2 + 1.5, 0); ctx.lineTo(tagW / 2 + 7, 3);
    ctx.closePath(); ctx.fill();
    // 朱砂字
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#7E1F1B';
    ctx.shadowBlur = 0;
    ctx.fillText(label, 0, 0.5);
    ctx.restore();
  }
}
