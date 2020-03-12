import {setCameraHeight, verticalDirectionRotate} from './utils.js';

/**
 * @typedef {Object} Options
 * @property {number} [moveAmount=50]
 * @property {number} [rotateAmount=Math.PI/400]
 * @property {number} [boostFactor=4]
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
 */


export default class KeyboardNavigation {

  /**
   * @param {import('cesium/Scene/Scene').default} scene
   * @param {Options} [options]
   */
  constructor(scene, options = {}) {

    this.scene_ = scene;

    this.moveAmount_ = options.moveAmount !== undefined ? options.moveAmount : 50;
    this.rotateAmount_ = options.rotateAmount !== undefined ? options.rotateAmount : Math.PI / 400;
    this.boostFactor_ = options.boostFactor !== undefined ? options.boostFactor : 4;

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

    this.flags_ = {
      booster: false,
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

    const onKey = this.onKey_.bind(this);
    const onPostRender = this.onPostRender_.bind(this);

    document.addEventListener('keydown', onKey);
    document.addEventListener('keyup', onKey);
    this.scene_.postRender.addEventListener(onPostRender);
  }

  /**
   * @param {KeyboardEvent} event
   */
  onKey_(event) {
    if (event.ctrlKey === false && targetNotEditable(event.target)) {
      const pressed = event.type === 'keydown';
      const key = event.key.toLowerCase();

      if (this.moveUpKeys_.includes(key)) {
        this.flags_.moveUp = pressed;
      } else if (this.moveDownKeys_.includes(key)) {
        this.flags_.moveDown = pressed;
      } else if (this.moveForwardKeys_.includes(key)) {
        this.flags_.moveForward = pressed;
      } else if (this.moveBackwardKeys_.includes(key)) {
        this.flags_.moveBackward = pressed;
      } else if (this.moveLeftKeys_.includes(key)) {
        this.flags_.moveLeft = pressed;
      } else if (this.moveRightKeys_.includes(key)) {
        this.flags_.moveRight = pressed;
      } else if (this.lookUpKeys_.includes(key)) {
        this.flags_.lookUp = pressed;
      } else if (this.lookDownKeys_.includes(key)) {
        this.flags_.lookDown = pressed;
      } else if (this.lookLeftKeys_.includes(key)) {
        this.flags_.lookLeft = pressed;
      } else if (this.lookRightKeys_.includes(key)) {
        this.flags_.lookRight = pressed;
      } else if (this.zoomInKeys_.includes(key)) {
        this.flags_.zoomIn = pressed;
      } else if (this.zoomOutKeys_.includes(key)) {
        this.flags_.zoomOut = pressed;
      }

      this.flags_.booster = event.shiftKey;
      this.scene_.requestRender();
    }
  }

  onPostRender_() {
    const camera = this.scene_.camera;

    const moveAmount = this.moveAmount_ * (this.flags_.booster ? this.boostFactor_ : 1);
    const rotateAmount = this.rotateAmount_ * (this.flags_.booster ? this.boostFactor_ : 1);
    const angle = rotateAmount / 500;

    let heading;
    let pitch;

    if (this.flags_.moveUp) {
      setCameraHeight(camera, camera.positionCartographic.height + moveAmount);
    }
    if (this.flags_.moveDown) {
      setCameraHeight(camera, camera.positionCartographic.height - moveAmount);
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
  return target.tagName !== 'INPUT' || notEditableTypes.includes(target.type);
}
