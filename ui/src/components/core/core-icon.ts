import {css, html, LitElement} from 'lit';
import {customElement, property} from 'lit/decorators.js';

@customElement('ngm-core-icon')
export class CoreIcon extends LitElement {
  @property()
  accessor icon: IconName | null = null;

  @property({type: Boolean, attribute: 'interactive'})
  accessor isInteractive: boolean = false;

  readonly render = () => html``;

  static readonly styles = css`
    :host {
      display: inline-block;

      --size: var(--icon-size--normal);
      width: var(--size);
      height: var(--size);
      background-color: var(--color-bg-contrast);

      mask: var(--mask, none) no-repeat center;
      -webkit-mask: var(--mask, none) no-repeat center;

      /* Hide element if no valid icon has been specified. */
      visibility: hidden;
    }

    :host([interactive]:hover) {
      cursor: pointer;
      background-color: var(--color-action);
    }

    :host([icon='close']) {
      visibility: initial;
      --mask: url('images/i_close.svg');
    }

    :host([icon='dropdown']) {
      visibility: initial;
      --mask: url('images/i_menu-1.svg')
    }
  `;
}

export type IconName =
  | 'close'
  | 'dropdown'
