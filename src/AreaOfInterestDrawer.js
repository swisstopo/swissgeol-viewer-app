import ScreenSpaceEventHandler from 'cesium/Core/ScreenSpaceEventHandler.js';
import ScreenSpaceEventType from 'cesium/Core/ScreenSpaceEventType.js';
import Color from 'cesium/Core/Color.js';
import KeyboardEventModifier from 'cesium/Core/KeyboardEventModifier.js';
import Cartographic from 'cesium/Core/Cartographic.js';
import Rectangle from 'cesium/Core/Rectangle.js';
import Cartesian3 from 'cesium/Core/Cartesian3.js';
import Ellipsoid from 'cesium/Core/Ellipsoid.js';
import CallbackProperty from 'cesium/DataSources/CallbackProperty.js';

export default class AreaOfInterestDrawer {
  constructor(viewer) {

    // viewer.scene.debugShowFramesPerSecond = true;
    // viewer.scene.screenSpaceCameraController.enableTranslate = false;
    // viewer.scene.screenSpaceCameraController.enableTilt = false;
    // viewer.scene.screenSpaceCameraController.enableLook = false;
    // viewer.scene.screenSpaceCameraController.enableCollisionDetection = false;
    // viewer.imageryLayers.get(0).brightness = 0.7;

    this.viewer_ = viewer;
    this.selector_ = null;
    this.rectangleSelector_ = new Rectangle();
    this.screenSpaceEventHandler_ = new ScreenSpaceEventHandler(this.viewer_.scene.canvas);
    this.cartesian_ = new Cartesian3();
    this.tempCartographic_ = new Cartographic();
    this.firstPoint_ = new Cartographic();
    this.firstPointSet_ = false;
    this.mouseDown_ = false;
    this.camera_ = this.viewer_.camera;

    //Draw the selector while the user drags the mouse while holding shift
    this.screenSpaceEventHandler_.setInputAction(this.drawSelector.bind(this, ...arguments), ScreenSpaceEventType.MOUSE_MOVE, KeyboardEventModifier.SHIFT);

    this.getSelectorLocation = new CallbackProperty(this.getSelectorLocationCallback.bind(this, ...arguments), false);

    this.screenSpaceEventHandler_.setInputAction(this.startClickShift.bind(this), ScreenSpaceEventType.LEFT_DOWN, KeyboardEventModifier.SHIFT);

    this.screenSpaceEventHandler_.setInputAction(this.endClickShift.bind(this), ScreenSpaceEventType.LEFT_UP, KeyboardEventModifier.SHIFT);

    //Hide the selector by clicking anywhere
    this.screenSpaceEventHandler_.setInputAction(this.hideSelector.bind(this), ScreenSpaceEventType.LEFT_CLICK);
  }

  startClickShift() {
    this.viewer_.scene.screenSpaceCameraController.enableTranslate = false;
    this.viewer_.scene.screenSpaceCameraController.enableTilt = false;
    this.viewer_.scene.screenSpaceCameraController.enableLook = false;
    // this.viewer_.scene.screenSpaceCameraController.enableCollisionDetection = true;

    this.selector_ = this.viewer_.entities.add({
      selectable: false,
      show: false,
      rectangle: {
        coordinates: this.getSelectorLocation,
        material: Color.BLACK.withAlpha(0.5)
      }
    });

    this.mouseDown_ = true;
    this.selector_.rectangle.coordinates = this.getSelectorLocation;
  }

  endClickShift() {
    this.viewer_.scene.screenSpaceCameraController.enableTranslate = true;
    this.viewer_.scene.screenSpaceCameraController.enableTilt = true;
    this.viewer_.scene.screenSpaceCameraController.enableLook = true;
    // this.viewer_.scene.screenSpaceCameraController.enableCollisionDetection = true;

    this.mouseDown_ = false;
    this.firstPointSet_ = false;
    this.selector_.rectangle.coordinates = this.rectangleSelector_;
  }


  hideSelector() {
    // this.selector_.show = false;
  }

  getSelectorLocationCallback(time, result) {
    return Rectangle.clone(this.rectangleSelector_, result);
  }

  drawSelector(viewer, movement) {
    if (!this.mouseDown_) {
      return;
    }

    this.cartesian_ = this.camera_.pickEllipsoid(movement.endPosition, this.viewer_.scene.globe.ellipsoid, this.cartesian_);

    if (this.cartesian_) {
      //mouse cartographic
      this.tempCartographic_ = Cartographic.fromCartesian(this.cartesian_, Ellipsoid.WGS84, this.tempCartographic_);

      if (!this.firstPointSet_) {
        Cartographic.clone(this.tempCartographic_, this.firstPoint_);
        this.firstPointSet_ = true;
      } else {
        this.rectangleSelector_.east = Math.max(this.tempCartographic_.longitude, this.firstPoint_.longitude);
        this.rectangleSelector_.west = Math.min(this.tempCartographic_.longitude, this.firstPoint_.longitude);
        this.rectangleSelector_.north = Math.max(this.tempCartographic_.latitude, this.firstPoint_.latitude);
        this.rectangleSelector_.south = Math.min(this.tempCartographic_.latitude, this.firstPoint_.latitude);
        this.selector_.show = true;
      }
    }
  }
}
