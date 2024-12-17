import {css, html, LitElement} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import {IconKey, icons} from "../../icons/icons";

@customElement('ngm-core-icon')
export class CoreIcon extends LitElement {
  @property()
  accessor icon: IconKey = 'config';

  @property({type: Boolean, attribute: 'interactive'})
  accessor isInteractive: boolean = false;

  static readonly styles = css`

    :host([interactive]:hover) {
      cursor: pointer;
      color: var(--color-action);
    }
  `;

  readonly render = () =>  {
    return html`${icons[this.icon]}`;
  }
}
