import {LitElement, html} from 'lit-element';
import {classMap} from 'lit-html/directives/class-map';
import style from './ngm-map-chooser-style.js';

class NgmMapChooser extends LitElement {

  static get styles() {
    return style;
  }

  static get properties() {
    return {
      choices: {type: Array},
      active: {type: Object}
    };
  }

  updated() {
    this.dispatchEvent(new CustomEvent('change', {
      detail: {
        active: this.active
      }
    }));
  }

  get mapTemplates() {
    return this.choices.map(mapConfig =>
      html`<div class="ngm-map-preview ${classMap({active: mapConfig.id === this.active.id})}"
                @click=${() => this.active = mapConfig}>
              <label>${mapConfig.labelKey}</label>
              <img src=${mapConfig.backgroundImgSrc} />
           </div>`
    );
  }

  render() {
    return html`<div class="ngm-maps-container">${this.mapTemplates}</div>`;
  }
}

customElements.define('ngm-map-chooser', NgmMapChooser);
