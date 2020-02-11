import {ABOVE_SURFACE_CONFIGURATION, BELOW_SURFACE_CONFIGURATION} from './constants';

export default class SurfaceColorUpdater {
  /**
   * @param {import('cesium/Scene/Scene').default} scene
   */
  constructor(scene) {
    this.scene_ = scene;
    this.belowSurface = false;
    const checkPosition = this.checkPosition_.bind(this);
    this.scene_.postRender.addEventListener(checkPosition);
  }

  checkPosition_() {
    const camera = this.scene_.camera;
    const height = camera.positionCartographic.height; // this.scene_.globe.getHeight(camera.positionCartographic);
    if (height <= 0 && !this.belowSurface) {
      this.updateLayers_(BELOW_SURFACE_CONFIGURATION);
      this.belowSurface = true;
    } else if (height > 0 && this.belowSurface) {
      this.updateLayers_(ABOVE_SURFACE_CONFIGURATION);
      this.belowSurface = false;
    }
  }

  updateLayers_(configuration) {
    for (let i = 0; i < this.scene_.imageryLayers.length; i++) {
      const layer = this.scene_.imageryLayers.get(i);
      Object.keys(configuration).forEach(key => layer[key] = configuration[key]);
    }
  }
}
