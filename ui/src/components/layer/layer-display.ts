import { customElement, property, query, state } from 'lit/decorators.js';
import { LitElementI18n } from '../../i18n.js';
import { css, html } from 'lit';
import i18next from 'i18next';
import { Viewer } from 'cesium';
import { PropertyValues } from '@lit/reactive-element';
import LayersActions from '../../layers/LayersActions';
import { LayerConfig, LayerTreeNode } from '../../layertree';
import '../../layers/ngm-layers';
import '../../layers/ngm-layers-sort';
import MainStore from '../../store/main';
import { Subscription } from 'rxjs';
import { classMap } from 'lit/directives/class-map.js';
import './upload/layer-upload';

@customElement('ngm-layer-display')
export class NgmLayerDisplay extends LitElementI18n {
  @property({ type: Array })
  accessor layers: LayerTreeNode[] = [];

  @state()
  private accessor isReordering = false;

  @state()
  private accessor viewer: Viewer | null = null;

  @state()
  private accessor actions: LayersActions | null = null;

  private readonly subscription = new Subscription();

  @query('.ngm-side-bar-panel > .ngm-toast-placeholder')
  accessor toastPlaceholder;

  @state()
  private accessor globeQueueLength = 0;

  constructor() {
    super();

    this.subscription.add(
      MainStore.viewer.subscribe((viewer) => {
        this.viewer = viewer;
        this.initializeViewer();
      }),
    );

    this.handleLayerRemoval = this.handleLayerRemoval.bind(this);
    this.handleReordering = this.handleReordering.bind(this);
    this.toggleReordering = this.toggleReordering.bind(this);
    this.handleLayerUpdate = this.handleLayerUpdate.bind(this);
  }

  private initializeViewer(): void {
    if (this.viewer == null) {
      return;
    }
    this.subscription.add(
      this.viewer.scene.globe.tileLoadProgressEvent.addEventListener(
        (queueLength) => {
          this.globeQueueLength = queueLength;
        },
      ),
    );
  }

  updated(changedProperties: PropertyValues<this>): void {
    if (changedProperties.has('viewer' as keyof NgmLayerDisplay)) {
      this.actions =
        this.viewer == null ? null : new LayersActions(this.viewer);
    }
  }

  disconnectedCallback(): void {
    this.subscription.unsubscribe();
  }

  private toggleReordering(): void {
    this.isReordering = !this.isReordering;
  }

  private async handleReordering(e: LayersReorderEvent): Promise<void> {
    const { actions } = this;
    if (actions == null) {
      return;
    }
    await actions.reorderLayers(e.detail);
    if (!this.isReordering) {
      this.updateLayers(e.detail);
    }
  }

  private async handleLayerRemoval(e: LayerRemovalEvent): Promise<void> {
    const newLayers = [...this.layers];
    newLayers.splice(e.detail.idx, 1);
    this.updateLayers(newLayers);
    this.removeLayer(e.detail.config);
  }

  private async handleLayerUpdate(e: LayerChangeEvent): Promise<void> {
    this.updateLayer(e.detail);
  }

  private updateLayers(layers: LayerTreeNode[]): void {
    this.dispatchEvent(
      new CustomEvent('layers-update', {
        detail: {
          layers,
        },
      }) satisfies LayersUpdateEvent,
    );
  }

  private updateLayer(layer: LayerConfig): void {
    this.dispatchEvent(
      new CustomEvent('layer-update', {
        detail: {
          layer,
        },
      }) satisfies LayerEvent,
    );
  }

  private removeLayer(layer: LayerConfig): void {
    this.dispatchEvent(
      new CustomEvent('layer-removal', {
        detail: {
          layer,
        },
      }) satisfies LayerEvent,
    );
  }

  // TODO Make all children of this component use the Shadow DOM so we can remove this.
  createRenderRoot() {
    return this;
  }

  readonly render = () => html`
    <div class="ngm-data-panel">
      <style>
        ${NgmLayerDisplay.styles.cssText}
      </style>
      <div class="ngm-panel-content">
        <div
          class="ngm-label-btn ${classMap({ active: this.isReordering })}"
          @click=${this.toggleReordering}
        >
          ${this.isReordering
            ? i18next.t('dtd_finish_ordering_label')
            : i18next.t('dtd_change_order_label')}
        </div>
        ${this.isReordering ? this.renderSortableLayers() : this.renderLayers()}
        <h5 class="ui header ngm-background-label">
          ${i18next.t('dtd_background_map_label')}
          <div
            class="ui ${this.globeQueueLength > 0
              ? 'active'
              : ''} inline mini loader"
          >
            <span class="ngm-load-counter">${this.globeQueueLength}</span>
          </div>
        </h5>
        <ngm-map-configuration></ngm-map-configuration>
      </div>
    </div>
  `;

  private readonly renderLayers = () => html`
    <ngm-layers
      .layers=${this.layers}
      .actions=${this.actions}
      @removeDisplayedLayer=${this.handleLayerRemoval}
      @layerChanged=${this.handleLayerUpdate}
    >
    </ngm-layers>
  `;

  private readonly renderSortableLayers = () => html`
    <ngm-layers-sort
      .layers=${this.layers}
      .actions=${this.actions}
      @orderChanged=${this.handleReordering}
    >
    </ngm-layers-sort>
  `;

  static readonly styles = css`
    ngm-layer-display,
    ngm-layer-display * {
      box-sizing: border-box;
    }

    ngm-layer-display {
      display: block;
      padding-inline: 16px;
    }

    ngm-layer-display .actions {
      display: flex;
      justify-content: flex-end;
      padding-top: 9px;
    }
  `;
}

export type LayersUpdateEvent = CustomEvent<{
  layers: LayerTreeNode[];
}>;

export type LayerEvent = CustomEvent<LayerEventDetails>;
export interface LayerEventDetails {
  layer: LayerConfig | LayerTreeNode;
}

type LayerRemovalEvent = CustomEvent<{
  idx: number;
  config: LayerConfig;
}>;

type LayersReorderEvent = CustomEvent<LayerTreeNode[]>;
type LayerChangeEvent = CustomEvent<LayerConfig>;
