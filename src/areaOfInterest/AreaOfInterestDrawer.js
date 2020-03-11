import ScreenSpaceEventType from 'cesium/Core/ScreenSpaceEventType.js';
import Cartesian3 from 'cesium/Core/Cartesian3.js';
import CustomDataSource from 'cesium/DataSources/CustomDataSource.js';
import KmlDataSource from 'cesium/DataSources/KmlDataSource.js';
import Entity from 'cesium/DataSources/Entity.js';
import {render} from 'lit-html';
import getTemplate from './areaOfInterestTemplate.js';
import i18next from 'i18next';
import {DEFAULT_AOI_COLOR, CESIUM_NOT_GRAPHICS_ENTITY_PROPS, AOI_DATASOURCE_NAME} from '../constants.js';
import {updateColor} from './helpers.js';
import {showWarning} from '../message.js';
import {CesiumDraw} from '../draw/CesiumDraw.js';

export default class AreaOfInterestDrawer {
  constructor(viewer) {

    this.selectedArea_ = null;

    this.areasCounter_ = 0;

    this.viewer_ = viewer;

    this.draw_ = new CesiumDraw(this.viewer_, 'polygon', {
      fillColor: DEFAULT_AOI_COLOR
    });
    this.draw_.active = false;

    this.draw_.addEventListener('drawend', this.endDrawing_.bind(this));

    this.viewer_.screenSpaceEventHandler.setInputAction(this.onClick_.bind(this), ScreenSpaceEventType.LEFT_CLICK);

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

  endDrawing_(event) {
    this.draw_.active = false;
    this.draw_.clear();

    this.areasCounter_ += 1;

    // wgs84 to Cartesian3
    const positions = Cartesian3.fromDegreesArrayHeights(event.detail.positions.flat());

    this.interestAreasDataSource.entities.add({
      selectable: false,
      name: `Area ${this.areasCounter_}`,
      polygon: {
        hierarchy: positions,
        material: DEFAULT_AOI_COLOR
      }
    });

    this.doRender_();
  }

  cancelDraw_() {
    this.draw_.active = false;
    this.draw_.clear();
    this.doRender_();
  }

  onClick_(click) {
    if (!this.draw_.active) {
      const pickedObject = this.viewer_.scene.pick(click.position);
      if (pickedObject) {
        if (this.interestAreasDataSource.entities.contains(pickedObject.id)) {
          this.pickArea_(pickedObject.id.id);
        } else if (this.selectedArea_) {
          updateColor(this.selectedArea_, false);
          this.selectedArea_ = null;
          this.doRender_();
        }
      }
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
    this.draw_.active = true;
    this.doRender_();
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
