import {customElement, property, query, state} from 'lit/decorators.js';
import {css, html} from 'lit';
import i18next from 'i18next';
import {Viewer} from 'cesium';
import {PropertyValues} from '@lit/reactive-element';
import LayersActions from 'src/layers/LayersActions';
import {LayerConfig, LayerTreeNode} from 'src/layertree';
import 'src/layers/ngm-layers';
import 'src/layers/ngm-layers-sort';
import MainStore from '../../../store/main';
import {classMap} from 'lit/directives/class-map.js';
import '../upload/layer-upload';
import './layer-display-list';
import 'src/components/layer/display/layer-display-list-item';
import {OpacityChangedEvent, VisibilityChangedEvent} from 'src/components/layer/display/layer-display-list-item';
import {consume} from '@lit/context';
import {BackgroundLayerService} from 'src/components/layer/background/background-layer.service';
import {BackgroundLayer} from 'src/components/layer/layer.model';
import {CoreElement} from 'src/components/core';

@customElement('ngm-layer-display')
export class NgmLayerDisplay extends CoreElement {
  @property({type: Array})
  accessor layers: LayerTreeNode[] = []

  @consume({context: BackgroundLayerService.context()})
  accessor backgroundLayerService!: BackgroundLayerService;

  @state()
  private accessor background!: BackgroundLayer

  @state()
  private accessor viewer: Viewer | null = null

  @state()
  private accessor isReordering = false

  @state()
  private accessor actions: LayersActions | null = null;

  @query('.ngm-side-bar-panel > .ngm-toast-placeholder')
  accessor toastPlaceholder;

  @state()
  private accessor globeQueueLength = 0

  constructor() {
    super();

    this.register(MainStore.viewer.subscribe((viewer) => {
      this.viewer = viewer;
      this.initializeViewer();
    }));

    this.handleLayerRemoval = this.handleLayerRemoval.bind(this);
    this.handleReordering = this.handleReordering.bind(this);
    this.toggleReordering = this.toggleReordering.bind(this);
    this.handleLayerUpdate = this.handleLayerUpdate.bind(this);
  }

  willFirstUpdate(): void {
    this.register(this.backgroundLayerService.background$.subscribe((background) => {
      this.background = background;
    }));
  }

  updated(changedProperties: PropertyValues<this>): void {
    if (changedProperties.has('viewer' as keyof NgmLayerDisplay)) {
      this.actions = this.viewer == null ? null : new LayersActions(this.viewer);
    }
  }

  disconnectedCallback(): void {
    this.subscription.unsubscribe();
  }

  private initializeViewer(): void {
    if (this.viewer == null) {
      return;
    }
    this.register(this.viewer.scene.globe.tileLoadProgressEvent.addEventListener((queueLength) => {
      this.globeQueueLength = queueLength;
    }));
  }

  private toggleReordering(): void {
    this.isReordering = !this.isReordering;
  }

  private async handleReordering(e: LayersReorderEvent): Promise<void> {
    const {actions} = this;
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
    this.dispatchEvent(new CustomEvent('layers-update', {
      detail: {
        layers,
      },
    }) satisfies LayersUpdateEvent);
  }

  private updateLayer(layer: LayerConfig): void {
    this.dispatchEvent(new CustomEvent('layer-update', {
      detail: {
        layer,
      },
    }) satisfies LayerEvent);
  }

  private removeLayer(layer: LayerConfig): void {
    this.dispatchEvent(new CustomEvent('layer-removal', {
      detail: {
        layer,
      },
    }) satisfies LayerEvent);
  }

  // TODO Make all children of this component use the Shadow DOM so we can remove this.
  createRenderRoot() {
    return this;
  }

  private handleBackgroundVisibilityChange(event: VisibilityChangedEvent): void {
    this.updateBackgroundVisibility(event.detail.isVisible);
  }

  private updateBackgroundVisibility(isVisible: boolean): void {
    if (this.background.opacity === 0 && isVisible) {
      // If the opacity is set to zero, we force the background to remain hidden.
      return;
    }
    if (this.background.isVisible === isVisible) {
      return;
    }
    this.backgroundLayerService.update({isVisible});
  }

  private handleBackgroundOpacityChange(event: OpacityChangedEvent) {
    const {opacity} = event.detail;
    this.updateBackgroundVisibility(opacity > 0);
    this.backgroundLayerService.update({opacity});
  }

  readonly render = () => html`
    <div class="ngm-data-panel">
      <style>
        ${NgmLayerDisplay.styles.cssText}
      </style>
      <div class="ngm-panel-content">
        <div
          class="ngm-label-btn ${classMap({active: this.isReordering})}"
          @click=${this.toggleReordering}
        >
          ${this.isReordering ? i18next.t('dtd_finish_ordering_label') : i18next.t('dtd_change_order_label')}
        </div>
        ${this.isReordering
    ? this.renderSortableLayers()
    : this.renderLayers()}
        <h5 class="ui header ngm-background-label">
          ${i18next.t('dtd_background_map_label')}
          <div class="ui ${this.globeQueueLength > 0 ? 'active' : ''} inline mini loader">
            <span class="ngm-load-counter">${this.globeQueueLength}</span>
          </div>
        </h5>
        <ngm-map-configuration></ngm-map-configuration>

        <ngm-layer-display-list-item
          title="${i18next.t(this.background.label)}"
          label="Hintergrund"
          ?visible="${this.background.isVisible}"
          .opacity="${this.background.opacity}"
          @visibility-changed="${this.handleBackgroundVisibilityChange}"
          @opacity-changed="${this.handleBackgroundOpacityChange}"
        ></ngm-layer-display-list-item>
      </div>
    </div>
  `;

  private readonly renderLayers = () => html`
    <ngm-layers
      .layers=${this.layers}
      .actions=${this.actions}
      @removeDisplayedLayer=${this.handleLayerRemoval}
      @layerChanged=${this.handleLayerUpdate}>
    </ngm-layers>
  `;

  private readonly renderSortableLayers = () => html`
    <ngm-layers-sort
      .layers=${this.layers}
      .actions=${this.actions}
      @orderChanged=${this.handleReordering}>
    </ngm-layers-sort>
  `;

  static readonly styles = css`

    ngm-layer-display, ngm-layer-display * {
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
  layers: LayerTreeNode[]
}>

export type LayerEvent = CustomEvent<LayerEventDetails>
export interface LayerEventDetails {
  layer: LayerConfig | LayerTreeNode
}

type LayerRemovalEvent = CustomEvent<{
  idx: number
  config: LayerConfig
}>

type LayersReorderEvent = CustomEvent<LayerTreeNode[]>
type LayerChangeEvent = CustomEvent<LayerConfig>
