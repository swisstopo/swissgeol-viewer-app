// @ts-check

import i18next from 'i18next';
import {html, LitElement} from 'lit-element';
import {I18nMixin} from '../i18n.js';
import {classMap} from 'lit-html/directives/class-map';


export class LayerTreeItem extends I18nMixin(LitElement) {

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
    const checked = evt.target.checked;
    this.actions.changeVisibility(this.config, checked);
    this.dispatchEvent(new CustomEvent('layerChanged'));
  }

  changeOpacity(evt) {
    const opacity = Number(evt.target.value);
    this.actions.changeOpacity(this.config, opacity);
    this.dispatchEvent(new CustomEvent('layerChanged'));
  }

  onLabelClicked(evt) {
    const input = evt.target.previousElementSibling;
    input.checked = !input.checked;
    input.dispatchEvent(new Event('change'));
  }

  onRemove() {
    this.dispatchEvent(new CustomEvent('removeDisplayedLayer'));
  }

  get buttons() {
    return html`
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
    `;
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
      ${this.buttons}
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
