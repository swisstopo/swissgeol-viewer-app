import {html} from 'lit';
import i18next from 'i18next';
import {LitElementI18n} from '../i18n.js';
import $ from '../jquery.js';
import 'fomantic-ui-css/components/slider.js';
import './ngm-map-chooser';
import {getMapTransparencyParam, syncMapTransparencyParam} from '../permalink.js';
import MainStore from '../store/main';

class NgmMapConfiguration extends LitElementI18n {

  constructor() {
    super();
    /**
     * @type {import('cesium').Viewer}
     */
    this.viewer = null;
    this.mapChooser = null;

    MainStore.viewer.subscribe(viewer => this.viewer = viewer);
    MainStore.mapChooser.subscribe(chooser => {
      this.mapChooser = chooser;
      this.requestUpdate();
    });
  }


  updateTransparency(selectedMap) {
    const val = this.transparencySlider.slider('get value');
    if (val === 0) {
      this.viewer.scene.globe.translucency.enabled = !!selectedMap.hasAlphaChannel;
      this.viewer.scene.globe.translucency.backFaceAlpha = 1;
    } else {
      this.viewer.scene.globe.translucency.backFaceAlpha = 0;
      this.viewer.scene.globe.translucency.frontFaceAlpha = 1 - val;
      if (!this.viewer.scene.globe.translucency.enabled) {
        this.viewer.scene.globe.translucency.enabled = true;
      }
    }
    this.viewer.scene.requestRender();
    syncMapTransparencyParam(val);
  }


  firstUpdated() {
    this.mapChooser.addMapChooser(this.querySelector('ngm-map-chooser'));

    const transparencyParam = getMapTransparencyParam();
    const transparency = !isNaN(transparencyParam) ? 1 - transparencyParam : 0.6;

    this.transparencySlider = $(this.querySelector('.slider'));
    this.transparencySlider.slider({
      min: 0,
      max: 1,
      start: 1 - transparency,
      step: 0.01,
      onMove: () => this.updateTransparency(this.mapChooser.selectedMap)
    });
  }

  render() {
    return html`
      <ngm-map-chooser @change="${(event) => this.updateTransparency(event.detail.active)}"></ngm-map-chooser>
      <div class="ngm-displayed-container">
        <label>${i18next.t('dtd_transparency_label')}</label>
        <div class="ui grey small slider"></div>
      </div>
    `;
  }

  createRenderRoot() {
    return this;
  }
}

customElements.define('ngm-map-configuration', NgmMapConfiguration);
