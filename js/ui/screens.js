// ui/screens.js —— 标题 / 升级选招 / 胜利 / 失败 / 暂停 全屏覆盖层
// 设计语言：岭南洪拳武馆 × 水墨江湖 × 红黑金（无 Emoji、无大圆角卡片）
import { DIFFICULTY, ASSET_V } from '../config.js?v=20';
import { isCoarsePointer } from '../touch.js?v=20';

const layer = () => document.getElementById('ui-layer');
const clear = () => { if (layer()) layer().innerHTML = ''; };

/* ---------- 通用 DOM 工具 ---------- */

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

/** 洪拳牌匾按钮 */
function btn(label, cls, onClick) {
  const b = el('button', 'btn' + (cls ? ' ' + cls : ''), label);
  b.addEventListener('click', onClick);
  return b;
}

/* 缓慢漂移的墨雾 */
function mist() {
  return el('div', 'mist', '') ;
}

/** 落叶 + 尘粒（随机化 CSS 变量，纯 CSS 动画） */
function addAirborne(container, leaves = 14, dust = 10) {
  for (let i = 0; i < leaves; i++) {
    const s = el('span', 'leaf' + (Math.random() < 0.35 ? ' alt' : ''));
    s.style.setProperty('--x', (Math.random() * 100).toFixed(1) + 'vw');
    s.style.setProperty('--dx', (Math.random() * 120 - 60).toFixed(0) + 'px');
    s.style.setProperty('--d', (9 + Math.random() * 9).toFixed(1) + 's');
    s.style.setProperty('--dl', (-Math.random() * 18).toFixed(1) + 's');
    container.appendChild(s);
  }
  for (let i = 0; i < dust; i++) {
    const s = el('span', 'dust');
    s.style.setProperty('--x', (Math.random() * 100).toFixed(1) + 'vw');
    s.style.setProperty('--dx', (Math.random() * 60 - 30).toFixed(0) + 'px');
    s.style.setProperty('--d', (14 + Math.random() * 14).toFixed(1) + 's');
    s.style.setProperty('--dl', (-Math.random() * 26).toFixed(1) + 's');
    container.appendChild(s);
  }
}

/* ---------- 招式印记（内联 SVG，抽象水墨图形，无 Emoji） ---------- */

const SIGIL_ATTRS = 'viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"';

