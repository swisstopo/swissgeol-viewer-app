// @ts-check

import i18next from 'i18next';
import {getLayerParams, syncLayersParam, getAssetIds} from '../permalink.js';
import {insertAndShift} from '../utils.js';
import {
  createCesiumObject,
} from './helpers.js';
import {LAYER_TYPES, DEFAULT_LAYER_OPACITY} from '../constants.js';
import Cartesian3 from 'cesium/Core/Cartesian3';
import Color from 'cesium/Core/Color.js';
import {html, LitElement} from 'lit-element';
import {I18nMixin} from '../i18n.js';

import {classMap} from 'lit-html/directives/class-map';

export default class LayerTree extends I18nMixin(LitElement) {

  static get properties() {
    return {
      viewer: {type: Object},
      zoomTo: {type: Function},
      layers: {type: Object},
      removeDisplayed: {type: Function},
    };
  }

  createRenderRoot() {
    return this;
  }

  constructor() {
    super();

    this.layersSynced = false;
  }


  updated() {
    if (this.viewer && !this.boundingSphereEntity) {
      this.boundingSphereEntity = this.viewer.entities.add({
        position: Cartesian3.ZERO,
        show: false,
        ellipsoid: {
          material: Color.RED.withAlpha(0.5),
          radii: new Cartesian3(1, 1, 1),
        }
      });
    }
  }

  // adds layers from url params on first run
  syncLayers() {
    if (this.layersSynced) return;
    const displayedLayers = getLayerParams();
    const assestIds = getAssetIds();
    // adds layers from url params to 'Displayed Layers' (only configured in config)
    if (displayedLayers.length || assestIds.length) {
      this.layers = this.layers.map(layer => {
        const layerParams = displayedLayers.find(dl => dl.name === layer.layer);
        return {
          ...layer,
          ...layerParams,
          visible: layerParams ? layerParams.visible : false,
          opacity: layerParams ? layerParams.opacity : DEFAULT_LAYER_OPACITY,
          displayed: !!layerParams,
        };
      });
      // adds custom Cesium ion assets from url params to 'Displayed Layers'
      if (assestIds.length) {
        // add Cesium ion assets
        assestIds.forEach(assetId => {
          this.layers.push({
            type: LAYER_TYPES.tiles3d,
            assetId: assetId,
            label: assetId,
            layer: assetId,
            visible: true,
            displayed: true,
            opacityDisabled: true
          });
        });
      }
    }
    // if no url params - adds visible layers from config to 'Displayed Layers'
    if (!displayedLayers.length && !assestIds.length) {
      this.layers = this.layers.map(layer => {
        return {...layer, displayed: layer.visible};
      });
      syncLayersParam(this.layers);
    }
    this.layersSynced = true;
  }

