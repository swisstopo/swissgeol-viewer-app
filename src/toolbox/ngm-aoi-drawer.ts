import ScreenSpaceEventType from 'cesium/Source/Core/ScreenSpaceEventType';
import Cartesian3 from 'cesium/Source/Core/Cartesian3';
import CustomDataSource from 'cesium/Source/DataSources/CustomDataSource';
import KmlDataSource from 'cesium/Source/DataSources/KmlDataSource';
import GpxDataSource from '../GpxDataSource.js';
import i18next from 'i18next';
import JulianDate from 'cesium/Source/Core/JulianDate';
import HeightReference from 'cesium/Source/Scene/HeightReference';
import {Entity, Event, Viewer} from 'cesium';

import {html} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';

import {
  AOI_LINE_ALPHA,
  AOI_POINT_SYMBOLS,
  AOI_POLYGON_ALPHA,
  AVAILABLE_AOI_TYPES,
  DEFAULT_AOI_COLOR,
  DEFAULT_VOLUME_HEIGHT_LIMITS,
  HIGHLIGHTED_AOI_COLOR
} from '../constants';
import {
  getAreaPositions,
  getAreaProperties,
  getUploadedEntityType,
  updateBoreholeHeights,
  updateEntityVolume
} from './helpers';
import {showWarning} from '../notifications';
import {LitElementI18n} from '../i18n';
import {CesiumDraw} from '../draw/CesiumDraw.js';
import ScreenSpaceEventHandler from 'cesium/Source/Core/ScreenSpaceEventHandler';
import BoundingSphere from 'cesium/Source/Core/BoundingSphere';
import HeadingPitchRange from 'cesium/Source/Core/HeadingPitchRange';
import CornerType from 'cesium/Source/Core/CornerType';
import Color from 'cesium/Source/Core/Color';
import VerticalOrigin from 'cesium/Source/Scene/VerticalOrigin';
import {SwissforagesService} from './SwissforagesService';
import Cartographic from 'cesium/Source/Core/Cartographic';


import {clickOnElement, parseJson} from '../utils';
import './ngm-gst-interaction';
import './ngm-point-edit';
import {classMap} from 'lit-html/directives/class-map.js';
import './ngm-swissforages-modal';
import './ngm-swissforages-interaction';
import '../elements/ngm-geom-configuration.js';
import LocalStorageController from '../LocalStorageController';
import MainStore from '../store/main';
import ToolboxStore from '../store/toolbox';
import QueryStore from '../store/query';
import DrawStore from '../store/draw';
import {AreasCounter, NgmGeometry, SwissforagesModalOptions} from './interfaces';

const fileUploadInputId = 'fileUpload';
const DEFAULT_SWISSFORAGES_MODAL_OPTIONS = {
  name: undefined,
  id: undefined,
  position: undefined,
  onLoggedIn: undefined,
  onSwissforagesBoreholeCreated: undefined,
  show: false
};

const DEFAULT_AREAS_COUNTER = {
  line: 0,
  point: 0,
  rectangle: 0,
  polygon: 0
};

@customElement('ngm-aoi-drawer')
export class NgmAreaOfInterestDrawer extends LitElementI18n {
  @property({type: Boolean}) downloadActiveDataEnabled = false;
  @property({type: Object}) geometriesDataSource: CustomDataSource | undefined;
  @state() selectedArea: Entity | undefined;
  minVolumeHeight = 1;
  maxVolumeHeight = 30000;
  minVolumeLowerLimit = -30000;
  maxVolumeLowerLimit = 30000;
  julianDate = new JulianDate();
  swissforagesService = new SwissforagesService();
  viewer: Viewer | null = null;
  restrictedEditing = false;
  colorBeforeHighlight: Color = DEFAULT_AOI_COLOR;
  aoiInited = false;
  private areasCounter: AreasCounter = DEFAULT_AREAS_COUNTER;
  private screenSpaceEventHandler: ScreenSpaceEventHandler | undefined;
  private draw: CesiumDraw | undefined;
  private swissforagesModalOptions: SwissforagesModalOptions = DEFAULT_SWISSFORAGES_MODAL_OPTIONS;
  private sectionImageUrl: string | undefined;
  private editedBackup;
  private areasClickable = false;
  private unlistenEditPostRender: Event.RemoveCallback | undefined;
  private drawGeometries = [
    {labelTag: 'tbx_add_point_btn_label', type: 'point', icon: 'ngm-point-draw-icon'},
    {labelTag: 'tbx_add_line_btn_label', type: 'line', icon: 'ngm-line-draw-icon'},
    {labelTag: 'tbx_add_polygon_area_btn_label', type: 'polygon', icon: 'ngm-polygon-draw-icon'},
    {labelTag: 'tbx_add_rect_area_btn_label', type: 'rectangle', icon: 'ngm-rectangle-draw-icon'},
  ];

