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
import {Plane, Rectangle} from 'cesium';
import CallbackProperty from 'cesium/Source/DataSources/CallbackProperty';
import {SLICE_BOX_ARROWS, SLICING_BOX_MIN_SIZE, SLICING_GEOMETRY_COLOR} from '../constants';
import Cartographic from 'cesium/Source/Core/Cartographic';
import {
  pickCenterOnEllipsoid, planeFromTwoPoints, projectPointOnSegment
} from '../cesiumutils';
import SlicingToolBase from './SlicingToolBase';
import Entity from 'cesium/Source/DataSources/Entity';
import Color from 'cesium/Source/Core/Color';

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
  }

  activate(options) {
    this.options = options;
    if (this.options.slicePoints && this.options.slicePoints.length) {
      this.bbox = getBboxFromRectangle(this.viewer, this.options.slicePoints);
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

    this.backPlane = Plane.fromPointNormal(this.bbox.center, Cartesian3.UNIT_Y);
    this.frontPlane = Plane.fromPointNormal(this.bbox.center, Cartesian3.negate(Cartesian3.UNIT_Y, new Cartesian3()));
    this.backPlane.distance = this.frontPlane.distance = this.bbox.width / 2;

    this.leftPlane = Plane.fromPointNormal(this.bbox.center, Cartesian3.UNIT_X);
    this.rightPlane = Plane.fromPointNormal(this.bbox.center, Cartesian3.negate(Cartesian3.UNIT_X, new Cartesian3()));
    this.leftPlane.distance = this.rightPlane.distance = this.bbox.length / 2;

    this.downPlane = Plane.fromPointNormal(this.bbox.center, Cartesian3.UNIT_Z);
    this.upPlane = Plane.fromPointNormal(this.bbox.center, Cartesian3.negate(Cartesian3.UNIT_Z, new Cartesian3()));
    this.downPlane.distance = this.upPlane.distance = this.bbox.height / 2;

    this.planes = [
      /*this.bottomPlane, this.leftPlane, this.topPlane, this.rightPlane,*/
      this.downPlane, this.upPlane
    ];

    this.slicerArrows = new SlicerArrows(this.viewer,
      this.dataSource,
      {
        moveCallback: (side, moveAmount, moveVector) => this.onPlaneMove(side, moveAmount, moveVector),
        positionUpdateCallback: (side) => this.arrowPositionCallback(side),
        arrowsList: SLICE_BOX_ARROWS
      });
    this.slicerArrows.show(this.bbox);

    this.slicingBoxEntity = this.dataSource.entities.add({
      position: new CallbackProperty(() => this.boxCenter, false),
      box: {
        dimensions: new CallbackProperty(() => new Cartesian3(this.bbox.length, this.bbox.width, this.bbox.height), false),
        material: SLICING_GEOMETRY_COLOR.withAlpha(0.1),
        outline: true,
        outlineColor: SLICING_GEOMETRY_COLOR,
      },
    });

    const modelMatrix = this.slicingBoxEntity.computeModelMatrix(this.julianDate);
    this.viewer.scene.globe.clippingPlanes = createClippingPlanes(this.planes, modelMatrix);

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
    this.slicerArrows.hide();
  }

  addClippingPlanes(primitive) {
    if (!primitive.root || !primitive.boundingSphere) return;
    this.offsets[primitive.url] = getOffsetFromBbox(primitive, this.bbox);
    primitive.clippingPlanes = createClippingPlanes(this.planes);
    this.syncPlanes();
  }

  updateBoxClippingPlanes(clippingPlanes, offset) {
    if (!clippingPlanes) return;
    clippingPlanes.removeAll();
    this.planes.forEach(plane => {
      plane = offset ? applyOffsetToPlane(plane, offset) : plane;
      clippingPlanes.add(plane);
    });
  }

  updateBoxTileClippingPlanes(clippingPlanes, offset, center) {
    if (!clippingPlanes) return;
    clippingPlanes.removeAll();
    this.planesPositions.forEach(positions => {
      const mapRect = this.viewer.scene.globe.cartographicLimitRectangle;
      const plane = planeFromTwoPoints(positions[0], positions[1], false);
      const p = getClippingPlaneFromSegment(positions[0], positions[1], center, mapRect, plane.normal);
      clippingPlanes.add(p);
      // this.planes.push(p);
    });
    this.planes.forEach(plane => {
      plane = offset ? applyOffsetToPlane(plane, offset) : plane;
      clippingPlanes.add(plane);
    });
  }

  onPlaneMove(side, moveAmount, moveVector) {
    const validateBoxSize = (condition, value) => {
      condition ? value += moveAmount : value -= moveAmount;
      return value < SLICING_BOX_MIN_SIZE ? undefined : value;
    };
    switch (side) {
      case 'left': {
        const length = validateBoxSize(true, this.bbox.length);
        if (!length) return;
        this.bbox.length = length;
        this.leftPlane.distance += moveAmount;
        Cartesian3.add(this.bbox.corners.bottomLeft, moveVector, this.bbox.corners.bottomLeft);
        Cartesian3.add(this.bbox.corners.topLeft, moveVector, this.bbox.corners.topLeft);
        break;
      }
      case 'right': {
        const length = validateBoxSize(false, this.bbox.length);
        if (!length) return;
        this.bbox.length = length;
        this.rightPlane.distance -= moveAmount;
        Cartesian3.add(this.bbox.corners.bottomRight, moveVector, this.bbox.corners.bottomRight);
        Cartesian3.add(this.bbox.corners.topRight, moveVector, this.bbox.corners.topRight);
        break;
      }
      case 'front': {
        const width = validateBoxSize(true, this.bbox.width);
        if (!width) return;
        this.bbox.width = width;
        this.frontPlane.distance += moveAmount;
        Cartesian3.add(this.bbox.corners.topRight, moveVector, this.bbox.corners.topRight);
        Cartesian3.add(this.bbox.corners.topLeft, moveVector, this.bbox.corners.topLeft);
        break;
      }
      case 'back': {
        const width = validateBoxSize(false, this.bbox.width);
        if (!width) return;
        this.bbox.width = width;
        this.backPlane.distance -= moveAmount;
        Cartesian3.add(this.bbox.corners.bottomRight, moveVector, this.bbox.corners.bottomRight);
        Cartesian3.add(this.bbox.corners.bottomLeft, moveVector, this.bbox.corners.bottomLeft);
        break;
      }
      case 'up':
      case 'down': {
        const height = validateBoxSize(side === 'down', this.bbox.height);
        if (!height) return;
        this.bbox.height = height;
        side === 'down' ? this.downPlane.distance += moveAmount : this.upPlane.distance -= moveAmount;
        break;
      }
    }
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
    this.updateBoxClippingPlanes(this.viewer.scene.globe.clippingPlanes);
    executeForAllPrimitives(this.viewer, (primitive) => {
      if (primitive.root && primitive.boundingSphere) {
        this.updateBoxTileClippingPlanes(primitive.clippingPlanes, this.offsets[primitive.url], primitive.boundingSphere.center);
      }
    });

  }
}
