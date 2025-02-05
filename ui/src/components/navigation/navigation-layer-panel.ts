import {LitElementI18n} from 'src/i18n';
import {css, html} from 'lit';
import i18next from 'i18next';
import {customElement, property} from 'lit/decorators.js';
import {LayerConfig} from 'src/layertree';
import './navigation-panel';
import './navigation-panel-header';
import 'src/components/layer/layer-catalog';
import 'src/components/layer/layer-tabs';
import 'src/components/layer/display/layer-display-list';
import {
  LayerEvent, LayerEventDetail, LayersEvent, LayersEventDetail,
} from 'src/components/layer/display/layer-display-list';

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
    <ngm-navigation-panel>
      <ngm-navigation-panel-header closeable @close="${this.close}">
        ${i18next.t('dtd_displayed_data_label')}
      </ngm-navigation-panel-header>
      <div class="content">
        <section>
          ${this.renderLayers()}
        </section>
        <hr>
        <section>
          <ngm-layer-tabs .layers=${this.layers}></ngm-layer-tabs>
        </section>
      </div>
    </ngm-navigation-panel>
  `;

  private readonly renderLayers = () => html`
    <ngm-layer-display-list
      .layers=${this.displayLayers}
      @layers-update="${this.handleDisplayLayersUpdate}"
      @layer-update="${this.handleDisplayLayerUpdate}"
      @layer-removal="${this.handleDisplayLayerRemoval}"
      @layer-click="${this.handleDisplayLayerClick}"
    ></ngm-layer-display-list>
  `;

  connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('role', 'complementary');
  }

  private close(): void {
    this.dispatchEvent(new CustomEvent('close'));
  }

  private handleDisplayLayersUpdate(e: LayersEvent): void {
    this.dispatchEvent(new CustomEvent<LayersEventDetail>('display-layers-update', {
      detail: e.detail,
    }));
  }

  private handleDisplayLayerUpdate(e: LayerEvent): void {
    this.dispatchEvent(new CustomEvent<LayerEventDetail>('display-layer-update', {
      detail: e.detail,
    }));
  }

  private handleDisplayLayerRemoval(e: LayerEvent): void {
    this.dispatchEvent(new CustomEvent<LayerEventDetail>('display-layer-removal', {
      detail: e.detail,
    }));
  }

  private handleDisplayLayerClick(e: LayerEvent): void {
    this.dispatchEvent(new CustomEvent<LayerEventDetail>('display-layer-click', {
      detail: e.detail,
    }));
  }

  static readonly styles = css`
    :host, :host * {
      box-sizing: border-box;
    }

    .content > section {
      position: relative;
      background-color: var(--color-bg--dark);
      overflow-y: auto;

      max-height: 50%;
    }

    section > * {
      max-width: calc(100vw);
    }

    ngm-layer-catalog {
      display: block;
    }

    .content {
      display: flex;
      flex-direction: column;
      padding: 16px;
      gap: 16px;

      height: calc(var(--panel-height) - 64px);
    }

    .content > hr {
      height: 1px;
      margin: 0 12px;
      border: 0;
      background-color: var(--color-border--emphasis-high);
    }
  `;
}
