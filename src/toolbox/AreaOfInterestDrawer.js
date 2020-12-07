import ScreenSpaceEventType from 'cesium/Source/Core/ScreenSpaceEventType';
import Cartesian3 from 'cesium/Source/Core/Cartesian3';
import CustomDataSource from 'cesium/Source/DataSources/CustomDataSource';
import KmlDataSource from 'cesium/Source/DataSources/KmlDataSource';
import GpxDataSource from '../GpxDataSource.js';
import getTemplate from './areaOfInterestTemplate.js';
import i18next from 'i18next';
import {getMeasurements} from '../utils.js';
import JulianDate from 'cesium/Source/Core/JulianDate';

import {html, LitElement} from 'lit-element';

import {
  AOI_DATASOURCE_NAME,
  DEFAULT_AOI_COLOR,
  DEFAULT_VOLUME_HEIGHT_LIMITS,
  AOI_POINT_SYMBOLS, HIGHLIGHTED_AOI_COLOR
} from '../constants.js';
import {updateColor, cleanupUploadedEntity, getUploadedEntityType} from './helpers.js';
import {showWarning} from '../message.js';
import {I18nMixin} from '../i18n';
import {CesiumDraw} from '../draw/CesiumDraw.js';
import ScreenSpaceEventHandler from 'cesium/Source/Core/ScreenSpaceEventHandler';
import BoundingSphere from 'cesium/Source/Core/BoundingSphere';
import HeadingPitchRange from 'cesium/Source/Core/HeadingPitchRange';
import NearFarScalar from 'cesium/Source/Core/NearFarScalar';
import {applyLimits, updateHeightForCartesianPositions} from '../utils';
import Cartesian2 from 'cesium/Source/Core/Cartesian2';
import CornerType from 'cesium/Source/Core/CornerType';
import {showMessage} from '../message';
import Color from 'cesium/Source/Core/Color';
import VerticalOrigin from 'cesium/Source/Scene/VerticalOrigin';
import {DEFAULT_AOI_VOLUME_COLOR} from '../constants';
import HeightReference from 'cesium/Source/Scene/HeightReference';

class NgmAreaOfInterestDrawer extends I18nMixin(LitElement) {

  static get properties() {
    return {
      viewer: {type: Object},
      selectedArea_: {type: Object},
      slicer: {type: Object}
    };
  }

