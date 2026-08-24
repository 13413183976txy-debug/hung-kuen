// input.js —— 键盘 + 触控输入
// 提供全局输入状态：按住检测（isDown）与一次性按键（consumeKeyPress）。
// 移动端触控层（touch.js）通过 setTouchAxis / virtualDown / virtualPress 注入同一状态，
// 因此 player / combat 等游戏逻辑无需感知输入来源。

const keys = new Set();
const pressed = new Set();

// 触控注入：虚拟摇杆模拟量（-1..1，支持摇杆半程的精细走位）
const touch = { active: false, x: 0, y: 0 };

export function initInput() {
  window.addEventListener('keydown', (e) => {
    // keydown 会因长按重复触发；动作键只应在按下瞬间触发一次。
    if (!keys.has(e.code)) pressed.add(e.code);
    keys.add(e.code);
    // 防止方向键/空格滚动页面
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyJ','KeyK'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));

  // 失焦时清空按键，避免卡死
  window.addEventListener('blur', () => { keys.clear(); pressed.clear(); });
}

/* ---------- 触控注入接口（touch.js 调用，游戏逻辑不感知） ---------- */

/** 写入虚拟摇杆向量并启用（归一化模拟量） */
export function setTouchAxis(x, y) { touch.active = true; touch.x = x; touch.y = y; }
/** 释放虚拟摇杆（回到键盘输入） */
export function clearTouchAxis() { touch.active = false; touch.x = 0; touch.y = 0; }
/** 模拟按住某键（如 J 连击，支持多指同时按住） */
export function virtualDown(code) { keys.add(code); }
/** 模拟一次性按键（如 K），长按也不重复 */
export function virtualPress(code) { pressed.add(code); }
/** 模拟松开 */
export function virtualUp(code) { keys.delete(code); }

export function isDown(code) { return keys.has(code); }

/** 返回归一化移动向量（虚拟摇杆激活时优先，否则 WASD + 方向键） */
export function moveAxis() {
  if (touch.active) return { x: touch.x, y: touch.y };
  let x = 0, y = 0;
  if (isDown('KeyA') || isDown('ArrowLeft')) x -= 1;
  if (isDown('KeyD') || isDown('ArrowRight')) x += 1;
  if (isDown('KeyW') || isDown('ArrowUp')) y -= 1;
  if (isDown('KeyS') || isDown('ArrowDown')) y += 1;
  if (x !== 0 && y !== 0) { const inv = 1 / Math.SQRT2; x *= inv; y *= inv; }
  return { x, y };
}

/** 消费一次性按键事件；适合攻击、翻滚等不能因长按连发的动作。 */
export function consumeKeyPress(code) {
  if (!pressed.has(code)) return false;
  pressed.delete(code);
  return true;
}
/** 丢弃所有积压的一次性按键（升级弹窗等暂停时调用，防止恢复后瞬发） */
export function clearPresses() { pressed.clear(); }
