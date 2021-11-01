import i18next from 'i18next';
import {html} from 'lit-element';
import {LitElementI18n} from '../i18n.js';
import {classMap} from 'lit-html/directives/class-map.js';
import {LayerType} from '../constants';


export class LayerTreeItem extends LitElementI18n {

  static get properties() {
    return {
      actions: {type: Object},
      config: {type: Object},
      label: {type: String},
      loading: {type: Number},
      upClassMap: {type: Object},
      downClassMap: {type: Object},
    };
  }

  connectedCallback() {
    super.connectedCallback();
    if (!this.actions || !this.actions.listenForEvent) return;
    this.loading = 0;
    const callback = (pending, processing) => {
      this.loading = pending + processing;
    };
    this.loadProgressRemover_ = this.actions.listenForEvent(this.config, 'loadProgress', callback);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.loadProgressRemover_) {
      this.loadProgressRemover_();
    }
  }

  createRenderRoot() {
    return this;
  }

  changeVisibility(evt) {
    this.config.visible = !this.config.visible;
    this.actions.changeVisibility(this.config, this.config.visible);
    this.dispatchEvent(new CustomEvent('layerChanged'));
  }

  changeOpacity(evt) {
    const opacity = evt.target.value;
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

  showLayerLegend(config) {
    this.dispatchEvent(new CustomEvent('showLayerLegend', {
      bubbles: true,
      detail: {
        config: config
      }
    }));
  }

  get buttons() {
    return html`
      <div class="menu">
        ${this.config.geocatId || this.config.legend ? html`
          <div class="item"
            @click=${() => this.showLayerLegend(this.config)}>
            ${i18next.t('dtd_disclaimer_hint')}
          </div>` : ''}
        ${!this.config.hideUpDown ? html`
          <div class="item ${classMap(this.downClassMap)}"
            @click=${() => this.dispatchEvent(new CustomEvent('moveLayer', {detail: -1}))}>
            ${i18next.t('dtd_layer_down_label')}
          </div>
          <div class="item ${classMap(this.upClassMap)}"
            @click=${() => this.dispatchEvent(new CustomEvent('moveLayer', {detail: +1}))}>
            ${i18next.t('dtd_layer_up_label')}
          </div>` : ''}
        ${this.config.downloadUrl && this.config.type !== LayerType.earthquakes ? html`
          <div class="item"
            @click=${() => window.open(this.config.downloadUrl)}>
            ${i18next.t('dtd_download_hint')}
          </div>` : ''}
      </div>
    `;
  }

  render() {
    return html`
      <div class="ngm-layer-icon ${classMap({'ngm-visible-icon': this.config.visible, 'ngm-invisible-icon': !this.config.visible})}"
          @click=${this.changeVisibility}></div>
      <div class="ngm-displayed-slider">
        <label class="ngm-layer-label">
          <i class=${this.config.restricted ? 'lock icon' : ''}></i>
          ${i18next.t(this.label)}
          <div class="ui ${this.loading > 0 ? 'active' : ''} inline mini loader layerloader">
            <span class="small_load_counter">${this.loading}</span>
          </div>
        </label>
        <label ?hidden=${!this.config.setOpacity}>${(this.config.opacity * 100).toFixed()} %</label>
        <input type="range" class="ngm-slider" ?hidden=${!this.config.setOpacity}
                style="background-image: linear-gradient(to right, #B9271A, #B9271A ${this.config.opacity * 100}%, white ${this.config.opacity * 100}%)"
                min=0 max=1 step=0.01
                .value=${this.config.opacity}
                @input=${this.changeOpacity}/>
        </div>
      </div>
      <div class="ngm-layer-icon ngm-zoom-to-icon" ?hidden=${!this.config.zoomToBbox}
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
      <div class="ui dropdown">
        <!-- <div class="ngm-layer-icon ngm-action-menu-icon"></div> -->
        <div class="text">Test</div>
        <i class="dropdown icon"></i>
        ${this.buttons}
      </div>
    `;
  }
}

customElements.define('ngm-layers-item', LayerTreeItem);
