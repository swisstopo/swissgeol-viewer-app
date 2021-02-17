import Cartesian3 from 'cesium/Source/Core/Cartesian3';
import {executeForAllPrimitives} from '../utils';
import JulianDate from 'cesium/Source/Core/JulianDate';
import SlicerArrows from './SlicerArrows';
import {applyOffsetToPlane, createClippingPlanes, getBboxFromMapRatio, getOffsetForPrimitive} from './helper';
import {Plane} from 'cesium';
import CallbackProperty from 'cesium/Source/DataSources/CallbackProperty';
import {SLICE_BOX_ARROWS, SLICING_BOX_MIN_SIZE, SLICING_GEOMETRY_COLOR} from '../constants';
import {lv95ToDegrees, radiansToLv95} from '../projection';
import Cartographic from 'cesium/Source/Core/Cartographic';
import {pickCenterOnEllipsoid} from '../cesiumutils';
import CesiumMath from 'cesium/Source/Core/Math';
import SlicingToolBase from './SlicingToolBase';

export default class SlicingBox extends SlicingToolBase {
  constructor(viewer, dataSource) {
    super(viewer, dataSource);
    this.offsets = {};
    this.bottomPlane = null;
    this.topPlane = null;
    this.leftPlane = null;
    this.rightPlane = null;
    this.bbox = null;
    this.boxCenter = null;
    this.julianDate = new JulianDate();
  }

  activate() {
    this.bbox = getBboxFromMapRatio(this.viewer, 1 / 3);
    this.boxCenter = this.bbox.center;

    this.bottomPlane = Plane.fromPointNormal(this.bbox.center, new Cartesian3(0.0, 1.0, 0.0));
    this.topPlane = Plane.fromPointNormal(this.bbox.center, new Cartesian3(0.0, -1.0, 0.0));
    this.bottomPlane.distance = this.topPlane.distance = this.bbox.width / 2;

    this.leftPlane = Plane.fromPointNormal(this.bbox.center, new Cartesian3(1.0, 0.0, 0.0));
    this.rightPlane = Plane.fromPointNormal(this.bbox.center, new Cartesian3(-1.0, 0.0, 0.0));
    this.leftPlane.distance = this.rightPlane.distance = this.bbox.length / 2;

    this.downPlane = Plane.fromPointNormal(this.bbox.center, new Cartesian3(0.0, 0, 1.0));
    this.upPlane = Plane.fromPointNormal(this.bbox.center, new Cartesian3(0.0, 0, -1.0));
    this.downPlane.distance = this.upPlane.distance = this.bbox.height / 2;

    this.planes = [
      this.bottomPlane, this.leftPlane, this.topPlane, this.rightPlane,
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
    if (!this.onTickRemove) {
      const syncPlanes = this.movePlane.bind(this);
      this.onTickRemove = this.viewer.scene.postRender.addEventListener(syncPlanes);
    }

    this.viewer.scene.requestRender();
  }

  deactivate() {
    this.offsets = {};
    this.bottomPlane = null;
    this.topPlane = null;
    this.leftPlane = null;
    this.rightPlane = null;
    if (this.onTickRemove) {
      this.onTickRemove();
      this.onTickRemove = null;
    }
    this.slicerArrows.hide();
  }

  addClippingPlanes(primitive) {
    if (!primitive.root || !primitive.boundingSphere) return;
    this.offsets[primitive.url] = getOffsetForPrimitive(primitive, this.bbox.center);
    primitive.clippingPlanes = createClippingPlanes(this.planes);
  }

  updateBoxClippingPlanes(clippingPlanes, offset) {
    if (!clippingPlanes) return;
    clippingPlanes.removeAll();
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
      case 'left':
      case 'right': {
        const length = validateBoxSize(side === 'left', this.bbox.length);
        if (!length) return;
        this.bbox.length = length;
        side === 'left' ? this.leftPlane.distance += moveAmount : this.rightPlane.distance -= moveAmount;
        break;
      }
      case 'top':
      case 'bottom': {
        const width = validateBoxSize(side === 'top', this.bbox.width);
        if (!width) return;
        this.bbox.width = width;
        side === 'top' ? this.topPlane.distance += moveAmount : this.bottomPlane.distance -= moveAmount;
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
  }

  /**
   * Positioning arrows according to view center
   * @param side
   * @return {Cartesian3}
   */
  arrowPositionCallback(side) {
    const boxCenter = Cartographic.fromCartesian(this.boxCenter);
    const boxHeight = this.bbox.height;
    const lv95Center = radiansToLv95([boxCenter.longitude, boxCenter.latitude]);

    let lon, lat, height;
    const halfLength = this.bbox.length / 2;
    const halfWidth = this.bbox.width / 2;

    if (side === 'up' || side === 'down') {
      lon = lv95Center[0] - halfLength;
      lat = lv95Center[1] - halfWidth;
      side === 'down' ? height = -(boxHeight / 2) : height = boxHeight / 2;
    } else {
      let viewCenterLv95 = lv95Center;
      const viewCenter = pickCenterOnEllipsoid(this.viewer.scene);
      if (viewCenter) {
        const viewCenterCart = Cartographic.fromCartesian(viewCenter);
        viewCenterLv95 = radiansToLv95([viewCenterCart.longitude, viewCenterCart.latitude]);
      }
      const heightOffset = 20;
      height = this.viewer.scene.cameraUnderground ?
        -(boxHeight / 2) - heightOffset :
        boxHeight / 2 + heightOffset;
      const negate = side === 'top' || side === 'right' ? 1 : -1;
      const offset = 5000;
      if (side === 'top' || side === 'bottom') {
        const horizontalMin = lv95Center[0] - halfLength + offset;
        const horizontalMax = lv95Center[0] + halfLength - offset;
        lon = CesiumMath.clamp(viewCenterLv95[0], horizontalMin, horizontalMax);
        lat = lv95Center[1] + halfWidth * negate;
      } else if (side === 'left' || side === 'right') {
        const verticalMin = lv95Center[1] - halfWidth + offset;
        const verticalMax = lv95Center[1] + halfWidth - offset;
        lat = CesiumMath.clamp(viewCenterLv95[1], verticalMin, verticalMax);
        lon = lv95Center[0] + halfLength * negate;
      }
    }
    const degCenter = lv95ToDegrees([lon, lat]);
    return Cartesian3.fromDegrees(degCenter[0], degCenter[1], boxCenter.height + height);
  }

  movePlane() {
    this.updateBoxClippingPlanes(this.viewer.scene.globe.clippingPlanes);
    executeForAllPrimitives(this.viewer, (primitive) =>
      this.updateBoxClippingPlanes(primitive.clippingPlanes, this.offsets[primitive.url]));
  }
}
