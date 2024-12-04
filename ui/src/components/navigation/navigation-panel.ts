import {LitElementI18n} from '../../i18n';
import {css, html} from 'lit';
import {customElement} from 'lit/decorators.js';
import '../core';

@customElement('ngm-navigation-panel')
export class NavigationPanel extends LitElementI18n {
  readonly render = () => html`<slot></slot>`;

  static readonly styles = css`
    :host {
      --panel-height: calc(100vh - var(--ngm-header-height));

      box-sizing: border-box;
      width: 530px;
      max-width: 100vw;
      height: var(--panel-height);
      max-height: var(--panel-height);
      max-width: calc(100vw);
      padding: 0 var(--panel-padding);

      display: flex;
      flex-direction: column;
      overflow-y: auto;
      box-shadow: 4px 0 4px #00000029;
      z-index: 5;

      background-color: var(--color-bg--dark);
    }
  `;
}

