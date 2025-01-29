import i18next from 'i18next';
import { css, html, unsafeCSS } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { LitElementI18n } from '../i18n.js';
import { classMap } from 'lit-html/directives/class-map.js';
import { DEFAULT_LAYER_OPACITY, LayerType } from '../constants';
import $ from 'jquery';
import type { LayerConfig } from '../layertree';
import { styleMap } from 'lit/directives/style-map.js';
import { Sortable } from 'sortablejs';
import type LayersAction from './LayersActions';
import { debounce } from '../utils';
import { PropertyValues } from '@lit/reactive-element';
import iconsCss from '../style/icons.css?raw';
import layersCss from '../style/layers.css?raw';
import sliderCss from '../style/ngm-slider.css?raw';
import fomanticTransitionCss from 'fomantic-ui-css/components/transition.css?raw';
import fomanticDropdownCss from 'fomantic-ui-css/components/dropdown.css?raw';
import 'fomantic-ui-css/components/transition.js';

const GEOCAT_LANG_CODE = {
  de: 'ger',
  fr: 'fre',
  it: 'ita',
  en: 'eng',
};

@customElement('ngm-layers-item')
export class NgmLayersItem extends LitElementI18n {
  @property({ type: Object })
  accessor actions: LayersAction | undefined;
  @property({ type: Object })
  accessor config!: LayerConfig;
  @property({ type: Boolean })
  accessor changeOrderActive = false;
  @property({ type: Boolean })
  accessor clone = false;
  @state()
  accessor loading = 0;
  @state()
  accessor determinateLoading = false;
  @state()
  accessor loadProgressRemover_: any;
  @state()
  accessor movable = false;
  @query('.menu')
  accessor actionMenu!: HTMLElement;
  private readonly toggleItemSelection = () =>
    this.movable ? Sortable.utils.select(this) : Sortable.utils.deselect(this);
  private readonly debouncedOpacityChange = debounce(
    () => this.changeOpacity(),
    250,
    true,
  );

  firstUpdated(): void {
    if (this.shadowRoot != null) {
      $(this.shadowRoot.querySelectorAll('.ui.dropdown')).dropdown({
        on: 'mouseup',
        collapseOnActionable: false,
      });
    }
  }

  updated(changedProps: PropertyValues<this>): void {
    super.updated(changedProps);
    if (changedProps.has('changeOrderActive')) {
      this.updateMovableState();
    }
    if (changedProps.has('config')) {
      this.config.promise?.then(() => {
        this.requestUpdate();
      });
    }
  }

