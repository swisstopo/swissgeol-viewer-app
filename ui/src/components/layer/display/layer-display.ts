import {customElement, property, query, state} from 'lit/decorators.js';
import {css, html} from 'lit';
import {Viewer} from 'cesium';
import {PropertyValues} from '@lit/reactive-element';
import LayersActions from 'src/layers/LayersActions';
import {LayerConfig, LayerTreeNode} from 'src/layertree';
import 'src/layers/ngm-layers';
import 'src/layers/ngm-layers-sort';
import MainStore from '../../../store/main';
import '../upload/layer-upload';
import './layer-display-list';
import 'src/components/layer/display/layer-display-list-item';
import {CoreElement} from 'src/components/core';

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

  readonly render = () => html`
    <ngm-layer-display-list .layers="${this.layers}"></ngm-layer-display-list>
  `;
  static readonly styles = css`
    :host, :host * {
      box-sizing: border-box;
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