  constructor() {
    super();
    MainStore.viewer.subscribe(viewer => this.viewer = viewer);
    ToolboxStore.geometryToCreate.subscribe(conf => {
      this.increaseAreasCounter(conf.type);
      this.addAreaEntity(conf);
    });
    QueryStore.objectInfo.subscribe(info => {
      if (!info) {
        this.deselectArea();
      }
    });
  }

  update(changedProperties) {
    this.initAoi();

    super.update(changedProperties);
  }

  disconnectedCallback() {
    if (this.screenSpaceEventHandler) {
      this.screenSpaceEventHandler.destroy();
    }
  }


  getTemplate() {
    return html`
      <div class="ngm-draw-list">
        ${this.drawGeometries.map(it => html`
          <div class="ngm-draw-list-item ${classMap({'active': this.draw!.active && it.type === this.draw!.type})}"
               @click=${() => this.onAddAreaClick(it.type)}>
            <div class=${it.icon}></div>
            <div>${i18next.t(it.labelTag)}</div>
          </div>
          <div ?hidden=${!this.draw!.active || it.type !== this.draw!.type} class="ngm-draw-hint">
            ${i18next.t('tbx_area_of_interest_add_hint')}
            <div class="ngm-info-icon"></div>
          </div>`)}
        <div class="ngm-draw-list-item" @click=${clickOnElement.bind(null, fileUploadInputId)}>
          <div class="ngm-file-upload-icon"></div>
          <div>${i18next.t('tbx_upload_btn_label')}</div>
        </div>
      </div>
      <input id="${fileUploadInputId}" type='file' accept=".kml,.KML,.gpx,.GPX" hidden
             @change=${this.uploadFile_.bind(this)}/>
      <div class="ngm-divider"></div>
      <ngm-geometries-list
        .selectedId=${this.selectedArea ? this.selectedArea.id : ''}
        @geomclick=${(evt: CustomEvent<NgmGeometry>) => this.flyToArea(evt.detail.id)}>
      </ngm-geometries-list>
      <ngm-gst-modal .imageUrl="${this.sectionImageUrl}"></ngm-gst-modal>
      <ngm-swissforages-modal
        .service="${this.swissforagesService}"
        .options="${this.swissforagesModalOptions}">
      </ngm-swissforages-modal>
    `;
  }

