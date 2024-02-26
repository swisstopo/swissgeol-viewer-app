import {verticalDirectionRotate} from './geoblocks/cesium-helpers/cesiumutils.ts';
import NavToolsStore from './store/navTools';

/**
 * @typedef {Object} Options
 * @property {number} [moveAmount=50]
 * @property {number} [rotateAmount=Math.PI/400]
 * @property {number} [slowFactor=0.15]
 * @property {number} [boostFactor=4]
 * @property {number} [accelerationFactor=1.2]
 * @property {Array<string>} [moveUpKeys=['q', ' ', '+']]
 * @property {Array<string>} [moveDownKeys=['e', '-']]
 * @property {Array<string>} [moveForwardKeys=['w']]
 * @property {Array<string>} [moveBackwardKeys=['s']]
 * @property {Array<string>} [zoomInKeys=['arrowdown']]
 * @property {Array<string>} [zoomOutKeys=['arrowdown']]
 * @property {Array<string>} [moveLeftKeys=['a', 'arrowleft']]
 * @property {Array<string>} [moveRightKeys=['d', 'arrowright']]
 * @property {Array<string>} [lookUpKeys=['i']]
 * @property {Array<string>} [lookDownKeys=['k']]
 * @property {Array<string>} [lookLeftKeys=['j']]
 * @property {Array<string>} [lookRightKeys=['l']]
 * @property {Array<string>} [cancelKeys=['escape']]
 */


export default class KeyboardNavigation {

  /**
   * @param {import('cesium/Source/Scene/Scene').default} scene
   * @param {Options} [options]
   */
  constructor(scene, options = {}) {

    this.scene_ = scene;

    this.moveAmount_ = options.moveAmount !== undefined ? options.moveAmount : 50;
    this.rotateAmount_ = options.rotateAmount !== undefined ? options.rotateAmount : Math.PI / 400;
    this.boostFactor_ = options.boostFactor !== undefined ? options.boostFactor : 4;
    this.slowFactor_ = options.slowFactor !== undefined ? options.slowFactor : 0.15;
    this.accelerationFactor_ = options.accelerationFactor !== undefined ? options.accelerationFactor : 1.2;

    this.moveUpKeys_ = options.moveUpKeys || ['q', ' ', '+'];
    this.moveDownKeys_ = options.moveDownKeys || ['e', '-'];
    this.moveForwardKeys_ = options.moveForwardKeys || ['w'];
    this.moveBackwardKeys_ = options.moveBackwardKeys || ['s'];
    this.zoomInKeys_ = options.zoomInKeys || ['arrowup'];
    this.zoomOutKeys_ = options.zoomOutKeys || ['arrowdown'];
    this.moveLeftKeys_ = options.moveLeftKeys || ['a', 'arrowleft'];
    this.moveRightKeys_ = options.moveRightKeys || ['d', 'arrowright'];
    this.lookUpKeys_ = options.lookUpKeys || ['i'];
    this.lookDownKeys_ = options.lookDownKeys || ['k'];
    this.lookLeftKeys_ = options.lookLeftKeys || ['j'];
    this.lookRightKeys_ = options.lookRightKeys || ['l'];
    this.cancelKeys_ = options.cancelKeys || ['escape'];

    this.flags_ = {
      accelerationFactor: 0,
      moveUp: false,
      moveDown: false,
      moveForward: false,
      moveBackward: false,
      moveLeft: false,
      moveRight: false,
      lookUp: false,
      lookDown: false,
      lookLeft: false,
      lookRight: false,
      zoomIn: false,
      zoomOut: false
    };

    /**
     * @type {Object<string, boolean>}
     */
    this.pressedKeys_ = {};

    const onKey = this.onKey_.bind(this);
    const onPostRender = this.onPostRender_.bind(this);

    document.addEventListener('keydown', onKey);
    document.addEventListener('keyup', onKey);
    this.scene_.postRender.addEventListener(onPostRender);
  }

  hasKeyDown_() {
    let pressed = false;
    for (const key in this.flags_) {
      const flag = this.flags_[key];
      if (typeof flag === 'boolean') {
        pressed |= flag;
      }
    }
    return pressed;
  }

  cancel_() {
    for (const key in this.flags_) {
      this.flags_[key] = false;
    }
  }

