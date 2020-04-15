// @ts-check

import i18next from 'i18next';
import {syncLayersParam} from '../permalink.js';
import {html, LitElement} from 'lit-element';
import {I18nMixin} from '../i18n.js';

import {classMap} from 'lit-html/directives/class-map';

import LayersActions from './LayersActions.js';

class LayerTreeItem extends I18nMixin(LitElement) {

  static get properties() {
    return {
      actions: {type: Object},
      config: {type: Object},
      upClassMap: {type: Object},
      downClassMap: {type: Object},
    };
  }

  createRenderRoot() {
    return this;
  }

  changeVisibility(evt) {
    this.actions.changeVisibility(this.config, evt.target.checked);
    this.dispatchEvent(new CustomEvent('layerChanged'));
  }

  changeOpacity(evt) {
    this.actions.changeOpacity(this.config, Number(evt.target.value));
    this.dispatchEvent(new CustomEvent('layerChanged'));
  }

  onLabelClicked(evt) {
    const input = evt.target.previousElementSibling;
    input.checked = !input.checked;
    input.dispatchEvent(new Event('change'));
    this.requestUpdate();
  }

  onRemove() {
    this.dispatchEvent(new CustomEvent('removeDisplayedLayer'));
  }


  render() {
    return html`
      <div class="ngm-displayed-container">
        <div class="ui checkbox">
          <input class="ngm-layer-checkbox" type="checkbox"
            .checked=${this.config.visible}
            @change=${this.changeVisibility}>
          <label @click=${this.onLabelClicked}>${i18next.t(this.config.label)}</label>
        </div>
        <div class="ui icon buttons compact mini">
            <button class="ui button"
            data-tooltip=${i18next.t('zoom_to')}
            data-position="top left"
            data-variation="mini"
            @click=${() => this.dispatchEvent(new CustomEvent('zoomTo'))}>
              <i class="search plus icon"></i>
            </button>
            <button class="ui button ${classMap(this.upClassMap)}"
            data-tooltip=${i18next.t('layer_up')}
            data-position="top center"
            data-variation="mini"
            @click=${() => this.dispatchEvent(new CustomEvent('moveLayer', {detail: -1}))}>
              <i class="angle down icon"></i>
            </button>
            <button class="ui button ${classMap(this.downClassMap)}"
            data-tooltip=${i18next.t('layer_down')}
            data-position="top center"
            data-variation="mini"
            @click=${() => this.dispatchEvent(new CustomEvent('moveLayer', {detail: +1}))}>
              <i class="angle up icon"></i>
            </button>
            <button class="ui button"
            data-tooltip=${i18next.t('remove_btn_tooltip')}
            data-position="top right"
            data-variation="mini"
            @click=${this.onRemove}>
          <i class="icon trash alternate outline"></i>
        </button>
        </div>
    </div>
    <div class="ngm-displayed-container" ?hidden=${!this.config.setOpacity}>
      <label>${i18next.t('opacity_label')}: </label>
      <input
       type="range" min="0" max="1" .value=${this.config.opacity || 1}
       @input=${this.changeOpacity} step="0.05">
    </div>
    `;
  }
}

customElements.define('ngm-layers-item', LayerTreeItem);


export default class LayerTree extends I18nMixin(LitElement) {

  static get properties() {
    return {
      viewer: {type: Object},
      layers: {type: Object},
    };
  }

  createRenderRoot() {
    return this;
  }

  updated() {
    if (this.viewer && !this.actions) {
      this.actions = new LayersActions(this.viewer);
    }
  }


  // builds ui structure of layertree and makes render
  render() {
    const layerTemplates = this.layers.map((config, idx) => {
      if (!config.promise) {
        config.promise = config.load();
      }
      const upClassMap = {disabled: idx === 0};
      const downClassMap = {disabled: (idx === this.layers.length - 1)};
      const detail = {
        config,
        idx
      };
      return html`<ngm-layers-item
         @mouseenter=${() => this.mouseEnter(config)}
         @mouseleave=${this.mouseLeave}
         .actions=${this.actions}
         .config=${config}
         @removeDisplayedLayer=${() => this.dispatchEvent(new CustomEvent('removeDisplayedLayer', {detail}))}
         @zoomTo=${() => this.dispatchEvent(new CustomEvent('zoomTo', {detail: config}))}
         @layerChanged=${() => this.dispatchEvent(new CustomEvent('layerChanged'))}
         @moveLayer=${evt => this.moveLayer(config, evt.detail)}
         .upClassMap=${upClassMap}
         .downClassMap=${downClassMap}
        >
        </ngm-layers-item>`;
    });
    layerTemplates.reverse();

    return html`${layerTemplates}`;
  }

  mouseEnter(config) {
    this.actions.mouseEnter(config);
  }

  mouseLeave() {
    this.actions.mouseLeave();
  }

  // changes layer position in 'Displayed Layers'
  moveLayer(config, delta) {
    this.actions.moveLayer(this.layers, config, delta);
    syncLayersParam(this.layers);
    this.requestUpdate();
  }
}

customElements.define('ngm-layers', LayerTree);
