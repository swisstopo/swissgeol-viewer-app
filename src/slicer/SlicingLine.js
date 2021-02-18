import {getOrthogonalViewPoints, planeFromTwoPoints} from '../cesiumutils';
import {executeForAllPrimitives} from '../utils';
import {createClippingPlanes, getClippingPlaneFromSegment} from './helper';
import SlicingToolBase from './SlicingToolBase';

export default class SlicingLine extends SlicingToolBase {
  constructor(viewer) {
    super(viewer);
    this.options = null;
  }

  activate(options) {
    this.options = options;
    if (!this.options.slicePoints || this.options.slicePoints.length !== 2) {
      const points = getOrthogonalViewPoints(this.viewer);
      this.options.slicePoints = [points.left, points.right];
    }
    this.plane = planeFromTwoPoints(this.options.slicePoints[0], this.options.slicePoints[1], this.options.negate);
    this.viewer.scene.globe.clippingPlanes = createClippingPlanes([this.plane]);
    executeForAllPrimitives(this.viewer, (primitive) => this.addClippingPlanes(primitive));
  }

  deactivate() {
    this.options = null;
    this.plane = null;
  }

  addClippingPlanes(primitive) {
    if (!primitive.root || !primitive.boundingSphere) return;
    const planeNormal = this.plane.normal;
    const p1 = this.options.slicePoints[0];
    const p2 = this.options.slicePoints[1];
    const mapRect = this.viewer.scene.globe.cartographicLimitRectangle;
    const tileCenter = primitive.boundingSphere.center;

    const plane = getClippingPlaneFromSegment(p1, p2, tileCenter, mapRect, planeNormal);
    if (this.options.negate) {
      plane.normal.x *= -1;
      plane.normal.y *= -1;
    }
    primitive.clippingPlanes = createClippingPlanes([plane]);
  }
}
