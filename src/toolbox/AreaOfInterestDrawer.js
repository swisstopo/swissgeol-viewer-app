import ScreenSpaceEventType from 'cesium/Source/Core/ScreenSpaceEventType';
import Cartesian3 from 'cesium/Source/Core/Cartesian3';
import CustomDataSource from 'cesium/Source/DataSources/CustomDataSource';
import KmlDataSource from 'cesium/Source/DataSources/KmlDataSource';
import GpxDataSource from '../GpxDataSource.js';
import i18next from 'i18next';
import {getMeasurements, cartesianToDegrees, extendKmlWithProperties} from '../cesiumutils.js';
import JulianDate from 'cesium/Source/Core/JulianDate';
import HeightReference from 'cesium/Source/Scene/HeightReference';
import EntityCollection from 'cesium/Source/DataSources/EntityCollection';
import {exportKml} from 'cesium';
import {saveAs} from 'file-saver';

import {html} from 'lit-element';

import {
  AOI_DATASOURCE_NAME,
  DEFAULT_AOI_COLOR,
  DEFAULT_VOLUME_HEIGHT_LIMITS,
  AOI_POINT_SYMBOLS, HIGHLIGHTED_AOI_COLOR, AVAILABLE_AOI_TYPES
} from '../constants.js';
import {updateColor, getUploadedEntityType, updateBoreholeHeights} from './helpers.js';
import {showWarning} from '../message.js';
import {LitElementI18n} from '../i18n';
import {CesiumDraw} from '../draw/CesiumDraw.js';
import ScreenSpaceEventHandler from 'cesium/Source/Core/ScreenSpaceEventHandler';
import BoundingSphere from 'cesium/Source/Core/BoundingSphere';
import HeadingPitchRange from 'cesium/Source/Core/HeadingPitchRange';
import {updateHeightForCartesianPositions} from '../cesiumutils';
import CesiumMath from 'cesium/Source/Core/Math';
import Cartesian2 from 'cesium/Source/Core/Cartesian2';
import CornerType from 'cesium/Source/Core/CornerType';
import {showMessage} from '../message';
import Color from 'cesium/Source/Core/Color';
import VerticalOrigin from 'cesium/Source/Scene/VerticalOrigin';
import {DEFAULT_AOI_VOLUME_COLOR} from '../constants';
import {SwissforagesService} from './SwissforagesService';
import Cartographic from 'cesium/Source/Core/Cartographic';


import {clickOnElement, coordinatesToBbox, parseJson} from '../utils.js';
import './ngm-gst-interaction.js';
import './ngm-point-edit.js';
import '../elements/slicer/ngm-toolbox-slicer.js';
import {classMap} from 'lit-html/directives/class-map.js';
import './ngm-swissforages-modal.js';
import './ngm-swissforages-interaction.js';

const fileUploadInputId = 'fileUpload';


class NgmAreaOfInterestDrawer extends LitElementI18n {

  static get properties() {
    return {
      viewer: {type: Object},
      selectedArea_: {type: Object},
      slicer: {type: Object},
      setStoredAoi: {type: Object},
      getStoredAoi: {type: Object},
      downloadActiveDataEnabled: {type: Boolean}
    };
  }

  constructor() {
    super();
    this.getStoredAoi = null;
    this.setStoredAoi = null;
    this.minVolumeHeight = 1;
    this.maxVolumeHeight = 30000;
    this.minVolumeLowerLimit = -30000;
    this.maxVolumeLowerLimit = 30000;
    this.julianDate = new JulianDate();
    this.swissforagesService = new SwissforagesService();
    /**
     * @type {import('cesium').Viewer}
     */
    this.viewer = null;
  }

