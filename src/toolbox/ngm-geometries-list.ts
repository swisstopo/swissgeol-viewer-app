import {LitElementI18n} from '../i18n';
import {customElement, html, property, state} from 'lit-element';
import i18next from 'i18next';
import {NgmGeometry} from './ngm-aoi-drawer';
import DrawStore from '../store/draw';
import {classMap} from 'lit-html/directives/class-map.js';

@customElement('ngm-geometries-list')
export default class NgmGeometriesList extends LitElementI18n {
  @property({type: String}) selectedId = ''
  @state() geometries: NgmGeometry[] = []

  constructor() {
    super();
    DrawStore.geometries.subscribe(geoms => {
      this.geometries = geoms;
    });
  }

  render() {
    return html`
      <div class="ngm-geom-label">${i18next.t('tbx_my_geometries')}</div>
      <div class="ngm-geom-list">
        ${this.geometries.map((i) => html`
          <div class="ngm-geom-item ${classMap({active: this.selectedId === i.id})}"
               @click=${() => this.dispatchEvent(new CustomEvent('geomclick', {detail: i}))}>
            ${i.name}
            <div class="ngm-action-menu-icon"></div>
          </div>
        `)}
      </div>`;
  }

  createRenderRoot() {
    return this;
  }

}
