/**
 * ui.js — 基础 UI 工具
 */

const UI = (() => {

  /**
   * Toast 提示
   */
  function toast(msg, duration = 1500) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), duration);
  }

  /**
   * 获取 query 参数
   */
  function getParam(name) {
    const url = new URL(window.location.href);
    return url.searchParams.get(name);
  }

  /**
   * 锁定屏幕方向为竖屏
   */
  async function lockOrientation() {
    try {
      if (screen.orientation && screen.orientation.lock) {
        await screen.orientation.lock('portrait');
      }
    } catch (_) {
      // 非全屏环境下 lock() 可能失败，忽略
    }
  }

  return { toast, getParam, lockOrientation };
})();
