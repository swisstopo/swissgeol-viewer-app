import {customElement, property} from 'lit/decorators.js';
import {html, LitElement} from 'lit';
import {IconKey, icons} from '../../icons/icons';

@customElement('ngm-icon')
export class Icon extends LitElement {
  @property()
  accessor icon: IconKey = 'config';

  render() {
    return html`${icons[this.icon]}`;
  }
}
