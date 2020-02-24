// @ts-check

import {html, render} from 'lit-html';
import {layersConfig, layerCategories} from './layerConfigs.js';
import {repeat} from 'lit-html/directives/repeat';

import i18next from 'i18next';
import {getLayerParams, syncLayersParam} from '../permalink';
import {onAccordionTitleClick, onAccordionIconClick} from '../utils.js';
import {
  create3DTilesetFromConfig, createEarthquakeFromConfig,
  createIon3DTilesetFromConfig,
  createIonGeoJSONFromConfig,
  createSwisstopoWMTSImageryLayer
} from './helpers.js';

export default class LayerTree {
  constructor(viewer, target) {
    this.viewer = viewer;
    this.target = target;

    this.layers = layersConfig;
    this.categories = layerCategories;
    this.displayedLayers = [];
    this.layersSynced = false;

    this.factories = {
      ionGeoJSON: createIonGeoJSONFromConfig,
      ion3dtiles: createIon3DTilesetFromConfig,
      '3dtiles': create3DTilesetFromConfig,
      swisstopoWMTS: createSwisstopoWMTSImageryLayer,
      earthquakes: createEarthquakeFromConfig,
    };

    this.doRender();
    i18next.on('languageChanged', options => {
      this.doRender();
    });
  }

  syncLayers() {
    if (this.layersSynced) return;
    const displayedLayers = getLayerParams();
    if (displayedLayers && displayedLayers.length) {
      this.layers = this.layers.map(layer => {
        const layerParams = displayedLayers.find(dl => dl.name === layer.layer);
        layer.visible = layerParams ? layerParams.visible : false;
        layer.opacity = layerParams ? layerParams.opacity : 1;
        if (layerParams) {
          this.displayedLayers.push(layer);
        }
        return layer;
      });
    } else {
      this.displayedLayers = this.layers.filter(layer => layer.visible);
      syncLayersParam(this.displayedLayers);
    }
    this.layersSynced = true;
  }

  buildLayertree() {
    this.syncLayers();
    const generalConfig = [...this.categories, ...this.layers];

    const notEmptyCategories = this.categories.filter(cat =>
      generalConfig.some(l => l.parent === cat.id));

    const layerTree = notEmptyCategories.map(cat => {
      const childCategories = notEmptyCategories.filter(c => c.parent === cat.id);
      const childLayers = this.layers.filter(l => l.parent === cat.id);
      cat.children = [...childLayers, ...childCategories];
      return cat;
    });

    return layerTree.filter(cat => !cat.parent && cat.children.length);
  }

  getLayerRender(config, index, displayedRender = false) {
    if (!config.promise) {
      config.promise = this.factories[config.type](this.viewer, config);
    }
    const changeVisibility = evt => {
      config.setVisibility(evt.target.checked);
      config.visible = evt.target.checked;
      if (evt.target.checked && !this.displayedLayers.includes(config)) {
        this.displayedLayers.push(config);
      }
      syncLayersParam(this.displayedLayers);
      this.viewer.scene.requestRender();
      this.doRender();
    };
    const changeOpacity = evt => {
      config.setOpacity(evt.target.value);
      config.opacity = evt.target.value;
      syncLayersParam(this.displayedLayers);
      this.viewer.scene.requestRender();
    };


    return html`
    <div class="ui checkbox">
      <input id="layer-item-${config.parent}-${index}" type="checkbox" ?checked=${config.visible} @change=${changeVisibility}>
      <label for="layer-item-${config.parent}-${index}" data-i18n>${i18next.t(config.label)}</label>
    </div>
    <div class="layer-slider" ?hidden=${!config.setOpacity || !displayedRender}>
      <label>Opacity: </label>
      <input type="range" min="0" max="1" value=${config.opacity || 1} @input=${changeOpacity} step="0.05">
    </div>
    `;
  }

  doRender() {
    const layerTree = this.buildLayertree();
    const templates = layerTree.map((layerCategory, index) => {

      const repeatCallback = (child, idx) => {
        const isLayer = !!child.layer;
        return html`
      ${idx !== 0 ? html`<div class="ui divider ngm-layer-divider"></div>` : ''}
      ${isLayer ?
          html`<div>${this.getLayerRender(child, idx)}</div>` :
          html`<div class="ui styled accordion ngm-layers-categories">${categoryRender(child)}</div>`
        }`;
      };

      const categoryRender = (layerCat) => html`
      <div class="title ngm-layer-title" @click=${onAccordionTitleClick} data-i18n>
        <i class="dropdown icon" @click=${onAccordionIconClick}></i>
        ${i18next.t(layerCat.label)}
      </div>
      <div class="content ngm-layer-content">
         <div>
        ${repeat(layerCat.children, (child) => child.id || Number((Math.random() * 100).toFixed()), repeatCallback)}
        </div>
      </div>
    `;
      return categoryRender(layerCategory);
    });
    const displayedLayersTemplate = this.getDisplayedLayerRender();
    render([...templates, displayedLayersTemplate], this.target);
  }

  getDisplayedLayerRender() {
    const repeatCallback = (child, idx) => {
      return html`
     ${idx !== 0 ? html`<div class="ui divider ngm-layer-divider"></div>` : ''}
     ${this.getLayerRender(child, idx, true)}
     `;
    };
    return html`
      <div class="title ngm-layer-title" @click=${onAccordionTitleClick} data-i18n>
        <i class="dropdown icon" @click=${onAccordionIconClick}></i>
        Displayed <!--TODO-->
      </div>
      <div class="content ngm-layer-content">
         <div>
        ${repeat(this.displayedLayers, (child) => Number((Math.random() * 100).toFixed()), repeatCallback)}
        </div>
      </div>
    `;
  }
}