  initAoi() {
    if (this.aoiInited || !this.viewer) return;
    this.selectedArea = undefined;
    this.areasCounter = {
      line: 0,
      point: 0,
      rectangle: 0,
      polygon: 0
    };
    this.areasClickable = true;
    this.draw = new CesiumDraw(this.viewer, 'polygon', {
      fillColor: DEFAULT_AOI_COLOR
    });
    this.draw.active = false;

    this.editedBackup = undefined;

    this.draw.addEventListener('statechanged', (evt) => {
      DrawStore.setDrawState((<CustomEvent>evt).detail.active);
      this.requestUpdate();
    });
    this.draw.addEventListener('drawend', (evt) => this.endDrawing_((<CustomEvent>evt).detail));
    this.draw.addEventListener('drawerror', evt => {
      if (this.draw!.ERROR_TYPES.needMorePoints === (<CustomEvent>evt).detail.error) {
        showWarning(i18next.t('tbx_error_need_more_points_warning'));
      }
    });
    this.draw.addEventListener('leftdown', () => {
      const volumeShowedProp = this.draw!.entityForEdit.properties.volumeShowed;
      const type = this.draw!.entityForEdit.properties.type.getValue();
      if (volumeShowedProp && volumeShowedProp.getValue() && type !== 'point') {
        this.draw!.entityForEdit.polylineVolume.show = false; // to avoid jumping when mouse over entity
      }
    });
    this.draw.addEventListener('leftup', () => {
      const volumeShowedProp = this.draw!.entityForEdit.properties.volumeShowed;
      const type = this.draw!.entityForEdit.properties.type.getValue();
      if (type === 'point') {
        updateBoreholeHeights(this.draw!.entityForEdit, this.julianDate);
      } else if (volumeShowedProp && volumeShowedProp.getValue()) {
        const entity = this.geometriesDataSource!.entities.getById(this.draw!.entityForEdit.id)!;
        updateEntityVolume(entity, this.viewer!.scene.globe);
      }
    });

    this.screenSpaceEventHandler = new ScreenSpaceEventHandler(this.viewer!.canvas);
    this.screenSpaceEventHandler.setInputAction(this.onClick_.bind(this), ScreenSpaceEventType.LEFT_CLICK);
    this.addStoredAreas(LocalStorageController.getStoredAoi());
    this.sectionImageUrl = undefined;
    this.swissforagesModalOptions = DEFAULT_SWISSFORAGES_MODAL_OPTIONS;

    this.aoiInited = true;
  }

  // required for gst
  showSectionModal(imageUrl) {
    this.sectionImageUrl = imageUrl;
    this.requestUpdate();
  }

  endDrawing_(info) {
    if (!this.draw) return;
    this.draw.active = false;
    this.draw.clear();

    const positions = info.positions;
    const measurements = info.measurements;
    const type = info.type;
    const attributes: NgmGeometry = {
      positions: positions,
      area: measurements.area,
      perimeter: measurements.perimeter,
      sidesLength: measurements.sidesLength,
      numberOfSegments: measurements.numberOfSegments,
      type: type,
      clampPoint: true
    };
    this.increaseAreasCounter(type);
    this.addAreaEntity(attributes);
  }

  cancelDraw() {
    if (!this.draw || (!this.draw.active && !this.restrictedEditing)) return;
    if (this.editedBackup) {
      this.draw.entityForEdit.properties = this.editedBackup.properties;
      if (this.draw.type === 'point') {
        this.draw.entityForEdit.position = this.editedBackup.positions;
        this.draw.entityForEdit.billboard.color = this.editedBackup.color;
        this.draw.entityForEdit.billboard.image = this.editedBackup.image;
      } else if (this.draw.type === 'line') {
        this.draw.entityForEdit.polyline.positions = this.editedBackup.positions;
        this.draw.entityForEdit.polyline.material = this.editedBackup.color;
      } else {
        this.draw.entityForEdit.polygon.hierarchy = this.editedBackup.positions;
        this.draw.entityForEdit.polygon.material = this.editedBackup.color;
      }
      if (this.editedBackup.properties.volumeShowed && this.draw.entityForEdit.polylineVolume) {
        const entity = this.geometriesDataSource!.entities.getById(this.draw!.entityForEdit.id)!;
        updateEntityVolume(entity, this.viewer!.scene.globe);
        this.draw.entityForEdit.polylineVolume.outlineColor = this.editedBackup.color;
        this.draw.entityForEdit.polylineVolume.material = this.editedBackup.color;
      }
      this.draw.entityForEdit.name = this.editedBackup.name;
    }
    this.editedBackup = undefined;
    this.draw.active = false;
    this.restrictedEditing = false;
    this.draw.clear();
    if (this.unlistenEditPostRender) {
      this.unlistenEditPostRender();
    }
  }

