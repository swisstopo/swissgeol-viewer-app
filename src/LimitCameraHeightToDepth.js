import {setCameraHeight} from './cesiumutils.js';

export default class LimitCameraHeightToDepth {
  /**
   * @param {import('cesium/Source/Scene/Scene').default} scene
   * @param {number} depth
   */
  constructor(scene, depth) {
    this.scene_ = scene;
    this.depth_ = depth;
    const onTick = this.onTick_.bind(this);
    this.scene_.postRender.addEventListener(onTick);
  }

  onTick_() {
    const camera = this.scene_.camera;
    if (camera.positionCartographic.height <= -this.depth_) {
      setCameraHeight(camera, -this.depth_);
    }
  }
}
