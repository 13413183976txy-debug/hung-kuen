// ui/tutorial.js —— 首局引导：三条短提示依次淡入淡出
// 每条最多 2.5s；任意移动/攻击键提前淡出；完成或重看后置位 localStorage。
import { Settings } from '../systems/settings.js?v=17';

const TIPS = ['WASD · 游走避敌', '按住 J · 自动连击', 'K · 水波破围'];
const MAX_SHOW = 2.5;

let active = null;   // { idx, timer, node, dismissed, advance }

function makeNode(text) {
  const node = document.createElement('div');
  node.className = 'tutorial-tip';
  node.textContent = text;
  return node;
}

/**
 * 逐条播放引导。
 * @param {boolean} replay 重看（不写“已看过”标记）
 */
export function showTutorial(replay = false) {
  const layer = document.getElementById('ui-layer');
  if (!layer) return;
  dismissTutorial();   // 防重复启动

  const state = { idx: 0, timer: 0, node: null, done: false };

  const advance = () => {
    if (state.done) return;
    // 移除上一句的提示节点（避免堆叠）
    if (state.node && state.node.parentNode) state.node.parentNode.removeChild(state.node);
    state.node = null;
    if (state.idx >= TIPS.length) {
      state.done = true;
      if (!replay) Settings.setTutorialSeen();
      return;
    }
    state.timer = 0;
    state.node = makeNode(TIPS[state.idx]);
    layer.appendChild(state.node);
    state.idx++;
  };

  // 任意移动/攻击输入提前淡出当前条
  const onKey = (e) => {
    if (/^(KeyW|KeyA|KeyS|KeyD|KeyJ|KeyK|Arrow)/.test(e.code)) advance();
  };
  const onPointer = () => advance();
  window.addEventListener('keydown', onKey);
  window.addEventListener('pointerdown', onPointer);

  state.cleanup = () => {
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('pointerdown', onPointer);
    if (state.node && state.node.parentNode) state.node.parentNode.removeChild(state.node);
  };

  active = state;
  advance();

  // 逐帧推进（借 main 的 rAF 驱动，避免额外定时器漂移）
  state.tick = (dt) => {
    if (state.done) return false;
    state.timer += dt;
    if (state.timer >= MAX_SHOW) advance();
    return !state.done;
  };
}

/** 主循环驱动：返回是否仍在播放 */
export function tickTutorial(dt) {
  if (!active) return false;
  const st = active;
  const playing = st.tick ? st.tick(dt) : false;
  if (!playing) {
    st.cleanup();
    active = null;
  }
  return !!active;
}

/** 停止并清理（暂停页切换等场景） */
export function dismissTutorial() {
  if (active) { active.cleanup(); active = null; }
}

/** 方便手动重看（暂停菜单按钮） */
export function replayTutorial() { showTutorial(true); }
