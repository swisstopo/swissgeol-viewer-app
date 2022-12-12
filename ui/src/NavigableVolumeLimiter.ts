import {BoundingSphere, Ellipsoid, Cartographic, Cartesian3} from 'cesium';
import type {Scene, Rectangle} from 'cesium';

/**
 * Constrain the camera so that it stays close to the bounding sphere of the map extent.
 * Near the ground the allowed distance is shorter.
 */
export default class NavigableVolumeLimiter {
  private blockLimiter = false;
  private boundingSphere: BoundingSphere;
  private ratioFunction: (height: number) => number;

  constructor(scene: Scene, rectangle: Rectangle, height: number, ratioFunction: (height: number) => number) {
    this.boundingSphere = BoundingSphere.fromRectangle3D(rectangle, Ellipsoid.WGS84, height);
    this.ratioFunction = ratioFunction;
    scene.camera.moveEnd.addEventListener(() => this.limit(scene), scene);
  }

  private limit(scene: Scene) {
    if (this.boundingSphere && !this.blockLimiter) {
      const camera = scene.camera;
      const position = camera.position;
      const carto = Cartographic.fromCartesian(position);
      const ratio = this.ratioFunction(carto.height);
      if (Cartesian3.distance(this.boundingSphere.center, position) > this.boundingSphere.radius * ratio) {
        this.blockLimiter = true;
        const unblockLimiter = () => this.blockLimiter = false;
        camera.flyToBoundingSphere(this.boundingSphere, {
          complete: unblockLimiter,
          cancel: unblockLimiter
        });
      }
    }
  }
}
