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
    this.targetYSouthwest = 0.0;
    this.targetXSouthwest = 0.0;
    this.targetYNortheast = 0.0;
    this.targetXNortheast = 0.0;

    this.offsets = {};
  }

  set active(value) {
    const globe = this.viewer.scene.globe;
    if (value) {
      // initialize plane based on the camera's position
      let center = pickCenter(this.viewer.scene);
      let cartCenter = Cartographic.fromCartesian(center);
      cartCenter.height = 0;
      center = Cartographic.toCartesian(cartCenter);
      if (!Rectangle.contains(globe.cartographicLimitRectangle, cartCenter)) {
        cartCenter = Rectangle.center(globe.cartographicLimitRectangle);
        center = Cartographic.toCartesian(cartCenter);
      }
      this.setInitialTargets(cartCenter);

      this.planeHorizontalDown = new ClippingPlane(new Cartesian3(0.0, 1.0, 0.0), 0.0);
      this.planeHorizontalUp = new ClippingPlane(new Cartesian3(0.0, -1.0, 0.0), 0.0);
      this.planeVerticalLeft = new ClippingPlane(new Cartesian3(1.0, 0.0, 0.0), 0.0);
      this.planeVerticalRight = new ClippingPlane(new Cartesian3(-1.0, 0.0, 0.0), 0.0);

      const horizontalEntityTemplate = {
        position: center,
        plane: {
          plane: new CallbackProperty(this.createPlaneUpdateFunction(this.planeHorizontalDown, 'horizontal'), false),
          dimensions: new Cartesian2(700000.0, PLANE_HEIGHT),
          material: Color.WHITE.withAlpha(0.1),
          outline: true,
          outlineColor: Color.WHITE,
        },
        properties: {
          type: 'horizontal'
        }
      };


      const verticalEntityTemplate = {
        position: center,
        plane: {
          plane: new CallbackProperty(this.createPlaneUpdateFunction(this.planeVerticalLeft, 'vertical'), false),
          dimensions: new Cartesian2(440000.0, PLANE_HEIGHT),
          material: Color.WHITE.withAlpha(0.1),
          outline: true,
          outlineColor: Color.WHITE,
        },
        properties: {
          type: 'vertical'
        }
      };

      this.planeEntityHorizontal = new Entity(horizontalEntityTemplate);
      this.slicerDataSource.entities.add(this.planeEntityHorizontal);

      horizontalEntityTemplate.plane.plane =
        new CallbackProperty(this.createPlaneUpdateFunction(this.planeHorizontalUp, 'horizontal-northeast'), false);
      horizontalEntityTemplate.properties.type = 'horizontal-northeast';
      this.planeEntityHorizontalUp = new Entity(horizontalEntityTemplate);
      this.slicerDataSource.entities.add(this.planeEntityHorizontalUp);

      this.planeEntityVertical = new Entity(verticalEntityTemplate);
      this.slicerDataSource.entities.add(this.planeEntityVertical);

      verticalEntityTemplate.plane.plane =
        new CallbackProperty(this.createPlaneUpdateFunction(this.planeVerticalRight, 'vertical-northeast'), false);
      verticalEntityTemplate.properties.type = 'vertical-northeast';
      this.planeEntityVerticalRight = new Entity(verticalEntityTemplate);
      this.slicerDataSource.entities.add(this.planeEntityVerticalRight);

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
            offsetX: offsetX,
            offsetY: offsetY
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
      this.planeHorizontalDown = null;
      this.planeHorizontalUp = null;
      this.planeVerticalLeft = null;
      this.planeVerticalRight = null;

      this.eventHandler.destroy();
      this.eventHandler = null;
      this.onTickRemove();

      globe.clippingPlanes.enabled = false;
      globe.clippingPlanes = undefined;

      this.targetYSouthwest = 0.0;
      this.targetXSouthwest = 0.0;
      this.targetYNortheast = 0.0;
      this.targetXNortheast = 0.0;

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
    return new ClippingPlaneCollection({
      modelMatrix: modelMatrix,
      planes: [this.planeHorizontalDown, this.planeVerticalLeft, this.planeHorizontalUp, this.planeVerticalRight],
      edgeWidth: 1.0,
      unionClippingRegions: true
    });
  }

  updateClippingPlanes(clippingPlanes, offset) {
    clippingPlanes.removeAll();
    if (offset) {
      const planeHorizontalDown = Plane.clone(this.planeHorizontalDown);
      planeHorizontalDown.distance = planeHorizontalDown.distance - offset.offsetX;

      const planeHorizontalUp = Plane.clone(this.planeHorizontalUp);
      planeHorizontalUp.distance = planeHorizontalUp.distance + offset.offsetX;

      const planeVerticalLeft = Plane.clone(this.planeVerticalLeft);
      planeVerticalLeft.distance = planeVerticalLeft.distance - offset.offsetY;

      const planeVerticalRight = Plane.clone(this.planeVerticalRight);
      planeVerticalRight.distance = planeVerticalRight.distance + offset.offsetY;

      clippingPlanes.add(planeHorizontalDown);
      clippingPlanes.add(planeHorizontalUp);
      clippingPlanes.add(planeVerticalLeft);
      clippingPlanes.add(planeVerticalRight);
    } else {
      clippingPlanes.add(this.planeHorizontalDown);
      clippingPlanes.add(this.planeVerticalLeft);
      clippingPlanes.add(this.planeHorizontalUp);
      clippingPlanes.add(this.planeVerticalRight);
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
      const type = this.selectedPlane.properties.type.getValue();
      if (type.includes('horizontal')) {
        if (type.includes('northeast')) {
          const negative = (diff.x + diff.y) > 0 ? -1 : 1;
          this.targetYNortheast += distance * negative;
        } else {
          const negative = (diff.x + diff.y) > 0 ? 1 : -1;
          this.targetYSouthwest += distance * negative;
        }
      } else {
        if (type.includes('northeast')) {
          const negative = (diff.x + diff.y) < 0 ? -1 : 1;
          this.targetXNortheast += distance * negative;
        } else {
          const negative = (diff.x + diff.y) < 0 ? 1 : -1;
          this.targetXSouthwest += distance * negative;
        }
      }
    }
  }

  /**
   * @param {Plane} plane
   * @param {string}type
   */
  createPlaneUpdateFunction(plane, type) {
    return () => {
      try {
        if (type.includes('horizontal')) {
          if (type.includes('northeast')) {
            plane.distance = this.targetYNortheast;
          } else {
            plane.distance = this.targetYSouthwest;
          }
        } else {
          if (type.includes('northeast')) {
            plane.distance = this.targetXNortheast;
          } else {
            plane.distance = this.targetXSouthwest;
          }
        }
      } catch (e) {
        console.error(e);
      }
      return plane;
    };
  }

  /**
   *
   * @param {Cartographic} viewCenter
   */
  setInitialTargets(viewCenter) {
    let viewRect = this.viewer.scene.camera.computeViewRectangle();
    const mapRect = this.viewer.scene.globe.cartographicLimitRectangle;
    if (viewRect.width > mapRect.width || viewRect.height > mapRect.height) {
      viewRect = mapRect;
    }
    const mapRectNortheast = Rectangle.northeast(mapRect);
    const lon = viewCenter.longitude + (1 / 3 * viewRect.width);
    const lat = viewCenter.latitude + (1 / 3 * viewRect.height);
    const lv95SecondPosition = degreesToLv95([CMath.toDegrees(lon), CMath.toDegrees(lat)]);
    const lv95Center = degreesToLv95([CMath.toDegrees(viewCenter.longitude), CMath.toDegrees(viewCenter.latitude)]);
    const lv95Northeast = degreesToLv95([CMath.toDegrees(mapRectNortheast.longitude), CMath.toDegrees(mapRectNortheast.latitude)]);

    let xDiffNortheast = lv95SecondPosition[0] - lv95Center[0];
    let yDiffNortheast = lv95SecondPosition[1] - lv95Center[1];

    if (lv95Center[0] + xDiffNortheast > lv95Northeast[0]) {
      xDiffNortheast = lv95Northeast[0] - lv95Center[0];
    }
    if (lv95Center[1] + yDiffNortheast > lv95Northeast[1]) {
      yDiffNortheast = lv95Northeast[1] - lv95Center[1];
    }
    this.targetYNortheast = yDiffNortheast;
    this.targetXNortheast = xDiffNortheast;
    this.targetYSouthwest = 0;
    this.targetXSouthwest = 0;
  }
}
