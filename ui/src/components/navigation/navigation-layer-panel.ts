import {LitElementI18n} from '../../i18n';
import {css, html, unsafeCSS} from 'lit';
import i18next from 'i18next';
import {customElement, property} from 'lit/decorators.js';
import {LayerConfig} from '../../layertree';
import './navigation-panel';
import './navigation-panel-header';
import '../layers/layers-catalog';
import '../data-display/tab-display';
import '../layers/layers-display';
import {LayerEvent, LayersUpdateEvent} from '../layers/layers-display';


@customElement('ngm-navigation-layer-panel')
export class NavigationLayerPanel extends LitElementI18n {
  @property()
  public accessor layers: LayerConfig[] | null = null

  @property()
  public accessor displayLayers: LayerConfig[] | null = null
    constructor() {
    super();

    this.close = this.close.bind(this);
    this.handleDisplayLayersUpdate = this.handleDisplayLayersUpdate.bind(this);
    this.handleDisplayLayerUpdate = this.handleDisplayLayerUpdate.bind(this);
    this.handleDisplayLayerRemoval = this.handleDisplayLayerRemoval.bind(this);
  }

  readonly render = () => html`
    <style>
      ${unsafeCSS(NavigationLayerPanel.styles.cssText)}
    </style>
    <ngm-navigation-panel>
      <section>
        <ngm-navigation-panel-header closeable @close="${this.close}">
          ${i18next.t('dtd_displayed_data_label')}
        </ngm-navigation-panel-header>
        ${this.renderLayers()}
      </section>
      <section>
        <ngm-tab-display .layers=${this.layers}> </ngm-tab-display>
      </section>
    </ngm-navigation-panel>
  `;

  private readonly renderLayers = () => html`
    <ngm-layers-display
      .layers=${this.displayLayers}
      @layers-update="${this.handleDisplayLayersUpdate}"
      @layer-update="${this.handleDisplayLayerUpdate}"
      @layer-removal="${this.handleDisplayLayerRemoval}"
      @layer-click="${this.handleDisplayLayerClick}"
    ></ngm-layers-display>
  `;

  connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('role', 'complementary');
  }

  private close(): void {
    this.dispatchEvent(new CustomEvent('close'));
  }

  private handleDisplayLayersUpdate(e: LayersUpdateEvent): void {
    this.dispatchEvent(new CustomEvent('display-layers-update', {
      detail: e.detail,
    }) satisfies LayersUpdateEvent);
  }

  private handleDisplayLayerUpdate(e: LayerEvent): void {
    this.dispatchEvent(new CustomEvent('display-layer-update', {
      detail: e.detail,
    }) satisfies LayerEvent);
  }

  private handleDisplayLayerRemoval(e: LayerEvent): void {
    this.dispatchEvent(new CustomEvent('display-layer-removal', {
      detail: e.detail,
    }) satisfies LayerEvent);
  }

  private handleDisplayLayerClick(e: LayerEvent): void {
    this.dispatchEvent(new CustomEvent('display-layer-click', {
      detail: e.detail,
    }) satisfies LayerEvent);
  }

  // TODO Make all children of this component use the Shadow DOM so we can remove this.
  createRenderRoot() {
    return this;
  }

  static readonly styles = css`
    ngm-navigation-layer-panel * {
      box-sizing: border-box;
    }

    ngm-navigation-layer-panel ngm-navigation-panel {
      --display-height: 500px;
      --catalog-height: calc(var(--panel-height) - var(--display-height) - 34px);

      display: grid;
      grid-template-columns: 1fr;
      grid-template-rows: repeat(2, 1fr);
      max-height: calc(100vh - var(--ngm-header-height));
      padding: 0;
    }

    ngm-navigation-layer-panel ngm-navigation-panel > section {
      --section-height: calc(var(--panel-height) / 2);

      position: relative;
      max-height: var(--section-height);
      background-color: var(--color-bg--dark);
    }


    ngm-navigation-layer-panel ngm-navigation-panel > section > * {
      max-width: calc(100vw);
      padding: 0 var(--panel-padding);
    }

    ngm-navigation-layer-panel ngm-layers-catalog,
    ngm-navigation-layer-panel ngm-layers-display {
      display: block;
      height: calc(var(--section-height) - 34px);
      max-height: calc(var(--section-height) - 34px);
      overflow-y: auto;
    }
  `;
}