const SIGILS = {
  // 攻击 —— 虎爪三连
  攻击: `<svg ${SIGIL_ATTRS}><path d="M13 38 C 18 27, 21 17, 25 7"/><path d="M22 38 C 26 28, 28 18, 31 9"/><path d="M31 38 C 34 30, 36 21, 38 12"/></svg>`,
  // 攻速 —— 龙气盘旋
  攻速: `<svg ${SIGIL_ATTRS}><path d="M14 26 a10.5 10.5 0 1 1 10.5 10.5"/><path d="M28.5 29.5 a4.6 4.6 0 1 1 -4.6 -4.6"/><path d="M10 10 C 13 8, 16 9, 17 12"/></svg>`,
  // 移速 —— 蛇形游走
  移速: `<svg ${SIGIL_ATTRS}><path d="M11 11 C 23 11, 27 20, 24 26 C 21 32, 25 38, 37 38"/><circle cx="39.5" cy="38" r="2.4" fill="currentColor" stroke="none"/><path d="M10 18 C 8 15, 8 12, 10 10"/></svg>`,
  // 命中 —— 鹤嘴点穴
  命中: `<svg ${SIGIL_ATTRS}><path d="M8 38 L 40 12"/><path d="M14 41 L 42 20"/><circle cx="10" cy="36" r="2.3" fill="currentColor" stroke="none"/></svg>`,
  // 范围 —— 铁线横扫（双弧涟漪）
  范围: `<svg ${SIGIL_ATTRS}><path d="M7 25 A 17.5 17.5 0 0 1 41 25"/><path d="M13 33 A 11.5 11.5 0 0 1 35 33"/><circle cx="24" cy="25" r="2.2" fill="currentColor" stroke="none"/></svg>`,
  // 防守 —— 马步扎桩
  防守: `<svg ${SIGIL_ATTRS}><path d="M9 41 L 24 30 L 39 41"/><path d="M19 9 L 24 19 L 29 9"/><circle cx="24" cy="25" r="2.4" fill="currentColor" stroke="none"/></svg>`,
  // 暴击 —— 寸劲爆点
  暴击: `<svg ${SIGIL_ATTRS}><path d="M24 5 L 24 14"/><path d="M24 34 L 24 43"/><path d="M5 24 L 14 24"/><path d="M34 24 L 43 24"/><path d="M11 11 L 17 17"/><path d="M31 31 L 37 37"/><path d="M37 11 L 31 17"/><path d="M17 31 L 11 37"/><circle cx="24" cy="24" r="5.2"/></svg>`,
  // 全能 —— 五形合一（五星）
  全能: `<svg ${SIGIL_ATTRS}><path d="M24 5 L 29.3 18.1 L 43 18.5 L 32.4 26.9 L 36.4 40.5 L 24 32.7 L 11.6 40.5 L 15.6 26.9 L 5 18.5 L 18.7 18.1 Z"/></svg>`,
  // 回复 —— 吐纳养息
  回复: `<svg ${SIGIL_ATTRS}><path d="M24 7 A 17 17 0 1 0 41 24"/><path d="M24 16 A 8.5 8.5 0 1 1 32.5 24"/><circle cx="24" cy="24" r="2" fill="currentColor" stroke="none"/></svg>`,
  // 控制 —— 擒拿手（合拢钳抓）
  控制: `<svg ${SIGIL_ATTRS}><path d="M10 14 C 20 20, 20 28, 10 34"/><path d="M38 14 C 28 20, 28 28, 38 34"/><path d="M16 24 L 32 24"/><circle cx="24" cy="24" r="2.2" fill="currentColor" stroke="none"/></svg>`,
  // 大招 —— 环形水波
  大招: `<svg ${SIGIL_ATTRS}><circle cx="24" cy="24" r="16"/><circle cx="24" cy="24" r="9"/><circle cx="24" cy="24" r="2.6" fill="currentColor" stroke="none"/><path d="M24 2 L 24 8"/><path d="M24 40 L 24 46"/><path d="M2 24 L 8 24"/><path d="M40 24 L 46 24"/></svg>`,
  // 生存 —— 气血生息
  生存: `<svg ${SIGIL_ATTRS}><path d="M24 6 C 15 15, 11 22, 11 29 A 13 13 0 0 0 37 29 C 37 22, 33 15, 24 6 Z"/><path d="M18 30 C 20 26.5, 28 26.5, 30 30"/></svg>`,
  // 机动 —— 双燕掠影
  机动: `<svg ${SIGIL_ATTRS}><path d="M8 15 L 19 24 L 8 33"/><path d="M20 15 L 31 24 L 20 33"/><path d="M32 15 L 43 24 L 32 33"/></svg>`,
};

const SIGIL_FALLBACK = `<svg ${SIGIL_ATTRS}><circle cx="24" cy="24" r="15"/><circle cx="24" cy="24" r="2.4" fill="currentColor" stroke="none"/></svg>`;

const sigilFor = (kind) => SIGILS[kind] || SIGIL_FALLBACK;

