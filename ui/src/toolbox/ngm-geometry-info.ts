import {LitElementI18n} from '../i18n';
import {customElement, query, state} from 'lit/decorators.js';
import {html} from 'lit';
import draggable from '../elements/draggable';
import type {Entity, Viewer, CustomDataSource} from 'cesium';
import {Cartographic} from 'cesium';
import MainStore from '../store/main';
import {GEOMETRY_DATASOURCE_NAME} from '../constants';
import ToolboxStore from '../store/toolbox';
import i18next from 'i18next';
import type {NgmGeometry} from './interfaces';
import {classMap} from 'lit-html/directives/class-map.js';
import {downloadGeometry, hideVolume, updateEntityVolume} from './helpers';
import './ngm-geometry-edit';
import {styleMap} from 'lit/directives/style-map.js';
import {showSnackbarInfo} from '../notifications';
import {dragArea} from '../elements/helperElements';

@customElement('ngm-geometry-info')
export class NgmGeometryInfo extends LitElementI18n {
  @state() geomEntity: Entity | undefined;
  @state() editing = false;
  @state() geometry: NgmGeometry | undefined;
  @query('.ngm-geom-info-body') infoBodyElement;
  private viewer: Viewer | null = null;
  private geometriesDataSource: CustomDataSource | undefined;

  constructor() {
    super();
    MainStore.viewer.subscribe(viewer => this.viewer = viewer);
    ToolboxStore.openedGeometryOptions.subscribe(options => {
      if (this.viewer && !this.geometriesDataSource)
        this.geometriesDataSource = this.viewer.dataSources.getByName(GEOMETRY_DATASOURCE_NAME)[0];
      if (!options?.id) {
        this.editing = false;
        this.geomEntity = undefined;
        return;
      }
      const entity = this.geometriesDataSource?.entities.getById(options.id);
      if (!entity) return;
      this.geomEntity = entity;
      this.geometry = ToolboxStore.openedGeometry;
      this.editing = !!options.editing;
    });
    ToolboxStore.sliceGeometry.subscribe(() => this.requestUpdate());
    ToolboxStore.geometries.subscribe(geometries => {
      this.geometry = geometries.find(geom => geom.id === this.geomEntity?.id);
    });
  }

  connectedCallback() {
    draggable(this, {
      allowFrom: '.drag-handle'
    });
    super.connectedCallback();
  }

  toggleGeomVolume(geom: NgmGeometry) {
    if (geom.volumeShowed) {
      hideVolume(this.geomEntity!);
    } else {
      updateEntityVolume(this.geomEntity!, this.viewer!.scene.globe);
    }
    this.requestUpdate();
  }

  onEditClick() {
    if (this.editing) {
      this.showLostChangesWarn();
    } else {
      if (ToolboxStore.geomSliceActive) ToolboxStore.setSliceGeometry(null);
      ToolboxStore.setOpenedGeometryOptions({
        id: this.geomEntity!.id,
        editing: !this.editing
      });
    }
  }

  onSliceClick() {
    if (this.editing) {
      this.showLostChangesWarn();
    } else {
      hideVolume(this.geomEntity!);
      ToolboxStore.setSliceGeometry(this.geometry);
    }
  }

  onClose() {
    if (this.editing)
      this.showLostChangesWarn();
    else
      ToolboxStore.setOpenedGeometryOptions(null);
  }

  getHeight(geom: NgmGeometry) {
    const height = geom.type === 'point' ? Cartographic.fromCartesian(geom.positions[0]).height : geom.volumeHeightLimits?.height;
    return height ? height.toFixed() : '';
  }

  showLostChangesWarn() {
    showSnackbarInfo(i18next.t('tbx_lost_changes_warning'), {
      class: 'ngm-lost-changes-warn',
      displayTime: 20000
    });
    this.infoBodyElement.scrollTop = this.infoBodyElement.scrollHeight;
  }

