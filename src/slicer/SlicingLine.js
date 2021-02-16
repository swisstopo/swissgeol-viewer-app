import Matrix4 from 'cesium/Source/Core/Matrix4';
import ClippingPlaneCollection from 'cesium/Source/Scene/ClippingPlaneCollection';
import {pickCenter, planeFromTwoPoints} from '../cesiumutils';
import HeadingPitchRoll from 'cesium/Source/Core/HeadingPitchRoll';
import Plane from 'cesium/Source/Core/Plane';
import Transforms from 'cesium/Source/Core/Transforms';
import {executeForAllPrimitives} from '../utils';

export default class SlicingLine {
  constructor(viewer, options) {
    this.viewer = viewer;
    this.options = options;

    this.planeEntity = null;
  }

  activate() {
    const slicePoints = this.options.slicePoints;
    if (!slicePoints || slicePoints.length !== 2) {
      const center = pickCenter(this.viewer.scene);
      const hpr = new HeadingPitchRoll(this.viewer.scene.camera.heading, 0.0, 0.0);
      this.plane = Plane.transform(Plane.ORIGIN_ZX_PLANE, Transforms.headingPitchRollToFixedFrame(center, hpr));
    } else {
      this.plane = planeFromTwoPoints(slicePoints[0], slicePoints[1], this.options.negate);
    }

    this.viewer.scene.globe.clippingPlanes = this.createClippingPlanes();
    executeForAllPrimitives(this.viewer, (primitive) => this.addClippingPlane(primitive));
  }

  deactivate() {
    this.plane = null;
  }

  /**
   * @param {Matrix4=} modelMatrix
   */
  createClippingPlanes(modelMatrix) {
    return new ClippingPlaneCollection({
      modelMatrix: modelMatrix,
      planes: [this.plane],
      edgeWidth: 1.0,
      unionClippingRegions: true
    });
  }

  addClippingPlane(primitive) {
    if (!primitive.root || !primitive.root.computedTransform) return;
    const modelMatrix = Matrix4.inverse(primitive.root.computedTransform, new Matrix4());
    primitive.clippingPlanes = this.createClippingPlanes(modelMatrix);
  }
}