/* ---------- 标题页 ---------- */
export function showTitle(opts) {
  const o = opts || {};
  clear();
  const s = el('div', 'screen screen-title');
  s.appendChild(mist());
  s.appendChild(Object.assign(mist(), { className: 'mist b' }));
  addAirborne(s, 15, 11);

  const c = el('div', 'content');
  const titleWrap = el('div', '', '<div class="title-cn">洪拳</div>');
  titleWrap.style.cssText = 'position:relative;';
  titleWrap.appendChild(el('div', 'seal', '洪'));
  c.appendChild(titleWrap);
  c.appendChild(el('div', 'title-en', 'HUNG KUEN'));
  c.appendChild(el('div', 'title-rule'));
  // 三行口号：押 -ang 韵（浪 / 方 / 王），讲清围攻走位 / 三选一 / 终局斩王
  c.appendChild(el('div', 'title-tagline',
    `<span>四面刀光 · 拳破<b class="hl">风浪</b></span>
     <span>拾<span class="hl">「气」</span>成招 · 三选一<b class="hl">方</b></span>
     <span>撑至终局 · 破阵<b class="hl">斩王</b></span>`));

  // 难度选择（常规 / 修罗）
  const diffRow = el('div', 'diff-chips');
  for (const key of ['normal', 'shura']) {
    const cfg = DIFFICULTY[key];
    const chip = el('button', 'diff-chip' + (o.difficulty === key ? ' active' : ''), cfg.name);
    chip.addEventListener('click', () => {
      if (o.onDifficulty) o.onDifficulty(key);
      diffRow.querySelectorAll('.diff-chip').forEach(x => x.classList.remove('active'));
      chip.classList.add('active');
    });
    diffRow.appendChild(chip);
  }
  c.appendChild(diffRow);

  const actions = el('div', 'result-actions');
  actions.appendChild(btn('开 始 游 戏', '', () => o.onStart && o.onStart()));
  c.appendChild(actions);

  // 个人纪录（localStorage，低调水墨小字）
  const rec = o.records || {};
  const recLine = `个人纪录 · 最快斩首 ${rec.bestBossTime ? fmt(rec.bestBossTime) : '—'} · 最多斩敌 ${rec.maxKills || '—'} · 最高修为 Lv.${rec.maxLevel || '—'} · 通关 ${rec.wins || 0} 次`;
  c.appendChild(el('div', 'title-records', recLine));

  // 版本徽记：取自页面模块入口的 ?v=（标题页最底一行显示，真机核对部署/缓存版本用）
  let modV = '';
  try {
    const src = (document.querySelector('script[type="module"]') || {}).src || '';
    const m = src.match(/[?&]v=(\d+)/);
    if (m) modV = m[1];
  } catch (e) { /* 取不到就不显示 */ }

  // 玩家操作：屏幕最底一行小字（触摸设备显示触控按键说明）
  const tipsText = isCoarsePointer()
    ? '摇杆移动 · 按住「拳」连击 · 「浪」惊涛叠浪 · 右上「‖」暂停'
    : 'WASD 移动 · 按住 J 连击 · K 惊涛叠浪 · Esc 暂停';
  s.appendChild(el('div', 'title-tips', tipsText + (modV ? ' · v' + modV : '')));

  s.appendChild(c);
  layer().appendChild(s);
}

