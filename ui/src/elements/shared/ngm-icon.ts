import {customElement, property} from 'lit/decorators.js';
import {css, html, LitElement} from 'lit';
import {IconKey, icons} from '../../icons/icons';

@customElement('ngm-icon')
export class Icon extends LitElement {
  @property()
  accessor icon: IconKey = 'config';

  render() {
    return html`${icons[this.icon]}`;
  }

  static readonly styles = css`
    :host {
      width: 24px;
      height: 24px;
    }

    svg {
      width: 100%;
      height: 100%;
    }
  `;
}
