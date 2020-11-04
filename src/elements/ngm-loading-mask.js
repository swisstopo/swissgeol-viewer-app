import {LitElement, html} from 'lit-element';
import 'fomantic-ui-css/components/progress.js';
import $ from '../jquery.js';


class NgmLoadingMask extends LitElement {

  static get properties() {
    return {
      active: {type: Boolean},
      step: {type: Number},
      total: {type: Number},
    };
  }

  constructor() {
    super();

    this.active = true;
    this.step = 0;
    this.total = 3;

    this.progress = null;
  }

  firstUpdated() {
    this.progress = $(this.querySelector('.progress'));
    this.progress.progress();
  }

  updated() {
    if (this.step > 0) {
      this.progress.progress('set percent', this.step / this.total * 100);
    }
  }

  render() {
    return html`
      <div class="ui ${this.active ? 'active' : ''} inverted dimmer">
        <div class="ui blue tiny progress ${this.step === 0 ? 'sliding indeterminate' : ''}">
          <div class="bar"></div>
        </div>
      </div>
    `;
  }

  createRenderRoot() {
    return this;
  }
}

customElements.define('ngm-loading-mask', NgmLoadingMask);
