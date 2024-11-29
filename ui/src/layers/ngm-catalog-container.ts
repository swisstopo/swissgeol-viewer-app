import {customElement} from 'lit/decorators.js';
import {html, LitElement} from 'lit';
import './ngm-catalog';

@customElement('ngm-icon')
export class Icon extends LitElement {


  render() {

    return html`<ngm-catalog></ngm-catalog>`;
  }
}