/* ---------- 升级三选一：武学秘籍卷轴 ---------- */
export function showUpgrade(choices, onPick) {
  clear();
  const s = el('div', 'screen screen-levelup');
  s.appendChild(mist());
  s.appendChild(Object.assign(mist(), { className: 'mist b' }));
  addAirborne(s, 9, 7);

  // 用 .content 包裹主内容：配合 .screen 的 margin:auto 居中策略，
  // 小屏（手机横屏 ~450px 高）内容超高时不会截断顶部标题，而是可滚动
  const c = el('div', 'content');
  c.style.cssText = 'position:relative;z-index:4;display:flex;flex-direction:column;align-items:center;';

  const head = el('div', 'levelup-head');
  head.appendChild(el('div', 'title', '武学精进'));
  head.appendChild(el('div', 'sub', '择一式 · 破千军'));
  c.appendChild(head);

  const row = el('div', 'levelup-row');
  let picked = false;
  const pick = (card, c2) => {
    if (picked) return;
    picked = true;
    card.classList.add('picked');
    setTimeout(() => onPick(c2), 250);
  };

  const cards = [];
  for (const ch of choices) {
    const card = el('div', 'scroll-card', `
      <div class="ink-glow"></div>
      <div class="scroll-kind">${ch.kind}</div>
      <div class="scroll-sigil">${sigilFor(ch.kind)}</div>
      <div class="scroll-name">${ch.name}</div>
      <div class="scroll-lv">Lv. ${ch.cur} → ${ch.cur + 1}</div>
      <div class="scroll-desc">${ch.desc}</div>`);
    card.addEventListener('click', () => pick(card, ch));
    row.appendChild(card);
    cards.push({ card, c: ch });
  }
  c.appendChild(row);
  c.appendChild(el('div', 'levelup-tip', '点击选择 · 或按 1 / 2 / 3'));
  s.appendChild(c);

  // 键盘快捷选择
  const onKey = (e) => {
    const i = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
    if (i >= 0 && cards[i]) pick(cards[i].card, cards[i].c);
  };
  window.addEventListener('keydown', onKey);
  // 覆盖层被清空时由 hideScreens 统一回收监听
  s._keyCleanup = () => window.removeEventListener('keydown', onKey);

  layer().appendChild(s);
}

/* ---------- 胜利 ---------- */
export function showVictory(stats, handlers) {
  const h = handlers || {};
  clear();
  const s = el('div', 'screen');
  s.appendChild(mist());
  s.appendChild(Object.assign(mist(), { className: 'mist b' }));
  addAirborne(s, 12, 9);

  const c = el('div', 'content');
  c.style.cssText = 'position:relative;z-index:4;display:flex;flex-direction:column;align-items:center;';
  // 主视觉：胜利徽章（金环星芒 · 朱砂圆盘 · 墨影）
  const emblemWrap = el('div', 'victory-emblem-wrap');
  const img = el('img', 'victory-emblem', '');
  img.src = 'assets/sprites/ui/victory.png?v=' + ASSET_V;
  img.alt = '胜利';
  emblemWrap.appendChild(img);
  if (stats.newBestTime) emblemWrap.appendChild(el('div', 'record-stamp', '新纪录'));
  c.appendChild(emblemWrap);
  c.appendChild(el('div', 'result-sub',
    stats.difficulty === '修罗' ? '修罗通关 · 击败山贼头目，扬名江湖！' : '击败山贼头目，扬名江湖！'));
  c.appendChild(statsRow(stats));
  const wrap = el('div', 'result-actions');
  wrap.appendChild(btn('再 战 一 场', '', () => h.onRestart && h.onRestart()));
  wrap.appendChild(btn('同难度再战', 'small', () => h.onSame && h.onSame()));
  wrap.appendChild(btn('返 回 标 题', 'small', () => h.onTitle && h.onTitle()));
  c.appendChild(wrap);
  s.appendChild(c);
  layer().appendChild(s);
}

/* ---------- 失败 ---------- */
export function showDefeat(stats, handlers) {
  const h = handlers || {};
  clear();
  const s = el('div', 'screen');
  s.appendChild(mist());
  s.appendChild(Object.assign(mist(), { className: 'mist b' }));
  addAirborne(s, 12, 9);

  const c = el('div', 'content');
  c.style.cssText = 'position:relative;z-index:4;display:flex;flex-direction:column;align-items:center;';
  c.appendChild(el('div', 'result-title lose', '败  北'));
  c.appendChild(el('div', 'result-sub', '敌众我寡 · 退回洪门再练'));
  c.appendChild(statsRow(stats));
  const wrap = el('div', 'result-actions');
  wrap.appendChild(btn('再 试 一 次', '', () => h.onRetry && h.onRetry()));
  wrap.appendChild(btn('返 回 标 题', 'small', () => h.onTitle && h.onTitle()));
  c.appendChild(wrap);
  s.appendChild(c);
  layer().appendChild(s);
}

