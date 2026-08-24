// main.js —— 游戏状态机 + 主循环 + 场景组装
// 状态：boot -> title -> playing <-> pause -> (levelup 暂停) -> victory/defeat -> restart/title
import { GAME, DIFFICULTY } from './config.js?v=17';
import { loadAssets, prebuildOutlines, drawSprite, getSprite } from './assets.js?v=17';
import { initInput, clearPresses } from './input.js?v=17';
import { Camera } from './camera.js?v=17';
import { Player } from './entities/player.js?v=17';
import { separateEnemies } from './entities/enemies.js?v=17';
import { Combat } from './systems/combat.js?v=17';
import { Spawner } from './systems/spawner.js?v=17';
import { UpgradeSystem } from './systems/upgrades.js?v=17';
import { Particles } from './systems/particles.js?v=17';
import { Ambient } from './systems/ambient.js?v=17';
import { Settings } from './systems/settings.js?v=17';
import { runSelfCheck } from './systems/devcheck.js?v=17';
import { BalancePanel } from './systems/balance.js?v=17';
import { Hud } from './ui/hud.js?v=17';
import { AudioFX } from './audio.js?v=17';
import { showTitle, showUpgrade, showVictory, showDefeat, showPause, hideScreens } from './ui/screens.js?v=17';
import { showTutorial, tickTutorial, dismissTutorial, replayTutorial } from './ui/tutorial.js?v=17';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = GAME.WIDTH, H = GAME.HEIGHT;
let dpr = 1;

function resize() {
  // 按设备像素比渲染（最高 2x）：高分屏下画面清晰，且不使用 image-rendering: pixelated
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  fit();
}
function fit() {
  // 等比缩放（contain）：保留完整画面，居中
  const scale = Math.min(window.innerWidth / W, window.innerHeight / H);
  canvas.style.width = (W * scale) + 'px';
  canvas.style.height = (H * scale) + 'px';
  canvas.style.position = 'absolute';
  canvas.style.left = ((window.innerWidth - W * scale) / 2) + 'px';
  canvas.style.top = ((window.innerHeight - H * scale) / 2) + 'px';
  canvas.style.maxWidth = 'none';
  canvas.style.maxHeight = 'none';
}

canvas.addEventListener('click', () => audio.init());
window.addEventListener('resize', fit);

// ---------- 全局运行时 ----------
const audio = new AudioFX();
let state = { name: 'boot' };
let world = null;
let hud = new Hud();
let balancePanel = new BalancePanel();   // F3 开发平衡面板（默认隐藏）
let last = performance.now();

window.__hg = { get state() { return state; }, get world() { return world; } };

function makeWorld() {
  const difficulty = Settings.getDifficulty();
  const diff = DIFFICULTY[difficulty];
  const w = {
    camera: new Camera(),
    player: new Player(GAME.WORLD_W / 2, GAME.WORLD_H / 2),
    enemies: [],
    pickups: [],
    particles: new Particles(null),
    audio,
    difficulty,        // normal | shura
    diff,              // 难度倍率对象（config.DIFFICULTY）
    hitStop: 0,        // 受击顿帧（秒）
    hurtFlash: 0,      // 屏幕边缘朱砂闪（≤0.18s）
    clearMobs: 0,      // Boss 死亡后的清场淡出计时
    bossDefeated: false,
    specialCastId: 0,  // 大招唯一 castId（破阵“每次K每个目标一次”）
    // 本局统计（结算页使用，局内保存）
    stats: { normalDmg: 0, specialCasts: 0, maxHit: 0, topUpgrades: [],
             dmgWindow: [], hurtWindow: [] },   // 平衡面板窗口数据
    // 目标锁定反馈（J 自动索敌可视圈）
    lockTarget: null,
    lockFade: 0,
    // K 可用亮起反馈
    kReadyFlash: 0,
    _prevReady: true,
  };
  w.camera.shakeMul = Settings.getReducedShake() ? 0.3 : 1;   // 减少震动
  w.particles.world = w;
  w.ambient = new Ambient(w);
  w.combat = new Combat(w);
  w.spawner = new Spawner(w);
  w.upgrades = new UpgradeSystem(w);
  return w;
}

