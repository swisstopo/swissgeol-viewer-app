// @ts-check

import {html, render} from 'lit-html';
import {layersConfig, layerCategories} from './layerConfigs.js';
import {repeat} from 'lit-html/directives/repeat.js';

import i18next from 'i18next';
import {getLayerParams, syncLayersParam, getAssetIds} from '../permalink.js';
import {onAccordionClick, insertAndShift} from '../utils.js';
import {
  create3DTilesetFromConfig, createEarthquakeFromConfig,
  createIonGeoJSONFromConfig,
  createSwisstopoWMTSImageryLayer,
  syncCheckboxes
} from './helpers.js';
import {LAYER_TYPES, DEFAULT_LAYER_OPACITY} from '../constants.js';
import Cartesian3 from 'cesium/Core/Cartesian3';
import Color from 'cesium/Core/Color.js';

export default class LayerTree {
  constructor(viewer, target, zoomTo) {
    this.viewer = viewer;
    this.target = target;

    this.layers = layersConfig;
    this.categories = layerCategories;
    this.layersSynced = false;
    this.layerTree = [];
    this.zoomTo = zoomTo;

    this.factories = {
      [LAYER_TYPES.ionGeoJSON]: createIonGeoJSONFromConfig,
      [LAYER_TYPES.tiles3d]: create3DTilesetFromConfig,
      [LAYER_TYPES.swisstopoWMTS]: createSwisstopoWMTSImageryLayer,
      [LAYER_TYPES.earthquakes]: createEarthquakeFromConfig,
    };

    this.boundingSphereEntity = this.viewer.entities.add({
      position: Cartesian3.ZERO,
      show: false,
      ellipsoid: {
        material: Color.RED.withAlpha(0.5),
        radii: new Cartesian3(1, 1, 1),
      }
    });

    this.doRender();
    i18next.on('languageChanged', options => {
      this.doRender();
    });
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
            opacityDisabled: true,
            pickable: true
          });
        });
      }
    }
    // if no url params - adds visible layers from config to 'Displayed Layers'
    if (!displayedLayers.length && !assestIds.length) {
      this.layers = this.layers.map(layer => {
        return {...layer, displayed: layer.visible};
      });
      syncLayersParam(this.displayedLayers());
    }
    this.layersSynced = true;
  }

  // builds structure of layers and categories
  buildLayertree() {
    this.syncLayers();
    const generalConfig = [...this.categories, ...this.layers];

    const notEmptyCategories = this.categories.filter(cat =>
      generalConfig.some(l => l.parent === cat.id));

    this.layerTree = notEmptyCategories.map(cat => {
      const childCategories = notEmptyCategories.filter(c => c.parent === cat.id);
      const childLayers = this.layers.filter(l => l.parent === cat.id);
      cat.children = [...childLayers, ...childCategories];
      return cat;
    });

    this.layerTree = this.layerTree.filter(cat => !cat.parent && cat.children.length);
  }

  // builds html container for layer
  getLayerRender(config, index, displayedRender = false) {
    if (!config.promise) {
      config.promise = this.factories[config.type](this.viewer, config);
    }
    const changeVisibility = evt => {
      config.setVisibility(evt.target.checked);
      config.visible = evt.target.checked;
      if (evt.target.checked && !config.displayed) {
        if (config.type === LAYER_TYPES.swisstopoWMTS) config.add(0);
        config.displayed = true;
      }
      syncLayersParam(this.displayedLayers());
      this.viewer.scene.requestRender();
      this.doRender();
    };

    const changeOpacity = evt => {
      const opacity = Number(evt.target.value);
      config.setOpacity(opacity);
      config.opacity = opacity;
      syncLayersParam(this.displayedLayers());
      this.viewer.scene.requestRender();
      this.doRender();
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
        <div class="ui icon buttons compact mini" ?hidden=${!displayedRender}>
            <button class="ui button"
            data-tooltip=${i18next.t('zoom_to')}
            data-position="top center"
            data-variation="mini"
            @click=${this.zoomTo.bind(this, config)}>
              <i class="search plus icon"></i>
            </button>
            <button class="ui button"
            data-tooltip=${i18next.t('layer_up')}
            data-position="top center"
            data-variation="mini"
            @click=${this.changeOrder.bind(this, config, true)}>
              <i class="angle up icon"></i>
            </button>
            <button class="ui button"
            data-tooltip=${i18next.t('layer_down')}
            data-position="top center"
            data-variation="mini"
            @click=${this.changeOrder.bind(this, config, false)}>
              <i class="angle down icon"></i>
            </button>
            <button class="ui button"
            data-tooltip=${i18next.t('remove_btn_tooltip')}
            data-position="top center"
            data-variation="mini"
            @click=${this.removeDisplayed.bind(this, config)}>
          <i class="icon trash alternate outline"></i>
        </button>
        </div>
    </div>
    <div class="ngm-displayed-container" ?hidden=${!config.setOpacity || !displayedRender}>
      <label>${i18next.t('opacity_label')}: </label>
      <input type="range" min="0" max="1" .value=${config.opacity || 1} @input=${changeOpacity} step="0.05">
    </div>
    `;
  }

  // builds ui structure of layertree and makes render
  doRender() {
    this.buildLayertree();
    const templates = this.layerTree.map((layerCategory, index) => {

      // returns category content
      const repeatCallback = (child, idx) => {
        const layer = this.layers.find(l => child.layer && l.layer === child.layer);
        return html`
      ${idx !== 0 ? html`<div class="ui divider ngm-layer-divider"></div>` : ''}
      ${layer ?
          html`<div>${this.getLayerRender(layer, idx)}</div>` :
          html`<div class="ui styled accordion ngm-layers-categories">${categoryRender(child)}</div>`
        }`;
      };

      const categoryRender = (layerCat) => html`
      <div class="title ngm-layer-title" @click=${onAccordionClick}>
        <i class="dropdown icon"></i>
        ${i18next.t(layerCat.label)}
      </div>
      <div class="content ngm-layer-content">
         <div>
        ${repeat(layerCat.children, (child, indx) => indx, repeatCallback)}
        </div>
      </div>
    `;
      return categoryRender(layerCategory);
    });

    // gets html container for 'Displayed Layers'
    templates.push(this.getDisplayedLayerRender());

    render(templates, this.target);
    syncCheckboxes(this.layers);
  }

  // builds html container for 'Displayed Layers'
  getDisplayedLayerRender() {
    const repeatCallback = (child, idx) => {
      return html`
     ${idx !== 0 ? html`<div class="ui divider ngm-layer-divider"></div>` : ''}
     ${this.getLayerRender(child, idx, true)}
     `;
    };
    const displayedLayers = this.displayedLayers();
    return html`
      <div class="title ngm-layer-title active" @click=${onAccordionClick}>
        <i class="dropdown icon"></i>
       ${i18next.t('displayed_maps_label')}
      </div>
      <div class="content ngm-layer-content active">
         <div>
        ${repeat(displayedLayers, (child, indx) => indx, repeatCallback)}
        </div>
      </div>
    `;
  }

  // removes layer from 'Displayed Layers'
  removeDisplayed(layer) {
    layer.setVisibility(false);
    layer.visible = false;
    layer.displayed = false;
    if (layer.type === LAYER_TYPES.swisstopoWMTS) {
      layer.remove();
    }
    syncLayersParam(this.displayedLayers());
    this.viewer.scene.requestRender();
    this.doRender();
  }

  // adds layer from search to 'Displayed Layers'
  addLayerFromSearch(searchLayer) {
    let layer;
    if (searchLayer.dataSourceName) {
      layer = this.layers.find(l => l.type === searchLayer.dataSourceName); // check for layers like earthquakes
    } else {
      layer = this.layers.find(l => l.layer === searchLayer.layer); // check for swisstopoWMTS layers
    }

    const displayedLayers = this.displayedLayers();
    if (layer) { // for layers added before
      if (layer.type === LAYER_TYPES.swisstopoWMTS) {
        const index = displayedLayers.indexOf(layer);
        insertAndShift(displayedLayers, index, 0);
        displayedLayers.forEach((l, idx) => l.position = idx);
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
      displayedLayers.forEach((layer, idx) => layer.position = idx); // updates layers order in 'Displayed Layers'
    }
    this.doRender();
  }

  // changes layer position in 'Displayed Layers'
  changeOrder(config, up) {
    const displayedLayers = this.displayedLayers();
    const index = displayedLayers.indexOf(config);
    if ((up && index > 0) || (!up && index < displayedLayers.length - 1)) {
      const toIndex = up ? index - 1 : index + 1;
      insertAndShift(displayedLayers, index, toIndex);
    }
    displayedLayers.forEach((layer, idx) => layer.position = idx); // updates layers order in 'Displayed Layers'

    if (config.type === LAYER_TYPES.swisstopoWMTS) { // also change swisstopoWMTS layers order on the terrain
      const swisstopoLayers = this.displayedSwisstopoLayers;
      if (swisstopoLayers.length) {
        const swisstopoIndex = swisstopoLayers.indexOf(config);
        if (swisstopoIndex >= 0) {
          config.remove();
          config.add(swisstopoIndex);
        }
      }
    }

    syncLayersParam(this.displayedLayers());
    this.doRender();
  }

  // gets list of displayed layers
  displayedLayers() {
    const displayed = this.layers.filter(l => l.displayed);
    return displayed.sort((currLayer, nextLayer) => currLayer.position - nextLayer.position);
  }

  // gets list of swisstopoWMTS layers
  get displayedSwisstopoLayers() {
    return this.displayedLayers().filter(dl => dl.type === LAYER_TYPES.swisstopoWMTS)
      .sort((currLayer, nextLayer) => currLayer.position - nextLayer.position);
  }
}