  onClick_(click) {
    if (!this.draw!.active && this.areasClickable) {
      const pickedObject = this.viewer!.scene.pick(click.position);
      if (pickedObject && pickedObject.id) { // to prevent error on tileset click
        if (this.geometriesDataSource!.entities.contains(pickedObject.id)) {
          this.pickArea_(pickedObject.id.id);
        } else if (this.selectedArea) {
          this.deselectArea();
        }
      }
    }
  }

  deselectArea() {
    if (this.selectedArea) {
      this.updateHighlight(this.selectedArea, false);
      this.selectedArea = undefined;
      QueryStore.setObjectInfo(null);
    }
  }

  pickArea_(id) {
    if (this.selectedArea && this.selectedArea.id === id) {
      return;
    }
    const entity = this.geometriesDataSource!.entities.getById(id);
    if (this.selectedArea) {
      this.deselectArea();
    }
    this.selectedArea = entity;
    this.updateHighlight(this.selectedArea, true);
  }

  // todo reuse or remove
  onShowHideEntityClick_(evt, id) {
    const entity = this.geometriesDataSource!.entities.getById(id);
    if (entity)
      entity.show = evt.target.checked;
  }

  // todo reuse or remove
  onRemoveEntityClick_(id) {
    if (this.selectedArea && id === this.selectedArea.id) {
      this.deselectArea();
    }
    this.geometriesDataSource!.entities.removeById(id);
  }

  private onAddAreaClick(type) {
    const currentType = this.draw!.type;
    if (this.draw!.active) {
      this.cancelDraw();
      if (currentType === type) return;
    }
    this.draw!.type = type;
    this.draw!.active = true;
  }

  flyToArea(id) {
    const entity = this.geometriesDataSource!.entities.getById(id);
    if (!entity) return;
    if (!entity.isShowing)
      entity.show = true;
    const positions = getAreaPositions(entity, this.julianDate);
    const boundingSphere = BoundingSphere.fromPoints(positions, new BoundingSphere());
    let range = boundingSphere.radius > 1000 ? boundingSphere.radius * 2 : boundingSphere.radius * 5;
    if (range < 1000) range = 1000; // if less than 1000 it goes inside terrain
    const zoomHeadingPitchRange = new HeadingPitchRange(0, -(Math.PI / 2), range);
    this.viewer!.scene.camera.flyToBoundingSphere(boundingSphere, {
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
        return this.uploadKml(file);
      } else if (file.name.toLowerCase().endsWith('.gpx')) {
        return this.uploadGpx(file);
      } else {
        showWarning(i18next.t('tbx_unsupported_file_warning'));
        return;
      }
    }
  }

  async uploadKml(file) {
    const kmlDataSource = await KmlDataSource.load(file, {
      camera: this.viewer!.scene.camera,
      canvas: this.viewer!.scene.canvas,
      clampToGround: true
    });

    let entities = kmlDataSource.entities.values;
    if (entities.length > 10) {
      showWarning(i18next.t('tbx_kml_large_warning'));
      entities = entities.slice(0, 10);
    }
    let atLeastOneValid = false;
    entities.forEach(ent => {
      const exists = this.geometriesDataSource!.entities.getById(ent.id);
      if (!exists) {
        atLeastOneValid = this.addUploadedArea(ent, kmlDataSource.name);
      } else {
        atLeastOneValid = true;
        showWarning(i18next.t('tbx_kml_area_existing_warning'));
      }
    });

    if (!atLeastOneValid) {
      showWarning(i18next.t('tbx_unsupported_kml_warning'));
    } else {
      this.viewer!.zoomTo(entities);
    }
  }

  async uploadGpx(file) {
    const gpxDataSource: CustomDataSource = <any> await GpxDataSource.load(file, {
      clampToGround: true
    });
    const entities = gpxDataSource.entities.values;
    entities.forEach(entity => {
      if (!this.geometriesDataSource!.entities.getById(entity.id)) {
        this.addUploadedArea(entity, gpxDataSource.name);
      }
    });
  }

