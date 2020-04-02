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
import getTemplate from './areaOfInterestTemplate.js';
import i18next from 'i18next';

import {LitElement} from 'lit-element';

import {
  DEFAULT_AOI_COLOR,
  CESIUM_NOT_GRAPHICS_ENTITY_PROPS,
  AOI_DATASOURCE_NAME
} from '../constants.js';
import {updateColor} from './helpers.js';
import {showWarning} from '../message.js';
import {I18nMixin} from '../i18n';

class NgmAreaOfInterestDrawer extends I18nMixin(LitElement) {

  static get properties() {
    return {
      viewer: {type: Object},
      drawMode_: {type: Boolean},
      selectedArea_: {type: Object},
    };
  }

  update(changedProperties) {
    if (!this.aoiInited && this.viewer) {
      this.initAoi();
    }
    super.update(changedProperties);
  }

  initAoi() {
    this.area_ = null;
    this.areaRectangle_ = new Rectangle();
    this.cartesian_ = new Cartesian3();
    this.tempCartographic_ = new Cartographic();
    this.firstPoint_ = new Cartographic();
    this.firstPointSet_ = false;
    this.selectedArea_ = null;
    this.mouseDown_ = false;
    this.drawMode_ = false;
    this.areasCounter_ = 0;
    this.areasClickable = false;
    this.getAreaLocation = new CallbackProperty(this.getAreaLocationCallback_.bind(this), false);
    this.interestAreasDataSource = new CustomDataSource(AOI_DATASOURCE_NAME);
    this.viewer.dataSources.add(this.interestAreasDataSource);

    this.screenSpaceEventHandler_ = new ScreenSpaceEventHandler(this.viewer.scene.canvas);
    this.screenSpaceEventHandler_.setInputAction(this.onClick_.bind(this), ScreenSpaceEventType.LEFT_CLICK);
    this.interestAreasDataSource.entities.collectionChanged.addEventListener(() => {
      this.viewer.scene.requestRender();
      this.requestUpdate();
    });
    const sideBarElement = document.querySelector('ngm-left-side-bar');
    sideBarElement.addEventListener('ngm-aoi-closed', this.cancelDraw_.bind(this));
    sideBarElement.addEventListener('ngm-gst-closed', this.setAreasClickable.bind(this, true));
    sideBarElement.addEventListener('ngm-gst-opened', this.setAreasClickable.bind(this, false));

    this.aoiInited = true;
  }

  startDrawing_() {
    this.viewer.scene.screenSpaceCameraController.enableTranslate = false;
    this.viewer.scene.screenSpaceCameraController.enableTilt = false;
    this.viewer.scene.screenSpaceCameraController.enableLook = false;
    this.viewer.scene.screenSpaceCameraController.enableRotate = false;


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
    this.viewer.scene.screenSpaceCameraController.enableTranslate = true;
    this.viewer.scene.screenSpaceCameraController.enableTilt = true;
    this.viewer.scene.screenSpaceCameraController.enableLook = true;
    this.viewer.scene.screenSpaceCameraController.enableRotate = true;

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

    this.cartesian_ = this.viewer.scene.pickPosition(movement.endPosition);

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
    if (!this.areasClickable) return;
    const pickedObject = this.viewer.scene.pick(click.position);
    if (!defined(pickedObject) || !pickedObject.id) {
      this.deselectArea();
    } else if (this.interestAreasDataSource.entities.contains(pickedObject.id)) {
      this.pickArea_(pickedObject.id.id);
    }
  }

  deselectArea() {
    if (this.selectedArea_) {
      updateColor(this.selectedArea_, false);
      this.selectedArea_ = null;
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
    this.screenSpaceEventHandler_.setInputAction(this.drawArea_.bind(this), ScreenSpaceEventType.MOUSE_MOVE);
    this.screenSpaceEventHandler_.setInputAction(this.startDrawing_.bind(this), ScreenSpaceEventType.LEFT_DOWN);
    this.screenSpaceEventHandler_.setInputAction(this.endDrawing_.bind(this), ScreenSpaceEventType.LEFT_UP);
  }

  flyToArea_(id) {
    const entity = this.interestAreasDataSource.entities.getById(id);
    if (!entity.isShowing) {
      entity.show = !entity.isShowing;
    }
    this.viewer.flyTo(entity);
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
          camera: this.viewer.scene.camera,
          canvas: this.viewer.scene.canvas,
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
      this.viewer.flyTo(entity);
    }
  }

  setAreasClickable(areasClickable) {
    this.areasClickable = areasClickable;
    if (!this.areasClickable) {
      this.deselectArea();
    }
  }

  render() {
    if (!this.viewer) {
      return '';
    }

    return getTemplate.call(this);
  }

  createRenderRoot() {
    return this;
  }

}

customElements.define('ngm-aoi-drawer', NgmAreaOfInterestDrawer);
