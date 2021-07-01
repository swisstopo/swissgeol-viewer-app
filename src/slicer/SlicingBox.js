import Cartesian3 from 'cesium/Source/Core/Cartesian3';
import {executeForAllPrimitives} from '../utils';
import JulianDate from 'cesium/Source/Core/JulianDate';
import SlicerArrows from './SlicerArrows';
import {
  applyOffsetToPlane,
  createClippingPlanes, getBboxFromRectangle,
  getBboxFromViewRatio,
  getClippingPlaneFromSegment,
  getOffsetFromBbox, moveSlicingBoxCorners
} from './helper';
import {Plane} from 'cesium';
import CallbackProperty from 'cesium/Source/DataSources/CallbackProperty';
import {
  DEFAULT_CONFIG_FOR_SLICING_ARROW,
  SLICE_BOX_ARROWS_INSIDE, SLICE_BOX_ARROWS_OUTSIDE,
  SLICING_BOX_MIN_SIZE,
  SLICING_GEOMETRY_COLOR
} from '../constants';
import Cartographic from 'cesium/Source/Core/Cartographic';
import {
  pickCenterOnEllipsoid, planeFromTwoPoints, projectPointOnSegment, updateHeightForCartesianPositions
} from '../cesiumutils';
import SlicingToolBase from './SlicingToolBase';
import Matrix4 from 'cesium/Source/Core/Matrix4';
import CornerType from 'cesium/Source/Core/CornerType';
import Cartesian2 from 'cesium/Source/Core/Cartesian2';

export default class SlicingBox extends SlicingToolBase {
  constructor(viewer, dataSource) {
    super(viewer, dataSource);
    this.options = null;
    this.offsets = {};
    this.backPlane = null;
    this.frontPlane = null;
    this.leftPlane = null;
    this.rightPlane = null;
    this.bbox = null;
    this.boxCenter = null;
    this.julianDate = new JulianDate();

    this.globePlanes = [];
  }

  activate(options) {
    this.options = options;
    if (this.options.slicePoints && this.options.slicePoints.length) {
      this.bbox = getBboxFromRectangle(this.viewer, this.options.slicePoints, this.options.lowerLimit, this.options.height);
    } else {
      this.bbox = getBboxFromViewRatio(this.viewer, 1 / 3);
    }
    this.boxCenter = this.bbox.center;
    this.planesPositions = [
      [this.bbox.corners.bottomLeft, this.bbox.corners.bottomRight],
      [this.bbox.corners.topRight, this.bbox.corners.topLeft],
      [this.bbox.corners.bottomRight, this.bbox.corners.topRight],
      [this.bbox.corners.topLeft, this.bbox.corners.bottomLeft],
    ];
    this.options.lowerLimit = this.bbox.lowerLimit;
    this.updateSidePlanes();

    this.downPlane = Plane.fromPointNormal(this.boxCenter, Cartesian3.UNIT_Z);
    this.upPlane = Plane.fromPointNormal(this.boxCenter, Cartesian3.negate(Cartesian3.UNIT_Z, new Cartesian3()));
    this.downPlane.distance = this.options.lowerLimit ? this.options.lowerLimit * -1 : this.bbox.height / 2;
    this.upPlane.distance = this.options.lowerLimit ? this.options.lowerLimit + this.bbox.height : this.bbox.height / 2;
    this.zPlanes = [this.downPlane, this.upPlane];

    this.slicerArrows = new SlicerArrows(this.viewer,
      this.dataSource,
      {
        moveCallback: (side, moveAmount, moveVector) => this.onPlaneMove(side, moveAmount, moveVector),
        positionUpdateCallback: (side) => this.arrowPositionCallback(side),
        arrowsList: this.options.negate ? SLICE_BOX_ARROWS_INSIDE : SLICE_BOX_ARROWS_OUTSIDE,
        arrowConfiguration: {...DEFAULT_CONFIG_FOR_SLICING_ARROW, orientation: this.bbox.orientation}
      });
    this.slicerArrows.show();

    const boxPositions = [
      this.bbox.corners.bottomRight,
      this.bbox.corners.bottomLeft,
      this.bbox.corners.topLeft,
      this.bbox.corners.topRight,
      this.bbox.corners.bottomRight
    ];
    const scratchCartesian2 = new Cartesian2(1, 0);
    const scratchCenter = new Cartographic();
    this.slicingBoxEntity = this.dataSource.entities.add({
      position: Cartesian3.midpoint(boxPositions[0], boxPositions[2], new Cartesian3()),
      polylineVolume: {
        positions: new CallbackProperty(() => {
          const height =
            Cartographic.fromCartesian(this.boxCenter, null, scratchCenter).height - (this.bbox.height / 2);
          return updateHeightForCartesianPositions(boxPositions, height);
        }, false),
        cornerType: CornerType.MITERED,
        outline: false,
        material: SLICING_GEOMETRY_COLOR.withAlpha(0.2),
        shape: new CallbackProperty(() => [
          Cartesian2.ZERO,
          Cartesian2.ZERO,
          scratchCartesian2,
          new Cartesian2(0, this.bbox.height),
        ], false)
      }
    });

    this.modelMatrix = this.slicingBoxEntity.computeModelMatrix(this.julianDate);
    const planes = [...this.sidePlanes];
    if (!this.options.negate) {
      planes.push(...this.zPlanes);
    }
    this.viewer.scene.globe.clippingPlanes = createClippingPlanes(planes, !this.options.negate);

    executeForAllPrimitives(this.viewer, (primitive) => this.addClippingPlanes(primitive));
    this.syncPlanes();

    this.viewer.scene.requestRender();
  }

