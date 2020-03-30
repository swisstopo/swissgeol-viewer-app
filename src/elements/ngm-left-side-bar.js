import {LitElement, html} from 'lit-element';
import {I18nMixin} from '../i18n.js';
import AreaOfInterestDrawer from '../areaOfInterest/AreaOfInterestDrawer.js';
import '../layers/ngm-layers.js';
import '../layers/ngm-catalog.js';
import {LAYER_TYPES, DEFAULT_LAYER_OPACITY, defaultLayerTree} from '../constants.js';
import {getLayerParams, syncLayersParam, getAssetIds} from '../permalink.js';
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

  initializeActiveLayers() {
    const flatLayers = LeftSideBar.getFlatLayers(this.catalogLayers);

    const urlLayers = getLayerParams();
    const assetIds = getAssetIds();

    if (!urlLayers.length && !assetIds.length) {
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
      let layer = flatLayers.find(fl => fl.layer === urlLayer.name);
      if (!layer) {
        // Layers from the search are not present in the flat layers.
        layer = LeftSideBar.createSearchLayer(urlLayer.name, urlLayer.name);
      }
      layer.visible = urlLayer.visible;
      layer.opacity = urlLayer.opacity;
      layer.displayed = true;
      activeLayers.push(layer);
    });

    assetIds.forEach(assetId => {
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

  update(changedProperties) {
    if (!this.catalogLayers) {
      this.catalogLayers = [...defaultLayerTree];
      this.initializeActiveLayers();
    }
    super.update(changedProperties);
  }

  updated(changedProperties) {
    if (this.viewer && !this.aoiDrawer) {
      this.aoiDrawer = new AreaOfInterestDrawer(this.viewer);
    }

    super.updated(changedProperties);
  }

  onCatalogLayerClicked(evt) {
    // toggle whether the layer is displayed or not (=listed in the side bar)
    const layer = evt.detail.layer;
    if (!layer.displayed && layer.type === LAYER_TYPES.swisstopoWMTS) {
      layer.add();
      layer.setVisibility(true);
    }
    layer.displayed = !layer.displayed;
    layer.visible = layer.displayed;
    const flatLayers = LeftSideBar.getFlatLayers(this.catalogLayers);
    this.activeLayers = flatLayers.filter(l => l.displayed);
    syncLayersParam(this.activeLayers);
    this.catalogLayers = [...this.catalogLayers];
    this.requestUpdate();
  }

  onLayerChanged() {
    this.catalogLayers = [...this.catalogLayers];
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

  static getFlatLayers(tree) {
    const flat = [];
    for (const layer of tree) {
      if (layer.children) {
        flat.push(...LeftSideBar.getFlatLayers(layer.children));
      } else {
        flat.push(layer);
      }
    }
    return flat;
  }


  // adds layer from search to 'Displayed Layers'
  addLayerFromSearch(searchLayer) {
    let layer;
    if (searchLayer.dataSourceName) {
      layer = this.activeLayers.find(l => l.type === searchLayer.dataSourceName); // check for layers like earthquakes
    } else {
      layer = this.activeLayers.find(l => l.layer === searchLayer.layer); // check for swisstopoWMTS layers
    }

    if (layer) { // for layers added before
      if (layer.type === LAYER_TYPES.swisstopoWMTS) {
        const index = this.activeLayers.indexOf(layer);
        this.activeLayers.splice(index, 1);
        layer.remove();
        layer.add(0);
        this.activeLayers.push(layer);
      }
      layer.setVisibility(true);
      layer.visible = true;
      layer.displayed = true;
      this.viewer.scene.requestRender();
    } else { // for new layers
      this.activeLayers.push(LeftSideBar.createSearchLayer(searchLayer.title, searchLayer.layer));
    }
    this.activeLayers = [...this.activeLayers];
    syncLayersParam(this.activeLayers);
    this.requestUpdate();
  }

  static createSearchLayer(title, layer) {
    return {
      type: LAYER_TYPES.swisstopoWMTS,
      label: title,
      layer: layer,
      visible: true,
      displayed: true,
      opacity: DEFAULT_LAYER_OPACITY
    };
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
            .viewer=${this.viewer}>
          </ngm-catalog>
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
            @layerChanged=${this.onLayerChanged}
            .layers=${this.activeLayers}
            .viewer=${this.viewer}
            @zoomTo=${evt => this.zoomTo(evt.detail)}>
          </ngm-layers>
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
          <ngm-gst-interaction .viewer=${this.viewer}></ngm-gst-interaction>
        </div>
      </div>
    `;
  }
  createRenderRoot() {
    return this;
  }
}

customElements.define('ngm-left-side-bar', LeftSideBar);