  /**
   * Adds entity to dataSource. Returns true if entity added.
   * @param entity
   * @param dataSourceName
   * @return {boolean}
   */
  addUploadedArea(entity, dataSourceName) {
    let type = getUploadedEntityType(entity);
    const extendedData = entity.kml && entity.kml.extendedData ? entity.kml.extendedData : {};
    Object.getOwnPropertyNames(extendedData).forEach(prop => {
      extendedData[prop] = parseJson(extendedData[prop].value) || extendedData[prop].value;
      if (extendedData[prop] === 'false' || extendedData[prop] === 'true') {
        extendedData[prop] = extendedData[prop] === 'true';
      }
    });
    if (extendedData.type && AVAILABLE_AOI_TYPES.includes(extendedData.type)) {
      type = extendedData.type;
    }
    if (type) {
      const attributes = {...extendedData, ...getAreaProperties(entity, type)};
      attributes.id = entity.id;
      if (entity.name) {
        attributes.name = entity.name;
      } else {
        attributes.name = entity.parent && entity.parent.name ? entity.parent.name : dataSourceName;
      }
      if (type === 'point') {
        // getValue doesn't work with julianDate for some reason
        const position = entity.position.getValue ? entity.position.getValue(new Date()) : entity.position;
        attributes.positions = [position];
        attributes.clampPoint = true;
        const billboard = entity.billboard;
        if (billboard) {
          attributes.color = billboard.color ? billboard.color.getValue(this.julianDate) : undefined;
          attributes.pointSymbol = billboard.image ? billboard.image.getValue(this.julianDate).url : undefined;
        }
      } else if (type === 'line') {
        attributes.positions = entity.polyline.positions;
        attributes.color = entity.polyline.material ? entity.polyline.material.getValue(this.julianDate).color : undefined;
      } else {
        attributes.positions = entity.polygon.hierarchy;
        attributes.color = entity.polygon.material ? entity.polygon.material.getValue(this.julianDate).color : undefined;
      }
      this.addAreaEntity(attributes);
      return true;
    }
    return false;
  }

  addStoredAreas(areas) {
    areas.forEach(area => {
      if (!area.positions) return;
      const splittedName = area.name.split(' ');
      const areaNumber = Number(splittedName[1]);
      if (splittedName[0] !== 'Area' && !isNaN(areaNumber) && areaNumber > this.areasCounter[area.type]) {
        this.areasCounter[area.type] = areaNumber;
      }
      this.addAreaEntity(area);
    });
  }

  getInfoProps(properties) {
    const attributes = {
      properties: [[i18next.t('obj_info_name_label'), properties.name]],
      zoom: () => this.flyToArea(properties.id)
    };
    if (properties.type === 'rectangle' || properties.type === 'polygon') {
      attributes.properties.push([i18next.t('obj_info_area_label'), `${properties.area}km²`]);
      attributes.properties.push([i18next.t('obj_info_perimeter_label'), `${properties.perimeter}km`]);
      attributes.properties.push([i18next.t('obj_info_number_segments_label'), properties.numberOfSegments]);
    } else if (properties.type === 'line') {
      attributes.properties.push([i18next.t('obj_info_length_label'), `${properties.perimeter}km`]);
    }
    if (properties.description && properties.description.length) {
      attributes.properties.push([i18next.t('obj_info_description_label'), properties.description]);
    }
    if (properties.image && properties.image.length) {
      attributes.properties.push(
        [i18next.t('obj_info_image_label'), html`<img src="${properties.image}" alt="${properties.image}">`]
      );
    }
    if (properties.website && properties.website.length) {
      attributes.properties.push(
        [i18next.t('obj_info_website_label'), html`<a href="${properties.website}" target="_blank"
                                                      rel="noopener">${properties.website}</a>`]
      );
    }
    return attributes;
  }


