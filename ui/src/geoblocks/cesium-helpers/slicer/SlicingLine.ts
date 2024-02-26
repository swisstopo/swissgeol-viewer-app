import {executeForAllPrimitives, getOrthogonalViewPoints, planeFromTwoPoints} from '../cesiumutils';
import {createClippingPlanes, createCPCModelMatrixFromSphere, getClippingPlaneFromSegmentWithTricks} from './helper';
import SlicingToolBase from './SlicingToolBase';
import {
  Matrix4,
  Cartesian3,
  Plane,
  ClippingPlaneCollection,
  VoxelPrimitive,
} from 'cesium';
import type {Cesium3DTileset} from 'cesium';

export interface SlicingLineOptions {
  /**
   * The 2 points through which to draw a line.
   */
  slicePoints: [Cartesian3, Cartesian3],
  negate: boolean | undefined,
}

export default class SlicingLine extends SlicingToolBase {
  options: SlicingLineOptions | null = null;
  plane: Plane | null = null;

  activate(options: SlicingLineOptions) {
    this.options = options;
    if (!options.slicePoints || options.slicePoints.length !== 2) {
      // these are the West and East points on the screen
      const points = getOrthogonalViewPoints(this.viewer);
      options.slicePoints = [points[0], points[1]];
    }

    // This plane is in World coordinates
    this.plane = planeFromTwoPoints(options.slicePoints[0], options.slicePoints[1], options.negate);
    this.viewer.scene.globe.clippingPlanes = createClippingPlanes([this.plane]);

    // For primitives Cesium needs planes in the local coordinates of each primitive
    executeForAllPrimitives(this.viewer, (primitive) => this.addClippingPlanes(primitive));
  }

  deactivate() {
    this.options = null;
    this.plane = null;
  }

  addClippingPlanes(primitive) {
    // 3Dtiles have 2 ways to define their local coordinate system:
    // - using the primitive.root.transform (the transform of the top level tile)
    // - the center of the bounding sphere of the tileset
    // To complicate things, orientation is dependent of the position of the bouding sphere center:
    // "if it is above the surface of the earth we want to apply an ENU orientation as our
    // best guess of orientation. Otherwise, we assume it gets its position/orientation completely from the
    // root tile transform and the tileset's model matrix"
    // Details on this are available at:
    // https://github.com/CesiumGS/cesium/pull/7034
    // https://github.com/CesiumGS/cesium/blob/4c6a296f63c63627b1cbe0a1f81d77a08799dd27/Source/Scene/Cesium3DTileset.js#L862-L873
    // There is a proposition to use planes in world coordinates: https://github.com/CesiumGS/cesium/issues/8554

    if (primitive instanceof VoxelPrimitive && this.options) {
      // works vice-verse to the globe \o/
      const plane = planeFromTwoPoints(this.options.slicePoints[0], this.options.slicePoints[1], !this.options.negate);
      primitive.clippingPlanes = createClippingPlanes([plane]);
      return;
    }
    if (!primitive.root || !primitive.boundingSphere || !this.options) return;
    if (Matrix4.equals(primitive.root.transform, Matrix4.IDENTITY)) {
      this.addClippingPlanesFromSphere(primitive);
      return;
    }
    console.log('A transform is used in this tileset');
    const planeNormal = this.plane!.normal;
    const p1 = this.options.slicePoints[0];
    const p2 = this.options.slicePoints[1];
    const mapRect = this.viewer.scene.globe.cartographicLimitRectangle;
    const transformCenter = Matrix4.getTranslation(primitive.root.transform, new Cartesian3());
    const tileCenter = Cartesian3.equals(transformCenter, Cartesian3.ZERO) ? primitive.boundingSphere.center : transformCenter;
    const plane = getClippingPlaneFromSegmentWithTricks(p1, p2, tileCenter, mapRect, planeNormal);
    if (this.options.negate) {
      plane.normal.x *= -1;
      plane.normal.y *= -1;
    }
    primitive.clippingPlanes = createClippingPlanes([plane]);
  }

  /**
   * Create a clipping plane in world coordinate and set an inverse transform
   * so that it is viewed in the local coordinates system defined by the tileset
   * bounding sphere center. The system is not based on an ENU frame when this
   * center is below the ground (to match Cesium behaviour, see comments in addClippingPlanes).
   * @param primitive
   */
  addClippingPlanesFromSphere(primitive: Cesium3DTileset) {
    const modelMatrix = createCPCModelMatrixFromSphere(primitive);
    const cpc = new ClippingPlaneCollection({
      modelMatrix: modelMatrix, // a transform from world coordinates to the tileset local reference system
      planes: [Plane.clone(this.plane!)], // plane in world coordinates
      edgeWidth: 1.0,
      unionClippingRegions: false,
    });
    primitive.clippingPlanes = cpc;
  }
}
