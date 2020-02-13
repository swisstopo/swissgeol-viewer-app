import {ABOVE_SURFACE_CONFIGURATION, BELOW_SURFACE_CONFIGURATION} from './constants';

export default class SurfaceColorUpdater {
  /**
   * @param {import('cesium/Scene/Scene').default} scene
   */
  constructor(scene) {
    this.scene_ = scene;
    this.belowSurface = false;
    this.layersCount_ = 0;
    const checkPosition = this.checkPosition_.bind(this);
    this.scene_.postRender.addEventListener(checkPosition);
  }

  checkPosition_() {
    const camera = this.scene_.camera;
    const height = camera.positionCartographic.height;
    let terrainHeight = 0;
    if (height < 4000 && height > 0) {
      // only retrieve terrain height when in a range where there exist such terrain in Switzerland
      // otherwise we can take the ellipsoid
      terrainHeight = this.scene_.globe.getHeight(camera.positionCartographic);
    }
    if (terrainHeight === undefined) {
      // If there is no terrain data, do not update the state
      return;
    }

    const heightDifference = height - terrainHeight;

    const currentLayersCount = this.scene_.imageryLayers.length;
    const layersCountChanged = currentLayersCount !== this.layersCount_;

    if (heightDifference <= 0 && (!this.belowSurface || layersCountChanged)) {
      this.updateLayers_(BELOW_SURFACE_CONFIGURATION);
      this.belowSurface = true;
      this.layersCount_ = currentLayersCount;
    } else if (heightDifference > 0 && (this.belowSurface || layersCountChanged)) {
      this.updateLayers_(ABOVE_SURFACE_CONFIGURATION);
      this.belowSurface = false;
      this.layersCount_ = currentLayersCount;
    }
  }

  updateLayers_(configuration) {
    for (let i = 0; i < this.scene_.imageryLayers.length; i++) {
      const layer = this.scene_.imageryLayers.get(i);
      Object.keys(configuration).forEach(key => layer[key] = configuration[key]);
    }
  }
}