  constructor() {
    super();
    this.minVolumeHeight = 1;
    this.maxVolumeHeight = 30000;
    this.minVolumeLowerLimit = -30000;
    this.maxVolumeLowerLimit = 30000;
    this.julianDate = new JulianDate();
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
    this.areasCounter_ = {
      line: 0,
      point: 0,
      rectangle: 0,
      polygon: 0
    };
    this.areasClickable = true;
    this.draw_ = new CesiumDraw(this.viewer, 'polygon', {
      fillColor: DEFAULT_AOI_COLOR
    });
    this.draw_.active = false;
    this.interestAreasDataSource = new CustomDataSource(AOI_DATASOURCE_NAME);
    this.viewer.dataSources.add(this.interestAreasDataSource);
    this.editedBackup = undefined;

    this.draw_.addEventListener('drawend', this.endDrawing_.bind(this));
    this.draw_.addEventListener('statechanged', () => this.requestUpdate());
    this.draw_.addEventListener('drawerror', evt => {
      if (this.draw_.ERROR_TYPES.needMorePoints === evt.detail.error) {
        showWarning(i18next.t('tbx_error_need_more_points_warning'));
      }
    });
    this.draw_.addEventListener('leftdown', () => {
      const volumeShowedProp = this.draw_.entityForEdit.properties.volumeShowed;
      if (volumeShowedProp && volumeShowedProp.getValue()) {
        this.draw_.entityForEdit.polylineVolume.show = false; // to avoid jumping when mouse over entity
      }
    });
    this.draw_.addEventListener('leftup', () => {
      const volumeShowedProp = this.draw_.entityForEdit.properties.volumeShowed;
      if (volumeShowedProp && volumeShowedProp.getValue()) {
        this.updateEntityVolume(this.draw_.entityForEdit.id);
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
    this.sectionImageUrl = null;

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
      numberOfSegments: measurements.segmentsNumber,
      type: type
    };
    this.areasCounter_[type] = this.areasCounter_[type] + 1;
    this.addAreaEntity(attributes);
    this.enableToolButtons();
  }

  cancelDraw() {
    if (this.editedBackup) {
      this.draw_.entityForEdit.properties = this.editedBackup.properties;
      if (this.draw_.type === 'point') {
        this.draw_.entityForEdit.position = this.editedBackup.positions;
        this.draw_.entityForEdit.billboard.color = this.editedBackup.color;
        this.draw_.entityForEdit.billboard.image = this.editedBackup.image;
      } else if (this.draw_.type === 'line') {
        this.draw_.entityForEdit.polyline.positions = this.editedBackup.positions;
      } else {
        this.draw_.entityForEdit.polygon.hierarchy = this.editedBackup.positions;
      }
      if (this.editedBackup.properties.volumeShowed) {
        this.updateEntityVolume(this.draw_.entityForEdit.id);
      }
      this.draw_.entityForEdit.name = this.editedBackup.name;
    }
    this.editedBackup = undefined;
    this.draw_.active = false;
    this.draw_.clear();
    if (this.unlistenEditPostRender) {
      this.unlistenEditPostRender();
    }
    this.enableToolButtons();
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
    if (this.selectedArea_ && !this.draw_.entityForEdit) {
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
      const item = {
        id: val.id,
        name: val.name,
        show: val.isShowing,
        positions: this.getAreaPositions(val),
        selected: this.selectedArea_ && this.selectedArea_.id === val.id,
        area: val.properties.area ? val.properties.area.getValue() : undefined,
        perimeter: val.properties.perimeter ? val.properties.perimeter.getValue() : undefined,
        sidesLength: val.properties.sidesLength ? val.properties.sidesLength.getValue() : undefined,
        numberOfSegments: val.properties.numberOfSegments ? val.properties.numberOfSegments.getValue() : undefined,
        type: val.properties.type ? val.properties.type.getValue() : undefined,
        volumeShowed: val.properties.volumeShowed ? val.properties.volumeShowed.getValue() : undefined,
        volumeHeightLimits: val.properties.volumeHeightLimits ? val.properties.volumeHeightLimits.getValue() : undefined,
        description: val.properties.description ? val.properties.description.getValue() : '',
        image: val.properties.image ? val.properties.image.getValue() : '',
        website: val.properties.website ? val.properties.website.getValue() : '',
      };
      if (val.billboard) {
        item.pointColor = val.billboard.color.getValue(this.julianDate);
        item.pointSymbol = val.billboard.image.getValue(this.julianDate);
      }
      return item;
    });
  }

  getAreaPositions(area) {
    if (area.polygon && area.polygon.hierarchy) {
      return area.polygon.hierarchy.getValue().positions;
    } else if (area.polyline && area.polyline.positions) {
      return area.polyline.positions.getValue();
    } else if (area.billboard && area.position) {
      return [area.position.getValue(this.julianDate)];
    }
    return undefined;
  }

  onShowHideEntityClick_(evt, id) {
    const entity = this.interestAreasDataSource.entities.getById(id);
    entity.show = evt.target.checked;
  }

  onRemoveEntityClick_(id) {
    this.interestAreasDataSource.entities.removeById(id);
  }

  onAddAreaClick_(type) {
    this.draw_.type = type;
    this.draw_.active = true;
    this.disableToolButtons();
  }

  flyToArea(id) {
    const entity = this.interestAreasDataSource.entities.getById(id);
    if (!entity.isShowing) {
      entity.show = true;
    }
    const positions = this.getAreaPositions(entity);
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

  async uploadFile_(evt) {
    const file = evt.target ? evt.target.files[0] : null;
    if (file) {
      evt.target.value = null;
      if (file.name.toLowerCase().endsWith('.kml')) {
        return this.uploadKml_(file);
      } else if (file.name.toLowerCase().endsWith('.gpx')) {
        return this.uploadGpx_(file);
      } else {
        showWarning(i18next.t('tbx_unsupported_file_warning'));
        return;
      }
    }
  }

  async uploadKml_(file) {
    const kmlDataSource = await KmlDataSource.load(file, {
      camera: this.viewer.scene.camera,
      canvas: this.viewer.scene.canvas,
      clampToGround: true
    });

    let entities = kmlDataSource.entities.values;
    if (entities.length > 10) {
      showWarning(i18next.t('tbx_kml_large_warning'));
      entities = entities.slice(0, 10);
    }
    let atLeastOneValid = false;
    entities.forEach((ent, index) => {
      const exists = this.interestAreasDataSource.entities.getById(ent.id);
      if (!exists) {
        const type = getUploadedEntityType(ent);
        if (type) {
          atLeastOneValid = true;
          ent = cleanupUploadedEntity(ent);
          if (type === 'point') {
            ent.point = {
              pixelSize: 8,
              scaleByDistance: new NearFarScalar(0, 1, 1, 1)
            };
          }
          ent.name = ent.name ? `${ent.name}` : `${kmlDataSource.name}`;
          ent.properties = this.getAreaProperties(ent, type);
          if (ent.polygon) {
            ent.polygon.fill = true;
          }
          updateColor(ent, false);
          this.interestAreasDataSource.entities.add(ent);
        }
      } else {
        atLeastOneValid = true;
        showWarning(i18next.t('tbx_kml_area_existing_warning'));
      }
    });

    if (!atLeastOneValid) {
      showWarning(i18next.t('tbx_unsupported_kml_warning'));
    } else {
      this.viewer.zoomTo(entities);
    }
  }

  async uploadGpx_(file) {
    const gpxDataSource = await GpxDataSource.load(file, {
      clampToGround: true
    });
    const entities = gpxDataSource.entities.values;
    entities.forEach(entity => {
      if (!this.interestAreasDataSource.entities.getById(entity.id)) {
        const type = getUploadedEntityType(entity);
        entity = cleanupUploadedEntity(entity);

        if (type === 'point') {
          entity.billboard = {
            heightReference: HeightReference.CLAMP_TO_GROUND,
            image: `./images/${AOI_POINT_SYMBOLS[0]}`,
            color: Color.GRAY,
            scale: 0.5,
            verticalOrigin: VerticalOrigin.BOTTOM,
            disableDepthTestDistance: 0
          };
        }
        entity.name = entity.name || gpxDataSource.name;
        entity.properties = this.getAreaProperties(entity, type);
        updateColor(entity, false);
        this.interestAreasDataSource.entities.add(entity);
      }
    });
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
      const splittedName = area.name.split(' ');
      const areaNumber = Number(splittedName[1]);
      if (splittedName[0] !== 'Area' && !isNaN(areaNumber) && areaNumber > this.areasCounter_[area.type]) {
        this.areasCounter_[area.type] = areaNumber;
      }
      const entity = this.addAreaEntity(area);
      if (area.volumeShowed) {
        this.updateEntityVolume(entity.id);
      }
      if (area.selected) {
        this.pickArea_(entity.id);
      }
    });
  }

