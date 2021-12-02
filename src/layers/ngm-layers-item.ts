import i18next from 'i18next';
import {html} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import {LitElementI18n} from '../i18n.js';
import {classMap} from 'lit-html/directives/class-map.js';
import {DEFAULT_LAYER_OPACITY, LayerType} from '../constants';
import $ from '../jquery.js';
import type {LayerTreeNode} from '../layertree';

export interface Config extends LayerTreeNode {
  add?: any;
  remove?: any;
  heightOffset?: number;
  load?: any;
  setVisibility?: any;
  setOpacity?: any;
  hideUpDown: any;
  promise: any;
}

@customElement('ngm-layers-item')
export class LayerTreeItem extends LitElementI18n {
  @property({type: Object}) actions: any;
  @property({type: Object}) config!: Config;
  @state() loading = 0;
  @state() determinateLoading = false;
  @state() upClassMap: any;
  @state() downClassMap: any;
  @state() loadProgressRemover_: any;

  firstUpdated() {
    $(this.querySelector('.ui.dropdown')).dropdown();
    if (!this.config.opacity) {
      this.config.opacity = DEFAULT_LAYER_OPACITY;
    }
  }

  connectedCallback() {
    super.connectedCallback();
    if (!this.actions || !this.actions.listenForEvent) return;
    this.loading = 0;
    const callback = (pending, processing) => {
      const newValue = pending + processing;
      if (this.loading === 0 && newValue > 0) {
        setTimeout(() => {
          if (this.loading > 0) this.determinateLoading = true;
        }, 3000);
      } else if (newValue === 0) {
        this.determinateLoading = false;
      }
      this.loading = newValue;
    };
    this.loadProgressRemover_ = this.actions.listenForEvent(this.config, 'loadProgress', callback);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.loadProgressRemover_) {
      this.loadProgressRemover_();
    }
  }

  changeVisibility() {
    this.config.visible = !this.config.visible;
    this.actions.changeVisibility(this.config, this.config.visible);
    this.dispatchEvent(new CustomEvent('layerChanged'));
  }

  changeOpacity(event: Event) {
    const input = event.target as HTMLInputElement;
    this.config.opacity = Number(input.value);
    this.actions.changeOpacity(this.config, this.config.opacity);
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

  showLayerLegend(config: Config) {
    this.dispatchEvent(new CustomEvent('showLayerLegend', {
      bubbles: true,
      detail: {
        config
      }
    }));
  }

  get buttons() {
    return html`
      <div class="menu">
        ${this.config?.geocatId || this.config?.legend ? html`
          <div class="item"
               @click=${() => this.showLayerLegend(this.config)}>
            ${i18next.t('dtd_legend_geocat_hint')}
          </div>` : ''}
        ${!this.config?.hideUpDown ? html`
          <div class="item ${classMap(this.downClassMap)}"
               @click=${() => this.dispatchEvent(new CustomEvent('moveLayer', {detail: -1}))}>
            ${i18next.t('dtd_layer_down_label')}
          </div>
          <div class="item ${classMap(this.upClassMap)}"
               @click=${() => this.dispatchEvent(new CustomEvent('moveLayer', {detail: +1}))}>
            ${i18next.t('dtd_layer_up_label')}
          </div>` : ''}
        ${this.config?.downloadUrl && this.config?.type !== LayerType.earthquakes ? html`
          <div class="item"
               @click=${() => window.open(this.config?.downloadUrl)}>
            ${i18next.t('dtd_download_hint')}
          </div>` : ''}
      </div>
    `;
  }

  render() {
    return html`
      <div ?hidden=${this.loading > 0} class="ngm-layer-icon ${classMap({
        'ngm-visible-icon': !!this.config.visible,
        'ngm-invisible-icon': !this.config.visible
      })}" @click=${this.changeVisibility}>
      </div>
      <div ?hidden=${this.loading === 0} class="ngm-determinate-loader">
        <div
          class="ui inline mini loader ${classMap({active: this.loading > 0, determinate: this.determinateLoading})}">
        </div>
        <span ?hidden=${!this.determinateLoading} class="ngm-load-counter">${this.loading}</span>
      </div>
      <div class="ngm-displayed-slider">
        <label class="ngm-layer-label">
          <i class=${this.config.restricted ? 'lock icon' : ''}></i>
          ${i18next.t(this.config.label)}
        </label>
        <label ?hidden=${!this.config.setOpacity}>${(this.config.opacity! * 100).toFixed()} %</label>
        <input type="range" class="ngm-slider" ?hidden=${!this.config.setOpacity}
               style="background-image: linear-gradient(to right, var(--ngm-interaction-active), var(--ngm-interaction-active) ${this.config.opacity! * 100}%, white ${this.config.opacity! * 100}%)"
               min=0 max=1 step=0.01
               .value=${this.config.opacity?.toString() || '1'}
               @input=${this.changeOpacity}/>
      </div>
      </div>
      <div class="ngm-displayed-menu">
        <div class="ngm-layer-icon ngm-zoom-plus-icon" ?hidden=${!this.config.zoomToBbox}
             @mouseenter=${() => {
               if (this.actions && this.actions.showBoundingBox) this.actions.showBoundingBox(this.config);
             }}
             @mouseleave=${() => {
               if (this.actions && this.actions.hideBoundingBox) this.actions.hideBoundingBox();
             }}
             @click=${() => this.dispatchEvent(new CustomEvent('zoomTo'))}>
        </div>
        <div class="ngm-layer-icon ngm-delete-icon"
             @click=${this.onRemove}>
        </div>
        <div class="ui dropdown right pointing ngm-action-menu">
          <div class="ngm-layer-icon ngm-action-menu-icon"></div>
          ${this.buttons}
        </div>
      </div>
    `;
  }

  createRenderRoot() {
    return this;
  }
}