  /**
   * Adds AOI entity to data source
   */
  addAreaEntity(attributes: NgmGeometry) {
    const type = attributes.type;
    const name = type.charAt(0).toUpperCase() + type.slice(1);
    const entityAttrs: Entity.ConstructorOptions = {
      id: attributes.id || undefined,
      name: attributes.name || `${name} ${this.areasCounter[type]}`,
      show: attributes.show,
      properties: {
        area: attributes.area,
        perimeter: attributes.perimeter,
        numberOfSegments: attributes.numberOfSegments,
        sidesLength: attributes.sidesLength || [],
        type: type,
        volumeShowed: !!attributes.volumeShowed,
        volumeHeightLimits: attributes.volumeHeightLimits || null,
        description: attributes.description || '',
        image: attributes.image || '',
        website: attributes.website || ''
      }
    };
    const color = attributes.color;
    if (type === 'point') {
      entityAttrs.position = attributes.positions[0];
      if (attributes.clampPoint) {
        const cartPosition = Cartographic.fromCartesian(entityAttrs.position);
        cartPosition.height = 0;
        entityAttrs.position = Cartographic.toCartesian(cartPosition);
      }
      entityAttrs.billboard = {
        image: attributes.pointSymbol || `./images/${AOI_POINT_SYMBOLS[0]}`,
        color: color ? new Color(color.red, color.green, color.blue) : DEFAULT_AOI_COLOR,
        scale: 0.5,
        verticalOrigin: VerticalOrigin.BOTTOM,
        disableDepthTestDistance: 0,
        heightReference: HeightReference.RELATIVE_TO_GROUND
      };
      entityAttrs.properties!.swissforagesId = attributes.swissforagesId;
      attributes.depth = attributes.depth || 400;
      entityAttrs.properties!.depth = attributes.depth;
      const height = Cartographic.fromCartesian(entityAttrs.position).height;
      entityAttrs.ellipse = {
        show: !!attributes.swissforagesId || !!attributes.volumeShowed,
        material: Color.GREY,
        semiMinorAxis: 40.0,
        semiMajorAxis: 40.0,
        extrudedHeight: height,
        height: height - attributes.depth,
        heightReference: HeightReference.RELATIVE_TO_GROUND,
        extrudedHeightReference: HeightReference.RELATIVE_TO_GROUND
      };
    } else {
      const material = color ?
        new Color(color.red, color.green, color.blue, AOI_POLYGON_ALPHA) :
        DEFAULT_AOI_COLOR.withAlpha(AOI_POLYGON_ALPHA);
      if (type === 'rectangle' || type === 'polygon') {
        entityAttrs.polygon = {
          hierarchy: <any>attributes.positions,
          material: material,
        };
        entityAttrs.properties!.showSlicingBox = attributes.showSlicingBox;
      } else if (type === 'line') {
        entityAttrs.polyline = {
          positions: attributes.positions,
          clampToGround: true,
          width: 4,
          material: color ?
            new Color(color.red, color.green, color.blue, AOI_LINE_ALPHA) :
            DEFAULT_AOI_COLOR.withAlpha(AOI_LINE_ALPHA),
        };
      }
      entityAttrs.polylineVolume = {
        cornerType: CornerType.MITERED,
        outline: true,
        outlineColor: material,
        material: material
      };
    }
    const entity = this.geometriesDataSource!.entities.add(entityAttrs);
    if (entityAttrs.properties!.volumeShowed) {
      updateEntityVolume(entity, this.viewer!.scene.globe);
    }
    return entity;
  }

  showAreaInfo(areaAttrs) {
    QueryStore.setObjectInfo(this.getInfoProps(areaAttrs));
    this.pickArea_(areaAttrs.id);
  }

  get drawState() {
    return this.draw && this.draw.active;
  }

