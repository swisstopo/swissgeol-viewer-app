import {getOrthogonalViewPoints, planeFromTwoPoints} from '../cesiumutils';
import {executeForAllPrimitives} from '../utils.ts';
import {createClippingPlanes, getClippingPlaneFromSegment} from './helper.ts';
import SlicingToolBase from './SlicingToolBase.ts';
import Matrix4 from 'cesium/Source/Core/Matrix4';
import Cartesian3 from 'cesium/Source/Core/Cartesian3';
import Plane from 'cesium/Source/Core/Plane';

export interface SlicingLineOptions {
  slicePoints: any[],
  negate: boolean | undefined,
}

export default class SlicingLine extends SlicingToolBase {
  options: SlicingLineOptions | null = null;
  plane: Plane | null = null;

  activate(options: SlicingLineOptions) {
    this.options = options;
    if (!options.slicePoints || options.slicePoints.length !== 2) {
      const points = getOrthogonalViewPoints(this.viewer);
      options.slicePoints = [points[0], points[1]];
    }
    this.plane = planeFromTwoPoints(options.slicePoints[0], options.slicePoints[1], options.negate);
    this.viewer.scene.globe.clippingPlanes = createClippingPlanes([this.plane]);
    executeForAllPrimitives(this.viewer, (primitive) => this.addClippingPlanes(primitive));
  }

  deactivate() {
    this.options = null;
    this.plane = null;
  }

  addClippingPlanes(primitive) {
    if (!primitive.root || !primitive.boundingSphere || !this.options) return;
    const planeNormal = this.plane!.normal;
    const p1 = this.options.slicePoints[0];
    const p2 = this.options.slicePoints[1];
    const mapRect = this.viewer.scene.globe.cartographicLimitRectangle;
    const transformCenter = Matrix4.getTranslation(primitive.root.transform, new Cartesian3());
    const tileCenter = Cartesian3.equals(transformCenter, Cartesian3.ZERO) ? primitive.boundingSphere.center : transformCenter;

    const plane = getClippingPlaneFromSegment(p1, p2, tileCenter, mapRect, planeNormal);
    if (this.options.negate) {
      plane.normal.x *= -1;
      plane.normal.y *= -1;
    }
    primitive.clippingPlanes = createClippingPlanes([plane]);
  }
}
