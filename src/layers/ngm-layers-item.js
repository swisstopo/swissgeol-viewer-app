import i18next from 'i18next';
import {html} from 'lit-element';
import {LitElementI18n} from '../i18n.js';
import {classMap} from 'lit-html/directives/class-map.js';
import $ from '../jquery';
import {LAYER_TYPES} from '../constants.js';


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

  firstUpdated() {
    $(this.querySelector('.ui.slider')).slider({
      min: 0,
      max: 1,
      start: !isNaN(this.config.transparency) ? this.config.transparency : 0,
      step: 0.05,
      onMove: (val) => this.changeTransparency(val)
    });
  }


  connectedCallback() {
    super.connectedCallback();
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
    const checked = evt.target.checked;
    this.actions.changeVisibility(this.config, checked);
    this.dispatchEvent(new CustomEvent('layerChanged'));
  }

  changeTransparency(transparency) {
    this.actions.changeTransparency(this.config, transparency);
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
      <div class="ui icon buttons compact mini">
        ${this.config.geocatId || this.config.legend ?
          html`
            <button class="ui button"
                    data-tooltip=${i18next.t('dtd_disclaimer_hint')}
                    data-position="top left"
                    data-variation="mini"
                    @click=${() => this.showLayerLegend(this.config)}>
              <i class="swatchbook icon"></i>
            </button>` : ''}
        ${this.config.zoomToBbox ?
          html`
            <button class="ui button"
                    data-tooltip=${i18next.t('dtd_zoom_to_hint')}
                    data-position="top left"
                    data-variation="mini"
                    @mouseenter=${() => this.actions.showBoundingBox(this.config)}
                    @mouseleave=${() => this.actions.hideBoundingBox()}
                    @click=${() => this.dispatchEvent(new CustomEvent('zoomTo'))}>
              <i class="search plus icon"></i>
            </button>` : ''}
        <button class="ui button ${classMap(this.downClassMap)}"
                data-tooltip=${i18next.t('dtd_layer_down_label')}
                data-position="top center"
                data-variation="mini"
                @click=${() => this.dispatchEvent(new CustomEvent('moveLayer', {detail: -1}))}>
          <i class="angle down icon"></i>
        </button>
        <button class="ui button ${classMap(this.upClassMap)}"
                data-tooltip=${i18next.t('dtd_layer_up_label')}
                data-position="top center"
                data-variation="mini"
                @click=${() => this.dispatchEvent(new CustomEvent('moveLayer', {detail: +1}))}>
          <i class="angle up icon"></i>
        </button>
        ${this.config.downloadUrl && this.config.type !== LAYER_TYPES.earthquakes ?
          html`
            <button class="ui button"
                    data-tooltip=${i18next.t('dtd_download_hint')}
                    data-position="top left"
                    data-variation="mini"
                    @click=${() => window.open(this.config.downloadUrl)}>
              <i class="download icon"></i>
            </button>` : ''}
        <button class="ui button"
                data-tooltip=${i18next.t('tbx_remove_btn_hint')}
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
      <div class="ngm-displayed-container buttons">
        ${this.buttons}
      </div>
      <div class="ngm-displayed-container">
        <div class="ui checkbox">
          <input class="ngm-layer-checkbox" type="checkbox"
                 .checked=${this.config.visible}
                 @change=${this.changeVisibility}>
          <label class="ngm-layer-label" @click=${this.onLabelClicked}>
            <i class=${this.config.restricted ? 'lock icon' : ''}></i>${i18next.t(this.label)}
            <div class="ui ${this.loading > 0 ? 'active' : ''} inline mini loader layerloader">
              <span class="small_load_counter">${this.loading}</span>
            </div>
          </label>
        </div>
      </div>
      <div class="ngm-displayed-container transparency" ?hidden=${!this.config.setTransparency}>
        <label>${i18next.t('dtd_transparency_label')} </label>
        <div class="ui grey small slider"></div>
      </div>
    `;
  }
}

customElements.define('ngm-layers-item', LayerTreeItem);