// ---------- 全球按键：暂停 / 静音 ----------
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') {
    if (state.name === 'playing') togglePause(true);
    else if (state.name === 'pause') togglePause(false);
  } else if (e.code === 'KeyM') {
    audio.toggleMute();
    Settings.setMuted(audio.muted);
    const el = document.querySelector('[data-mute-state]');
    if (el) el.textContent = audio.muted ? '音效：关' : '音效：开';
  } else if (e.code === 'F3') {
    e.preventDefault();               // 阻止浏览器查找
    balancePanel.toggle();
  }
});

// 失焦自动暂停（回到页面不自动恢复，需按 Esc/继续）
window.addEventListener('blur', () => {
  if (state.name === 'playing') togglePause(true);
});

function togglePause(on) {
  if (on) {
    state.name = 'pause';
    showPause({
      muted: audio.muted,
      reducedShake: Settings.getReducedShake(),
      onResume: () => { hideScreens(); state.name = 'playing'; },
      onRestart: () => { hideScreens(); restart(); },
      onMute: () => { audio.toggleMute(); Settings.setMuted(audio.muted); return audio.muted; },
      onReplay: () => { hideScreens(); state.name = 'playing'; replayTutorial(); },
      onShake: () => {
        Settings.setReducedShake(!Settings.getReducedShake());
        if (world) world.camera.shakeMul = Settings.getReducedShake() ? 0.3 : 1;
        return Settings.getReducedShake();
      },
    });
  } else {
    hideScreens();
    state.name = 'playing';
  }
}

// ---------- 视图层渲染 ----------
let vignetteCanvas = null;

function render() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);   // 逻辑坐标系（960x540）
  ctx.fillStyle = GAME.BG_COLOR;
  ctx.fillRect(0, 0, W, H);

  const inGame = state.name === 'playing' || state.name === 'levelup' || state.name === 'pause';
  if (!inGame || !world) return;

  const cam = world.camera;
  ctx.save();
  ctx.translate(-cam.offsetX, -cam.offsetY);

  drawBackground(cam);
  world.ambient.drawFog(ctx);
  world.ambient.drawGround(ctx);
  world.ambient.drawBack(ctx);

  for (const pk of world.pickups) if (!pk.dead) pk.draw(ctx);

  const sorted = world.enemies.slice().filter(e => e.alive).sort((a, b) => a.y - b.y);
  for (const e of sorted) drawEnemy(e);

  drawLock(world);          // 目标锁定反馈（代替朝向扇形）
  drawPlayer(world.player, world);

  world.particles.draw(ctx);

  // 预警二次描边（Boss/锤兵）：确保 K 大招水波与粒子不遮住关键预警（仅描边，不重叠填充）
  for (const e of sorted) {
    if (e.telegraph && !e.telegraph.faint) drawTelegraphEdge(e.telegraph);
  }

  world.ambient.drawFront(ctx);

  ctx.restore();

  if (!vignetteCanvas) vignetteCanvas = buildVignette();
  ctx.drawImage(vignetteCanvas, 0, 0);

  // 爆发波开场警告（屏幕中央，水墨朱砂风格）
  if (world.spawner.waitTimer > 0 && world.spawner.current && world.spawner.current.surge) {
    drawSurgeWarning(world.spawner.current.surgeText || '敌潮将至', world.spawner.waitTimer / 2.0);
  }

  // 受击屏幕边缘朱砂闪（≤0.18s，极轻）
  if (world.hurtFlash > 0) {
    const a = (world.hurtFlash / 0.15) * 0.22;
    const eg = ctx.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, Math.hypot(W, H) * 0.56);
    eg.addColorStop(0, 'rgba(181,54,45,0)');
    eg.addColorStop(1, `rgba(181,54,45,${a})`);
    ctx.fillStyle = eg;
    ctx.fillRect(0, 0, W, H);
  }

  hud.draw(ctx, world);
  balancePanel.draw(ctx, world);   // F3 平衡面板（覆盖在 HUD 之上，默认隐藏）
}

