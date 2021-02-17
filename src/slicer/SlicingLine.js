import Matrix4 from 'cesium/Source/Core/Matrix4';
import {pickCenter, planeFromTwoPoints} from '../cesiumutils';
import HeadingPitchRoll from 'cesium/Source/Core/HeadingPitchRoll';
import Plane from 'cesium/Source/Core/Plane';
import Transforms from 'cesium/Source/Core/Transforms';
import {executeForAllPrimitives} from '../utils';
import {createClippingPlanes} from './helper';
import SlicingToolBase from './SlicingToolBase';

export default class SlicingLine extends SlicingToolBase {
  constructor(viewer) {
    super(viewer);
    this.options = null;
    this.planeEntity = null;
  }

  activate(options) {
    this.options = options;
    const slicePoints = this.options.slicePoints;
    if (!slicePoints || slicePoints.length !== 2) {
      const center = pickCenter(this.viewer.scene);
      const hpr = new HeadingPitchRoll(this.viewer.scene.camera.heading, 0.0, 0.0);
      this.plane = Plane.transform(Plane.ORIGIN_ZX_PLANE, Transforms.headingPitchRollToFixedFrame(center, hpr));
    } else {
      this.plane = planeFromTwoPoints(slicePoints[0], slicePoints[1], this.options.negate);
    }

    this.viewer.scene.globe.clippingPlanes = createClippingPlanes([this.plane]);
    executeForAllPrimitives(this.viewer, (primitive) => this.addClippingPlane(primitive));
  }

  deactivate() {
    this.options = null;
    this.plane = null;
  }

  addClippingPlane(primitive) {
    if (!primitive.root || !primitive.root.computedTransform) return;
    const modelMatrix = Matrix4.inverse(primitive.root.computedTransform, new Matrix4());
    primitive.clippingPlanes = createClippingPlanes([this.plane], modelMatrix);
  }
}
