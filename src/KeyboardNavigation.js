
import {setCameraHeight} from './utils.js';
import Math from 'cesium/Core/Math';
import Cartesian3 from 'cesium/Core/Cartesian3';

const moveUpCodes = ['KeyQ', 'Space', 'NumpadAdd'];
const moveDownCodes = ['KeyE', 'NumpadSubtract'];
const moveForwardCodes = ['KeyW', 'ArrowUp'];
const moveBackwardCodes = ['KeyS', 'ArrowDown'];
const moveLeftCodes = ['KeyA', 'ArrowLeft'];
const moveRightCodes = ['KeyD', 'ArrowRight'];

export default class KeyboardNavigation {

  /**
   * @param {import('cesium/Scene/Scene').default} scene
   * @param {number} moveAmount
   * @param {number} boostFactor
   */
  constructor(scene, moveAmount = 50, boostFactor = 4) {

    this.scene_ = scene;

    this.moveAmount_ = moveAmount;

    this.boostFactor_ = boostFactor;

    this.flags_ = {
      booster: false,
      moveUp: false,
      moveDown: false,
      moveForward: false,
      moveBackward: false,
      moveLeft: false,
      moveRight: false,
      moveUpward: false,
      moveDownward: false,
      moveClockwise: false,
      moveCounterClockwise: false
    };

    const onKey = this.onKey_.bind(this);
    const onPostRender = this.onPostRender_.bind(this);

    document.addEventListener('keydown', onKey);
    document.addEventListener('keyup', onKey);
    this.scene_.postRender.addEventListener(onPostRender);
  }

  onKey_(event) {
    if (targetNotEditable(event.target)) {
      const pressed = event.type === 'keydown';
      if (moveUpCodes.includes(event.code)) {
        this.flags_.moveUp = pressed;
      } else if (moveDownCodes.includes(event.code)) {
        this.flags_.moveDown = pressed;
      } else if (moveForwardCodes.includes(event.code)) {
        this.flags_.moveForward = pressed;
      } else if (moveBackwardCodes.includes(event.code)) {
        this.flags_.moveBackward = pressed;
      } else if (moveLeftCodes.includes(event.code)) {
        this.flags_.moveLeft = pressed;
      } else if (moveRightCodes.includes(event.code)) {
        this.flags_.moveRight = pressed;
      } else if (event.code === 'KeyI') {
        this.flags_.moveUpward = pressed;
      } else if (event.code === 'KeyK') {
        this.flags_.moveDownward = pressed;
      } else if (event.code === 'KeyJ') {
        this.flags_.moveCounterClockwise = pressed;
      } else if (event.code === 'KeyL') {
        this.flags_.moveClockwise = pressed;
      }
      this.flags_.booster = event.shiftKey;
      this.scene_.requestRender();
    }
  }

  onPostRender_() {
    const camera = this.scene_.camera;

    const moveAmount = this.moveAmount_ * (this.flags_.booster ? this.boostFactor_ : 1);

    if (this.flags_.moveUp) {
      setCameraHeight(camera, camera.positionCartographic.height + moveAmount);
    }
    if (this.flags_.moveDown) {
      setCameraHeight(camera, camera.positionCartographic.height - moveAmount);
    }
    if (this.flags_.moveForward) {
      camera.moveForward(moveAmount);
    }
    if (this.flags_.moveBackward) {
      camera.moveBackward(moveAmount);
    }
    if (this.flags_.moveLeft) {
      camera.moveLeft(moveAmount);
    }
    if (this.flags_.moveRight) {
      camera.moveRight(moveAmount);
    }
    if (this.flags_.moveCounterClockwise) {
      camera.twistLeft();
    }
    if (this.flags_.moveClockwise) {
      camera.twistRight();
    }
    if (this.flags_.moveUpward || this.flags_.moveDownward) {

      const lookAmount = Math.PI / 1600.0 * (this.flags_.booster ? this.boostFactor_ : 1);

      const direction = new Cartesian3(camera.up.x * 10 + camera.direction.x, camera.up.y * 10 + camera.direction.y, camera.up.z * 10 + camera.direction.z);

      if (this.flags_.moveUpward) {
        camera.move(direction, moveAmount);
        camera.lookDown(lookAmount);
      }
      if (this.flags_.moveDownward) {
        camera.move(direction, -moveAmount);
        camera.lookUp(lookAmount);
      }
    }
  }
}


const notEditableTypes = ['checkbox', 'range'];

/**
 * @param {HTMLElement} target
 * @return {boolean}
 */
function targetNotEditable(target) {
  return target.tagName !== 'INPUT' || notEditableTypes.includes(target.type);
}
