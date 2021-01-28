import {LitElementI18n} from '../i18n';
import {html} from 'lit-element';
import i18next from 'i18next';
import Cartographic from 'cesium/Source/Core/Cartographic';
import {updateBoreholeHeights} from './helpers';
import {SWISSFORAGES_EDITOR_URL, SWISSFORAGES_VIEWER_URL} from '../constants';
import {lv95ToDegrees} from '../projection';
import {showWarning} from '../message';
import JulianDate from 'cesium/Source/Core/JulianDate';
import $ from '../jquery';

class NgmSwissforagesInteraction extends LitElementI18n {

  constructor() {
    super();
    this.julianDate = new JulianDate();
    /**
     * @type {import('cesium').Viewer}
     */
    this.viewer = null;
  }

  static get properties() {
    return {
      item: {type: Object},
      service: {type: Object},
      viewer: {type: Object},
      dataSource: {type: Object},
      updateModalOptions: {type: Object},
    };
  }

  firstUpdated() {
    $(this.querySelector('.ngm-tools-btn')).popup({
      popup: $(this.querySelector('.ngm-swissforages-config-popup')),
      on: 'click',
      position: 'right center'
    });
  }

  showSwissforagesModal() {
    if (this.item.swissforagesId) {
      // show
      window.open(`${SWISSFORAGES_EDITOR_URL}${this.item.swissforagesId}`, '_blank');
    } else {
      // create
      const cartographicPosition = Cartographic.fromCartesian(this.item.positions[0]);
      this.updateModalOptions({
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
    const entity = this.dataSource.entities.getById(pointId);
    entity.properties.swissforagesId = boreholeId;
    entity.properties.depth = depth;
    updateBoreholeHeights(entity, this.julianDate);
    const url = `${SWISSFORAGES_VIEWER_URL}${boreholeId}`;
    if (entity.properties.website) {
      entity.properties.website = url;
    } else {
      entity.properties.addProperty('website', url);
    }
    entity.ellipse.show = true;
    this.viewer.scene.requestRender();
    window.open(`${SWISSFORAGES_EDITOR_URL}${boreholeId}`, '_blank');
    this.updateModalOptions({
      show: false
    });
  }

  async syncPointWithSwissforages(id, swissforagesId) {
    if (!this.service.userToken) {
      this.updateModalOptions({
        onLoggedIn: () => this.syncPointWithSwissforages(id, swissforagesId),
        show: true
      });
      return;
    }
    try {
      this.toggleSwissforagesSyncLoader(id);
      const boreholeData = await this.service.getBoreholeById(swissforagesId);
      const entity = this.dataSource.entities.getById(id);
      if (boreholeData) {
        entity.properties.depth = boreholeData.length || entity.properties.depth;
        if (boreholeData.location_x && boreholeData.location_y) {
          const height = boreholeData.elevation_z || 0;
          const positionlv95 = lv95ToDegrees([boreholeData.location_x, boreholeData.location_y]);
          const cartographicPosition = Cartographic.fromDegrees(positionlv95[0], positionlv95[1]);
          cartographicPosition.height = height;
          entity.position = Cartographic.toCartesian(cartographicPosition);
          updateBoreholeHeights(entity, this.julianDate);
        }
        if (boreholeData.custom && boreholeData.custom.public_name) {
          entity.properties.name = boreholeData.custom.public_name;
          entity.name = boreholeData.custom.public_name;
        }
      } else {
        showWarning(i18next.t('tbx_swissforages_borehole_not_exists_warning'));
        entity.ellipse.show = false;
        entity.properties.swissforagesId = undefined;
      }
      this.toggleSwissforagesSyncLoader();
    } catch (e) {
      showWarning(e);
      this.toggleSwissforagesSyncLoader();
    }
  }

  toggleSwissforagesSyncLoader() {
    const syncBtnElement = this.querySelector('.ngm-swissforages-sync');
    syncBtnElement.classList.toggle('disabled');
    syncBtnElement.querySelector('.dimmer').classList.toggle('active');
  }

  onDepthChange(event) {
    const entity = this.dataSource.entities.getById(this.item.id);
    entity.properties.depth = Number(event.target.value);
  }

  render() {
    if (this.item.type !== 'point') return '';
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
              <button class="ui button ngm-tools-btn"><i class="tools icon"></i></button>`}
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

customElements.define('ngm-swissforages-interaction', NgmSwissforagesInteraction);
