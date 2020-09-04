import ClippingPlaneCollection from 'cesium/Source/Scene/ClippingPlaneCollection';
import ScreenSpaceEventHandler from 'cesium/Source/Core/ScreenSpaceEventHandler';
import Plane from 'cesium/Source/Core/Plane';
import {pickCenter} from './utils.js';
import ScreenSpaceEventType from 'cesium/Source/Core/ScreenSpaceEventType';
import ClippingPlane from 'cesium/Source/Scene/ClippingPlane';
import Cartesian3 from 'cesium/Source/Core/Cartesian3';
import Cartographic from 'cesium/Source/Core/Cartographic';
import Entity from 'cesium/Source/DataSources/Entity';
import CallbackProperty from 'cesium/Source/DataSources/CallbackProperty';
import Cartesian2 from 'cesium/Source/Core/Cartesian2';
import Color from 'cesium/Source/Core/Color';
import CMath from 'cesium/Source/Core/Math';
import {degreesToLv95} from './projection';
import CustomDataSource from 'cesium/Source/DataSources/CustomDataSource';
import Rectangle from 'cesium/Source/Core/Rectangle';
import Matrix4 from 'cesium/Source/Core/Matrix4';
import Transforms from 'cesium/Source/Core/Transforms';
import KeyboardEventModifier from 'cesium/Source/Core/KeyboardEventModifier';
import HeadingPitchRoll from 'cesium/Source/Core/HeadingPitchRoll';


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
    // this.normal = new Cartesian3();

    this.offsets = {};
  }

  set active(value) {
    const globe = this.viewer.scene.globe;
    if (value) {
      const mapCenter = Rectangle.center(globe.cartographicLimitRectangle);
      let center = pickCenter(this.viewer.scene);
      // let cartCenter = Cartographic.fromCartesian(center);
      // if (Cartesian3.equals(center, this.viewer.scene.camera.positionWC)) {
      //   cartCenter = mapCenter;
      // } else {
      //   cartCenter.longitude = mapCenter.longitude;
      // }
      // center = Cartographic.toCartesian(cartCenter);

      this.normal = Cartesian3.normalize(this.planePosition, new Cartesian3());
      this.plane = new ClippingPlane(this.normal, 0.0);
      const planeAttributes = {
        dimensions: new Cartesian2(500000.0, 50000.0),
        material: Color.WHITE.withAlpha(0.3),
        outline: true,
        outlineColor: Color.WHITE
      };

      this.planeEntity = new Entity({
        position: center,
        plane: {
          ...planeAttributes,
          plane: new CallbackProperty(this.createPlaneUpdateFunction(this.plane), false),
        }
      });
      this.slicerDataSource.entities.add(this.planeEntity);

      const modelMatrix = this.planeEntity.computeModelMatrix(new Date());
      globe.clippingPlanes = this.createClippingPlanes(modelMatrix);

      const primitives = this.viewer.scene.primitives;
      for (let i = 0, ii = primitives.length; i < ii; i++) {
        const primitive = primitives.get(i);
        if (primitive.root && primitive.boundingSphere) {
          const cartCenter = Cartographic.fromCartesian(center);
          const tileCenter = Cartographic.fromCartesian(primitive.boundingSphere.center);
          const lat = CMath.toDegrees(cartCenter.latitude);
          const lon = CMath.toDegrees(cartCenter.longitude);
          const tileLat = CMath.toDegrees(tileCenter.latitude);
          const tileLon = CMath.toDegrees(tileCenter.longitude);
          const lv95Center = degreesToLv95([lon, lat]);
          const lv95Tile = degreesToLv95([tileLon, tileLat]);
          const offsetX = lv95Center[1] - lv95Tile[1];
          const offsetY = lv95Center[0] - lv95Tile[0];

          Cartesian3.distance(center, primitive.boundingSphere.center);
          this.offsets[primitive.url] = {
            offsetX: -offsetX,
            offsetY: -offsetY
          };

          primitive.clippingPlanes = this.createClippingPlanes(modelMatrix);
        }
      }
      this.movePlane();

      if (!this.eventHandler) {
        this.eventHandler = new ScreenSpaceEventHandler(this.viewer.canvas);
        this.eventHandler.setInputAction(this.onLeftDown.bind(this), ScreenSpaceEventType.LEFT_DOWN);
        this.eventHandler.setInputAction(this.onMouseMove.bind(this), ScreenSpaceEventType.MOUSE_MOVE);
        this.eventHandler.setInputAction(this.onLeftUp.bind(this), ScreenSpaceEventType.LEFT_UP);
        // this.eventHandler.setInputAction(this.onLeftDown.bind(this), ScreenSpaceEventType.LEFT_DOWN, KeyboardEventModifier.CTRL);
        // this.eventHandler.setInputAction(this.onMouseCtrlMove.bind(this), ScreenSpaceEventType.MOUSE_MOVE, KeyboardEventModifier.CTRL);
      }
    } else {
      this.slicerDataSource.entities.removeAll();
      this.offsets = {};

      this.eventHandler.destroy();
      this.eventHandler = null;

      globe.clippingPlanes.enabled = false;
      globe.clippingPlanes = undefined;

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
      planes: [this.plane],
      edgeWidth: 1.0,
      unionClippingRegions: true
    });
    return clippingPlanes;
  }

  updateClippingPlanes(clippingPlanes, offsets) {
    clippingPlanes.removeAll();
    if (offsets) {
      const plane = Plane.clone(this.plane);
      // const coef = this.rotate < 0 ? -1 : 1;
      // let offset = offsets.offsetX * coef;
      // if (this.rotate === 90 || this.rotate === -90) {
      //   offset = offsets.offsetY * coef;
      // }
      // if (this.rotate === 45 || this.rotate === -45) {
      //   offset = (offsets.offsetX + offsets.offsetY) / 2;
      // }
      // plane.distance = plane.distance + offset;
      clippingPlanes.add(plane);
    } else {
      clippingPlanes.add(this.plane);
    }
  }

  onLeftDown(movement) {
    const pickedObject = this.viewer.scene.pick(movement.position);
    if (pickedObject && pickedObject.id) {
      this.selectedPlane = pickedObject.id;
      this.viewer.scene.screenSpaceCameraController.enableInputs = false;
    }
  }

  onLeftUp(movement) {
    if (this.selectedPlane) {
      this.selectedPlane = null;
      this.viewer.scene.screenSpaceCameraController.enableInputs = true;
    }
  }

  onMouseMove(movement) {
    if (this.selectedPlane) {
      const scale = this.viewer.scene.camera.positionCartographic.height / 1000;
      const amount = (movement.endPosition.y - movement.startPosition.y) * scale;
      this.targetY += amount;
      this.movePlane();
    }
  }

  // onMouseCtrlMove(movement) {
  //   if (this.selectedPlane) {
  //     const amount = (movement.endPosition.y - movement.startPosition.y) / 100;
  //     const x = this.normal.x - amount;
  //     const y = this.normal.y + amount;
  //     Cartesian3.normalize(new Cartesian3(x, y, 0), this.normal);
  //     this.movePlane();
  //   }
  // }

  get planePosition() {
    const heading = CMath.toDegrees(this.viewer.scene.camera.heading);
    if ((heading >= 0 && heading <= 40) || (heading >= 320 && heading <= 360)) {
      this.rotate = 360;
      return new Cartesian3(0, 1, 0.0);
    } else if (heading > 40 && heading <= 75) {
      this.rotate = 45;
      return new Cartesian3(0.5, 0.5, 0.0);
    } else if (heading > 75 && heading <= 105) {
      this.rotate = 90;
      return new Cartesian3(1, 0, 0.0);
    } else if (heading > 105 && heading <= 145) {
      this.rotate = 45;
      return new Cartesian3(0.5, -0.5, 0.0);
    } else if (heading > 145 && heading <= 225) {
      this.rotate = -360;
      return new Cartesian3(0, -1, 0.0);
    } else if (heading > 225 && heading <= 245) {
      this.rotate = 45;
      return new Cartesian3(-0.5, -0.5, 0.0);
    } else if (heading > 245 && heading <= 275) {
      this.rotate = -90;
      return new Cartesian3(-1, 0.0, 0.0);
    } else if (heading > 275 && heading < 320) {
      this.rotate = 45;
      return new Cartesian3(-0.5, 0.5, 0.0);
    }
    return new Cartesian3(0, 1, 0.0);
  }

  /**
   * @param {Plane} plane
   */
  createPlaneUpdateFunction(plane) {
    return () => {
      plane.distance = this.targetY;
      return plane;
    };
  }
}
