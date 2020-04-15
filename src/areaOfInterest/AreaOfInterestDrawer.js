import ScreenSpaceEventType from 'cesium/Core/ScreenSpaceEventType.js';
import Cartesian3 from 'cesium/Core/Cartesian3.js';
import CustomDataSource from 'cesium/DataSources/CustomDataSource.js';
import KmlDataSource from 'cesium/DataSources/KmlDataSource.js';
import Entity from 'cesium/DataSources/Entity.js';
import getTemplate from './areaOfInterestTemplate.js';
import i18next from 'i18next';

import {LitElement} from 'lit-element';

import {AOI_DATASOURCE_NAME, CESIUM_NOT_GRAPHICS_ENTITY_PROPS, DEFAULT_AOI_COLOR} from '../constants.js';
import {updateColor} from './helpers.js';
import {showWarning} from '../message.js';
import {I18nMixin} from '../i18n';
import {CesiumDraw} from '../draw/CesiumDraw.js';
import ScreenSpaceEventHandler from 'cesium/Core/ScreenSpaceEventHandler.js';

class NgmAreaOfInterestDrawer extends I18nMixin(LitElement) {

  static get properties() {
    return {
      viewer: {type: Object},
      selectedArea_: {type: Object}
    };
  }

  update(changedProperties) {
    if (!this.aoiInited && this.viewer) {
      this.initAoi();
    }
    super.update(changedProperties);
  }


  disconnectedCallback() {
    if (this.screenSpaceEventHandler) {
      this.screenSpaceEventHandler.destroy();
    }
  }

  initAoi() {
    this.selectedArea_ = null;
    this.areasCounter_ = 0;
    this.areasClickable = true;
    this.draw_ = new CesiumDraw(this.viewer, 'polygon', {
      fillColor: DEFAULT_AOI_COLOR
    });
    this.draw_.active = false;
    this.interestAreasDataSource = new CustomDataSource(AOI_DATASOURCE_NAME);
    this.viewer.dataSources.add(this.interestAreasDataSource);

    this.draw_.addEventListener('drawend', this.endDrawing_.bind(this));
    this.draw_.addEventListener('statechanged', () => this.requestUpdate());
    this.draw_.addEventListener('drawerror', evt => {
      if (this.draw_.ERROR_TYPES.needMorePoints === evt.detail.error) {
        showWarning(i18next.t('error_need_more_points'));
      }
    });

    this.screenSpaceEventHandler = new ScreenSpaceEventHandler(this.viewer.canvas);
    this.screenSpaceEventHandler.setInputAction(this.onClick_.bind(this), ScreenSpaceEventType.LEFT_CLICK);
    this.interestAreasDataSource.entities.collectionChanged.addEventListener(() => {
      this.viewer.scene.requestRender();
      this.requestUpdate();
    });

    this.aoiInited = true;
  }

  endDrawing_(event) {
    this.draw_.active = false;
    this.draw_.clear();

    // wgs84 to Cartesian3
    const positions = Cartesian3.fromDegreesArrayHeights(event.detail.positions.flat());
    this.areasCounter_ += 1;
    this.interestAreasDataSource.entities.add({
      name: `Area ${this.areasCounter_}`,
      polygon: {
        hierarchy: positions,
        material: DEFAULT_AOI_COLOR
      }
    });
  }

  cancelDraw() {
    this.draw_.active = false;
    this.draw_.clear();
  }

  onClick_(click) {
    if (!this.draw_.active && this.areasClickable) {
      const pickedObject = this.viewer.scene.pick(click.position);
      if (pickedObject && pickedObject.id) { // to prevent error on tileset click
        if (this.interestAreasDataSource.entities.contains(pickedObject.id)) {
          this.pickArea_(pickedObject.id.id);
        } else if (this.selectedArea_) {
          updateColor(this.selectedArea_, false);
          this.selectedArea_ = null;
        }
      }
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

  onAddAreaClick_(type) {
    this.draw_.type = type;
    this.draw_.active = true;
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
