import {customElement} from 'lit/decorators.js';
import {CoreElement} from 'src/components/core';
import {consume} from '@lit/context';
import {BackgroundLayerService} from 'src/components/layer/background/background-layer.service';
import {css, html} from 'lit';
import {repeat} from 'lit/directives/repeat.js';
import i18next from 'i18next';

@customElement('ngm-background-layer-select')
export class BackgroundLayerSelect extends CoreElement {
  @consume({context: BackgroundLayerService.context()})
  accessor backgroundLayerService!: BackgroundLayerService;

  readonly render = () => html`
    <ul>
      ${repeat(this.backgroundLayerService.layers, (layer) => layer.id, (layer) => html`
        <li>
          <img src="${layer.imagePath}" alt="${i18next.t(layer.label)}" width="40" height="40" >
        </li>
      `)}
    </ul>
  `;

  static readonly styles = css`
    ul {
      display: flex;
      list-style: none;
      margin: 0;
      padding: 0 12px;
      gap: 12px;
    }

    ul > li > img {
      border-radius: 50%;
    }
  `;
}