  firstUpdated() {
    this.addStoredAreas(this.getStoredAoi());
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


  getTemplate() {
    return html`
      <label>${i18next.t('tbx_drawing_tools_label')}</label>
      <div class="ui fluid compact tiny buttons ngm-aoi-buttons"
           ?hidden=${this.draw_.active && !this.draw_.entityForEdit}>
        <button class="ui button"
                data-tooltip=${i18next.t('tbx_add_point_btn_label')}
                data-variation="mini"
                data-position="top left"
                @click=${this.onAddAreaClick_.bind(this, 'point')}>
          <i class="map marker alternate icon"></i>
        </button>
        <button class="ui button"
                data-tooltip=${i18next.t('tbx_add_line_btn_label')}
                data-variation="mini"
                data-position="top center"
                @click=${this.onAddAreaClick_.bind(this, 'line')}>
          <i class="route icon"></i>
        </button>
        <button class="ui button"
                data-tooltip=${i18next.t('tbx_add_polygon_area_btn_label')}
                data-variation="mini"
                data-position="top center"
                @click=${this.onAddAreaClick_.bind(this, 'polygon')}>
          <i class="draw polygon icon"></i>
        </button>
        <button class="ui button"
                data-tooltip=${i18next.t('tbx_add_rect_area_btn_label')}
                data-variation="mini"
                data-position="top center"
                @click=${this.onAddAreaClick_.bind(this, 'rectangle')}>
          <i class="vector square icon"></i>
        </button>
        <button class="ui button"
                data-tooltip=${i18next.t('tbx_upload_btn_label')}
                data-variation="mini"
                data-position="top right"
                @click=${clickOnElement.bind(null, fileUploadInputId)}>
          <i class="file upload icon"></i>
        </button>
        <button class="ui button ${classMap({disabled: !this.atLeastOneEntityVisible})}"
                data-tooltip=${i18next.t('tbx_download_btn_label')}
                data-variation="mini"
                data-position="top right"
                @click=${this.downloadVisibleGeometries}>
          <i class="download icon"></i>
        </button>
      </div>
      <input id="${fileUploadInputId}" type='file' accept=".kml,.KML,.gpx,.GPX" hidden
             @change=${this.uploadFile_.bind(this)}/>
      <div class="ui tiny basic fluid buttons ngm-aoi-tooltip-container"
           ?hidden=${!this.draw_.active || this.draw_.entityForEdit}>
        <button class="ui button" @click=${this.cancelDraw.bind(this)}>${i18next.t('tbx_cancel_area_btn_label')}
        </button>
        <button class="ui button ngm-help-btn"
                data-tooltip=${i18next.t('tbx_area_of_interest_add_hint')}
                data-variation="tiny"
                data-position="top right">
          <i class="question circle outline icon"></i>
        </button>
      </div>

      <label>${i18next.t('tbx_analysis_tools_label')}</label>
      <div class="ui vertical accordion ngm-aoi-areas" ?hidden=${!this.entitiesList_ || !this.entitiesList_.length}>
        ${this.aoiListTemplate()}
      </div>
      <div ?hidden=${this.entitiesList_ && !!this.entitiesList_.length} class="ui tertiary center aligned segment">
        <span>${i18next.t('tbx_area_of_interest_empty_hint')}</span>
      </div>
      <ngm-gst-modal .imageUrl="${this.sectionImageUrl}"></ngm-gst-modal>
      <ngm-swissforages-modal
        .service="${this.swissforagesService}"
        .options="${this.swissforagesModalOptions}">
      </ngm-swissforages-modal>
    `;
  }

  createButtonsFields(i) {
    return html`
      <div class="ngm-btns-field">
        <div class="ui tiny fluid compact buttons ngm-aoi-buttons">
          <button
            class="ui button"
            @click=${this.showAreaInfo.bind(this, i)}
            data-tooltip=${i18next.t('tbx_info_btn_hint')}
            data-position="top center"
            data-variation="tiny"
          ><i class="info circle icon"></i></button>
          <button
            class="ui button"
            @click=${this.flyToArea.bind(this, i.id)}
            data-tooltip=${i18next.t('tbx_fly_to_btn_hint')}
            data-position="top center"
            data-variation="tiny"
          ><i class="search plus icon"></i></button>
          <button
            ?hidden="${i.swissforagesId}"
            class="ui button"
            @click=${this.editAreaPosition.bind(this, i.id)}
            data-tooltip=${i18next.t('tbx_edit_area_hint')}
            data-position="top center"
            data-variation="tiny"
          ><i class="pen icon"></i></button>
          <button
            class="ui button"
            @click=${this.updateEntityVolume.bind(this, i.id, true)}
            ?hidden=${i.type === 'point' || i.volumeShowed}
            data-tooltip=${i18next.t('tbx_show_volume_btn_label')}
            data-position="top center"
            data-variation="tiny"
          ><i class="${this.getIconClass(i.id, true)}"></i></button>
          <button
            class="ui button"
            @click=${this.hideVolume.bind(this, i.id)}
            ?hidden=${i.type === 'point' || !i.volumeShowed}
            data-tooltip=${i18next.t('tbx_hide_volume_btn_label')}
            data-position="top center"
            data-variation="tiny"
          ><i class="${this.getIconClass(i.id, true)}"></i></button>
          <button
            class="ui button"
            @click=${this.onRemoveEntityClick_.bind(this, i.id)}
            data-tooltip=${i18next.t('tbx_remove_btn_hint')}
            data-position="top center"
            data-variation="tiny"
          ><i class="trash alternate outline icon"></i></button>
        </div>
      </div>`;
  }

  aoiListTemplate() {
    return this.entitiesList_.map((i, index) =>
      html`
        <div class="item">
          <div class="title" @click=${evt => this.onAreaClick(evt)}>
            <i class="dropdown icon"></i>
            <div class="ui checkbox">
              <input type="checkbox" @input=${evt => this.onShowHideEntityClick_(evt, i.id)} .checked=${i.show}>
              <label class="ngm-aoi-title"><i class=${this.getIconClass(i.id)}></i>${i.name}</label>
            </div>
          </div>
          <div class="content ngm-aoi-content">
            ${this.createButtonsFields(i)}
            ${i.type !== 'polygon' ?
              html`
                <ngm-gst-interaction
                  .viewer=${this.viewer}
                  .positions=${i.positions}
                  .geometryType=${i.type}
                  .parentElement=${this}>
                </ngm-gst-interaction>
              ` : ''}
            <ngm-swissforages-interaction
              .item=${i}
              .service=${this.swissforagesService}
              .dataSource=${this.interestAreasDataSource}
              .viewer=${this.viewer}
              .updateModalOptions=${(options => {
                this.swissforagesModalOptions = options;
                this.requestUpdate();
              })}>
            </ngm-swissforages-interaction>
            ${i.type === 'line' ?
              html`
                <ngm-toolbox-slicer .slicer=${this.slicer} .positions=${i.positions}></ngm-toolbox-slicer>`
              : ''}
            ${i.type === 'rectangle' ?
              html`
                <div class="ui tiny buttons">
                  <button class="ui button ${classMap({disabled: !this.downloadActiveDataEnabled})}"
                          data-position="top left"
                          data-variation="mini"
                          @click=${() => {
                            const rectangle = i.positions.map(cartesianToDegrees);
                            rectangle.pop();
                            const bbox = coordinatesToBbox(rectangle);
                            this.dispatchEvent(new CustomEvent('downloadActiveData', {
                              detail: {
                                bbox4326: bbox
                              }
                            }));
                          }
                          }>
                    ${i18next.t('tbx_download_data_inside_rectangle_label')}
                  </button>
                </div>
              `
              : ''}
          </div>

          <div class="ngm-aoi-edit" ?hidden=${!this.draw_.entityForEdit || this.draw_.entityForEdit.id !== i.id}>
            <div class="ui mini basic fluid buttons ngm-aoi-tooltip-container">
              <button class="ui button basic primary"
                      @click=${this.saveEditing.bind(this)}>${i18next.t('tbx_save_editing_btn_label')}
              </button>
              <button class="ui button basic grey" @click=${this.cancelDraw.bind(this)}>
                ${i18next.t('tbx_cancel_area_btn_label')}
              </button>
              <button class="ui button basic grey ngm-help-btn"
                      data-tooltip=${i18next.t('tbx_area_of_interest_edit_hint')}
                      data-variation="tiny"
                      data-position="top right">
                <i class="question circle outline icon"></i>
              </button>
            </div>
            <div class="ngm-aoi-input-container">
              <label>${i18next.t('tbx_name_label')}:</label>
              <div class="ui mini input">
                <input
                  class=${`ngm-aoi-name-input-${index}`}
                  type="text" .value="${i.name}"
                  @input="${() => this.onNameInputChange(index)}">
              </div>
            </div>
            <div class="ngm-aoi-input-container">
              <label>${i18next.t('tbx_description_label')}:</label>
              <div class="ui mini input">
                  <textarea
                    class=${`ngm-aoi-description-${index}`}
                    type="text" .value="${i.description}"
                    @input="${() => this.onDescriptionChange(index)}"></textarea>
              </div>
            </div>
            <div class="ngm-aoi-input-container">
              <label>${i18next.t('tbx_image_label')}:</label>
              <div class="ui mini input">
                  <textarea
                    class=${`ngm-aoi-image-${index}`}
                    type="text" .value="${i.image}"
                    @input="${() => this.onImageChange(index)}"></textarea>
              </div>
            </div>
            <div class="ngm-aoi-input-container">
              <label>${i18next.t('tbx_website_label')}:</label>
              <div class="ui mini input">
                  <textarea
                    class=${`ngm-aoi-website-${index}`}
                    type="text" .value="${i.website}"
                    @input="${() => this.onWebsiteChange(index)}"></textarea>
              </div>
            </div>
            <div class="ngm-volume-limits-input"
                 ?hidden=${!this.draw_.entityForEdit || !(this.draw_.entityForEdit.properties.volumeShowed && this.draw_.entityForEdit.properties.volumeShowed.getValue())}>
              <div>
                <label>${i18next.t('tbx_volume_lower_limit_label')}:</label></br>
                <div class="ui mini input right labeled">
                  <input type="number" step="10" min="${this.minVolumeHeight}" max="${this.maxVolumeHeight}"
                         class=${`ngm-lower-limit-input-${index}`}
                         .value="${this.volumeHeightLimits.lowerLimit}"
                         @input="${this.onVolumeHeightLimitsChange.bind(this, index)}">
                  <label class="ui label">m</label>
                </div>
              </div>
              <div>
                <label>${i18next.t('tbx_volume_height_label')}:</label></br>
                <div class="ui mini input right labeled">
                  <input type="number" step="10" min="${this.minVolumeHeight}" max="${this.maxVolumeHeight}"
                         class=${`ngm-volume-height-input-${index}`}
                         .value="${this.volumeHeightLimits.height}"
                         @change="${this.onVolumeHeightLimitsChange.bind(this, index)}">
                  <label class="ui label">m</label>
                </div>
              </div>
            </div>
            <ngm-point-edit
              ?hidden=${i.type !== 'point'}
              .viewer=${this.viewer}
              .position=${i.positions[0]}
              .entity=${this.draw_.entityForEdit}>
            </ngm-point-edit>
          </div>
        </div>`);
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
      updateBoreholeHeights(this.draw_.entityForEdit, this.julianDate);
    });

