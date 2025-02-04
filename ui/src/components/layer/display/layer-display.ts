import {customElement, property, query, state} from 'lit/decorators.js';
import {css, html} from 'lit';
import {Viewer} from 'cesium';
import {PropertyValues} from '@lit/reactive-element';
import LayersActions from 'src/layers/LayersActions';
import {LayerConfig, LayerTreeNode} from 'src/layertree';
import MainStore from '../../../store/main';
import '../upload/layer-upload';
import './layer-display-list';
import 'src/components/layer/display/layer-display-list-item';
import {CoreElement} from 'src/components/core';
import {LayerReorderEvent} from 'src/components/layer/display/layer-display-list';

@customElement('ngm-layer-display')
export class NgmLayerDisplay extends CoreElement {
  @property({type: Array})
  accessor layers: LayerConfig[] = []

  @state()
  private accessor viewer: Viewer | null = null

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
    this.handleLayerUpdate = this.handleLayerUpdate.bind(this);
    this.handleLayerReordering = this.handleLayerReordering.bind(this);
  }

  updated(changedProperties: PropertyValues<this>): void {
    if (changedProperties.has('viewer' as keyof NgmLayerDisplay)) {
      this.actions = this.viewer == null ? null : new LayersActions(this.viewer);
    }
  }

  private initializeViewer(): void {
    if (this.viewer == null) {
      return;
    }
    this.register(this.viewer.scene.globe.tileLoadProgressEvent.addEventListener((queueLength) => {
      this.globeQueueLength = queueLength;
    }));
  }

  private async handleLayerRemoval(event: LayerRemovalEvent): Promise<void> {
    const newLayers = [...this.layers];
    newLayers.splice(event.detail.idx, 1);
    this.updateLayers(newLayers);
    this.removeLayer(event.detail.config);
  }

  private async handleLayerUpdate(event: LayerChangeEvent): Promise<void> {
    this.updateLayer(event.detail);
  }

  private handleLayerReordering(event: LayerReorderEvent): void {
    const newLayers = [...this.layers];
    newLayers.splice(event.detail.oldIndex, 1);
    newLayers.splice(event.detail.newIndex, 0, event.detail.layer);
    this.updateLayers(newLayers);
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

  readonly render = () => html`
    <ngm-layer-display-list
      .layers="${this.layers}"
      @reorder="${this.handleLayerReordering}"
    ></ngm-layer-display-list>
  `;
  static readonly styles = css`
    :host, :host * {
      box-sizing: border-box;
    }

    :host {
      padding: 16px;
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

type LayerChangeEvent = CustomEvent<LayerConfig>
