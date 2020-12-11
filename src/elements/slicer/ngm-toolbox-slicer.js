import {LitElement, html} from 'lit-element';
import i18next from 'i18next';
import {I18nMixin} from '../../i18n.js';
import $ from '../../jquery';

class NgmToolboxSlicer extends I18nMixin(LitElement) {

  static get properties() {
    return {
      slicer: {type: Object},
      positions: {type: Array}
    };
  }

  constructor() {
    super();

    /**
     * @type {Slicer}
     */
    this.slicer;

    this.sliceSide = 'left';
    this.sliceEnabled = false;
  }

  firstUpdated() {
    $(this.querySelector('.ngm-slice-warn')).popup({
      position: 'top left',
      content: i18next.t('tbx_line_slice_warn'),
      variation: 'mini',
      forcePosition: true
    });
    $(this.querySelector('.ngm-slice-tools-btn')).popup({
      popup: $(this.querySelector('.ngm-slice-tools-popup')),
      on: 'click',
      position: 'right center'
    });
    $(this.querySelector('.ngm-slice-side')).dropdown({
      onChange: value => {
        this.sliceSide = value;
        if (this.slicer.active) {
          this.toggleSlicer(true);
        }
      },
      values: [
        {name: i18next.t('tbx_slice_left_label'), value: 'left', selected: this.sliceSide === 'left'},
        {name: i18next.t('tbx_slice_right_label'), value: 'right', selected: this.sliceSide === 'right'}
      ]
    });
  }

  toggleSlicer(value) {
    this.sliceEnabled = false;
    if (this.slicer.active) this.slicer.active = false;
    if (value) {
      this.slicer.sliceOptions = {
        slicePoints: [this.positions[0], this.positions[this.positions.length - 1]],
        negate: this.sliceSide === 'left',
        deactivationCallback: () => this.onDeactivation()
      };
      this.slicer.active = true;
      this.sliceEnabled = true;
    }
    this.requestUpdate();
  }

  onDeactivation() {
    this.sliceEnabled = false;
    this.requestUpdate();
  }

  render() {
    if (this.slicer && this.positions.length) {
      return html`
        <div class="ngm-slice-btns-container">
            <div class="ui tiny buttons">
                ${this.sliceEnabled ?
        html`<button class="ui button"
                        @click=${() => this.toggleSlicer(false)}>
                        ${i18next.t('tbx_disable_slice_btn_label')}
                </button>` :
        html`<button class="ui button"
                        @click=${() => this.toggleSlicer(true)}>
                        ${i18next.t('tbx_slice_btn_label')}
                        ${this.positions.length > 2 ? html`
                        <i class="exclamation triangle icon ngm-slice-warn">` : ''}
                </button>`}
                <button class="ui button ngm-slice-tools-btn"><i class="tools icon"></i></button>
            </div>
        </div>
        <div class="ui mini popup ngm-slice-tools-popup">
            <label>${i18next.t('tbx_slice_side_label')}</label>
            <div class="ui fluid selection mini dropdown ngm-slice-side">
                <div class="text"></div>
                <i class="dropdown icon"></i>
            </div>
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

customElements.define('ngm-toolbox-slicer', NgmToolboxSlicer);