  getInfoProps(props) {
    const attributes = {
      [i18next.t('obj_info_name_label')]: props.name,
      zoom: () => this.flyToArea(props.id)
    };
    if (props.type === 'rectangle' || props.type === 'polygon') {
      attributes[i18next.t('obj_info_area_label')] = `${props.area}km²`;
      attributes[i18next.t('obj_info_perimeter_label')] = `${props.perimeter}km`;
      attributes[i18next.t('obj_info_number_segments_label')] = props.numberOfSegments;
    } else if (props.type === 'line') {
      attributes[i18next.t('obj_info_length_label')] = `${props.perimeter}km`;
    }
    if (props.description && props.description.length) {
      attributes[i18next.t('obj_info_description_label')] = props.description;
    }
    if (props.image && props.image.length) {
      attributes[i18next.t('obj_info_image_label')] = html`<img src="${props.image}" alt="${props.image}">`;
    }
    if (props.website && props.website.length) {
      attributes[i18next.t('obj_info_website_label')] =
        html`<a href="${props.website}" target="_blank" rel="noopener">${props.website}</a`;
    }
    return attributes;
  }

  getIconClass(id, inverted = false) {
    const entity = this.interestAreasDataSource.entities.getById(id);
    const type = entity.properties.type ? entity.properties.type.getValue() : undefined;
    let volume = entity.properties.volumeShowed ? entity.properties.volumeShowed.getValue() : undefined;
    if (inverted) {
      volume = !volume;
    }
    switch (type) {
      case 'polygon':
        return volume ? 'cube icon' : 'draw polygon icon';
      case 'rectangle':
        return volume ? 'cube icon' : 'vector square icon';
      case 'line':
        return volume ? 'map outline icon' : 'route icon';
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
       type: string<point | line | rectangle | polygon>
       description: string,
       image: string,
       website: string,
       pointSymbol: (optional) string,
       pointColor: (optional) Color,
   * }
   */
  addAreaEntity(attributes) {
    const type = attributes.type;
    const name = type.charAt(0).toUpperCase() + type.slice(1);
    const entityAttrs = {
      name: attributes.name || `${name} ${this.areasCounter_[type]}`,
      show: typeof attributes.show === 'boolean' ? attributes.show : true,
      properties: {
        area: attributes.area,
        perimeter: attributes.perimeter,
        numberOfSegments: attributes.numberOfSegments,
        sidesLength: attributes.sidesLength || [],
        type: type,
        volumeShowed: attributes.volumeShowed || false,
        volumeHeightLimits: attributes.volumeHeightLimits || DEFAULT_VOLUME_HEIGHT_LIMITS,
        description: attributes.description || '',
        image: attributes.image || '',
        website: attributes.website || ''
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
      entityAttrs.billboard = {
        image: attributes.pointSymbol || `./images/${AOI_POINT_SYMBOLS[0]}`,
        color: attributes.pointColor || Color.GRAY,
        scale: 0.5,
        verticalOrigin: VerticalOrigin.BOTTOM,
        disableDepthTestDistance: 0
      };
    }
    return this.interestAreasDataSource.entities.add(entityAttrs);
  }

  showSectionModal(imageUrl) {
    this.sectionImageUrl = imageUrl;
    this.requestUpdate();
  }

  showAreaInfo(areaAttrs) {
    const objectInfo = document.querySelector('ngm-object-information');
    objectInfo.info = this.getInfoProps(areaAttrs);
    objectInfo.opened = !!areaAttrs;
    this.pickArea_(areaAttrs.id);
  }

  onAreaClick(event) {
    if (event.target && event.target.type === 'checkbox') {
      event.cancelBubble = true;
    }
  }

  get drawState() {
    return this.draw_.active;
  }

  editAreaPosition(id) {
    this.disableToolButtons();
    this.pickArea_(id);
    const entity = this.interestAreasDataSource.entities.getById(id);
    const type = entity.properties.type.getValue();
    if (!entity.isShowing) {
      entity.show = !entity.isShowing;
    }

    this.draw_.entityForEdit = entity;
    this.draw_.type = type;
    this.draw_.active = true;

    this.editedBackup = {
      name: entity.name,
      properties: {...this.getAreaProperties(entity, type)}
    };

    if (type === 'point') {
      const position = entity.position.getValue(this.julianDate);
      this.editedBackup.positions = Cartesian3.clone(position);
      this.editedBackup.color = entity.billboard.color.getValue(this.julianDate);
      this.editedBackup.image = entity.billboard.image.getValue(this.julianDate);
    } else if (type === 'line') {
      this.editedBackup.positions = entity.polyline.positions.getValue().map(p => Cartesian3.clone(p));
    } else {
      const hierarchy = entity.polygon.hierarchy.getValue();
      // this is hackish: the hierarchy should not be stored as a positions.
      this.editedBackup.positions = {
        positions: hierarchy.positions.map(p => Cartesian3.clone(p)),
        holes: hierarchy.holes ? hierarchy.holes.map(p => Cartesian3.clone(p)) : []
      };
    }
  }

  saveEditing() {
    this.editedBackup = undefined;
    const type = this.draw_.entityForEdit.properties.type.getValue();
    this.draw_.entityForEdit.properties = this.getAreaProperties(this.draw_.entityForEdit, type);
    this.cancelDraw();
  }

  disableToolButtons() {
    this.querySelectorAll('.ngm-aoi-areas .ngm-aoi-content button').forEach(button => button.classList.add('disabled'));
  }

  enableToolButtons() {
    this.querySelectorAll('.ngm-aoi-areas .ngm-aoi-content button').forEach(button => button.classList.remove('disabled'));
  }

  /**
   * Returns properties for area of interes according to area type
   * @param entity
   * @param {'point' | 'line' | 'rectangle' | 'polygon'} type
   * @return {{area: any, numberOfSegments: number, perimeter: any, sidesLength: any}|{type: *}}
   */
  getAreaProperties(entity, type) {
    const props = {};
    if (entity.properties) {
      entity.properties.propertyNames.forEach(propName => {
        const property = entity.properties[propName];
        props[propName] = property ? property.getValue() : undefined;
      });
    }
    if (type === 'point') {
      return {
        ...props,
        type: type
      };
    }
    const positions = type === 'line' ? entity.polyline.positions.getValue() : entity.polygon.hierarchy.getValue().positions;
    const distances = [];
    positions.forEach((p, key) => {
      if (key > 0) {
        distances.push(Cartesian3.distance(positions[key - 1], p) / 1000);
      }
    });

    const measurements = getMeasurements(positions, distances, type);
    return {
      ...props,
      type: type,
      area: measurements.area,
      perimeter: measurements.perimeter,
      numberOfSegments: measurements.segmentsNumber,
      sidesLength: measurements.sidesLength,
    };
  }

  updateEntityVolume(id, showHint = false) {
    const entity = this.interestAreasDataSource.entities.getById(id);
    const type = entity.properties.type.getValue();
    let positions;
    if (type === 'line') {
      positions = [...entity.polyline.positions.getValue()];
      entity.polyline.show = false;
    } else {
      positions = [...entity.polygon.hierarchy.getValue().positions];
      positions.push(positions[0]);
      entity.polygon.show = false;
    }

    if (!entity.properties.volumeShowed || !entity.properties.volumeHeightLimits) {
      entity.properties.addProperty('volumeHeightLimits', DEFAULT_VOLUME_HEIGHT_LIMITS);
      entity.properties.addProperty('volumeShowed', true);
    } else {
      entity.properties.volumeShowed = true;
    }
    const color = this.selectedArea_ && this.selectedArea_.id === id ?
      HIGHLIGHTED_AOI_COLOR : DEFAULT_AOI_VOLUME_COLOR;
    entity.polylineVolume = {
      cornerType: CornerType.MITERED,
      outline: true,
      outlineColor: color,
      material: color
    };
    this.updateVolumePositions(entity, positions);
    entity.polylineVolume.show = true;

    if (showHint) {
      showMessage(i18next.t('tbx_volume_hint'));
    }
  }

  hideVolume(id) {
    const entity = this.interestAreasDataSource.entities.getById(id);
    if (entity.polyline) {
      entity.polyline.show = true;
    } else {
      entity.polygon.show = true;
    }
    entity.polylineVolume.show = false;
    entity.properties.volumeShowed = false;
  }

  get volumeHeightLimits() {
    const entity = this.draw_.entityForEdit;
    if (!entity || !entity.properties.volumeHeightLimits) {
      return DEFAULT_VOLUME_HEIGHT_LIMITS;
    }
    return entity.properties.volumeHeightLimits.getValue();
  }

  onVolumeHeightLimitsChange(index) {
    if (!this.draw_.entityForEdit) {
      return;
    }
    const entity = this.draw_.entityForEdit;
    const limitInput = this.querySelector(`.ngm-lower-limit-input-${index}`);
    const heightInput = this.querySelector(`.ngm-volume-height-input-${index}`);
    const lowerLimit = applyLimits(Number(limitInput.value), this.minVolumeLowerLimit, this.maxVolumeLowerLimit);
    const height = applyLimits(Number(heightInput.value), this.minVolumeHeight, this.maxVolumeHeight);
    limitInput.value = lowerLimit;
    heightInput.value = height;
    entity.properties.volumeHeightLimits = {lowerLimit, height};
    const positions = entity.polylineVolume.positions.getValue();
    this.updateVolumePositions(entity, positions);
  }

  updateVolumePositions(entity, positions) {
    const volumeHeightLimits = entity.properties.volumeHeightLimits.getValue();
    entity.polylineVolume.positions = updateHeightForCartesianPositions(this.viewer.scene, positions, volumeHeightLimits.lowerLimit);
    entity.polylineVolume.shape = [
      new Cartesian2(0, 0),
      new Cartesian2(0, 0),
      new Cartesian2(1, 0),
      new Cartesian2(0, volumeHeightLimits.height),
    ];
  }

  onNameInputChange(index) {
    const nameElem = this.querySelector(`.ngm-aoi-name-input-${index}`);
    const entity = this.draw_.entityForEdit;
    entity.name = nameElem.value;
  }

  onDescriptionChange(index) {
    const descriptionElem = this.querySelector(`.ngm-aoi-description-${index}`);
    const entity = this.draw_.entityForEdit;
    if (entity.properties.description) {
      entity.properties.description = descriptionElem.value;
    } else {
      entity.properties.addProperty('description', descriptionElem.value);
    }
  }

  onImageChange(index) {
    const imageElem = this.querySelector(`.ngm-aoi-image-${index}`);
    const entity = this.draw_.entityForEdit;
    if (entity.properties.image) {
      entity.properties.image = imageElem.value;
    } else {
      entity.properties.addProperty('image', imageElem.value);
    }
  }

  onWebsiteChange(index) {
    const websiteElem = this.querySelector(`.ngm-aoi-website-${index}`);
    const entity = this.draw_.entityForEdit;
    if (entity.properties.website) {
      entity.properties.website = websiteElem.value;
    } else {
      entity.properties.addProperty('website', websiteElem.value);
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
