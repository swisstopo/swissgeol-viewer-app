import {html} from 'lit-element';
import i18next from 'i18next';
import {LitElementI18n} from '../../i18n.js';
import {syncSliceParam} from '../../permalink';
import $ from '../../jquery';

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

  firstUpdated() {
    this.transformPopup = $(this.querySelector('.ngm-box-slice-btn')).popup({
      popup: $(this.querySelector('.ngm-slice-to-draw')),
      on: 'click',
      position: 'left',
      closable: false
    });
    if (this.slicer.active && this.slicingType === 'view-box') {
      // wait until all buttons loaded to have correct position
      setTimeout(() => this.transformPopup.popup('show'), 500);
    }
  }

  toggleSlicer(type) {
    const active = this.slicer.active;
    const boxOptionChanged = this.slicingType !== type;
    this.slicer.active = false;
    if (!active || boxOptionChanged) {
      this.slicer.sliceOptions = {
        type: type,
        deactivationCallback: () => this.onDeactivation(),
        syncBoxPlanesCallback: (sliceInfo) => syncSliceParam(sliceInfo)
      };
      if (type === 'view-line') {
        this.slicer.sliceOptions.activationCallback = () => syncSliceParam({
          type: type,
          slicePoints: this.slicer.sliceOptions.slicePoints
        });
      }
      this.slicer.active = true;
    }
    this.requestUpdate();
  }

  onDeactivation() {
    syncSliceParam();
    this.transformPopup.popup('hide');
    this.requestUpdate();
  }

  get slicingType() {
    return this.slicer.sliceOptions.type;
  }

  get slicingEnabled() {
    return this.slicer.active;
  }

  addCurrentBoxToToolbox() {
    this.dispatchEvent(new CustomEvent('createrectangle'));
  }

  render() {
    if (this.slicer) {
      return html`
        <button
          data-tooltip=${i18next.t('nav_slice_hint')}
          data-position="left center"
          data-variation="mini"
          class="ui compact mini icon button ${this.slicingEnabled && this.slicingType === 'view-line' ? 'grey' : ''}"
          @pointerdown="${() => this.toggleSlicer('view-line')}">
          <i class="cut icon"></i>
        </button>
        <button
          data-tooltip=${i18next.t('nav_box_slice_hint')}
          data-position="left center"
          data-variation="mini"
          class="ui compact mini icon button ngm-box-slice-btn ${this.slicingEnabled && this.slicingType === 'view-box' ? 'grey' : ''}"
          @pointerdown="${() => this.toggleSlicer('view-box')}">
          <i class="cube icon"></i>
        </button>
        <div class="ui mini basic popup ngm-slice-to-draw">
          <div>
            <i class="lightbulb icon"></i>
            <label>${i18next.t('nav_box_slice_transform_hint')}</label>
          </div>
          <button
            class="ui tiny button"
            @click="${this.addCurrentBoxToToolbox}">
            ${i18next.t('nav_box_slice_transform_btn')}
          </button>
        </div>
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
