import {LitElement, html} from 'lit-element';
import {classMap} from 'lit-html/directives/class-map';


class NgmAccordion extends LitElement {

  static get properties() {
    return {
      opened: {type: Boolean}
    };
  }

  constructor() {
    super();
    this.opened = false;
  }

  updated() {
    if (!this.opened) {
      this.dispatchEvent(new CustomEvent('closed'));
    }
  }

  render() {
    // FIXME: this component uses shadow DOM so the external styling is not applied. ! :/
    // shadow DOM is necessary for slots. Is there a fix for this?
    return html`
    <div>
    <div class="ui syled accordion ${classMap({active: this.opened})}">
      <div class="title" >
        <i class="dropdown icon" @click=${() => this.opened = !this.opened}></i>
        <slot name="title" @click=${() => this.opened = !this.opened}></slot>
      </div>
      <div class="content">
        <slot name="content"></slot>
      </div>
    </div>
    </div>`;
  }
}

customElements.define('ngm-accordion', NgmAccordion);
