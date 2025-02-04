import {customElement, property} from 'lit/decorators.js';
import {consume} from '@lit/context';
import {BackgroundLayerService} from 'src/components/layer/background/background-layer.service';
import {css, html} from 'lit';
import {BackgroundLayer} from 'src/components/layer/layer.model';
import {OpacityChangeEvent, VisibilityChangeEvent} from 'src/components/layer/display/layer-display-list-item';
import i18next from 'i18next';
import {CoreElement} from 'src/components/core';
import {LayerConfig, LayerTreeNode} from 'src/layertree';
import DashboardStore from 'src/store/dashboard';
import Sortable from 'sortablejs';
import {repeat} from 'lit/directives/repeat.js';
import LayersAction from 'src/layers/LayersActions';
import MainStore from 'src/store/main';
import LayersActions from 'src/layers/LayersActions';


@customElement('ngm-layer-display-list')
export class LayerDisplayList extends CoreElement {
  @property({type: Array})
  accessor layers: LayerConfig[] = []

  @consume({context: BackgroundLayerService.context()})
  accessor backgroundLayerService!: BackgroundLayerService

  @consume({context: BackgroundLayerService.backgroundContext, subscribe: true})
  accessor background!: BackgroundLayer

  private actions!: LayersAction;

  private sortable: Sortable | null = null;

  constructor() {
    super();
    this.attachShadow({mode: 'open'});

    this.register(MainStore.viewer.subscribe((viewer) => {
      this.actions = new LayersActions(viewer!);
    }));
  }

  firstUpdated(): void {
    this.initializeDragging();
  }

  disconnectedCallback(): void {
    this.sortable?.destroy();
  }

  private initializeDragging(): void {
    const listElement = this.shadowRoot!.querySelector('ul');
    if (listElement == null) {
      return;
    }
    this.sortable = Sortable.create(listElement, {
      animation: 150,
      handle: '.handle',
      forceFallback: true,
      draggable: 'ngm-layer-display-list-item',
      chosenClass: 'is-dragged',
      onStart: () => {
        for (const child of listElement.children) {
          child.classList.add('is-in-drag');
        }
      },
      onEnd: () => {
        for (const child of listElement.children) {
          child.classList.remove('is-in-drag');
        }
      },
      onUpdate: (e) => this.moveItem(e.oldIndex!, e.newIndex!),
    });
  }

  private moveItem(oldIndex: number, newIndex: number): void {
    this.dispatchEvent(new CustomEvent<LayerReorderEventDetail>('reorder', {
      detail: {
        layer: this.layers[oldIndex],
        oldIndex,
        newIndex,
      }
    }));
  }

  private changeLayer(layer: LayerConfig): void {
    this.dispatchEvent(new CustomEvent<LayerChangeEventDetail>('layer-change', {
      detail: {
        layer,
      }
    }));
  }

  get visibleLayers(): LayerTreeNode[] {
    if (!DashboardStore.projectMode.value) {
      // Don't show KML assets in project view mode.
      return this.layers.filter((layer) => !layer.topicKml);
    }
    return this.layers;
  }

  private handleBackgroundVisibilityChange(event: VisibilityChangeEvent): void {
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

  private handleBackgroundOpacityChange(event: OpacityChangeEvent) {
    const {opacity} = event.detail;
    this.updateBackgroundVisibility(opacity > 0);
    this.backgroundLayerService.update({opacity});
  }

  private async updateLayerVisibility(layer: LayerConfig, isVisible: boolean): Promise<void> {
    if (layer.opacity === 0 && isVisible) {
      // If the opacity is set to zero, we force the layer to remain hidden.
      return;
    }
    if (layer.visible === isVisible) {
      return;
    }
    layer.visible = isVisible;
    await this.actions.changeVisibility(layer, isVisible);
    this.changeLayer(layer);
    this.requestUpdate();
  }

  private updateLayerOpacity(layer: LayerConfig, opacity: number): void {
    layer.opacity = opacity;
    this.actions.changeOpacity(layer, opacity);
    this.updateLayerVisibility(layer, opacity > 0);
    this.changeLayer(layer);
    this.requestUpdate();
  }

  readonly render = () => html`
    ${this.visibleLayers.length === 0 ? '' : this.renderLayers()}

    <ngm-layer-display-list-item
      title="${i18next.t(this.background.label)}"
      label="Hintergrund"
      ?visible="${this.background.isVisible}"
      .opacity="${this.background.opacity}"
      @visibility-changed="${this.handleBackgroundVisibilityChange}"
      @opacity-changed="${this.handleBackgroundOpacityChange}"
    ></ngm-layer-display-list-item>
  `;

  readonly renderLayers = () => html`
    <ul>
      ${repeat(this.visibleLayers, (layer) => layer.label, (layer) => html`
        <ngm-layer-display-list-item
          role="listitem"
          title="${i18next.t(layer.label)}"
          ?visible="${layer.visible}"
          .opacity="${layer.opacity}"
          draggable
          @visibility-changed="${(e: VisibilityChangeEvent) => this.updateLayerVisibility(layer, e.detail.isVisible)}"
          @opacity-changed="${(e: OpacityChangeEvent) => this.updateLayerOpacity(layer, e.detail.opacity)}"
        ></ngm-layer-display-list-item>
    `)}
    </ul>
    <hr>
  `;

  static readonly styles = css`
    :host, :host * {
      box-sizing: border-box;
    }

    :host {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 12px;
      border-radius: 4px;
      background-color: var(--color-bg--white);
    }

    ul {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 0;
      margin: 0;
      list-style: none;
    }

    hr {
      height: 1px;
      border: 0;
      margin: 0 12px;
      color: var(--color-border--default);
      background-image: url("data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='100%25' height='100%25' fill='none' stroke='%23DFE4E9' stroke-width='4' stroke-dasharray='3%2c 12' stroke-dashoffset='0' stroke-linecap='square'/%3e%3c/svg%3e");
    }
  `;
}

export type LayerChangeEvent = CustomEvent<LayerChangeEventDetail>
export interface LayerChangeEventDetail {
  layer: LayerConfig
}


export type LayerReorderEvent = CustomEvent<LayerReorderEventDetail>
export interface LayerReorderEventDetail {
  layer: LayerConfig
  oldIndex: number
  newIndex: number
}
