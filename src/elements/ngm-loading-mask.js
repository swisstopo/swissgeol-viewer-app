import {LitElement, html} from 'lit-element';
import {classMap} from 'lit-html/directives/class-map';
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
      <div class="ui ${classMap({active: this.active})} inverted dimmer">
        <div class="ui blue tiny progress sliding ${classMap({indeterminate: this.step === 0})}">
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
