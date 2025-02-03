import {customElement} from 'lit/decorators.js';
import {CoreElement} from 'src/components/core';
import {consume} from '@lit/context';
import {BackgroundLayerService} from 'src/components/layer/background/background-layer.service';
import {css, html} from 'lit';
import {repeat} from 'lit/directives/repeat.js';
import {BackgroundLayer} from 'src/components/layer/layer.model';
import './background-layer-item.component';
import {applyTransition} from 'src/styles/theme';

@customElement('ngm-background-layer-select')
export class BackgroundLayerSelect extends CoreElement {
  @consume({context: BackgroundLayerService.context()})
  accessor backgroundLayerService!: BackgroundLayerService;

  @consume({context: BackgroundLayerService.backgroundContext, subscribe: true})
  accessor background!: BackgroundLayer;

  private selectLayer(layer: BackgroundLayer): void {
    this.backgroundLayerService.setBackground(layer.id);
    this.requestUpdate();
  }

  render() {
    if (this.background == null) {
      return;
    }
    return html`
      <ul>
        ${repeat(this.backgroundLayerService.layers, (layer) => layer.id, (layer) => html`
          <li
            role="button"
            @click="${() => this.selectLayer(layer)}"
          >
            <ngm-background-layer-item
              .layer="${layer}"
              .isActive="${this.background.id === layer.id}"
            ></ngm-background-layer-item>
          </li>
        `)}
      </ul>
    `;
  }

  static readonly styles = css`
    :host, :host * {
      box-sizing: border-box;
    }

    ul {
      display: flex;
      list-style: none;
      margin: 0;
      padding: 0;
      gap: 12px;
    }

    ul > li {
      padding: 0;
      margin:0;
      width: 42px;
      height: 42px;
      cursor: pointer;

      ${applyTransition('fade')};
      transition-property: opacity;
    }

    ul > li:hover {
      opacity: 0.75;
    }
  `;
}
