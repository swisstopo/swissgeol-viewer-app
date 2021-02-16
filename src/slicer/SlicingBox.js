import ClippingPlane from 'cesium/Source/Scene/ClippingPlane';
import Cartesian3 from 'cesium/Source/Core/Cartesian3';
import Color from 'cesium/Source/Core/Color';
import CallbackProperty from 'cesium/Source/DataSources/CallbackProperty';
import Cartesian2 from 'cesium/Source/Core/Cartesian2';
import Entity from 'cesium/Source/DataSources/Entity';
import {executeForAllPrimitives} from '../utils';
import ScreenSpaceEventHandler from 'cesium/Source/Core/ScreenSpaceEventHandler';
import Cartographic from 'cesium/Source/Core/Cartographic';
import JulianDate from 'cesium/Source/Core/JulianDate';
import SlicerArrows from './SlicerArrows';
import ClippingPlaneCollection from 'cesium/Source/Scene/ClippingPlaneCollection';
import {getOffsetForPrimitive} from './helper';

const PLANE_COLOR = Color.WHITE; // todo
export default class SlicingBox {
  constructor(viewer, bbox, dataSource) {
    this.viewer = viewer;
    this.bbox = bbox;
    this.dataSource = dataSource;

    this.offsets = {};
    this.planeHorizontalDown = null;
    this.planeHorizontalUp = null;
    this.planeVerticalLeft = null;
    this.planeVerticalRight = null;
    this.julianDate = new JulianDate();

    this.eventHandler = null;

    this.slicerArrows = new SlicerArrows(this.viewer, this.eventHandler, this.dataSource, this.bbox);
  }

  activate() {
    this.bbox.activate();

    this.planeHorizontalDown = new ClippingPlane(new Cartesian3(0.0, 1.0, 0.0), 0.0);
    this.planeHorizontalUp = new ClippingPlane(new Cartesian3(0.0, -1.0, 0.0), 0.0);
    this.planeVerticalLeft = new ClippingPlane(new Cartesian3(1.0, 0.0, 0.0), 0.0);
    this.planeVerticalRight = new ClippingPlane(new Cartesian3(-1.0, 0.0, 0.0), 0.0);
    this.planeDown = new ClippingPlane(new Cartesian3(0.0, 0, 1.0), 0.0);
    this.planeUp = new ClippingPlane(new Cartesian3(0.0, 0, -1.0), 0.0);
    const planeStyle = {
      material: Color.WHITE.withAlpha(0.1),
      outline: true,
      outlineColor: PLANE_COLOR,
    };

    /**
     * @type {Entity.ConstructorOptions}
     */
    const horizontalEntityTemplate = {
      position: new CallbackProperty(this.centerUpdateFunction('horizontal'), false),
      plane: {
        plane: new CallbackProperty(this.createBoxPlaneUpdateFunction(this.planeHorizontalDown, 'horizontal'), false),
        dimensions: new CallbackProperty(() => new Cartesian2(this.bbox.planesHorizontalLength, this.bbox.boxHeight), false),
        ...planeStyle
      }
    };

    /**
     * @type {Entity.ConstructorOptions}
     */
    const verticalEntityTemplate = {
      position: new CallbackProperty(this.centerUpdateFunction('vertical'), false),
      plane: {
        plane: new CallbackProperty(this.createBoxPlaneUpdateFunction(this.planeVerticalLeft, 'vertical'), false),
        dimensions: new CallbackProperty(() => new Cartesian2(this.bbox.planesVerticalLength, this.bbox.boxHeight), false),
        ...planeStyle
      }
    };

    /**
     * @type {Entity.ConstructorOptions}
     */
    const zEntityTemplate = {
      position: new CallbackProperty(this.centerUpdateFunction('altitude'), false),
      plane: {
        plane: new CallbackProperty(this.createBoxPlaneUpdateFunction(this.planeDown, 'altitude-down'), false),
        dimensions: new CallbackProperty(() => new Cartesian2(this.bbox.planesHorizontalLength, this.bbox.planesVerticalLength), false),
        ...planeStyle
      }
    };
    this.planeEntitDown = new Entity(zEntityTemplate);
    this.dataSource.entities.add(this.planeEntitDown);

    zEntityTemplate.plane.plane =
      new CallbackProperty(this.createBoxPlaneUpdateFunction(this.planeUp, 'altitude-up'), false);
    this.planeEntitUp = new Entity(zEntityTemplate);
    this.dataSource.entities.add(this.planeEntitUp);

    this.planeEntityHorizontal = new Entity(horizontalEntityTemplate);
    this.dataSource.entities.add(this.planeEntityHorizontal);

    horizontalEntityTemplate.plane.plane =
      new CallbackProperty(this.createBoxPlaneUpdateFunction(this.planeHorizontalUp, 'horizontal-northeast'), false);
    this.planeEntityHorizontalUp = new Entity(horizontalEntityTemplate);
    this.dataSource.entities.add(this.planeEntityHorizontalUp);

    this.planeEntityVertical = new Entity(verticalEntityTemplate);
    this.dataSource.entities.add(this.planeEntityVertical);

    verticalEntityTemplate.plane.plane =
      new CallbackProperty(this.createBoxPlaneUpdateFunction(this.planeVerticalRight, 'vertical-northeast'), false);
    this.planeEntityVerticalRight = new Entity(verticalEntityTemplate);
    this.dataSource.entities.add(this.planeEntityVerticalRight);

    this.viewer.scene.globe.clippingPlanes = this.createClippingPlanes(this.planeEntityHorizontal.computeModelMatrix(this.julianDate));

    executeForAllPrimitives(this.viewer, (primitive) => this.addClippingPlanes(primitive));

    if (!this.eventHandler) {
      this.eventHandler = new ScreenSpaceEventHandler(this.viewer.canvas);
      this.slicerArrows.eventHandler = this.eventHandler; // todo
      this.slicerArrows.activate();
      const syncPlanes = this.movePlane.bind(this);
      this.onTickRemove = this.viewer.scene.postRender.addEventListener(syncPlanes);
    }
  }

