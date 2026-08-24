// camera.js —— 相机跟随 + 屏幕震动
import { clamp, lerp } from './utils.js?v=16';
import { GAME } from './config.js?v=16';

export class Camera {
  constructor() {
    this.x = 0;          // 相机中心（世界坐标）
    this.y = 0;
    this.shake = 0;      // 震动强度（像素）
    this._shakeX = 0;
    this._shakeY = 0;
    this.shakeMul = 1;   // “减少屏幕震动”模式：0.3（保留打击特效，只降幅度）
  }

  follow(target) {
    // 平滑跟随目标中心
    this.x = lerp(this.x, target.x, 0.12);
    this.y = lerp(this.y, target.y, 0.12);
    // 限制在世界内
    const hw = GAME.WIDTH / 2, hh = GAME.HEIGHT / 2;
    this.x = clamp(this.x, hw, GAME.WORLD_W - hw);
    this.y = clamp(this.y, hh, GAME.WORLD_H - hh);
  }

  addShake(mag) { this.shake = Math.max(this.shake, mag * this.shakeMul); }

  update(dt) {
    if (this.shake > 0) {
      this._shakeX = (Math.random() * 2 - 1) * this.shake;
      this._shakeY = (Math.random() * 2 - 1) * this.shake;
      this.shake = Math.max(0, this.shake - dt * 60);
    } else {
      this._shakeX = 0; this._shakeY = 0;
    }
  }

  /** 相机左上角（含震动） */
  get offsetX() { return Math.round(this.x - GAME.WIDTH / 2 + this._shakeX); }
  get offsetY() { return Math.round(this.y - GAME.HEIGHT / 2 + this._shakeY); }
}
