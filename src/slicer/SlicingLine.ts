import {getOrthogonalViewPoints, planeFromTwoPoints} from '../cesiumutils';
import {executeForAllPrimitives} from '../utils';
import {createClippingPlanes, getClippingPlaneFromSegment} from './helper';
import SlicingToolBase from './SlicingToolBase';
import Matrix4 from 'cesium/Source/Core/Matrix4';
import Cartesian3 from 'cesium/Source/Core/Cartesian3';
import Plane from 'cesium/Source/Core/Plane';
import Cesium3DTileset from 'cesium/Source/Scene/Cesium3DTileset';
import Transforms from 'cesium/Source/Core/Transforms';
import ClippingPlaneCollection from 'cesium/Source/Scene/ClippingPlaneCollection';
import Cartographic from 'cesium/Source/Core/Cartographic';
import ApproximateTerrainHeights from 'cesium/Source/Core/ApproximateTerrainHeights';

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

    if (!primitive.root || !primitive.boundingSphere || !this.options) return;
    // @ts-ignore
    const workaround = window.cpWorkaround;
    if (workaround && Matrix4.equals(primitive.root.transform, Matrix4.IDENTITY)) {
      this.addClippingPlanesFromSphere(primitive);
      return;
    }
    const planeNormal = this.plane!.normal;
    const p1 = this.options.slicePoints[0];
    const p2 = this.options.slicePoints[1];
    const mapRect = this.viewer.scene.globe.cartographicLimitRectangle;
    const transformCenter = Matrix4.getTranslation(primitive.root.transform, new Cartesian3());
    const tileCenter = Cartesian3.equals(transformCenter, Cartesian3.ZERO) ? primitive.boundingSphere.center : transformCenter;
    const plane = getClippingPlaneFromSegment(p1, p2, tileCenter, mapRect, planeNormal);
    console.log('addClippingPlane', plane, primitive.boundingSphere.center, transformCenter, primitive.root.transform);
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
    const clippingCenter = primitive.boundingSphere.center;
    const clippingCarto = Cartographic.fromCartesian(clippingCenter);
    console.log('Add planes from sphere', clippingCarto, primitive);
    let globalMatrix = Matrix4.IDENTITY;
    if (clippingCarto && (clippingCarto.height > ApproximateTerrainHeights._defaultMinTerrainHeight)) {
      globalMatrix = Transforms.eastNorthUpToFixedFrame(clippingCenter);
      console.log('BS under terrain, assuming a cartesian orientation');
    }
    // @ts-ignore clippingPlanesOriginMatrix is private?
    const toLocalMatrix = Matrix4.inverse(primitive.clippingPlanesOriginMatrix, new Matrix4());
    const localMatrix = Matrix4.multiply(toLocalMatrix, globalMatrix, new Matrix4());
    const ccp = new ClippingPlaneCollection({
      modelMatrix: localMatrix,
      planes: [Plane.clone(this.plane!)],
      edgeWidth: 1.0,
      unionClippingRegions: false,
    });
    // The clipping plane is initially positioned at the tileset's root transform.
    // Apply an additional matrix to center the clipping plane on the bounding sphere center.
    const transformCenter = Matrix4.getTranslation(primitive.root.transform, new Cartesian3());
    const transformCartographic = Cartographic.fromCartesian(transformCenter);
    if (transformCartographic) {
      console.log('transformCartographic', transformCartographic);
      const height = clippingCarto.height - transformCartographic.height;
      ccp.modelMatrix = Matrix4.fromTranslation(
        new Cartesian3(0.0, 0.0, height)
      );
    }
    primitive.clippingPlanes = ccp;
  }
}
