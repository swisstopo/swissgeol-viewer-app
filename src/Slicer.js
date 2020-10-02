import ClippingPlaneCollection from 'cesium/Source/Scene/ClippingPlaneCollection';
import ScreenSpaceEventHandler from 'cesium/Source/Core/ScreenSpaceEventHandler';
import Plane from 'cesium/Source/Core/Plane';
import {pickCenter} from './utils.js';
import ScreenSpaceEventType from 'cesium/Source/Core/ScreenSpaceEventType';
import ClippingPlane from 'cesium/Source/Scene/ClippingPlane';
import Cartesian3 from 'cesium/Source/Core/Cartesian3';
import Cartographic from 'cesium/Source/Core/Cartographic';
import Rectangle from 'cesium/Source/Core/Rectangle';
import Entity from 'cesium/Source/DataSources/Entity';
import CallbackProperty from 'cesium/Source/DataSources/CallbackProperty';
import Cartesian2 from 'cesium/Source/Core/Cartesian2';
import Color from 'cesium/Source/Core/Color';
import CMath from 'cesium/Source/Core/Math';
import {degreesToLv95} from './projection';
import CustomDataSource from 'cesium/Source/DataSources/CustomDataSource';


const PLANE_HEIGHT = 15000;

export default class Slicer {
  /**
   * @param {import('cesium/Source/Widgets/Viewer/Viewer').default} viewer
   */
  constructor(viewer) {

    this.viewer = viewer;
    this.slicerDataSource = new CustomDataSource('slicer');
    this.viewer.dataSources.add(this.slicerDataSource);

    this.plane = null;
    this.planeEntity = null;

    this.eventHandler = null;
    this.selectedPlane = null;
    this.targetY = 0.0;
    this.targetX = 0.0;

    this.offsets = {};
  }

  set active(value) {
    const globe = this.viewer.scene.globe;
    if (value) {
      // initialize plane based on the camera's position
      let center = pickCenter(this.viewer.scene);
      let cartCenter = Cartographic.fromCartesian(center);
      if (!Rectangle.contains(globe.cartographicLimitRectangle, cartCenter)) {
        cartCenter = Rectangle.center(globe.cartographicLimitRectangle);
        center = Cartographic.toCartesian(cartCenter);
      }
      this.planeHorizontal = new ClippingPlane(new Cartesian3(0.0, 1.0, 0.0), 0.0);
      this.planeVertical = new ClippingPlane(new Cartesian3(1.0, 0.0, 0.0), 0.0);

      this.planeEntityHorizontal = new Entity({
        position: center,
        plane: {
          plane: new CallbackProperty(this.createPlaneUpdateFunction(this.planeHorizontal, 'horizontal'), false),
          dimensions: new Cartesian2(700000.0, PLANE_HEIGHT),
          material: Color.WHITE.withAlpha(0.1),
          outline: true,
          outlineColor: Color.WHITE,
        },
        properties: {
          type: 'horizontal'
        }
      });
      this.slicerDataSource.entities.add(this.planeEntityHorizontal);

      this.planeEntityVertical = new Entity({
        position: center,
        plane: {
          plane: new CallbackProperty(this.createPlaneUpdateFunction(this.planeVertical), false),
          dimensions: new Cartesian2(440000.0, PLANE_HEIGHT),
          material: Color.WHITE.withAlpha(0.1),
          outline: true,
          outlineColor: Color.WHITE,
        },
        properties: {
          type: 'vertical'
        }
      });
      this.slicerDataSource.entities.add(this.planeEntityVertical);
      globe.clippingPlanes = this.createClippingPlanes(this.planeEntityHorizontal.computeModelMatrix(new Date()));

      const primitives = this.viewer.scene.primitives;
      for (let i = 0, ii = primitives.length; i < ii; i++) {
        const primitive = primitives.get(i);
        if (primitive.root && primitive.boundingSphere) {
          const tileCenter = Cartographic.fromCartesian(primitive.boundingSphere.center);
          const lat = CMath.toDegrees(cartCenter.latitude);
          const lon = CMath.toDegrees(cartCenter.longitude);
          const tileLat = CMath.toDegrees(tileCenter.latitude);
          const tileLon = CMath.toDegrees(tileCenter.longitude);
          const lv95Center = degreesToLv95([lon, lat]);
          const lv95Tile = degreesToLv95([tileLon, tileLat]);
          const offsetX = lv95Center[1] - lv95Tile[1];
          const offsetY = lv95Center[0] - lv95Tile[0];
          this.offsets[primitive.url] = {
            offsetX: -offsetX,
            offsetY: -offsetY
          };

          primitive.clippingPlanes = this.createClippingPlanes();
        }
      }

      if (!this.eventHandler) {
        this.eventHandler = new ScreenSpaceEventHandler(this.viewer.canvas);
        this.eventHandler.setInputAction(this.onLeftDown.bind(this), ScreenSpaceEventType.LEFT_DOWN);
        this.eventHandler.setInputAction(this.onMouseMove.bind(this), ScreenSpaceEventType.MOUSE_MOVE);
        this.eventHandler.setInputAction(this.onLeftUp.bind(this), ScreenSpaceEventType.LEFT_UP);
        const syncPlanes = this.movePlane.bind(this);
        this.onTickRemove = this.viewer.scene.postRender.addEventListener(syncPlanes);
      }
    } else {
      this.slicerDataSource.entities.removeAll();
      this.offsets = {};
      this.planeHorizontal = null;
      this.planeVertical = null;

      this.eventHandler.destroy();
      this.eventHandler = null;
      this.onTickRemove();

      globe.clippingPlanes.enabled = false;
      globe.clippingPlanes = undefined;

      this.targetY = 0.0;
      this.targetX = 0.0;

      const primitives = this.viewer.scene.primitives;
      for (let i = 0, ii = primitives.length; i < ii; i++) {
        const primitive = primitives.get(i);
        if (primitive.clippingPlanes) {
          primitive.clippingPlanes.enabled = false;
          primitive.clippingPlanes = undefined;
        }
      }
    }
    this.viewer.scene.requestRender();
  }