  deactivate() {
    this.options = null;
    this.offsets = {};
    this.backPlane = null;
    this.frontPlane = null;
    this.leftPlane = null;
    this.rightPlane = null;
    this.boxCenter = null;
    this.slicerArrows.hide();
  }

  addClippingPlanes(primitive) {
    if (!primitive.root || !primitive.boundingSphere) return;
    this.offsets[primitive.basePath] = getOffsetFromBbox(primitive, this.bbox);
    const planes = [...this.sidePlanes];
    if (!this.options.negate) {
      planes.push(...this.zPlanes);
    }
    primitive.clippingPlanes = createClippingPlanes(planes, !this.options.negate);
    this.syncPlanes();
  }

  updateBoxGlobeClippingPlanes(clippingPlanes) {
    if (!clippingPlanes) return;
    clippingPlanes.removeAll();
    this.sidePlanes.forEach(plane => clippingPlanes.add(plane));
    if (!this.options.negate)
      this.zPlanes.forEach(plane => clippingPlanes.add(Plane.transform(plane, this.modelMatrix)));
  }

  updateBoxTileClippingPlanes(clippingPlanes, offset, center) {
    if (!clippingPlanes) return;
    clippingPlanes.removeAll();
    this.planesPositions.forEach(positions => {
      const mapRect = this.viewer.scene.globe.cartographicLimitRectangle;
      const plane = planeFromTwoPoints(positions[0], positions[1], false);
      const p = getClippingPlaneFromSegment(positions[0], positions[1], center, mapRect, plane.normal);
      if (this.options.negate) {
        Cartesian3.negate(p.normal, p.normal);
        p.distance *= -1;
      }
      clippingPlanes.add(p);
    });
    if (!this.options.negate) {
      this.zPlanes.forEach(plane => {
        plane = offset ? applyOffsetToPlane(plane, offset) : plane;
        clippingPlanes.add(plane);
      });
    }
  }