  deactivate() {
    this.offsets = {};
    this.planeHorizontalDown = null;
    this.planeHorizontalUp = null;
    this.planeVerticalLeft = null;
    this.planeVerticalRight = null;
    if (this.eventHandler) {
      this.eventHandler.destroy();
      this.eventHandler = null;
      this.onTickRemove();
    }
  }

  createClippingPlanes(modelMatrix) {
    return new ClippingPlaneCollection({
      modelMatrix: modelMatrix,
      planes: [
        this.planeHorizontalDown, this.planeVerticalLeft, this.planeHorizontalUp, this.planeVerticalRight,
        this.planeDown, this.planeUp
      ],
      edgeWidth: 1.0,
      unionClippingRegions: true
    });
  }

  addClippingPlanes(primitive) {
    if (!primitive.root || !primitive.boundingSphere) return;
    this.offsets[primitive.url] = getOffsetForPrimitive(primitive);
    primitive.clippingPlanes = this.createClippingPlanes();
  }

  updateBoxClippingPlanes(clippingPlanes, offset) {
    if (!clippingPlanes) return;
    clippingPlanes.removeAll();
    if (offset) {
      const planeHorizontalDown = ClippingPlane.clone(this.planeHorizontalDown);
      planeHorizontalDown.distance = planeHorizontalDown.distance - offset.offsetX;

      const planeHorizontalUp = ClippingPlane.clone(this.planeHorizontalUp);
      planeHorizontalUp.distance = planeHorizontalUp.distance + offset.offsetX;

      const planeVerticalLeft = ClippingPlane.clone(this.planeVerticalLeft);
      planeVerticalLeft.distance = planeVerticalLeft.distance - offset.offsetY;

      const planeVerticalRight = ClippingPlane.clone(this.planeVerticalRight);
      planeVerticalRight.distance = planeVerticalRight.distance + offset.offsetY;

      const planeDown = ClippingPlane.clone(this.planeDown);
      planeDown.distance = planeDown.distance + offset.offsetZ;

      const planeUp = ClippingPlane.clone(this.planeUp);
      planeUp.distance = planeUp.distance - offset.offsetZ;

      clippingPlanes.add(planeHorizontalDown);
      clippingPlanes.add(planeHorizontalUp);
      clippingPlanes.add(planeVerticalLeft);
      clippingPlanes.add(planeVerticalRight);
      clippingPlanes.add(planeDown);
      clippingPlanes.add(planeUp);
    } else {
      clippingPlanes.add(this.planeHorizontalDown);
      clippingPlanes.add(this.planeVerticalLeft);
      clippingPlanes.add(this.planeHorizontalUp);
      clippingPlanes.add(this.planeVerticalRight);
      clippingPlanes.add(this.planeDown);
      clippingPlanes.add(this.planeUp);
    }
  }

  /**
   * @param {Plane} plane
   * @param {string}type
   */
  createBoxPlaneUpdateFunction(plane, type) {
    return () => {
      if (type.includes('altitude')) {
        plane.distance = type.includes('down') ? this.bbox.targetDown : this.bbox.targetUp;
      } else if (type.includes('horizontal')) {
        plane.distance = type.includes('northeast') ? this.bbox.targetYNortheast : this.bbox.targetYSouthwest;
      } else if (type.includes('vertical')) {
        plane.distance = type.includes('northeast') ? this.bbox.targetXNortheast : this.bbox.targetXSouthwest;
      }
      return plane;
    };
  }

  centerUpdateFunction(type) {
    return () => {
      if (type === 'horizontal')
        return this.bbox.planesCenterH;
      else if (type === 'vertical')
        return this.bbox.planesCenterV;
      else {
        const centerHCart = Cartographic.fromCartesian(this.bbox.planesCenterH);
        const centerVCart = Cartographic.fromCartesian(this.bbox.planesCenterV);
        const center = new Cartographic(centerHCart.longitude, centerVCart.latitude);
        return Cartographic.toCartesian(center);
      }
    };
  }

  movePlane() {
    this.updateBoxClippingPlanes(this.viewer.scene.globe.clippingPlanes);
    executeForAllPrimitives(this.viewer, (primitive) =>
      this.updateBoxClippingPlanes(primitive.clippingPlanes, this.offsets[primitive.url]));
  }
}
