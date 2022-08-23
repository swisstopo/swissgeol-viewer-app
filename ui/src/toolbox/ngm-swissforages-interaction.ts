import {LitElementI18n} from '../i18n';
import {html} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import i18next from 'i18next';
import {Cartographic, JulianDate} from 'cesium';
import {updateBoreholeHeights} from './helpers';
import {SWISSFORAGES_EDITOR_URL, SWISSFORAGES_VIEWER_URL} from '../constants';
import {lv95ToDegrees} from '../projection';
import $ from '../jquery';
import MainStore from '../store/main';
import type {Viewer, CustomDataSource} from 'cesium';
import type {SwissforagesService} from './SwissforagesService';
import type {NgmGeometry} from './interfaces';
import {showSnackbarInfo} from '../notifications';

@customElement('ngm-swissforages-interaction')
export class NgmSwissforagesInteraction extends LitElementI18n {
  @property({type: Object}) item: NgmGeometry | undefined;
  @property({type: Object}) service: SwissforagesService | undefined;
  @property({type: Object}) dataSource: CustomDataSource | undefined;
  @property({type: Function}) updateModalOptions: CallableFunction | undefined;
  private julianDate: JulianDate = new JulianDate();
  private viewer: Viewer | null = null;

  constructor() {
    super();
    MainStore.viewer.subscribe(viewer => this.viewer = viewer);
  }

  firstUpdated() {
    $(this.querySelector('.ngm-tools-btn')).popup({
      popup: $(this.querySelector('.ngm-swissforages-config-popup')),
      on: 'click',
      position: 'right center'
    });
  }

  showSwissforagesModal() {
    if (!this.item) return;
    if (this.item.swissforagesId) {
      // show
      window.open(`${SWISSFORAGES_EDITOR_URL}${this.item.swissforagesId}`, '_blank');
    } else {
      // create
      const cartographicPosition = Cartographic.fromCartesian(this.item.positions[0]);
      this.updateModalOptions!({
        id: this.item.id,
        name: this.item.name,
        position: cartographicPosition,
        depth: this.item.depth,
        swissforagesId: this.item.swissforagesId,
        show: true,
        onSwissforagesBoreholeCreated: (pointId, boreholeId, depth) => this.onSwissforagesBoreholeCreated(pointId, boreholeId, depth)
      });
    }
  }

  onSwissforagesBoreholeCreated(pointId, boreholeId, depth) {
    const entity = this.dataSource!.entities.getById(pointId);
    if (!entity || !entity.properties) return;
    entity.properties.swissforagesId = boreholeId;
    entity.properties.depth = depth;
    updateBoreholeHeights(entity, this.julianDate);
    const url = `${SWISSFORAGES_VIEWER_URL}${boreholeId}`;
    if (entity.properties.website) {
      entity.properties.website = url;
    } else {
      entity.properties.addProperty('website', url);
    }
    entity.ellipse!.show = <any>true;
    this.viewer!.scene.requestRender();
    window.open(`${SWISSFORAGES_EDITOR_URL}${boreholeId}`, '_blank');
    this.updateModalOptions!({
      show: false
    });
  }

  async syncPointWithSwissforages(id, swissforagesId) {
    if (!this.service!.userToken) {
      this.updateModalOptions!({
        onLoggedIn: () => this.syncPointWithSwissforages(id, swissforagesId),
        show: true
      });
      return;
    }
    try {
      this.toggleSwissforagesSyncLoader();
      const boreholeData = await this.service!.getBoreholeById(swissforagesId);
      const entity = this.dataSource!.entities.getById(id);
      if (!entity || !entity.properties) return;
      if (boreholeData) {
        entity.properties.depth = boreholeData.length || entity.properties.depth;
        if (boreholeData.location_x && boreholeData.location_y) {
          const height = boreholeData.elevation_z || 0;
          const positionlv95 = lv95ToDegrees([boreholeData.location_x, boreholeData.location_y]);
          const cartographicPosition = Cartographic.fromDegrees(positionlv95[0], positionlv95[1]);
          cartographicPosition.height = height;
          entity.position = <any>Cartographic.toCartesian(cartographicPosition);
          updateBoreholeHeights(entity, this.julianDate);
        }
        if (boreholeData.custom && boreholeData.custom.public_name) {
          entity.properties.name = boreholeData.custom.public_name;
          entity.name = boreholeData.custom.public_name;
        }
      } else {
        showSnackbarInfo(i18next.t('tbx_swissforages_borehole_not_exists_warning'));
        entity.ellipse!.show = <any>false;
        entity.properties.swissforagesId = undefined;
      }
      this.toggleSwissforagesSyncLoader();
    } catch (e) {
      showSnackbarInfo(<string>e);
      this.toggleSwissforagesSyncLoader();
    }
  }

  toggleSwissforagesSyncLoader() {
    const syncBtnElement = this.querySelector('.ngm-swissforages-sync');
    if (!syncBtnElement) return;
    syncBtnElement.classList.toggle('disabled');
    syncBtnElement.querySelector('.dimmer')!.classList.toggle('active');
  }

  onDepthChange(event) {
    const entity = this.dataSource!.entities.getById(<string> this.item!.id);
    if (!entity || !entity.properties) return;
    entity.properties.depth = Number(event.target.value);
  }

  render() {
    if (!this.item || this.item.type !== 'point') return '';
    return html`
      <div class="ngm-swissforages-btns-container">
        <div class="ui tiny buttons">
          <button
            class="ui button"
            @click=${this.showSwissforagesModal.bind(this, this.item)}>
            ${this.item.swissforagesId ?
              i18next.t('tbx_swissforages_show_btn_label') :
              i18next.t('tbx_swissforages_create_btn_label')}
          </button>
          ${this.item.swissforagesId ? html`
              <button
                class="ui button ngm-swissforages-sync"
                @click=${this.syncPointWithSwissforages.bind(this, this.item.id, this.item.swissforagesId)}
                data-tooltip=${i18next.t('tbx_swissforages_sync_hint')}
                data-position="top right"
                data-variation="tiny"
              >
                <div class="ui very light dimmer">
                  <div class="ui tiny loader"></div>
                </div>
                <i class="sync icon"></i>
              </button>` :
            html`
              <button class="ui icon button ngm-tools-btn"><i class="tools icon"></i></button>`}
        </div>
      </div>
      <div class="ui mini popup ngm-swissforages-config-popup">
        <label>${i18next.t('tbx_swissforages_depth_label')}</label>
        <div class="ui input tiny">
          <input
            type="number"
            .value="${this.item.depth}"
            @change="${this.onDepthChange}"
            step="100">
        </div>
      </div>
    `;
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}