  get active() {
    return this.eventHandler !== null;
  }

  movePlane() {
    this.updateClippingPlanes(this.viewer.scene.globe.clippingPlanes);
    const primitives = this.viewer.scene.primitives;
    for (let i = 0; i < primitives.length; i++) {
      const primitive = primitives.get(i);
      if (primitive.clippingPlanes) {
        this.updateClippingPlanes(primitive.clippingPlanes, this.offsets[primitive.url]);
      }
    }
  }

  /**
   * @param {Matrix4=} modelMatrix
   */
  createClippingPlanes(modelMatrix) {
    const clippingPlanes = new ClippingPlaneCollection({
      modelMatrix: modelMatrix,
      planes: [this.planeHorizontal, this.planeVertical],
      edgeWidth: 1.0,
      unionClippingRegions: true
    });
    return clippingPlanes;
  }

  updateClippingPlanes(clippingPlanes, offset) {
    clippingPlanes.removeAll();
    if (offset) {
      const planeHorizontal = Plane.clone(this.planeHorizontal);
      planeHorizontal.distance = planeHorizontal.distance + offset.offsetX;
      const planeVertical = Plane.clone(this.planeVertical);
      planeVertical.distance = planeVertical.distance + offset.offsetY;
      clippingPlanes.add(planeHorizontal);
      clippingPlanes.add(planeVertical);
    } else {
      clippingPlanes.add(this.planeHorizontal);
      clippingPlanes.add(this.planeVertical);
    }
  }

  onLeftDown(event) {
    const pickedObject = this.viewer.scene.pick(event.position);
    if (pickedObject && pickedObject.id) {
      this.selectedPlane = pickedObject.id;
      this.viewer.scene.screenSpaceCameraController.enableInputs = false;
    }
  }

  onLeftUp() {
    if (this.selectedPlane) {
      this.selectedPlane = null;
      this.viewer.scene.screenSpaceCameraController.enableInputs = true;
    }
  }

  onMouseMove(movement) {
    if (this.selectedPlane) {
      const rayStart = this.viewer.camera.getPickRay(movement.startPosition);
      const intersectionStart = this.viewer.scene.globe.pick(rayStart, this.viewer.scene);

      const rayEnd = this.viewer.camera.getPickRay(movement.endPosition);
      const intersectionEnd = this.viewer.scene.globe.pick(rayEnd, this.viewer.scene);

      if (!intersectionStart || !intersectionEnd) return;
      const distance = Cartesian3.distance(intersectionStart, intersectionEnd);
      const diff = Cartesian3.subtract(intersectionEnd, intersectionStart, new Cartesian3());
      if (this.selectedPlane.properties.type.getValue() === 'horizontal') {
        const negative = (diff.x + diff.y) > 0 ? 1 : -1;
        this.targetY += distance * negative;
      } else {
        const negative = (diff.x + diff.y) < 0 ? 1 : -1;
        this.targetX += distance * negative;
      }
    }
  }

  /**
   * @param {Plane} plane
   * @param {'horizontal' | 'vertical' }type
   */
  createPlaneUpdateFunction(plane, type) {
    return () => {
      if (type === 'horizontal') {
        plane.distance = this.targetY;
      } else {
        plane.distance = this.targetX;
      }
      return plane;
    };
  }
}
