import {html} from 'lit-element';
import i18next from 'i18next';
import {LitElementI18n} from '../../i18n.js';

class NgmSlicer extends LitElementI18n {

  static get properties() {
    return {
      slicer: {type: Object},
    };
  }

  constructor() {
    super();

    /**
     * @type {import('../../slicer/Slicer').default}
     */
    this.slicer = null;
  }

  toggleSlicer(type) {
    const active = this.slicer.active;
    const boxOptionChanged = this.slicingType !== type;
    this.slicer.active = false;
    if (!active || boxOptionChanged) {
      this.slicer.sliceOptions = {
        type: type,
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

  get slicingType() {
    return this.slicer.sliceOptions.type;
  }

  render() {
    if (this.slicer) {
      return html`
        <button
          data-tooltip=${i18next.t('nav_slice_hint')}
          data-position="left center"
          data-variation="mini"
          class="ui compact mini icon button ${this.sliceEnabled && this.slicingType === 'view-line' ? 'grey' : ''}"
          @pointerdown="${() => this.toggleSlicer('view-line')}">
            <i class="cut icon"></i>
        </button>
        <button
          data-tooltip=${i18next.t('nav_box_slice_hint')}
          data-position="left center"
          data-variation="mini"
          class="ui compact mini icon button ${this.sliceEnabled && this.slicingType === 'view-box' ? 'grey' : ''}"
          @pointerdown="${() => this.toggleSlicer('view-box')}">
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
