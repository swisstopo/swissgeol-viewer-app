import $ from '../jquery.js';
import i18next from 'i18next';
import {LitElementI18n} from '../i18n';
import {html, PropertyValues} from 'lit';
import {property, customElement, query, state} from 'lit/decorators.js';
import 'fomantic-ui-css/components/transition.js';
import 'fomantic-ui-css/components/dropdown.js';

@customElement('ngm-cam-coordinates')
export class NgmCamCoordinates extends LitElementI18n {

  @property({type: Object})
  coordinates = {};

  @state()
  key = 'lv95';

  @query('.dropdown')
  dropdown;

  createRenderRoot() {
    return this;
  }

  updated(changedProperties: PropertyValues) {
    super.updated(changedProperties);
    $(this.dropdown).dropdown();
  }

  render() {
    if (!this.coordinates) {
      return '';
    }
    const c = this.coordinates[this.key];
    return html`
      <div class="ngm-cam-coord">
        ${i18next.t('camera_position_coordinates_system_label')}
        <div class="ui item">
          <div class="ui fluid dropdown label">
            <div class="ngm-coords text">LV95</div>
            <i class="dropdown icon"></i>
            <div class="menu">
              <div class="item" @click=${() => this.key = 'lv95'}>LV95</div>
              <div class="item" @click=${() => this.key = 'wgs84'}>WGS84</div>
            </div>
          </div>
        </div>
        ${i18next.t('camera_position_coordinates_label')}
        <label class="ngm-coords">${c[0]}, ${c[1]}</label>
      </div>
      `;
  }
}
