import ClippingPlaneCollection from 'cesium/Source/Scene/ClippingPlaneCollection';
import Transforms from 'cesium/Source/Core/Transforms';
import Plane from 'cesium/Source/Core/Plane';
import HeadingPitchRoll from 'cesium/Source/Core/HeadingPitchRoll';
import Matrix4 from 'cesium/Source/Core/Matrix4';
import {pickCenter} from './utils.js';


export default class Slicer {
  /**
   * @param {import('cesium/Source/Widgets/Viewer/Viewer').default} viewer
   */
  constructor(viewer) {

    this.viewer = viewer;

    this.plane = null;
    this.planeEntity = null;
  }

  set active(value) {
    const globe = this.viewer.scene.globe;
    if (value) {
      // initialize plane based on the camera's position and heading
      const center = pickCenter(this.viewer.scene);
      const hpr = new HeadingPitchRoll(this.viewer.scene.camera.heading, 0.0, 0.0);
      this.plane = Plane.transform(Plane.ORIGIN_ZX_PLANE, Transforms.headingPitchRollToFixedFrame(center, hpr));

      globe.clippingPlanes = this.createClippingPlanes();

      const primitives = this.viewer.scene.primitives;
      for (let i = 0, ii = primitives.length; i < ii; i++) {
        const primitive = primitives.get(i);
        if (primitive.root && primitive.root.computedTransform) {
          primitive.clippingPlanes = this.createClippingPlanes(
            Matrix4.inverse(primitive.root.computedTransform, new Matrix4())
          );
        }
      }
    } else {
      this.plane = null;
      globe.clippingPlanes.enabled = false;
      globe.clippingPlanes = undefined;

      const primitives = this.viewer.scene.primitives;
      for (let i = 0, ii = primitives.length; i < ii; i++) {
        const primitive = primitives.get(i);
        if (primitive.clippingPlanes) {
          primitive.clippingPlanes.enabled = false;
          primitive.clippingPlanes = undefined;
        }
      }
    }
    this.viewer.scene.requestRender();
  }

  get active() {
    return this.plane !== null;
  }

  movePlane(amount) {
    this.plane.distance += amount;
    this.viewer.scene.requestRender();
  }

  /**
   * @param {Matrix4=} modelMatrix
   */
  createClippingPlanes(modelMatrix) {
    const clippingPlanes = new ClippingPlaneCollection({
      modelMatrix: modelMatrix,
      planes: [this.plane],
      edgeWidth: 1.0
    });
    return clippingPlanes;
  }
}
