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
import {render} from 'lit-html';
import getTemplate from './areaOfInterestTemplate';
import i18next from 'i18next';

export default class AreaOfInterestDrawer {
  constructor(viewer) {
    this.viewer_ = viewer;
    this.area_ = null;
    this.areaRectangle_ = new Rectangle();
    this.screenSpaceEventHandler_ = new ScreenSpaceEventHandler(this.viewer_.scene.canvas);
    this.cartesian_ = new Cartesian3();
    this.tempCartographic_ = new Cartographic();
    this.firstPoint_ = new Cartographic();
    this.firstPointSet_ = false;
    this.camera_ = this.viewer_.camera;
    this.selectedArea_ = null;
    this.mouseDown_ = false;
    this.drawMode_ = false;
    this.defaultAreaColor = Color.BLACK.withAlpha(0.3);
    this.higlightedAreaColor = Color.YELLOW.withAlpha(0.3);

    this.screenSpaceEventHandler_.setInputAction(this.drawArea_.bind(this), ScreenSpaceEventType.MOUSE_MOVE, KeyboardEventModifier.SHIFT);

    this.getAreaLocation = new CallbackProperty(this.getAreaLocationCallback_.bind(this), false);

    this.screenSpaceEventHandler_.setInputAction(this.startDrawing_.bind(this), ScreenSpaceEventType.LEFT_DOWN, KeyboardEventModifier.SHIFT);

    this.screenSpaceEventHandler_.setInputAction(this.endDrawing_.bind(this), ScreenSpaceEventType.LEFT_UP, KeyboardEventModifier.SHIFT);

    this.screenSpaceEventHandler_.setInputAction(this.onClick_.bind(this), ScreenSpaceEventType.LEFT_CLICK);

    this.interestAreasDataSource = new CustomDataSource('interestAreas');
    this.viewer_.dataSources.add(this.interestAreasDataSource);
    this.interestAreasDataSource.entities.collectionChanged.addEventListener(() => {
      this.viewer_.scene.requestRender();
      this.doRender_();
    });
    i18next.on('languageChanged', options => {
      this.doRender_();
    });
    this.doRender_();
  }

  startDrawing_() {
    this.viewer_.scene.screenSpaceCameraController.enableTranslate = false;
    this.viewer_.scene.screenSpaceCameraController.enableTilt = false;
    this.viewer_.scene.screenSpaceCameraController.enableLook = false;
    this.viewer_.scene.screenSpaceCameraController.enableRotate = false;

    this.area_ = this.interestAreasDataSource.entities.add({
      selectable: false,
      show: false,
      rectangle: {
        coordinates: this.getAreaLocation,
        material: this.defaultAreaColor
      }
    });

    this.mouseDown_ = true;
    this.drawMode_ = true;
    this.area_.rectangle.coordinates = this.getAreaLocation;
  }

  endDrawing_() {
    this.viewer_.scene.screenSpaceCameraController.enableTranslate = true;
    this.viewer_.scene.screenSpaceCameraController.enableTilt = true;
    this.viewer_.scene.screenSpaceCameraController.enableLook = true;
    this.viewer_.scene.screenSpaceCameraController.enableRotate = true;

    this.mouseDown_ = false;
    this.firstPointSet_ = false;
    this.area_.rectangle.coordinates = this.areaRectangle_;

    if (this.drawMode_) {
      this.cancelDraw_();
    }
  }

  cancelDraw_() {
    if (this.mouseDown_) {
      this.endDrawing_();
      return;
    }
    this.drawMode_ = false;
    this.doRender_();
    this.screenSpaceEventHandler_.removeInputAction(ScreenSpaceEventType.MOUSE_MOVE);
    this.screenSpaceEventHandler_.removeInputAction(ScreenSpaceEventType.LEFT_DOWN);
    this.screenSpaceEventHandler_.removeInputAction(ScreenSpaceEventType.LEFT_UP);
  }

  getAreaLocationCallback_(time, result) {
    return Rectangle.clone(this.areaRectangle_, result);
  }

  drawArea_(movement) {
    if (!this.mouseDown_) {
      return;
    }

    this.cartesian_ = this.viewer_.scene.pickPosition(movement.endPosition);

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

  onClick_(click) {
    const pickedObject = this.viewer_.scene.pick(click.position);
    if (defined(pickedObject) && this.interestAreasDataSource.entities.contains(pickedObject.id)) {
      this.pickArea_(pickedObject.id.id);
    } else if (this.selectedArea_) {
      this.selectedArea_.rectangle.material = this.defaultAreaColor;
      this.selectedArea_ = null;
      this.doRender_();
    }
  }

  pickArea_(id) {
    const entity = this.interestAreasDataSource.entities.getById(id);
    if (this.selectedArea_) {
      this.selectedArea_.rectangle.material = this.defaultAreaColor;
      this.selectedArea_ = null;
    }
    this.selectedArea_ = entity;
    this.selectedArea_.rectangle.material = this.higlightedAreaColor;
  }

  doRender_() {
    const element = document.getElementById('areasOfInterest');
    render(getTemplate.call(this), element);
  }

  onAccordionTitleClick(evt) {
    evt.target.classList.toggle('active');
    evt.target.nextElementSibling.classList.toggle('active');
  }

  get entitiesList_() {
    return this.interestAreasDataSource.entities.values.map(val => {
      return {id: val.id, show: val.isShowing, selected: this.selectedArea_ && this.selectedArea_.id === val.id};
    });
  }

  onShowHideEntityClick_(id) {
    const entity = this.interestAreasDataSource.entities.getById(id);
    entity.show = !entity.isShowing;
  }

  onRemoveEntityClick_(id) {
    if (id) {
      this.interestAreasDataSource.entities.removeById(id);
    } else {
      this.interestAreasDataSource.entities.removeAll();
    }
  }

  onAddAreaClick_() {
    this.drawMode_ = true;
    this.doRender_();

    this.screenSpaceEventHandler_.setInputAction(this.drawArea_.bind(this), ScreenSpaceEventType.MOUSE_MOVE);
    this.screenSpaceEventHandler_.setInputAction(this.startDrawing_.bind(this), ScreenSpaceEventType.LEFT_DOWN);
    this.screenSpaceEventHandler_.setInputAction(this.endDrawing_.bind(this), ScreenSpaceEventType.LEFT_UP);
  }

  flyToArea_(id) {
    const entity = this.interestAreasDataSource.entities.getById(id);
    this.viewer_.scene.camera.flyTo({
      destination: entity.rectangle.coordinates.getValue()

    });
    this.pickArea_(id);
  }
}
