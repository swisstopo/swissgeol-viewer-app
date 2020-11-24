import {LitElement, html} from 'lit-element';
import i18next from 'i18next';
import {I18nMixin} from '../../i18n.js';

class NgmSlicer extends I18nMixin(LitElement) {

  static get properties() {
    return {
      slicer: {type: Object},
    };
  }

  constructor() {
    super();

    /**
     * @type {Slicer}
     */
    this.slicer;
  }

  toggleSlicer(box) {
    const active = this.slicer.active;
    const boxOptionChanged = this.slicer.sliceOptions.box !== box;
    this.slicer.active = false;
    if (!active || boxOptionChanged) {
      this.slicer.sliceOptions = {
        box: box,
        deactivationCallback: () => this.onDeactivation()
      };
      this.slicer.active = true;
    }
    this.sliceEnabled = this.slicer.active;
    this.requestUpdate();
  }

  onDeactivation() {
    this.sliceEnabled = false;
    this.requestUpdate();
  }

  render() {
    if (this.slicer) {
      return html`
        <button
          data-tooltip=${i18next.t('nav_slice_hint')}
          data-position="left center"
          data-variation="mini"
          class="ui compact mini icon button ${this.sliceEnabled && !this.slicer.sliceOptions.box ? 'grey' : ''}"
          @pointerdown="${() => this.toggleSlicer(false)}">
            <i class="cut icon"></i>
        </button>
        <button
          data-tooltip=${i18next.t('nav_box_slice_hint')}
          data-position="left center"
          data-variation="mini"
          class="ui compact mini icon button ${this.sliceEnabled && this.slicer.sliceOptions.box ? 'grey' : ''}"
          @pointerdown="${() => this.toggleSlicer(true)}">
            <i class="cube icon"></i>
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
