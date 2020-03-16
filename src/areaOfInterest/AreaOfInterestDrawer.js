import ScreenSpaceEventHandler from 'cesium/Core/ScreenSpaceEventHandler.js';
import ScreenSpaceEventType from 'cesium/Core/ScreenSpaceEventType.js';
import Cartographic from 'cesium/Core/Cartographic.js';
import Rectangle from 'cesium/Core/Rectangle.js';
import Cartesian3 from 'cesium/Core/Cartesian3.js';
import Ellipsoid from 'cesium/Core/Ellipsoid.js';
import CallbackProperty from 'cesium/DataSources/CallbackProperty.js';
import CustomDataSource from 'cesium/DataSources/CustomDataSource.js';
import KmlDataSource from 'cesium/DataSources/KmlDataSource.js';
import Entity from 'cesium/DataSources/Entity.js';
import defined from 'cesium/Core/defined.js';
import {render} from 'lit-html';
import getTemplate from './areaOfInterestTemplate.js';
import i18next from 'i18next';
import {DEFAULT_AOI_COLOR, CESIUM_NOT_GRAPHICS_ENTITY_PROPS, AOI_DATASOURCE_NAME} from '../constants.js';
import {updateColor} from './helpers.js';
import {showWarning} from '../message.js';

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
    this.areasCounter_ = 0;

    this.getAreaLocation = new CallbackProperty(this.getAreaLocationCallback_.bind(this), false);

    this.screenSpaceEventHandler_.setInputAction(this.onClick_.bind(this), ScreenSpaceEventType.LEFT_CLICK);

    this.interestAreasDataSource = new CustomDataSource(AOI_DATASOURCE_NAME);
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


    this.areasCounter_ = this.areasCounter_ + 1;
    this.area_ = this.interestAreasDataSource.entities.add({
      selectable: false,
      show: false,
      name: `Area ${this.areasCounter_}`,
      rectangle: {
        coordinates: this.getAreaLocation,
        material: DEFAULT_AOI_COLOR
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

    if (this.drawMode_) {
      this.cancelDraw_();
    }

    if (this.areaRectangle_.width === 0 || this.areaRectangle_.height === 0) {
      this.interestAreasDataSource.entities.removeById(this.area_.id);
      this.areasCounter_ = this.areasCounter_ - 1;
      this.onAddAreaClick_();
    } else {
      this.area_.rectangle.coordinates = this.areaRectangle_;
      this.areaRectangle_ = new Rectangle();
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
    if (!defined(pickedObject) || !pickedObject.id) return;
    if (this.interestAreasDataSource.entities.contains(pickedObject.id)) {
      this.pickArea_(pickedObject.id.id);
    } else if (this.selectedArea_) {
      updateColor(this.selectedArea_, false);
      this.selectedArea_ = null;
      this.doRender_();
    }
  }

  pickArea_(id) {
    if (this.selectedArea_ && this.selectedArea_.id === id) {
      return;
    }
    const entity = this.interestAreasDataSource.entities.getById(id);
    if (this.selectedArea_) {
      updateColor(this.selectedArea_, false);
      this.selectedArea_ = null;
    }
    this.selectedArea_ = entity;
    updateColor(this.selectedArea_, true);
  }

  doRender_() {
    const element = document.getElementById('areasOfInterest');
    render(getTemplate.call(this), element);
  }

  get entitiesList_() {
    return this.interestAreasDataSource.entities.values.map(val => {
      return {
        id: val.id,
        name: val.name,
        show: val.isShowing,
        selected: this.selectedArea_ && this.selectedArea_.id === val.id
      };
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
      this.areasCounter_ = 0;
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
    if (!entity.isShowing) {
      entity.show = !entity.isShowing;
    }
    this.viewer_.flyTo(entity);
    this.pickArea_(id);
  }

  async uploadArea_(evt) {
    const file = evt.target ? evt.target.files[0] : null;
    if (file) {
      if (!file.name.toLowerCase().includes('.kml')) {
        showWarning(i18next.t('unsupported_file_warning'));
        evt.target.value = null;
        return;
      }
      const kmlDataSource = await KmlDataSource.load(file,
        {
          camera: this.viewer_.scene.camera,
          canvas: this.viewer_.scene.canvas,
          clampToGround: true
        });
      evt.target.value = null;

      const entity = new Entity();
      kmlDataSource.entities.values.forEach(ent => entity.merge(ent));

      const notOnlyPolygon = entity.propertyNames.some(prop => !CESIUM_NOT_GRAPHICS_ENTITY_PROPS.includes(prop) && !!entity[prop]);

      if (notOnlyPolygon) {
        showWarning(i18next.t('unsupported_kml_warning'));
        return;
      }

      entity.polygon.fill = true;
      entity.polygon.material = DEFAULT_AOI_COLOR;
      this.interestAreasDataSource.entities.add(entity);
      this.viewer_.flyTo(entity);
    }
  }
}
