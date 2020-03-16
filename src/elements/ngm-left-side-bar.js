import {LitElement, html} from 'lit-element';
import {I18nMixin} from '../i18n.js';
import AreaOfInterestDrawer from '../areaOfInterest/AreaOfInterestDrawer.js';
import '../layers/ngm-layers.js';
import '../layers/ngm-catalog.js';
import {defaultLayerTree} from '../constants.js';
import '../layers/ngm-layers.js';
import {getLayerParams, syncLayersParam, getAssetIds} from '../permalink.js';
import {LAYER_TYPES} from '../constants.js';
import {onAccordionClick} from '../utils.js';
import i18next from 'i18next';


class LeftSideBar extends I18nMixin(LitElement) {

  static get properties() {
    return {
      viewer: {type: Object},
      zoomTo: {type: Function},
      catalogLayers: {type: Object},
    };
  }

  constructor() {
    super();
    this.catalogLayers = [...defaultLayerTree];
    this.initializeActiveLayers();
  }

  initializeActiveLayers() {
    const flatLayers = this.getFlatLayers(this.catalogLayers);

    const urlLayers = getLayerParams();
    const assestIds = getAssetIds();

    if (!urlLayers.length && !assestIds.length) {
      this.activeLayers = flatLayers.filter(l => l.displayed);
      syncLayersParam(this.activeLayers);
      return;
    }

    // First - make everything hidden
    flatLayers.forEach(l => {
      l.visible = false;
      l.displayed = false;
    });

    const activeLayers = [];
    urlLayers.forEach(urlLayer => {
      const layer = flatLayers.find(fl => fl.layer === urlLayer.name);
      console.assert(layer);
      layer.visible = urlLayer.visible;
      layer.opacity = urlLayer.opacity;
      layer.displayed = true;
      activeLayers.push(layer);
    });

    assestIds.forEach(assetId => {
      activeLayers.push({
        type: LAYER_TYPES.tiles3d,
        assetId: assetId,
        label: assetId,
        layer: assetId,
        visible: true,
        displayed: true,
        opacityDisabled: true
      });
    });

    this.activeLayers = activeLayers;
    syncLayersParam(this.activeLayers);
  }

  updated() {
    if (this.viewer && !this.aoiDrawer) {
      this.aoiDrawer = new AreaOfInterestDrawer(this.viewer);
    }
  }

  onCatalogLayerClicked(evt) {
    // toggle whether the layer is displayed or not (=listed in the side bar)
    const layer = evt.detail.layer;
    layer.displayed = !layer.displayed;
    layer.visible = layer.displayed;
    const flatLayers = this.getFlatLayers(this.catalogLayers);
    this.activeLayers = flatLayers.filter(l => l.displayed);
    this.catalogLayers = [...this.catalogLayers];
    this.requestUpdate();
  }

  onRemoveDisplayedLayer(evt) {
    const {config, idx} = evt.detail;
    this.activeLayers.splice(idx, 1);
    config.setVisibility(false);
    config.visible = false;
    config.displayed = false;
    if (config.remove) {
      config.remove();
    }
    this.viewer.scene.requestRender();
    syncLayersParam(this.activeLayers);
    this.catalogLayers = [...this.catalogLayers];
    this.activeLayers = [...this.activeLayers];
    this.requestUpdate();
  }

  getFlatLayers(tree) {
    const flat = [];
    for (const layer of tree) {
      if (layer.children) {
        flat.push(...this.getFlatLayers(layer.children));
      } else {
        flat.push(layer);
      }
    }
    return flat;
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
        <div class="content ngm-layer-content">
          <ngm-catalog
            .layers=${this.catalogLayers}
            @layerclick=${this.onCatalogLayerClicked}
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
            @removeDisplayedLayer=${this.onRemoveDisplayedLayer}
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
