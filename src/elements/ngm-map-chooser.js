import {LitElement, html} from 'lit-element';
import i18next from 'i18next';
import {I18nMixin} from '../i18n.js';
import {getMapParam, syncMapParam} from '../permalink.js';

class NgmMapChooser extends I18nMixin(LitElement) {

  static get properties() {
    return {
      viewer: {type: Object},
      maps: {type: Object},
      selectedLayer: {type: Object}
    };
  }

  updated() {
    const layerName = getMapParam();
    const visibleMap = this.maps.find(map => map.layerName === layerName);
    if (visibleMap) {
      this.selectMap(visibleMap);
    }
  }

  /**
   * @param {[{layerName: string, translationTag: string, imgSrc: string, layer: ImageryLayer}]} config
   */
  setMaps(config) {
    this.maps = config;
    const visibleMap = this.maps.find(map => map.layer.show);
    this.selectedLayer = visibleMap.layer;
  }

  selectMap(mapConfig) {
    this.selectedLayer.show = false;
    mapConfig.layer.show = true;
    this.selectedLayer = mapConfig.layer;
    this.viewer.scene.requestRender();
    syncMapParam(mapConfig.layerName);
  }

  get mapTemplates() {
    return this.maps.map(mapConfig =>
      html`<div class="ngm-map-preview ${mapConfig.layer.show ? 'active' : ''}"
                @click=${this.selectMap.bind(this, mapConfig)}>
              <label>${i18next.t(mapConfig.translationTag)}</label>
              <img src=${mapConfig.imgSrc} />
           </div>`
    );
  }

  render() {
    if (this.viewer) {
      return html`<div>${this.mapTemplates}</div>`;
    } else {
      return html``;
    }
  }

  createRenderRoot() {
    return this;
  }
}

customElements.define('ngm-map-chooser', NgmMapChooser);