  // builds html container for layer
  getLayerRender(config, idx) {
    if (!config.promise) {
      config.promise = createCesiumObject(this.viewer, config);
    }
    const changeVisibility = evt => {
      config.setVisibility(evt.target.checked);
      config.visible = evt.target.checked;
      if (evt.target.checked && !config.displayed) {
        if (config.type === LAYER_TYPES.swisstopoWMTS) config.add(0);
        config.displayed = true;
      }
      syncLayersParam(this.layers);
      this.viewer.scene.requestRender();
      this.requestUpdate();
    };

    const changeOpacity = evt => {
      const opacity = Number(evt.target.value);
      config.setOpacity(opacity);
      config.opacity = opacity;
      syncLayersParam(this.layers);
      this.viewer.scene.requestRender();
      this.requestUpdate();
    };


    const mouseEnter = async () => {
      const p = await config.promise;
      const b = p.boundingSphere;
      if (b) {
        this.boundingSphereEntity.position = b.center;
        this.boundingSphereEntity.ellipsoid.radii = new Cartesian3(b.radius, b.radius, b.radius);
        this.boundingSphereEntity.show = true;
        this.viewer.scene.requestRender();
      }
    };
    const mouseLeave = () => {
      if (this.boundingSphereEntity.show) {
        this.boundingSphereEntity.show = false;
        this.viewer.scene.requestRender();
      }
    };
    const id = `${config.parent}-${(Math.random() * 100).toFixed()}`;


    // removes layer from 'Displayed Layers'
    const removeDisplayed = () => {
      config.setVisibility(false);
      config.visible = false;
      config.displayed = false;
      if (config.type === LAYER_TYPES.swisstopoWMTS) {
        config.remove();
      }
      const idx = this.layers.findIndex(l => l.label === config.label);
      this.layers.splice(idx, 1);
      syncLayersParam(this.layers);
      this.viewer.scene.requestRender();
      this.removeDisplayed(config);
    };

    const upClassMap = {disabled: idx === 0};
    const downClassMap = {disabled: (idx === this.layers.length - 1)};

    return html`
    <div class="ngm-displayed-container"
        @mouseenter=${mouseEnter}
        @mouseleave=${mouseLeave}>
        <div class="ui checkbox">
          <input id="layer-item-${id}" class="ngm-layer-checkbox" type="checkbox" name="${config.layer}"
          .checked=${config.visible}
          @change=${changeVisibility}>
          <label for="layer-item-${id}">${i18next.t(config.label)}</label>
        </div>
        <div class="ui icon buttons compact mini">
            <button class="ui button"
            data-tooltip=${i18next.t('zoom_to')}
            data-position="top center"
            data-variation="mini"
            @click=${this.zoomTo.bind(this, config)}>
              <i class="search plus icon"></i>
            </button>
            <button class="ui button ${classMap(upClassMap)}"
            data-tooltip=${i18next.t('layer_up')}
            data-position="top center"
            data-variation="mini"
            @click=${this.moveLayer.bind(this, config, -1)}>
              <i class="angle up icon"></i>
            </button>
            <button class="ui button ${classMap(downClassMap)}"
            data-tooltip=${i18next.t('layer_down')}
            data-position="top center"
            data-variation="mini"
            @click=${this.moveLayer.bind(this, config, +1)}>
              <i class="angle down icon"></i>
            </button>
            <button class="ui button"
            data-tooltip=${i18next.t('remove_btn_tooltip')}
            data-position="top center"
            data-variation="mini"
            @click=${removeDisplayed}>
          <i class="icon trash alternate outline"></i>
        </button>
        </div>
    </div>
    <div class="ngm-displayed-container" ?hidden=${!config.setOpacity}>
      <label>${i18next.t('opacity_label')}: </label>
      <input type="range" min="0" max="1" .value=${config.opacity || 1} @input=${changeOpacity} step="0.05">
    </div>
    `;
  }

  // builds ui structure of layertree and makes render
  render() {
    return html`${this.layers.map((l, idx) => this.getLayerRender(l, idx))}`;
    // FIXME what's this?  syncCheckboxes(this.layers);
  }


  // adds layer from search to 'Displayed Layers'
  addLayerFromSearch(searchLayer) {
    let layer;
    if (searchLayer.dataSourceName) {
      layer = this.layers.find(l => l.type === searchLayer.dataSourceName); // check for layers like earthquakes
    } else {
      layer = this.layers.find(l => l.layer === searchLayer.layer); // check for swisstopoWMTS layers
    }

    if (layer) { // for layers added before
      if (layer.type === LAYER_TYPES.swisstopoWMTS) {
        const index = this.layers.indexOf(layer);
        insertAndShift(this.layers, index, 0);
        layer.add(0);
      }
      layer.setVisibility(true);
      layer.visible = true;
      layer.displayed = true;
      this.viewer.scene.requestRender();
    } else { // for new layers
      this.layers.unshift({
        type: LAYER_TYPES.swisstopoWMTS,
        label: searchLayer.title,
        layer: searchLayer.layer,
        visible: true,
        displayed: true,
        opacity: DEFAULT_LAYER_OPACITY
      });
    }
    this.requestUpdate();
  }

  // changes layer position in 'Displayed Layers'
  moveLayer(config, delta) {
    console.assert(delta === -1 || delta === 1);
    const previousIndex = this.layers.indexOf(config);
    const toIndex = previousIndex + delta;
    if (toIndex < 0 || toIndex > this.layers.length - 1) {
      // should not happen with proper UI
      return;
    }

    // Swap values
    const otherConfig = this.layers[toIndex];
    this.layers[toIndex] = this.layers[previousIndex];
    this.layers[previousIndex] = otherConfig;

    // FIXME: this is nonsensical, all imageries should be handled
    // permute imageries order
    if (config.type === LAYER_TYPES.swisstopoWMTS && otherConfig.type === LAYER_TYPES.swisstopoWMTS) {
      const imageries = this.viewer.scene.imageryLayers;
      config.promise.then(i => {
        if (delta < 0) {
          imageries.lower(i);
        } else {
          imageries.raise(i);
        }
      });
    }

    syncLayersParam(this.layers);
    this.requestUpdate();
  }
}

customElements.define('ngm-layers', LayerTree);
