import {LitElement, html} from 'lit-element';
import i18next from 'i18next';
import {I18nMixin} from '../i18n.js';
import $ from '../jquery.js';
import 'fomantic-ui-css/components/slider.js';
import './ngm-map-chooser.js';
import {syncMapTransparencyParam} from '../permalink.js';

class NgmMapConfiguration extends I18nMixin(LitElement) {
  static get properties() {
    return {
      viewer: {type: Object},
      mapChooser: {type: Function}
    };
  }

  firstUpdated() {
    this.mapChooser.initMapChooser(this.querySelector('ngm-map-chooser'));

    $('#ngm-transparency-slider').slider({
      min: 0,
      max: 1,
      start: 1 - this.viewer.scene.globe.translucency.frontFaceAlpha,
      step: 0.01,
      onMove: (val) => {
        if (val === 0) {
          this.viewer.scene.globe.translucency.enabled = false;
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
    });
  }

  render() {
    return html`
      <ngm-map-chooser></ngm-map-chooser>
      <div class="ngm-displayed-container">
        <label>${i18next.t('dtd_transparency_label')}</label>
        <div class="ui grey small slider" id="ngm-transparency-slider"></div>
      </div>
      `;
  }

  createRenderRoot() {
    return this;
  }
}

customElements.define('ngm-map-configuration', NgmMapConfiguration);