    this.screenSpaceEventHandler = new ScreenSpaceEventHandler(this.viewer.canvas);
    this.screenSpaceEventHandler.setInputAction(this.onClick_.bind(this), ScreenSpaceEventType.LEFT_CLICK);
    this.interestAreasDataSource.entities.collectionChanged.addEventListener(() => {
      this.viewer.scene.requestRender();
      this.requestUpdate();
      this.setStoredAoi(this.entitiesList_);
    });
    this.sectionImageUrl = null;
    this.swissforagesModalOptions = {
      name: undefined,
      id: undefined,
      position: undefined,
      onLoggedIn: undefined,
      onSwissforagesBoreholeCreated: undefined,
      show: false
    };

    this.aoiInited = true;
  }

  endDrawing_(event) {
    this.draw_.active = false;
    this.draw_.clear();

    const positions = event.detail.positions;
    const measurements = event.detail.measurements;
    const type = event.detail.type;
    const attributes = {
      positions: positions,
      area: measurements.area,
      perimeter: measurements.perimeter,
      sidesLength: measurements.sidesLength,
      numberOfSegments: measurements.segmentsNumber,
      type: type,
      clampPoint: true
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
        swissforagesId: val.properties.swissforagesId ? val.properties.swissforagesId.getValue() : undefined,
        depth: val.properties.depth ? val.properties.depth.getValue() : undefined,
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
    entities.forEach(ent => {
      const exists = this.interestAreasDataSource.entities.getById(ent.id);
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
    });
    if (extendedData.type && AVAILABLE_AOI_TYPES.includes(extendedData.type)) {
      type = extendedData.type;
    }
    if (type) {
      const attributes = {...extendedData, ...this.getAreaProperties(entity, type)};
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
          attributes.pointColor = billboard.color ? billboard.color.getValue(this.julianDate) : undefined;
          attributes.pointSymbol = billboard.image ? billboard.image.getValue(this.julianDate).url : undefined;
        }
      } else if (type === 'line') {
        attributes.positions = entity.polyline.positions;
      } else {
        attributes.positions = entity.polygon.hierarchy;
      }
      this.addAreaEntity(attributes);
      return true;
    }
    return false;
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
      if (area.selected) {
        this.pickArea_(entity.id);
      }
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

  getIconClass(id, inverted = false) {
    const entity = this.interestAreasDataSource.entities.getById(id);
    const type = entity.properties.type ? entity.properties.type.getValue() : undefined;
    let volume = entity.properties.volumeShowed ? entity.properties.volumeShowed.getValue() : undefined;
    const swissforagesId = entity.properties.swissforagesId ? entity.properties.swissforagesId.getValue() : undefined;
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
        return swissforagesId ? 'ruler vertical icon' : 'map marker alternate icon';
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
       clampPoint: (optional) Boolean,
   * }
   */
  addAreaEntity(attributes) {
    const type = attributes.type;
    const name = type.charAt(0).toUpperCase() + type.slice(1);
    const entityAttrs = {
      id: attributes.id || undefined,
      name: attributes.name || `${name} ${this.areasCounter_[type]}`,
      show: typeof attributes.show === 'boolean' ? attributes.show : true,
      properties: {
        area: attributes.area,
        perimeter: attributes.perimeter,
        numberOfSegments: attributes.numberOfSegments,
        sidesLength: attributes.sidesLength || [],
        type: type,
        volumeShowed:
          typeof attributes.volumeShowed === 'boolean' ? attributes.volumeShowed : attributes.volumeShowed === 'true',
        volumeHeightLimits: attributes.volumeHeightLimits || DEFAULT_VOLUME_HEIGHT_LIMITS,
        description: attributes.description || '',
        image: attributes.image || '',
        website: attributes.website || ''
      }
    };
    if (type === 'point') {
      entityAttrs.position = attributes.positions[0];
      if (attributes.clampPoint) {
        const cartPosition = Cartographic.fromCartesian(entityAttrs.position);
        cartPosition.height = 0;
        entityAttrs.position = Cartographic.toCartesian(cartPosition);
      }
      const color = attributes.pointColor;
      entityAttrs.billboard = {
        image: attributes.pointSymbol || `./images/${AOI_POINT_SYMBOLS[0]}`,
        color: color ? new Color(color.red, color.green, color.blue) : Color.GRAY,
        scale: 0.5,
        verticalOrigin: VerticalOrigin.BOTTOM,
        disableDepthTestDistance: 0,
        heightReference: HeightReference.RELATIVE_TO_GROUND
      };
      entityAttrs.properties.swissforagesId = attributes.swissforagesId;
      entityAttrs.properties.depth = attributes.depth || 400;
      const height = Cartographic.fromCartesian(entityAttrs.position).height;
      entityAttrs.ellipse = {
        show: !!attributes.swissforagesId,
        material: Color.GREY,
        semiMinorAxis: 40.0,
        semiMajorAxis: 40.0,
        extrudedHeight: height,
        height: height - attributes.depth,
        heightReference: HeightReference.RELATIVE_TO_GROUND,
        extrudedHeightReference: HeightReference.RELATIVE_TO_GROUND
      };
    } else {
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
      }
      entityAttrs.polylineVolume = {
        cornerType: CornerType.MITERED,
        outline: true,
        outlineColor: DEFAULT_AOI_VOLUME_COLOR,
        material: DEFAULT_AOI_VOLUME_COLOR
      };
    }
    const entity = this.interestAreasDataSource.entities.add(entityAttrs);
    if (entityAttrs.properties.volumeShowed) {
      this.updateEntityVolume(entity.id);
    }
    return entity;
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
    this.querySelectorAll('.ngm-aoi-areas .ngm-aoi-content button')
      .forEach(button => button.classList.add('ngm-disabled-btn'));
  }

  enableToolButtons() {
    this.querySelectorAll('.ngm-aoi-areas .ngm-aoi-content button')
      .forEach(button => button.classList.remove('ngm-disabled-btn'));
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
    entity.polylineVolume.outlineColor = color;
    entity.polylineVolume.material = color;
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
    const lowerLimit = CesiumMath.clamp(Number(limitInput.value), this.minVolumeLowerLimit, this.maxVolumeLowerLimit);
    const height = CesiumMath.clamp(Number(heightInput.value), this.minVolumeHeight, this.maxVolumeHeight);
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

  async downloadVisibleGeometries() {
    const visibleGeometries = new EntityCollection();
    this.interestAreasDataSource.entities.values.forEach(ent => {
      if (ent.isShowing) {
        visibleGeometries.add(ent);
      }
    });
    const exportResult = await exportKml({entities: visibleGeometries, time: this.julianDate});
    let kml = exportResult.kml;
    kml = extendKmlWithProperties(kml, visibleGeometries);
    const blob = new Blob([kml], {type: 'text/xml'});
    saveAs(blob, 'swissgeol_geometries.kml');
  }

  get atLeastOneEntityVisible() {
    return !!this.entitiesList_.find(ent => ent.show);
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

customElements.define('ngm-aoi-drawer', NgmAreaOfInterestDrawer);
