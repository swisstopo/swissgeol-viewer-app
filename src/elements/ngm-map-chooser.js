import {LitElement, html} from 'lit-element';
import {classMap} from 'lit-html/directives/class-map';
import i18next from 'i18next';
import {I18nMixin} from '../i18n.js';

class NgmMapChooser extends I18nMixin(LitElement) {

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
              <label>${i18next.t(mapConfig.labelKey)}</label>
              <img src=${mapConfig.backgroundImgSrc} />
           </div>`
    );
  }

  render() {
    return html`<div>${this.mapTemplates}</div>`;
  }

  createRenderRoot() {
    return this;
  }
}

customElements.define('ngm-map-chooser', NgmMapChooser);
