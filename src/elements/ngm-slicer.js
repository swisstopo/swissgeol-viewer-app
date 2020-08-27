import {LitElement, html} from 'lit-element';
import i18next from 'i18next';
import Slicer from '../Slicer.js';
import {I18nMixin} from '../i18n.js';

class NgmSlicer extends I18nMixin(LitElement) {

  static get properties() {
    return {
      viewer: {type: Object},
    };
  }
  constructor() {
    super();

    /**
     * @type {import('cesium/Source/Widgets/Viewer/Viewer').default}
     */
    this.viewer;

    /**
     * @type {Slicer}
     */
    this.slicer;
  }

  updated() {
    if (!this.slicer) {
      this.slicer = new Slicer(this.viewer);
      window.slicer = this.slicer;
    }
  }

  toggleSlicer() {
    this.slicer.active = !this.slicer.active;
  }

  render() {
    if (this.viewer) {
      return html`
        <button
          data-tooltip=${i18next.t('slice')}
          data-position="left center"
          data-variation="mini"
          class="ui compact mini icon button"
          @pointerdown="${this.toggleSlicer}">
            <i class="cut icon"></i>
        </button>
      `;
    } else {
      return html``;
    }
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}

customElements.define('ngm-slicer', NgmSlicer);
