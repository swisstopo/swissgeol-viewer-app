// @ts-check

import {html, render} from 'lit-html';
import {layersConfig, layerCategories} from './layerConfigs.js';
import {repeat} from 'lit-html/directives/repeat.js';

import i18next from 'i18next';
import {getLayerParams, syncLayersParam} from '../permalink.js';
import {onAccordionTitleClick, onAccordionIconClick} from '../utils.js';
import {
  create3DTilesetFromConfig, createEarthquakeFromConfig,
  createIonGeoJSONFromConfig,
  createSwisstopoWMTSImageryLayer,
  syncCheckboxes
} from './helpers.js';

export default class LayerTree {
  constructor(viewer, target) {
    this.viewer = viewer;
    this.target = target;

    this.layers = layersConfig;
    this.categories = layerCategories;
    this.layersSynced = false;
    this.layerTree = [];

    this.factories = {
      ionGeoJSON: createIonGeoJSONFromConfig,
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
        layer.displayed = !!layerParams;
        return layer;
      });
    } else {
      this.layers = this.layers.map(layer => {
        return {...layer, displayed: layer.visible};
      });
      syncLayersParam(this.layers);
    }
    this.layersSynced = true;
  }

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

  getLayerRender(config, index, displayedRender = false) {
    if (!config.promise) {
      config.promise = this.factories[config.type](this.viewer, config);
    }
    const changeVisibility = evt => {
      config.setVisibility(evt.target.checked);
      config.visible = evt.target.checked;
      if (evt.target.checked && !config.displayed) {
        config.displayed = true;
      }
      syncLayersParam(this.layers);
      this.viewer.scene.requestRender();
      this.doRender();
    };

    const changeOpacity = evt => {
      config.setOpacity(evt.target.value);
      config.opacity = evt.target.value;
      syncLayersParam(this.layers);
      this.viewer.scene.requestRender();
    };

    const id = `${config.parent}-${(Math.random() * 100).toFixed()}`;

    return html`
    <div class="ngm-displayed-container">
        <div class="ui checkbox">
          <input id="layer-item-${id}" class="ngm-layer-checkbox" type="checkbox" name="${config.layer}"
          .checked=${config.visible}
          @change=${changeVisibility}>
          <label for="layer-item-${id}" data-i18n>${i18next.t(config.label)}</label>
        </div>
        <button class="circular ui icon button mini" ?hidden=${!displayedRender}
            data-tooltip=${i18next.t('remove_btn_tooltip')}
            data-position="top center"
            data-variation="mini"
            @click=${this.removeDisplayed.bind(this, config)}>
          <i class="icon trash alternate outline"></i>
        </button>
    </div>
    <div class="layer-slider" ?hidden=${!config.setOpacity || !displayedRender}>
      <label data-i18n>${i18next.t('opacity_label')}: </label>
      <input type="range" min="0" max="1" value=${config.opacity || 1} @input=${changeOpacity} step="0.05">
    </div>
    `;
  }

  doRender() {
    this.buildLayertree();
    const templates = this.layerTree.map((layerCategory, index) => {

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
      <div class="title ngm-layer-title" @click=${onAccordionTitleClick} data-i18n>
        <i class="dropdown icon" @click=${onAccordionIconClick}></i>
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

    templates.push(this.getDisplayedLayerRender());

    render(templates, this.target);
    syncCheckboxes(this.layers);
  }

  getDisplayedLayerRender() {
    const repeatCallback = (child, idx) => {
      return html`
     ${idx !== 0 ? html`<div class="ui divider ngm-layer-divider"></div>` : ''}
     ${this.getLayerRender(child, idx, true)}
     `;
    };
    const displayedLayers = this.layers.filter(l => l.displayed);
    return html`
      <div class="title ngm-layer-title ngm-gray-title" @click=${onAccordionTitleClick} data-i18n>
        <i class="dropdown icon" @click=${onAccordionIconClick}></i>
       ${i18next.t('displayed_maps_label')}
      </div>
      <div class="content ngm-layer-content">
         <div>
        ${repeat(displayedLayers, (child, indx) => indx, repeatCallback)}
        </div>
      </div>
    `;
  }

  removeDisplayed(layer) {
    layer.setVisibility(false);
    layer.visible = false;
    layer.displayed = false;
    syncLayersParam(this.layers);
    this.viewer.scene.requestRender();
    this.doRender();
  }

  addLayerFromSearch(imageryLayer) {
    this.layers.push({
      type: 'swisstopoWMTS',
      label: imageryLayer.label,
      layer: imageryLayer.layer,
      visible: true,
      displayed: true,
      opacity: 0.7,
    });

    this.doRender();
  }
}
