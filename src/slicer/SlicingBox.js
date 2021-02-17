import ClippingPlane from 'cesium/Source/Scene/ClippingPlane';
import Cartesian3 from 'cesium/Source/Core/Cartesian3';
import {executeForAllPrimitives} from '../utils';
import JulianDate from 'cesium/Source/Core/JulianDate';
import SlicerArrows from './SlicerArrows';
import ClippingPlaneCollection from 'cesium/Source/Scene/ClippingPlaneCollection';
import {getBboxFromMapRatio, getOffsetForPrimitive} from './helper';
import {Plane} from 'cesium';
import CallbackProperty from 'cesium/Source/DataSources/CallbackProperty';
import {SLICE_BOX_ARROWS, SLICING_BOX_MIN_SIZE, SLICING_GEOMETRY_COLOR} from '../constants';
import {lv95ToDegrees, radiansToLv95} from '../projection';
import Cartographic from 'cesium/Source/Core/Cartographic';
import {pickCenterOnEllipsoid} from '../cesiumutils';
import CesiumMath from 'cesium/Source/Core/Math';

export default class SlicingBox {
  constructor(viewer, dataSource) {
    this.viewer = viewer;
    this.dataSource = dataSource;

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
    this.leftPlane = Plane.fromPointNormal(this.bbox.center, new Cartesian3(1.0, 0.0, 0.0));
    this.rightPlane = Plane.fromPointNormal(this.bbox.center, new Cartesian3(-1.0, 0.0, 0.0));
    this.downPlane = Plane.fromPointNormal(this.bbox.center, new Cartesian3(0.0, 0, 1.0));
    this.upPlane = Plane.fromPointNormal(this.bbox.center, new Cartesian3(0.0, 0, -1.0));
    this.updatePlanesDistance();
    this.slicerArrows = new SlicerArrows(this.viewer,
      this.dataSource,
      {
        moveCallback: (side, moveAmount, moveVector) => this.onPlaneMove(side, moveAmount, moveVector),
        positionUpdateCallback: (side) => this.arrowPositionCallback(side),
        arrowsList: SLICE_BOX_ARROWS
      });
    this.slicerArrows.show(this.bbox);

    this.slicingBoxEntity = this.dataSource.entities.add({ // todo fix move across opposite side
      position: new CallbackProperty(() => this.boxCenter, false),
      box: {
        dimensions: new CallbackProperty(() => new Cartesian3(this.bbox.length, this.bbox.width, this.bbox.height), false),
        material: SLICING_GEOMETRY_COLOR.withAlpha(0.1),
        outline: true,
        outlineColor: SLICING_GEOMETRY_COLOR,
      },
    });

    this.viewer.scene.globe.clippingPlanes = this.createClippingPlanes(this.slicingBoxEntity.computeModelMatrix(this.julianDate));

    executeForAllPrimitives(this.viewer, (primitive) => this.addClippingPlanes(primitive));
    if (!this.onTickRemove) {
      const syncPlanes = this.movePlane.bind(this);
      this.onTickRemove = this.viewer.scene.postRender.addEventListener(syncPlanes);
    }
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

  createClippingPlanes(modelMatrix) {
    return new ClippingPlaneCollection({
      modelMatrix: modelMatrix,
      planes: [
        this.bottomPlane, this.leftPlane, this.topPlane, this.rightPlane,
        this.downPlane, this.upPlane
      ],
      edgeWidth: 1.0,
      unionClippingRegions: true
    });
  }

  addClippingPlanes(primitive) {
    if (!primitive.root || !primitive.boundingSphere) return;
    this.offsets[primitive.url] = getOffsetForPrimitive(primitive, this.bbox.center);
    primitive.clippingPlanes = this.createClippingPlanes();
  }

  updateBoxClippingPlanes(clippingPlanes, offset) {
    if (!clippingPlanes) return;
    clippingPlanes.removeAll();
    if (offset) {
      const bottomPlane = ClippingPlane.clone(this.bottomPlane);
      bottomPlane.distance = bottomPlane.distance - offset.offsetX;

      const topPlane = ClippingPlane.clone(this.topPlane);
      topPlane.distance = topPlane.distance + offset.offsetX;

      const leftPlane = ClippingPlane.clone(this.leftPlane);
      leftPlane.distance = leftPlane.distance - offset.offsetY;

      const rightPlane = ClippingPlane.clone(this.rightPlane);
      rightPlane.distance = rightPlane.distance + offset.offsetY;

      const downPlane = ClippingPlane.clone(this.downPlane);
      downPlane.distance = downPlane.distance + offset.offsetZ;

      const upPlane = ClippingPlane.clone(this.upPlane);
      upPlane.distance = upPlane.distance - offset.offsetZ;

      clippingPlanes.add(bottomPlane);
      clippingPlanes.add(topPlane);
      clippingPlanes.add(leftPlane);
      clippingPlanes.add(rightPlane);
      clippingPlanes.add(downPlane);
      clippingPlanes.add(upPlane);
    } else {
      clippingPlanes.add(this.bottomPlane);
      clippingPlanes.add(this.leftPlane);
      clippingPlanes.add(this.topPlane);
      clippingPlanes.add(this.rightPlane);
      clippingPlanes.add(this.downPlane);
      clippingPlanes.add(this.upPlane);
    }
  }

  updatePlanesDistance() {
    this.bottomPlane.distance = this.bbox.width / 2;
    this.topPlane.distance = this.bbox.width / 2;
    this.leftPlane.distance = this.bbox.length / 2;
    this.rightPlane.distance = this.bbox.length / 2;
    this.downPlane.distance = this.bbox.height / 2;
    this.upPlane.distance = this.bbox.height / 2;
    this.viewer.scene.requestRender();
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
    const halfWidth = this.bbox.length / 2;
    const halfHeight = this.bbox.width / 2;
    if (side === 'up' || side === 'down') {
      lon = lv95Center[0] - halfWidth;
      lat = lv95Center[1] - halfHeight;
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
        const horizontalMin = lv95Center[0] - halfWidth + offset;
        const horizontalMax = lv95Center[0] + halfWidth - offset;
        lon = CesiumMath.clamp(viewCenterLv95[0], horizontalMin, horizontalMax);
        lat = lv95Center[1] + halfHeight * negate;
      } else if (side === 'left' || side === 'right') {
        const verticalMin = lv95Center[1] - halfHeight + offset;
        const verticalMax = lv95Center[1] + halfHeight - offset;
        lat = CesiumMath.clamp(viewCenterLv95[1], verticalMin, verticalMax);
        lon = lv95Center[0] + halfWidth * negate;
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
