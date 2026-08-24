// touch.js —— 移动端触控层
// 虚拟摇杆（左半屏，落点即圆心）·「拳」连击（J 等价）·「浪」绝技（K 等价）·「‖」暂停，
// 以及竖屏提示「请横屏游玩」。
// 所有输入经 input.js 注入同一输入状态，本文件不触碰任何游戏逻辑；
// 仅在粗指针（触摸）设备上启用，桌面键盘用户完全不受影响。
import { setTouchAxis, clearTouchAxis, virtualDown, virtualPress, virtualUp } from './input.js?v=18';

/** 是否为触摸设备（粗指针）。供输入 / 文案 / 渲染精度共用。 */
export function isCoarsePointer() {
  return !!((window.matchMedia && window.matchMedia('(pointer: coarse)').matches))
      || navigator.maxTouchPoints > 0;
}

const enabled = isCoarsePointer();

let pauseHandler = null;    // 暂停按钮回调（main 注入）
let rotateHandler = null;   // 进入竖屏回调（main 注入：战斗中自动暂停）
let specialBtn = null;
let kReadyState = false;

export function setPauseHandler(fn) { pauseHandler = fn; }
export function setRotateHandler(fn) { rotateHandler = fn; }

/** 绝技按钮「可用」亮起（与 HUD 同款反馈；仅在状态变化时写 DOM） */
export function setKReady(ready) {
  if (!specialBtn || ready === kReadyState) return;
  kReadyState = ready;
  specialBtn.classList.toggle('ready', ready);
}

const JOY_R = 56;        // 摇杆最大行程（px，同时决定热区跟随半径）
const JOY_DEAD = 0.12;   // 死区（归一化，防漂移）

/* ---------- DOM 构建 ---------- */

function buildControls() {
  const ui = document.createElement('div');
  ui.id = 'touch-ui';
  ui.innerHTML = `
    <div class="t-joy-zone"></div>
    <div class="t-joy"><div class="t-joy-base"><div class="t-joy-knob"></div></div></div>
    <button class="t-btn t-special" aria-label="绝技 · 惊涛叠浪">浪</button>
    <button class="t-btn t-attack" aria-label="连击">拳</button>
    <button class="t-btn t-pause" aria-label="暂停">‖</button>`;
  document.body.appendChild(ui);
  // 长按不弹系统菜单
  ui.addEventListener('contextmenu', (e) => e.preventDefault());
  return ui;
}

/* ---------- 虚拟摇杆：左半屏落点即圆心 ---------- */
function initJoystick(ui) {
  const zone = ui.querySelector('.t-joy-zone');
  const joy = ui.querySelector('.t-joy');
  const knob = ui.querySelector('.t-joy-knob');
  let pid = null, ox = 0, oy = 0;

  const setKnob = (dx, dy) => {
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
  };

  zone.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (pid !== null) return;               // 单指控制，忽略后续手指
    pid = e.pointerId;
    ox = e.clientX; oy = e.clientY;
    // 摇杆跟随手指（默认锚点由 CSS 定义，抬起后自动归位）
    joy.style.left = (e.clientX - JOY_R - 8) + 'px';
    joy.style.top = (e.clientY - JOY_R - 8) + 'px';
    joy.classList.add('active');
    setKnob(0, 0);
    try { zone.setPointerCapture(pid); } catch (err) { /* 个别浏览器不支持，忽略 */ }
  });

  zone.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pid) return;
    let dx = e.clientX - ox, dy = e.clientY - oy;
    const d = Math.hypot(dx, dy);
    if (d > JOY_R) { dx *= JOY_R / d; dy *= JOY_R / d; }   // 出界收缩回圆
    setKnob(dx, dy);
    const nx = dx / JOY_R, ny = dy / JOY_R;
    if (Math.hypot(nx, ny) < JOY_DEAD) setTouchAxis(0, 0);
    else setTouchAxis(nx, ny);
  });

  const release = (e) => {
    if (e.pointerId !== pid) return;
    pid = null;
    clearTouchAxis();
    joy.classList.remove('active');
  };
  zone.addEventListener('pointerup', release);
  zone.addEventListener('pointercancel', release);
}

/* ---------- 按钮：按下/抬起（含滑出与系统取消） ---------- */
function initButton(el, onDown, onUp) {
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    el.classList.add('on');
    if (onDown) onDown();
  });
  const up = () => {
    el.classList.remove('on');
    if (onUp) onUp();
  };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('pointerleave', up);   // 手指滑出按钮即释放
}

/* ---------- 竖屏提示 ---------- */
function buildRotateHint() {
  const h = document.createElement('div');
  h.id = 'rotate-hint';
  h.innerHTML = `
    <div class="rh-phone"></div>
    <div class="rh-title">请横屏游玩</div>
    <div class="rh-sub">旋转设备 · 画面自动适配</div>`;
  document.body.appendChild(h);
  return h;
}

/* ---------- 初始化（main.boot 调用） ---------- */
export function initTouch() {
  if (!enabled) return;
  const ui = buildControls();
  initJoystick(ui);

  initButton(ui.querySelector('.t-attack'), () => virtualDown('KeyJ'), () => virtualUp('KeyJ'));
  initButton(ui.querySelector('.t-special'), () => virtualPress('KeyK'), null);
  initButton(ui.querySelector('.t-pause'), () => { if (pauseHandler) pauseHandler(); }, null);

  specialBtn = ui.querySelector('.t-special');

  // 旧 iOS 捏合缩放防御（新系统已由 touch-action:none 覆盖）
  document.addEventListener('gesturestart', (e) => e.preventDefault());

  // 竖屏提示：仅触摸设备且竖屏时显示；进入竖屏的瞬间通知 main（战斗自动暂停）
  const hint = buildRotateHint();
  let showing = false;
  const updateHint = () => {
    const show = window.innerHeight > window.innerWidth;
    if (show && !showing && rotateHandler) rotateHandler();
    showing = show;
    hint.classList.toggle('show', show);
  };
  window.addEventListener('resize', updateHint);
  window.addEventListener('orientationchange', updateHint);
  updateHint();
}
