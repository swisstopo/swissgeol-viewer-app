import {BoundingSphere, Ellipsoid, Cartographic, Cartesian3} from 'cesium';

/**
 * Constrain the camera so that it stays close to the bounding sphere of the map extent.
 * Near the ground the allowed distance is shorter.
 */
export default class NavigableVolumeLimiter {

  /**
   * @param {import('cesium/Source/Scene/Scene').default} scene
   * @param {import('cesium/Source/Core/Rectangle').default} [rectangle]
   * @param {number} height
   * @param {function(number): number} ratioFunction
   */
  constructor(scene, rectangle, height, ratioFunction) {
    this.blockLimiter_ = false;
    this.boundingSphere_ = BoundingSphere.fromRectangle3D(rectangle, Ellipsoid.WGS84, height);
    this.ratioFunction_ = ratioFunction;
    scene.camera.moveEnd.addEventListener(() => this.limit_(scene), scene);
  }

  /**
   * @param {import('cesium/Source/Scene/Scene').default} scene
   */
  limit_(scene) {
    if (this.boundingSphere_ && !this.blockLimiter_) {
      const camera = scene.camera;
      const position = camera.position;
      const carto = Cartographic.fromCartesian(position);
      const ratio = this.ratioFunction_(carto.height);
      if (Cartesian3.distance(this.boundingSphere_.center, position) > this.boundingSphere_.radius * ratio) {
        this.blockLimiter_ = true;
        const unblockLimiter = () => this.blockLimiter_ = false;
        camera.flyToBoundingSphere(this.boundingSphere_, {
          complete: unblockLimiter,
          cancel: unblockLimiter
        });
      }
    }
  }
}
