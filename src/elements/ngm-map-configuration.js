import {LitElement, html} from 'lit-element';
import i18next from 'i18next';
import {I18nMixin} from '../i18n.js';
import $ from '../jquery.js';
import 'fomantic-ui-css/components/slider.js';
import './map-chooser/ngm-map-chooser.js';
import {syncMapTransparencyParam} from '../permalink.js';

class NgmMapConfiguration extends I18nMixin(LitElement) {
  static get properties() {
    return {
      viewer: {type: Object}
    };
  }

  firstUpdated() {
    this.dispatchEvent(new CustomEvent('rendered'));

    $('#ngm-transparency-slider').slider({
      min: 0.01,
      max: 0.99,
      start: this.viewer.scene.globe.frontFaceAlphaByDistance.nearValue,
      step: 0.01,
      onMove: (val) => {
        this.viewer.scene.globe.frontFaceAlphaByDistance.nearValue = val;
        this.viewer.scene.requestRender();
        syncMapTransparencyParam(val);
      }
    });
  }

  render() {
    return html`
      <div class="ui segment">
        ${i18next.t('map_transparency_label')}
        <div class="ui grey small slider" id="ngm-transparency-slider"></div>
      </div>
      <ngm-map-chooser></ngm-map-chooser>
      `;
  }

  createRenderRoot() {
    return this;
  }
}

customElements.define('ngm-map-configuration', NgmMapConfiguration);