  connectedCallback() {
    super.connectedCallback();
    if (!this.config.opacity) {
      this.config.opacity = DEFAULT_LAYER_OPACITY;
    }
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
    this.loadProgressRemover_ = this.actions.listenForEvent(
      this.config,
      'loadProgress',
      callback,
    );
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.loadProgressRemover_) {
      this.loadProgressRemover_();
    }
  }

  async changeVisibility() {
    if (!this.actions) return;
    this.config.visible = !this.config.visible;
    await this.actions.changeVisibility(this.config, this.config.visible);
    this.dispatchEvent(new CustomEvent('layerChanged'));
    this.requestUpdate();
  }

  changeOpacity() {
    if (!this.actions || !this.config.opacity) return;
    this.actions.changeOpacity(this.config, this.config.opacity);
    this.dispatchEvent(new CustomEvent('layerChanged'));
  }

  inputOpacity(event: Event) {
    const input = event.target as HTMLInputElement;
    this.config.opacity = Number(input.value);
    this.requestUpdate();
    this.debouncedOpacityChange();
  }

  onLabelClicked(evt) {
    const input = evt.target.previousElementSibling;
    input.checked = !input.checked;
    input.dispatchEvent(new Event('change'));
  }

  onRemove() {
    if (this.changeOrderActive) return;
    this.dispatchEvent(new CustomEvent('removeDisplayedLayer'));
  }

  get sublabel() {
    if (this.config.ownKml) return `(${i18next.t('dtd_own_kml_tag')})`;
    else if (this.config.topicKml) return `(${i18next.t('dtd_topic_kml_tag')})`;
    else return '';
  }

  showLayerLegend(config: LayerConfig) {
    this.dispatchEvent(
      new CustomEvent('showLayerLegend', {
        composed: true,
        bubbles: true,
        detail: {
          config,
        },
      }),
    );
  }

  showWmtsDatePicker(config: LayerConfig) {
    this.dispatchEvent(
      new CustomEvent('showWmtsDatePicker', {
        composed: true,
        bubbles: true,
        detail: {
          config,
        },
      }),
    );
  }

  showVoxelFilter(config: LayerConfig) {
    this.dispatchEvent(
      new CustomEvent('showVoxelFilter', {
        composed: true,
        bubbles: true,
        detail: {
          config,
        },
      }),
    );
  }

  geocatLink(id: string) {
    const lang = GEOCAT_LANG_CODE[i18next.language];
    return `https://www.geocat.ch/geonetwork/srv/${lang}/catalog.search#/metadata/${id}`;
  }

  get buttons() {
    return html`
      <div class="menu">
        ${this.config?.legend
          ? html` <div
              class="item"
              @click=${() => this.showLayerLegend(this.config)}
            >
              ${i18next.t('dtd_legend')}
            </div>`
          : ''}
        ${this.config?.geocatId
          ? html` <a
              class="item"
              href="${this.geocatLink(this.config.geocatId)}"
              target="_blank"
              rel="noopener"
            >
              Geocat.ch
            </a>`
          : ''}
        ${this.config?.downloadUrl &&
        this.config?.type !== LayerType.earthquakes
          ? html` <div
              class="item"
              @click=${() => window.open(this.config?.downloadUrl)}
            >
              ${i18next.t('dtd_download_hint')}
            </div>`
          : ''}
        ${this.config?.type === LayerType.voxels3dtiles
          ? html` <div
              class="item"
              @click=${() => this.showVoxelFilter(this.config)}
            >
              ${i18next.t('dtd_voxel_filter')}
            </div>`
          : ''}
        ${this.config?.wmtsTimes && this.config.wmtsTimes.length > 1
          ? html` <div
              class="item"
              @click=${() => this.showWmtsDatePicker(this.config)}
            >
              ${i18next.t('dtd_time_journey')}
            </div>`
          : ''}
      </div>
    `;
  }

  updateMovableState() {
    // prevent select/deselect on click on item (not checkbox)
    if (this.changeOrderActive) {
      this.addEventListener('click', this.toggleItemSelection);
    } else {
      this.removeEventListener('click', this.toggleItemSelection);
      if (this.movable) {
        this.movable = false;
        Sortable.utils.deselect(this);
      }
    }
  }

  isMenuNotEmpty(): boolean {
    return this.actionMenu?.children.length > 0;
  }

  render() {
    if (this.clone) return '';
    return html`
      <div ?hidden=${!this.changeOrderActive || this.loading > 0} class="ngm-checkbox ${this.movable ? 'active' : ''}"
           @click=${() => (this.movable = !this.movable)}>
        <input type="checkbox" .checked=${this.movable}>
        <span class="ngm-checkbox-icon"></span>
      </div>

      <div ?hidden=${this.loading > 0 || this.changeOrderActive}
           title=${this.config.visible ? i18next.t('dtd_hide') : i18next.t('dtd_show')}
           class="ngm-layer-icon ${classMap({
             'ngm-visible-icon': !!this.config.visible,
             'ngm-invisible-icon': !this.config.visible,
           })}" @click=${this.changeVisibility}>
      </div>
      <div ?hidden=${this.loading === 0} class="ngm-determinate-loader">
        <div
          class="ui inline mini loader ${classMap({ active: this.loading > 0, determinate: this.determinateLoading })}">
        </div>
        <span ?hidden=${!this.determinateLoading} class="ngm-load-counter">${this.loading}</span>
      </div>
      <div class="ngm-displayed-slider">
        <label class="ngm-layer-label">
          <i class=${this.config.restricted?.length ? 'lock icon' : ''}></i>
          ${i18next.t(this.config.label)} ${this.sublabel}
        </label>
        <label ?hidden=${this.config.opacityDisabled}>${(this.config.opacity! * 100).toFixed()} %</label>
        <input type="range" class="ngm-slider ${classMap({ disabled: this.changeOrderActive })}" ?hidden=${this.config.opacityDisabled}
               style="background-image: linear-gradient(to right, var(--ngm-interaction-active), var(--ngm-interaction-active) ${this.config.opacity! * 100}%, white ${this.config.opacity! * 100}%)"
               min=0 max=1 step=0.01
               .value=${this.config.opacity?.toString() ?? '1'}
               @input=${this.inputOpacity}
               @mousedown=${(e) => this.changeOrderActive && e.preventDefault()}>
      </div>
      </div>
      <div .hidden=${!this.config.previewColor} class="ngm-displayed-color"
           style=${styleMap({ backgroundColor: this.config.previewColor })}>
      </div>
      <div class="ngm-displayed-menu">
        <div title=${i18next.t('dtd_zoom_to')}
             class="ngm-layer-icon ngm-zoom-plus-icon"
             @mouseenter=${() => {
               if (this.actions && this.actions.showBoundingBox)
                 this.actions.showBoundingBox(this.config);
             }}
             @mouseleave=${() => {
               if (this.actions && this.actions.hideBoundingBox)
                 this.actions.hideBoundingBox();
             }}
             @click=${() => {
               if (this.actions && this.actions.zoomToBbox)
                 this.actions.zoomToBbox();
             }}>
        </div>
        <div title=${i18next.t('dtd_remove')}
             class="ngm-layer-icon ngm-delete-icon ${classMap({ disabled: this.changeOrderActive })}"
             @click=${this.onRemove}>
        </div>
        <div class="ui dropdown right pointing ngm-action-menu ${classMap({ 'ngm-disabled': !this.isMenuNotEmpty() })}">
          <div class="ngm-layer-icon ngm-action-menu-icon"></div>
          ${this.buttons}
        </div>
      </div>
    `;
  }

  cloneNode(deep) {
    const node = super.cloneNode(deep) as NgmLayersItem;
    node.config = this.config;
    node.actions = this.actions;
    node.changeOrderActive = this.changeOrderActive;
    node.clone = true;
    return node;
  }

  static readonly styles = css`
    ${unsafeCSS(fomanticTransitionCss)}
    ${unsafeCSS(fomanticDropdownCss)}
    ${unsafeCSS(iconsCss)}
    ${unsafeCSS(layersCss.replaceAll('ngm-layers-item', ':host'))}
    ${unsafeCSS(sliderCss)}

    .ui.dropdown .menu > .item {
      font-size: 14px;
      text-decoration: none;
      padding: 10px 16px;
      min-height: unset;
    }
  `;
}
