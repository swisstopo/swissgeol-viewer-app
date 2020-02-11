import ScreenSpaceEventHandler from 'cesium/Core/ScreenSpaceEventHandler.js';
import ScreenSpaceEventType from 'cesium/Core/ScreenSpaceEventType.js';
import Color from 'cesium/Core/Color.js';
import KeyboardEventModifier from 'cesium/Core/KeyboardEventModifier.js';
import Cartographic from 'cesium/Core/Cartographic.js';
import Rectangle from 'cesium/Core/Rectangle.js';
import Cartesian3 from 'cesium/Core/Cartesian3.js';
import Ellipsoid from 'cesium/Core/Ellipsoid.js';
import CallbackProperty from 'cesium/DataSources/CallbackProperty.js';
import CustomDataSource from 'cesium/DataSources/CustomDataSource';
import defined from 'cesium/Core/defined';

export default class AreaOfInterestDrawer {
  constructor(viewer) {

    // viewer.scene.debugShowFramesPerSecond = true;
    // viewer.scene.screenSpaceCameraController.enableTranslate = false;
    // viewer.scene.screenSpaceCameraController.enableTilt = false;
    // viewer.scene.screenSpaceCameraController.enableLook = false;
    // viewer.scene.screenSpaceCameraController.enableCollisionDetection = false;
    // viewer.imageryLayers.get(0).brightness = 0.7;

    this.viewer_ = viewer;
    this.area_ = null;
    this.areaRectangle_ = new Rectangle();
    this.screenSpaceEventHandler_ = new ScreenSpaceEventHandler(this.viewer_.scene.canvas);
    this.cartesian_ = new Cartesian3();
    this.tempCartographic_ = new Cartographic();
    this.firstPoint_ = new Cartographic();
    this.firstPointSet_ = false;
    this.mouseDown_ = false;
    this.camera_ = this.viewer_.camera;

    this.screenSpaceEventHandler_.setInputAction(this.drawArea.bind(this, ...arguments), ScreenSpaceEventType.MOUSE_MOVE, KeyboardEventModifier.SHIFT);

    this.getAreaLocation = new CallbackProperty(this.getAreaLocationCallback.bind(this, ...arguments), false);

    this.screenSpaceEventHandler_.setInputAction(this.startDrawing.bind(this), ScreenSpaceEventType.LEFT_DOWN, KeyboardEventModifier.SHIFT);

    this.screenSpaceEventHandler_.setInputAction(this.endDrawing.bind(this), ScreenSpaceEventType.LEFT_UP, KeyboardEventModifier.SHIFT);

    this.screenSpaceEventHandler_.setInputAction(this.onClick.bind(this, ...arguments), ScreenSpaceEventType.LEFT_CLICK);

    this.interestAreasDataSource = new CustomDataSource('interestAreas');
    this.viewer_.dataSources.add(this.interestAreasDataSource);
    this.interestAreasDataSource.entities.collectionChanged.addEventListener(() => {
      this.viewer_.scene.requestRender();
    });
  }

  startDrawing() {
    this.viewer_.scene.screenSpaceCameraController.enableTranslate = false;
    this.viewer_.scene.screenSpaceCameraController.enableTilt = false;
    this.viewer_.scene.screenSpaceCameraController.enableLook = false;
    // this.viewer_.scene.screenSpaceCameraController.enableCollisionDetection = true;

    this.area_ = this.interestAreasDataSource.entities.add({
      selectable: false,
      show: false,
      rectangle: {
        coordinates: this.getAreaLocation,
        material: Color.BLACK.withAlpha(0.5)
      }
    });

    this.mouseDown_ = true;
    this.area_.rectangle.coordinates = this.getAreaLocation;
  }

  endDrawing() {
    this.viewer_.scene.screenSpaceCameraController.enableTranslate = true;
    this.viewer_.scene.screenSpaceCameraController.enableTilt = true;
    this.viewer_.scene.screenSpaceCameraController.enableLook = true;
    // this.viewer_.scene.screenSpaceCameraController.enableCollisionDetection = true;

    this.mouseDown_ = false;
    this.firstPointSet_ = false;
    this.area_.rectangle.coordinates = this.areaRectangle_;
  }


  removeAreas() {
    // this.area_.show = false;
  }

  getAreaLocationCallback(time, result) {
    return Rectangle.clone(this.areaRectangle_, result);
  }

  drawArea(viewer, movement) {
    if (!this.mouseDown_) {
      return;
    }

    this.cartesian_ = this.camera_.pickEllipsoid(movement.endPosition, this.viewer_.scene.globe.ellipsoid, this.cartesian_);

    if (this.cartesian_) {
      this.tempCartographic_ = Cartographic.fromCartesian(this.cartesian_, Ellipsoid.WGS84, this.tempCartographic_);

      if (!this.firstPointSet_) {
        Cartographic.clone(this.tempCartographic_, this.firstPoint_);
        this.firstPointSet_ = true;
      } else {
        this.areaRectangle_.east = Math.max(this.tempCartographic_.longitude, this.firstPoint_.longitude);
        this.areaRectangle_.west = Math.min(this.tempCartographic_.longitude, this.firstPoint_.longitude);
        this.areaRectangle_.north = Math.max(this.tempCartographic_.latitude, this.firstPoint_.latitude);
        this.areaRectangle_.south = Math.min(this.tempCartographic_.latitude, this.firstPoint_.latitude);
        this.area_.show = true;
        this.area_.selectable = true;
      }
    }
  }

  onClick(viewer, movement) {
    const pickedObject = this.viewer_.scene.pick(movement.position);
    if (defined(pickedObject) && this.interestAreasDataSource.entities.contains(pickedObject.id)) {
      this.interestAreasDataSource.entities.getById(pickedObject.id.id).rectangle.material = Color.YELLOW.withAlpha(0.5);
    }

  }
}
