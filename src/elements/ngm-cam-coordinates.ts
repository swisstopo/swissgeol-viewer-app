import i18next from 'i18next';
import {LitElementI18n} from '../i18n';
import {html} from 'lit';
import {property, customElement} from 'lit/decorators.js';

@customElement('ngm-cam-coordinates')
export class NgmCamCoordinates extends LitElementI18n {

  @property({type: Array})
  coordinates = [];

  @property()
  key = 'lv95';

  createRenderRoot() {
    return this;
  }

  render() {
    if (!this.coordinates) {
      return '';
    }
    const c = this.coordinates[this.key];
    return html`
      <!-- <div class="ngm-cam-coord"> -->
        <div class="ui item">
          <div class="ui fluid selection dropdown">
            <div class="text">${i18next.t('camera_position_coordinates_label')}</div>
            <i class="dropdown icon"></i>
            <div class="menu">
              <div class="item" @click=${() => this.key = 'lv95'}>LV95</div>
              <div class="item" @click=${() => this.key = 'wgs84'}>WGS84</div>
            </div>
          </div>
        </div>

        <label class="ngm-coords">${c[0]}, ${c[1]}</label>
      <!-- </div> -->
      `;
  }

  private toggleKey() {
    this.key = this.key === 'lv95' ? 'wgs84' : 'lv95';
  }
}
