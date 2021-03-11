import Cartesian3 from 'cesium/Source/Core/Cartesian3';
import {executeForAllPrimitives} from '../utils';
import JulianDate from 'cesium/Source/Core/JulianDate';
import SlicerArrows from './SlicerArrows';
import {
  applyOffsetToPlane,
  createClippingPlanes, getBboxFromRectangle,
  getBboxFromViewRatio,
  getClippingPlaneFromSegment,
  getOffsetFromBbox
} from './helper';
import {Plane} from 'cesium';
import CallbackProperty from 'cesium/Source/DataSources/CallbackProperty';
import {
  DEFAULT_CONFIG_FOR_SLICING_ARROW,
  SLICE_BOX_ARROWS,
  SLICING_BOX_MIN_SIZE,
  SLICING_GEOMETRY_COLOR
} from '../constants';
import Cartographic from 'cesium/Source/Core/Cartographic';
import {
  pickCenterOnEllipsoid, planeFromTwoPoints, projectPointOnSegment
} from '../cesiumutils';
import SlicingToolBase from './SlicingToolBase';
import Matrix4 from 'cesium/Source/Core/Matrix4';

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
    this.updateSidePlanes();

    this.downPlane = Plane.fromPointNormal(this.bbox.center, Cartesian3.UNIT_Z);
    this.upPlane = Plane.fromPointNormal(this.bbox.center, Cartesian3.negate(Cartesian3.UNIT_Z, new Cartesian3()));
    this.downPlane.distance = this.upPlane.distance = this.bbox.height / 2;
    this.zPlanes = [this.downPlane, this.upPlane];

    this.slicerArrows = new SlicerArrows(this.viewer,
      this.dataSource,
      {
        moveCallback: (side, moveAmount, moveVector) => this.onPlaneMove(side, moveAmount, moveVector),
        positionUpdateCallback: (side) => this.arrowPositionCallback(side),
        arrowsList: SLICE_BOX_ARROWS,
        arrowConfiguration: {...DEFAULT_CONFIG_FOR_SLICING_ARROW, orientation: this.bbox.orientation}
      });
    this.slicerArrows.show();

    this.slicingBoxEntity = this.dataSource.entities.add({
      position: new CallbackProperty(() => this.boxCenter, false),
      orientation: this.bbox.orientation,
      box: {
        dimensions: new CallbackProperty(() => new Cartesian3(this.bbox.length, this.bbox.width, this.bbox.height), false),
        material: SLICING_GEOMETRY_COLOR.withAlpha(0.1),
        outline: true,
        outlineColor: SLICING_GEOMETRY_COLOR,
      },
    });

    this.modelMatrix = this.slicingBoxEntity.computeModelMatrix(this.julianDate);
    this.viewer.scene.globe.clippingPlanes = createClippingPlanes([...this.sidePlanes, ...this.zPlanes]);

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
    this.offsets[primitive.url] = getOffsetFromBbox(primitive, this.bbox);
    primitive.clippingPlanes = createClippingPlanes([...this.sidePlanes, ...this.zPlanes]);
    this.syncPlanes();
  }

  updateBoxGlobeClippingPlanes(clippingPlanes) {
    if (!clippingPlanes) return;
    clippingPlanes.removeAll();
    this.sidePlanes.forEach(plane => clippingPlanes.add(plane));
    this.zPlanes.forEach(plane => clippingPlanes.add(Plane.transform(plane, this.modelMatrix)));
  }

  updateBoxTileClippingPlanes(clippingPlanes, offset, center) {
    if (!clippingPlanes) return;
    clippingPlanes.removeAll();
    this.planesPositions.forEach(positions => {
      const mapRect = this.viewer.scene.globe.cartographicLimitRectangle;
      const plane = planeFromTwoPoints(positions[0], positions[1], false);
      const p = getClippingPlaneFromSegment(positions[0], positions[1], center, mapRect, plane.normal);
      clippingPlanes.add(p);
    });
    this.zPlanes.forEach(plane => {
      plane = offset ? applyOffsetToPlane(plane, offset) : plane;
      clippingPlanes.add(plane);
    });
  }

  onPlaneMove(side, moveAmount, moveVector) {
    switch (side) {
      case 'left': {
        Cartesian3.add(this.bbox.corners.bottomLeft, moveVector, this.bbox.corners.bottomLeft);
        Cartesian3.add(this.bbox.corners.topLeft, moveVector, this.bbox.corners.topLeft);
        break;
      }
      case 'right': {
        Cartesian3.add(this.bbox.corners.bottomRight, moveVector, this.bbox.corners.bottomRight);
        Cartesian3.add(this.bbox.corners.topRight, moveVector, this.bbox.corners.topRight);
        break;
      }
      case 'front': {
        Cartesian3.add(this.bbox.corners.topRight, moveVector, this.bbox.corners.topRight);
        Cartesian3.add(this.bbox.corners.topLeft, moveVector, this.bbox.corners.topLeft);
        break;
      }
      case 'back': {
        Cartesian3.add(this.bbox.corners.bottomRight, moveVector, this.bbox.corners.bottomRight);
        Cartesian3.add(this.bbox.corners.bottomLeft, moveVector, this.bbox.corners.bottomLeft);
        break;
      }
      case 'up':
      case 'down': {
        let boxHeight = this.bbox.height;
        side === 'down' ? boxHeight += moveAmount : boxHeight -= moveAmount;
        boxHeight = boxHeight < SLICING_BOX_MIN_SIZE ? undefined : boxHeight;
        if (!boxHeight) return;
        this.bbox.height = boxHeight;
        side === 'down' ? this.downPlane.distance += moveAmount : this.upPlane.distance -= moveAmount;
        break;
      }
    }
    this.bbox.width = Cartesian3.distance(this.bbox.corners.topLeft, this.bbox.corners.bottomLeft);
    this.bbox.length = Cartesian3.distance(this.bbox.corners.bottomRight, this.bbox.corners.bottomLeft);
    Cartesian3.divideByScalar(moveVector, 2, moveVector);
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
        this.updateBoxTileClippingPlanes(primitive.clippingPlanes, this.offsets[primitive.url], tileCenter);
      }
    });
  }

  updateSidePlanes() {
    this.backPlane = planeFromTwoPoints(this.bbox.corners.bottomLeft, this.bbox.corners.bottomRight, false);
    this.frontPlane = planeFromTwoPoints(this.bbox.corners.topRight, this.bbox.corners.topLeft, false);
    this.rightPlane = planeFromTwoPoints(this.bbox.corners.bottomRight, this.bbox.corners.topRight, false);
    this.leftPlane = planeFromTwoPoints(this.bbox.corners.topLeft, this.bbox.corners.bottomLeft, false);
    this.sidePlanes = [this.backPlane, this.leftPlane, this.frontPlane, this.rightPlane];
  }
}
