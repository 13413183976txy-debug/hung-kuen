// input.js —— 键盘输入
// 提供全局按键状态：按住检测（isDown）与一次性按键（consumeKeyPress）。

const keys = new Set();
const pressed = new Set();

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

export function isDown(code) { return keys.has(code); }

/** 返回归一化移动向量（WASD + 方向键） */
export function moveAxis() {
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
