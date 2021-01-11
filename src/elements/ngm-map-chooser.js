import {html, LitElement} from 'lit-element';
import {classMap} from 'lit-html/directives/class-map';

class NgmMapChooser extends LitElement {

  static get properties() {
    return {
      choices: {type: Array},
      active: {type: Object}
    };
  }

  constructor() {
    super();
    this.choices = [];
    this.active = null;
  }

  updated() {
    this.dispatchEvent(new CustomEvent('change', {
      detail: {
        active: this.active
      }
    }));
  }

  getMapTemplate(mapConfig) {
    return html`
    <div class="ngm-map-preview ${classMap({active: mapConfig.id === this.active.id})}"
        data-tooltip="${mapConfig.labelKey}"
        data-variation="mini"
        data-position="top center"
        @click=${() => this.active = mapConfig}>
      <img src=${mapConfig.backgroundImgSrc} />
    </div>`;
  }

  render() {
    return html`
      <div class="ngm-maps-container">
        ${this.choices.map(c => this.getMapTemplate(c))}
      </div>
    `;
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}

customElements.define('ngm-map-chooser', NgmMapChooser);
