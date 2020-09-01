import ClippingPlaneCollection from 'cesium/Source/Scene/ClippingPlaneCollection';
import ScreenSpaceEventHandler from 'cesium/Source/Core/ScreenSpaceEventHandler';
import Transforms from 'cesium/Source/Core/Transforms';
import Plane from 'cesium/Source/Core/Plane';
import HeadingPitchRoll from 'cesium/Source/Core/HeadingPitchRoll';
import Matrix4 from 'cesium/Source/Core/Matrix4';
import {pickCenter} from './utils.js';
import ScreenSpaceEventType from 'cesium/Source/Core/ScreenSpaceEventType';
import KeyboardEventModifier from 'cesium/Source/Core/KeyboardEventModifier';


export default class Slicer {
  /**
   * @param {import('cesium/Source/Widgets/Viewer/Viewer').default} viewer
   */
  constructor(viewer) {

    this.viewer = viewer;

    this.plane = null;
    this.planeEntity = null;

    this.eventHandler = null;
    this.selectedPlane = null;
    this.targetY = 0.0;

    // this.plane = new ClippingPlane(new Cartesian3(0.0, 1.0, 0.0), 0.0);

    // this.planeEntity = new Entity({
    //   position: yverdon,
    //   plane: {
    //     plane: new CallbackProperty(this.createPlaneUpdateFunction(this.plane), false),
    //     dimensions: new Cartesian2(5000.0, 5000.0),
    //     material: Color.WHITE.withAlpha(0.5),
    //     outline: true,
    //     outlineColor: Color.WHITE,
    //   }
    // });
  }

  set active(value) {
    const globe = this.viewer.scene.globe;
    if (value) {
      // initialize plane based on the camera's position and heading
      const center = pickCenter(this.viewer.scene);
      const hpr = new HeadingPitchRoll(this.viewer.scene.camera.heading, 0.0, 0.0);
      this.plane = Plane.transform(Plane.ORIGIN_ZX_PLANE, Transforms.headingPitchRollToFixedFrame(center, hpr));

      // this.planeEntity = new Entity({
      //   position: center,
      //   plane: {
      //     plane: new CallbackProperty(this.createPlaneUpdateFunction(this.plane), false),
      //     dimensions: new Cartesian2(5000.0, 5000.0),
      //     material: Color.WHITE.withAlpha(0.5),
      //     outline: true,
      //     outlineColor: Color.WHITE,
      //   }
      // });
      // this.viewer.entities.add(this.planeEntity);

      globe.clippingPlanes = this.createClippingPlanes();

      const primitives = this.viewer.scene.primitives;
      for (let i = 0, ii = primitives.length; i < ii; i++) {
        const primitive = primitives.get(i);
        if (primitive.root && primitive.root.computedTransform) {
          console.log(primitive.url, primitive.root.computedTransform);
          primitive.clippingPlanes = this.createClippingPlanes(
            Matrix4.inverse(primitive.root.computedTransform, new Matrix4())
          );
        }
      }

      if (!this.eventHandler) {
        this.eventHandler = new ScreenSpaceEventHandler(this.viewer.canvas);
        this.eventHandler.setInputAction(this.onLeftDown.bind(this), ScreenSpaceEventType.LEFT_DOWN);
        this.eventHandler.setInputAction(this.onMouseMove.bind(this), ScreenSpaceEventType.MOUSE_MOVE);
        this.eventHandler.setInputAction(this.onLeftUp.bind(this), ScreenSpaceEventType.LEFT_UP);
        this.eventHandler.setInputAction(this.onCameraMove.bind(this), ScreenSpaceEventType.MOUSE_MOVE, KeyboardEventModifier.CTRL);
      }
    } else {
      // this.viewer.entities.remove(this.planeEntity);

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

  movePlane(amount) {
    this.plane.distance += amount;
    this.viewer.scene.requestRender();
  }

  /**
   * @param {Matrix4=} modelMatrix
   */
  createClippingPlanes(modelMatrix) {
    const clippingPlanes = new ClippingPlaneCollection({
      modelMatrix: modelMatrix,
      planes: [this.plane],
      edgeWidth: 1.0
    });
    return clippingPlanes;
  }

  updateClippingPlanes(clippingPlanes) {
    clippingPlanes.removeAll();
    clippingPlanes.add(this.plane); // only one for now
  }

  onLeftDown(movement) {
    this.leftBtnPressed = true;
    const pickedObject = this.viewer.scene.pick(movement.position);
    if (pickedObject) {
      this.selectedPlane = pickedObject.id.plane;
      this.viewer.scene.screenSpaceCameraController.enableInputs = false;
    }
  }

  onLeftUp(movement) {
    this.leftBtnPressed = false;
    if (this.selectedPlane) {
      this.selectedPlane = null;
      this.viewer.scene.screenSpaceCameraController.enableInputs = true;
    }
  }

  onMouseMove(movement) {
    if (this.selectedPlane) {
      this.targetY += movement.endPosition.y - movement.startPosition.y;
    }
    if (this.leftBtnPressed) {
      this.onCameraMove();
    }
  }

  onCameraMove() {
    const center = pickCenter(this.viewer.scene);
    const hpr = new HeadingPitchRoll(this.viewer.scene.camera.heading, 0.0, 0.0);
    this.plane = Plane.transform(Plane.ORIGIN_ZX_PLANE, Transforms.headingPitchRollToFixedFrame(center, hpr));
    this.updateClippingPlanes(this.viewer.scene.globe.clippingPlanes);
    const primitives = this.viewer.scene.primitives;
    for (let i = 0; i < primitives.length; i++) {
      const primitive = primitives.get(i);
      if (primitive.clippingPlanes) {
        this.updateClippingPlanes(primitive.clippingPlanes);
      }
    }
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
