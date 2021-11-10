import {LitElementI18n} from '../i18n';
import {customElement, state} from 'lit/decorators.js';
import {html} from 'lit';
import draggable from '../elements/draggable';
import {Entity, Viewer} from 'cesium';
import MainStore from '../store/main';
import CustomDataSource from 'cesium/Source/DataSources/CustomDataSource';
import {AOI_DATASOURCE_NAME} from '../constants';
import ToolboxStore from '../store/toolbox';
import i18next from 'i18next';
import {getValueOrUndefined} from '../cesiumutils';

@customElement('ngm-geometry-info')
export class NgmGeometryInfo extends LitElementI18n {
  @state() geomEntity: Entity | undefined;
  @state() editing = false;
  private viewer: Viewer | null = null;
  private geometriesDataSource: CustomDataSource | undefined;

  constructor() {
    super();
    MainStore.viewer.subscribe(viewer => this.viewer = viewer);
    ToolboxStore.geometryId.subscribe(id => {
      if (this.viewer && !this.geometriesDataSource)
        this.geometriesDataSource = this.viewer.dataSources.getByName(AOI_DATASOURCE_NAME)[0];
      if (!id) {
        this.geomEntity = undefined;
        return;
      }
      const entity = this.geometriesDataSource?.entities.getById(id);
      if (!entity) return;
      this.geomEntity = entity;
    });
  }


  connectedCallback() {
    draggable(this, {
      allowFrom: '.drag-handle'
    });
    super.connectedCallback();
  }

  get infoTemplate() {
    return html``;
  }

  get editTemplate() {
    return html``;
  }

  render() {
    this.hidden = !this.geomEntity;
    if (!this.geomEntity) return '';
    return html`
      <div class="ngm-floating-window-header drag-handle">
        ${`${i18next.t('tbx_geometry')} ${getValueOrUndefined(this.geomEntity.properties!.type)}`}
        <div class="ngm-close-icon" @click=${() => ToolboxStore.setGeometryId(null)}></div>
      </div>
      <div>
        ${`${this.geomEntity.name}`}
        <div class="ngm-geom-actions">
          <div class="ngm-slicing-icon"></div>
          <div class="ngm-extrusion-icon"></div>
          <div class="ngm-edit-icon"></div>
        </div>
        ${this.editing ? this.editTemplate : this.infoTemplate}
      </div>
      <div class="ngm-drag-area drag-handle">
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
      </div>
    `;
  }

  createRenderRoot() {
    return this;
  }
}