/** 战况统计：用时 / 斩敌 / 修为 / Boss / 普攻伤害 / 绝技次数 / 最高一击 / 前三招式 / 难度 / 个人最佳 */
function statsRow(stats) {
  const best = stats.bestTime ? `个人最佳 ${fmt(stats.bestTime)}` : '';
  const row = el('div', 'result-stats');
  row.innerHTML = `
    <div class="stat"><div class="k">难度</div><div class="v">${stats.difficulty || '常规'}</div></div>
    <div class="stat"><div class="k">战局</div><div class="v">${fmt(stats.time)}</div></div>
    <div class="stat"><div class="k">斩敌</div><div class="v">${stats.kills}</div></div>
    <div class="stat"><div class="k">修为</div><div class="v">Lv.${stats.level}</div></div>
    <div class="stat"><div class="k">关底</div><div class="v">${stats.bossDown ? '已击败 · 山贼头目' : '未及'}</div></div>
    <div class="stat"><div class="k">普攻总伤</div><div class="v">${stats.normalDmg}</div></div>
    <div class="stat"><div class="k">绝技释放</div><div class="v">${stats.specialCasts} 次</div></div>
    <div class="stat"><div class="k">最高一击</div><div class="v">${stats.maxHit}</div></div>
    <div class="stat wide"><div class="k">前学三式</div><div class="v small">${(stats.topUpgrades && stats.topUpgrades.length) ? stats.topUpgrades.join(' · ') : '无'}</div></div>
    ${best ? `<div class="stat wide"><div class="k">纪录</div><div class="v small">${best}</div></div>` : ''}`;
  return row;
}

/* ---------- 暂停页 ---------- */
export function showPause(opts) {
  const o = opts || {};
  clear();
  const s = el('div', 'screen');
  s.appendChild(mist());
  s.appendChild(Object.assign(mist(), { className: 'mist b' }));

  const c = el('div', 'content');
  c.style.cssText = 'position:relative;z-index:4;display:flex;flex-direction:column;align-items:center;';
  c.appendChild(el('div', 'result-title lose', '暂  停'));
  c.appendChild(el('div', 'result-sub', '闭目调息 · 稍后再战'));
  // 按键说明（触摸设备显示触控按键说明）
  const tips = el('div', 'title-tagline');
  tips.style.fontSize = '14px';
  tips.innerHTML = isCoarsePointer()
    ? `<span>摇杆移动 · 按住「拳」自动索敌连击</span>
       <span>「浪」惊涛叠浪 · 点选秘籍</span>
       <span>右上「‖」暂停</span>`
    : `<span>WASD 移动 · 按住 J 自动索敌连击</span>
       <span>K 惊涛叠浪 · 1/2/3 选择秘籍</span>
       <span>Esc 暂停 / 继续</span>`;
  c.appendChild(tips);
  const actions = el('div', 'result-actions');
  actions.appendChild(btn('继  续', '', () => o.onResume && o.onResume()));
  actions.appendChild(btn('重新开始', 'small', () => o.onRestart && o.onRestart()));
  actions.appendChild(btn('重看操作', 'small', () => o.onReplay && o.onReplay()));
  const shake = btn('', 'small', () => {
    const on = o.onShake();
    shake.textContent = on ? '震动：减' : '震动：全';
  });
  shake.textContent = o.reducedShake ? '震动：减' : '震动：全';
  actions.appendChild(shake);
  c.appendChild(actions);
  s.appendChild(c);
  layer().appendChild(s);
}

export function hideScreens() {
  // 回收键盘监听（挂在每个 screen 上的私有回调）
  const hosts = layer() ? layer().children : [];
  for (const h of hosts) {
    if (h._keyCleanup) { try { h._keyCleanup(); } catch (e) {} }
  }
  clear();
}

function fmt(t) {
  const mm = String(Math.floor(t / 60)).padStart(2, '0');
  const ss = String(Math.floor(t % 60)).padStart(2, '0');
  return `${mm}:${ss}`;
}
