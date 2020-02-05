import Color from 'cesium/Core/Color';


const BELOW_SURFACE_CONFIGURATION = {
  colorToAlpha: Color.DARKGRAY,
  colorToAlphaThreshold: 0,
  brightness: 0.5,
  gamma: 0.7
};

const ABOVE_SURFACE_CONFIGURATION = {
  colorToAlpha: undefined,
  colorToAlphaThreshold: 0.004,
  brightness: 1,
  gamma: 1
};

export default class SurfaceColorUpdater {
  /**
   * @param {import('cesium/Scene/Scene').default} scene
   * @param imageryLayer
   */
  constructor(scene, imageryLayerIndex) {
    this.scene_ = scene;
    this.imageryLayer_ = this.scene_.imageryLayers.get(imageryLayerIndex);
    this.belowSurface = false;
    const checkPosition = this.checkPosition_.bind(this);
    this.scene_.postRender.addEventListener(checkPosition);
  }

  checkPosition_() {
    const camera = this.scene_.camera;
    if (camera.positionCartographic.height <= 0 && !this.belowSurface) {
      Object.keys(BELOW_SURFACE_CONFIGURATION).forEach(key => this.imageryLayer_[key] = BELOW_SURFACE_CONFIGURATION[key]);
      this.belowSurface = true;
    } else if (camera.positionCartographic.height > 0 && this.belowSurface) {
      Object.keys(ABOVE_SURFACE_CONFIGURATION).forEach(key => this.imageryLayer_[key] = ABOVE_SURFACE_CONFIGURATION[key]);
      this.belowSurface = false;
    }
  }
}