function drawBackground(cam) {
  const s = getSprite('ui_background');
  if (s && s.loaded) {
    if (!bgCanvas) buildBgCache(s);
    ctx.drawImage(bgCanvas, 0, 0, GAME.WORLD_W, GAME.WORLD_H);
  } else {
    ctx.fillStyle = '#20291F';
    ctx.fillRect(0, 0, GAME.WORLD_W, GAME.WORLD_H);
  }
}

let bgCanvas = null;
let noiseCanvas = null;

function buildBgCache(s) {
  const c = document.createElement('canvas');
  const w = GAME.WORLD_W, h = GAME.WORLD_H;
  c.width = w; c.height = h;
  const g = c.getContext('2d');

  g.drawImage(s.img, 0, 0, w, h);

  // 低饱和水墨化
  g.save();
  g.globalCompositeOperation = 'saturation';
  g.fillStyle = 'rgba(128,128,120,0.5)';
  g.fillRect(0, 0, w, h);
  g.restore();
  // 墨色压暗
  g.save();
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = '#B2B49E';
  g.fillRect(0, 0, w, h);
  g.restore();
  // 竹青罩染
  g.save();
  g.globalCompositeOperation = 'soft-light';
  g.fillStyle = 'rgba(80,112,90,0.45)';
  g.fillRect(0, 0, w, h);
  g.restore();

  // 中央亮、边缘暗
  const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.4;
  g.save();
  const grad = g.createRadialGradient(cx, cy, R * 0.35, cx, cy, Math.hypot(cx, cy));
  grad.addColorStop(0, 'rgba(233,215,170,0.07)');
  grad.addColorStop(0.62, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(14,11,8,0.52)');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  g.restore();

  // 远山雾霭（山峦为背景，不可行走）
  g.save();
  const miY = GAME.WALK.y;
  const mg = g.createLinearGradient(0, 0, 0, miY + 70);
  mg.addColorStop(0, 'rgba(233,215,170,0.17)');
  mg.addColorStop(0.6, 'rgba(233,215,170,0.08)');
  mg.addColorStop(1, 'rgba(233,215,170,0)');
  g.fillStyle = mg;
  g.fillRect(0, 0, w, miY + 70);
  g.restore();

  // 宣纸噪点
  if (!noiseCanvas) noiseCanvas = buildNoise(120);
  g.save();
  g.globalAlpha = 0.05;
  g.globalCompositeOperation = 'overlay';
  const pat = g.createPattern(noiseCanvas, 'repeat');
  g.fillStyle = pat;
  g.fillRect(0, 0, w, h);
  g.restore();

  bgCanvas = c;
}

function buildNoise(size) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 110 + Math.random() * 90 | 0;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

function buildVignette() {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(W / 2, H / 2, H * 0.34, W / 2, H / 2, Math.hypot(W, H) * 0.56);
  grad.addColorStop(0, 'rgba(23,19,15,0)');
  grad.addColorStop(0.72, 'rgba(23,19,15,0.05)');
  grad.addColorStop(1, 'rgba(15,12,9,0.42)');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(15,12,9,0.16)';
  g.fillRect(0, 0, W, 26);
  g.fillRect(0, H - 26, W, 26);
  return c;
}

/** 柔和投影（层叠椭圆） */
function drawShadow(x, y, radius, strength = 1) {
  ctx.save();
  ctx.fillStyle = `rgba(10,8,6,${0.16 * strength})`;
  ctx.beginPath();
  ctx.ellipse(x, y + radius * 0.5, radius * 0.85, radius * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(10,8,6,${0.3 * strength})`;
  ctx.beginPath();
  ctx.ellipse(x, y + radius * 0.62, radius * 0.58, radius * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** 目标锁定反馈：金色小圈 + 旋转刻度（0.1s 淡入）；无目标时角色脚下淡扇形 */
function drawLock(w) {
  const t = w.lockTarget;
  if (t && t.alive && w.lockFade > 0) {
    const a = Math.min(1, w.lockFade);
    const r = t.radius + 8;
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.25 * a;
    ctx.strokeStyle = '#D6A84A';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const ang = i * Math.PI / 2 + performance.now() * 0.0012;
      ctx.beginPath();
      ctx.moveTo(t.x + Math.cos(ang) * (r + 3), t.y + Math.sin(ang) * (r + 3));
      ctx.lineTo(t.x + Math.cos(ang) * (r + 8), t.y + Math.sin(ang) * (r + 8));
      ctx.stroke();
    }
    // 中心“洪”字压印（小、淡）
    ctx.globalAlpha = 0.5 * a;
    ctx.font = '700 11px "KaiTi","STKaiti","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#F0CE7E';
    ctx.fillText('洪', t.x, t.y);
    ctx.restore();
  } else if (world) {
    drawFacing(w.player);
  }
}

/** 无目标时的淡扇形朝向提示 */
function drawFacing(p) {
  const r = 36;
  ctx.save();
  ctx.translate(p.x, p.y + 6);
  ctx.rotate(p.facing);
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = '#D6A84A';
  ctx.beginPath();
  ctx.moveTo(p.radius * 0.4, 0);
  ctx.arc(0, 0, r, -0.30, 0.30);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.moveTo(r + 5, 0);
  ctx.lineTo(r - 7, -5.5);
  ctx.lineTo(r - 7, 5.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** 敌人攻击预警（朱砂半透明地面区 + 金边描线；颜色随剩余时间由淡转亮） */
function drawTelegraph(t) {
  // progress 由 update 帧累计（t.age），暂停/顿帧时会同步冻结，与状态机 a.t 一致
  const progress = t.dur ? Math.min(1, Math.max(0, (t.age || 0) / t.dur)) : 0.5;
  const pulse = 0.5 + Math.sin(performance.now() * 0.012) * 0.5;
  const base = (t.faint ? 0.08 : 0.12) + 0.16 * progress;      // 淡朱砂 → 亮朱砂
  const fill = `rgba(181,54,45,${base + pulse * 0.05})`;
  const edge = t.faint
    ? `rgba(214,168,74,${0.35 + 0.3 * progress})`
    : `rgba(240,102,76,${0.55 + 0.4 * progress})`;
  ctx.save();
  if (t.kind === 'circle') {
    ctx.fillStyle = fill;
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = edge; ctx.lineWidth = 2;
    ctx.stroke();
  } else if (t.kind === 'fan') {
    ctx.translate(t.x, t.y); ctx.rotate(t.ang);
    ctx.fillStyle = fill;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, t.r, -t.arc / 2, t.arc / 2); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = edge; ctx.lineWidth = 1.5;
    ctx.stroke();
  } else if (t.kind === 'rect') {
    ctx.translate(t.x, t.y); ctx.rotate(t.ang);
    ctx.fillStyle = fill;
    ctx.fillRect(0, -t.width / 2, t.len, t.width);
    ctx.strokeStyle = edge; ctx.lineWidth = 2;
    ctx.strokeRect(0, -t.width / 2, t.len, t.width);
  }
  ctx.restore();
}

/** 爆发波警告：屏幕中央朱砂墨牌（progress 1→0 淡出+脉动） */
function drawSurgeWarning(text, progress) {
  const cx = W / 2, cy = H * 0.4;
  const pulse = 0.5 + Math.sin(performance.now() * 0.01) * 0.5;
  const a = Math.min(1, progress * 3);          // 末尾渐隐
  ctx.save();
  ctx.globalAlpha = a;

  // 墨牌底 + 金边
  const pw = 320, ph = 108;
  ctx.fillStyle = 'rgba(23,19,15,0.88)';
  ctx.fillRect(cx - pw / 2, cy - ph / 2, pw, ph);
  ctx.strokeStyle = `rgba(240,206,126,${0.75 + pulse * 0.2})`;
  ctx.lineWidth = 2;
  ctx.strokeRect(cx - pw / 2 + 3, cy - ph / 2 + 3, pw - 6, ph - 6);
  ctx.strokeStyle = 'rgba(181,54,45,0.8)';
  ctx.lineWidth = 4;
  ctx.strokeRect(cx - pw / 2 + 1, cy - ph / 2 + 1, pw - 2, ph - 2);

  // 大标题（楷体，朱砂→金随脉动）
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 40px "KaiTi","STKaiti","FangSong","Microsoft YaHei",serif';
  ctx.shadowColor = 'rgba(181,54,45,0.75)';
  ctx.shadowBlur = 18;
  ctx.fillStyle = pulse > 0.5 ? '#F0664C' : '#D1442F';
  ctx.fillText(text, cx, cy - 12);
  ctx.shadowBlur = 0;

  // 小注
  ctx.font = '700 13px "KaiTi","STKaiti","Microsoft YaHei",sans-serif';
  ctx.fillStyle = 'rgba(233,215,170,0.75)';
  ctx.fillText('· 敌潮将至 · 严守阵脚 ·', cx, cy + 30);
  ctx.restore();
}

/** 预警二次描边（在粒子之上重描亮边，保证 K 大招不遮 Boss/锤兵预警；不含填充） */
function drawTelegraphEdge(t) {
  ctx.save();
  ctx.globalAlpha = 0.95;
  ctx.strokeStyle = 'rgba(240,206,126,0.9)';
  ctx.lineWidth = 1.5;
  if (t.kind === 'circle') {
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.stroke();
  } else if (t.kind === 'fan') {
    ctx.translate(t.x, t.y); ctx.rotate(t.ang);
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.arc(0, 0, t.r, -t.arc / 2, t.arc / 2);
    ctx.closePath(); ctx.stroke();
  } else if (t.kind === 'rect') {
    ctx.translate(t.x, t.y); ctx.rotate(t.ang);
    ctx.strokeRect(0, -t.width / 2, t.len, t.width);
  }
  ctx.restore();
}

function drawPlayer(p, w) {
  if (!p.alive) return;
  const t = performance.now() * 0.001;

  let spriteName = 'hero_idle';
  let frame = 0;
  let flip = false;
  if (p.hitFlash > 0) { spriteName = 'hero_hurt'; frame = 0; }          // 受击姿态（拳架式）
  else if (p.attackAnim > 0 && p.attackKind === 'special') { spriteName = 'hero_special'; frame = 0; }
  else if (p.attackAnim > 0) { spriteName = 'hero_attack'; frame = 0; }  // 普攻：冲拳式
  else if (p.moving) {
    // 定向行走：横向用左右侧面 4 帧动画；纵向用背面/正面单帧
    const c = Math.cos(p.facing), s = Math.sin(p.facing);
    if (Math.abs(c) > Math.abs(s)) {
      spriteName = c > 0 ? 'hero_walk_right' : 'hero_walk_left';
      frame = Math.floor(t * 9) % 4;                                    // 侧面 4 帧循环
    } else {
      spriteName = s > 0 ? 'hero_walk_front' : 'hero_walk_back';
      flip = c < 0;                                                     // 正/背对称，仅按朝向水平对齐
    }
  }

  const bob = p.moving ? Math.sin(t * 12) * 3 : Math.sin(t * 3) * 1.5;
  const alpha = p.invuln > 0 ? (Math.sin(performance.now() * 0.04) > 0 ? 0.55 : 0.9) : 1;

  drawShadow(p.x, p.y, p.radius * 1.25, 1.15);
  if (p.hitFlash > 0) ctx.globalCompositeOperation = 'lighter';
  drawSprite(ctx, spriteName, p.x, p.y + bob, { flip, alpha, frame, outline: 0x11161f, size: p.stats.spriteSize || undefined });
  ctx.globalCompositeOperation = 'source-over';
}

function drawEnemy(e) {
  const fade = e.fade ?? 1;

  // 攻击预警（地面层）
  if (e.telegraph) drawTelegraph(e.telegraph);

  // 精灵按技能状态切换（attackAnimKind 由状态机设置）
  const ak = e.attackAnimKind;
  let name;
  if (e.attackAnim > 0 && ak) {
    if (e.tier === 'hammer') name = ak === 'raise' ? 'hammer_raise' : 'hammer_kick';
    else if (e.isBoss) name = ak === 'red' ? 'boss_red' : ak === 'kick' ? 'boss_kick' : 'boss_slash';
    else name = 'blade_slash';
  } else {
    name = (e.tier === 'hammer' && e.anim % 2 < 1) ? 'hammer_idle' : e.tier + '_idle';
  }
  const t = performance.now() * 0.001;
  const step = Math.sin(t * 12 + e.phase * 6);
  const bob = step * 3 - 1.5;
  drawShadow(e.x, e.y, e.radius * 1.1, (e.isBoss ? 1.25 : 1) * fade);
  if (e.hitFlash > 0) ctx.globalCompositeOperation = 'lighter';
  drawSprite(ctx, name, e.x, e.y + bob, {
    flip: e.aimAngle > Math.PI / 2 || e.aimAngle < -Math.PI / 2,
    rot: step * 0.07,
    alpha: fade,
    outline: 0x11161f,
  });
  ctx.globalCompositeOperation = 'source-over';

  // 精英/Boss 小血条
  if (e.hp < e.maxHp && (e.isBoss || e.tier === 'hammer')) {
    const w = e.radius * 2, h = 5;
    const x = e.x - w / 2, y = e.y - e.radius - 14;
    ctx.fillStyle = 'rgba(23,19,15,0.75)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(214,168,74,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.fillStyle = e.isBoss ? '#D1442F' : '#D6A84A';
    ctx.fillRect(x + 1, y + 1, (w - 2) * Math.max(0, e.hp / e.maxHp), h - 2);
  }
}

// ---------- 主更新 ----------
function update(dt) {
  if (!world) return;

  // 暂停：世界完全冻结（实体/刷怪/冷却/计时/特效/环境）
  if (state.name === 'pause') return;

  // 升级选招中：只推进特效与相机，世界定格
  if (state.name === 'levelup') {
    world.particles.update(dt);
    world.camera.update(dt);
    return;
  }
  if (state.name !== 'playing') return;

  // 首局引导推进（仅战斗中，暂停/选招时不走表）
  tickTutorial(dt);
  const w = world;

  // 升级打断：暂停战斗等待选择
  if (w.player.canLevel) {
    state.name = 'levelup';
    clearPresses();
    w.player.attackAnim = 0;
    w.player.attackKind = null;
    w.player.moving = false;
    const choices = w.upgrades.roll();
    showUpgrade(choices, (c) => {
      w.upgrades.apply(c);
      w.player.canLevel = false;
      // 记录前三个主要招式（结算页展示）
      if (w.stats.topUpgrades.length < 3) w.stats.topUpgrades.push(c.name);
      w.particles.qiLevelUp(w.player.x, w.player.y, 30);
      audio.play('levelup');
      hideScreens();
      clearPresses();      // 选招期间积压的 J/K 不带到恢复瞬间
      state.name = 'playing';
    });
    return;
  }

  // 受击顿帧 + 屏幕边缘闪衰减
  const stopped = w.hitStop > 0;
  const sdt = stopped ? dt * 0.12 : dt;
  if (stopped) { w.hitStop -= dt; if (w.hitStop <= 0) w.hitStop = 0; }
  if (w.hurtFlash > 0) w.hurtFlash -= dt;

  // Boss 死亡判定：停止刷怪，杂兵定格淡出 → 胜利
  const cur = w.spawner.current;
  const bossAlive = w.enemies.some(e => e.isBoss && e.alive);
  if (cur && cur.bossWave && w.spawner.bossSpawned && !bossAlive && !w.bossDefeated) {
    w.bossDefeated = true;
    w.spawner.onBossDefeated();
    w.clearMobs = 1.3;
    w.hitStop = 0;
  }

  // 实体更新
  w.fxKills = 0;
  w.player.update(sdt, w);
  if (w.clearMobs > 0) {
    w.clearMobs -= dt;
    for (const e of w.enemies) if (e.alive) e.fade = Math.max(0, e.fade - dt * 1.1);
  } else {
    w.spawner.update(dt);
    for (const e of w.enemies) if (e.alive) e.update(sdt, w);
    separateEnemies(w.enemies);
  }
  for (const pk of w.pickups) if (!pk.dead) pk.update(w.clearMobs > 0 ? 0 : sdt, w);
  w.particles.update(sdt);
  w.ambient.update(dt);
  w.camera.follow(w.player);
  w.camera.update(dt);

  // 目标锁定反馈（与 combat 自动索敌同一规则）
  updateLock(w, dt);

  // K 可用亮起反馈（冷却结束瞬间）
  const ready = w.player.specialCooldown <= 0;
  if (ready && w._prevReady === false) w.kReadyFlash = 0.35;
  w._prevReady = ready;
  if (w.kReadyFlash > 0) w.kReadyFlash -= dt;

  // 清理
  w.enemies = w.enemies.filter(e => e.alive && e.fade > 0);
  w.pickups = w.pickups.filter(pk => !pk.dead);

  // 胜负判定
  if (!w.player.alive) {
    endRun(false);
  } else if (w.bossDefeated && w.clearMobs <= 0) {
    endRun(true);
  }
}

/** 计算当前 J 锁定的目标（与 combat.normalAttack 同规则） */
function updateLock(w, dt) {
  const p = w.player;
  const effRange = p.stats.range;
  let lock = null, best = Infinity;
  for (const e of w.enemies) {
    if (!e.alive) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d > effRange + e.radius) continue;
    if (d < best) { best = d; lock = e; }
  }
  if (lock !== w.lockTarget) { w.lockTarget = lock; w.lockFade = 0; }
  w.lockFade = Math.min(1, (w.lockFade || 0) + dt * 10);
}

function endRun(win) {
  state.name = win ? 'victory' : 'defeat';
  dismissTutorial();
  const p = world.player;
  const stats = {
    time: world.spawner.globalTime,
    kills: p.kills,
    level: p.level,
    bossDown: world.bossDefeated,
    normalDmg: Math.round(world.stats.normalDmg),
    specialCasts: world.stats.specialCasts,
    maxHit: Math.round(world.stats.maxHit),
    topUpgrades: world.stats.topUpgrades.slice(),
    difficulty: DIFFICULTY[world.difficulty].name,
  };
  // 个人纪录（localStorage）
  const rec = Settings.updateRecords(win, stats);
  stats.newBestTime = rec.newBestTime;
  stats.bestTime = Settings.getRecords().bestBossTime;

  if (win) {
    audio.play('boss_down');
    showVictory(stats, {
      onRestart: restart,        // 再战一场（当前难度）
      onSame: restart,           // 同难度再战
      onTitle: toTitle,
    });
  } else {
    showDefeat(stats, {
      onRetry: restart,
      onTitle: toTitle,
    });
  }
}

function restart() {
  world = makeWorld();
  world.camera.x = world.player.x;
  world.camera.y = world.player.y;
  bgCanvas = null;
  hideScreens();
  state.name = 'playing';
  audio.init();
  // 首局引导（仅第一次；重看另走暂停菜单）
  if (!Settings.getTutorialSeen()) showTutorial(false);
}

function toTitle() {
  hideScreens();
  dismissTutorial();
  state.name = 'title';
  showTitle(buildTitleHandlers());
}

function startGame() {
  audio.init();
  restart();
}

function buildTitleHandlers() {
  return {
    onStart: startGame,
    difficulty: Settings.getDifficulty(),
    records: Settings.getRecords(),
    onDifficulty: (d) => { Settings.setDifficulty(d); },
    onReplayTutorial: () => { hideScreens(); state.name = 'playing'; replayTutorial(); },
  };
}

// ---------- 装配 & 启动 ----------
async function boot() {
  initInput();
  audio.init();
  audio.muted = Settings.getMuted();   // 静音偏好持久化
  resize();

  const loadResults = await loadAssets();
  runSelfCheck(loadResults);           // 开发校验（仅 console.warn）
  prebuildOutlines();                  // 描边缓存异步分批构建，不阻塞首帧

  state.name = 'title';
  showTitle(buildTitleHandlers());
}

function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

boot().then(() => { requestAnimationFrame(loop); }).catch(err => {
  console.error(err);
  const tip = document.getElementById('boot-tip');
  tip.style.display = 'flex';
  tip.textContent = '加载失败：' + err.message;
});