  onPlaneMove(side, moveAmount, moveVector) {
    let bothSideMove = false;
    const corners = this.bbox.corners;
    switch (side) {
      case 'left': {
        bothSideMove = moveSlicingBoxCorners(corners.topLeft, corners.bottomLeft, corners.topRight, corners.bottomRight, moveVector);
        break;
      }
      case 'right': {
        bothSideMove = moveSlicingBoxCorners(corners.topRight, corners.bottomRight, corners.topLeft, corners.bottomLeft, moveVector);
        break;
      }
      case 'front': {
        bothSideMove = moveSlicingBoxCorners(corners.topLeft, corners.topRight, corners.bottomLeft, corners.bottomRight, moveVector);
        break;
      }
      case 'back': {
        bothSideMove = moveSlicingBoxCorners(corners.bottomLeft, corners.bottomRight, corners.topLeft, corners.topRight, moveVector);
        break;
      }
      case 'up':
      case 'down': {
        let boxHeight = this.bbox.height;
        side === 'down' ? boxHeight += moveAmount : boxHeight -= moveAmount;
        if (boxHeight < SLICING_BOX_MIN_SIZE) {
          side === 'down' ? this.upPlane.distance -= moveAmount : this.downPlane.distance += moveAmount;
          bothSideMove = true;
        }
        this.bbox.height = boxHeight < SLICING_BOX_MIN_SIZE ? SLICING_BOX_MIN_SIZE : boxHeight;
        side === 'down' ? this.downPlane.distance += moveAmount : this.upPlane.distance -= moveAmount;
        break;
      }
    }
    this.bbox.width = Cartesian3.distance(corners.topLeft, corners.bottomLeft);
    this.bbox.length = Cartesian3.distance(corners.bottomRight, corners.bottomLeft);
    if (!bothSideMove) {
      Cartesian3.divideByScalar(moveVector, 2, moveVector);
    }
    Cartesian3.add(this.boxCenter, moveVector, this.boxCenter);
    this.syncPlanes();
  }

  /**
   * Positioning arrows according to view center
   * @param side
   * @return {Cartesian3}
   */
  arrowPositionCallback(side) {
    const boxCenter = Cartographic.fromCartesian(this.boxCenter);
    const boxHeight = this.bbox.height;
    const corners = this.bbox.corners;

    if (side === 'up' || side === 'down') {
      const position = Cartographic.fromCartesian(corners.bottomLeft);
      position.height = side === 'down' ? -(boxHeight / 2) : boxHeight / 2;
      position.height += boxCenter.height;
      return Cartographic.toCartesian(position);
    } else {
      const viewCenter = pickCenterOnEllipsoid(this.viewer.scene) || this.boxCenter;
      const heightOffset = 20;
      let height = boxHeight / 2 + heightOffset;
      height = this.viewer.scene.cameraUnderground ? boxCenter.height - height : boxCenter.height + height;
      const start = 0.05;
      const end = 0.95;
      switch (side) {
        case 'right':
          return projectPointOnSegment(viewCenter, corners.bottomRight, corners.topRight, start, end, height);
        case 'left':
          return projectPointOnSegment(viewCenter, corners.bottomLeft, corners.topLeft, start, end, height);
        case 'back':
          return projectPointOnSegment(viewCenter, corners.bottomRight, corners.bottomLeft, start, end, height);
        case 'front':
          return projectPointOnSegment(viewCenter, corners.topRight, corners.topLeft, start, end, height);
      }
    }
  }

  syncPlanes() {
    this.updateSidePlanes();
    this.updateBoxGlobeClippingPlanes(this.viewer.scene.globe.clippingPlanes);
    executeForAllPrimitives(this.viewer, (primitive) => {
      if (primitive.root && primitive.boundingSphere) {
        const transformCenter = Matrix4.getTranslation(primitive.root.transform, new Cartesian3());
        const tileCenter = Cartesian3.equals(transformCenter, Cartesian3.ZERO) ? primitive.boundingSphere.center : transformCenter;
        this.updateBoxTileClippingPlanes(primitive.clippingPlanes, this.offsets[primitive.basePath], tileCenter);
      }
    });
    if (this.options.syncBoxPlanesCallback) {
      const boxCenter = Cartographic.fromCartesian(this.boxCenter);
      const planesInfo = {
        type: this.options.type,
        slicePoints: Object.values(this.bbox.corners),
        lowerLimit: boxCenter.height - this.bbox.height / 2,
        height: this.bbox.height
      };
      this.options.syncBoxPlanesCallback(planesInfo);
    }
  }

  updateSidePlanes() {
    this.backPlane = planeFromTwoPoints(this.bbox.corners.bottomLeft, this.bbox.corners.bottomRight, this.options.negate);
    this.frontPlane = planeFromTwoPoints(this.bbox.corners.topRight, this.bbox.corners.topLeft, this.options.negate);
    this.rightPlane = planeFromTwoPoints(this.bbox.corners.bottomRight, this.bbox.corners.topRight, this.options.negate);
    this.leftPlane = planeFromTwoPoints(this.bbox.corners.topLeft, this.bbox.corners.bottomLeft, this.options.negate);
    this.sidePlanes = [this.backPlane, this.leftPlane, this.frontPlane, this.rightPlane];
  }
}