  /**
   * @param {KeyboardEvent} event
   */
  onKey_(event) {
    if (targetNotEditable(event.target)) {
      const pressed = event.type === 'keydown';
      if (pressed && event.ctrlKey) {
        // don't mess with the browser keyboard shortcut
        return;
      }
      // make sure we still have at least one pressed key
      this.pressedKeys_[event.code] = pressed;
      if (!Object.values(this.pressedKeys_).some(pressed => pressed)) {
        this.cancel_();
      }

      const key = event.key.toLowerCase();
      let hideTargetPoint = false;

      if (!this.hasKeyDown_()) {
        // reset acceleration
        this.flags_.acceleration = this.slowFactor_;
      }
      if (this.moveUpKeys_.includes(key)) {
        this.flags_.moveUp = pressed;
      } else if (this.moveDownKeys_.includes(key)) {
        this.flags_.moveDown = pressed;
      } else if (this.moveForwardKeys_.includes(key)) {
        this.flags_.moveForward = pressed;
        hideTargetPoint = pressed;
      } else if (this.moveBackwardKeys_.includes(key)) {
        this.flags_.moveBackward = pressed;
        hideTargetPoint = pressed;
      } else if (this.moveLeftKeys_.includes(key)) {
        this.flags_.moveLeft = pressed;
        hideTargetPoint = pressed;
      } else if (this.moveRightKeys_.includes(key)) {
        this.flags_.moveRight = pressed;
        hideTargetPoint = pressed;
      } else if (this.lookUpKeys_.includes(key)) {
        this.flags_.lookUp = pressed;
        hideTargetPoint = pressed;
      } else if (this.lookDownKeys_.includes(key)) {
        this.flags_.lookDown = pressed;
        hideTargetPoint = pressed;
      } else if (this.lookLeftKeys_.includes(key)) {
        this.flags_.lookLeft = pressed;
        hideTargetPoint = pressed;
      } else if (this.lookRightKeys_.includes(key)) {
        this.flags_.lookRight = pressed;
        hideTargetPoint = pressed;
      } else if (this.zoomInKeys_.includes(key)) {
        this.flags_.zoomIn = pressed;
      } else if (this.zoomOutKeys_.includes(key)) {
        this.flags_.zoomOut = pressed;
      } else if (this.cancelKeys_.includes(key)) {
        this.cancel_();
      }

      if (hideTargetPoint) NavToolsStore.hideTargetPoint();

      if (this.hasKeyDown_()) {
        this.flags_.acceleration *= this.accelerationFactor_;
        if (this.flags_.acceleration > 1)
          this.flags_.acceleration = 1;
        if (event.shiftKey)
          this.flags_.acceleration = this.boostFactor_;
      }
      this.scene_.requestRender();
    }
  }

  onPostRender_() {
    const camera = this.scene_.camera;

    const moveAmount = this.moveAmount_ * this.flags_.acceleration;
    const rotateAmount = this.rotateAmount_ * this.flags_.acceleration;
    const angle = rotateAmount / 500;

    let heading;
    let pitch;

    if (this.flags_.moveUp) {
      NavToolsStore.setCameraHeight(camera.positionCartographic.height + moveAmount);
    }
    if (this.flags_.moveDown) {
      NavToolsStore.setCameraHeight(camera.positionCartographic.height - moveAmount);
    }
    if (this.flags_.moveForward) {
      verticalDirectionRotate(camera, angle);
    }
    if (this.flags_.moveBackward) {
      verticalDirectionRotate(camera, -angle);
    }
    if (this.flags_.moveLeft) {
      camera.moveLeft(moveAmount);
    }
    if (this.flags_.moveRight) {
      camera.moveRight(moveAmount);
    }
    if (this.flags_.lookLeft) {
      heading = camera.heading - rotateAmount;
      pitch = camera.pitch;
    }
    if (this.flags_.lookRight) {
      heading = camera.heading + rotateAmount;
      pitch = camera.pitch;
    }
    if (this.flags_.lookUp) {
      heading = camera.heading;
      pitch = camera.pitch + rotateAmount;
    }
    if (this.flags_.lookDown) {
      heading = camera.heading;
      pitch = camera.pitch - rotateAmount;
    }
    if (this.flags_.zoomIn) {
      camera.moveForward(moveAmount);
    }
    if (this.flags_.zoomOut) {
      camera.moveBackward(moveAmount);
    }
    if (heading !== undefined && pitch !== undefined) {
      camera.setView({
        orientation: {
          heading: heading,
          pitch: pitch
        }
      });
    }
  }
}


const notEditableTypes = ['checkbox', 'range'];

/**
 * @param {HTMLElement} target
 * @return {boolean}
 */
function targetNotEditable(target) {
  return (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') || notEditableTypes.includes(target.type);
}
