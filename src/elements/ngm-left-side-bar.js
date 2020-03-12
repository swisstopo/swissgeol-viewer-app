import {LitElement, html} from 'lit-element';
import {I18nMixin} from '../i18n.js';
import {onAccordionClick} from '../utils.js';
import i18next from 'i18next';
import AreaOfInterestDrawer from '../areaOfInterest/AreaOfInterestDrawer.js';
import '../layers/ngm-layers.js';
import '../layers/ngm-catalog.js';
import {defaultLayerTree} from '../constants.js';
import '../layers/ngm-layers.js';


class LeftSideBar extends I18nMixin(LitElement) {

  static get properties() {
    return {
      viewer: {type: Object},
      zoomTo: {type: Function},
    };
  }

  constructor() {
    super();
    this.catalogLayers = [...defaultLayerTree];
    this.activeLayers = this.getActiveLayers(this.catalogLayers);
  }

  updated() {
    if (this.viewer && !this.aoiDrawer) {
      this.aoiDrawer = new AreaOfInterestDrawer(this.viewer);
    }
  }

  fullRender() {
    this.catalogLayers = [...this.catalogLayers];
    this.activeLayers = this.getActiveLayers(this.catalogLayers);
    this.requestUpdate();
  }

  getActiveLayers(tree) {
    const actives = [];
    for (const layer of tree) {
      if (layer.children) {
        actives.push(...this.getActiveLayers(layer.children));
      } else if (layer.displayed) {
        actives.push(layer);
      }
    }
    return actives;
  }

  render() {
    if (!this.viewer) {
      return '';
    }

    return html`
    <div class="left sidebar">

      <div class="ui styled accordion">
        <div class="title" @click=${onAccordionClick}>
          <i class="dropdown icon"></i>
          ${i18next.t('geocatalog_label')}
        </div>
        <div class="content">
          <ngm-catalog
            .layers=${this.catalogLayers}
            .onclick=${() => this.fullRender()}
            .viewer=${this.viewer}
            .zoomTo=${this.zoomTo}></ngm-catalog>
        </div>
      </div>

      <div class="ui styled accordion">
        <div class="title active" @click=${onAccordionClick}>
          <i class="dropdown icon"></i>
          ${i18next.t('displayed_maps_label')}
        </div>
        <div class="content active">
          <ngm-layers
            .removeDisplayed=${() => this.fullRender()}
            .layers=${this.activeLayers}
            .viewer=${this.viewer}
            .zoomTo=${this.zoomTo}></ngm-layers>
        </div>
      </div>

      <div class="ui styled accordion">
        <div class="title" @click=${onAccordionClick}>
          <i class="dropdown icon"></i>
          ${i18next.t('aoi_section_title')}
        </div>
        <div class="content">
          <div id="areasOfInterest"></div>
        </div>
      </div>

      <div class="ui styled accordion">
        <div class="title" @click=${onAccordionClick}>
          <i class="dropdown icon"></i>
          ${i18next.t('gst_accordion_title')}
        </div>
        <div class="content">
          <ngm-gst-interaction .viewer=${this.viewer}></ngm-gst-interaction>,
        </div>
      </div>
    `;
  }
  createRenderRoot() {
    return this;
  }
}

customElements.define('ngm-left-side-bar', LeftSideBar);
