import ScreenSpaceEventType from 'cesium/Source/Core/ScreenSpaceEventType';
import Cartesian3 from 'cesium/Source/Core/Cartesian3';
import CustomDataSource from 'cesium/Source/DataSources/CustomDataSource';
import KmlDataSource from 'cesium/Source/DataSources/KmlDataSource';
import Entity from 'cesium/Source/DataSources/Entity';
import getTemplate from './areaOfInterestTemplate.js';
import i18next from 'i18next';
import {getMeasurements} from '../utils.js';

import {LitElement} from 'lit-element';

import {AOI_DATASOURCE_NAME, CESIUM_NOT_GRAPHICS_ENTITY_PROPS, DEFAULT_AOI_COLOR} from '../constants.js';
import {updateColor} from './helpers.js';
import {showWarning} from '../message.js';
import {I18nMixin} from '../i18n';
import {CesiumDraw} from '../draw/CesiumDraw.js';
import ScreenSpaceEventHandler from 'cesium/Source/Core/ScreenSpaceEventHandler';
import BoundingSphere from 'cesium/Source/Core/BoundingSphere';
import HeadingPitchRange from 'cesium/Source/Core/HeadingPitchRange';
import Color from 'cesium/Source/Core/Color';
import HeightReference from 'cesium/Source/Scene/HeightReference';

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
      this.dispatchEvent(new CustomEvent('aoi_list_changed', {
        detail: {
          entities: this.entitiesList_
        }
      }));
    });

    this.aoiInited = true;
  }

  endDrawing_(event) {
    this.draw_.active = false;
    this.draw_.clear();

    // wgs84 to Cartesian3
    const positions = Cartesian3.fromDegreesArrayHeights(event.detail.positions.flat());
    const measurements = event.detail.measurements;
    const type = event.detail.type;
    const attributes = {
      positions: positions,
      area: measurements.area,
      perimeter: measurements.perimeter,
      sidesLength: measurements.sidesLength,
      numberOfSegments: measurements.numberOfSegments,
      type: type
    };
    this.addAreaEntity(attributes);

    this.areasCounter_ += 1;

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
        positions: this.getAreaPositions(val),
        selected: this.selectedArea_ && this.selectedArea_.id === val.id,
        area: val.properties.area ? val.properties.area.getValue() : undefined,
        perimeter: val.properties.perimeter ? val.properties.perimeter.getValue() : undefined,
        sidesLength: val.properties.sidesLength ? val.properties.sidesLength.getValue() : undefined,
        numberOfSegments: val.properties.numberOfSegments ? val.properties.numberOfSegments.getValue() : undefined,
        type: val.properties.type ? val.properties.type.getValue() : undefined
      };
    });
  }

  getAreaPositions(area) {
    if (area.polygon && area.polygon.hierarchy) {
      return area.polygon.hierarchy.getValue().positions;
    } else if (area.polyline && area.polyline.positions) {
      return area.polyline.positions.getValue();
    } else if (area.point && area.position) {
      return [area.position.getValue(new Date())];
    }
    return undefined;
  }

  onShowHideEntityClick_(evt, id) {
    const entity = this.interestAreasDataSource.entities.getById(id);
    entity.show = evt.target.checked;
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

  flyToArea(id) {
    const entity = this.interestAreasDataSource.entities.getById(id);
    if (!entity.isShowing) {
      entity.show = !entity.isShowing;
    }
    const positions = entity.polygon.hierarchy.getValue().positions;
    const boundingSphere = BoundingSphere.fromPoints(positions, new BoundingSphere());
    let range = boundingSphere.radius > 1000 ? boundingSphere.radius * 2 : boundingSphere.radius * 5;
    if (range < 1000) range = 1000; // if less than 1000 it goes inside terrain
    const zoomHeadingPitchRange = new HeadingPitchRange(0, -(Math.PI / 2), range);
    this.viewer.scene.camera.flyToBoundingSphere(boundingSphere, {
      duration: 0,
      offset: zoomHeadingPitchRange
    });
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

      const positions = entity.polygon.hierarchy.getValue().positions;
      const distances = [];
      positions.forEach((p, key) => {
        if (key > 0) {
          distances.push(Cartesian3.distance(positions[key - 1], p) / 1000);
        }
      });

      const measurements = getMeasurements(positions, distances, 'polygon');
      entity.properties = {
        area: measurements.area,
        perimeter: measurements.perimeter,
        numberOfSegments: measurements.segmentsNumber,
        sidesLength: measurements.sidesLength,
        type: 'polygon',
      };

      entity.polygon.fill = true;
      entity.polygon.material = DEFAULT_AOI_COLOR;
      this.interestAreasDataSource.entities.add(entity);
      this.flyToArea(entity.id);
    }
  }

  setAreasClickable(areasClickable) {
    this.areasClickable = areasClickable;
    if (!this.areasClickable) {
      this.deselectArea();
    }
  }

  addStoredAreas(areas) {
    areas.forEach(area => {
      if (!area.positions) return;
      const areaNumber = Number(area.name.split(' ')[1]);
      if (!isNaN(areaNumber) && areaNumber > this.areasCounter_) {
        this.areasCounter_ = areaNumber;
      }
      const attributes = {
        name: area.name,
        show: area.show,
        positions: area.positions,
        area: area.area ? area.area : '-',
        perimeter: area.perimeter ? area.perimeter : '-',
        numberOfSegments: area.numberOfSegments ? area.numberOfSegments : '-',
        sidesLength: area.sidesLength ? area.sidesLength : [],
        type: area.type ? area.type : '-',
      };
      const entity = this.addAreaEntity(attributes);
      if (area.selected) {
        this.pickArea_(entity.id);
      }
    });
  }

  getInfoProps(props) {
    return {
      [i18next.t('nameLabel')]: props.name,
      [i18next.t('Area')]: `${props.area}km²`,
      [i18next.t('Perimeter')]: `${props.perimeter}km`,
      [i18next.t('numberOfSegments')]: props.numberOfSegments
    };
  }

  getIconClass(id) {
    const entity = this.interestAreasDataSource.entities.getById(id);
    const type = entity.properties.type ? entity.properties.type.getValue() : undefined;
    switch (type) {
      case 'polygon':
        return 'draw polygon icon';
      case 'rectangle':
        return 'vector square icon';
      case 'line':
        return 'route icon';
      case 'point':
        return 'map marker alternate icon';
      default:
        return '';
    }
  }


  /**
   * Adds AOI entity to data source
   * @param attributes:
   * {
       id: string,
       name: (optional) string,
       show: boolean,
       positions: Array<Cartesian3>,
       area: (optional) string | number,
       perimeter: (optional) string | number,
       sidesLength: (optional) Array<string | number>,
       numberOfSegments: (optional) number,
       type: string
   * }
   */
  addAreaEntity(attributes) {
    const type = attributes.type;
    const entityAttrs = {
      name: attributes.name || `Area ${this.areasCounter_}`,
      show: typeof attributes.show === 'boolean' ? attributes.show : true,
      properties: {
        area: attributes.area,
        perimeter: attributes.perimeter,
        numberOfSegments: attributes.segmentsNumber,
        sidesLength: attributes.sidesLength,
        type: type,
      }
    };
    if (type === 'rectangle' || type === 'polygon') {
      entityAttrs.polygon = {
        hierarchy: attributes.positions,
        material: DEFAULT_AOI_COLOR
      };
    } else if (type === 'line') {
      entityAttrs.polyline = {
        positions: attributes.positions,
        clampToGround: true,
        width: 4,
        material: DEFAULT_AOI_COLOR
      };
    } else if (type === 'point') {
      entityAttrs.position = attributes.positions[0];
      entityAttrs.point = {
        color: DEFAULT_AOI_COLOR,
        pixelSize: 6,
        heightReference: HeightReference.CLAMP_TO_GROUND
      };
    }
    return this.interestAreasDataSource.entities.add(entityAttrs);
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
