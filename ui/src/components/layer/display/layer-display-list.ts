import {customElement, property} from 'lit/decorators.js';
import {consume} from '@lit/context';
import {BackgroundLayerService} from 'src/components/layer/background/background-layer.service';
import {css, html} from 'lit';
import {BackgroundLayer} from 'src/components/layer/layer.model';
import {OpacityChangedEvent, VisibilityChangedEvent} from 'src/components/layer/display/layer-display-list-item';
import i18next from 'i18next';
import {CoreElement} from 'src/components/core';
import {LayerConfig, LayerTreeNode} from 'src/layertree';
import DashboardStore from 'src/store/dashboard';


@customElement('ngm-layer-display-list')
export class LayerDisplayList extends CoreElement {
  @property({type: Array})
  accessor layers: LayerConfig[] = []

  @consume({context: BackgroundLayerService.context()})
  accessor backgroundLayerService!: BackgroundLayerService

  @consume({context: BackgroundLayerService.backgroundContext, subscribe: true})
  accessor background!: BackgroundLayer

  get visibleLayers(): LayerTreeNode[] {
    if (!DashboardStore.projectMode.value) {
      // Don't show KML assets in project view mode.
      return this.layers.filter((layer) => !layer.topicKml);
    }
    return this.layers;
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
      ${this.visibleLayers.map((layer) => html`
        <li>
          <ngm-layer-display-list-item
            title="${i18next.t(layer.label)}"
            ?visible="${layer.visible}"
            .opacity="${layer.opacity}"
          ></ngm-layer-display-list-item>
        </li>
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