  get infoTemplate() {
    const geom: NgmGeometry | undefined = this.geometry;
    if (!geom) return;
    return html`
      <div>
        <button class="ui button ngm-download-obj-btn ngm-action-btn"
                @click=${() => downloadGeometry(this.geometriesDataSource?.entities.getById(geom.id!))}>
          ${i18next.t('tbx_download_kml_btn_label')}
          <div class="ngm-file-download-icon"></div>
        </button>
        <button @click="${() => ToolboxStore.nextGeometryAction({id: geom.id!, action: 'zoom'})}"
                class="ui button ngm-zoom-obj-btn ngm-action-btn">
          ${i18next.t('obj_info_zoom_to_object_btn_label')}
          <div class="ngm-zoom-plus-icon"></div>
        </button>
      </div>
      <div class="ngm-divider"></div>
      <div class="ngm-geom-info-content">
        <div class="ngm-geom-description">
          <div class="ngm-geom-info-label">${i18next.t('obj_info_description_label')}</div>
          <div class="ngm-geom-info-value">${geom.description || ''}</div>
        </div>
        <div class="ngm-geom-img">
          <div class="ngm-geom-info-label">${i18next.t('obj_info_image_label')}</div>
          <div ?hidden=${!geom.image} class="ngm-geom-info-value"><img src="${geom.image}" alt="${geom.image}"></div>
        </div>
        <div class="ngm-geom-website">
          <div class="ngm-geom-info-label">${i18next.t('obj_info_website_label')}</div>
          <div ?hidden=${!geom.website} class="ngm-geom-info-value">
            <a href=${geom.website} target="_blank">${geom.website}</a>
          </div>
        </div>
        <div ?hidden=${!geom.volumeShowed} class="ngm-geom-limits">
          <div ?hidden=${geom.type === 'point'}>
            <div class="ngm-geom-info-label">${i18next.t('tbx_volume_lower_limit_label')}</div>
            <div class="ngm-geom-info-value">${geom.volumeHeightLimits?.lowerLimit.toFixed() || '-'} m</div>
          </div>
          <div>
            <div class="ngm-geom-info-label">${i18next.t('tbx_volume_height_label')}</div>
            <div class="ngm-geom-info-value">${this.getHeight(geom)} m</div>
          </div>
          <div ?hidden=${geom.type !== 'point'}>
            <div class="ngm-geom-info-label">${i18next.t('tbx_point_depth_label')}</div>
            <div class="ngm-geom-info-value">${geom.depth?.toFixed() || '-'} m</div>
          </div>
        </div>
        <div ?hidden=${geom.type === 'point' || geom.type === 'line'}>
          <div class="ngm-geom-info-label">${i18next.t('obj_info_area_label')}</div>
          <div class="ngm-geom-info-value">${geom.area || '-'} km²</div>
        </div>
        <div ?hidden=${geom.type === 'point'}>
          <div class="ngm-geom-info-label">
            ${geom.type === 'line' ? i18next.t('obj_info_length_label') : i18next.t('obj_info_perimeter_label')}
          </div>
          <div class="ngm-geom-info-value">${geom.perimeter || '-'} km</div>
        </div>
        <div ?hidden=${geom.type === 'point'}>
          <div class="ngm-geom-info-label">${i18next.t('obj_info_number_segments_label')}</div>
          <div class="ngm-geom-info-value">${geom.numberOfSegments || ''}</div>
        </div>
        <div>
          ${geom.pointSymbol ?
            html`
              <div
                class="ngm-geom-symbol"
                style=${styleMap({
                  '-webkit-mask-image': `url('${geom.pointSymbol}')`,
                  'mask-image': `url('${geom.pointSymbol}')`,
                  backgroundColor: geom.color?.toCssColorString()
                })}></div>` :
            html`
              <div class="ngm-geom-color"
                   style=${styleMap({background: geom.color?.withAlpha(1).toCssColorString()})}>
              </div>`
          }
        </div>
      </div>
    `;
  }

  render() {
    this.hidden = !this.geometry;
    if (!this.geometry) return '';
    return html`
      <div class="ngm-floating-window-header drag-handle">
        ${`${i18next.t('tbx_geometry')} ${this.geometry.type}`}
        <div class="ngm-close-icon" @click=${() => this.onClose()}></div>
      </div>
      <div class="ngm-geom-info-body">
        ${`${this.geometry.name}`}
        <div class="ngm-geom-actions">
          <div ?hidden=${this.geometry.type === 'point' || this.geometry.type === 'polygon'}
               title=${i18next.t('tbx_slicing')}
               class="ngm-slicing-icon ${classMap({active: ToolboxStore.geomSliceActive})}"
               @click=${() => this.onSliceClick()}></div>
          <div class="ngm-extrusion-icon ${classMap({active: !!this.geometry.volumeShowed})}"
               title=${i18next.t('tbx_extrusion')}
               @click=${() => this.toggleGeomVolume(this.geometry!)}></div>
          <div class="ngm-icon ngm-edit-icon ${classMap({active: this.editing, disabled: !this.geometry.editable})}"
               title=${i18next.t('tbx_edit_btn')}
               @click=${() => this.onEditClick()}>
          </div>
        </div>
        <div class="ngm-divider"></div>
        ${this.editing ?
          html`
            <ngm-geometry-edit .entity=${this.geomEntity}></ngm-geometry-edit>` :
          this.infoTemplate
        }
      </div>
      ${dragArea}
    `;
  }

  createRenderRoot() {
    return this;
  }
}
