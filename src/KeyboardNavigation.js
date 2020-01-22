
const upCodes = ['KeyQ', 'Space', 'NumpadAdd'];
const downCodes = ['KeyE', 'NumpadSubtract'];
const forwardCodes = ['KeyW', 'ArrowUp'];
const backwardCodes = ['KeyS', 'ArrowDown'];
const leftCodes = ['KeyA', 'ArrowLeft'];
const rightCodes = ['KeyD', 'ArrowRight'];

export default class KeyboardNavigation {

  /**
   * @param {import("cesium/Scene/Scene").default} scene
   * @param {number} moveAmount
   * @param {number} boostFactor
   */
  constructor(scene, moveAmount = 50, boostFactor = 4) {

    this.scene_ = scene;

    this.moveAmount_ = moveAmount;

    this.boostFactor_ = boostFactor;

    this.flags_ = {
      booster: false,
      up: false,
      down: false,
      forward: false,
      backward: false,
      left: false,
      right: false
    };

    const onKey = this.onKey_.bind(this);
    const onPostRender = this.onPostRender_.bind(this);

    document.addEventListener('keydown', onKey);
    document.addEventListener('keyup', onKey);
    this.scene_.postRender.addEventListener(onPostRender);
  }

  onKey_(event) {
    if (event.target.tagName !== 'INPUT') {
      const pressed = event.type === 'keydown';
      if (upCodes.includes(event.code)) {
        this.flags_.up = pressed;
      } else if (downCodes.includes(event.code)) {
        this.flags_.down = pressed;
      } else if (forwardCodes.includes(event.code)) {
        this.flags_.forward = pressed;
      } else if (backwardCodes.includes(event.code)) {
        this.flags_.backward = pressed;
      } else if (leftCodes.includes(event.code)) {
        this.flags_.left = pressed;
      } else if (rightCodes.includes(event.code)) {
        this.flags_.right = pressed;
      }
      this.flags_.booster = event.shiftKey;
      this.scene_.requestRender();
    }
  }

  onPostRender_() {
    const camera = this.scene_.camera;

    const moveAmount = this.moveAmount_ * (this.flags_.booster ? this.boostFactor_ : 1);

    if (this.flags_.up) {
      camera.moveUp(moveAmount);
    }
    if (this.flags_.down) {
      camera.moveDown(moveAmount);
    }
    if (this.flags_.forward) {
      camera.moveForward(moveAmount);
    }
    if (this.flags_.backward) {
      camera.moveBackward(moveAmount);
    }
    if (this.flags_.left) {
      camera.moveLeft(moveAmount);
    }
    if (this.flags_.right) {
      camera.moveRight(moveAmount);
    }
  }
}