  // todo reuse or remove
  editAreaPosition(id, restrictedPoint = false) {
    this.deselectArea();
    const entity = this.geometriesDataSource!.entities.getById(id);
    if (!entity || !entity.properties || !this.draw) return;
    const type = entity.properties.type.getValue();
    if (!entity.isShowing) {
      entity.show = !entity.isShowing;
    }

    this.draw.entityForEdit = entity;
    this.draw.type = type;
    this.draw.active = !restrictedPoint;
    this.restrictedEditing = restrictedPoint;

    this.editedBackup = {
      name: entity.name,
      properties: {...getAreaProperties(entity, type)}
    };

    if (type === 'point') {
      const position = entity.position!.getValue(this.julianDate);
      this.editedBackup.positions = Cartesian3.clone(position);
      this.editedBackup.color = entity.billboard!.color!.getValue(this.julianDate);
      this.editedBackup.image = entity.billboard!.image!.getValue(this.julianDate);
    } else if (type === 'line') {
      this.editedBackup.positions = entity.polyline!.positions!.getValue(this.julianDate).map(p => Cartesian3.clone(p));
      this.editedBackup.color = entity.polyline!.material.getValue(this.julianDate).color;
    } else {
      const hierarchy = entity.polygon!.hierarchy!.getValue(this.julianDate);
      // this is hackish: the hierarchy should not be stored as a positions.
      this.editedBackup.positions = {
        positions: hierarchy.positions.map(p => Cartesian3.clone(p)),
        holes: hierarchy.holes ? hierarchy.holes.map(p => Cartesian3.clone(p)) : []
      };
      this.editedBackup.color = entity.polygon!.material.getValue(this.julianDate).color;
    }
  }

  saveEditing() {
    if (!this.draw) return;
    this.editedBackup = undefined;
    const type = this.draw.entityForEdit.properties.type.getValue();
    this.draw.entityForEdit.properties = getAreaProperties(this.draw.entityForEdit, type);
    this.cancelDraw();
  }


  // get volumeHeightLimits() {
  //   const entity = this.draw!.entityForEdit;
  //   if (!entity || !entity.properties.volumeHeightLimits) {
  //     return DEFAULT_VOLUME_HEIGHT_LIMITS;
  //   }
  //   return entity.properties.volumeHeightLimits.getValue();
  // }

  // todo reuse or remove
  isVolumeInputsHidden() {
    const entity = this.draw!.entityForEdit;
    if (!entity) return true;
    const volumeShowed = entity.properties.volumeShowed && entity.properties.volumeShowed.getValue();
    const type = entity.properties.type.getValue();
    return type === 'point' || !volumeShowed;
  }

  onColorChange(id, type, color) {
    color = color.withAlpha(0.3);
    const entity = this.geometriesDataSource!.entities.getById(id);
    if (!entity) return;
    if (type === 'line') {
      entity.polyline!.material = color;
    } else {
      entity.polygon!.material = color;
    }
    if (entity.polylineVolume) {
      entity.polylineVolume.material = color;
      entity.polylineVolume.outlineColor = color;
    }
  }

  updateHighlight(entity, selected) {
    if (entity.billboard) {
      if (selected) {
        entity.properties.colorBeforeHighlight = entity.billboard.color.getValue(this.julianDate);
        entity.billboard.color = HIGHLIGHTED_AOI_COLOR;
      } else {
        entity.billboard.color = entity.properties.colorBeforeHighlight;
        entity.properties.colorBeforeHighlight = undefined;
      }
      return;
    }
    const entityType = entity.polygon ? 'polygon' : 'polyline';
    if (entity.polylineVolume && entity.polylineVolume.show) {
      const color = selected ?
        HIGHLIGHTED_AOI_COLOR.withAlpha(AOI_POLYGON_ALPHA) :
        entity.properties.colorBeforeHighlight.withAlpha(AOI_POLYGON_ALPHA);
      entity.polylineVolume.material = color;
      entity.polylineVolume.outlineColor = color;
    }
    if (selected) {
      entity.properties.colorBeforeHighlight = entity[entityType].material.getValue(this.julianDate).color;
      entity[entityType].material = entity.polygon ?
        HIGHLIGHTED_AOI_COLOR.withAlpha(AOI_POLYGON_ALPHA) : HIGHLIGHTED_AOI_COLOR.withAlpha(AOI_LINE_ALPHA);
    } else {
      entity[entityType].material = entity.properties.colorBeforeHighlight;
      entity.properties.colorBeforeHighlight = undefined;
    }
  }

  increaseAreasCounter(type) {
    this.areasCounter[type] += 1;
  }


  render() {
    if (!this.viewer) {
      return '';
    }

    return this.getTemplate();
  }

  createRenderRoot() {
    return this;
  }

}
